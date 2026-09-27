import { isDemoBusiness } from "@/lib/demo"
import type { BusinessDetails, BusinessProfile, CampaignSuggestion } from "@/lib/setup"

// Stand-in for AdPilot's campaign recommendation: a starting budget, an automatic split between
// platforms, and the conversion source that fits how the business sells.

const inStoreCategories = new Set(["restaurant", "retail", "beauty", "health"])

export function suggestCampaign(
  business: BusinessDetails,
  profile: BusinessProfile,
): CampaignSuggestion {
  if (isDemoBusiness(business)) {
    return {
      campaign: {
        platforms: ["meta", "google"],
        budget: { monthly: 600, splitMode: "auto", metaShare: 60 },
        conversionSources: ["qr"],
      },
      splitReasons: {
        meta: "Your photo ads reach SoMa office workers and Caltrain commuters as they scroll.",
        google: "You show up when people nearby search for coffee or look you up on Maps.",
      },
    }
  }

  const audience = profile.audience.keywords.slice(0, 2).join(" and ") || "your customers"
  return {
    campaign: {
      platforms: ["meta", "google"],
      budget: { monthly: 500, splitMode: "auto", metaShare: 50 },
      conversionSources: [inStoreCategories.has(business.category) ? "qr" : "website"],
    },
    splitReasons: {
      meta: `Your ads reach ${audience} as they scroll Facebook and Instagram.`,
      google: "You show up when people nearby search for what you sell.",
    },
  }
}
