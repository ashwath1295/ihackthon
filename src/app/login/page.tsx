import type { Metadata } from "next"

import BrandLogo from "@/components/brand-logo"
import LoginForm from "@/components/login-form"

export const metadata: Metadata = {
  title: "Log in · AdPilot",
}

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <BrandLogo />
        </div>
        <div className="mt-8 rounded-2xl border bg-card p-6 shadow-xl sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Log in to see how your ads are doing.
          </p>
          <div className="mt-6">
            <LoginForm />
          </div>
        </div>
      </div>
    </main>
  )
}
