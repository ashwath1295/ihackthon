import { Globe, ImageIcon, MessageCircle, Share2, ThumbsUp } from "lucide-react"

import { cn } from "@/lib/utils"
import { businessCategories, type BusinessDetails } from "@/lib/setup"
import { categoryVisuals } from "@/components/setup/category-visuals"

type AdPreviewProps = {
  values: Partial<BusinessDetails>
}

// "https://www.joesbakery.com/menu" → "joesbakery.com"
function displayDomain(website: string | undefined) {
  const bare = website
    ?.trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
  return bare?.split(/[/?#]/)[0].toLowerCase() || ""
}

export default function AdPreview({ values }: AdPreviewProps) {
  const name = values.businessName?.trim() || "Your business"
  const description =
    values.description?.trim() ||
    "Your description shows up here. Tell people what you sell and why they'll love it."
  const category = businessCategories.find((c) => c.value === values.category)
  const visual = values.category ? categoryVisuals[values.category] : undefined
  const Icon = visual?.icon ?? ImageIcon
  const domain = displayDomain(values.website)

  return (
    <div className="relative isolate overflow-hidden rounded-[2rem] bg-[oklch(0.2_0.06_280)] p-6 shadow-2xl shadow-violet-950/20 sm:p-8">
      {/* Glow blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 -left-16 size-72 rounded-full bg-fuchsia-500/40 blur-3xl" />
        <div className="absolute top-1/3 -right-24 size-80 rounded-full bg-orange-400/30 blur-3xl" />
        <div className="absolute -bottom-24 left-1/4 size-72 rounded-full bg-cyan-400/25 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] bg-[length:22px_22px] opacity-[0.07]" />
      </div>

      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/20 backdrop-blur">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-lime-300 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-lime-300" />
            </span>
            Live preview
          </span>
          <span className="text-xs text-white/60">Updates as you type</span>
        </div>

        {/* Social feed ad */}
        <article className="overflow-hidden rounded-2xl bg-card text-card-foreground shadow-xl shadow-black/20">
          <div className="flex items-center gap-3 p-4">
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-semibold text-white",
                visual?.gradient ?? "from-slate-300 to-slate-400",
              )}
            >
              {name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{name}</p>
              <p className="text-xs text-muted-foreground">Sponsored</p>
            </div>
          </div>
          <p className="line-clamp-3 px-4 pb-3 text-sm leading-relaxed">{description}</p>
          <div
            className={cn(
              "relative flex aspect-[1.91/1] items-center justify-center bg-gradient-to-br transition-colors duration-500",
              visual?.gradient ??
                "from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700",
            )}
          >
            <Icon
              className={cn("size-14 drop-shadow-sm", visual ? "text-white/90" : "text-slate-400")}
              strokeWidth={1.5}
            />
          </div>
          <div className="flex items-center justify-between gap-3 bg-muted/60 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-xs uppercase tracking-wide text-muted-foreground">
                {domain || "Your website"}
              </p>
              <p className="truncate text-sm font-semibold">{name}</p>
            </div>
            <span className="shrink-0 rounded-md bg-foreground/5 px-3 py-1.5 text-sm font-medium ring-1 ring-foreground/10">
              {category?.cta ?? "Learn more"}
            </span>
          </div>
          <div className="flex justify-around border-t px-4 py-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <ThumbsUp className="size-3.5" /> Like
            </span>
            <span className="flex items-center gap-1.5">
              <MessageCircle className="size-3.5" /> Comment
            </span>
            <span className="flex items-center gap-1.5">
              <Share2 className="size-3.5" /> Share
            </span>
          </div>
        </article>

        {/* Search ad */}
        <article className="rounded-2xl bg-card p-4 text-card-foreground shadow-xl shadow-black/20">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-full bg-muted">
              <Globe className="size-3.5 text-muted-foreground" />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="text-xs">
                <span className="font-semibold">Sponsored</span>
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {domain ? `https://${domain}` : "https://yourwebsite.com"}
              </p>
            </div>
          </div>
          <p className="mt-2 truncate text-lg leading-snug text-[#1a0dab] dark:text-[#8ab4f8]">
            {name}
            {category && category.value !== "other" ? ` | ${category.label}` : ""}
          </p>
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </article>

        <p className="text-center text-xs text-white/60 text-pretty">
          This is a rough preview. AdPilot writes and tests the real ads for you in later steps.
        </p>
      </div>
    </div>
  )
}
