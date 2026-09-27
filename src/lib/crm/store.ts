// CRM storage for the demo: .data/crm.json, seeded from the opted-in survey
// contacts plus mock purchase history. Replace these functions with calls to
// your real CRM (HubSpot, Salesforce, …) later.
import { mockOrdersFor, MOCK_ORDERS_UNTIL } from "@/lib/crm/mock-data"
import type { CrmCustomer } from "@/lib/crm/types"
import { jsonFileStore } from "@/lib/json-file-store"
import { listResponses, newId } from "@/lib/surveys/store"
import type { SurveyResponse } from "@/lib/surveys/types"

type Db = { customers: CrmCustomer[] }

const normalizeEmail = (e?: string) => e?.trim().toLowerCase() || undefined
const normalizePhone = (p?: string) => p?.replace(/\D/g, "") || undefined

// Find the customer with the same email or phone, or create one, and link the response.
function link(db: Db, response: SurveyResponse, withMockOrders: boolean) {
  const c = response.contact
  if (!response.consent || !c || !(c.name || c.email || c.phone)) return null
  const email = normalizeEmail(c.email)
  const phone = normalizePhone(c.phone)
  let customer = db.customers.find(
    (x) => (email && normalizeEmail(x.email) === email) || (phone && normalizePhone(x.phone) === phone),
  )
  if (!customer) {
    customer = { id: newId(), stores: [], surveyResponseIds: [], createdAt: response.createdAt, orders: [] }
    db.customers.push(customer)
  }
  customer.name ??= c.name
  customer.email ??= c.email
  customer.phone ??= c.phone
  customer.source ??= response.source
  if (!customer.stores.includes(response.surveyId)) customer.stores.push(response.surveyId)
  if (!customer.surveyResponseIds.includes(response.id)) {
    customer.surveyResponseIds.push(response.id)
    if (withMockOrders) customer.orders.push(...mockOrdersFor(response, MOCK_ORDERS_UNTIL))
  }
  return customer
}

const file = jsonFileStore<Db>("crm.json", async () => {
  const db: Db = { customers: [] }
  for (const r of await listResponses()) link(db, r, true)
  return db
})

export async function listCustomers() {
  return (await file.read()).customers
}

// Called when a survey is submitted: opted-in contacts flow into the CRM automatically.
export async function linkSurveyResponse(response: SurveyResponse) {
  const db = await file.read()
  const customer = link(db, response, false)
  if (customer) await file.write(db)
  return customer
}
