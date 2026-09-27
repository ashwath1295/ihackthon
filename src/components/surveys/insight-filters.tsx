import Link from "next/link"

import type { Survey } from "@/lib/surveys/types"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

type Props = {
  surveys: Survey[]
  surveyId?: string
  from?: string
  to?: string
  presets: { label: string; from?: string; to?: string }[]
}

const fieldClass = "h-10 rounded-lg border border-input bg-card px-3 text-sm"

// Plain GET form: filters live in the URL, so a filtered view can be shared or bookmarked.
export default function InsightFilters({ surveys, surveyId, from, to, presets }: Props) {
  const href = (p: { from?: string; to?: string }) => {
    const q = new URLSearchParams()
    if (surveyId) q.set("survey", surveyId)
    if (p.from) q.set("from", p.from)
    if (p.to) q.set("to", p.to)
    const s = q.toString()
    return `/surveys${s ? `?${s}` : ""}#insights`
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <form action="/surveys#insights" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Survey / store
          <select name="survey" defaultValue={surveyId ?? ""} className={fieldClass}>
            <option value="">All surveys</option>
            {surveys.map((s) => (
              <option key={s.id} value={s.id}>{s.name}{s.active ? "" : " (inactive)"}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          From
          <input type="date" name="from" defaultValue={from} className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          To
          <input type="date" name="to" defaultValue={to} className={fieldClass} />
        </label>
        <button type="submit" className={buttonVariants({ size: "lg", className: "h-10" })}>Apply</button>
      </form>
      <div className="flex flex-wrap gap-1.5 text-sm">
        {presets.map((p) => {
          const active = (p.from ?? "") === (from ?? "") && (p.to ?? "") === (to ?? "")
          return (
            <Link
              key={p.label}
              href={href(p)}
              className={cn("rounded-full border px-3 py-1", active ? "border-primary bg-primary/10 font-medium" : "text-muted-foreground hover:text-foreground")}
            >
              {p.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
