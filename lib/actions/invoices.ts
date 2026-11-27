"use server";

import { revalidatePath } from "next/cache";

import { backWithError, backWithOk, guard, text } from "@/lib/actions/helpers";
import { audit } from "@/lib/audit";
import { deleteRow, getRow, getSettings, insertRow, listRows, updateRow } from "@/lib/db";
import { computeLine, computeTotals, formatMoney, toNumber } from "@/lib/invoices";
import { INVOICE_TYPE } from "@/lib/labels";
import { nextInvoiceNumber } from "@/lib/numbering";
import type {
  InvoiceClientRow,
  InvoiceItemRow,
  InvoiceRow,
  InvoiceType,
  PaymentMethod,
} from "@/lib/types";
import { fieldErrors, invoiceClientSchema, invoiceSchema } from "@/lib/validation/schemas";

const BASE = "/dashboard/invoices";
const CLIENTS = `${BASE}/clients`;

/**
 * Модул „Фактури“.
 *
 * Жизнен цикъл на документа:
 *   чернова → издадена → платена
 *                 ↘ анулирана (или кредитно известие / сторно)
 *
 * Черновата може да се редактира и трие; издаденият документ е заключен, за да
 * се пази последователността на номерата и данъчната отчетност. Корекции се
 * правят с кредитно известие или сторно, които сочат към първичния документ.
 */

/** Чете редовете на фактурата от формуляра (по едноименни полета). */
function readItems(formData: FormData) {
  const names = formData.getAll("item_name").map(String);
  const units = formData.getAll("item_unit").map(String);
  const quantities = formData.getAll("item_quantity").map(String);
  const prices = formData.getAll("item_unit_price").map(String);
  const rates = formData.getAll("item_vat_rate").map(String);

  const items: Array<{
    name: string;
    unit: string;
    quantity: string;
    unit_price: string;
    vat_rate: string;
  }> = [];

  for (let index = 0; index < names.length; index += 1) {
    const name = (names[index] || "").trim();
    if (!name) continue; // напълно празните редове се прескачат
    items.push({
      name,
      unit: (units[index] || "бр.").trim(),
      // десетичната запетая се приема като точка (български клавиатури)
      quantity: (quantities[index] || "0").replace(",", ".").trim(),
      unit_price: (prices[index] || "0").replace(",", ".").trim(),
      vat_rate: (rates[index] || "20").replace(",", ".").trim(),
    });
  }
  return items;
}

/** Данни за издателя — „снимка“ от настройките към момента на издаване. */
async function supplierSnapshot() {
  const settings = await getSettings();
  return {
    supplier_name:
      settings.invoice_supplier_name ||
      settings.institution_name ||
      "ПИГ „Св. Климент Охридски“",
    supplier_eik: settings.invoice_supplier_eik || null,
    supplier_vat: settings.invoice_supplier_vat || null,
    supplier_address: settings.invoice_supplier_address || settings.institution_address || null,
    supplier_iban: settings.invoice_supplier_iban || null,
    supplier_bank: settings.invoice_supplier_bank || null,
    supplier_mol: settings.invoice_supplier_mol || settings.institution_director || null,
  };
}

/** Замества редовете на фактура (използва се при чернова). */
async function replaceItems(invoiceId: string, rows: ReturnType<typeof readItems>, fallbackRate: number) {
  const existing = await listRows<InvoiceItemRow>("invoice_items", { where: { invoice_id: invoiceId } });
  for (const row of existing) await deleteRow("invoice_items", row.id);

  let position = 1;
  for (const row of rows) {
    const rate = Number(row.vat_rate);
    const line = computeLine({
      quantity: toNumber(row.quantity),
      unit_price: toNumber(row.unit_price),
      vat_rate: Number.isFinite(rate) ? rate : fallbackRate,
    });
    await insertRow<InvoiceItemRow>("invoice_items", {
      invoice_id: invoiceId,
      position,
      name: row.name,
      unit: row.unit,
      quantity: toNumber(row.quantity),
      unit_price: toNumber(row.unit_price),
      vat_rate: Number.isFinite(rate) ? rate : fallbackRate,
      line_subtotal: line.subtotal,
      line_vat: line.vat,
      line_total: line.total,
    });
    position += 1;
  }
}

function parseForm(formData: FormData) {
  return invoiceSchema.safeParse({
    doc_type: text(formData, "doc_type"),
    client_id: text(formData, "client_id"),
    client_name: text(formData, "client_name"),
    client_eik: text(formData, "client_eik"),
    client_vat: text(formData, "client_vat"),
    client_mol: text(formData, "client_mol"),
    client_address: text(formData, "client_address"),
    client_city: text(formData, "client_city"),
    client_country: text(formData, "client_country"),
    client_email: text(formData, "client_email"),
    issue_date: text(formData, "issue_date"),
    due_date: text(formData, "due_date"),
    currency: text(formData, "currency") || "EUR",
    payment_method: text(formData, "payment_method") || "bank",
    basis: text(formData, "basis"),
    note: text(formData, "note"),
    related_invoice_id: text(formData, "related_invoice_id"),
    items: readItems(formData),
  });
}

/** Създава документ (чернова или директно издаден). */
export async function createInvoiceAction(formData: FormData): Promise<void> {
  const user = await guard("invoices.manage");
  const intent = text(formData, "intent");
  const parsed = parseForm(formData);

  if (!parsed.success) {
    backWithError(`${BASE}/new`, Object.values(fieldErrors(parsed.error))[0]);
  }

  const data = parsed.data;
  const docType = data.doc_type as InvoiceType;
  const number = await nextInvoiceNumber(docType);
  const totals = computeTotals(data.items);
  const supplier = await supplierSnapshot();
  const issueNow = intent === "issue";

  const invoice = await insertRow<InvoiceRow>("invoices", {
    number,
    doc_type: docType,
    status: issueNow ? "issued" : "draft",
    issue_date: data.issue_date,
    due_date: data.due_date || null,
    client_id: data.client_id,
    client_name: data.client_name,
    client_eik: data.client_eik || null,
    client_vat: data.client_vat || null,
    client_mol: data.client_mol || null,
    client_address: data.client_address || null,
    client_city: data.client_city || null,
    client_country: data.client_country || "България",
    client_email: data.client_email || null,
    ...supplier,
    currency: data.currency,
    vat_rate: data.items[0]?.vat_rate ?? 20,
    subtotal: totals.subtotal,
    vat_amount: totals.vat,
    total: totals.total,
    paid_amount: 0,
    payment_method: data.payment_method as PaymentMethod,
    basis: data.basis || null,
    note: data.note || null,
    related_invoice_id: data.related_invoice_id,
    created_by: user.id,
    issued_at: issueNow ? new Date().toISOString() : null,
    paid_at: null,
    cancelled_at: null,
    cancel_reason: null,
  });

  await replaceItems(invoice.id, readItems(formData), data.items[0]?.vat_rate ?? 20);

  await audit({
    actor: user,
    action: issueNow ? "invoice.issued" : "invoice.created",
    entity: "invoices",
    entityId: invoice.id,
    meta: {
      number,
      type: INVOICE_TYPE[docType].label,
      client: data.client_name,
      total: formatMoney(totals.total, data.currency),
    },
  });

  revalidatePath(BASE);
  backWithOk(
    `${BASE}/${invoice.id}`,
    `${INVOICE_TYPE[docType].label} № ${number} е ${issueNow ? "издадена" : "създадена като чернова"}.`,
  );
}

/** Редакция на чернова (издадените документи са заключени). */
export async function updateInvoiceAction(formData: FormData): Promise<void> {
  const user = await guard("invoices.manage");
  const id = text(formData, "id");
  const intent = text(formData, "intent");
  const invoice = await getRow<InvoiceRow>("invoices", id);
  if (!invoice) backWithError(BASE, "Документът не е намерен.");
  if (invoice.status !== "draft") {
    backWithError(`${BASE}/${id}`, "Издаден документ не се редактира. Издайте кредитно известие или сторно.");
  }

  const parsed = parseForm(formData);
  if (!parsed.success) {
    backWithError(`${BASE}/${id}`, Object.values(fieldErrors(parsed.error))[0]);
  }

  const data = parsed.data;
  const totals = computeTotals(data.items);
  const supplier = await supplierSnapshot();
  const issueNow = intent === "issue";

  await updateRow<InvoiceRow>("invoices", id, {
    doc_type: data.doc_type,
    status: issueNow ? "issued" : "draft",
    issue_date: data.issue_date,
    due_date: data.due_date || null,
    client_id: data.client_id,
    client_name: data.client_name,
    client_eik: data.client_eik || null,
    client_vat: data.client_vat || null,
    client_mol: data.client_mol || null,
    client_address: data.client_address || null,
    client_city: data.client_city || null,
    client_country: data.client_country || "България",
    client_email: data.client_email || null,
    ...supplier,
    currency: data.currency,
    vat_rate: data.items[0]?.vat_rate ?? 20,
    subtotal: totals.subtotal,
    vat_amount: totals.vat,
    total: totals.total,
    payment_method: data.payment_method as PaymentMethod,
    basis: data.basis || null,
    note: data.note || null,
    related_invoice_id: data.related_invoice_id,
    issued_at: issueNow ? new Date().toISOString() : null,
  });

  await replaceItems(id, readItems(formData), data.items[0]?.vat_rate ?? 20);

  await audit({
    actor: user,
    action: issueNow ? "invoice.issued" : "invoice.updated",
    entity: "invoices",
    entityId: id,
    meta: { number: invoice.number, total: formatMoney(totals.total, data.currency) },
  });

  revalidatePath(BASE);
  revalidatePath(`${BASE}/${id}`);
  backWithOk(
    `${BASE}/${id}`,
    issueNow ? `Документ № ${invoice.number} е издаден.` : "Черновата е обновена.",
  );
}

/** Чернова → издадена. */
export async function issueInvoiceAction(formData: FormData): Promise<void> {
  const user = await guard("invoices.manage");
  const id = text(formData, "id");
  const invoice = await getRow<InvoiceRow>("invoices", id);
  if (!invoice) backWithError(BASE, "Документът не е намерен.");
  if (invoice.status !== "draft") backWithError(`${BASE}/${id}`, "Документът вече е издаден.");

  await updateRow<InvoiceRow>("invoices", id, {
    status: "issued",
    issued_at: new Date().toISOString(),
  });

  await audit({
    actor: user,
    action: "invoice.issued",
    entity: "invoices",
    entityId: id,
    meta: { number: invoice.number, total: formatMoney(invoice.total, invoice.currency) },
  });

  revalidatePath(BASE);
  revalidatePath(`${BASE}/${id}`);
  backWithOk(`${BASE}/${id}`, `Документ № ${invoice.number} е издаден.`);
}

/** Отбелязва плащане (изцяло или частично). */
export async function markInvoicePaidAction(formData: FormData): Promise<void> {
  const user = await guard("invoices.manage");
  const id = text(formData, "id");
  const amountRaw = text(formData, "amount");
  const invoice = await getRow<InvoiceRow>("invoices", id);
  if (!invoice) backWithError(BASE, "Документът не е намерен.");
  if (invoice.status === "draft") backWithError(`${BASE}/${id}`, "Черновата не може да бъде платена.");
  if (invoice.status === "cancelled") backWithError(`${BASE}/${id}`, "Анулиран документ не се плаща.");
  if (invoice.status === "paid") backWithError(`${BASE}/${id}`, "Документът вече е платен.");
  if (invoice.doc_type === "credit_note" || invoice.doc_type === "storno") {
    backWithError(
      `${BASE}/${id}`,
      "Кредитното известие и сторното не се плащат — те коригират първичния документ.",
    );
  }

  const parsed = Number((amountRaw || "").replace(",", "."));
  const amount = Number.isFinite(parsed) && parsed > 0 ? parsed : Number(invoice.total);
  const paid = Math.round((Number(invoice.paid_amount || 0) + amount) * 100) / 100;
  const fullyPaid = paid + 0.001 >= Number(invoice.total);

  await updateRow<InvoiceRow>("invoices", id, {
    paid_amount: Math.min(paid, Number(invoice.total)),
    paid_at: fullyPaid ? new Date().toISOString() : null,
    status: fullyPaid ? "paid" : "issued",
  });

  await audit({
    actor: user,
    action: "invoice.paid",
    entity: "invoices",
    entityId: id,
    meta: { number: invoice.number, amount: formatMoney(amount, invoice.currency) },
  });

  revalidatePath(BASE);
  revalidatePath(`${BASE}/${id}`);
  backWithOk(
    `${BASE}/${id}`,
    fullyPaid ? "Плащането е отбелязано — документът е платен." : "Отбелязано е частично плащане.",
  );
}

/** Анулира издаден документ (платен не се анулира — прави се кредитно известие). */
export async function cancelInvoiceAction(formData: FormData): Promise<void> {
  const user = await guard("invoices.manage");
  const id = text(formData, "id");
  const reason = text(formData, "reason");
  const invoice = await getRow<InvoiceRow>("invoices", id);
  if (!invoice) backWithError(BASE, "Документът не е намерен.");
  if (invoice.status === "paid") {
    backWithError(`${BASE}/${id}`, "Платен документ не се анулира — издайте кредитно известие.");
  }
  if (invoice.status === "cancelled") backWithError(`${BASE}/${id}`, "Документът вече е анулиран.");
  if (reason.length < 5) backWithError(`${BASE}/${id}`, "Опишете причината за анулиране.");

  await updateRow<InvoiceRow>("invoices", id, {
    status: "cancelled",
    cancelled_at: new Date().toISOString(),
    cancel_reason: reason,
  });

  await audit({
    actor: user,
    action: "invoice.cancelled",
    entity: "invoices",
    entityId: id,
    meta: { number: invoice.number, reason },
  });

  revalidatePath(BASE);
  revalidatePath(`${BASE}/${id}`);
  backWithOk(`${BASE}/${id}`, `Документ № ${invoice.number} е анулиран.`);
}

/** Изтрива чернова (издадените документи остават в регистъра). */
export async function deleteInvoiceAction(formData: FormData): Promise<void> {
  const user = await guard("invoices.manage");
  const id = text(formData, "id");
  const invoice = await getRow<InvoiceRow>("invoices", id);
  if (!invoice) backWithError(BASE, "Документът не е намерен.");
  if (invoice.status !== "draft") {
    backWithError(`${BASE}/${id}`, "Само чернова може да бъде изтрита. Анулирайте документа вместо това.");
  }

  const items = await listRows<InvoiceItemRow>("invoice_items", { where: { invoice_id: id } });
  for (const item of items) await deleteRow("invoice_items", item.id);
  await deleteRow("invoices", id);

  await audit({
    actor: user,
    action: "invoice.deleted",
    entity: "invoices",
    entityId: id,
    meta: { number: invoice.number },
  });

  revalidatePath(BASE);
  backWithOk(BASE, `Чернова № ${invoice.number} е изтрита.`);
}

/* ─────────────────────────── Контрагенти ─────────────────────────── */

export async function createInvoiceClientAction(formData: FormData): Promise<void> {
  const user = await guard("invoices.manage");
  const parsed = invoiceClientSchema.safeParse({
    name: text(formData, "name"),
    eik: text(formData, "eik"),
    vat_number: text(formData, "vat_number"),
    mol: text(formData, "mol"),
    address: text(formData, "address"),
    city: text(formData, "city"),
    country: text(formData, "country"),
    email: text(formData, "email"),
    phone: text(formData, "phone"),
    note: text(formData, "note"),
  });
  if (!parsed.success) backWithError(CLIENTS, Object.values(fieldErrors(parsed.error))[0]);

  const data = parsed.data;
  const client = await insertRow<InvoiceClientRow>("invoice_clients", {
    name: data.name,
    eik: data.eik || null,
    vat_number: data.vat_number || null,
    mol: data.mol || null,
    address: data.address || null,
    city: data.city || null,
    country: data.country || "България",
    email: data.email || null,
    phone: data.phone || null,
    note: data.note || null,
  });

  await audit({
    actor: user,
    action: "invoice_client.created",
    entity: "invoice_clients",
    entityId: client.id,
    meta: { name: data.name },
  });

  revalidatePath(CLIENTS);
  revalidatePath(`${BASE}/new`);
  backWithOk(CLIENTS, `Контрагентът „${data.name}“ е добавен.`);
}

export async function updateInvoiceClientAction(formData: FormData): Promise<void> {
  const user = await guard("invoices.manage");
  const id = text(formData, "id");
  const existing = await getRow<InvoiceClientRow>("invoice_clients", id);
  if (!existing) backWithError(CLIENTS, "Контрагентът не е намерен.");

  const parsed = invoiceClientSchema.safeParse({
    name: text(formData, "name"),
    eik: text(formData, "eik"),
    vat_number: text(formData, "vat_number"),
    mol: text(formData, "mol"),
    address: text(formData, "address"),
    city: text(formData, "city"),
    country: text(formData, "country"),
    email: text(formData, "email"),
    phone: text(formData, "phone"),
    note: text(formData, "note"),
  });
  if (!parsed.success) backWithError(`${CLIENTS}?edit=${id}`, Object.values(fieldErrors(parsed.error))[0]);

  const data = parsed.data;
  await updateRow<InvoiceClientRow>("invoice_clients", id, {
    name: data.name,
    eik: data.eik || null,
    vat_number: data.vat_number || null,
    mol: data.mol || null,
    address: data.address || null,
    city: data.city || null,
    country: data.country || "България",
    email: data.email || null,
    phone: data.phone || null,
    note: data.note || null,
  });

  await audit({
    actor: user,
    action: "invoice_client.updated",
    entity: "invoice_clients",
    entityId: id,
    meta: { name: data.name },
  });

  revalidatePath(CLIENTS);
  backWithOk(CLIENTS, "Данните на контрагента са обновени.");
}

export async function deleteInvoiceClientAction(formData: FormData): Promise<void> {
  const user = await guard("invoices.manage");
  const id = text(formData, "id");
  const client = await getRow<InvoiceClientRow>("invoice_clients", id);
  if (!client) backWithError(CLIENTS, "Контрагентът не е намерен.");

  const used = await listRows<InvoiceRow>("invoices", { where: { client_id: id } });
  if (used.length > 0) {
    backWithError(
      CLIENTS,
      `Контрагентът има ${used.length} документа в регистъра и не може да бъде изтрит.`,
    );
  }

  await deleteRow("invoice_clients", id);
  await audit({
    actor: user,
    action: "invoice_client.deleted",
    entity: "invoice_clients",
    entityId: id,
    meta: { name: client.name },
  });

  revalidatePath(CLIENTS);
  backWithOk(CLIENTS, `Контрагентът „${client.name}“ е изтрит.`);
}
