import { compare, hash } from "bcryptjs";

const PIN_SALT_ROUNDS = 10;

export function isBcryptHash(value: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(value);
}

export async function verifyPinAgainstPassword(
  pin: string,
  password: string | null | undefined,
): Promise<boolean> {
  if (!password || !isBcryptHash(password)) return false;
  return compare(pin, password);
}

export async function hashPin(pin: string): Promise<string> {
  return hash(pin, PIN_SALT_ROUNDS);
}
