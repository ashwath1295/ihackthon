"use client"

import dynamic from "next/dynamic"

// The profile step reads the setup draft from localStorage, so it only renders in the browser.
const ProfileStep = dynamic(() => import("@/components/setup/profile-step"), { ssr: false })

export default function ProfilePage() {
  return <ProfileStep />
}
