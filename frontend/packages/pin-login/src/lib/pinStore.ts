import type { AuthenticatedUser, Employee } from "../types";

export const REGISTERED_PINS_KEY = "portal-employee-pins";

export const EMPLOYEE_ROSTER: Employee[] = [
  { employeeId: "EMP001", name: "สมชาย ใจดี", role: "admin" },
  { employeeId: "EMP002", name: "สมหญิง รักงาน", role: "manager" },
  { employeeId: "EMP003", name: "สมศักดิ์ มั่นคง", role: "staff" },
  { employeeId: "EMP004", name: "วิไล สุขใจ", role: "staff" },
];

export function normalizeEmployeeId(employeeId: string): string {
  return employeeId.trim().toUpperCase();
}

function getRegisteredPins(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(REGISTERED_PINS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveRegisteredPins(pins: Record<string, string>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(REGISTERED_PINS_KEY, JSON.stringify(pins));
}

export function findEmployeeInRoster(employeeId: string): Employee | null {
  const normalized = normalizeEmployeeId(employeeId);
  return EMPLOYEE_ROSTER.find((emp) => emp.employeeId === normalized) ?? null;
}

export function hasRegisteredPin(employeeId: string): boolean {
  const pins = getRegisteredPins();
  return Boolean(pins[normalizeEmployeeId(employeeId)]);
}

export function isPinTaken(pin: string, excludeEmployeeId?: string): boolean {
  const pins = getRegisteredPins();
  const exclude = excludeEmployeeId
    ? normalizeEmployeeId(excludeEmployeeId)
    : null;

  return Object.entries(pins).some(
    ([employeeId, registeredPin]) =>
      registeredPin === pin && employeeId !== exclude
  );
}

export function registerEmployeePin(employeeId: string, pin: string): void {
  const normalized = normalizeEmployeeId(employeeId);
  const pins = getRegisteredPins();
  pins[normalized] = pin;
  saveRegisteredPins(pins);
}

export function findUserByPin(pin: string): AuthenticatedUser | null {
  const pins = getRegisteredPins();
  const employeeId = Object.keys(pins).find((id) => pins[id] === pin);
  if (!employeeId) return null;

  const employee = findEmployeeInRoster(employeeId);
  if (!employee) return null;

  return {
    employeeId: employee.employeeId,
    name: employee.name,
    role: employee.role,
  };
}

/** Demo: seed EMP001 with PIN 1234 */
export function seedDemoPin(): void {
  const pins = getRegisteredPins();
  if (!pins.EMP001) {
    pins.EMP001 = "1234";
    saveRegisteredPins(pins);
  }
}

export async function demoLogin(pin: string): Promise<AuthenticatedUser | null> {
  seedDemoPin();
  await new Promise((r) => setTimeout(r, 900));
  return findUserByPin(pin);
}

export async function demoRegister(
  employeeId: string,
  pin: string
): Promise<void> {
  seedDemoPin();
  await new Promise((r) => setTimeout(r, 900));
  registerEmployeePin(employeeId, pin);
}
