import type { Metadata } from "next"
import Link from "next/link"

import { createSurveyAction } from "@/lib/surveys/actions"
import AppHeader from "@/components/app-header"
import SurveyForm from "@/components/surveys/survey-form"

export const metadata: Metadata = { title: "Create QR survey · AdPilot" }

export default function NewSurveyPage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader current="/surveys" />
      <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
        <Link href="/surveys" className="text-sm text-muted-foreground hover:text-foreground">← QR surveys</Link>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Create a QR survey</h1>
        <p className="mt-2 text-muted-foreground">
          Print the QR code, put it up in your shop, and see who your customers are and how they found you.
        </p>
        <div className="mt-8">
          <SurveyForm action={createSurveyAction} submitLabel="Create QR code" />
        </div>
      </main>
    </div>
  )
}
