"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  ArrowLeft,
  ArrowRight,
  Coffee,
  MapPin,
  Pencil,
  RotateCcw,
  Sparkles,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import ChoiceGroup from "@/components/setup/choice-group"
import KeywordInput from "@/components/setup/keyword-input"
import { inputClass, primaryButtonClass } from "@/components/setup/styles"
import {
  AGE_MAX,
  AGE_MIN,
  genderOptions,
  profileSchema,
  radiusOptions,
  saveDraft,
  type BusinessProfile,
  type ProfileSuggestion,
} from "@/lib/setup"

const radiusChoices = radiusOptions.map((miles) => ({ value: miles, label: `${miles} mi` }))

const parseZip = (text: string) => (/^\d{5}$/.test(text) ? text : null)

// Number inputs hold NaN while empty so zod reports "enter a number" instead of treating it as 0.
function numberFieldProps(field: { value: number; onChange: (value: number) => void }) {
  return {
    value: Number.isNaN(field.value) ? "" : field.value,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      field.onChange(e.target.value === "" ? NaN : Number(e.target.value)),
  }
}

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

type SectionStatus = "suggested" | "edited" | null

function Section({
  icon: Icon,
  iconClassName,
  title,
  description,
  status,
  children,
}: {
  icon: LucideIcon
  iconClassName: string
  title: string
  description: string
  status: SectionStatus
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-6 rounded-3xl bg-card p-6 shadow-xs ring-1 ring-border sm:p-7">
      <div className="flex items-start gap-4">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-2xl",
            iconClassName,
          )}
        >
          <Icon className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {status === "suggested" && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-primary/10 to-fuchsia-500/10 px-2.5 py-1 text-xs font-medium text-primary">
            <Sparkles className="size-3" />
            Suggested
          </span>
        )}
        {status === "edited" && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <Pencil className="size-3" />
            Edited
          </span>
        )}
      </div>
      <div className="flex flex-col gap-6">{children}</div>
    </section>
  )
}

type ProfileFormProps = {
  suggestion: ProfileSuggestion
  // Saved edits to start from, if the owner has been here before.
  initial?: BusinessProfile
}

export default function ProfileForm({ suggestion, initial }: ProfileFormProps) {
  const router = useRouter()
  const suggested = suggestion.sources.length > 0

  // Defaults are the suggestion, so "dirty" means "changed from what AdPilot suggested".
  const form = useForm<BusinessProfile>({
    resolver: zodResolver(profileSchema),
    defaultValues: suggestion.profile,
  })
  const { dirtyFields } = form.formState

  useEffect(() => {
    if (initial) form.reset(initial, { keepDefaultValues: true })
  }, [form, initial])

  const budget = useWatch({ control: form.control, name: "budget" })
  const monthly = Number.isNaN(budget.monthly) ? 0 : budget.monthly
  const metaAmount = Math.round((monthly * budget.metaShare) / 100)

  function status(section: keyof BusinessProfile): SectionStatus {
    if (dirtyFields[section]) return "edited"
    return suggested ? "suggested" : null
  }

  function onSubmit(profile: BusinessProfile) {
    saveDraft({ profile })
    router.push("/setup/creatives")
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6" noValidate>
      <Section
        icon={MapPin}
        iconClassName="bg-sky-100 text-sky-600"
        title="Location"
        description="Where your ads will show."
        status={status("location")}
      >
        <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_9rem]">
          <Controller
            name="location.address"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="address">Address</FieldLabel>
                <Input
                  {...field}
                  id="address"
                  placeholder="599 3rd St, San Francisco, CA"
                  autoComplete="street-address"
                  aria-invalid={fieldState.invalid}
                  className={inputClass}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            name="location.zip"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="zip">ZIP code</FieldLabel>
                <Input
                  {...field}
                  id="zip"
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="94107"
                  autoComplete="postal-code"
                  aria-invalid={fieldState.invalid}
                  className={inputClass}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        </div>

        <Controller
          name="location.targetZips"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="targetZips">Target these ZIP codes</FieldLabel>
              <KeywordInput
                id="targetZips"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder="Type a ZIP code and press Enter"
                inputMode="numeric"
                parse={parseZip}
                rejectMessage="Use a 5-digit ZIP code."
                invalid={fieldState.invalid}
                chipClassName="bg-sky-100 text-sky-800 tabular-nums"
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <Controller
          name="location.radiusMiles"
          control={form.control}
          render={({ field }) => (
            <FieldSet className="gap-2">
              <FieldLegend variant="label">Radius around your address</FieldLegend>
              <ChoiceGroup
                name={field.name}
                options={radiusChoices}
                value={field.value}
                onChange={field.onChange}
                className="self-start"
              />
            </FieldSet>
          )}
        />
      </Section>

      <Section
        icon={Sparkles}
        iconClassName="bg-fuchsia-100 text-fuchsia-600"
        title="Brand"
        description="How your ads should sound and feel."
        status={status("brand")}
      >
        <Controller
          name="brand"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="brand" className="sr-only">
                Brand keywords
              </FieldLabel>
              <KeywordInput
                id="brand"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder="e.g. Hidden gem, Playful"
                invalid={fieldState.invalid}
                chipClassName="bg-fuchsia-100 text-fuchsia-800"
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      </Section>

      <Section
        icon={Coffee}
        iconClassName="bg-orange-100 text-orange-600"
        title="Products"
        description="What to feature in your ads."
        status={status("products")}
      >
        <Controller
          name="products"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="products" className="sr-only">
                Products and services
              </FieldLabel>
              <KeywordInput
                id="products"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder="e.g. Signature latte, Pastries"
                invalid={fieldState.invalid}
                chipClassName="bg-orange-100 text-orange-800"
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      </Section>

      <Section
        icon={Users}
        iconClassName="bg-emerald-100 text-emerald-600"
        title="Audience"
        description="Who should see your ads."
        status={status("audience")}
      >
        <Controller
          name="audience.keywords"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="audience">Who they are</FieldLabel>
              <KeywordInput
                id="audience"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder="e.g. Office workers, Commuters"
                invalid={fieldState.invalid}
                chipClassName="bg-emerald-100 text-emerald-800"
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <div className="flex flex-wrap gap-x-10 gap-y-6">
          <FieldSet className="gap-2">
            <FieldLegend variant="label">Age</FieldLegend>
            <div className="flex items-center gap-3">
              <Controller
                name="audience.ageMin"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Input
                    {...numberFieldProps(field)}
                    onBlur={field.onBlur}
                    type="number"
                    min={AGE_MIN}
                    max={AGE_MAX}
                    aria-label="Youngest age"
                    aria-invalid={fieldState.invalid}
                    className={cn(inputClass, "w-20 text-center tabular-nums")}
                  />
                )}
              />
              <span className="text-sm text-muted-foreground">to</span>
              <Controller
                name="audience.ageMax"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Input
                    {...numberFieldProps(field)}
                    onBlur={field.onBlur}
                    type="number"
                    min={AGE_MIN}
                    max={AGE_MAX}
                    aria-label="Oldest age"
                    aria-invalid={fieldState.invalid}
                    className={cn(inputClass, "w-20 text-center tabular-nums")}
                  />
                )}
              />
            </div>
            <FieldDescription>
              {AGE_MAX} means {AGE_MAX} and over.
            </FieldDescription>
            <FieldError
              errors={[
                form.formState.errors.audience?.ageMin,
                form.formState.errors.audience?.ageMax,
              ]}
            />
          </FieldSet>

          <Controller
            name="audience.gender"
            control={form.control}
            render={({ field }) => (
              <FieldSet className="gap-2">
                <FieldLegend variant="label">Gender</FieldLegend>
                <ChoiceGroup
                  name={field.name}
                  options={genderOptions}
                  value={field.value}
                  onChange={field.onChange}
                />
              </FieldSet>
            )}
          />
        </div>
      </Section>

      <Section
        icon={Wallet}
        iconClassName="bg-violet-100 text-violet-600"
        title="Budget"
        description="What you'll spend each month. You can change it anytime."
        status={status("budget")}
      >
        <Controller
          name="budget.monthly"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="monthly">Monthly budget</FieldLabel>
              <div className="relative max-w-48">
                <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  {...numberFieldProps(field)}
                  onBlur={field.onBlur}
                  id="monthly"
                  type="number"
                  inputMode="numeric"
                  min={100}
                  step={50}
                  aria-invalid={fieldState.invalid}
                  className={cn(inputClass, "pl-8 tabular-nums")}
                />
              </div>
              <FieldDescription>About {currency.format(monthly / 30)} a day.</FieldDescription>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <Controller
          name="budget.metaShare"
          control={form.control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="metaShare">Split between platforms</FieldLabel>
              <input
                id="metaShare"
                type="range"
                min={0}
                max={100}
                step={5}
                value={field.value}
                onChange={(e) => field.onChange(Number(e.target.value))}
                onBlur={field.onBlur}
                aria-valuetext={`Meta ${field.value}%, Google ${100 - field.value}%`}
                // Meta's share in blue-violet, Google's in amber-green, split at the thumb.
                style={{
                  background: `linear-gradient(to right, #3b82f6, #8b5cf6 ${field.value}%, #fbbf24 ${field.value}%, #34d399)`,
                }}
                className={cn(
                  "my-2 h-3 w-full cursor-pointer appearance-none rounded-full outline-none",
                  "[&::-webkit-slider-thumb]:size-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md",
                  "[&::-moz-range-thumb]:size-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-4 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:shadow-md",
                  "focus-visible:ring-3 focus-visible:ring-ring/50",
                )}
              />
              <div className="flex justify-between gap-4 text-sm">
                <p>
                  <span className="font-medium">Meta {field.value}%</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {currency.format(metaAmount)} · Facebook, Instagram
                  </span>
                </p>
                <p className="text-right">
                  <span className="font-medium">Google {100 - field.value}%</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {currency.format(monthly - metaAmount)} · Search, Maps
                  </span>
                </p>
              </div>
            </Field>
          )}
        />
      </Section>

      <div className="flex flex-wrap items-center gap-3 pt-4">
        <Link
          href="/setup"
          className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "h-12 rounded-xl px-4")}
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
        {form.formState.isDirty && suggested && (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={() => {
              form.reset(suggestion.profile)
            }}
            className="h-12 rounded-xl px-4 text-muted-foreground"
          >
            <RotateCcw className="size-4" />
            Reset to suggestions
          </Button>
        )}
        <Button type="submit" size="lg" className={cn(primaryButtonClass, "ml-auto")}>
          Continue
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </form>
  )
}
