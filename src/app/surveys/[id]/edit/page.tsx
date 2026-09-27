import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { connection } from "next/server"

import { updateSurveyAction } from "@/lib/surveys/actions"
import { getSurvey } from "@/lib/surveys/store"
import AppHeader from "@/components/app-header"
import SurveyForm from "@/components/surveys/survey-form"

export const metadata: Metadata = { title: "Edit QR survey · AdPilot" }

export default async function EditSurveyPage({ params }: PageProps<"/surveys/[id]/edit">) {
  await connection()
  const { id } = await params
  const survey = await getSurvey(id)
  if (!survey) notFound()

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader current="/surveys" />
      <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
        <Link href={`/surveys/${id}`} className="text-sm text-muted-foreground hover:text-foreground">← {survey.name}</Link>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Edit survey</h1>
        <p className="mt-2 text-muted-foreground">The QR code stays the same, so posters you already printed keep working.</p>
        <div className="mt-8">
          <SurveyForm action={updateSurveyAction.bind(null, id)} survey={survey} submitLabel="Save changes" />
        </div>
      </main>
    </div>
  )
}
