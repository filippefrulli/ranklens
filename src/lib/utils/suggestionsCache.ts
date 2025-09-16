// Lightweight localStorage cache for AI query suggestions
// - Keyed by business id
// - Browser-only; safe to import in Svelte components (guards on window)

import { browser } from "$app/environment";
import type { QuerySuggestion } from "$lib/types";

const prefix = "ranklens:dashboard:suggestions:";

export function getKey(businessId: string) {
  return `${prefix}${businessId}`;
}

type CachePayload = {
  v: 1;
  items: QuerySuggestion[];
  savedAt: string; // ISO string
};

export function loadSuggestions(businessId: string): QuerySuggestion[] | null {
  if (!browser || !businessId) return null;
  try {
    const raw = localStorage.getItem(getKey(businessId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachePayload;
    if (parsed && parsed.v === 1 && Array.isArray(parsed.items)) {
      return parsed.items.map((s) => ({ text: s.text, reasoning: s.reasoning || "" }));
    }
  } catch {
    // ignore
  }
  return null;
}

export function saveSuggestions(businessId: string, items: QuerySuggestion[]): void {
  if (!browser || !businessId) return;
  const payload: CachePayload = {
    v: 1,
    items: items.map((s) => ({ text: s.text, reasoning: s.reasoning || "" })),
    savedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(getKey(businessId), JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export function clearSuggestions(businessId: string): void {
  if (!browser || !businessId) return;
  try {
    localStorage.removeItem(getKey(businessId));
  } catch {
    // ignore
  }
}
