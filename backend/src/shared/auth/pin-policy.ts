import { BadRequestException } from "@nestjs/common";

const PIN_FORMAT = /^\d{4}$/;

const WEAK_PINS = new Set([
  "0000",
  "1111",
  "2222",
  "3333",
  "4444",
  "5555",
  "6666",
  "7777",
  "8888",
  "9999",
  "1234",
  "4321",
  "0123",
  "1212",
]);

export function assertValidPin(pin: string): void {
  if (!PIN_FORMAT.test(pin)) {
    throw new BadRequestException("PIN ต้องเป็นตัวเลข 4 หลัก");
  }
}

export function assertPinNotWeak(pin: string): void {
  if (WEAK_PINS.has(pin)) {
    throw new BadRequestException("PIN นี้ไม่ปลอดภัย กรุณาเลือก PIN อื่น");
  }
}

export function isWeakPin(pin: string): boolean {
  return WEAK_PINS.has(pin);
}

export function assertPinPolicy(pin: string): void {
  assertValidPin(pin);
  assertPinNotWeak(pin);
}
