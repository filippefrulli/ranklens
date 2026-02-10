<script lang="ts">
  import type { PageData, ActionData } from "./$types";
  import type { User } from "@supabase/supabase-js";
  import type {
    Company,
    Product,
    Measurement,
    MeasurementRankingHistory,
    AnalysisRun,
    LLMProvider,
  } from "$lib/types";
  import Dashboard from "$lib/components/dashboard/Dashboard.svelte";

  interface DashboardPageData {
    user: User;
    company?: Company;
    products?: Product[];
    activeProduct?: Product | null;
    measurements?: Measurement[];
    measurementHistories?: Record<string, MeasurementRankingHistory[]>;
    runningAnalysis?: AnalysisRun | null;
    llmProviders?: LLMProvider[];
    needsOnboarding?: boolean;
  }

  interface Props {
    data: PageData & DashboardPageData;
    form: ActionData;
  }

  let { data, form }: Props = $props();
</script>

<Dashboard
  {form}
  user={data.user}
  company={data.company ?? null}
  activeProduct={data.activeProduct ?? null}
  products={data.products ?? []}
  measurements={data.measurements ?? []}
  measurementHistories={data.measurementHistories ?? {}}
  runningAnalysis={data.runningAnalysis ?? null}
  llmProviders={data.llmProviders ?? []}
  needsOnboarding={data.needsOnboarding ?? false}
  error={null}
/>
