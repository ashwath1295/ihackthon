import TaskList from "@/components/TaskList";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center gap-8 px-4 py-16 font-sans">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">iHackathon</h1>
        <p className="mt-2 opacity-70">
          A sample Next.js app. Try the API at{" "}
          <a href="/api/hello" className="underline">/api/hello</a>.
        </p>
      </div>
      <TaskList />
    </main>
  );
}
