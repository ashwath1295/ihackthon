import BusinessForm from "@/components/setup/business-form"
import SetupProgress from "@/components/setup/setup-progress"
import { setupSteps } from "@/lib/setup"

export default function SetupPage() {
  return (
    <BusinessForm
      intro={
        <div className="flex max-w-xl flex-col gap-6">
          <SetupProgress current={0} />
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-primary">Step 1 of {setupSteps.length}</p>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl text-balance">
              Tell us about{" "}
              <span className="bg-gradient-to-r from-primary via-fuchsia-500 to-orange-500 bg-clip-text text-transparent">
                your business
              </span>
            </h1>
            <p className="text-lg text-muted-foreground text-pretty">
              We&apos;ll use this to write your ads and find the right customers. It takes about a
              minute.
            </p>
          </div>
        </div>
      }
    />
  )
}
