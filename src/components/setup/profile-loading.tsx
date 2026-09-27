"use client"

import { useEffect, useState } from "react"
import { Check, LoaderCircle, Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"

export const LOADING_STEP_MS = 600

export function loadingSteps(host: string) {
  return [
    host ? `Reading ${host}` : "Reading your description",
    "Pinpointing your location",
    "Picking out your brand keywords",
    "Spotting your best sellers",
    "Finding your customers",
    "Suggesting a budget",
  ]
}

export default function ProfileLoading({
  businessName,
  host,
}: {
  businessName: string
  host: string
}) {
  const steps = loadingSteps(host)
  const [active, setActive] = useState(0)

  // Walk through the steps; the last one stays active until the suggestion arrives.
  useEffect(() => {
    const timer = setInterval(() => {
      setActive((current) => Math.min(current + 1, steps.length - 1))
    }, LOADING_STEP_MS)
    return () => clearInterval(timer)
  }, [steps.length])

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-8 py-10 text-center">
      <div className="relative flex size-24 items-center justify-center">
        <div className="absolute inset-0 animate-spin rounded-full bg-[conic-gradient(from_0deg,var(--color-primary),#d946ef,#f97316,#22d3ee,var(--color-primary))] [animation-duration:2.5s]" />
        <div className="absolute inset-1.5 rounded-full bg-background" />
        <div className="absolute inset-0 animate-pulse rounded-full bg-fuchsia-400/20 blur-xl" />
        <Sparkles className="relative size-9 text-primary" />
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          Getting to know {businessName}
        </h1>
        <p className="text-muted-foreground">This takes a few seconds.</p>
      </div>

      <ol className="flex w-full flex-col gap-1 rounded-3xl bg-card p-3 text-left shadow-xs ring-1 ring-border">
        {steps.map((step, index) => {
          const done = index < active
          const current = index === active
          return (
            <li
              key={step}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-all duration-300",
                current && "bg-secondary font-medium",
                !done && !current && "text-muted-foreground/60",
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full transition-colors",
                  done && "bg-emerald-500 text-white",
                  current && "text-primary",
                  !done && !current && "ring-1 ring-border",
                )}
              >
                {done && <Check className="size-3.5" strokeWidth={3} />}
                {current && <LoaderCircle className="size-5 animate-spin" />}
              </span>
              {step}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
