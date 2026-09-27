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

// Accepts "joesbakery.com" as well as full URLs, since most owners type the bare domain.
function isWebsite(value: string) {
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
    return url.hostname.includes(".")
  } catch {
    return false
  }
}

export const setupSteps = ["Your business", "Customers", "Goals and budget", "Launch"] as const

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

// Setup answers are kept in the browser until there's a backend to save them to.
const DRAFT_KEY = "adpilot:setup-draft"

export type SetupDraft = {
  business?: BusinessDetails
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
