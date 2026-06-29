export const AUTH_BRANDING = {
  logoUrl: "/jitdhana-logo.png",
  logoAlt: "JITDHANA Co., LTD",
  backgroundImageUrl: "/jitdhana-building.jpg",
  footerText: "ระบบตัวจับเวลาในไลน์ผลิต",
} as const

/** Blue gradient overlay shared by login and production-timer pages. */
export const BRANDED_PAGE_BG_OVERLAY =
  "linear-gradient(135deg, rgba(8, 28, 72, 0.55) 0%, rgba(15, 45, 110, 0.72) 45%, rgba(20, 60, 140, 0.68) 100%)"

export const brandedPageBackgroundStyle = {
  backgroundImage: `${BRANDED_PAGE_BG_OVERLAY}, url("${AUTH_BRANDING.backgroundImageUrl}")`,
} as const

export const brandedPageBackgroundClassName =
  "min-h-screen bg-cover bg-center bg-no-repeat bg-fixed"
