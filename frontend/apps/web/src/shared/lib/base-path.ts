export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "")

export function withBasePath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`
  return `${BASE_PATH}${normalized}` || "/"
}

/** ใช้หลัง login — บังคับ trailing slash ที่ root เพื่อให้ nginx match location /production/ */
export function appPathForNavigation(path: string): string {
  const resolved = withBasePath(path)
  if (path === "/" && BASE_PATH) {
    return `${BASE_PATH}/`
  }
  return resolved
}
