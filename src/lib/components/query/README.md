# Query Detail Components

This folder contains reusable components for the query detail page (`/query/[id]`).

## Components

### QueryHeader.svelte
Header section with back button, query title, and LLM provider filter pills.

**Props:**
- `queryText` - The query text to display
- `llmProviders` - Array of available LLM providers
- `selectedProvider` - Currently selected provider (or null for "All")
- `onBack` - Callback function for back button
- `onProviderChange` - Callback function when provider selection changes

**Features:**
- Responsive layout (stacks on mobile, horizontal on desktop)
- "All" provider option plus individual provider pills
- Active state styling for selected provider

### AnalysisRunsList.svelte
Sidebar list of all analysis runs for the query.

**Props:**
- `analysisRuns` - Array of analysis run objects with `id` and `created_at`
- `selectedRunId` - Currently selected run ID (or null)
- `onSelectRun` - Callback function when a run is selected

**Features:**
- Displays run count
- Formatted dates (Month Day, Year, Time)
- Active badge for selected run
- Empty state message

### LLMResultsSection.svelte
Section displaying LLM ranking attempts for the selected run.

**Props:**
- `selectedRunId` - Currently selected run ID
- `filteredRankingResults` - Array of ranking attempts (filtered by provider if applicable)
- `selectedProvider` - Currently selected provider (for empty state messaging)

**Features:**
- Shows `RankingResultsByLLMTable` component with data
- Empty states:
  - No run selected
  - Run selected but no results
  - Provider filtered but no results
- Uses existing `RankingResultsByLLMTable` component

### CompetitorRankingsSection.svelte
Section displaying aggregated competitor rankings.

**Props:**
- `loadingData` - Boolean indicating if data is loading
- `selectedRunId` - Currently selected run ID
- `competitorRankings` - Array of competitor ranking data
- `selectedProvider` - Currently selected provider (for empty state messaging)
- `analysisRunsCount` - Total number of analysis runs (for empty state logic)

**Features:**
- Loading spinner when fetching data
- Business count display
- Empty states:
  - Loading data
  - No runs for query
  - Run selected but no competitor data
  - Provider filtered but no competitor data
- Uses existing `CompetitorRankingsTable` component

## Usage

Import components in the query detail page:

```svelte
import QueryHeader from "$lib/components/query/QueryHeader.svelte";
import AnalysisRunsList from "$lib/components/query/AnalysisRunsList.svelte";
import LLMResultsSection from "$lib/components/query/LLMResultsSection.svelte";
import CompetitorRankingsSection from "$lib/components/query/CompetitorRankingsSection.svelte";

<QueryHeader 
  queryText={query.text}
  {llmProviders}
  {selectedProvider}
  onBack={goBack}
  {onProviderChange}
/>

<div class="grid gap-6 lg:grid-cols-12">
  <AnalysisRunsList 
    {analysisRuns}
    {selectedRunId}
    onSelectRun={selectRun}
  />

  <LLMResultsSection 
    {selectedRunId}
    {filteredRankingResults}
    {selectedProvider}
  />
</div>

<CompetitorRankingsSection 
  {loadingData}
  {selectedRunId}
  {competitorRankings}
  {selectedProvider}
  analysisRunsCount={analysisRuns.length}
/>
```

## Benefits

- **Reduced file size**: Main page reduced from ~337 lines to ~223 lines (34% reduction)
- **Single responsibility**: Each component handles one UI section
- **Reusability**: Components can be tested and modified independently
- **Type safety**: All props are typed with TypeScript interfaces
- **Maintainability**: Easier to locate and update specific functionality

## Existing Components (Not Modified)

- `RankingResultsByLLMTable.svelte` - Table showing individual LLM ranking attempts
- `CompetitorRankingsTable.svelte` - Table showing aggregated competitor rankings
- `QueryResultHeader.svelte` - (May be deprecated or used elsewhere)
- `QueryResultTable.svelte` - (May be deprecated or used elsewhere)
