import type { Metadata, Viewport } from "next"
import { notFound } from "next/navigation"
import { connection } from "next/server"

import { getSurvey } from "@/lib/surveys/store"
import CustomerSurveyForm from "@/components/surveys/customer-survey-form"

export async function generateMetadata({ params }: PageProps<"/s/[id]">): Promise<Metadata> {
  const survey = await getSurvey((await params).id)
  return { title: survey ? `${survey.name} · Quick survey` : "Survey", robots: { index: false } }
}

export const viewport: Viewport = { width: "device-width", initialScale: 1 }

export default async function CustomerSurveyPage({ params }: PageProps<"/s/[id]">) {
  await connection()
  const survey = await getSurvey((await params).id)
  if (!survey) notFound()

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 pt-8 pb-12">
      <header className="mb-8">
        <p className="text-base font-medium text-primary">{survey.name}</p>
      </header>

      {survey.active ? (
        <CustomerSurveyForm surveyId={survey.id} storeName={survey.name} questions={survey.questions} />
      ) : (
        <div className="py-12 text-center">
          <h1 className="text-3xl font-bold tracking-tight">This survey is closed</h1>
          <p className="mt-3 text-lg text-muted-foreground">Thanks for stopping by {survey.name}!</p>
        </div>
      )}

      <p className="mt-auto pt-12 text-center text-sm text-muted-foreground">Powered by AdPilot</p>
    </main>
  )
}
