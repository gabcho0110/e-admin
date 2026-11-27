import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/auth/session";
import { getRow, getSettings, listRows } from "@/lib/db";
import {
  amountInWords,
  computeTotals,
  formatMoney,
  formatQuantity,
  INVOICE_LEGAL_NOTE,
  INVOICE_TITLE,
  isOverdue,
  isReceivable,
} from "@/lib/invoices";
import { PAYMENT_METHOD } from "@/lib/labels";
import type { InvoiceItemRow, InvoiceRow } from "@/lib/types";
import { formatDate, formatDateShort } from "@/lib/utils";

export const metadata: Metadata = { title: "Фактура" };
export const dynamic = "force-dynamic";

export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("invoices.view");
  const { id } = await params;

  const invoice = await getRow<InvoiceRow>("invoices", id);
  if (!invoice) notFound();

  const items = await listRows<InvoiceItemRow>("invoice_items", {
    where: { invoice_id: id },
    orderBy: "position",
    ascending: true,
  });

  const related = invoice.related_invoice_id
    ? await getRow<InvoiceRow>("invoices", invoice.related_invoice_id)
    : null;

  const settings = await getSettings();
  const footerNote = (settings.invoice_footer_note || "").trim();

  const totals = computeTotals(
    items.map((item) => ({
      quantity: item.quantity,
      unit_price: item.unit_price,
      vat_rate: item.vat_rate,
    })),
  );

  const cancelled = invoice.status === "cancelled";
  const late = isOverdue(invoice);

  return (
    <article className="print-sheet relative mx-auto max-w-[820px] bg-white px-10 py-10 text-[#111] shadow-card print:shadow-none">
      {cancelled ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="-rotate-[24deg] text-[64px] font-bold uppercase tracking-[0.2em] text-[#B42318]/10">
            Анулирана
          </span>
        </div>
      ) : null}

      <header className="flex items-start justify-between gap-8 border-b-2 border-[#17365D] pb-5">
        <div className="min-w-0">
          <div className="text-[9.5px] uppercase tracking-[0.16em] text-[#7A8798]">Доставчик</div>
          <div className="mt-1 font-display text-[15px] font-semibold leading-tight text-[#17365D]">
            {invoice.supplier_name}
          </div>
          <div className="mt-1 space-y-0.5 text-[10.5px] leading-4 text-[#4A5A70]">
            {invoice.supplier_address ? <div>{invoice.supplier_address}</div> : null}
            {invoice.supplier_eik ? <div>ЕИК: {invoice.supplier_eik}</div> : null}
            {invoice.supplier_vat ? <div>ДДС №: {invoice.supplier_vat}</div> : null}
            {invoice.supplier_iban ? <div>IBAN: {invoice.supplier_iban}</div> : null}
            {invoice.supplier_bank ? <div>Банка: {invoice.supplier_bank}</div> : null}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-[9.5px] uppercase tracking-[0.18em] text-[#C5A253]">
            {invoice.doc_type === "invoice" ? "Оригинал" : "Документ"}
          </div>
          <div className="mt-0.5 font-display text-[19px] font-semibold leading-tight text-[#17365D]">
            {INVOICE_TITLE[invoice.doc_type]}
          </div>
          <div className="mt-1 font-mono text-[13px] font-semibold text-[#17365D]">
            № {invoice.number}
          </div>
          <div className="mt-1.5 text-[10.5px] leading-4 text-[#4A5A70]">
            <div>Дата: {formatDateShort(invoice.issue_date)}</div>
            {invoice.due_date ? <div>Падеж: {formatDateShort(invoice.due_date)}</div> : null}
          </div>
        </div>
      </header>

      {INVOICE_LEGAL_NOTE[invoice.doc_type] ? (
        <p className="mt-3 rounded border border-[#E2E7EF] bg-[#F7F9FC] px-3 py-1.5 text-[9.5px] leading-4 text-[#4A5A70]">
          {INVOICE_LEGAL_NOTE[invoice.doc_type]}
        </p>
      ) : null}

      {related ? (
        <p className="mt-3 text-[10px] text-[#4A5A70]">
          Към {related.doc_type === "invoice" ? "фактура" : "документ"} № {related.number} от{" "}
          {formatDateShort(related.issue_date)} г.
        </p>
      ) : null}

      <section className="mt-4 grid grid-cols-2 gap-4">
        <div className="rounded border border-[#DDE3EC] p-3">
          <div className="text-[9px] uppercase tracking-[0.14em] text-[#7A8798]">Получател</div>
          <div className="mt-1 text-[11.5px] font-semibold text-[#17365D]">{invoice.client_name}</div>
          <div className="mt-1 space-y-0.5 text-[10px] leading-4 text-[#4A5A70]">
            {invoice.client_address ? (
              <div>
                {invoice.client_address}
                {invoice.client_city ? `, ${invoice.client_city}` : ""}
              </div>
            ) : null}
            {invoice.client_eik ? <div>ЕИК/ЕГН: {invoice.client_eik}</div> : null}
            {invoice.client_vat ? <div>ДДС №: {invoice.client_vat}</div> : null}
            {invoice.client_mol ? <div>МОЛ: {invoice.client_mol}</div> : null}
          </div>
        </div>

        <div className="rounded border border-[#DDE3EC] p-3">
          <div className="text-[9px] uppercase tracking-[0.14em] text-[#7A8798]">Плащане</div>
          <div className="mt-1 space-y-0.5 text-[10px] leading-4 text-[#4A5A70]">
            <div>Начин: {PAYMENT_METHOD[invoice.payment_method]}</div>
            <div>Валута: {invoice.currency}</div>
            {invoice.basis ? <div>Основание: {invoice.basis}</div> : null}
            {invoice.supplier_iban ? <div>IBAN: {invoice.supplier_iban}</div> : null}
          </div>
        </div>
      </section>

      <section className="mt-4">
        <table className="w-full border-collapse text-[10.5px]">
          <thead>
            <tr className="bg-[#F3F5F8] text-left text-[9px] uppercase tracking-[0.06em] text-[#4A5A70]">
              <th className="border border-[#DDE3EC] px-1.5 py-1.5 text-center">№</th>
              <th className="border border-[#DDE3EC] px-2 py-1.5">Описание</th>
              <th className="border border-[#DDE3EC] px-1.5 py-1.5 text-center">Мярка</th>
              <th className="border border-[#DDE3EC] px-1.5 py-1.5 text-right">Кол.</th>
              <th className="border border-[#DDE3EC] px-1.5 py-1.5 text-right">Ед. цена</th>
              <th className="border border-[#DDE3EC] px-1.5 py-1.5 text-right">ДДС %</th>
              <th className="border border-[#DDE3EC] px-2 py-1.5 text-right">Стойност</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.id}>
                <td className="border border-[#DDE3EC] px-1.5 py-1.5 text-center text-[#4A5A70]">
                  {index + 1}
                </td>
                <td className="border border-[#DDE3EC] px-2 py-1.5">{item.name}</td>
                <td className="border border-[#DDE3EC] px-1.5 py-1.5 text-center">{item.unit}</td>
                <td className="border border-[#DDE3EC] px-1.5 py-1.5 text-right tabular-nums">
                  {formatQuantity(item.quantity)}
                </td>
                <td className="border border-[#DDE3EC] px-1.5 py-1.5 text-right tabular-nums">
                  {formatMoney(item.unit_price, invoice.currency)}
                </td>
                <td className="border border-[#DDE3EC] px-1.5 py-1.5 text-right tabular-nums">
                  {item.vat_rate}%
                </td>
                <td className="border border-[#DDE3EC] px-2 py-1.5 text-right font-medium tabular-nums">
                  {formatMoney(item.line_subtotal, invoice.currency)}
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="border border-[#DDE3EC] px-2 py-2 text-center text-[#7A8798]">
                  Няма въведени редове.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-[380px] text-[10px] leading-5 text-[#4A5A70]">
          <div className="mb-1 font-semibold text-[#17365D]">Словом:</div>
          <div>{amountInWords(invoice.total, invoice.currency)}</div>
          {invoice.note ? <div className="mt-2 border-t border-[#E2E7EF] pt-2">{invoice.note}</div> : null}
        </div>

        <table className="w-full max-w-[290px] border-collapse text-[10.5px]">
          <tbody>
            <tr>
              <td className="border border-[#DDE3EC] px-2 py-1.5 text-[#4A5A70]">Данъчна основа</td>
              <td className="border border-[#DDE3EC] px-2 py-1.5 text-right tabular-nums">
                {formatMoney(totals.subtotal, invoice.currency)}
              </td>
            </tr>
            {totals.byRate.map((bucket) => (
              <tr key={bucket.rate}>
                <td className="border border-[#DDE3EC] px-2 py-1.5 text-[#4A5A70]">
                  ДДС {bucket.rate}%
                </td>
                <td className="border border-[#DDE3EC] px-2 py-1.5 text-right tabular-nums">
                  {formatMoney(bucket.vat, invoice.currency)}
                </td>
              </tr>
            ))}
            <tr className="bg-[#F3F5F8] font-semibold text-[#17365D]">
              <td className="border border-[#DDE3EC] px-2 py-2">
                {isReceivable(invoice) ? "Общо за плащане" : "Общо по документа"}
              </td>
              <td className="border border-[#DDE3EC] px-2 py-2 text-right tabular-nums">
                {formatMoney(totals.total, invoice.currency)}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {cancelled ? (
        <p className="mt-4 border border-[#B42318]/30 bg-[#FDF3F2] px-3 py-2 text-[10px] text-[#B42318]">
          Документът е анулиран
          {invoice.cancelled_at ? ` на ${formatDateShort(invoice.cancelled_at)}` : ""}
          {invoice.cancel_reason ? ` — ${invoice.cancel_reason}` : ""}.
        </p>
      ) : null}

      {late ? (
        <p className="mt-2 text-[9.5px] text-[#B42318]">
          Падежът е минал на {formatDateShort(invoice.due_date)}.
        </p>
      ) : null}

      <div className="mt-10 grid grid-cols-2 gap-10 text-[10px] text-[#4A5A70]">
        <div>
          <div className="mb-8 uppercase tracking-[0.08em]">Съставил</div>
          <div className="border-t border-[#C7CED8] pt-1.5">
            {invoice.supplier_mol || invoice.supplier_name}
          </div>
        </div>
        <div>
          <div className="mb-8 uppercase tracking-[0.08em]">Получател</div>
          <div className="border-t border-[#C7CED8] pt-1.5">{invoice.client_name}</div>
        </div>
      </div>

      <footer className="mt-8 flex items-center justify-between border-t border-[#E2E7EF] pt-2.5 text-[8.5px] text-[#8A96A6]">
        <span>
          {footerNote ? `${footerNote} · ` : ""}
          {invoice.supplier_name} · {formatDate(invoice.issue_date)}
        </span>
        <span>Издаден с PIG e-ADMIN</span>
      </footer>
    </article>
  );
}
