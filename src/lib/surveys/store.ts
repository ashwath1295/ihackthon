// Survey storage. For the demo this is a JSON file on the server
// (.data/surveys.json), seeded from mock-data.ts. Swap these functions for
// database calls to go to production; nothing else needs to change.
import { randomBytes } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { mockResponses, mockSurveys } from "@/lib/surveys/mock-data"
import type { Survey, SurveyResponse } from "@/lib/surveys/types"

type Db = { surveys: Survey[]; responses: SurveyResponse[] }

const FILE = path.join(process.cwd(), ".data", "surveys.json")

// Used when the file system is read-only (e.g. serverless hosting):
// data then lives in memory until the server restarts.
let memory: Db | null = null

async function load(): Promise<Db> {
  if (memory) return memory
  try {
    return JSON.parse(await readFile(FILE, "utf8")) as Db
  } catch {
    const seed = { surveys: structuredClone(mockSurveys), responses: structuredClone(mockResponses) }
    await save(seed)
    return seed
  }
}

async function save(db: Db) {
  try {
    await mkdir(path.dirname(FILE), { recursive: true })
    await writeFile(FILE, JSON.stringify(db, null, 2))
  } catch {
    memory = db
  }
}

const newId = () => randomBytes(6).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8).padEnd(8, "0")

export async function listSurveys() {
  const db = await load()
  return [...db.surveys].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getSurvey(id: string) {
  const db = await load()
  return db.surveys.find((s) => s.id === id) ?? null
}

export async function createSurvey(input: Omit<Survey, "id" | "createdAt" | "active">) {
  const db = await load()
  const survey: Survey = { ...input, id: newId(), active: true, createdAt: new Date().toISOString() }
  db.surveys.push(survey)
  await save(db)
  return survey
}

export async function updateSurvey(id: string, patch: Partial<Omit<Survey, "id" | "createdAt">>) {
  const db = await load()
  const survey = db.surveys.find((s) => s.id === id)
  if (!survey) return null
  Object.assign(survey, patch)
  await save(db)
  return survey
}

export async function listResponses() {
  const db = await load()
  return db.responses
}

export async function addResponse(input: Omit<SurveyResponse, "id" | "createdAt">) {
  const db = await load()
  const response: SurveyResponse = { ...input, id: newId(), createdAt: new Date().toISOString() }
  db.responses.push(response)
  await save(db)
  return response
}
