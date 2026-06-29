import withPWA from "@ducanh2912/next-pwa"

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ""

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath,
  transpilePackages: ["@jitdhana/pin-login"],
  turbopack: {},
  images: {
    unoptimized: true,
  },
  // LAN (.139) และ WiFi (.138) ใช้ IP คนละตัว — ต้อง allow ทั้งคู่ใน dev mode
  allowedDevOrigins: ["127.0.0.1", "192.168.0.138", "192.168.0.139"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:3001/api/:path*",
      },
    ]
  },
}

export default withPWA({
  dest: "public",
  cacheOnFrontEndNav: true,
  disable: process.env.NODE_ENV === "development",
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: /\/api\/.*\/stream$/,
        handler: "NetworkOnly",
      },
    ],
  },
})(nextConfig)
