import { AuthLoginPage } from "@/modules/auth"

export const dynamic = "force-dynamic"

export default function RegisterPage() {
  return <AuthLoginPage mode="register" />
}
