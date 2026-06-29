import { AuthLoginPage } from "@/modules/auth"

export const dynamic = "force-dynamic"

export default function LoginPage() {
  return <AuthLoginPage mode="login" />
}
