import type { AuthenticatedUser } from "@jitdhana/pin-login"

export const DEMO_PINS: Record<string, AuthenticatedUser> = {
  "1234": { employeeId: "EMP001", name: "ภา", role: "operator" },
  "5678": { employeeId: "EMP002", name: "สาม", role: "weighing_staff" },
  "9999": { employeeId: "EMP003", name: "เอ", role: "manager" },
}

export function verifyDemoPin(pin: string): AuthenticatedUser | null {
  return DEMO_PINS[pin] ?? null
}
