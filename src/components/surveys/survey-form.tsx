"use client"

import { useActionState } from "react"

import type { FormState } from "@/lib/surveys/actions"
import { DEFAULT_POSTER_MESSAGE, QUESTIONS, type Survey } from "@/lib/surveys/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>
  survey?: Pick<Survey, "name" | "posterMessage" | "questions">
  submitLabel: string
}

export default function SurveyForm({ action, survey, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined)
  const errors = state?.errors ?? {}
  const selected = survey?.questions ?? QUESTIONS.map((q) => q.id)

  return (
    <form action={formAction} className="flex flex-col gap-7" noValidate>
      <div className="flex flex-col gap-2">
        <label htmlFor="name" className="font-medium">Survey name</label>
        <Input
          id="name"
          name="name"
          defaultValue={survey?.name}
          placeholder="Main Street Store"
          aria-invalid={Boolean(errors.name)}
          aria-describedby="name-help"
          className="h-12 rounded-xl bg-card px-4 text-base md:text-base"
        />
        <p id="name-help" className={errors.name ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
          {errors.name ?? "Usually the store or location where the poster goes. Responses are tagged with it."}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="posterMessage" className="font-medium">Poster message</label>
        <Input
          id="posterMessage"
          name="posterMessage"
          defaultValue={survey?.posterMessage ?? DEFAULT_POSTER_MESSAGE}
          maxLength={120}
          className="h-12 rounded-xl bg-card px-4 text-base md:text-base"
        />
        <p className="text-sm text-muted-foreground">Printed in big letters above the QR code.</p>
      </div>

      <fieldset className="flex flex-col gap-3" aria-invalid={Boolean(errors.questions)}>
        <legend className="mb-3 font-medium">Questions to ask</legend>
        {QUESTIONS.map((q) => (
          <label
            key={q.id}
            className="flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-4 has-checked:border-primary has-checked:ring-2 has-checked:ring-primary/20"
          >
            <input
              type="checkbox"
              name="questions"
              value={q.id}
              defaultChecked={selected.includes(q.id)}
              className="mt-1 size-4 accent-primary"
            />
            <span>
              <span className="block font-medium">{q.label}</span>
              <span className="block text-sm text-muted-foreground">{q.hint}</span>
            </span>
          </label>
        ))}
        {errors.questions && <p className="text-sm text-destructive">{errors.questions}</p>}
      </fieldset>

      <div>
        <Button type="submit" size="lg" disabled={pending} className="h-12 rounded-xl px-6 text-base">
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  )
}
