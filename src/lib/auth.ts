import { writable } from 'svelte/store'
import { supabase } from './supabase'
import type { User, Session } from '@supabase/supabase-js'

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

      // Listen for auth changes
      supabase.auth.onAuthStateChange((_event, newSession) => {
        session.set(newSession)
        user.set(newSession?.user ?? null)
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
}
