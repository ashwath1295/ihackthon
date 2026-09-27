import Link from "next/link"

import {
  ageBreakdown,
  optedInContacts,
  responsesPerDay,
  sourceBreakdown,
  topLocations,
} from "@/lib/surveys/insights"
import { lastOrderDate, totalSpend, type CrmCustomer } from "@/lib/crm/types"
import type { Survey, SurveyResponse } from "@/lib/surveys/types"
import { cn } from "@/lib/utils"
import BarList from "@/components/dashboard/bar-list"
import { channelBg } from "@/components/dashboard/channel-colors"
import { formatDate, formatNumber, formatPercent, formatUsd } from "@/components/dashboard/format"
import TrendChart from "@/components/dashboard/trend-chart"

type Props = {
  responses: SurveyResponse[] // already filtered
  surveys: Survey[]
  customers: CrmCustomer[]
  from: string
  to: string
}

const card = "rounded-2xl border bg-card p-5 shadow-xs sm:p-6"

export default function SurveyInsights({ responses, surveys, customers, from, to }: Props) {
  const total = responses.length
  const ages = ageBreakdown(responses)
  const sources = sourceBreakdown(responses)
  const locations = topLocations(responses)
  const contacts = optedInContacts(responses, surveys)
  const crmByResponse = new Map(customers.flatMap((c) => c.surveyResponseIds.map((id) => [id, c] as const)))
  const answeredAge = ages.reduce((a, b) => a + b.count, 0)
  const answeredSource = sources.reduce((a, b) => a + b.count, 0)
  const topSource = [...sources].sort((a, b) => b.count - a.count)[0]

  if (total === 0) {
    return <p className={`${card} text-muted-foreground`}>No responses match these filters yet.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Total responses", value: formatNumber(total), note: `${formatNumber(Math.round(total / Math.max(responsesPerDay(responses, from, to).length, 1) * 7))} per week on average` },
          { label: "Opted-in contacts", value: formatNumber(contacts.length), note: "sent to Customers / CRM" },
          { label: "Top source", value: topSource.count ? topSource.label : "–", note: topSource.count ? `${formatPercent(topSource.count / answeredSource, 0)} of answers` : "" },
          { label: "Top location", value: locations[0]?.label ?? "–", note: locations[0] ? `${formatNumber(locations[0].count)} responses` : "" },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border bg-card p-5 shadow-xs">
            <p className="text-sm text-muted-foreground">{k.label}</p>
            <p className="mt-2 truncate text-2xl font-semibold tracking-tight sm:text-3xl">{k.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{k.note}</p>
          </div>
        ))}
      </div>

      <div className={card}>
        <TrendChart data={responsesPerDay(responses, from, to)} color="var(--primary)" label="Responses per day" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={card}>
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-semibold">How did you hear about us?</h3>
            <Link href="/dashboard#survey-vs-ads" className="text-sm text-primary underline underline-offset-4">Compare with ad data</Link>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{formatNumber(answeredSource)} answers</p>
          <div className="mt-5">
            <BarList
              labelWidth="10.5rem"
              items={sources.map((s) => ({
                key: s.id,
                label: s.label,
                value: s.count,
                valueLabel: formatNumber(s.count),
                barClassName: s.channel ? channelBg[s.channel] : "bg-muted-foreground/50",
                details: [`${formatPercent(answeredSource ? s.count / answeredSource : 0)} of answers`],
              }))}
            />
          </div>
        </div>

        <div className={card}>
          <h3 className="font-semibold">Age group</h3>
          <p className="mt-1 text-sm text-muted-foreground">{formatNumber(answeredAge)} answers</p>
          <div className="mt-5">
            <BarList
              items={ages.map((a) => ({
                key: a.group,
                label: a.group,
                value: a.count,
                valueLabel: formatNumber(a.count),
                barClassName: "bg-primary",
                details: [`${formatPercent(answeredAge ? a.count / answeredAge : 0)} of answers`],
              }))}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={card}>
          <h3 className="font-semibold">Top customer locations</h3>
          <p className="mt-1 text-sm text-muted-foreground">City or ZIP code, as customers typed it</p>
          <div className="mt-5">
            {locations.length ? (
              <BarList
                labelWidth="10.5rem"
                items={locations.map((l) => ({
                  key: l.label,
                  label: l.label,
                  value: l.count,
                  valueLabel: formatNumber(l.count),
                  barClassName: "bg-primary",
                }))}
              />
            ) : (
              <p className="text-sm text-muted-foreground">No locations yet.</p>
            )}
          </div>
        </div>

        <div className={card}>
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-semibold">Newest opted-in contacts</h3>
            <Link href="/dashboard#customers" className="text-sm text-primary underline underline-offset-4">Open in CRM</Link>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Linked to the CRM automatically, with what they&apos;ve spent since.</p>
          <ul className="mt-3 divide-y text-sm">
            {contacts.slice(0, 6).map((c) => {
              const crm = crmByResponse.get(c.id)
              const spend = crm ? totalSpend(crm) : 0
              const last = crm && lastOrderDate(crm)
              return (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium">{c.name ?? c.email ?? c.phone}</span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                          spend ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {spend ? "Customer" : "Lead"}
                      </span>
                    </span>
                    <span className="block truncate text-muted-foreground">
                      {c.store} · {c.source ?? "Source not given"}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    {spend ? (
                      <>
                        <span className="block font-semibold tabular-nums">{formatUsd(spend)}</span>
                        <span className="block text-xs text-muted-foreground">
                          {crm!.orders.length} {crm!.orders.length === 1 ? "order" : "orders"}
                          {last ? ` · last ${formatDate(last.slice(0, 10))}` : ""}
                        </span>
                      </>
                    ) : (
                      <span className="block text-xs text-muted-foreground">No purchases yet</span>
                    )}
                  </span>
                </li>
              )
            })}
            {!contacts.length && <li className="py-2.5 text-muted-foreground">No one has opted in yet.</li>}
          </ul>
        </div>
      </div>
    </div>
  )
}
