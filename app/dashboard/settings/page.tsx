import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Database, KeyRound, Mail, Receipt, ShieldCheck } from "lucide-react";

import { SubmitButton } from "@/components/ui/client";
import { Flash } from "@/components/ui/flash";
import {
  Alert,
  Badge,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import { saveInstitutionSettingsAction } from "@/lib/actions/settings";
import { requirePermission } from "@/lib/auth/session";
import { countRows, dataMode, getSettings } from "@/lib/db";
import { INVOICE_CURRENCIES, VAT_RATES } from "@/lib/labels";
import { PERMISSION_LABELS, ROLE_DEFINITIONS } from "@/lib/permissions/roles";
import type { Permission } from "@/lib/types";

export const metadata: Metadata = { title: "Настройки" };
export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const user = await requirePermission("settings.manage");
  const sp = await searchParams;
  const settings = await getSettings();
  const mode = dataMode();

  const [users, documents, applications] = await Promise.all([
    countRows("users"),
    countRows("documents"),
    countRows("applications"),
  ]);

  const permissions = Object.keys(PERMISSION_LABELS) as Permission[];

  return (
    <div>
      <Flash ok={sp.ok} err={sp.err} />

      <PageHeader
        title="Настройки и администрация"
        subtitle="Институционални данни, роли, сигурност и състояние на системата."
        actions={
          <>
            <Link
              href="/dashboard/settings/security"
              className="rounded-lg border border-hairline bg-panel px-3 py-2 text-[12px] text-muted hover:text-content"
            >
              <ShieldCheck size={13} className="mr-1 inline" /> Сигурност
            </Link>
            <Link
              href="/dashboard/settings/audit"
              className="rounded-lg border border-hairline bg-panel px-3 py-2 text-[12px] text-muted hover:text-content"
            >
              Одиторски журнал
            </Link>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader title="Данни за институцията" description="Използват се в публичния портал и в документите" icon={Building2} />
            <CardBody>
              <form action={saveInstitutionSettingsAction} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="scope" value="institution" />
                <Field label="Наименование" required className="sm:col-span-2">
                  <Input name="institution_name" defaultValue={settings.institution_name} required />
                </Field>
                <Field label="Директор">
                  <Input name="institution_director" defaultValue={settings.institution_director} />
                </Field>
                <Field label="Длъжност на ръководителя">
                  <Input name="institution_director_role" defaultValue={settings.institution_director_role} />
                </Field>
                <Field label="Отговорник ИКТ">
                  <Input name="institution_ict" defaultValue={settings.institution_ict} />
                </Field>
                <Field label="Длъжност (ИКТ)">
                  <Input name="institution_ict_role" defaultValue={settings.institution_ict_role} />
                </Field>
                <Field label="Адрес" className="sm:col-span-2">
                  <Input name="institution_address" defaultValue={settings.institution_address} />
                </Field>
                <Field label="Имейл">
                  <Input name="institution_email" type="email" defaultValue={settings.institution_email} />
                </Field>
                <Field label="Префикс на регистрационните номера" hint="Напр. PIG → PIG-2026-000001">
                  <Input name="application_prefix" defaultValue={settings.application_prefix} maxLength={8} />
                </Field>
                <Field label="Мото" className="sm:col-span-2">
                  <Textarea name="institution_motto" rows={2} defaultValue={settings.institution_motto} />
                </Field>
                <Field label="Срок за съхранение на данни (месеци)" hint="GDPR — срок за съхранение на кандидатски досиета.">
                  <Input name="retention_months" type="number" min={12} max={120} defaultValue={settings.retention_months} />
                </Field>
                <label className="flex items-end gap-2 pb-2 text-[12.5px]">
                  <input
                    type="checkbox"
                    name="registration_open"
                    defaultChecked={settings.registration_open !== "false"}
                    className="h-4 w-4 accent-navy-700"
                  />
                  Приемане на нови кандидатури
                </label>
                <div className="sm:col-span-2">
                  <SubmitButton pendingText="Запазване…">Запази настройките</SubmitButton>
                </div>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Данни за фактуриране"
              description="Използват се като издател във фактурите, проформите и известията"
              icon={Receipt}
            />
            <CardBody>
              <form action={saveInstitutionSettingsAction} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="scope" value="invoices" />
                <Field label="Издател" className="sm:col-span-2" hint="Ако е празно — наименованието на институцията">
                  <Input
                    name="invoice_supplier_name"
                    defaultValue={settings.invoice_supplier_name}
                    placeholder={settings.institution_name || "ПИГ „Св. Климент Охридски“"}
                  />
                </Field>
                <Field label="ЕИК / ЕГН">
                  <Input name="invoice_supplier_eik" defaultValue={settings.invoice_supplier_eik} />
                </Field>
                <Field label="ДДС номер" hint="Ако институцията не е регистрирана по ЗДДС — оставете празно">
                  <Input name="invoice_supplier_vat" defaultValue={settings.invoice_supplier_vat} placeholder="BG…" />
                </Field>
                <Field label="Адрес" className="sm:col-span-2">
                  <Input
                    name="invoice_supplier_address"
                    defaultValue={settings.invoice_supplier_address}
                    placeholder="гр. …, ул. „…“ № …"
                  />
                </Field>
                <Field label="IBAN">
                  <Input
                    name="invoice_supplier_iban"
                    defaultValue={settings.invoice_supplier_iban}
                    placeholder="BG00 XXXX 0000 0000 0000 00"
                  />
                </Field>
                <Field label="Банка">
                  <Input name="invoice_supplier_bank" defaultValue={settings.invoice_supplier_bank} />
                </Field>
                <Field label="МОЛ (подписващ)" className="sm:col-span-2">
                  <Input
                    name="invoice_supplier_mol"
                    defaultValue={settings.invoice_supplier_mol}
                    placeholder={settings.institution_director || "Директор"}
                  />
                </Field>
                <Field label="Валута по подразбиране">
                  <Select name="invoice_currency" defaultValue={settings.invoice_currency || "EUR"}>
                    {INVOICE_CURRENCIES.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="ДДС по подразбиране (%)">
                  <Select name="invoice_vat_rate" defaultValue={settings.invoice_vat_rate || "20"}>
                    {VAT_RATES.map((rate) => (
                      <option key={rate} value={String(rate)}>
                        {rate}%
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Срок за плащане (дни)">
                  <Input
                    name="invoice_due_days"
                    type="number"
                    min={0}
                    max={120}
                    defaultValue={settings.invoice_due_days || "14"}
                  />
                </Field>
                <Field label="Текст в дъното" className="sm:col-span-2">
                  <Input
                    name="invoice_footer_note"
                    defaultValue={settings.invoice_footer_note}
                    placeholder="Благодарим Ви!"
                  />
                </Field>
                <div className="sm:col-span-2">
                  <SubmitButton variant="outline" pendingText="Запазване…">
                    Запази данните за фактуриране
                  </SubmitButton>
                </div>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Матрица на правата"
              description="Роля → разрешение. Промяната на роли се извършва в „Персонал“."
              icon={KeyRound}
            />
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left text-[11.5px]">
                  <thead>
                    <tr className="bg-panel2">
                      <th className="sticky left-0 z-10 bg-panel2 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                        Право
                      </th>
                      {ROLE_DEFINITIONS.map((role) => (
                        <th
                          key={role.key}
                          className="px-2 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.04em] text-muted"
                          title={role.name}
                        >
                          {role.name.split(" ")[0]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {permissions.map((permission) => (
                      <tr key={permission} className="border-t border-hairline">
                        <td className="sticky left-0 z-10 bg-panel px-4 py-2 text-[11.5px]">
                          {PERMISSION_LABELS[permission]}
                        </td>
                        {ROLE_DEFINITIONS.map((role) => (
                          <td key={role.key} className="px-2 py-2 text-center">
                            {role.permissions.includes(permission) ? (
                              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                            ) : (
                              <span className="inline-block h-2 w-2 rounded-full bg-hairline" />
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader title="Състояние на системата" icon={Database} />
            <CardBody className="space-y-3 text-[12.5px]">
              <div className="flex items-center justify-between">
                <span className="text-muted">Режим на данните</span>
                <Badge tone={mode === "local" ? "warning" : "success"}>
                  {mode === "supabase"
                    ? "Supabase (продукция)"
                    : mode === "firebase"
                      ? "Firebase Realtime DB"
                      : "Локален файл"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Имейл известия</span>
                <Badge tone={process.env.RESEND_API_KEY ? "success" : "neutral"}>
                  {process.env.RESEND_API_KEY ? "Resend активен" : "не е конфигуриран"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Двуфакторна автентикация</span>
                <Badge tone={user.totp_enabled ? "success" : "neutral"}>
                  {user.totp_enabled ? "включена" : "изключена"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Профили</span>
                <span className="font-medium">{users}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Кандидатури</span>
                <span className="font-medium">{applications}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Документи</span>
                <span className="font-medium">{documents}</span>
              </div>
              <Link
                href="/dashboard/settings/profile"
                className="mt-2 block rounded-lg border border-hairline px-3 py-2 text-center text-[12px] text-muted hover:text-content"
              >
                Моят профил
              </Link>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Сигурност" description="Препоръки за администратори" icon={ShieldCheck} />
            <CardBody className="space-y-2.5 text-[12px] leading-6 text-muted">
              <p>• Включете двуфакторна автентикация за всички административни профили.</p>
              <p>• Не споделяйте пароли — всяка промяна се записва в журнала.</p>
              <p>• Проверявайте одиторския журнал при необичайна активност.</p>
              <p>• Съхранявайте кандидатските документи само в защитената среда на системата.</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Имейл интеграция" icon={Mail} />
            <CardBody>
              {process.env.RESEND_API_KEY ? (
                <Alert tone="success" title="Resend е конфигуриран">
                  Известията се изпращат автоматично до кандидатите и служителите.
                </Alert>
              ) : (
                <Alert tone="warning" title="Resend не е конфигуриран">
                  Задайте <code className="rounded bg-black/5 px-1 dark:bg-white/10">RESEND_API_KEY</code> и{" "}
                  <code className="rounded bg-black/5 px-1 dark:bg-white/10">RESEND_FROM</code>, за да
                  се изпращат имейли. Без тях известията остават само в системата (статус „не е
                  конфигуриран“).
                </Alert>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
