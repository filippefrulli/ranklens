<script lang="ts">
  import type { PageData, ActionData } from "./$types";
  import type { User } from "@supabase/supabase-js";
  import type {
    Business,
    Query,
    QueryRankingHistory,
    WeeklyAnalysisCheck,
    AnalysisRun,
    LLMProvider,
  } from "$lib/types";
  import Dashboard from "$lib/components/dashboard/Dashboard.svelte";

  interface DashboardData {
    user: User;
    business: Business;
    queries: Query[];
    queryHistories: Record<string, QueryRankingHistory[]>;
    weeklyCheck: WeeklyAnalysisCheck;
    runningAnalysis: AnalysisRun | null;
  }

  interface Props {
    data: PageData & DashboardData;
    form: ActionData;
  }

  let { data, form }: Props = $props();
</script>

<Dashboard
  {form}
  user={data.user}
  business={data.business}
  queries={data.queries ?? []}
  queryHistories={data.queryHistories ?? {}}
  weeklyCheck={data.weeklyCheck}
  runningAnalysis={data.runningAnalysis ?? null}
  llmProviders={[]}
  needsOnboarding={false}
  error={null}
/>
