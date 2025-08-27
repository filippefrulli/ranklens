import { writable } from 'svelte/store'
import { supabase } from '../supabase'
import type { User, Session } from '@supabase/supabase-js'
import { browser } from '$app/environment'

// Auth state stores
export const user = writable<User | null>(null)
export const session = writable<Session | null>(null)
export const loading = writable(true)

// Auth service class
export class AuthService {
  static async initialize() {
    loading.set(true)
    
    try {
      // Get initial session
      const { data: { session: initialSession } } = await supabase.auth.getSession()
      session.set(initialSession)
      user.set(initialSession?.user ?? null)

      // Store access token in cookie for server-side access
      if (browser && initialSession?.access_token) {
        document.cookie = `sb-access-token=${initialSession.access_token}; path=/; max-age=${24 * 60 * 60}; secure; samesite=strict`
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange((_event, newSession) => {
        session.set(newSession)
        user.set(newSession?.user ?? null)
        
        // Update access token cookie
        if (browser) {
          if (newSession?.access_token) {
            document.cookie = `sb-access-token=${newSession.access_token}; path=/; max-age=${24 * 60 * 60}; secure; samesite=strict`
          } else {
            // Clear cookie on sign out
            document.cookie = 'sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
          }
        }
        
        loading.set(false)
      })
    } catch (error) {
      console.error('Auth initialization error:', error)
      loading.set(false)
    }
  }

  static async signInWithGoogle() {
    loading.set(true)
    
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${import.meta.env.VITE_SITE_URL || 'http://localhost:5173'}/auth/callback`
        }
      })

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Google sign-in error:', error)
      loading.set(false)
      return { data: null, error }
    }
  }

  static async signInWithEmail(email: string, password: string) {
    loading.set(true)
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Email sign-in error:', error)
      loading.set(false)
      return { data: null, error }
    }
  }

  static async signUpWithEmail(email: string, password: string) {
    loading.set(true)
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${import.meta.env.VITE_SITE_URL || 'http://localhost:5173'}/auth/callback`
        }
      })

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Email sign-up error:', error)
      loading.set(false)
      return { data: null, error }
    }
  }

  static async signOut() {
    loading.set(true)
    
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      // Clear stores
      user.set(null)
      session.set(null)
      
      // Clear access token cookie
      if (browser) {
        document.cookie = 'sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      }
      
      return { error: null }
    } catch (error) {
      console.error('Sign-out error:', error)
      return { error }
    } finally {
      loading.set(false)
    }
  }

  static async resetPassword(email: string) {
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${import.meta.env.VITE_SITE_URL || 'http://localhost:5173'}/auth/reset-password`
      })

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Password reset error:', error)
      return { data: null, error }
    }
  }

  // Helper to get access token for API requests
  static async getAccessToken(): Promise<string | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      return session?.access_token || null
    } catch (error) {
      console.error('Error getting access token:', error)
      return null
    }
  }

  // Helper to make authenticated API requests
  static async makeAuthenticatedRequest(url: string, options: RequestInit = {}) {
    const accessToken = await this.getAccessToken()
    
    if (!accessToken) {
      throw new Error('No access token available')
    }

    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })
  }
}
