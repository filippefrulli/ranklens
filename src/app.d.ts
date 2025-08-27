// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { SupabaseClient } from '@supabase/supabase-js'

declare global {
  namespace App {
    interface Locals {
      user?: {
        id: string
        email?: string
        [key: string]: any
      }
      supabase?: SupabaseClient
      accessToken?: string
    }
  }
}

export {};
