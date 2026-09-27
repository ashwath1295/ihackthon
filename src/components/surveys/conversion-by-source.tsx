import { isPaying, totalSpend, type CrmCustomer } from "@/lib/crm/types"
import { SOURCES, type SurveyResponse } from "@/lib/surveys/types"
import { cn } from "@/lib/utils"
import { channelBg } from "@/components/dashboard/channel-colors"
import { formatNumber, formatPercent, formatUsd } from "@/components/dashboard/format"

// Of the opted-in respondents who gave each answer to "How did you hear
// about us?", how many became paying customers in the CRM, and what they spent.
export default function ConversionBySource({
  responses,
  customers,
}: {
  responses: SurveyResponse[] // already filtered
  customers: CrmCustomer[]
}) {
  const crmByResponse = new Map(customers.flatMap((c) => c.surveyResponseIds.map((id) => [id, c] as const)))

  const everyone = new Set<CrmCustomer>()
  const rows = SOURCES.map((s) => {
    // Count each CRM customer once, even if they answered more than one survey.
    const people = new Set<CrmCustomer>()
    for (const r of responses) {
      const c = r.source === s.id ? crmByResponse.get(r.id) : undefined
      if (c) {
        people.add(c)
        everyone.add(c)
      }
    }
    const paying = [...people].filter(isPaying)
    const spend = paying.reduce((a, c) => a + totalSpend(c), 0)
    return {
      ...s,
      respondents: people.size,
      paying: paying.length,
      rate: people.size ? paying.length / people.size : 0,
      spend,
      avg: paying.length ? spend / paying.length : 0,
    }
  })
  // Need a few respondents before calling a channel "best".
  const best = rows.filter((r) => r.respondents >= 3).sort((a, b) => b.rate - a.rate)[0]
  // Totals count each person once, even if they gave different answers in different surveys.
  const payingEveryone = [...everyone].filter(isPaying)
  const total = {
    respondents: everyone.size,
    paying: payingEveryone.length,
    spend: payingEveryone.reduce((a, c) => a + totalSpend(c), 0),
  }

  return (
    <section aria-labelledby="by-source-title" className="rounded-2xl border bg-card p-5 shadow-xs sm:p-6">
      <h3 id="by-source-title" className="text-lg font-semibold">Which channels bring paying customers?</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Opted-in survey respondents by how they heard about us, matched to CRM purchases.
        {best && best.paying > 0 && (
          <> <span className="font-medium text-foreground">{best.label}</span> converts best at {formatPercent(best.rate, 0)}.</>
        )}
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th scope="col" className="py-2 pr-3 font-medium">Heard about us on</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Respondents</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Paying</th>
              <th scope="col" className="w-[32%] py-2 pr-3 font-medium">Conversion rate</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Total spend</th>
              <th scope="col" className="py-2 text-right font-medium">Avg per customer</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((r) => {
              const isBest = best?.id === r.id && r.paying > 0
              return (
                <tr key={r.id} className={cn("border-b last:border-0", isBest && "bg-primary/5")}>
                  <th scope="row" className="py-2.5 pr-3 text-left font-medium">
                    <span className="flex items-center gap-2">
                      <span className={cn("size-2 shrink-0 rounded-full", r.channel ? channelBg[r.channel] : "bg-muted-foreground/50")} aria-hidden="true" />
                      {r.label}
                      {isBest && <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">Best</span>}
                    </span>
                  </th>
                  <td className="py-2.5 pr-3 text-right">{formatNumber(r.respondents)}</td>
                  <td className="py-2.5 pr-3 text-right">{formatNumber(r.paying)}</td>
                  <td className="py-2.5 pr-3">
                    {r.respondents ? (
                      <span className="flex items-center gap-2">
                        <span className="h-2 flex-1 rounded-full bg-muted">
                          <span className="block h-full rounded-full bg-primary" style={{ width: `max(${r.rate * 100}%, 4px)` }} />
                        </span>
                        <span className="w-10 text-right font-medium">{formatPercent(r.rate, 0)}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">No respondents</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 text-right">{r.spend ? formatUsd(r.spend) : "–"}</td>
                  <td className="py-2.5 text-right">{r.avg ? formatUsd(r.avg) : "–"}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t font-semibold tabular-nums">
              <th scope="row" className="py-2.5 pr-3 text-left">All channels</th>
              <td className="py-2.5 pr-3 text-right">{formatNumber(total.respondents)}</td>
              <td className="py-2.5 pr-3 text-right">{formatNumber(total.paying)}</td>
              <td className="py-2.5 pr-3">{total.respondents ? formatPercent(total.paying / total.respondents, 0) : "–"}</td>
              <td className="py-2.5 pr-3 text-right">{formatUsd(total.spend)}</td>
              <td className="py-2.5 text-right">{total.paying ? formatUsd(total.spend / total.paying) : "–"}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Only people who left contact details can be matched to purchases, so anonymous respondents aren&apos;t counted here.
      </p>
    </section>
  )
}
