import Link from "next/link";

export default function GetStarted() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <h1 className="text-3xl font-bold tracking-tight">Let&apos;s get started</h1>
      <p className="max-w-md text-muted-foreground">
        Onboarding is coming soon. You&apos;ll tell us about your business and
        we&apos;ll set up your campaigns.
      </p>
      <Link href="/" className="text-sm underline underline-offset-4">
        Back to home
      </Link>
    </main>
  );
}
