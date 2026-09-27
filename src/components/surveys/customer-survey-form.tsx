"use client"

import { useState, useTransition } from "react"
import { CircleCheck } from "lucide-react"

import { submitResponseAction } from "@/lib/surveys/actions"
import { AGE_GROUPS, SOURCES, type QuestionId } from "@/lib/surveys/types"
import { cn } from "@/lib/utils"

const inputClass =
  "h-14 w-full rounded-2xl border border-input bg-card px-4 text-lg outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

function Choices({
  name,
  options,
  value,
  onChange,
  columns,
}: {
  name: string
  options: { value: string; label: string }[]
  value?: string
  onChange: (v: string) => void
  columns: string
}) {
  return (
    <div className={cn("grid gap-2.5", columns)}>
      {options.map((o) => (
        <label
          key={o.value}
          className={cn(
            "flex min-h-14 cursor-pointer items-center justify-center rounded-2xl border-2 bg-card px-3 text-center text-lg font-medium transition-colors",
            "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
            value === o.value ? "border-primary bg-primary/10 text-foreground" : "border-border",
          )}
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="sr-only"
          />
          {o.label}
        </label>
      ))}
    </div>
  )
}

export default function CustomerSurveyForm({
  surveyId,
  storeName,
  questions,
}: {
  surveyId: string
  storeName: string
  questions: QuestionId[]
}) {
  const asks = (q: QuestionId) => questions.includes(q)
  const [ageGroup, setAgeGroup] = useState<string>()
  const [source, setSource] = useState<string>()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [done, setDone] = useState(false)
  const [pending, startTransition] = useTransition()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const text = (k: string) => (f.get(k) as string | null) ?? ""
    startTransition(async () => {
      const result = await submitResponseAction(surveyId, {
        ageGroup: ageGroup as never,
        source,
        location: text("location"),
        name: text("name"),
        email: text("email"),
        phone: text("phone"),
        consent: f.get("consent") === "on",
      })
      if (result.ok) {
        setDone(true)
        window.scrollTo({ top: 0 })
      } else {
        setErrors(result.errors)
      }
    })
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center" role="status">
        <CircleCheck className="size-16 text-emerald-600" />
        <h1 className="text-3xl font-bold tracking-tight">Thank you!</h1>
        <p className="max-w-xs text-lg text-muted-foreground">
          Your answers help {storeName} serve you better. Enjoy the rest of your visit.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-9" noValidate>
      <div className="-mt-7">
        <h1 className="text-3xl font-bold tracking-tight">Tell us about you</h1>
        <p className="mt-2 text-lg text-muted-foreground">A few taps, under a minute.</p>
      </div>
      {asks("ageGroup") && (
        <fieldset>
          <legend className="mb-3 text-xl font-semibold">Your age group</legend>
          <Choices
            name="ageGroup"
            options={AGE_GROUPS.map((a) => ({ value: a, label: a }))}
            value={ageGroup}
            onChange={setAgeGroup}
            columns="grid-cols-3"
          />
        </fieldset>
      )}

      {asks("source") && (
        <fieldset>
          <legend className="mb-3 text-xl font-semibold">How did you hear about us?</legend>
          <Choices
            name="source"
            options={SOURCES.map((s) => ({ value: s.id, label: s.label }))}
            value={source}
            onChange={setSource}
            columns="grid-cols-2"
          />
        </fieldset>
      )}

      {asks("location") && (
        <div className="flex flex-col gap-3">
          <label htmlFor="location" className="text-xl font-semibold">Where do you live?</label>
          <input id="location" name="location" placeholder="City or ZIP code" autoComplete="address-level2" maxLength={60} className={inputClass} />
        </div>
      )}

      {asks("contact") && (
        <fieldset className="flex flex-col gap-3 rounded-3xl bg-muted/60 p-4">
          <legend className="sr-only">Contact details</legend>
          <p className="text-xl font-semibold">Want offers from us? <span className="font-normal text-muted-foreground">(optional)</span></p>
          <input name="name" placeholder="Your name" autoComplete="name" maxLength={80} className={inputClass} aria-label="Name" />
          <input name="email" type="email" placeholder="Email" autoComplete="email" inputMode="email" className={inputClass} aria-label="Email" aria-invalid={Boolean(errors.email)} />
          {errors.email && <p className="text-destructive">{errors.email}</p>}
          <input name="phone" type="tel" placeholder="Phone" autoComplete="tel" inputMode="tel" maxLength={30} className={inputClass} aria-label="Phone" />
          <label className="flex items-start gap-3 pt-1 text-base">
            <input type="checkbox" name="consent" className="mt-1 size-6 shrink-0 accent-primary" aria-invalid={Boolean(errors.consent)} />
            <span>Yes, {storeName} may contact me about offers and updates. I can opt out anytime.</span>
          </label>
          {errors.consent && <p className="text-destructive">{errors.consent}</p>}
        </fieldset>
      )}

      {errors.form && <p className="text-lg text-destructive" role="alert">{errors.form}</p>}

      <button
        type="submit"
        disabled={pending}
        className="h-16 rounded-2xl bg-primary text-xl font-semibold text-primary-foreground shadow-md disabled:opacity-60"
      >
        {pending ? "Sending…" : "Submit"}
      </button>
    </form>
  )
}
