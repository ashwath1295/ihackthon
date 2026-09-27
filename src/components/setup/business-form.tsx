"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowRight, CircleCheck, Globe } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import AdPreview from "@/components/setup/ad-preview"
import { categoryVisuals } from "@/components/setup/category-visuals"
import {
  businessCategories,
  businessSchema,
  loadDraft,
  saveDraft,
  type BusinessDetails,
} from "@/lib/setup"

const DESCRIPTION_MAX = 500

const inputClass = "h-12 rounded-xl bg-card px-4 text-base shadow-xs md:text-base"

export default function BusinessForm({ intro }: { intro: ReactNode }) {
  const [saved, setSaved] = useState(false)

  const form = useForm<BusinessDetails>({
    resolver: zodResolver(businessSchema),
    defaultValues: {
      businessName: "",
      category: undefined,
      website: "",
      description: "",
    },
  })
  const values = useWatch({ control: form.control })

  // Restore earlier answers so owners can come back to the form.
  useEffect(() => {
    const { business } = loadDraft()
    if (business) form.reset(business)
  }, [form])

  function onSubmit(values: BusinessDetails) {
    saveDraft({ business: values })
    setSaved(true)
  }

  return (
    <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:gap-14">
      <div className="flex flex-col gap-10">
        {intro}
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          onChange={() => setSaved(false)}
          className="flex flex-col gap-8"
          noValidate
        >
          <FieldGroup className="gap-7">
            <Controller
              name="businessName"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="businessName" className="text-base">
                    Business name
                  </FieldLabel>
                  <Input
                    {...field}
                    id="businessName"
                    placeholder="Joe's Bakery"
                    autoComplete="organization"
                    aria-invalid={fieldState.invalid}
                    className={inputClass}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Controller
              name="category"
              control={form.control}
              render={({ field, fieldState }) => (
                <FieldSet data-invalid={fieldState.invalid} className="gap-3">
                  <FieldLegend>What kind of business is it?</FieldLegend>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {businessCategories.map((category) => {
                      const visual = categoryVisuals[category.value]
                      const Icon = visual.icon
                      return (
                        <label
                          key={category.value}
                          className={cn(
                            "group flex cursor-pointer flex-col gap-3 rounded-2xl border-2 border-transparent bg-card p-4 shadow-xs ring-1 ring-border transition-all",
                            "hover:-translate-y-0.5 hover:shadow-md",
                            "has-checked:shadow-md has-checked:ring-0",
                            "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                            visual.selected,
                          )}
                        >
                          <input
                            type="radio"
                            name={field.name}
                            value={category.value}
                            checked={field.value === category.value}
                            onChange={() => field.onChange(category.value)}
                            onBlur={field.onBlur}
                            className="sr-only"
                          />
                          <span
                            className={cn(
                              "flex size-10 items-center justify-center rounded-xl transition-transform group-has-checked:scale-110",
                              visual.chip,
                            )}
                          >
                            <Icon className="size-5" />
                          </span>
                          <span className="text-sm leading-snug font-medium">{category.label}</span>
                        </label>
                      )
                    })}
                  </div>
                  <FieldError errors={[fieldState.error]} />
                </FieldSet>
              )}
            />

            <Controller
              name="website"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="website" className="text-base">
                    Website <span className="font-normal text-muted-foreground">(optional)</span>
                  </FieldLabel>
                  <div className="relative">
                    <Globe className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      {...field}
                      id="website"
                      type="url"
                      inputMode="url"
                      placeholder="joesbakery.com"
                      autoComplete="url"
                      aria-invalid={fieldState.invalid}
                      className={cn(inputClass, "pl-10")}
                    />
                  </div>
                  <FieldDescription>
                    Where people go when they click your ad. No website? Leave this blank.
                  </FieldDescription>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Controller
              name="description"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="description" className="text-base">
                    Describe your business
                  </FieldLabel>
                  <Textarea
                    {...field}
                    id="description"
                    rows={5}
                    maxLength={DESCRIPTION_MAX}
                    placeholder="A family-run bakery in Austin. We bake sourdough and pastries fresh every morning and take custom cake orders for birthdays and weddings."
                    aria-invalid={fieldState.invalid}
                    className="min-h-36 rounded-xl bg-card px-4 py-3 text-base leading-relaxed shadow-xs md:text-base"
                  />
                  <FieldDescription className="flex justify-between gap-4">
                    <span>What you sell, who it&apos;s for, and what makes you different.</span>
                    <span className="shrink-0 tabular-nums">
                      {field.value.length}/{DESCRIPTION_MAX}
                    </span>
                  </FieldDescription>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          </FieldGroup>

          <div className="flex flex-wrap items-center justify-end gap-4 border-t pt-8">
            {saved && (
              <p role="status" className="flex items-center gap-2 text-sm text-emerald-700">
                <CircleCheck className="size-4" />
                Saved. Next up: your customers and goals.
              </p>
            )}
            <Button
              type="submit"
              size="lg"
              className="h-12 rounded-xl bg-gradient-to-r from-primary to-fuchsia-500 px-7 text-base shadow-lg shadow-primary/30 transition-all hover:shadow-xl hover:shadow-primary/40 hover:brightness-110"
            >
              Continue
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </form>
      </div>

      <aside className="lg:sticky lg:top-24">
        <AdPreview values={values} />
      </aside>
    </div>
  )
}
