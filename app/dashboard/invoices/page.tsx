import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Filter,
  Plus,
  Receipt,
  Search,
  Users,
} from "lucide-react";

import { Flash } from "@/components/ui/flash";
import {
  Badge,
  ButtonLink,
  Card,
  CardBody,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  StatCard,
} from "@/components/ui/primitives";
import { requirePermission } from "@/lib/auth/session";
import { listRows } from "@/lib/db";
import { formatMoney, isOverdue, isReceivable, outstanding } from "@/lib/invoices";
import { INVOICE_STATUS, INVOICE_TYPE } from "@/lib/labels";
import type { InvoiceRow } from "@/lib/types";
import { formatDateShort, pluralBg } from "@/lib/utils";

export const metadata: Metadata = { title: "Фактури" };
export const dynamic = "force-dynamic";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{
    ok?: string;
    err?: string;
    q?: string;
    type?: string;
    status?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const user = await requirePermission("invoices.view");
  const sp = await searchParams;

  const invoices = await listRows<InvoiceRow>("invoices", { orderBy: "issue_date" });

  const query = (sp.q || "").trim().toLowerCase();
  const filtered = invoices.filter((invoice) => {
    if (sp.type && invoice.doc_type !== sp.type) return false;
    if (sp.status === "overdue" && !isOverdue(invoice)) return false;
    if (sp.status && sp.status !== "overdue" && invoice.status !== sp.status) return false;
    if (sp.from && invoice.issue_date < sp.from) return false;
    if (sp.to && invoice.issue_date > sp.to) return false;
    if (query) {
      const haystack = `${invoice.number} ${invoice.client_name} ${invoice.basis ?? ""}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  const issued = invoices.filter((invoice) => invoice.status === "issued" || invoice.status === "paid");
  const unpaid = issued.filter((invoice) => outstanding(invoice) > 0);
  const overdue = invoices.filter((invoice) => isOverdue(invoice));
  // Кредитните известия и сторното не са приходи — не влизат в „платени“.
  const paidTotal = invoices
    .filter((invoice) => invoice.status === "paid" && isReceivable(invoice))
    .reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
  const currency = invoices[0]?.currency || "EUR";
  const canManage = user.permissions.includes("invoices.manage");

  return (
    <div>
      <Flash ok={sp.ok} err={sp.err} />

      <PageHeader
        title="Фактури и проформи"
        subtitle="Издаване на фактури, проформа фактури, дебитни и кредитни известия — с автоматична номерация, ДДС и печатен вид."
        actions={
          <>
            <ButtonLink href="/dashboard/invoices/clients" variant="outline" size="sm">
              <Users size={14} /> Контрагенти
            </ButtonLink>
            {canManage ? (
              <ButtonLink href="/dashboard/invoices/new" size="sm">
                <Plus size={14} /> Нов документ
              </ButtonLink>
            ) : null}
          </>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Издадени документи" value={issued.length} icon={Receipt} />
        <StatCard
          label="Неплатени"
          value={formatMoney(
            unpaid.reduce((sum, invoice) => sum + outstanding(invoice), 0),
            currency,
          )}
          hint={pluralBg(unpaid.length, "документ с остатък", "документа с остатък")}
          icon={FileText}
          accent="gold"
        />
        <StatCard
          label="Просрочени"
          value={overdue.length}
          hint={overdue.length ? "Падежът е минал" : "Няма просрочия"}
          icon={AlertTriangle}
          accent={overdue.length ? "danger" : "success"}
        />
        <StatCard
          label="Платени"
          value={formatMoney(paidTotal, currency)}
          icon={CheckCircle2}
          accent="success"
        />
      </div>

      <Card className="mb-4">
        <CardBody className="py-4">
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto] lg:items-end">
            <Field label="Търсене">
              <div className="relative">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                />
                <Input
                  name="q"
                  defaultValue={sp.q || ""}
                  placeholder="Номер, получател или основание…"
                  className="pl-8"
                />
              </div>
            </Field>
            <Field label="Вид">
              <Select name="type" defaultValue={sp.type || ""}>
                <option value="">Всички</option>
                {Object.entries(INVOICE_TYPE).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Статус">
              <Select name="status" defaultValue={sp.status || ""}>
                <option value="">Всички</option>
                {Object.entries(INVOICE_STATUS).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ))}
                <option value="overdue">Просрочени</option>
              </Select>
            </Field>
            <Field label="От дата">
              <Input name="from" type="date" defaultValue={sp.from || ""} />
            </Field>
            <Field label="До дата">
              <Input name="to" type="date" defaultValue={sp.to || ""} />
            </Field>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-navy-700 px-4 text-[13px] font-medium text-white hover:bg-navy-800"
            >
              <Filter size={14} /> Филтър
            </button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-0">
          {filtered.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={Receipt}
                title={invoices.length === 0 ? "Още няма издадени документи" : "Няма резултати по филтрите"}
                description={
                  invoices.length === 0
                    ? "Създайте първата фактура или проформа — номерът се генерира автоматично, а документът може да се отпечата или запази като PDF."
                    : "Променете критериите или изчистете филтрите."
                }
                action={
                  canManage && invoices.length === 0 ? (
                    <ButtonLink href="/dashboard/invoices/new" size="sm">
                      <Plus size={14} /> Нов документ
                    </ButtonLink>
                  ) : null
                }
              />
            </div>
          ) : (
            <div className="table-shell rounded-none border-0">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Номер</th>
                    <th>Вид</th>
                    <th>Получател</th>
                    <th>Издаден</th>
                    <th>Падеж</th>
                    <th className="text-right">Сума</th>
                    <th>Статус</th>
                    <th className="text-right">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((invoice) => {
                    const late = isOverdue(invoice);
                    return (
                      <tr key={invoice.id}>
                        <td className="whitespace-nowrap font-mono text-[11.5px]">
                          <Link
                            href={`/dashboard/invoices/${invoice.id}`}
                            className="font-medium hover:text-navy-600 dark:hover:text-gold-300"
                          >
                            {invoice.number}
                          </Link>
                        </td>
                        <td>
                          <Badge tone={INVOICE_TYPE[invoice.doc_type].tone}>
                            {INVOICE_TYPE[invoice.doc_type].label}
                          </Badge>
                        </td>
                        <td className="max-w-[240px]">
                          <div className="truncate font-medium">{invoice.client_name}</div>
                          <div className="truncate text-[11px] text-muted">
                            {invoice.client_eik ? `ЕИК ${invoice.client_eik}` : invoice.basis || "—"}
                          </div>
                        </td>
                        <td className="whitespace-nowrap text-[12px] text-muted">
                          {formatDateShort(invoice.issue_date)}
                        </td>
                        <td className="whitespace-nowrap text-[12px] text-muted">
                          {invoice.due_date ? formatDateShort(invoice.due_date) : "—"}
                        </td>
                        <td className="whitespace-nowrap text-right font-medium tabular-nums">
                          {formatMoney(invoice.total, invoice.currency)}
                        </td>
                        <td>
                          {late ? (
                            <Badge tone="danger">Просрочена</Badge>
                          ) : (
                            <Badge tone={INVOICE_STATUS[invoice.status].tone}>
                              {INVOICE_STATUS[invoice.status].label}
                            </Badge>
                          )}
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              href={`/dashboard/invoices/${invoice.id}`}
                              className="rounded-md border border-hairline px-2 py-1 text-[11.5px] text-muted hover:text-content"
                            >
                              Отвори
                            </Link>
                            <Link
                              href={`/print/invoice/${invoice.id}`}
                              target="_blank"
                              className="rounded-md border border-hairline px-2 py-1 text-[11.5px] text-muted hover:text-content"
                            >
                              Печат
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <p className="mt-3 text-[11.5px] text-muted">
        Номерата се генерират автоматично и са непрекъснати за всеки вид документ. Издаден
        документ не се редактира — корекциите се правят с кредитно известие или сторно.
      </p>
    </div>
  );
}
