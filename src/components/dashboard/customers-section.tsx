import { channelTotals, sumTotals, type DashboardData } from "@/lib/dashboard-data"
import { cn } from "@/lib/utils"
import BarList from "@/components/dashboard/bar-list"
import { channelBg } from "@/components/dashboard/channel-colors"
import { formatDate, formatNumber, formatPercent, formatUsd } from "@/components/dashboard/format"

export default function CustomersSection({ data }: { data: DashboardData }) {
  const perChannel = data.channels.map((c) => ({ c, t: channelTotals(c) }))
  const all = sumTotals(perChannel.map((p) => p.t))
  const names = Object.fromEntries(data.channels.map((c) => [c.id, c.name]))

  const bySource = perChannel.map(({ c, t }) => ({
    key: c.id,
    label: c.name,
    value: t.conversions,
    valueLabel: formatNumber(t.conversions),
    barClassName: channelBg[c.id],
    details: [
      `${formatPercent(t.conversions / all.conversions, 0)} of all new customers`,
      `${formatNumber(t.leads)} leads, ${formatNumber(t.leads - t.conversions)} not converted yet`,
    ],
  }))

  const stages = [
    { label: "Impressions", value: all.impressions },
    { label: "Clicks", value: all.clicks },
    { label: "Visitors", value: all.visitors },
    { label: "Leads", value: all.leads },
    { label: "Customers", value: all.conversions },
  ]

  return (
    <section aria-labelledby="customers-title" className="flex flex-col gap-4">
      <div>
        <h2 id="customers-title" className="text-xl font-semibold tracking-tight">Customers</h2>
        <p className="text-sm text-muted-foreground">Who you gained, where they came from, and where people drop off.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5 shadow-xs sm:p-6">
          <h3 className="font-semibold">Customers acquired by channel</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatNumber(all.conversions)} new customers this period
          </p>
          <div className="mt-5">
            <BarList items={bySource} />
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-xs sm:p-6">
          <h3 className="font-semibold">Conversion funnel</h3>
          <p className="mt-1 text-sm text-muted-foreground">All channels. Bars show how many moved on from the step before.</p>
          <ol className="mt-5 flex flex-col gap-3">
            {stages.map((s, i) => {
              const prev = stages[i - 1]
              const step = prev ? s.value / prev.value : 1
              return (
                <li key={s.label} className="grid grid-cols-[5.5rem_4.5rem_minmax(0,1fr)] items-center gap-3 text-sm">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="text-right font-semibold tabular-nums">{formatNumber(s.value)}</span>
                  {prev ? (
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `max(${step * 100}%, 4px)` }} />
                      </div>
                      <span className="w-12 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                        {formatPercent(step)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">starting point</span>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-xs sm:p-6">
        <h3 className="font-semibold">Recent customers</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-medium">Customer</th>
                <th scope="col" className="py-2 pr-3 font-medium">Source</th>
                <th scope="col" className="py-2 pr-3 font-medium">Campaign</th>
                <th scope="col" className="py-2 pr-3 font-medium">Date</th>
                <th scope="col" className="py-2 text-right font-medium">First order</th>
              </tr>
            </thead>
            <tbody>
              {data.recentCustomers.map((c) => (
                <tr key={`${c.name}-${c.date}`} className="border-b last:border-0">
                  <th scope="row" className="py-2.5 pr-3 text-left font-medium">{c.name}</th>
                  <td className="py-2.5 pr-3">
                    <span className="inline-flex items-center gap-2">
                      <span className={cn("size-2 rounded-full", channelBg[c.channel])} aria-hidden="true" />
                      {names[c.channel]}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-muted-foreground">{c.campaign}</td>
                  <td className="py-2.5 pr-3 text-muted-foreground">{formatDate(c.date)}</td>
                  <td className="py-2.5 text-right tabular-nums">{formatUsd(c.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
