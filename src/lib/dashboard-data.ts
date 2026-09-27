// Mock ad campaign data for the dashboard. Swap `getDashboardData` for a real
// API call later; everything else is computed from these raw numbers.

export type ChannelId = "youtube" | "facebook" | "instagram"

export type Campaign = {
  name: string
  placement: string
  region: string
  startDate: string // ISO date
  endDate: string // ISO date
  impressions: number
  spend: number // USD
  clicks: number
  visitors: number
  leads: number
  conversions: number // paying customers
}

export type Channel = {
  id: ChannelId
  name: string
  campaigns: Campaign[]
  dailyVisitors: { date: string; visitors: number }[]
}

export type Customer = {
  name: string
  channel: ChannelId
  campaign: string
  date: string
  value: number // first order, USD
}

export type Priority = "High" | "Medium" | "Low"

export type CrmAction = {
  priority: Priority
  channel: string
  segment: string
  action: string
  reason: string
}

export type DashboardData = {
  period: { start: string; end: string }
  channels: Channel[]
  recentCustomers: Customer[]
}

const PERIOD = { start: "2026-09-01", end: "2026-09-26" }

const campaigns: Record<ChannelId, Campaign[]> = {
  youtube: [
    { name: "Fall menu launch", placement: "In-stream (skippable)", region: "SF Bay Area", startDate: "2026-09-01", endDate: "2026-09-26", impressions: 182_400, spend: 2_280, clicks: 2_736, visitors: 2_190, leads: 310, conversions: 96 },
    { name: "Weekend brunch", placement: "In-feed video", region: "Oakland & East Bay", startDate: "2026-09-08", endDate: "2026-09-26", impressions: 96_300, spend: 1_150, clicks: 1_251, visitors: 1_010, leads: 142, conversions: 41 },
    { name: "Brand story", placement: "Shorts", region: "California", startDate: "2026-09-12", endDate: "2026-09-26", impressions: 141_000, spend: 870, clicks: 1_128, visitors: 860, leads: 88, conversions: 19 },
  ],
  facebook: [
    { name: "Fall menu launch", placement: "News Feed", region: "SF Bay Area", startDate: "2026-09-01", endDate: "2026-09-26", impressions: 214_800, spend: 2_640, clicks: 4_296, visitors: 3_650, leads: 612, conversions: 198 },
    { name: "Office catering", placement: "Feed + Marketplace", region: "San Francisco", startDate: "2026-09-05", endDate: "2026-09-26", impressions: 88_500, spend: 1_420, clicks: 1_770, visitors: 1_540, leads: 301, conversions: 102 },
    { name: "Retargeting: site visitors", placement: "News Feed", region: "SF Bay Area", startDate: "2026-09-10", endDate: "2026-09-26", impressions: 41_200, spend: 640, clicks: 1_236, visitors: 1_090, leads: 214, conversions: 87 },
  ],
  instagram: [
    { name: "Fall menu launch", placement: "Reels", region: "SF Bay Area", startDate: "2026-09-01", endDate: "2026-09-26", impressions: 256_900, spend: 2_510, clicks: 3_854, visitors: 2_960, leads: 402, conversions: 118 },
    { name: "Behind the counter", placement: "Stories", region: "San Francisco", startDate: "2026-09-08", endDate: "2026-09-26", impressions: 131_400, spend: 1_090, clicks: 1_577, visitors: 1_210, leads: 151, conversions: 37 },
    { name: "Local creator collab", placement: "Feed", region: "California", startDate: "2026-09-15", endDate: "2026-09-26", impressions: 72_600, spend: 900, clicks: 1_452, visitors: 1_120, leads: 176, conversions: 52 },
  ],
}

// Spread a channel's visitors across the period with a gentle upward trend and
// a weekend bump, so the daily series always sums to the campaign totals.
function spreadDaily(total: number, seed: number) {
  const start = new Date(`${PERIOD.start}T00:00:00Z`)
  const end = new Date(`${PERIOD.end}T00:00:00Z`)
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
  const weights = Array.from({ length: days }, (_, i) => {
    const date = new Date(start.getTime() + i * 86_400_000)
    const weekend = [0, 6].includes(date.getUTCDay()) ? 1.25 : 1
    const wobble = 1 + 0.12 * Math.sin(i * 1.7 + seed)
    return (0.6 + i / days) * weekend * wobble
  })
  const sum = weights.reduce((a, b) => a + b, 0)
  const values = weights.map((w) => Math.round((w / sum) * total))
  values[values.length - 1] += total - values.reduce((a, b) => a + b, 0)
  return values.map((visitors, i) => ({
    date: new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10),
    visitors,
  }))
}

function channel(id: ChannelId, name: string, seed: number): Channel {
  const list = campaigns[id]
  const visitors = list.reduce((a, c) => a + c.visitors, 0)
  return { id, name, campaigns: list, dailyVisitors: spreadDaily(visitors, seed) }
}

const recentCustomers: Customer[] = [
  { name: "Priya Shah", channel: "facebook", campaign: "Office catering", date: "2026-09-26", value: 420 },
  { name: "Marcus Lee", channel: "instagram", campaign: "Local creator collab", date: "2026-09-26", value: 38 },
  { name: "Elena Ruiz", channel: "youtube", campaign: "Weekend brunch", date: "2026-09-25", value: 64 },
  { name: "Tom Becker", channel: "facebook", campaign: "Retargeting: site visitors", date: "2026-09-25", value: 52 },
  { name: "Aisha Khan", channel: "instagram", campaign: "Fall menu launch", date: "2026-09-24", value: 29 },
]

export function getDashboardData(): DashboardData {
  return {
    period: PERIOD,
    channels: [
      channel("youtube", "YouTube", 1),
      channel("facebook", "Facebook", 2),
      channel("instagram", "Instagram", 3),
    ],
    recentCustomers,
  }
}

// ---- Derived metrics ------------------------------------------------------

export type Totals = Pick<Campaign, "impressions" | "spend" | "clicks" | "visitors" | "leads" | "conversions">

export function sumTotals(list: Totals[]): Totals {
  return list.reduce<Totals>(
    (t, c) => ({
      impressions: t.impressions + c.impressions,
      spend: t.spend + c.spend,
      clicks: t.clicks + c.clicks,
      visitors: t.visitors + c.visitors,
      leads: t.leads + c.leads,
      conversions: t.conversions + c.conversions,
    }),
    { impressions: 0, spend: 0, clicks: 0, visitors: 0, leads: 0, conversions: 0 },
  )
}

export const channelTotals = (c: Channel) => sumTotals(c.campaigns)
export const conversionRate = (t: Totals) => (t.visitors ? t.conversions / t.visitors : 0)
export const clickThroughRate = (t: Totals) => (t.impressions ? t.clicks / t.impressions : 0)
export const costPerCustomer = (t: Totals) => (t.conversions ? t.spend / t.conversions : 0)
export const leadRate = (t: Totals) => (t.visitors ? t.leads / t.visitors : 0)
export const leadToCustomerRate = (t: Totals) => (t.leads ? t.conversions / t.leads : 0)

const pct = (n: number) => `${(n * 100).toFixed(1)}%`
const usd = (n: number) => `$${Math.round(n)}`
const num = (n: number) => n.toLocaleString("en-US")

// Recommended CRM actions, built from the numbers so they stay true when the
// data changes.
export function recommendedActions(data: DashboardData): CrmAction[] {
  const stats = data.channels.map((c) => ({ c, t: channelTotals(c) }))
  const byRate = [...stats].sort((a, b) => conversionRate(b.t) - conversionRate(a.t))
  const best = byRate[0]
  const others = byRate.slice(1)
  const byLeadRate = [...stats].sort((a, b) => leadRate(a.t) - leadRate(b.t))
  const leakiest = byLeadRate[0]
  const all = sumTotals(stats.map((s) => s.t))

  const actions: CrmAction[] = [
    {
      priority: "High",
      channel: best.c.name,
      segment: `High-intent leads who haven't bought (${num(best.t.leads - best.t.conversions)})`,
      action: "Follow up within 48 hours with a personal message and a first-order offer.",
      reason: `${pct(leadToCustomerRate(best.t))} of ${best.c.name} leads already became customers, the highest of any channel. These are your warmest prospects.`,
    },
    {
      priority: "High",
      channel: best.c.name,
      segment: `Ad budget now on ${others.map((o) => o.c.name).join(" and ")}`,
      action: `Shift budget toward ${best.c.name}, starting with its best campaign.`,
      reason: `${best.c.name} converts ${pct(conversionRate(best.t))} of visitors at ${usd(costPerCustomer(best.t))} per customer, vs ${others
        .map((o) => `${pct(conversionRate(o.t))} at ${usd(costPerCustomer(o.t))} on ${o.c.name}`)
        .join(" and ")}.`,
    },
    {
      priority: "Medium",
      channel: "All channels",
      segment: `New customers (${num(all.conversions)})`,
      action: "Add to the onboarding and nurture sequence: welcome email, then a loyalty offer after 7 days.",
      reason: "A second order is the cheapest one you'll get. These customers already know you.",
    },
    {
      priority: "Medium",
      channel: leakiest.c.name,
      segment: `Visitors who left without signing up (${num(leakiest.t.visitors - leakiest.t.leads)})`,
      action: `Re-engage with a ${leakiest.c.name} retargeting campaign aimed at site visitors.`,
      reason: `Only ${pct(leadRate(leakiest.t))} of ${leakiest.c.name} visitors became leads, the lowest of any channel.`,
    },
  ]

  // Flag the weakest campaign on each channel if it trails its channel's best one badly.
  for (const { c } of stats) {
    const ranked = [...c.campaigns].sort((a, b) => conversionRate(b) - conversionRate(a))
    const top = ranked[0]
    const worst = ranked[ranked.length - 1]
    if (conversionRate(worst) < conversionRate(top) * 0.6) {
      actions.push({
        priority: "Low",
        channel: c.name,
        segment: `Leads from "${worst.name}" (${num(worst.leads - worst.conversions)} not converted)`,
        action: `Send a reminder with the offer from the ad, and rework or pause "${worst.name}".`,
        reason: `"${worst.name}" converts ${pct(conversionRate(worst))} of visitors vs ${pct(conversionRate(top))} for "${top.name}".`,
      })
    }
  }

  return actions
}
