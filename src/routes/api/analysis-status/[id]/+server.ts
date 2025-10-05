import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.user || !locals.supabase) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  try {
    // Get the analysis run from the database
    const { data, error } = await locals.supabase
      .from('analysis_runs')
      .select('*, business:businesses!inner(user_id)')
      .eq('id', id)
      .single();

    if (error) {
      return json({ error: 'Analysis not found' }, { status: 404 });
    }

    // Verify that the analysis belongs to the current user's business
    if (!data.business || data.business.user_id !== locals.user.id) {
      return json({ error: 'Access denied' }, { status: 403 });
    }

    // Return the analysis data (without business info)
    return json({
      id: data.id,
      status: data.status,
      completed_llm_calls: data.completed_llm_calls || 0,
      total_llm_calls: data.total_llm_calls || 0,
      completed_queries: data.completed_queries || 0,
      total_queries: data.total_queries || 0,
      run_date: data.run_date,
      created_at: data.created_at
    });

  } catch (error) {
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};