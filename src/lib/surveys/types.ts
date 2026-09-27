import type { ChannelId } from "@/lib/dashboard-data"

export const QUESTIONS = [
  { id: "ageGroup", label: "Age group", hint: "Under 18 to 55+" },
  { id: "source", label: "How did you hear about us?", hint: "YouTube, Facebook, Instagram, Google, friends…" },
  { id: "location", label: "Location", hint: "City or ZIP code" },
  { id: "contact", label: "Contact details (optional)", hint: "Name, email or phone, with consent for follow-up" },
] as const

export type QuestionId = (typeof QUESTIONS)[number]["id"]
export const QUESTION_IDS = QUESTIONS.map((q) => q.id) as QuestionId[]

export const AGE_GROUPS = ["Under 18", "18–24", "25–34", "35–44", "45–54", "55+"] as const
export type AgeGroup = (typeof AGE_GROUPS)[number]

export const SOURCES: { id: string; label: string; channel?: ChannelId }[] = [
  { id: "youtube", label: "YouTube", channel: "youtube" },
  { id: "facebook", label: "Facebook", channel: "facebook" },
  { id: "instagram", label: "Instagram", channel: "instagram" },
  { id: "google", label: "Google" },
  { id: "friend", label: "Friend / word of mouth" },
  { id: "walked-by", label: "Walked by" },
  { id: "other", label: "Other" },
]
export type SourceId = (typeof SOURCES)[number]["id"]

export const DEFAULT_POSTER_MESSAGE = "Tell us about you, it takes 30 seconds!"

export type Survey = {
  id: string
  name: string
  posterMessage: string
  questions: QuestionId[]
  active: boolean
  createdAt: string // ISO datetime
}

export type Contact = { name?: string; email?: string; phone?: string }

export type SurveyResponse = {
  id: string
  surveyId: string
  createdAt: string // ISO datetime
  ageGroup?: AgeGroup
  source?: SourceId
  location?: string
  contact?: Contact
  consent: boolean
}
