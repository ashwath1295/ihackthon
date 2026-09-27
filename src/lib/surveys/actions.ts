"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { linkSurveyResponse } from "@/lib/crm/store"
import { addResponse, createSurvey, getSurvey, updateSurvey } from "@/lib/surveys/store"
import {
  AGE_GROUPS,
  DEFAULT_POSTER_MESSAGE,
  QUESTION_IDS,
  SOURCES,
  type QuestionId,
} from "@/lib/surveys/types"

export type FormState = { errors?: Record<string, string> } | undefined

const surveySchema = z.object({
  name: z.string().trim().min(1, "Give the survey a name, like your store's name").max(80),
  posterMessage: z.string().trim().max(120).optional(),
  questions: z.array(z.enum(QUESTION_IDS as [QuestionId, ...QuestionId[]])).min(1, "Pick at least one question"),
})

function readSurveyForm(formData: FormData) {
  return surveySchema.safeParse({
    name: formData.get("name"),
    posterMessage: formData.get("posterMessage") || undefined,
    questions: formData.getAll("questions"),
  })
}

function fieldErrors(error: z.ZodError) {
  const errors: Record<string, string> = {}
  for (const issue of error.issues) errors[String(issue.path[0])] ??= issue.message
  return { errors }
}

export async function createSurveyAction(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = readSurveyForm(formData)
  if (!parsed.success) return fieldErrors(parsed.error)
  const survey = await createSurvey({
    ...parsed.data,
    posterMessage: parsed.data.posterMessage || DEFAULT_POSTER_MESSAGE,
    // Keep questions in the standard order.
    questions: QUESTION_IDS.filter((q) => parsed.data.questions.includes(q)),
  })
  revalidatePath("/surveys")
  redirect(`/surveys/${survey.id}`)
}

export async function updateSurveyAction(id: string, _: FormState, formData: FormData): Promise<FormState> {
  const parsed = readSurveyForm(formData)
  if (!parsed.success) return fieldErrors(parsed.error)
  await updateSurvey(id, {
    ...parsed.data,
    posterMessage: parsed.data.posterMessage || DEFAULT_POSTER_MESSAGE,
    questions: QUESTION_IDS.filter((q) => parsed.data.questions.includes(q)),
  })
  revalidatePath("/surveys")
  redirect(`/surveys/${id}`)
}

export async function setSurveyActiveAction(id: string, active: boolean) {
  await updateSurvey(id, { active })
  revalidatePath("/surveys")
  revalidatePath(`/surveys/${id}`)
}

const optional = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => v || undefined)

const responseSchema = z.object({
  ageGroup: z.enum(AGE_GROUPS).optional(),
  source: z.enum(SOURCES.map((s) => s.id) as [string, ...string[]]).optional(),
  location: optional(60),
  name: optional(80),
  email: z.union([z.literal(""), z.email("Check the email address")]).optional().transform((v) => v || undefined),
  phone: optional(30),
  consent: z.boolean(),
})

export type ResponseInput = z.input<typeof responseSchema>

export async function submitResponseAction(
  surveyId: string,
  input: ResponseInput,
): Promise<{ ok: true } | { ok: false; errors: Record<string, string> }> {
  const survey = await getSurvey(surveyId)
  if (!survey || !survey.active) return { ok: false, errors: { form: "This survey is closed." } }

  const parsed = responseSchema.safeParse(input)
  if (!parsed.success) return { ok: false, ...fieldErrors(parsed.error) }
  const d = parsed.data
  const asks = (q: QuestionId) => survey.questions.includes(q)

  const contact = asks("contact") && (d.name || d.email || d.phone) ? { name: d.name, email: d.email, phone: d.phone } : undefined
  if (contact && !d.consent) {
    return { ok: false, errors: { consent: "Tick the box so we're allowed to contact you, or clear your details." } }
  }

  const answers = {
    ageGroup: asks("ageGroup") ? d.ageGroup : undefined,
    source: asks("source") ? d.source : undefined,
    location: asks("location") ? d.location : undefined,
  }
  if (!answers.ageGroup && !answers.source && !answers.location && !contact) {
    return { ok: false, errors: { form: "Answer at least one question." } }
  }

  const response = await addResponse({ surveyId, ...answers, contact, consent: Boolean(contact && d.consent) })
  // Opted-in contacts go straight into the CRM (matched by email or phone).
  await linkSurveyResponse(response)
  revalidatePath("/surveys")
  revalidatePath("/dashboard")
  return { ok: true }
}
