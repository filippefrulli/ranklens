import type { PageServerLoad, Actions } from './$types'
import { fail, redirect } from '@sveltejs/kit'
import { DatabaseService } from '$lib/services/database-service'
import { AnalysisService } from '$lib/services/analysis-service'
import { QuerySuggestionService } from '$lib/services/query-suggestion-service'

export const load: PageServerLoad = async ({ locals, depends }) => {
  if (!locals.user || !locals.supabase) {
    throw redirect(302, '/auth')
  }

  depends('app:analysis-status')

  try {
    const dbService = new DatabaseService(locals.supabase, locals.user.id)

    // Get company (one per user)
    const company = await dbService.getCompany()
    if (!company) {
      // No company yet → onboarding
      return { needsOnboarding: true, user: locals.user }
    }

    // Get products for this company
    const products = await dbService.getProductsForCompany(company.id)

    // For MVP: use the first active product (or null if none)
    const activeProduct = products.length > 0 ? products[0] : null

    // Get measurements for the active product
    const measurements = activeProduct
      ? await dbService.getMeasurementsForProduct(activeProduct.id)
      : []

    // Load ranking histories for each measurement
    const measurementHistories: Record<string, any[]> = {}
    for (const m of measurements) {
      try {
        measurementHistories[m.id] = await dbService.getMeasurementRankingHistory(m.id, 10)
      } catch {
        measurementHistories[m.id] = []
      }
    }

    // Get running analysis for the active product
    let runningAnalysis = null
    if (activeProduct) {
      const analysisService = new AnalysisService(locals.supabase, locals.user.id)
      runningAnalysis = await analysisService.getAnalysisStatus(activeProduct.id)
    }

    // Get LLM providers
    let llmProviders: any[] = []
    try {
      llmProviders = await dbService.getActiveLLMProviders()
    } catch {}

    return {
      company,
      products,
      activeProduct,
      measurements,
      measurementHistories,
      runningAnalysis,
      llmProviders,
      user: locals.user
    }
  } catch (err: any) {
    // Don't catch redirect
    if (err?.status === 302 || err?.location) throw err
    console.error('[Load] Dashboard: Error', { error: err?.message || err })
    return fail(500, { error: 'Failed to load dashboard data' })
  }
}

export const actions: Actions = {
  // Run analysis for the active product
  runAnalysis: async ({ locals, request }) => {
    if (!locals.user || !locals.supabase) {
      return fail(401, { error: 'Unauthorized' })
    }

    const formData = await request.formData()
    const productId = formData.get('productId') as string

    if (!productId) {
      return fail(400, { error: 'Product ID is required' })
    }

    try {
      console.log('[Action] runAnalysis: Starting', { productId })
      const dbService = new DatabaseService(locals.supabase, locals.user.id)

      // Validate product ownership
      const isOwner = await dbService.validateProductOwnership(productId)
      if (!isOwner) {
        return fail(404, { error: 'Product not found or access denied' })
      }

      const analysisService = new AnalysisService(locals.supabase, locals.user.id)
      const result = await analysisService.runAnalysis(productId)

      if (!result.success) {
        console.error('[Action] runAnalysis: Failed', { productId, error: result.error })
        return fail(500, { error: result.error || 'Failed to start analysis' })
      }

      console.log('[Action] runAnalysis: Success', { productId, analysisRunId: result.analysisRunId })
      return { success: true, analysisRunId: result.analysisRunId }
    } catch (err: any) {
      console.error('[Action] runAnalysis: Exception', { productId, error: err?.message })
      return fail(500, { error: 'Failed to run analysis' })
    }
  },

  // Add measurement to the active product
  addMeasurement: async ({ locals, request }) => {
    if (!locals.user || !locals.supabase) {
      return fail(401, { error: 'Unauthorized' })
    }

    const formData = await request.formData()
    const queryText = formData.get('query') as string
    const productId = formData.get('productId') as string

    if (!queryText || queryText.trim().length === 0) {
      return fail(400, { error: 'Query text is required' })
    }
    if (!productId) {
      return fail(400, { error: 'Product ID is required' })
    }

    try {
      const dbService = new DatabaseService(locals.supabase, locals.user.id)

      // Validate product ownership
      const isOwner = await dbService.validateProductOwnership(productId)
      if (!isOwner) {
        return fail(404, { error: 'Product not found or access denied' })
      }

      // Check for duplicates
      const existingMeasurements = await dbService.getMeasurementsForProduct(productId)
      const duplicate = existingMeasurements.find(m =>
        m.query.toLowerCase().trim() === queryText.toLowerCase().trim()
      )
      if (duplicate) {
        return fail(400, { error: 'This measurement query already exists' })
      }

      const measurement = await dbService.createMeasurement({
        product_id: productId,
        title: queryText.trim().slice(0, 100), // Auto-generate title from query
        query: queryText.trim()
      })

      return { success: true, measurement }
    } catch (err: any) {
      console.error('[Action] addMeasurement: Error', { error: err?.message })
      return fail(500, { error: 'Failed to add measurement' })
    }
  },

  // Create a new product for the company
  createProduct: async ({ locals, request }) => {
    if (!locals.user || !locals.supabase) {
      return fail(401, { error: 'Unauthorized' })
    }

    const formData = await request.formData()
    const name = formData.get('name') as string
    const description = (formData.get('description') as string) || undefined

    if (!name || name.trim().length === 0) {
      return fail(400, { error: 'Product name is required' })
    }

    try {
      const dbService = new DatabaseService(locals.supabase, locals.user.id)
      const company = await dbService.getCompany()
      if (!company) {
        return fail(404, { error: 'Company not found' })
      }

      const product = await dbService.createProduct({
        company_id: company.id,
        name: name.trim(),
        description: description?.trim()
      })

      return { success: true, product }
    } catch (err: any) {
      console.error('[Action] createProduct: Error', { error: err?.message })
      return fail(500, { error: 'Failed to create product' })
    }
  },

  // Create company (onboarding)
  createCompany: async ({ locals, request }) => {
    if (!locals.user || !locals.supabase) {
      return fail(401, { error: 'Unauthorized' })
    }

    const formData = await request.formData()
    const name = formData.get('name') as string
    const googlePlaceId = formData.get('google_place_id') as string | null
    const googlePrimaryTypeDisplay = formData.get('google_primary_type_display') as string | null

    if (!name || name.trim().length === 0) {
      return fail(400, { error: 'Company name is required' })
    }

    try {
      const dbService = new DatabaseService(locals.supabase, locals.user.id)

      const company = await dbService.createCompany({
        name: name.trim(),
        google_place_id: googlePlaceId || undefined,
        google_primary_type_display: googlePrimaryTypeDisplay || undefined
      })

      return { success: true, company }
    } catch (err: any) {
      console.error('[Action] createCompany: Error', { error: err?.message })
      return fail(500, { error: 'Failed to create company' })
    }
  },

  // Generate query suggestions
  generateQuerySuggestions: async ({ locals }) => {
    if (!locals.user || !locals.supabase) {
      return fail(401, { error: 'Unauthorized' })
    }

    try {
      const dbService = new DatabaseService(locals.supabase, locals.user.id)
      const company = await dbService.getCompany()
      if (!company) {
        return fail(404, { error: 'Company not found' })
      }

      const suggestions = await QuerySuggestionService.generateQuerySuggestions(company)

      return { suggestions: suggestions.map(s => s.text) }
    } catch (err: any) {
      console.error('[Action] generateQuerySuggestions: Error', { error: err?.message })
      return fail(500, { error: 'Failed to generate query suggestions' })
    }
  }
}
