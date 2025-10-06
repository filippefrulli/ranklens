import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.user || !locals.supabase) {
    console.log('[API] analysis-status: Unauthorized access attempt')
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
      console.log('[API] analysis-status: Unauthorized access to analysis', { analysisId: id })
      return json({ error: 'Access denied' }, { status: 403 });
    }

    // Only log status changes (not running) to reduce noise
    if (data.status !== 'running') {
      console.log('[API] analysis-status: Status change', { analysisId: id, status: data.status })
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

  } catch (error: any) {
    console.error('[API] analysis-status: Error', { analysisId: params.id, error: error?.message || 'Unknown error' })
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};