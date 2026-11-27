import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Building2,
  CalendarDays,
  Copy,
  FileText,
  Printer,
  Receipt,
  Trash2,
  XCircle,
} from "lucide-react";

import { InvoiceForm } from "@/components/invoices/invoice-form";
import { SubmitButton } from "@/components/ui/client";
import { Flash } from "@/components/ui/flash";
import {
  Alert,
  Badge,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  PageHeader,
} from "@/components/ui/primitives";
import {
  cancelInvoiceAction,
  deleteInvoiceAction,
  markInvoicePaidAction,
  updateInvoiceAction,
} from "@/lib/actions/invoices";
import { requirePermission } from "@/lib/auth/session";
import { getRow, getSettings, listRows } from "@/lib/db";
import {
  formatMoney,
  formatQuantity,
  isOverdue,
  isReceivable,
  isoDate,
  outstanding,
  toNumber,
} from "@/lib/invoices";
import { INVOICE_STATUS, INVOICE_TYPE, PAYMENT_METHOD } from "@/lib/labels";
import type { InvoiceClientRow, InvoiceItemRow, InvoiceRow } from "@/lib/types";
import { formatDate, formatDateShort } from "@/lib/utils";

export const metadata: Metadata = { title: "Документ" };
export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const user = await requirePermission("invoices.view");
  const { id } = await params;
  const sp = await searchParams;

  const invoice = await getRow<InvoiceRow>("invoices", id);
  if (!invoice) notFound();

  const [items, clients, settings] = await Promise.all([
    listRows<InvoiceItemRow>("invoice_items", {
      where: { invoice_id: id },
      orderBy: "position",
      ascending: true,
    }),
    listRows<InvoiceClientRow>("invoice_clients", { orderBy: "name", ascending: true }),
    getSettings(),
  ]);

  const canManage = user.permissions.includes("invoices.manage");
  const isDraft = invoice.status === "draft";
  const receivable = isReceivable(invoice);
  const late = isOverdue(invoice);
  const remaining = outstanding(invoice);
  const related = invoice.related_invoice_id
    ? await getRow<InvoiceRow>("invoices", invoice.related_invoice_id)
    : null;
  const corrections = await listRows<InvoiceRow>("invoices", {
    where: { related_invoice_id: invoice.id },
  });

  return (
    <div>
      <Flash ok={sp.ok} err={sp.err} />

      <Link
        href="/dashboard/invoices"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-muted transition-colors hover:text-content"
      >
        <ArrowLeft size={13} /> Към регистъра
      </Link>

      <PageHeader
        eyebrow={INVOICE_TYPE[invoice.doc_type].label.toUpperCase()}
        title={`№ ${invoice.number}`}
        subtitle={`${invoice.client_name} · ${formatDate(invoice.issue_date)}`}
        actions={
          <>
            <ButtonLink href={`/print/invoice/${invoice.id}`} target="_blank" variant="outline" size="sm">
              <Printer size={14} /> Печат / PDF
            </ButtonLink>
            {canManage && !isDraft && invoice.doc_type !== "storno" ? (
              <ButtonLink
                href={`/dashboard/invoices/new?from=${invoice.id}`}
                variant="subtle"
                size="sm"
              >
                <Copy size={14} /> Кредитно известие
              </ButtonLink>
            ) : null}
            <Badge tone={late ? "danger" : INVOICE_STATUS[invoice.status].tone}>
              {late ? "Просрочена" : INVOICE_STATUS[invoice.status].label}
            </Badge>
          </>
        }
      />

      {related ? (
        <Alert tone="info" className="mb-4" title="Корекция на документ">
          Този документ се отнася към{" "}
          <Link href={`/dashboard/invoices/${related.id}`} className="underline underline-offset-4">
            {INVOICE_TYPE[related.doc_type].label} № {related.number}
          </Link>{" "}
          от {formatDateShort(related.issue_date)}.
        </Alert>
      ) : null}

      {corrections.length > 0 ? (
        <Alert tone="warning" className="mb-4" title="Има издадени корекции">
          {corrections
            .map((row) => `${INVOICE_TYPE[row.doc_type].label} № ${row.number}`)
            .join(", ")}
        </Alert>
      ) : null}

      {invoice.status === "cancelled" ? (
        <Alert tone="danger" className="mb-4" title="Анулиран документ" icon={XCircle}>
          {invoice.cancel_reason || "Документът е анулиран."}
          {invoice.cancelled_at ? ` (${formatDate(invoice.cancelled_at)})` : ""}
        </Alert>
      ) : null}

      {isDraft && canManage ? (
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Чернова — може да се редактира"
              description="Промените не се отразяват на издадени документи"
              icon={FileText}
            />
            <CardBody>
              <InvoiceForm
                action={updateInvoiceAction}
                clients={clients}
                currency={settings.invoice_currency || invoice.currency}
                defaultVatRate={toNumber(settings.invoice_vat_rate || invoice.vat_rate || 20)}
                defaultDueDays={toNumber(settings.invoice_due_days || 14) || 14}
                today={isoDate()}
                invoice={invoice}
                items={items}
              />
            </CardBody>
          </Card>

          <Card className="border-red-200 dark:border-red-900/60">
            <CardHeader title="Изтриване на черновата" description="Окончателно" icon={Trash2} />
            <CardBody>
              <form action={deleteInvoiceAction}>
                <input type="hidden" name="id" value={invoice.id} />
                <SubmitButton
                  variant="danger"
                  size="sm"
                  pendingText="Изтриване…"
                  confirm={`Чернова № ${invoice.number} ще бъде изтрита. Продължавате ли?`}
                >
                  <Trash2 size={14} /> Изтрий черновата
                </SubmitButton>
              </form>
            </CardBody>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-4">
            <Card>
              <CardHeader
                title={`${INVOICE_TYPE[invoice.doc_type].label} № ${invoice.number}`}
                description={`Издаден на ${formatDate(invoice.issue_date)}`}
                icon={Receipt}
              />
              <CardBody className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] border-collapse text-[12.5px]">
                    <thead>
                      <tr className="bg-panel2/70 text-left text-[10.5px] uppercase tracking-[0.08em] text-muted">
                        <th className="px-4 py-2 font-semibold">№</th>
                        <th className="px-2 py-2 font-semibold">Описание</th>
                        <th className="px-2 py-2 text-right font-semibold">Кол.</th>
                        <th className="px-2 py-2 text-right font-semibold">Ед. цена</th>
                        <th className="px-2 py-2 text-right font-semibold">ДДС</th>
                        <th className="px-4 py-2 text-right font-semibold">Стойност</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, index) => (
                        <tr key={item.id} className="border-t border-hairline">
                          <td className="px-4 py-2 text-muted">{index + 1}</td>
                          <td className="px-2 py-2">{item.name}</td>
                          <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                            {formatQuantity(item.quantity)} {item.unit}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                            {formatMoney(item.unit_price, invoice.currency)}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                            {item.vat_rate}%
                          </td>
                          <td className="whitespace-nowrap px-4 py-2 text-right font-medium tabular-nums">
                            {formatMoney(item.line_total, invoice.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <dl className="ml-auto w-full max-w-[320px] space-y-1.5 border-t border-hairline px-5 py-4 text-[13px]">
                  <div className="flex justify-between">
                    <dt className="text-muted">Данъчна основа</dt>
                    <dd className="tabular-nums">{formatMoney(invoice.subtotal, invoice.currency)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">ДДС</dt>
                    <dd className="tabular-nums">{formatMoney(invoice.vat_amount, invoice.currency)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-hairline pt-1.5 text-[16px] font-semibold">
                    <dt>{receivable ? "Общо за плащане" : "Общо по документа"}</dt>
                    <dd className="tabular-nums">{formatMoney(invoice.total, invoice.currency)}</dd>
                  </div>
                  {Number(invoice.paid_amount) > 0 ? (
                    <>
                      <div className="flex justify-between text-emerald-700 dark:text-emerald-300">
                        <dt>Платено</dt>
                        <dd className="tabular-nums">
                          {formatMoney(invoice.paid_amount, invoice.currency)}
                        </dd>
                      </div>
                      <div className="flex justify-between font-medium">
                        <dt>Остатък</dt>
                        <dd className="tabular-nums">{formatMoney(remaining, invoice.currency)}</dd>
                      </div>
                    </>
                  ) : null}
                </dl>
              </CardBody>
            </Card>

            {invoice.note ? (
              <Card>
                <CardHeader title="Забележка" icon={FileText} />
                <CardBody className="whitespace-pre-line text-[13px] leading-6 text-muted">
                  {invoice.note}
                </CardBody>
              </Card>
            ) : null}
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader title="Получател" icon={Building2} />
              <CardBody className="space-y-1 text-[12.5px]">
                <div className="font-medium">{invoice.client_name}</div>
                {invoice.client_eik ? <div className="text-muted">ЕИК/ЕГН: {invoice.client_eik}</div> : null}
                {invoice.client_vat ? <div className="text-muted">ДДС №: {invoice.client_vat}</div> : null}
                {invoice.client_mol ? <div className="text-muted">МОЛ: {invoice.client_mol}</div> : null}
                {invoice.client_address ? (
                  <div className="text-muted">
                    {invoice.client_address}
                    {invoice.client_city ? `, ${invoice.client_city}` : ""}
                  </div>
                ) : null}
                {invoice.client_email ? <div className="text-muted">{invoice.client_email}</div> : null}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Данни за плащане" icon={CalendarDays} />
              <CardBody className="space-y-1.5 text-[12.5px]">
                <div className="flex justify-between">
                  <span className="text-muted">Падеж</span>
                  <span>{invoice.due_date ? formatDateShort(invoice.due_date) : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Начин</span>
                  <span>{PAYMENT_METHOD[invoice.payment_method]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Основание</span>
                  <span className="max-w-[60%] truncate text-right">{invoice.basis || "—"}</span>
                </div>
                {invoice.supplier_iban ? (
                  <div className="flex justify-between gap-3 border-t border-hairline pt-1.5">
                    <span className="text-muted">IBAN</span>
                    <span className="truncate font-mono text-[11.5px]">{invoice.supplier_iban}</span>
                  </div>
                ) : null}
                {invoice.supplier_bank ? (
                  <div className="flex justify-between">
                    <span className="text-muted">Банка</span>
                    <span className="truncate">{invoice.supplier_bank}</span>
                  </div>
                ) : null}
              </CardBody>
            </Card>

            {canManage && !isDraft && receivable && invoice.status !== "cancelled" ? (
              <Card>
                <CardHeader
                  title="Плащане"
                  description={
                    remaining > 0
                      ? `Остатък ${formatMoney(remaining, invoice.currency)}`
                      : "Няма остатък"
                  }
                  icon={Banknote}
                />
                <CardBody>
                  {remaining > 0 ? (
                    <form action={markInvoicePaidAction} className="space-y-2">
                      <input type="hidden" name="id" value={invoice.id} />
                      <Field label="Сума" hint="Празно поле = цялата сума">
                        <Input
                          name="amount"
                          inputMode="decimal"
                          placeholder={String(remaining)}
                          defaultValue={remaining}
                        />
                      </Field>
                      <SubmitButton size="sm" className="w-full" pendingText="Записване…">
                        Отбележи плащане
                      </SubmitButton>
                    </form>
                  ) : (
                    <p className="text-[12.5px] text-muted">
                      Документът е платен изцяло
                      {invoice.paid_at ? ` на ${formatDateShort(invoice.paid_at)}` : ""}.
                    </p>
                  )}
                </CardBody>
              </Card>
            ) : null}

            {canManage && !isDraft && invoice.status !== "cancelled" && invoice.status !== "paid" ? (
              <Card className="border-red-200 dark:border-red-900/60">
                <CardHeader title="Анулиране" description="Ако документът не е платен" icon={AlertTriangle} />
                <CardBody>
                  <form action={cancelInvoiceAction} className="space-y-2">
                    <input type="hidden" name="id" value={invoice.id} />
                    <Field label="Причина" required>
                      <Input name="reason" required minLength={5} placeholder="напр. издадена по грешка" />
                    </Field>
                    <SubmitButton
                      variant="danger"
                      size="sm"
                      className="w-full"
                      pendingText="Анулиране…"
                      confirm={`Документ № ${invoice.number} ще бъде анулиран. Продължавате ли?`}
                    >
                      <XCircle size={14} /> Анулирай документа
                    </SubmitButton>
                  </form>
                </CardBody>
              </Card>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
