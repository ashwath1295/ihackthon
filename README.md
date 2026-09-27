# AdPilot

**Your ads, on autopilot.**

AdPilot is a wrapper around ad campaign management, built for small business owners. It asks the owner a few plain-language questions about their business, then launches campaigns on Meta and Google, sets up conversion tracking, and shows one dashboard of what's working.

## The problem

Small business owners know their customers, but not ad platforms. Running ads today means:

- Learning two or more complex tools (Meta Ads Manager, Google Ads), each with its own terms, objectives, and settings.
- Setting up pixels, tags, and conversion events. This is where most setups quietly break.
- Reading results across separate dashboards that disagree with each other, with no clear answer to "are my ads making me money?"

Most owners either overpay an agency or waste their budget on campaigns they can't measure.

## Who it's for

Owners of local and online small businesses who have a modest budget and no marketing team. Examples include a bakery, a plumber, a boutique, a dental clinic, or a small Shopify store.

## How it works

AdPilot has four steps.

### 1. Tell us about your business

A short, guided onboarding flow collects what the platforms need. The questions avoid ad jargon.

| We ask | We use it for |
| --- | --- |
| Business name, category, and website | Ad copy, landing pages, and category-based defaults |
| Where your customers are (address and radius, or regions) | Location targeting |
| Your main goal: calls, store visits, bookings, sales, or leads | Campaign objective and conversion event |
| Your monthly budget | Budget split across platforms |
| Who your ideal customer is | Audience targeting and keywords |
| What makes you different, and any current offer | Headlines and descriptions |
| Photos or a logo (optional) | Ad creatives |
| What counts as a "win" (a purchase, form fill, or call) and its value | Conversion setup and ROAS reporting |

AdPilot validates the answers as the owner types. It fills in sensible defaults for the category, so an owner can finish in a few minutes.

### 2. Launch campaigns on Meta and Google

AdPilot turns the business brief into platform-specific campaigns:

- **Meta** (Facebook and Instagram): a campaign with an objective that matches the goal, an ad set with location, age, and interest targeting, and ads built from the owner's copy and images.
- **Google** (Search, Maps, YouTube, and Display): a Search campaign with keywords generated from the business category and description, plus a Performance Max campaign for broader reach.

The owner reviews one plain-language summary before launch, for example: *"We'll spend about $15/day showing ads to people within 10 miles who search for 'emergency plumber'."* Nothing goes live until they approve it.

### 3. Set up the conversion feed

AdPilot tracks real results, not just clicks:

- **Website events.** One AdPilot snippet, or a Shopify/WordPress plugin, captures key events such as purchases, bookings, and form submissions.
- **Offline conversions.** Owners can upload a CSV or connect a webhook for sales that happen in-store or by phone.
- **Platform delivery.** AdPilot sends each event to the **Meta Conversions API** and to **Google Ads conversion uploads** (including enhanced conversions), so each platform can optimize toward real outcomes.

Events are stored in one normalized schema, so every platform uses the same definition of a conversion.

### 4. See insights

One dashboard answers the owner's real questions:

- **Is this working?** Total spend, conversions, cost per conversion, and return on ad spend (ROAS) across all platforms.
- **Where is it working?** A side-by-side comparison of Meta and Google.
- **What should I do next?** Plain-language recommendations, such as *"Google is bringing in customers at half the cost of Meta. Shift $100 of your budget to Google?"*, with one-click actions.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Next.js app (App Router)                                   │
│  Onboarding · Campaign review · Insights dashboard          │
└──────────────┬──────────────────────────────┬───────────────┘
               │ API routes                   │ Event ingest
     ┌─────────▼─────────┐          ┌─────────▼─────────┐
     │ Campaign service  │          │ Conversion feed   │
     │ brief → campaigns │          │ normalize, fan-out│
     └──┬─────────────┬──┘          └──┬─────────────┬──┘
        │             │                │             │
 ┌──────▼─────┐ ┌─────▼──────┐  ┌──────▼─────┐ ┌─────▼──────┐
 │ Meta       │ │ Google Ads │  │ Meta       │ │ Google Ads │
 │ Marketing  │ │ API        │  │ Conversions│ │ conversion │
 │ API        │ │            │  │ API        │ │ uploads    │
 └────────────┘ └────────────┘  └────────────┘ └────────────┘
```

- **Platform adapters.** Each ad platform implements one shared interface (`createCampaign`, `getInsights`, `sendConversion`). Adding a new platform, such as TikTok or Microsoft Ads, means writing one new adapter.
- **Mock mode.** Real Meta and Google API access needs app review and developer tokens. For the hackathon, each adapter has a mock version that returns realistic IDs and generated performance data. The full flow works end to end without live credentials.

### Tech stack

- **Next.js 16** (App Router), **React 19**, and **TypeScript**
- **Tailwind CSS v4** and **shadcn/ui** for the UI
- **react-hook-form** and **zod** for the onboarding forms and validation
- Next.js API routes for the campaign, conversion, and insights services

## Hackathon scope

**Must have (demo)**

- [ ] Guided onboarding flow with validation
- [ ] Brief-to-campaign generation for Meta and Google, with a review screen
- [ ] Mock platform adapters with realistic responses
- [ ] Conversion feed: tracking snippet, a test event endpoint, and CSV upload
- [ ] Insights dashboard with cross-platform totals and a per-platform comparison

**Nice to have**

- [ ] AI-generated ad copy and keywords from the business description
- [ ] Budget-shift recommendations with one-click apply
- [ ] Live connection to Meta and Google sandbox or test accounts
- [ ] More platforms (TikTok, Microsoft Ads)

## Demo script

1. A bakery owner opens AdPilot and answers the onboarding questions in under two minutes.
2. AdPilot shows a plain-language plan for Meta and Google. The owner approves it.
3. The owner copies the tracking snippet, and a test "order placed" event appears in the conversion feed.
4. The insights dashboard shows a week of results, and AdPilot recommends moving budget to the better-performing platform.

## Getting started

Requires Node.js 20.18.1 or later. Node 20.12 works, but the shadcn CLI prints warnings.

```bash
npm install
npm run dev
```

Open http://localhost:3000.
