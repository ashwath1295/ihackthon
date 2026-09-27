// Pure helpers that turn survey responses into stats. No storage access here.
import { AGE_GROUPS, SOURCES, type Survey, type SurveyResponse } from "@/lib/surveys/types"

export type InsightFilter = { surveyId?: string; from?: string; to?: string } // dates as YYYY-MM-DD

const day = (iso: string) => iso.slice(0, 10)

export function filterResponses(responses: SurveyResponse[], f: InsightFilter) {
  return responses.filter(
    (r) =>
      (!f.surveyId || r.surveyId === f.surveyId) &&
      (!f.from || day(r.createdAt) >= f.from) &&
      (!f.to || day(r.createdAt) <= f.to),
  )
}

export function responsesPerDay(responses: SurveyResponse[], from: string, to: string) {
  const counts = new Map<string, number>()
  for (const r of responses) counts.set(day(r.createdAt), (counts.get(day(r.createdAt)) ?? 0) + 1)
  const out: { date: string; value: number }[] = []
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86_400_000) {
    const d = new Date(t).toISOString().slice(0, 10)
    out.push({ date: d, value: counts.get(d) ?? 0 })
  }
  return out
}

export function ageBreakdown(responses: SurveyResponse[]) {
  return AGE_GROUPS.map((group) => ({ group, count: responses.filter((r) => r.ageGroup === group).length }))
}

export function sourceBreakdown(responses: SurveyResponse[]) {
  return SOURCES.map((s) => ({ ...s, count: responses.filter((r) => r.source === s.id).length }))
}

// Group "oakland", "Oakland " and "OAKLAND" together; show the most common spelling.
export function topLocations(responses: SurveyResponse[], limit = 8) {
  const groups = new Map<string, { count: number; spellings: Map<string, number> }>()
  for (const r of responses) {
    const raw = r.location?.trim()
    if (!raw) continue
    const key = raw.toLowerCase().replace(/\s+/g, " ")
    const g = groups.get(key) ?? { count: 0, spellings: new Map() }
    g.count++
    g.spellings.set(raw, (g.spellings.get(raw) ?? 0) + 1)
    groups.set(key, g)
  }
  return [...groups.values()]
    .map((g) => ({
      label: [...g.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0],
      count: g.count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export type SurveyContact = {
  id: string
  name?: string
  email?: string
  phone?: string
  source?: string
  store: string
  date: string
}

// Opted-in contacts, newest first, ready for the CRM.
export function optedInContacts(responses: SurveyResponse[], surveys: Survey[]): SurveyContact[] {
  const names = new Map(surveys.map((s) => [s.id, s.name]))
  const sourceLabels = new Map(SOURCES.map((s) => [s.id, s.label]))
  return responses
    .filter((r) => r.consent && r.contact && (r.contact.name || r.contact.email || r.contact.phone))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => ({
      id: r.id,
      ...r.contact,
      source: r.source ? sourceLabels.get(r.source) : undefined,
      store: names.get(r.surveyId) ?? "Unknown survey",
      date: day(r.createdAt),
    }))
}
