import type { PageServerLoad, Actions } from './$types'
import { error, fail, redirect } from '@sveltejs/kit'
import { DatabaseService } from '$lib/services/database-service'

export const load: PageServerLoad = async ({ locals, params }) => {
  if (!locals.user || !locals.supabase) {
    throw redirect(302, '/auth')
  }

  const productId = params.id
  if (!productId) {
    throw error(404, 'Product not found')
  }

  try {
    const dbService = new DatabaseService(locals.supabase, locals.user.id)

    // RLS ensures only the owner can read their products — no separate ownership check needed
    const productWithCompany = await dbService.getProductWithCompany(productId)
    if (!productWithCompany) {
      throw error(404, 'Product not found')
    }

    const { company, ...product } = productWithCompany
    const measurements = await dbService.getMeasurementsForProduct(productId)

    // Get per-measurement stats (last run + average rank)
    const summariesMap = await dbService.getMeasurementSummaries(productId)
    const measurementSummaries: Record<string, { lastRunAt: string | null, averageRank: number | null }> = {}
    for (const [id, summary] of summariesMap) {
      measurementSummaries[id] = summary
    }

    return {
      product,
      company,
      measurements,
      measurementSummaries,
      user: locals.user
    }
  } catch (err: any) {
    if (err?.status) throw err
    console.error('[Load] Measurements page: Error', { productId, error: err?.message })
    throw error(500, 'Failed to load product data')
  }
}

export const actions: Actions = {
  addMeasurement: async ({ locals, request, params }) => {
    if (!locals.user || !locals.supabase) {
      return fail(401, { error: 'Unauthorized' })
    }

    const productId = params.id
    const formData = await request.formData()
    const title = (formData.get('title') as string)?.trim()
    const queryText = (formData.get('query') as string)?.trim()

    if (!title || title.length === 0) {
      return fail(400, { error: 'Title is required' })
    }
    if (!queryText || queryText.length === 0) {
      return fail(400, { error: 'Query text is required' })
    }

    try {
      const dbService = new DatabaseService(locals.supabase, locals.user.id)
      const isOwner = await dbService.validateProductOwnership(productId)
      if (!isOwner) {
        return fail(404, { error: 'Product not found or access denied' })
      }

      // Check for duplicates
      const existing = await dbService.getMeasurementsForProduct(productId)
      const duplicate = existing.find(m =>
        m.query.toLowerCase().trim() === queryText.toLowerCase()
      )
      if (duplicate) {
        return fail(400, { error: 'This query already exists' })
      }

      await dbService.createMeasurement({
        product_id: productId,
        title,
        query: queryText
      })

      return { success: true }
    } catch (err: any) {
      console.error('[Action] addMeasurement: Error', { error: err?.message })
      return fail(500, { error: 'Failed to add measurement' })
    }
  },

  deleteMeasurement: async ({ locals, request, params }) => {
    if (!locals.user || !locals.supabase) {
      return fail(401, { error: 'Unauthorized' })
    }

    const formData = await request.formData()
    const measurementId = formData.get('measurementId') as string

    if (!measurementId) {
      return fail(400, { error: 'Measurement ID is required' })
    }

    try {
      const dbService = new DatabaseService(locals.supabase, locals.user.id)
      const isOwner = await dbService.validateProductOwnership(params.id)
      if (!isOwner) {
        return fail(404, { error: 'Access denied' })
      }

      await dbService.deleteMeasurement(measurementId)
      return { success: true }
    } catch (err: any) {
      console.error('[Action] deleteMeasurement: Error', { error: err?.message })
      return fail(500, { error: 'Failed to delete measurement' })
    }
  }
}
