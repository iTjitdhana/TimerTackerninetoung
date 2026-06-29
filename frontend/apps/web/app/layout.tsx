import type React from "react"
import type { Metadata, Viewport } from "next"
import { Sarabun } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@/shared/ui/toaster"
import {
  brandedPageBackgroundClassName,
  brandedPageBackgroundStyle,
} from "@/modules/auth/constants/branding"
import { withBasePath } from "@/shared/lib/base-path"
import "./globals.css"

const sarabun = Sarabun({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sarabun",
})

export const viewport: Viewport = {
  themeColor: "#3b82f6",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export const metadata: Metadata = {
  title: "ระบบจับเวลาผลิต",
  description: "ระบบตัวจับเวลาในไลน์ผลิต",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ครัวกลาง",
  },
  icons: {
    icon: [
      {
        url: withBasePath("/icon-light-32x32.png"),
        media: "(prefers-color-scheme: light)",
      },
      {
        url: withBasePath("/icon-dark-32x32.png"),
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: withBasePath("/icon.svg"),
        type: "image/svg+xml",
      },
    ],
    apple: withBasePath("/apple-icon.png"),
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="th">
      <body
        className={`${sarabun.variable} font-sans antialiased ${brandedPageBackgroundClassName}`}
        style={brandedPageBackgroundStyle}
      >
        {children}
        <Toaster />
<Analytics />
      </body>
    </html>
  )
}
