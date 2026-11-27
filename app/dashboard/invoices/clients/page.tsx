import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Building2, Pencil, Plus, Trash2, Users } from "lucide-react";

import { SubmitButton } from "@/components/ui/client";
import { Flash } from "@/components/ui/flash";
import {
  Alert,
  Badge,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Textarea,
} from "@/components/ui/primitives";
import {
  createInvoiceClientAction,
  deleteInvoiceClientAction,
  updateInvoiceClientAction,
} from "@/lib/actions/invoices";
import { requirePermission } from "@/lib/auth/session";
import { getRow, listRows } from "@/lib/db";
import type { InvoiceClientRow, InvoiceRow } from "@/lib/types";
import { pluralBg } from "@/lib/utils";

export const metadata: Metadata = { title: "Контрагенти" };
export const dynamic = "force-dynamic";

export default async function InvoiceClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string; edit?: string }>;
}) {
  const user = await requirePermission("invoices.view");
  const sp = await searchParams;

  const [clients, invoices] = await Promise.all([
    listRows<InvoiceClientRow>("invoice_clients", { orderBy: "name", ascending: true }),
    listRows<InvoiceRow>("invoices"),
  ]);

  const editing = sp.edit ? await getRow<InvoiceClientRow>("invoice_clients", sp.edit) : null;
  const canManage = user.permissions.includes("invoices.manage");
  const usage = (clientId: string) => invoices.filter((row) => row.client_id === clientId).length;

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
        title="Контрагенти"
        subtitle="Получатели на фактури — фирми и физически лица. Данните се копират в документа при издаване."
        actions={
          <ButtonLink href="/dashboard/invoices/new" size="sm">
            <Plus size={14} /> Нов документ
          </ButtonLink>
        }
      />

      {!canManage ? (
        <Alert tone="info" className="mb-4" title="Режим на преглед">
          Можете да преглеждате контрагентите, но не и да ги променяте.
        </Alert>
      ) : null}

      {canManage ? (
        <Card className="mb-4">
          <CardHeader
            title={editing ? `Редакция: ${editing.name}` : "Нов контрагент"}
            description={editing ? "Промените не засягат вече издадени документи" : "Попълнете данните за фактуриране"}
            icon={editing ? Pencil : Building2}
            action={
              editing ? (
                <Link
                  href="/dashboard/invoices/clients"
                  className="text-[12px] text-muted hover:text-content"
                >
                  Отказ
                </Link>
              ) : null
            }
          />
          <CardBody>
            <form
              action={editing ? updateInvoiceClientAction : createInvoiceClientAction}
              className="grid gap-3 sm:grid-cols-2"
            >
              {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
              <Field label="Наименование" required className="sm:col-span-2">
                <Input
                  name="name"
                  required
                  minLength={2}
                  defaultValue={editing?.name ?? ""}
                  placeholder="Фирма ЕООД / Иван Иванов"
                />
              </Field>
              <Field label="ЕИК / ЕГН">
                <Input name="eik" defaultValue={editing?.eik ?? ""} placeholder="123456789" />
              </Field>
              <Field label="ДДС №">
                <Input name="vat_number" defaultValue={editing?.vat_number ?? ""} placeholder="BG123456789" />
              </Field>
              <Field label="МОЛ">
                <Input name="mol" defaultValue={editing?.mol ?? ""} placeholder="Управител" />
              </Field>
              <Field label="Град">
                <Input name="city" defaultValue={editing?.city ?? ""} placeholder="Охрид" />
              </Field>
              <Field label="Адрес" className="sm:col-span-2">
                <Input
                  name="address"
                  defaultValue={editing?.address ?? ""}
                  placeholder="ул. „…“ № …, ет. …"
                />
              </Field>
              <Field label="Държава">
                <Input name="country" defaultValue={editing?.country ?? "България"} />
              </Field>
              <Field label="Имейл">
                <Input name="email" type="email" defaultValue={editing?.email ?? ""} />
              </Field>
              <Field label="Телефон">
                <Input name="phone" defaultValue={editing?.phone ?? ""} />
              </Field>
              <Field label="Бележка" className="sm:col-span-2">
                <Textarea name="note" rows={2} defaultValue={editing?.note ?? ""} />
              </Field>
              <div className="sm:col-span-2">
                <SubmitButton pendingText="Записване…">
                  {editing ? "Запази промените" : "Добави контрагент"}
                </SubmitButton>
              </div>
            </form>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Списък" description={pluralBg(clients.length, "контрагент", "контрагента")} icon={Users} />
        <CardBody className="p-0">
          {clients.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={Users}
                title="Няма добавени контрагенти"
                description="Добавете получателите, за да ги избирате с едно кликване при издаване на документ."
              />
            </div>
          ) : (
            <div className="table-shell rounded-none border-0">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Наименование</th>
                    <th>ЕИК / ДДС №</th>
                    <th>Адрес</th>
                    <th>Контакт</th>
                    <th className="text-right">Документи</th>
                    <th className="text-right">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => {
                    const count = usage(client.id);
                    return (
                      <tr key={client.id}>
                        <td>
                          <div className="font-medium">{client.name}</div>
                          {client.mol ? (
                            <div className="text-[11px] text-muted">МОЛ: {client.mol}</div>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap text-[12px] text-muted">
                          {client.eik || "—"}
                          {client.vat_number ? ` / ${client.vat_number}` : ""}
                        </td>
                        <td className="max-w-[240px] text-[12px] text-muted">
                          <div className="truncate">
                            {[client.address, client.city].filter(Boolean).join(", ") || "—"}
                          </div>
                          <div className="truncate text-[11px]">{client.country}</div>
                        </td>
                        <td className="max-w-[200px] text-[12px] text-muted">
                          <div className="truncate">{client.email || "—"}</div>
                          <div className="truncate text-[11px]">{client.phone || ""}</div>
                        </td>
                        <td className="text-right">
                          <Badge tone={count > 0 ? "info" : "neutral"}>{count}</Badge>
                        </td>
                        <td>
                          {canManage ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <Link
                                href={`/dashboard/invoices/clients?edit=${client.id}`}
                                className="rounded-md border border-hairline px-2 py-1 text-[11.5px] text-muted hover:text-content"
                              >
                                Редакция
                              </Link>
                              {count === 0 ? (
                                <form action={deleteInvoiceClientAction}>
                                  <input type="hidden" name="id" value={client.id} />
                                  <SubmitButton
                                    variant="ghost"
                                    size="sm"
                                    pendingText="…"
                                    confirm={`Да изтрия ли „${client.name}“?`}
                                  >
                                    <Trash2 size={13} />
                                  </SubmitButton>
                                </form>
                              ) : (
                                <span className="text-[11px] text-muted">използван</span>
                              )}
                            </div>
                          ) : (
                            <span className="block text-right text-[11px] text-muted">—</span>
                          )}
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
    </div>
  );
}
