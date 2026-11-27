import "server-only";

import { listRows } from "@/lib/db";
import type { ApplicationRow, DocumentRow, InvoiceRow, InvoiceType } from "@/lib/types";

const DOC_PREFIX: Record<string, string> = {
  order: "ЗАП",
  protocol: "ПРОТ",
  report: "ДОК",
  reference: "СПР",
  plan: "ПЛАН",
  program: "ПРОГ",
  incoming: "ВХ",
  outgoing: "ИЗХ",
  policy: "ПРАВ",
};

/** PIG-2026-000123 — последователен номер за кандидатура. */
export async function nextApplicationNumber(prefix = "PIG"): Promise<string> {
  const year = new Date().getFullYear();
  const head = `${prefix}-${year}-`;
  const rows = await listRows<ApplicationRow>("applications");
  const max = rows
    .filter((row) => row.registration_number?.startsWith(head))
    .map((row) => Number.parseInt(row.registration_number.slice(head.length), 10))
    .reduce((acc, value) => (Number.isFinite(value) ? Math.max(acc, value) : acc), 0);
  return `${head}${String(max + 1).padStart(6, "0")}`;
}

/** PIG-ЗАП-2026-0001 — регистрационен номер на документ по вид. */
export async function nextDocumentNumber(docType: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = DOC_PREFIX[docType] || "ДОК";
  const head = `PIG-${prefix}-${year}-`;
  const rows = await listRows<DocumentRow>("documents");
  const max = rows
    .filter((row) => row.number?.startsWith(head))
    .map((row) => Number.parseInt(row.number.slice(head.length), 10))
    .reduce((acc, value) => (Number.isFinite(value) ? Math.max(acc, value) : acc), 0);
  return `${head}${String(max + 1).padStart(4, "0")}`;
}

export function documentPrefix(docType: string): string {
  return DOC_PREFIX[docType] || "ДОК";
}

/**
 * Префикс на номерата в модул „Фактури“.
 * Само фактурите са с чисто цифров номер (както изисква ЗДДС); останалите
 * документи са с буквен префикс, за да не се смесват сериите.
 */
const INVOICE_PREFIX: Record<InvoiceType, string> = {
  invoice: "",
  proforma: "ПРО-",
  debit_note: "ДИ-",
  credit_note: "КИ-",
  storno: "СТ-",
};

/**
 * Следващ номер в серията на съответния вид документ.
 * Серията е непрекъсната (без нулиране на годината) — 10 цифри за фактурите.
 */
export async function nextInvoiceNumber(docType: InvoiceType): Promise<string> {
  const prefix = INVOICE_PREFIX[docType] ?? "";
  const rows = await listRows<InvoiceRow>("invoices", { where: { doc_type: docType } });
  const max = rows
    .map((row) => {
      const value = String(row.number || "");
      if (!value.startsWith(prefix)) return 0;
      const parsed = Number.parseInt(value.slice(prefix.length), 10);
      return Number.isFinite(parsed) ? parsed : 0;
    })
    .reduce((acc, value) => Math.max(acc, value), 0);
  return `${prefix}${String(max + 1).padStart(10, "0")}`;
}

export function invoicePrefix(docType: InvoiceType): string {
  return INVOICE_PREFIX[docType] ?? "";
}
