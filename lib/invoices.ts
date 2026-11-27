import type { InvoiceRow, InvoiceType } from "@/lib/types";

/**
 * Помощни функции за модул „Фактури“.
 *
 * Чисти функции без сървърни зависимости — използват се и от сървърните
 * страници, и от клиентския редактор на редове, за да смятат еднакво.
 */

/** Закръгляване до стотинка (избягва 0.1 + 0.2 проблемите на float). */
export function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Превръща текст/число в число; невалидното става 0. */
export function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const normalized = value.replace(/\s/g, "").replace(",", ".");
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export interface LineInput {
  quantity: number | string;
  unit_price: number | string;
  vat_rate: number | string;
}

export interface LineTotals {
  subtotal: number;
  vat: number;
  total: number;
}

/** Данъчна основа, ДДС и обща стойност за един ред. */
export function computeLine(line: LineInput): LineTotals {
  const subtotal = round2(toNumber(line.quantity) * toNumber(line.unit_price));
  const vat = round2((subtotal * toNumber(line.vat_rate)) / 100);
  return { subtotal, vat, total: round2(subtotal + vat) };
}

export interface InvoiceTotals {
  subtotal: number;
  vat: number;
  total: number;
  /** Разбивка по ставки — за печатния изглед (чл. 114 от ЗДДС). */
  byRate: Array<{ rate: number; base: number; vat: number }>;
}

export function computeTotals(lines: LineInput[]): InvoiceTotals {
  const buckets = new Map<number, { base: number; vat: number }>();
  let subtotal = 0;
  let vat = 0;

  for (const line of lines) {
    const computed = computeLine(line);
    subtotal = round2(subtotal + computed.subtotal);
    vat = round2(vat + computed.vat);
    const rate = toNumber(line.vat_rate);
    const bucket = buckets.get(rate) ?? { base: 0, vat: 0 };
    bucket.base = round2(bucket.base + computed.subtotal);
    bucket.vat = round2(bucket.vat + computed.vat);
    buckets.set(rate, bucket);
  }

  return {
    subtotal,
    vat,
    total: round2(subtotal + vat),
    byRate: [...buckets.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([rate, value]) => ({ rate, base: value.base, vat: value.vat })),
  };
}

const CURRENCY_SYMBOL: Record<string, string> = { EUR: "€", BGN: "лв." };

/** 1 234,56 € — формат за интерфейса и за печат. */
export function formatMoney(amount: number | null | undefined, currency = "EUR"): string {
  const value = round2(toNumber(amount));
  const formatted = new Intl.NumberFormat("bg-BG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return `${formatted} ${CURRENCY_SYMBOL[currency] ?? currency}`;
}

/** 12,5 — количество без излишни нули. */
export function formatQuantity(value: number | null | undefined): string {
  return new Intl.NumberFormat("bg-BG", { maximumFractionDigits: 3 }).format(toNumber(value));
}

/** Заглавие на документа за печат (главни букви). */
export const INVOICE_TITLE: Record<InvoiceType, string> = {
  invoice: "ФАКТУРА",
  proforma: "ПРОФОРМА ФАКТУРА",
  debit_note: "ДЕБИТНО ИЗВЕСТИЕ",
  credit_note: "КРЕДИТНО ИЗВЕСТИЕ",
  storno: "СТОРНО",
};

/** Пояснение под заглавието — за документите, които не са данъчни. */
export const INVOICE_LEGAL_NOTE: Partial<Record<InvoiceType, string>> = {
  proforma:
    "Проформа фактурата не е данъчен документ по смисъла на ЗДДС и не поражда данъчни задължения.",
  storno: "Документът анулира изцяло първичния документ, към който се отнася.",
};

/**
 * Вземане ли е документът.
 *
 * Кредитното известие и сторното коригират вече издаден документ — те не
 * създават дълг за получателя, затова не влизат в „неплатени“ и „просрочени“
 * и не се отбелязват като платени.
 */
export function isReceivable(invoice: { doc_type?: InvoiceType }): boolean {
  return invoice.doc_type !== "credit_note" && invoice.doc_type !== "storno";
}

/** Просрочена = издадена, неплатена и падежът е минал. */
export function isOverdue(
  invoice: Pick<InvoiceRow, "status" | "due_date"> & { doc_type?: InvoiceType },
): boolean {
  if (invoice.status !== "issued" || !invoice.due_date || !isReceivable(invoice)) return false;
  const due = new Date(`${invoice.due_date}T23:59:59`);
  return !Number.isNaN(due.getTime()) && due.getTime() < Date.now();
}

/** Колко дни остават до падежа (отрицателно = просрочие). */
export function daysToDue(invoice: Pick<InvoiceRow, "due_date">): number | null {
  if (!invoice.due_date) return null;
  const due = new Date(`${invoice.due_date}T23:59:59`);
  if (Number.isNaN(due.getTime())) return null;
  return Math.ceil((due.getTime() - Date.now()) / 86_400_000);
}

/** Неплатена сума по документ (0 за чернови, анулирани и корекции). */
export function outstanding(
  invoice: Pick<InvoiceRow, "status" | "total" | "paid_amount"> & { doc_type?: InvoiceType },
): number {
  if (invoice.status === "cancelled" || invoice.status === "draft") return 0;
  if (!isReceivable(invoice)) return 0;
  return Math.max(0, round2(toNumber(invoice.total) - toNumber(invoice.paid_amount)));
}

/** Дата във формат ГГГГ-ММ-ДД (за input type="date"). */
export function isoDate(value: Date = new Date()): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Добавя дни към дата и връща ГГГГ-ММ-ДД. */
export function addDays(date: string, days: number): string {
  const base = new Date(`${date}T12:00:00`);
  if (Number.isNaN(base.getTime())) return date;
  base.setDate(base.getDate() + days);
  return isoDate(base);
}

/** Година на издаване (за групиране в справки). */
export function invoiceYear(invoice: Pick<InvoiceRow, "issue_date">): string {
  return String(invoice.issue_date || "").slice(0, 4);
}

/* ─────────────────── Сума словом (за печатния вид) ─────────────────── */

const WORDS_UNITS = ["нула", "едно", "две", "три", "четири", "пет", "шест", "седем", "осем", "девет"];
const WORDS_TEENS = [
  "десет",
  "единадесет",
  "дванадесет",
  "тринадесет",
  "четиринадесет",
  "петнадесет",
  "шестнадесет",
  "седемнадесет",
  "осемнадесет",
  "деветнадесет",
];
const WORDS_TENS = [
  "",
  "",
  "двадесет",
  "тридесет",
  "четиридесет",
  "петдесет",
  "шестдесет",
  "седемдесет",
  "осемдесет",
  "деветдесет",
];
const WORDS_HUNDREDS = [
  "",
  "сто",
  "двеста",
  "триста",
  "четиристотин",
  "петстотин",
  "шестстотин",
  "седемстотин",
  "осемстотин",
  "деветстотин",
];

/** Числа 1–999 словом. */
function triadToWords(value: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  if (hundreds) parts.push(WORDS_HUNDREDS[hundreds]);
  if (rest >= 20) {
    parts.push(WORDS_TENS[Math.floor(rest / 10)]);
    // „двадесет и едно“ — съюзът „и“ пред последната единица е правило в
    // българските финансови документи.
    if (rest % 10) parts.push("и", WORDS_UNITS[rest % 10]);
  } else if (rest >= 10) {
    parts.push(WORDS_TEENS[rest - 10]);
  } else if (rest > 0) {
    parts.push(WORDS_UNITS[rest]);
  }
  return parts.join(" ");
}

function integerToWords(value: number): string {
  if (value === 0) return "нула";
  const groups: string[] = [];
  const millions = Math.floor(value / 1_000_000);
  const thousands = Math.floor((value % 1_000_000) / 1000);
  const rest = value % 1000;

  if (millions) {
    groups.push(millions === 1 ? "един милион" : `${triadToWords(millions)} милиона`);
  }
  if (thousands) {
    groups.push(thousands === 1 ? "хиляда" : `${triadToWords(thousands)} хиляди`);
  }
  if (rest) groups.push(triadToWords(rest));
  return groups.join(" ");
}

/** „Хиляда двеста лева и 50 стотинки“ — за печатния документ. */
export function amountInWords(amount: number | null | undefined, currency = "EUR"): string {
  const value = round2(toNumber(amount));
  const whole = Math.floor(value);
  const cents = Math.round((value - whole) * 100);

  const wholeWord = currency === "BGN" ? "лева" : "евро";
  const wholeWordOne = currency === "BGN" ? "лев" : "евро";
  const useSingular = whole % 10 === 1 && whole % 100 !== 11;
  const centsWord = cents === 1 ? "стотинка" : "стотинки";

  const words = integerToWords(whole);
  const capitalized = words.charAt(0).toUpperCase() + words.slice(1);
  return `${capitalized} ${useSingular ? wholeWordOne : wholeWord} и ${String(cents).padStart(2, "0")} ${centsWord}`;
}
