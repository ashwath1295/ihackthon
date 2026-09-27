import Link from "next/link";
import { connection } from "next/server";
import { QrCode } from "lucide-react";

import AppHeader from "@/components/app-header";
import { buttonVariants } from "@/components/ui/button";
import ChannelSection from "@/components/dashboard/channel-section";
import ConversionComparison from "@/components/dashboard/conversion-comparison";
import CrmActions from "@/components/dashboard/crm-actions";
import CustomersSection from "@/components/dashboard/customers-section";
import { formatDateRange, formatNumber } from "@/components/dashboard/format";
import KpiCards from "@/components/dashboard/kpi-cards";
import SurveyVsAds from "@/components/dashboard/survey-vs-ads";
import {
  channelTotals,
  getDashboardData,
  recommendedActions,
  sumTotals,
  type CrmAction,
} from "@/lib/dashboard-data";
import { filterResponses, optedInContacts } from "@/lib/surveys/insights";
import { listResponses, listSurveys } from "@/lib/surveys/store";

export default async function Dashboard() {
  await connection();
  const data = getDashboardData();
  const totals = sumTotals(data.channels.map(channelTotals));
  const [surveys, allResponses] = await Promise.all([listSurveys(), listResponses()]);
  // Compare survey answers from the same period as the ad data.
  const periodResponses = filterResponses(allResponses, { from: data.period.start, to: data.period.end });
  const contacts = optedInContacts(allResponses, surveys);

  const actions: CrmAction[] = [...recommendedActions(data)];
  if (contacts.length) {
    actions.push({
      priority: "Medium",
      channel: "In-store QR surveys",
      segment: `Survey contacts who opted in (${formatNumber(contacts.length)})`,
      action: "Add them to the CRM with a welcome offer, tagged with their store and how they heard about you.",
      reason: "They visited in person and asked to hear from you, the warmest contacts you have.",
    });
  }

  const sections = [
    ...data.channels.map((c) => ({ id: c.id, label: c.name })),
    { id: "survey-vs-ads", label: "Survey vs. ads" },
    { id: "customers", label: "Customers" },
    { id: "actions", label: "CRM actions" },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader current="/" />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:py-10">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Campaign dashboard</h1>
              <p className="mt-1 text-muted-foreground">
                {formatDateRange(data.period.start, data.period.end)} · YouTube, Facebook and Instagram
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                Sample data
              </span>
              <Link href="/surveys/new" className={buttonVariants({ variant: "outline", size: "lg" })}>
                <QrCode data-icon="inline-start" />
                Create QR survey
              </Link>
            </div>
          </div>
          <nav aria-label="Dashboard sections" className="flex flex-wrap gap-1.5 text-sm">
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="rounded-full border bg-card px-3 py-1 text-muted-foreground hover:text-foreground">
                {s.label}
              </a>
            ))}
          </nav>
        </div>

        <KpiCards totals={totals} />

        {data.channels.map((c) => (
          <ChannelSection key={c.id} channel={c} />
        ))}

        <ConversionComparison channels={data.channels} />

        <SurveyVsAds channels={data.channels} responses={periodResponses} />

        <div id="customers" className="scroll-mt-20">
          <CustomersSection data={data} surveyContacts={contacts} />
        </div>

        <div id="actions" className="scroll-mt-20">
          <CrmActions actions={actions} />
        </div>
      </main>
    </div>
  );
}
