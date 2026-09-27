import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { Plus, QrCode } from "lucide-react"

import { listCustomers } from "@/lib/crm/store"
import { filterResponses } from "@/lib/surveys/insights"
import { listResponses, listSurveys } from "@/lib/surveys/store"
import AppHeader from "@/components/app-header"
import ConversionBySource from "@/components/surveys/conversion-by-source"
import { formatDate, formatNumber } from "@/components/dashboard/format"
import InsightFilters from "@/components/surveys/insight-filters"
import StatusBadge from "@/components/surveys/status-badge"
import SurveyInsights from "@/components/surveys/survey-insights"
import ToggleActiveButton from "@/components/surveys/toggle-active-button"
import { buttonVariants } from "@/components/ui/button"

export const metadata: Metadata = { title: "QR surveys · AdPilot" }

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)
const shift = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)

export default async function SurveysPage({ searchParams }: PageProps<"/surveys">) {
  await connection()
  const q = await searchParams
  const [surveys, responses, customers] = await Promise.all([listSurveys(), listResponses(), listCustomers()])

  const surveyId = typeof q.survey === "string" && surveys.some((s) => s.id === q.survey) ? q.survey : undefined
  const from = isDate(q.from) ? q.from : undefined
  const to = isDate(q.to) ? q.to : undefined
  const filtered = filterResponses(responses, { surveyId, from, to })

  const today = new Date().toISOString().slice(0, 10)
  const firstDay = responses[0]?.createdAt.slice(0, 10) ?? today
  const chartFrom = from ?? filtered[0]?.createdAt.slice(0, 10) ?? firstDay
  const chartTo = to ?? today

  const counts = new Map<string, { total: number; last?: string }>()
  for (const r of responses) {
    const c = counts.get(r.surveyId) ?? { total: 0 }
    c.total++
    if (!c.last || r.createdAt > c.last) c.last = r.createdAt
    counts.set(r.surveyId, c)
  }

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader current="/surveys" />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8 sm:px-6 lg:py-10">
        <section className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">QR surveys</h1>
              <p className="mt-1 text-muted-foreground">Put a QR code in your shop. Customers scan it and tell you who they are and how they found you.</p>
            </div>
            <Link href="/surveys/new" className={buttonVariants({ size: "lg", className: "h-11 px-5" })}>
              <Plus data-icon="inline-start" />
              Create QR survey
            </Link>
          </div>

          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {surveys.map((s) => {
              const c = counts.get(s.id)
              return (
                <li key={s.id} className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <QrCode className="size-5" />
                      </span>
                      <div>
                        <h2 className="font-semibold leading-tight">{s.name}</h2>
                        <p className="text-xs text-muted-foreground">Created {formatDate(s.createdAt.slice(0, 10))}</p>
                      </div>
                    </div>
                    <StatusBadge active={s.active} />
                  </div>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Responses</dt>
                      <dd className="text-xl font-semibold">{formatNumber(c?.total ?? 0)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Last response</dt>
                      <dd className="text-xl font-semibold">{c?.last ? formatDate(c.last.slice(0, 10)) : "–"}</dd>
                    </div>
                  </dl>
                  <div className="mt-auto flex flex-wrap items-center gap-1">
                    <Link href={`/surveys/${s.id}`} className={buttonVariants({ variant: "outline", size: "lg" })}>View QR</Link>
                    <Link href={`/surveys/${s.id}/edit`} className={buttonVariants({ variant: "ghost", size: "lg" })}>Edit</Link>
                    <ToggleActiveButton id={s.id} active={s.active} />
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        <section id="insights" aria-labelledby="insights-title" className="flex scroll-mt-20 flex-col gap-4">
          <div>
            <h2 id="insights-title" className="text-2xl font-bold tracking-tight">Survey insights</h2>
            <p className="text-sm text-muted-foreground">
              {surveyId ? surveys.find((s) => s.id === surveyId)?.name : "All surveys"} ·{" "}
              {from || to ? `${from ? formatDate(from) : "Start"} – ${to ? formatDate(to) : "today"}` : "All time"}
            </p>
          </div>
          <InsightFilters
            surveys={surveys}
            surveyId={surveyId}
            from={from}
            to={to}
            presets={[
              { label: "All time" },
              { label: "Last 7 days", from: shift(today, -6), to: today },
              { label: "Last 30 days", from: shift(today, -29), to: today },
            ]}
          />
          <SurveyInsights responses={filtered} surveys={surveys} customers={customers} from={chartFrom} to={chartTo} />
          {filtered.length > 0 && <ConversionBySource responses={filtered} customers={customers} />}
        </section>
      </main>
    </div>
  )
}
