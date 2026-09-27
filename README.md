# AdPilot

**Your ads, on autopilot.**

AdPilot helps small business owners run ads on Meta and Google without learning either platform.

## How it works

1. **Tell us about your business.** Answer a few simple questions: what you sell, where your customers are, your goal, and your budget.
2. **Launch campaigns.** AdPilot creates campaigns on Meta (Facebook and Instagram) and Google for you.
3. **Track results.** A conversion feed records real sales, bookings, and leads.
4. **See insights.** One dashboard shows what's working and what to do next.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Demo login

Use this account on the login page (`/login`):

| Email | Password |
| --- | --- |
| `demo@adpilot.com` | `demo1234` |

Logging in takes you to the campaign dashboard (`/`). This is a demo-only account checked in the browser (see `src/lib/demo-account.ts`); there's no real authentication yet.

## QR surveys

Owners create a QR survey at `/surveys` (or **Create QR survey** on the dashboard), print the poster, and put it up in the shop. Customers scan it and answer a short form at `/s/<survey-id>`. Results show up under **Survey insights** on `/surveys`, and on the dashboard in "What customers say vs. what the ads show" and the Customers / CRM section.

- **Testing with a phone:** in local development the QR code uses this computer's Wi-Fi address instead of `localhost`, so a phone on the same Wi-Fi can open it. Once deployed, set `SITE_URL` (e.g. `SITE_URL=https://adpilot.example.com`).
- **Data:** surveys and responses are saved to `.data/surveys.json` (not committed), seeded from mock data in `src/lib/surveys/mock-data.ts`. Delete the file to reset the demo. To use a real database, replace the functions in `src/lib/surveys/store.ts`.
- **CRM:** survey contacts who opt in are added to the CRM automatically (matched by email or phone) in `.data/crm.json`, seeded with mock purchases from `src/lib/crm/mock-data.ts`. The QR surveys page shows what each contact has spent and which channels bring paying customers. To connect a real CRM, replace `src/lib/crm/store.ts`.
