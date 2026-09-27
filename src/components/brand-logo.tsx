import Link from "next/link"
import { PlaneTakeoff } from "lucide-react"

export default function BrandLogo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
      <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 via-pink-500 to-violet-600 text-white shadow-md shadow-pink-500/30">
        <PlaneTakeoff className="size-4" />
      </span>
      AdPilot
    </Link>
  )
}
