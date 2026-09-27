import { z } from "zod"

export const businessCategories = [
  { value: "restaurant", label: "Restaurant or café", cta: "Order now" },
  { value: "retail", label: "Retail shop", cta: "Shop now" },
  { value: "online-store", label: "Online store", cta: "Shop now" },
  { value: "home-services", label: "Home services", cta: "Get a quote" },
  { value: "health", label: "Health and wellness", cta: "Book now" },
  { value: "beauty", label: "Beauty and personal care", cta: "Book now" },
  { value: "professional", label: "Professional services", cta: "Learn more" },
  { value: "other", label: "Other", cta: "Learn more" },
] as const

export type CategoryValue = (typeof businessCategories)[number]["value"]

const categoryValues = businessCategories.map((c) => c.value) as [CategoryValue, ...CategoryValue[]]

// "https://www.joesbakery.com/menu" → "joesbakery.com". Accepts bare domains, since most owners
// type those. Returns "" if the value isn't a URL.
export function websiteHost(value: string) {
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
    return url.hostname.replace(/^www\./i, "").toLowerCase()
  } catch {
    return ""
  }
}

function isWebsite(value: string) {
  return websiteHost(value).includes(".")
}

export const setupSteps = ["Your business", "Business profile", "Launch"] as const

export const businessSchema = z.object({
  businessName: z
    .string()
    .trim()
    .min(1, "Enter your business name.")
    .max(80, "Keep the name under 80 characters."),
  category: z.enum(categoryValues, { error: "Choose the option closest to your business." }),
  website: z
    .string()
    .trim()
    .refine((v) => v === "" || isWebsite(v), "Enter a website like joesbakery.com."),
  description: z
    .string()
    .trim()
    .min(20, "Tell us a bit more — at least 20 characters.")
    .max(500, "Keep it under 500 characters."),
})

export type BusinessDetails = z.infer<typeof businessSchema>

const zipCode = z
  .string()
  .trim()
  .regex(/^\d{5}$/, "Use a 5-digit ZIP code.")
const keywords = (message: string) => z.array(z.string().trim().min(1)).min(1, message)

export const radiusOptions = [0.5, 1, 3, 5, 10] as const

export const genderOptions = [
  { value: "all", label: "Everyone" },
  { value: "women", label: "Women" },
  { value: "men", label: "Men" },
] as const

// Age targeting uses 18–65, where 65 means "65 and over".
export const AGE_MIN = 18
export const AGE_MAX = 65

// What AdPilot derives from the business in step 2. Kept to keywords so it's quick to review.
export const profileSchema = z.object({
  location: z.object({
    address: z.string().trim().min(1, "Enter your street address."),
    zip: zipCode,
    targetZips: z.array(zipCode).min(1, "Add at least one ZIP code to target."),
    radiusMiles: z.number(),
  }),
  brand: keywords("Add at least one keyword."),
  products: keywords("Add at least one product or service."),
  audience: z
    .object({
      keywords: keywords("Add at least one audience keyword."),
      ageMin: z.number().int().min(AGE_MIN).max(AGE_MAX),
      ageMax: z.number().int().min(AGE_MIN).max(AGE_MAX),
      gender: z.enum(["all", "women", "men"]),
    })
    .refine((a) => a.ageMax >= a.ageMin, {
      path: ["ageMax"],
      message: "The oldest age must be at least the youngest.",
    }),
  budget: z.object({
    monthly: z
      .number({ error: "Enter a monthly budget." })
      .int("Use whole dollars.")
      .min(100, "Set at least $100 a month.")
      .max(100_000, "Keep it under $100,000 a month."),
    metaShare: z.number().int().min(0).max(100),
  }),
})

export type BusinessProfile = z.infer<typeof profileSchema>

export function emptyProfile(): BusinessProfile {
  return {
    location: { address: "", zip: "", targetZips: [], radiusMiles: 5 },
    brand: [],
    products: [],
    audience: { keywords: [], ageMin: 25, ageMax: 54, gender: "all" },
    budget: { monthly: 500, metaShare: 50 },
  }
}

export type ProfileSuggestion = {
  profile: BusinessProfile
  // Where the suggestion came from, in sentence case, e.g. "joesbakery.com", "online reviews".
  // Empty if nothing was found.
  sources: string[]
}

// Setup answers are kept in the browser until there's a backend to save them to.
const DRAFT_KEY = "adpilot:setup-draft"

export type SetupDraft = {
  business?: BusinessDetails
  profile?: BusinessProfile
  // The suggestion AdPilot made, kept so the owner can reset their edits.
  suggestion?: ProfileSuggestion
  // The business the suggestion was made for, so it's redone if step 1 changes.
  suggestionFor?: string
}

export function businessKey(business: BusinessDetails) {
  return JSON.stringify(business)
}

export function loadDraft(): SetupDraft {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}")
  } catch {
    return {}
  }
}

export function saveDraft(update: Partial<SetupDraft>) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...loadDraft(), ...update }))
  } catch {
    // Storage can be unavailable (private mode); the form still works for this visit.
  }
}
