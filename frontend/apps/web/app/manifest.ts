import type { MetadataRoute } from "next"
import { withBasePath } from "@/shared/lib/base-path"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ระบบควบคุมการผลิต",
    short_name: "ครัวกลาง",
    description: "ระบบตัวจับเวลาในไลน์ผลิต",
    start_url: withBasePath("/"),
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#3b82f6",
    lang: "th",
    icons: [
      {
        src: withBasePath("/icons/icon-192.png"),
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: withBasePath("/icons/icon-512.png"),
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: withBasePath("/icons/icon-maskable-192.png"),
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: withBasePath("/icon.svg"),
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
    shortcuts: [
      {
        name: "แดชบอร์ด",
        url: withBasePath("/"),
        icons: [{ src: withBasePath("/icons/icon-192.png"), sizes: "192x192" }],
      },
    ],
  }
}
