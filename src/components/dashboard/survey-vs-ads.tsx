import Link from "next/link"

import { channelTotals, type Channel } from "@/lib/dashboard-data"
import type { SurveyResponse } from "@/lib/surveys/types"
import { formatNumber, formatPercent } from "@/components/dashboard/format"

// Compares the share of survey answers naming each ad channel with that
// channel's share of ad-attributed conversions. Both shares are taken over
// the three ad channels only, so each column adds up to 100%.
export default function SurveyVsAds({ channels, responses }: { channels: Channel[]; responses: SurveyResponse[] }) {
  const said = channels.map((c) => responses.filter((r) => r.source === c.id).length)
  const saidTotal = said.reduce((a, b) => a + b, 0)
  const conv = channels.map((c) => channelTotals(c).conversions)
  const convTotal = conv.reduce((a, b) => a + b, 0)
  const rows = channels.map((c, i) => ({
    c,
    survey: saidTotal ? said[i] / saidTotal : 0,
    ads: convTotal ? conv[i] / convTotal : 0,
    said: said[i],
    conversions: conv[i],
  }))
  const max = Math.max(...rows.flatMap((r) => [r.survey, r.ads]), 0.01)

  return (
    <section id="survey-vs-ads" aria-labelledby="survey-vs-ads-title" className="scroll-mt-20 rounded-2xl border bg-card p-5 shadow-xs sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="survey-vs-ads-title" className="text-lg font-semibold">What customers say vs. what the ads show</h2>
        <Link href="/surveys#insights" className="text-sm text-primary underline underline-offset-4">Survey insights</Link>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Share of in-store survey answers naming each channel, next to its share of ad conversions. Based on{" "}
        {formatNumber(saidTotal)} survey answers that named YouTube, Facebook or Instagram.
      </p>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground" aria-hidden="true">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-primary" />Survey: &ldquo;heard about us on…&rdquo;</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-foreground/35" />Ad data: conversions</span>
      </div>

      <table className="mt-4 w-full text-sm">
        <caption className="sr-only">Survey share and ad conversion share by channel</caption>
        <thead className="sr-only">
          <tr><th>Channel</th><th>Survey share</th><th>Ad conversion share</th><th>Gap</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const gap = r.survey - r.ads
            return (
              <tr key={r.c.id} className="border-b last:border-0">
                <th scope="row" className="w-28 py-3 pr-3 text-left align-middle font-normal text-muted-foreground">{r.c.name}</th>
                <td className="py-3" colSpan={2}>
                  <div className="flex flex-col gap-1.5">
                    {[
                      { value: r.survey, cls: "bg-primary", title: `${formatNumber(r.said)} survey answers` },
                      { value: r.ads, cls: "bg-foreground/35", title: `${formatNumber(r.conversions)} ad conversions` },
                    ].map((b) => (
                      <div key={b.cls} className="flex items-center gap-2" title={b.title}>
                        <div className={`h-3.5 rounded-r-[4px] ${b.cls}`} style={{ width: `max(calc((100% - 3.5rem) * ${b.value / max}), 4px)` }} />
                        <span className="text-xs font-medium tabular-nums">{formatPercent(b.value, 0)}</span>
                      </div>
                    ))}
                  </div>
                </td>
                <td className="w-40 py-3 pl-3 text-right align-middle text-xs text-muted-foreground">
                  {Math.abs(gap) < 0.05
                    ? "Survey and ads agree"
                    : gap > 0
                      ? `Customers name it ${Math.round(gap * 100)} pts more`
                      : `Ads show ${Math.round(-gap * 100)} pts more`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
