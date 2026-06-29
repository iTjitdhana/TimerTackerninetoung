import { hash } from "bcryptjs";
import { describe, expect, it } from "vitest";
import { isBcryptHash, verifyPinAgainstPassword } from "./pin-verifier";

describe("isBcryptHash", () => {
  it("detects bcrypt hashes", () => {
    expect(isBcryptHash("$2b$10$abcdefghijklmnopqrstuu")).toBe(true);
    expect(isBcryptHash("$2a$10$abcdefghijklmnopqrstuu")).toBe(true);
    expect(isBcryptHash("$2y$10$abcdefghijklmnopqrstuu")).toBe(true);
  });

  it("rejects non-bcrypt values", () => {
    expect(isBcryptHash("1234")).toBe(false);
    expect(isBcryptHash("")).toBe(false);
    expect(isBcryptHash("deadbeef")).toBe(false);
  });
});

describe("verifyPinAgainstPassword", () => {
  it("returns true when pin matches bcrypt hash", async () => {
    const password = await hash("1431", 10);
    await expect(verifyPinAgainstPassword("1431", password)).resolves.toBe(true);
  });

  it("returns false when pin does not match", async () => {
    const password = await hash("1431", 10);
    await expect(verifyPinAgainstPassword("9999", password)).resolves.toBe(false);
  });

  it("returns false for missing or invalid password", async () => {
    await expect(verifyPinAgainstPassword("1234", null)).resolves.toBe(false);
    await expect(verifyPinAgainstPassword("1234", undefined)).resolves.toBe(false);
    await expect(verifyPinAgainstPassword("1234", "1234")).resolves.toBe(false);
  });
});
