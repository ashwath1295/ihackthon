import type { Metadata } from "next"
import Link from "next/link"
import { PlaneTakeoff } from "lucide-react"

export const metadata: Metadata = {
  title: "Set up your campaign · AdPilot",
}

export default function SetupLayout({ children }: LayoutProps<"/setup">) {
  return (
    <div className="flex flex-1 flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
            <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 via-pink-500 to-violet-600 text-white shadow-md shadow-pink-500/30">
              <PlaneTakeoff className="size-4" />
            </span>
            AdPilot
          </Link>
          <p className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            Campaign setup
          </p>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 lg:py-14">
        {children}
      </main>
    </div>
  )
}
