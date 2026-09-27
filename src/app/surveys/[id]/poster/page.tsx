import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import QRCode from "qrcode"

import { getSurvey } from "@/lib/surveys/store"
import { getSurveyUrl } from "@/lib/surveys/survey-url"
import PrintButton from "@/components/surveys/print-button"

export const metadata: Metadata = { title: "Poster · AdPilot" }

export default async function PosterPage({ params }: PageProps<"/surveys/[id]/poster">) {
  await connection()
  const { id } = await params
  const survey = await getSurvey(id)
  if (!survey) notFound()
  const { url } = await getSurveyUrl(id)
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" })

  return (
    <div className="flex flex-1 flex-col items-center bg-muted/40 px-4 py-8 print:bg-white print:p-0">
      <div className="mb-6 flex w-full max-w-[8.5in] items-center justify-between print:hidden">
        <Link href={`/surveys/${id}`} className="text-sm text-muted-foreground hover:text-foreground">← Back to survey</Link>
        <PrintButton />
      </div>

      {/* US Letter poster */}
      <article className="flex aspect-[8.5/11] w-full max-w-[8.5in] flex-col items-center justify-between bg-white px-[8%] py-[9%] text-center text-neutral-900 shadow-xl print:max-w-none print:shadow-none">
        <p className="text-[clamp(1rem,2.6vw,1.5rem)] text-neutral-500">{survey.name}</p>
        <h1 className="text-balance text-[clamp(1.75rem,6vw,3.25rem)] font-bold leading-tight tracking-tight">{survey.posterMessage}</h1>
        <div className="w-[62%] [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} />
        <div>
          <p className="text-[clamp(1rem,3vw,1.75rem)] font-semibold">Scan with your phone camera</p>
          <p className="mt-1 break-all text-[clamp(0.625rem,1.4vw,0.875rem)] text-neutral-500">{url}</p>
        </div>
        <p className="text-xs text-neutral-400">Powered by AdPilot</p>
      </article>
    </div>
  )
}
