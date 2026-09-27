// Mock CRM purchase history for the demo. Customers are created from the
// opted-in survey contacts; some of them go on to buy. Replace the CRM store
// with a real CRM integration later.
import type { Order } from "@/lib/crm/types"
import type { SurveyResponse } from "@/lib/surveys/types"

// Chance that a survey contact becomes a paying customer, by how they heard about us.
const buyChance: Record<string, number> = {
  friend: 0.75, "walked-by": 0.6, facebook: 0.6, google: 0.55, instagram: 0.45, other: 0.4, youtube: 0.35,
}

// Deterministic per-contact randomness so the demo data is stable.
function random(key: string) {
  let h = 2166136261
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

export function mockOrdersFor(response: SurveyResponse, until: string): Order[] {
  const rand = random(response.id)
  if (rand() > (buyChance[response.source ?? "other"] ?? 0.4)) return []
  // First purchase within a few days of the survey, then repeat visits every 3–12 days.
  const end = Date.parse(`${until}T23:00:00Z`)
  const count = 1 + Math.floor(rand() * 4)
  const orders: Order[] = []
  const surveyed = Date.parse(response.createdAt)
  let at = surveyed + rand() * Math.min(3 * 86_400_000, Math.max(end - surveyed, 3_600_000))
  for (let i = 0; i < count && at <= end; i++) {
    orders.push({ id: `${response.id}-o${i + 1}`, date: new Date(at).toISOString(), amount: Math.round(12 + rand() * 78) })
    at += (3 + rand() * 9) * 86_400_000
  }
  return orders.sort((a, b) => a.date.localeCompare(b.date))
}

export const MOCK_ORDERS_UNTIL = "2026-09-26"

