import {
  Briefcase,
  Ellipsis,
  HeartPulse,
  ShoppingBag,
  Sparkles,
  Store,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from "lucide-react"

import type { CategoryValue } from "@/lib/setup"

type CategoryVisual = {
  icon: LucideIcon
  // Ad image and avatar background in the live preview.
  gradient: string
  // Icon chip on the category tile.
  chip: string
  // Tile border and wash when selected.
  selected: string
}

export const categoryVisuals: Record<CategoryValue, CategoryVisual> = {
  restaurant: {
    icon: UtensilsCrossed,
    gradient: "from-amber-300 via-orange-400 to-rose-500",
    chip: "bg-orange-100 text-orange-600",
    selected: "has-checked:border-orange-400 has-checked:bg-orange-50",
  },
  retail: {
    icon: Store,
    gradient: "from-sky-300 via-blue-400 to-indigo-500",
    chip: "bg-sky-100 text-sky-600",
    selected: "has-checked:border-sky-400 has-checked:bg-sky-50",
  },
  "online-store": {
    icon: ShoppingBag,
    gradient: "from-fuchsia-300 via-purple-400 to-indigo-500",
    chip: "bg-fuchsia-100 text-fuchsia-600",
    selected: "has-checked:border-fuchsia-400 has-checked:bg-fuchsia-50",
  },
  "home-services": {
    icon: Wrench,
    gradient: "from-lime-300 via-emerald-400 to-teal-500",
    chip: "bg-emerald-100 text-emerald-600",
    selected: "has-checked:border-emerald-400 has-checked:bg-emerald-50",
  },
  health: {
    icon: HeartPulse,
    gradient: "from-teal-200 via-cyan-400 to-sky-500",
    chip: "bg-cyan-100 text-cyan-700",
    selected: "has-checked:border-cyan-400 has-checked:bg-cyan-50",
  },
  beauty: {
    icon: Sparkles,
    gradient: "from-rose-200 via-pink-400 to-fuchsia-500",
    chip: "bg-pink-100 text-pink-600",
    selected: "has-checked:border-pink-400 has-checked:bg-pink-50",
  },
  professional: {
    icon: Briefcase,
    gradient: "from-slate-300 via-slate-500 to-indigo-700",
    chip: "bg-indigo-100 text-indigo-600",
    selected: "has-checked:border-indigo-400 has-checked:bg-indigo-50",
  },
  other: {
    icon: Ellipsis,
    gradient: "from-violet-300 via-purple-400 to-fuchsia-500",
    chip: "bg-violet-100 text-violet-600",
    selected: "has-checked:border-violet-400 has-checked:bg-violet-50",
  },
}
