"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { attribute, contactRandom } from "@/lib/conversions/match"
import { currentOrder, priceOrder } from "@/lib/conversions/menu"
import {
  addConversion,
  createQrCode,
  getQrCode,
  listConversions,
  updateQrCode,
} from "@/lib/conversions/store"
import { qrThemes, type OrderItem } from "@/lib/conversions/types"

export type FormState = { errors?: Record<string, string> } | undefined

const qrCodeSchema = z.object({
  businessName: z.string().trim().min(1, "Enter your business name.").max(80),
  placement: z.string().trim().min(1, "Say where this code goes, like “Front counter”.").max(60),
  headline: z.string().trim().min(1, "Write the offer customers see.").max(80),
  percentOff: z.coerce
    .number({ error: "Enter a discount." })
    .int("Use a whole number.")
    .min(5, "Offer at least 5% off.")
    .max(100, "The discount can't be more than 100%."),
  offerItem: z.string().trim().min(1, "Say what the discount is for.").max(40),
  message: z.string().trim().max(160),
  headerPhoto: z.string().trim().min(1),
  theme: z.enum(qrThemes.map((t) => t.id) as [string, ...string[]]),
})

function readQrCodeForm(formData: FormData) {
  return qrCodeSchema.safeParse(Object.fromEntries(formData))
}

function fieldErrors(error: z.ZodError) {
  const errors: Record<string, string> = {}
  for (const issue of error.issues) errors[String(issue.path[0])] ??= issue.message
  return { errors }
}

export async function createQrCodeAction(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = readQrCodeForm(formData)
  if (!parsed.success) return fieldErrors(parsed.error)
  const code = await createQrCode({ ...parsed.data, theme: parsed.data.theme as never })
  revalidatePath("/conversions")
  redirect(`/conversions/qr/${code.id}`)
}

export async function updateQrCodeAction(
  id: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = readQrCodeForm(formData)
  if (!parsed.success) return fieldErrors(parsed.error)
  await updateQrCode(id, { ...parsed.data, theme: parsed.data.theme as never })
  revalidatePath("/conversions")
  redirect(`/conversions/qr/${id}`)
}

export async function setQrCodeActiveAction(id: string, active: boolean) {
  await updateQrCode(id, { active })
  revalidatePath("/conversions")
  revalidatePath(`/conversions/qr/${id}`)
}

const claimSchema = z
  .object({
    email: z
      .union([z.literal(""), z.email("Check your email address.")])
      .transform((v) => v.trim().toLowerCase() || undefined),
    phone: z
      .string()
      .trim()
      .refine((v) => v === "" || v.replace(/\D/g, "").length >= 10, "Check your phone number.")
      .transform((v) => v || undefined),
    orderSeed: z.number().int(),
  })
  .refine((d) => d.email || d.phone, {
    path: ["email"],
    message: "Add your email or phone number to get the discount.",
  })

export type ClaimInput = z.input<typeof claimSchema>

export type ClaimResult =
  | {
      ok: true
      items: OrderItem[]
      subtotal: number
      discount: number
      total: number
      firstVisit: boolean
    }
  | { ok: false; errors: Record<string, string> }

const digits = (p?: string) => p?.replace(/\D/g, "") || undefined

// A customer claims the offer: record the conversion, match it to an ad, and send it back to the
// ad platforms (mocked).
export async function claimOfferAction(qrCodeId: string, input: ClaimInput): Promise<ClaimResult> {
  const code = await getQrCode(qrCodeId)
  if (!code || !code.active) return { ok: false, errors: { form: "This offer has ended." } }

  const parsed = claimSchema.safeParse(input)
  if (!parsed.success) return { ok: false, ...fieldErrors(parsed.error) }
  const { email, phone, orderSeed } = parsed.data

  // The same person, by email or phone, has converted before.
  const earlier = (await listConversions()).find(
    (c) => (email && c.email === email) || (phone && digits(c.phone) === digits(phone)),
  )
  const items = currentOrder(orderSeed)
  const price = priceOrder(items, earlier ? 0 : code.percentOff)

  await addConversion({
    qrCodeId,
    email,
    phone,
    items,
    ...price,
    firstVisit: !earlier,
    attribution: earlier
      ? earlier.attribution
      : attribute(contactRandom(email ?? digits(phone)!), { email, phone }),
    sentTo: ["meta", "google"],
  })
  revalidatePath("/conversions")
  revalidatePath("/dashboard")
  return { ok: true, items, ...price, firstVisit: !earlier }
}
