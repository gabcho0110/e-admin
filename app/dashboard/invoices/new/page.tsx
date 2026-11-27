import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Info, Receipt } from "lucide-react";

import { InvoiceForm } from "@/components/invoices/invoice-form";
import { Alert, Card, CardBody, PageHeader } from "@/components/ui/primitives";
import { createInvoiceAction } from "@/lib/actions/invoices";
import { requirePermission } from "@/lib/auth/session";
import { getRow, getSettings, listRows } from "@/lib/db";
import { isoDate, toNumber } from "@/lib/invoices";
import { INVOICE_TYPE } from "@/lib/labels";
import type { InvoiceClientRow, InvoiceItemRow, InvoiceRow } from "@/lib/types";

export const metadata: Metadata = { title: "Нов документ" };
export const dynamic = "force-dynamic";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  await requirePermission("invoices.manage");
  const sp = await searchParams;

  const [clients, settings] = await Promise.all([
    listRows<InvoiceClientRow>("invoice_clients", { orderBy: "name", ascending: true }),
    getSettings(),
  ]);

  // Кредитно известие / сторно по съществуващ документ — данните се копират.
  const source = sp.from ? await getRow<InvoiceRow>("invoices", sp.from) : null;
  const sourceItems = source
    ? await listRows<InvoiceItemRow>("invoice_items", { where: { invoice_id: source.id }, orderBy: "position", ascending: true })
    : [];

  const currency = settings.invoice_currency || "EUR";
  const vatRate = toNumber(settings.invoice_vat_rate || 20);
  const dueDays = toNumber(settings.invoice_due_days || 14) || 14;

  return (
    <div>
      <Link
        href="/dashboard/invoices"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-muted transition-colors hover:text-content"
      >
        <ArrowLeft size={13} /> Към регистъра
      </Link>

      <PageHeader
        eyebrow="НОВ ДОКУМЕНТ"
        title={source ? `Корекция по № ${source.number}` : "Издаване на документ"}
        subtitle="Попълнете получателя и редовете. Може да запазите чернова и да я издадете по-късно."
      />

      {source ? (
        <Alert tone="warning" className="mb-5" title="Копиране на данни">
          Данните са копирани от {INVOICE_TYPE[source.doc_type].label.toLowerCase()} №{" "}
          {source.number}. Документът ще бъде свързан с първичния и това ще личи в регистъра.
        </Alert>
      ) : null}

      {clients.length === 0 ? (
        <Alert tone="info" className="mb-5" title="Още няма контрагенти" icon={Info}>
          Може да въведете получателя директно във формуляра или да{" "}
          <Link href="/dashboard/invoices/clients" className="underline underline-offset-4">
            добавите контрагент
          </Link>
          , за да го избирате занапред.
        </Alert>
      ) : null}

      <Card>
        <CardBody>
          <InvoiceForm
            action={createInvoiceAction}
            clients={clients}
            currency={currency}
            defaultVatRate={vatRate}
            defaultDueDays={dueDays}
            today={isoDate()}
            invoice={
              source
                ? {
                    ...source,
                    id: "",
                    doc_type: "credit_note",
                    status: "draft",
                    number: "",
                    related_invoice_id: source.id,
                    issued_at: null,
                    paid_at: null,
                    cancelled_at: null,
                    cancel_reason: null,
                    paid_amount: 0,
                  }
                : null
            }
            items={sourceItems}
          />
        </CardBody>
      </Card>

      <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-muted">
        <Receipt size={12} /> Номерът се задава при записването и не се променя.
      </p>
    </div>
  );
}
