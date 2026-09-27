import {
  channelTotals,
  conversionRate,
  costPerCustomer,
  type Channel,
} from "@/lib/dashboard-data"
import BarList from "@/components/dashboard/bar-list"
import { channelBg } from "@/components/dashboard/channel-colors"
import { formatNumber, formatPercent, formatUsd } from "@/components/dashboard/format"

export default function ConversionComparison({ channels }: { channels: Channel[] }) {
  const items = channels.map((c) => {
    const t = channelTotals(c)
    return {
      key: c.id,
      label: c.name,
      value: conversionRate(t),
      valueLabel: formatPercent(conversionRate(t)),
      barClassName: channelBg[c.id],
      details: [
        `${formatNumber(t.conversions)} conversions from ${formatNumber(t.visitors)} visitors`,
        `${formatUsd(costPerCustomer(t))} per customer`,
      ],
    }
  })

  return (
    <section aria-labelledby="comparison-title" className="rounded-2xl border bg-card p-5 shadow-xs sm:p-6">
      <h2 id="comparison-title" className="text-lg font-semibold">Conversion rate by channel</h2>
      <p className="mt-1 text-sm text-muted-foreground">Conversions ÷ visitors. Hover a bar for details.</p>
      <div className="mt-5">
        <BarList items={items} />
      </div>
    </section>
  )
}
