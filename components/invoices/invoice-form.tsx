"use client";

import { Plus, Trash2 } from "lucide-react";
import * as React from "react";

import { SubmitButton } from "@/components/ui/client";
import { Field, Input, Select, Textarea } from "@/components/ui/primitives";
import {
  INVOICE_CURRENCIES,
  INVOICE_TYPE,
  INVOICE_UNITS,
  PAYMENT_METHOD,
  VAT_RATES,
} from "@/lib/labels";
import { computeLine, computeTotals, formatMoney, toNumber } from "@/lib/invoices";
import type {
  InvoiceClientRow,
  InvoiceItemRow,
  InvoiceRow,
  InvoiceType,
  PaymentMethod,
} from "@/lib/types";

/**
 * Формуляр за фактура, проформа и известия.
 *
 * Клиентски компонент, защото редовете се добавят и махат динамично и
 * тоталите се смятат в реално време. Сървърното действие се подава като
 * prop, така че същият формуляр се използва за създаване и за редакция.
 */

interface ItemDraft {
  key: string;
  name: string;
  unit: string;
  quantity: string;
  unit_price: string;
  vat_rate: string;
}

interface InvoiceFormProps {
  action: (formData: FormData) => Promise<void>;
  clients: InvoiceClientRow[];
  currency: string;
  defaultVatRate: number;
  defaultDueDays: number;
  today: string;
  invoice?: InvoiceRow | null;
  items?: InvoiceItemRow[];
}

let rowSeq = 0;
function nextKey(): string {
  rowSeq += 1;
  return `row-${rowSeq}`;
}

function emptyRow(vatRate: number): ItemDraft {
  return { key: nextKey(), name: "", unit: "бр.", quantity: "1", unit_price: "", vat_rate: String(vatRate) };
}

export function InvoiceForm({
  action,
  clients,
  currency,
  defaultVatRate,
  defaultDueDays,
  today,
  invoice,
  items,
}: InvoiceFormProps) {
  // „Редакция“ е само когато има реален запис; при копиране на данни
  // (кредитно известие) документът е нов и видът остава избираем.
  const editing = Boolean(invoice?.id);

  const [docType, setDocType] = React.useState<InvoiceType>(invoice?.doc_type ?? "invoice");
  const [clientId, setClientId] = React.useState(invoice?.client_id ?? "");
  const [clientName, setClientName] = React.useState(invoice?.client_name ?? "");
  const [clientEik, setClientEik] = React.useState(invoice?.client_eik ?? "");
  const [clientVat, setClientVat] = React.useState(invoice?.client_vat ?? "");
  const [clientMol, setClientMol] = React.useState(invoice?.client_mol ?? "");
  const [clientAddress, setClientAddress] = React.useState(invoice?.client_address ?? "");
  const [clientCity, setClientCity] = React.useState(invoice?.client_city ?? "");
  const [clientCountry, setClientCountry] = React.useState(invoice?.client_country ?? "България");
  const [clientEmail, setClientEmail] = React.useState(invoice?.client_email ?? "");

  const [issueDate, setIssueDate] = React.useState(invoice?.issue_date ?? today);
  const [dueDate, setDueDate] = React.useState(
    invoice?.due_date ?? addDaysSafe(today, defaultDueDays),
  );
  const [currencyValue, setCurrencyValue] = React.useState(invoice?.currency ?? currency);
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>(
    invoice?.payment_method ?? "bank",
  );
  const [basis, setBasis] = React.useState(invoice?.basis ?? "");
  const [note, setNote] = React.useState(invoice?.note ?? "");

  const [rows, setRows] = React.useState<ItemDraft[]>(() => {
    if (items && items.length > 0) {
      return items.map((item) => ({
        key: nextKey(),
        name: item.name,
        unit: item.unit || "бр.",
        quantity: String(item.quantity),
        unit_price: String(item.unit_price),
        vat_rate: String(item.vat_rate),
      }));
    }
    return [emptyRow(defaultVatRate)];
  });

  const totals = computeTotals(
    rows.map((row) => ({
      quantity: toNumber(row.quantity),
      unit_price: toNumber(row.unit_price),
      vat_rate: toNumber(row.vat_rate),
    })),
  );

  function updateRow(key: string, patch: Partial<ItemDraft>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((current) => [...current, emptyRow(defaultVatRate)]);
  }

  function removeRow(key: string) {
    setRows((current) => (current.length === 1 ? current : current.filter((row) => row.key !== key)));
  }

  function pickClient(value: string) {
    setClientId(value);
    const client = clients.find((row) => row.id === value);
    if (!client) return;
    setClientName(client.name);
    setClientEik(client.eik ?? "");
    setClientVat(client.vat_number ?? "");
    setClientMol(client.mol ?? "");
    setClientAddress(client.address ?? "");
    setClientCity(client.city ?? "");
    setClientCountry(client.country || "България");
    setClientEmail(client.email ?? "");
  }

  function shiftDueDate(value: string) {
    setIssueDate(value);
    if (value) setDueDate(addDaysSafe(value, defaultDueDays));
  }

  return (
    <form action={action} className="space-y-5">
      {invoice?.id ? <input type="hidden" name="id" value={invoice.id} /> : null}
      {invoice?.related_invoice_id ? (
        <input type="hidden" name="related_invoice_id" value={invoice.related_invoice_id} />
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <div className="surface-card p-5">
          <h3 className="mb-4 text-[14px] font-semibold tracking-tight">Документ</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Вид" required hint={editing ? "Видът се определя от номера" : undefined}>
              {editing ? <input type="hidden" name="doc_type" value={docType} /> : null}
              <Select
                name={editing ? undefined : "doc_type"}
                value={docType}
                onChange={(event) => setDocType(event.target.value as InvoiceType)}
                disabled={editing}
              >
                {Object.entries(INVOICE_TYPE).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Номер" hint={editing ? "Номерът не се променя" : "Генерира се автоматично"}>
              <Input value={invoice?.number || "—"} disabled />
            </Field>
            <Field label="Дата на издаване" required>
              <Input
                name="issue_date"
                type="date"
                value={issueDate}
                onChange={(event) => shiftDueDate(event.target.value)}
                required
              />
            </Field>
            <Field label="Падеж" hint={`${defaultDueDays} дни по подразбиране`}>
              <Input
                name="due_date"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </Field>
            <Field label="Валута" required>
              <Select
                name="currency"
                value={currencyValue}
                onChange={(event) => setCurrencyValue(event.target.value)}
              >
                {INVOICE_CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Плащане" required>
              <Select
                name="payment_method"
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
              >
                {Object.entries(PAYMENT_METHOD).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Основание" className="sm:col-span-2" hint="Договор, заявление, заповед…">
              <Input
                name="basis"
                value={basis}
                onChange={(event) => setBasis(event.target.value)}
                placeholder="напр. Договор № 12/01.09.2026"
              />
            </Field>
          </div>
        </div>

        <div className="surface-card p-5">
          <h3 className="mb-4 text-[14px] font-semibold tracking-tight">Получател</h3>
          <div className="space-y-3">
            <Field label="От контрагентите" hint="Изборът попълва полетата по-долу">
              <Select value={clientId} onChange={(event) => pickClient(event.target.value)}>
                <option value="">— нов получател —</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                    {client.city ? ` · ${client.city}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <input type="hidden" name="client_id" value={clientId} />
            <Field label="Наименование" required>
              <Input
                name="client_name"
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                required
                minLength={2}
                placeholder="Фирма или физическо лице"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="ЕИК / ЕГН">
                <Input name="client_eik" value={clientEik} onChange={(event) => setClientEik(event.target.value)} />
              </Field>
              <Field label="ДДС №">
                <Input name="client_vat" value={clientVat} onChange={(event) => setClientVat(event.target.value)} />
              </Field>
            </div>
            <Field label="МОЛ">
              <Input name="client_mol" value={clientMol} onChange={(event) => setClientMol(event.target.value)} />
            </Field>
            <Field label="Адрес">
              <Input
                name="client_address"
                value={clientAddress}
                onChange={(event) => setClientAddress(event.target.value)}
                placeholder="ул. „…“ № …"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Град">
                <Input name="client_city" value={clientCity} onChange={(event) => setClientCity(event.target.value)} />
              </Field>
              <Field label="Държава">
                <Input
                  name="client_country"
                  value={clientCountry}
                  onChange={(event) => setClientCountry(event.target.value)}
                />
              </Field>
            </div>
            <Field label="Имейл">
              <Input
                name="client_email"
                type="email"
                value={clientEmail}
                onChange={(event) => setClientEmail(event.target.value)}
              />
            </Field>
          </div>
        </div>
      </div>

      <div className="surface-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4">
          <div>
            <h3 className="text-[14px] font-semibold tracking-tight">Редове</h3>
            <p className="mt-0.5 text-[12.5px] text-muted">
              Количество × единична цена; ДДС се смята по ставката на реда.
            </p>
          </div>
          <button
            type="button"
            onClick={addRow}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-hairline bg-panel px-3 text-[12.5px] font-medium hover:border-navy-300"
          >
            <Plus size={14} /> Добави ред
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-[12.5px]">
            <thead>
              <tr className="bg-panel2/70 text-left text-[10.5px] uppercase tracking-[0.08em] text-muted">
                <th className="px-3 py-2 font-semibold">Описание</th>
                <th className="w-[92px] px-2 py-2 font-semibold">Мярка</th>
                <th className="w-[92px] px-2 py-2 font-semibold">Кол.</th>
                <th className="w-[120px] px-2 py-2 font-semibold">Ед. цена</th>
                <th className="w-[92px] px-2 py-2 font-semibold">ДДС %</th>
                <th className="w-[120px] px-2 py-2 text-right font-semibold">Сума</th>
                <th className="w-[44px] px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const line = computeLine({
                  quantity: toNumber(row.quantity),
                  unit_price: toNumber(row.unit_price),
                  vat_rate: toNumber(row.vat_rate),
                });
                return (
                  <tr key={row.key} className="border-t border-hairline align-top">
                    <td className="px-3 py-2">
                      <Input
                        name="item_name"
                        value={row.name}
                        onChange={(event) => updateRow(row.key, { name: event.target.value })}
                        placeholder="Описание на услугата или стоката"
                        className="h-9"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Select
                        name="item_unit"
                        value={row.unit}
                        onChange={(event) => updateRow(row.key, { unit: event.target.value })}
                        className="h-9"
                      >
                        {INVOICE_UNITS.map((unit) => (
                          <option key={unit} value={unit}>
                            {unit}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        name="item_quantity"
                        inputMode="decimal"
                        value={row.quantity}
                        onChange={(event) => updateRow(row.key, { quantity: event.target.value })}
                        className="h-9 text-right"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        name="item_unit_price"
                        inputMode="decimal"
                        value={row.unit_price}
                        onChange={(event) => updateRow(row.key, { unit_price: event.target.value })}
                        placeholder="0.00"
                        className="h-9 text-right"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Select
                        name="item_vat_rate"
                        value={row.vat_rate}
                        onChange={(event) => updateRow(row.key, { vat_rate: event.target.value })}
                        className="h-9"
                      >
                        {VAT_RATES.map((rate) => (
                          <option key={rate} value={rate}>
                            {rate}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 pt-4 text-right font-medium tabular-nums">
                      {formatMoney(line.total, currencyValue)}
                    </td>
                    <td className="px-2 py-2 pt-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => removeRow(row.key)}
                        disabled={rows.length === 1}
                        className="grid h-8 w-8 place-items-center rounded-md text-muted transition-colors hover:bg-red-50 hover:text-danger disabled:opacity-40 dark:hover:bg-red-900/20"
                        title="Премахни реда"
                        aria-label="Премахни реда"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-hairline bg-panel2/40 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-[420px] text-[12px] leading-5 text-muted">
            {totals.byRate.length > 1 ? (
              <ul className="space-y-0.5">
                {totals.byRate.map((bucket) => (
                  <li key={bucket.rate}>
                    ДДС {bucket.rate}%: основа {formatMoney(bucket.base, currencyValue)} ·{" "}
                    {formatMoney(bucket.vat, currencyValue)}
                  </li>
                ))}
              </ul>
            ) : (
              <span>Всички редове са с еднаква ставка на ДДС.</span>
            )}
          </div>
          <dl className="w-full max-w-[280px] space-y-1.5 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-muted">Данъчна основа</dt>
              <dd className="tabular-nums">{formatMoney(totals.subtotal, currencyValue)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">ДДС</dt>
              <dd className="tabular-nums">{formatMoney(totals.vat, currencyValue)}</dd>
            </div>
            <div className="flex justify-between border-t border-hairline pt-1.5 text-[15px] font-semibold">
              <dt>Общо</dt>
              <dd className="tabular-nums">{formatMoney(totals.total, currencyValue)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="surface-card p-5">
        <Field label="Забележка" hint="Отпечатва се в дъното на документа">
          <Textarea
            name="note"
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="напр. Плащане по банков път в 7-дневен срок."
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton name="intent" value="draft" variant="outline" pendingText="Записване…">
          {editing ? "Запази черновата" : "Създай чернова"}
        </SubmitButton>
        <SubmitButton name="intent" value="issue" pendingText="Издаване…">
          {editing ? "Запази и издай" : "Издай документа"}
        </SubmitButton>
      </div>
    </form>
  );
}

/** Локално добавяне на дни — без значение от часовата зона на сървъра. */
function addDaysSafe(date: string, days: number): string {
  if (!date) return "";
  const base = new Date(`${date}T12:00:00`);
  if (Number.isNaN(base.getTime())) return date;
  base.setDate(base.getDate() + days);
  const year = base.getFullYear();
  const month = String(base.getMonth() + 1).padStart(2, "0");
  const day = String(base.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
