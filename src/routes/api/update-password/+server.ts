import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    const { password } = await request.json();

    // Validate input
    if (!password || typeof password !== 'string') {
      return json({ error: 'Password is required' }, { status: 400 });
    }

    if (password.length < 10) {
      return json({ error: 'Password must be at least 10 characters long' }, { status: 400 });
    }

    // Check if user has a valid session
    if (!locals.session?.user) {
      return json({ error: 'Authentication required' }, { status: 401 });
    }

    // Update password using server-side supabase client
    const { error } = await locals.supabase.auth.updateUser({
      password: password
    });

    if (error) {
      console.error('Password update error:', error);
      return json({ error: error.message }, { status: 400 });
    }

    return json({ success: true });
  } catch (error) {
    console.error('Update password API error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};