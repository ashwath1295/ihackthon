import Link from "next/link";
import { ArrowRight } from "lucide-react";

import HeroGraphic from "@/components/HeroGraphic";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="relative isolate flex flex-1 items-center overflow-hidden">
      {/* Background decoration */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_1px_1px,var(--border)_1px,transparent_0)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
      />

      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-16 px-6 py-20 lg:grid-cols-2">
        <div className="text-center lg:text-left">
          <p className="text-sm font-semibold tracking-wide text-violet-600 dark:text-violet-400">
            AdPilot
          </p>
          <h1 className="mt-3 text-5xl font-bold tracking-tight sm:text-6xl">
            Your ads,{" "}
            <span className="bg-gradient-to-r from-sky-500 to-violet-600 bg-clip-text text-transparent">
              on autopilot.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground lg:mx-0">
            Run ads on Meta and Google without learning either platform. Tell us
            about your business and AdPilot does the rest.
          </p>
          <Link
            href="/get-started"
            className={buttonVariants({ size: "lg", className: "mt-10 h-12 px-6 text-base" })}
          >
            Get started
            <ArrowRight data-icon="inline-end" />
          </Link>
        </div>

        <HeroGraphic />
      </div>
    </main>
  );
}
