import Link from "next/link";
import { Plus } from "lucide-react";

import BrandLogo from "@/components/brand-logo";
import { buttonVariants } from "@/components/ui/button";
import ChannelSection from "@/components/dashboard/channel-section";
import ConversionComparison from "@/components/dashboard/conversion-comparison";
import CrmActions from "@/components/dashboard/crm-actions";
import CustomersSection from "@/components/dashboard/customers-section";
import { formatDateRange } from "@/components/dashboard/format";
import KpiCards from "@/components/dashboard/kpi-cards";
import {
  channelTotals,
  getDashboardData,
  recommendedActions,
  sumTotals,
} from "@/lib/dashboard-data";

export default function Dashboard() {
  const data = getDashboardData();
  const totals = sumTotals(data.channels.map(channelTotals));
  const sections = [
    ...data.channels.map((c) => ({ id: c.id, label: c.name })),
    { id: "customers", label: "Customers" },
    { id: "actions", label: "CRM actions" },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <BrandLogo />
          <nav aria-label="Sections" className="hidden items-center gap-1 text-sm md:flex">
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="rounded-md px-2.5 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                {s.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className={buttonVariants({ variant: "ghost", size: "lg" })}>
              Log in
            </Link>
            <Link href="/setup" className={buttonVariants({ size: "lg" })}>
              <Plus data-icon="inline-start" />
              New campaign
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Campaign dashboard</h1>
            <p className="mt-1 text-muted-foreground">
              {formatDateRange(data.period.start, data.period.end)} · YouTube, Facebook and Instagram
            </p>
          </div>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            Sample data
          </span>
        </div>

        <KpiCards totals={totals} />

        {data.channels.map((c) => (
          <ChannelSection key={c.id} channel={c} />
        ))}

        <ConversionComparison channels={data.channels} />

        <div id="customers" className="scroll-mt-20">
          <CustomersSection data={data} />
        </div>

        <div id="actions" className="scroll-mt-20">
          <CrmActions actions={recommendedActions(data)} />
        </div>
      </main>
    </div>
  );
}
