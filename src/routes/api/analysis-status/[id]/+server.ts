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
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching analysis status:', error);
      return json({ error: 'Analysis not found' }, { status: 404 });
    }

    // Return the analysis data
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
    console.error('Unexpected error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};