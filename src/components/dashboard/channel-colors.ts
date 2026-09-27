import type { ChannelId } from "@/lib/dashboard-data"

// Tailwind classes backed by the validated --channel-* colors in globals.css.
export const channelBg: Record<ChannelId, string> = {
  youtube: "bg-channel-youtube",
  facebook: "bg-channel-facebook",
  instagram: "bg-channel-instagram",
}

export const channelStroke: Record<ChannelId, string> = {
  youtube: "var(--channel-youtube)",
  facebook: "var(--channel-facebook)",
  instagram: "var(--channel-instagram)",
}
