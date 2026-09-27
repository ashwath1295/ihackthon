"use client";

import { useState } from "react";

type Task = { id: number; text: string; done: boolean };

export default function TaskList() {
  const [tasks, setTasks] = useState<Task[]>([
    { id: 1, text: "Set up Next.js", done: true },
    { id: 2, text: "Build the hackathon idea", done: false },
  ]);
  const [text, setText] = useState("");

  function addTask(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setTasks((prev) => [...prev, { id: Date.now(), text: trimmed, done: false }]);
    setText("");
  }

  function toggle(id: number) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }

  function remove(id: number) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  const remaining = tasks.filter((t) => !t.done).length;

  return (
    <section className="w-full max-w-md rounded-xl border border-black/10 dark:border-white/15 p-6">
      <h2 className="text-xl font-semibold mb-4">Tasks ({remaining} left)</h2>
      <form onSubmit={addTask} className="flex gap-2 mb-4">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a task…"
          className="flex-1 rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2"
        />
        <button className="rounded-md bg-foreground text-background px-4 py-2 font-medium">
          Add
        </button>
      </form>
      <ul className="space-y-2">
        {tasks.map((t) => (
          <li key={t.id} className="flex items-center gap-3">
            <input type="checkbox" checked={t.done} onChange={() => toggle(t.id)} />
            <span className={`flex-1 ${t.done ? "line-through opacity-50" : ""}`}>{t.text}</span>
            <button onClick={() => remove(t.id)} className="text-sm opacity-60 hover:opacity-100">
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
