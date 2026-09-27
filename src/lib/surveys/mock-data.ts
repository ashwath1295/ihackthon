// Mock QR surveys and responses for the demo. The store seeds itself from
// these the first time it runs; replace the store with a database later.
import {
  AGE_GROUPS,
  DEFAULT_POSTER_MESSAGE,
  QUESTION_IDS,
  type AgeGroup,
  type SourceId,
  type Survey,
  type SurveyResponse,
} from "@/lib/surveys/types"

export const mockSurveys: Survey[] = [
  { id: "k7m2q9xa", name: "Main Street Store", posterMessage: DEFAULT_POSTER_MESSAGE, questions: QUESTION_IDS, active: true, createdAt: "2026-08-28T17:00:00Z" },
  { id: "p3v8d1rt", name: "Farmers Market Stand", posterMessage: "Quick question while you shop? 30 seconds!", questions: ["ageGroup", "source", "location"], active: true, createdAt: "2026-09-04T16:00:00Z" },
  { id: "w5c4n6ze", name: "Mission St Pop-up", posterMessage: DEFAULT_POSTER_MESSAGE, questions: QUESTION_IDS, active: false, createdAt: "2026-08-31T18:00:00Z" },
]

// Small seeded random generator so the mock data is the same on every run.
function random(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(rand: () => number, weighted: [T, number][]): T {
  const total = weighted.reduce((a, [, w]) => a + w, 0)
  let r = rand() * total
  for (const [value, w] of weighted) {
    r -= w
    if (r <= 0) return value
  }
  return weighted[weighted.length - 1][0]
}

const ageWeights: [AgeGroup, number][] = AGE_GROUPS.map((a, i) => [a, [3, 17, 33, 24, 14, 9][i]])
const sourceWeights: [SourceId, number][] = [
  ["instagram", 24], ["facebook", 21], ["youtube", 10], ["google", 14], ["friend", 17], ["walked-by", 10], ["other", 4],
]
const locationWeights: [string, number][] = [
  ["San Francisco", 36], ["Oakland", 13], ["94110", 10], ["Berkeley", 8], ["Daly City", 7],
  ["94103", 6], ["San Mateo", 5], ["Alameda", 4], ["South San Francisco", 4], ["San Jose", 3],
]
const firstNames = ["Maya", "Jordan", "Sam", "Leila", "Chris", "Nina", "Omar", "Grace", "Diego", "Hannah", "Kenji", "Rosa", "Ben", "Ava", "Luis", "Zoe"]
const lastNames = ["Patel", "Nguyen", "Garcia", "Kim", "Johnson", "Silva", "Chen", "Okafor", "Martin", "Rossi", "Brown", "Cohen"]

function generate(survey: Survey, opts: { seed: number; from: string; to: string; perDay: number; days?: number[] }) {
  const rand = random(opts.seed)
  const out: SurveyResponse[] = []
  const start = Date.parse(`${opts.from}T00:00:00Z`)
  const end = Date.parse(`${opts.to}T00:00:00Z`)
  for (let day = start, d = 0; day <= end; day += 86_400_000, d++) {
    const weekday = new Date(day).getUTCDay()
    if (opts.days && !opts.days.includes(weekday)) continue
    const weekend = weekday === 0 || weekday === 6 ? 1.5 : 1
    const count = Math.round(opts.perDay * weekend * (0.5 + rand()))
    for (let i = 0; i < count; i++) {
      const at = new Date(day + (15 + Math.floor(rand() * 8)) * 3_600_000 + Math.floor(rand() * 3_600_000))
      const has = (q: string) => survey.questions.includes(q as never)
      const optIn = has("contact") && rand() < 0.22
      const first = firstNames[Math.floor(rand() * firstNames.length)]
      const last = lastNames[Math.floor(rand() * lastNames.length)]
      out.push({
        id: `${survey.id}-${out.length + 1}`,
        surveyId: survey.id,
        createdAt: at.toISOString(),
        ageGroup: has("ageGroup") && rand() > 0.03 ? pick(rand, ageWeights) : undefined,
        source: has("source") && rand() > 0.02 ? pick(rand, sourceWeights) : undefined,
        location: has("location") && rand() > 0.1 ? pick(rand, locationWeights) : undefined,
        contact: optIn
          ? rand() < 0.7
            ? { name: `${first} ${last}`, email: `${first}.${last}@example.com`.toLowerCase() }
            : { name: first, phone: `(415) 555-${String(1000 + Math.floor(rand() * 9000))}` }
          : undefined,
        consent: optIn,
      })
    }
  }
  return out
}

export const mockResponses: SurveyResponse[] = [
  ...generate(mockSurveys[0], { seed: 11, from: "2026-08-29", to: "2026-09-26", perDay: 5 }),
  ...generate(mockSurveys[1], { seed: 22, from: "2026-09-05", to: "2026-09-26", perDay: 14, days: [6] }),
  ...generate(mockSurveys[2], { seed: 33, from: "2026-09-01", to: "2026-09-14", perDay: 3 }),
].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
