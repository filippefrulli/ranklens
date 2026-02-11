import type { PageServerLoad, Actions } from './$types'
import { fail, redirect } from '@sveltejs/kit'
import { DatabaseService } from '$lib/services/database-service'

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user || !locals.supabase) {
    throw redirect(302, '/auth')
  }

  try {
    const dbService = new DatabaseService(locals.supabase, locals.user.id)

    // Get company (one per user)
    const company = await dbService.getCompany()
    if (!company) {
      return { needsOnboarding: true, user: locals.user }
    }

    // Get products for this company
    const products = await dbService.getProductsForCompany(company.id)

    return {
      company,
      products,
      user: locals.user
    }
  } catch (err: any) {
    if (err?.status === 302 || err?.location) throw err
    console.error('[Load] Products page: Error', { error: err?.message || err })
    return fail(500, { error: 'Failed to load products' })
  }
}

export const actions: Actions = {
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

  deleteProduct: async ({ locals, request }) => {
    if (!locals.user || !locals.supabase) {
      return fail(401, { error: 'Unauthorized' })
    }

    const formData = await request.formData()
    const productId = formData.get('productId') as string

    if (!productId) {
      return fail(400, { error: 'Product ID is required' })
    }

    try {
      const dbService = new DatabaseService(locals.supabase, locals.user.id)
      const isOwner = await dbService.validateProductOwnership(productId)
      if (!isOwner) {
        return fail(404, { error: 'Product not found or access denied' })
      }

      await dbService.deleteProduct(productId)
      return { success: true }
    } catch (err: any) {
      console.error('[Action] deleteProduct: Error', { error: err?.message })
      return fail(500, { error: 'Failed to delete product' })
    }
  },

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
  }
}
