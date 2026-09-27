export type Order = { id: string; date: string; amount: number } // amount in USD

export type CrmCustomer = {
  id: string
  name?: string
  email?: string
  phone?: string
  source?: string // "How did you hear about us?" answer id
  stores: string[] // survey ids the customer came through
  surveyResponseIds: string[]
  createdAt: string
  orders: Order[]
}

export const totalSpend = (c: CrmCustomer) => c.orders.reduce((a, o) => a + o.amount, 0)
export const lastOrderDate = (c: CrmCustomer) => c.orders.at(-1)?.date
export const isPaying = (c: CrmCustomer) => c.orders.length > 0
