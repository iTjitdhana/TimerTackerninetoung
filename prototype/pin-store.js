const REGISTERED_PINS_KEY = "portal-employee-pins";

// รหัสพนักงานและ Role กำหนดไว้ล่วงหน้าโดยองค์กร
const EMPLOYEE_ROSTER = [
  { employeeId: "EMP001", name: "สมชาย ใจดี", role: "admin" },
  { employeeId: "EMP002", name: "สมหญิง รักงาน", role: "manager" },
  { employeeId: "EMP003", name: "สมศักดิ์ มั่นคง", role: "staff" },
  { employeeId: "EMP004", name: "วิไล สุขใจ", role: "staff" },
];

function normalizeEmployeeId(employeeId) {
  return employeeId.trim().toUpperCase();
}

function getRegisteredPins() {
  try {
    return JSON.parse(localStorage.getItem(REGISTERED_PINS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveRegisteredPins(pins) {
  localStorage.setItem(REGISTERED_PINS_KEY, JSON.stringify(pins));
}

function findEmployeeInRoster(employeeId) {
  const normalized = normalizeEmployeeId(employeeId);
  return EMPLOYEE_ROSTER.find((emp) => emp.employeeId === normalized) || null;
}

function hasRegisteredPin(employeeId) {
  const pins = getRegisteredPins();
  return Boolean(pins[normalizeEmployeeId(employeeId)]);
}

function isPinTaken(pin, excludeEmployeeId = null) {
  const pins = getRegisteredPins();
  const exclude = excludeEmployeeId ? normalizeEmployeeId(excludeEmployeeId) : null;

  return Object.entries(pins).some(
    ([employeeId, registeredPin]) =>
      registeredPin === pin && employeeId !== exclude
  );
}

function registerEmployeePin(employeeId, pin) {
  const normalized = normalizeEmployeeId(employeeId);
  const pins = getRegisteredPins();
  pins[normalized] = pin;
  saveRegisteredPins(pins);
}

function findUserByPin(pin) {
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

// Demo: ลงทะเบียน EMP001 ไว้ล่วงหน้า (PIN 1234) ถ้ายังไม่มี
(function seedDemoPin() {
  const pins = getRegisteredPins();
  if (!pins.EMP001) {
    pins.EMP001 = "1234";
    saveRegisteredPins(pins);
  }
})();
