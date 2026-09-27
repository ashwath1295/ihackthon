import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import QRCode from "qrcode"
import { Pencil, TriangleAlert } from "lucide-react"

import { getSurvey, listResponses } from "@/lib/surveys/store"
import { getSurveyUrl } from "@/lib/surveys/survey-url"
import { QUESTIONS } from "@/lib/surveys/types"
import AppHeader from "@/components/app-header"
import { formatDate, formatNumber } from "@/components/dashboard/format"
import QrDownloads from "@/components/surveys/qr-downloads"
import StatusBadge from "@/components/surveys/status-badge"
import ToggleActiveButton from "@/components/surveys/toggle-active-button"
import { buttonVariants } from "@/components/ui/button"

export const metadata: Metadata = { title: "QR survey · AdPilot" }

export default async function SurveyPage({ params }: PageProps<"/surveys/[id]">) {
  await connection()
  const { id } = await params
  const survey = await getSurvey(id)
  if (!survey) notFound()

  const [{ url, localOnly, lan }, responses] = await Promise.all([getSurveyUrl(id), listResponses()])
  const mine = responses.filter((r) => r.surveyId === id)
  const last = mine.at(-1)
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" })

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader current="/surveys" />
      <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <Link href="/surveys" className="text-sm text-muted-foreground hover:text-foreground">← QR surveys</Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{survey.name}</h1>
            <StatusBadge active={survey.active} />
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/surveys/${id}/edit`} className={buttonVariants({ variant: "outline", size: "lg" })}>
              <Pencil data-icon="inline-start" />
              Edit
            </Link>
            <ToggleActiveButton id={id} active={survey.active} />
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <div className="rounded-2xl border bg-white p-6 shadow-xs">
            <div
              className="mx-auto aspect-square w-full max-w-72 [&_svg]:size-full"
              role="img"
              aria-label={`QR code linking to ${url}`}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
            <p className="mt-4 text-center text-lg font-semibold text-neutral-900">{survey.posterMessage}</p>
          </div>

          <div className="flex flex-col gap-6">
            {!survey.active && (
              <p className="flex gap-2 rounded-xl bg-muted p-4 text-sm">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                This survey is inactive. People who scan the code see a &ldquo;survey closed&rdquo; message.
              </p>
            )}
            <section className="flex flex-col gap-3">
              <h2 className="font-semibold">Download and print</h2>
              <QrDownloads surveyId={id} url={url} name={survey.name} message={survey.posterMessage} />
            </section>

            <section className="rounded-2xl border bg-card p-5 text-sm">
              <h2 className="font-semibold">Survey link</h2>
              <a href={url} target="_blank" rel="noreferrer" className="mt-1 block break-all text-primary underline underline-offset-4">
                {url}
              </a>
              {lan && (
                <p className="mt-2 text-muted-foreground">
                  Uses this computer&apos;s Wi-Fi address so a phone on the same network can open it. Set <code>SITE_URL</code> once the app is deployed.
                </p>
              )}
              {localOnly && (
                <p className="mt-2 text-destructive">
                  Phones can&apos;t open localhost. Connect to Wi-Fi or set <code>SITE_URL</code> to your deployed address.
                </p>
              )}
            </section>

            <section className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border bg-card p-5">
                <p className="text-sm text-muted-foreground">Responses</p>
                <p className="mt-1 text-3xl font-semibold">{formatNumber(mine.length)}</p>
                <Link href={`/surveys?survey=${id}#insights`} className="mt-1 inline-block text-sm text-primary underline underline-offset-4">
                  See insights
                </Link>
              </div>
              <div className="rounded-2xl border bg-card p-5">
                <p className="text-sm text-muted-foreground">Last response</p>
                <p className="mt-1 text-3xl font-semibold">{last ? formatDate(last.createdAt.slice(0, 10)) : "None yet"}</p>
              </div>
            </section>

            <section className="text-sm">
              <h2 className="font-semibold">Questions</h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {QUESTIONS.filter((q) => survey.questions.includes(q.id)).map((q) => (
                  <li key={q.id} className="rounded-full bg-secondary px-3 py-1 text-secondary-foreground">{q.label}</li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
