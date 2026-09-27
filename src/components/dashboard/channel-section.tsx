import {
  channelTotals,
  clickThroughRate,
  conversionRate,
  type Channel,
} from "@/lib/dashboard-data"
import { cn } from "@/lib/utils"
import { channelBg, channelStroke } from "@/components/dashboard/channel-colors"
import {
  daysBetween,
  formatCompact,
  formatDate,
  formatNumber,
  formatPercent,
  formatUsd,
} from "@/components/dashboard/format"
import TrendChart from "@/components/dashboard/trend-chart"

export default function ChannelSection({ channel }: { channel: Channel }) {
  const t = channelTotals(channel)
  const metrics = [
    { label: "Impressions", value: formatCompact(t.impressions), sub: "people reached" },
    { label: "Spend", value: formatUsd(t.spend), sub: `${formatUsd(t.spend / daysBetween(channel.dailyVisitors[0].date, channel.dailyVisitors.at(-1)!.date))}/day` },
    { label: "Clicks", value: formatNumber(t.clicks), sub: `${formatPercent(clickThroughRate(t))} click rate` },
    { label: "Visitors", value: formatNumber(t.visitors), sub: `landed from ${channel.name}` },
    { label: "Conversions", value: formatNumber(t.conversions), sub: "paying customers" },
    { label: "Conversion rate", value: formatPercent(conversionRate(t)), sub: "conversions ÷ visitors" },
  ]

  return (
    <section id={channel.id} aria-labelledby={`${channel.id}-title`} className="scroll-mt-20 rounded-2xl border bg-card p-5 shadow-xs sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${channel.id}-title`} className="flex items-center gap-2.5 text-lg font-semibold">
          <span className={cn("size-3 rounded-full", channelBg[channel.id])} aria-hidden="true" />
          {channel.name}
        </h2>
        <p className="text-sm text-muted-foreground">
          {channel.campaigns.length} campaigns
        </p>
      </header>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
          {metrics.map((m) => (
            <div key={m.label}>
              <dt className="text-xs text-muted-foreground">{m.label}</dt>
              <dd className="mt-1 text-2xl font-semibold tracking-tight">{m.value}</dd>
              <dd className="text-xs text-muted-foreground">{m.sub}</dd>
            </div>
          ))}
        </dl>
        <TrendChart data={channel.dailyVisitors.map((d) => ({ date: d.date, value: d.visitors }))} color={channelStroke[channel.id]} label="Visitors per day" />
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[46rem] text-sm">
          <caption className="sr-only">{channel.name} campaigns</caption>
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th scope="col" className="py-2 pr-3 font-medium">Campaign</th>
              <th scope="col" className="py-2 pr-3 font-medium">Placement</th>
              <th scope="col" className="py-2 pr-3 font-medium">Region</th>
              <th scope="col" className="py-2 pr-3 font-medium">Ran</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Impr.</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Spend</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Clicks</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Visitors</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Conv.</th>
              <th scope="col" className="py-2 text-right font-medium">Rate</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {channel.campaigns.map((c) => (
              <tr key={c.name} className="border-b last:border-0">
                <th scope="row" className="py-2.5 pr-3 text-left font-medium">{c.name}</th>
                <td className="py-2.5 pr-3 text-muted-foreground">{c.placement}</td>
                <td className="py-2.5 pr-3 text-muted-foreground">{c.region}</td>
                <td className="py-2.5 pr-3 whitespace-nowrap text-muted-foreground">
                  {formatDate(c.startDate)}–{formatDate(c.endDate)} · {daysBetween(c.startDate, c.endDate)}d
                </td>
                <td className="py-2.5 pr-3 text-right">{formatCompact(c.impressions)}</td>
                <td className="py-2.5 pr-3 text-right">{formatUsd(c.spend)}</td>
                <td className="py-2.5 pr-3 text-right">{formatNumber(c.clicks)}</td>
                <td className="py-2.5 pr-3 text-right">{formatNumber(c.visitors)}</td>
                <td className="py-2.5 pr-3 text-right">{formatNumber(c.conversions)}</td>
                <td className="py-2.5 text-right font-medium">{formatPercent(conversionRate(c))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
