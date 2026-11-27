import { describe, expect, it } from "vitest";

import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  hotp,
  otpauthUrl,
  totpCode,
  verifyTotp,
} from "@/lib/auth/totp";

/** RFC 6238, приложение B — тайна "12345678901234567890" в base32. */
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("base32", () => {
  it("кодира и декодира без загуба", () => {
    const raw = Buffer.from("Св. Климент Охридски", "utf8");
    expect(base32Decode(base32Encode(raw)).toString("utf8")).toBe("Св. Климент Охридски");
  });

  it("декодира тайната от RFC 6238", () => {
    expect(base32Decode(RFC_SECRET).toString("ascii")).toBe("12345678901234567890");
  });

  it("генерира тайна с дължина, подходяща за приложенията", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Decode(secret)).toHaveLength(20);
  });
});

describe("HOTP / TOTP", () => {
  it("съвпада с официалните тестови вектори (RFC 4226)", () => {
    expect(hotp(RFC_SECRET, 0)).toBe("755224");
    expect(hotp(RFC_SECRET, 1)).toBe("287082");
    expect(hotp(RFC_SECRET, 2)).toBe("359152");
    expect(hotp(RFC_SECRET, 9)).toBe("520489");
  });

  it("приема кода за текущия момент и за съседна стъпка", () => {
    const now = 1_700_000_000_000;
    const code = totpCode(RFC_SECRET, now);
    expect(verifyTotp(RFC_SECRET, code, now)).toBe(true);
    expect(verifyTotp(RFC_SECRET, code, now + 30_000)).toBe(true);
    expect(verifyTotp(RFC_SECRET, code, now - 30_000)).toBe(true);
    expect(verifyTotp(RFC_SECRET, code, now + 120_000)).toBe(false);
  });

  it("отхвърля невалиден формат", () => {
    expect(verifyTotp(RFC_SECRET, "")).toBe(false);
    expect(verifyTotp(RFC_SECRET, "12345")).toBe(false);
    expect(verifyTotp(RFC_SECRET, "abcdef")).toBe(false);
  });

  it("позволява интервали в кода", () => {
    const now = 1_700_000_000_000;
    const code = totpCode(RFC_SECRET, now);
    expect(verifyTotp(RFC_SECRET, `${code.slice(0, 3)} ${code.slice(3)}`, now)).toBe(true);
  });

  it("генерира валиден otpauth URL", () => {
    const url = otpauthUrl(RFC_SECRET, "ivan@pig-ohridski.bg");
    expect(url.startsWith("otpauth://totp/")).toBe(true);
    expect(url).toContain(`secret=${RFC_SECRET}`);
    expect(url).toContain("digits=6");
    expect(url).toContain("period=30");
  });
});
