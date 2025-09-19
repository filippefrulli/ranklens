// Local cache for per-query analysis run data (ranking attempts + competitor rankings)
// Purpose: Avoid re-fetching the same analysis run data every time user navigates back
//          to a query details page or switches between runs.
// Design:
//  - Keyed by query id + run id: ranklens:queryRun:{queryId}:{runId}
//  - Versioned payload (v) for forward compatibility.
//  - Soft TTL via maxAgeMinutes param in loadRun (default 60 mins) – callers can lower/raise.
//  - Browser-only; no SSR usage (guarded by $app/environment browser flag).
//  - Keeps original shapes to minimize transformation overhead.
// Invalidation strategy:
//  - TTL expiry automatically yields null from loadRun.
//  - clearRun / clearAllForQuery allow manual targeted invalidation.
// Potential future enhancements:
//  - Add compression if payload size grows.
//  - Persist a checksum of underlying query/ run metadata to detect staleness.

import { browser } from '$app/environment';
import type { RankingAttempt } from '$lib/types';

export interface CachedRunData {
  v: 1; // version for future migrations
  rankingResults: RankingAttempt[];
  competitorRankings: any[]; // Keeping original shape; could add a type later
  savedAt: string; // ISO timestamp
}

const PREFIX = 'ranklens:queryRun:'; // Full key: PREFIX + queryId + ':' + runId

function key(queryId: string, runId: string) {
  return `${PREFIX}${queryId}:${runId}`;
}

// Load cached run data. Returns null if missing, expired, or version mismatch.
export function loadRun(queryId: string, runId: string, maxAgeMinutes = 60): CachedRunData | null {
  if (!browser) return null;
  try {
    const raw = localStorage.getItem(key(queryId, runId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedRunData;
    if (parsed.v !== 1) return null;
    const ageMs = Date.now() - new Date(parsed.savedAt).getTime();
    if (ageMs > maxAgeMinutes * 60 * 1000) return null; // expired
    return parsed;
  } catch {
    return null;
  }
}

// Save run data immediately after a successful fresh fetch.
export function saveRun(queryId: string, runId: string, rankingResults: RankingAttempt[], competitorRankings: any[]) {
  if (!browser) return;
  const payload: CachedRunData = {
    v: 1,
    rankingResults,
    competitorRankings,
    savedAt: new Date().toISOString()
  };
  try { localStorage.setItem(key(queryId, runId), JSON.stringify(payload)); } catch {}
}

// Remove a single run cache entry.
export function clearRun(queryId: string, runId: string) {
  if (!browser) return;
  try { localStorage.removeItem(key(queryId, runId)); } catch {}
}

// Bulk-remove all cached runs for a given query.
export function clearAllForQuery(queryId: string) {
  if (!browser) return;
  try {
    Object.keys(localStorage).forEach(k => { if (k.startsWith(`${PREFIX}${queryId}:`)) localStorage.removeItem(k); });
  } catch {}
}
