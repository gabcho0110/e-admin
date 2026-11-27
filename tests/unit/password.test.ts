import { describe, expect, it } from "vitest";

import { hashPassword, sha256, signPayload, verifyPassword, verifyPayload } from "@/lib/auth/password";

describe("пароли", () => {
  it("хешира и проверява парола", () => {
    const hash = hashPassword("СилнаПарола1");
    expect(hash.startsWith("scrypt$16384$")).toBe(true);
    expect(verifyPassword("СилнаПарола1", hash)).toBe(true);
    expect(verifyPassword("силнапарола1", hash)).toBe(false);
    expect(verifyPassword("СилнаПарола2", hash)).toBe(false);
  });

  it("дава различен хеш при еднаква парола (уникална сол)", () => {
    const a = hashPassword("Парола123");
    const b = hashPassword("Парола123");
    expect(a).not.toBe(b);
    expect(verifyPassword("Парола123", a)).toBe(true);
    expect(verifyPassword("Парола123", b)).toBe(true);
  });

  it("не приема празен или невалиден хеш", () => {
    expect(verifyPassword("каквото", null)).toBe(false);
    expect(verifyPassword("каквото", "")).toBe(false);
    expect(verifyPassword("каквото", "plain-text")).toBe(false);
    expect(verifyPassword("каквото", "bcrypt$10$abc$def")).toBe(false);
  });

  it("sha256 е стабилен и различен за различни входове", () => {
    expect(sha256("тест")).toBe(sha256("тест"));
    expect(sha256("тест")).not.toBe(sha256("Тест"));
    expect(sha256("тест")).toHaveLength(64);
  });
});

describe("подписани токени", () => {
  const secret = "test-secret-123";

  it("подписва и валидира полезен товар", () => {
    const token = signPayload({ uid: "abc" }, secret, 60);
    const parsed = verifyPayload<{ uid: string }>(token, secret);
    expect(parsed?.uid).toBe("abc");
  });

  it("отхвърля подправен подпис", () => {
    const token = signPayload({ uid: "abc" }, secret, 60);
    expect(verifyPayload(token, "друг-secret")).toBeNull();
    expect(verifyPayload(`${token}x`, secret)).toBeNull();
    expect(verifyPayload(undefined, secret)).toBeNull();
  });

  it("отхвърля изтекъл токен", () => {
    const token = signPayload({ uid: "abc" }, secret, -10);
    expect(verifyPayload(token, secret)).toBeNull();
  });
});
