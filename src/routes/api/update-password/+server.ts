import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    const { password } = await request.json();

    // Validate input
    if (!password || typeof password !== 'string') {
      console.log('[API] update-password: Invalid password format')
      return json({ error: 'Password is required' }, { status: 400 });
    }

    if (password.length < 10) {
      console.log('[API] update-password: Password too short')
      return json({ error: 'Password must be at least 10 characters long' }, { status: 400 });
    }

    // Check if user has a valid session
    if (!locals.session?.user) {
      console.log('[API] update-password: No valid session')
      return json({ error: 'Authentication required' }, { status: 401 });
    }

    // Update password using server-side supabase client
    const { error } = await locals.supabase.auth.updateUser({
      password: password
    });

    if (error) {
      console.error('[API] update-password: Failed to update', { error: error.message })
      // Sanitize error messages - don't expose internal details
      const sanitizedMessage = error.message?.includes('same password') 
        ? 'New password must be different from current password'
        : 'Failed to update password. Please try again.';
      return json({ error: sanitizedMessage }, { status: 400 });
    }

    console.log('[API] update-password: Success')
    return json({ success: true });
  } catch (error: any) {
    console.error('[API] update-password: Exception', { error: error?.message || 'Unknown error' })
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};