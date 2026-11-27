import { describe, expect, it } from "vitest";

import {
  addDays,
  amountInWords,
  computeLine,
  computeTotals,
  formatMoney,
  isOverdue,
  isReceivable,
  isoDate,
  outstanding,
  round2,
  toNumber,
} from "@/lib/invoices";
import { ROLE_MAP } from "@/lib/permissions/roles";

describe("парични изчисления", () => {
  it("закръглява до стотинка", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(2.345)).toBe(2.35);
    expect(round2(1.005)).toBe(1.01);
    expect(round2(Number.NaN)).toBe(0);
  });

  it("чете числа с десетична запетая", () => {
    expect(toNumber("12,50")).toBe(12.5);
    expect(toNumber("1 234,40")).toBe(1234.4);
    expect(toNumber("")).toBe(0);
    expect(toNumber("abc")).toBe(0);
  });

  it("изчислява ред с 20% ДДС", () => {
    const line = computeLine({ quantity: 2, unit_price: 50, vat_rate: 20 });
    expect(line).toEqual({ subtotal: 100, vat: 20, total: 120 });
  });

  it("изчислява ред с нулева ставка", () => {
    const line = computeLine({ quantity: 3, unit_price: 33.33, vat_rate: 0 });
    expect(line.subtotal).toBe(99.99);
    expect(line.vat).toBe(0);
    expect(line.total).toBe(99.99);
  });

  it("сумира редове с различни ставки и прави разбивка", () => {
    const totals = computeTotals([
      { quantity: 1, unit_price: 100, vat_rate: 20 },
      { quantity: 2, unit_price: 50, vat_rate: 9 },
      { quantity: 1, unit_price: 10, vat_rate: 0 },
    ]);
    expect(totals.subtotal).toBe(210);
    expect(totals.vat).toBe(29);
    expect(totals.total).toBe(239);
    expect(totals.byRate).toEqual([
      { rate: 20, base: 100, vat: 20 },
      { rate: 9, base: 100, vat: 9 },
      { rate: 0, base: 10, vat: 0 },
    ]);
  });

  it("не трупа грешка при много дробни редове", () => {
    const totals = computeTotals(
      Array.from({ length: 10 }, () => ({ quantity: 1, unit_price: 0.1, vat_rate: 20 })),
    );
    expect(totals.subtotal).toBe(1);
    expect(totals.vat).toBe(0.2);
    expect(totals.total).toBe(1.2);
  });
});

describe("форматиране", () => {
  it("показва сумата с валута", () => {
    expect(formatMoney(1234.5, "EUR")).toMatch(/1\s?234,50\s?€/);
    expect(formatMoney(0, "BGN")).toMatch(/0,00\s?лв\./);
  });

  it("изписва сумата словом", () => {
    expect(amountInWords(1200.5, "EUR")).toBe("Хиляда двеста евро и 50 стотинки");
    expect(amountInWords(1, "BGN")).toBe("Едно лев и 00 стотинки");
    expect(amountInWords(21, "BGN")).toBe("Двадесет и едно лев и 00 стотинки");
    expect(amountInWords(0.05, "EUR")).toBe("Нула евро и 05 стотинки");
  });
});

describe("състояние на документа", () => {
  const base = { status: "issued" as const, due_date: "2020-01-01" };

  it("просрочена е само издадена с минал падеж", () => {
    expect(isOverdue(base)).toBe(true);
    expect(isOverdue({ ...base, status: "paid" })).toBe(false);
    expect(isOverdue({ ...base, status: "draft" })).toBe(false);
    expect(isOverdue({ ...base, due_date: null })).toBe(false);
    expect(isOverdue({ ...base, due_date: "2999-01-01" })).toBe(false);
  });

  it("изчислява остатъка за плащане", () => {
    expect(outstanding({ status: "issued", total: 120, paid_amount: 20 })).toBe(100);
    expect(outstanding({ status: "paid", total: 120, paid_amount: 120 })).toBe(0);
    expect(outstanding({ status: "cancelled", total: 120, paid_amount: 0 })).toBe(0);
    expect(outstanding({ status: "draft", total: 120, paid_amount: 0 })).toBe(0);
  });

  it("кредитното известие и сторното не са вземания", () => {
    expect(isReceivable({ doc_type: "invoice" })).toBe(true);
    expect(isReceivable({ doc_type: "proforma" })).toBe(true);
    expect(isReceivable({ doc_type: "debit_note" })).toBe(true);
    expect(isReceivable({ doc_type: "credit_note" })).toBe(false);
    expect(isReceivable({ doc_type: "storno" })).toBe(false);
    // не създават дълг и не излизат като просрочени
    expect(outstanding({ doc_type: "credit_note", status: "issued", total: 414.5, paid_amount: 0 })).toBe(0);
    expect(outstanding({ doc_type: "storno", status: "issued", total: 100, paid_amount: 0 })).toBe(0);
    expect(isOverdue({ doc_type: "credit_note", status: "issued", due_date: "2000-01-01" })).toBe(false);
  });

  it("работи с дати", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(isoDate(new Date("2026-03-05T10:00:00"))).toBe("2026-03-05");
  });
});

describe("права за фактури", () => {
  it("само ръководните роли издават фактури", () => {
    const withInvoices = Object.values(ROLE_MAP)
      .filter((role) => role.permissions.includes("invoices.manage"))
      .map((role) => role.key)
      .sort();
    expect(withInvoices).toEqual(["deputy_director", "director", "superadmin"]);
  });

  it("преподавател и ИКТ нямат достъп до фактури", () => {
    expect(ROLE_MAP.teacher.permissions).not.toContain("invoices.view");
    expect(ROLE_MAP.ict_officer.permissions).not.toContain("invoices.view");
  });
});
