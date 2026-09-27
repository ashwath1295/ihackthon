import { conversionRate, type Totals } from "@/lib/dashboard-data"
import { formatNumber, formatPercent, formatUsd } from "@/components/dashboard/format"

export default function KpiCards({ totals }: { totals: Totals }) {
  const kpis = [
    { label: "Total spend", value: formatUsd(totals.spend), note: "across 3 channels" },
    { label: "Total clicks", value: formatNumber(totals.clicks), note: `${formatNumber(totals.impressions)} impressions` },
    { label: "Total conversions", value: formatNumber(totals.conversions), note: "new paying customers" },
    { label: "Conversion rate", value: formatPercent(conversionRate(totals)), note: `of ${formatNumber(totals.visitors)} visitors` },
  ]

  return (
    <section aria-label="Summary" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="rounded-2xl border bg-card p-5 shadow-xs">
          <p className="text-sm text-muted-foreground">{kpi.label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{kpi.value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{kpi.note}</p>
        </div>
      ))}
    </section>
  )
}
