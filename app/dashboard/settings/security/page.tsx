import type { Metadata } from "next";
import { KeyRound, ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import QRCode from "qrcode";

import { CopyButton, SubmitButton } from "@/components/ui/client";
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
} from "@/components/ui/primitives";
import {
  cancelTwoFactorSetupAction,
  confirmTwoFactorAction,
  disableTwoFactorAction,
  startTwoFactorAction,
} from "@/lib/actions/settings";
import { requireUser } from "@/lib/auth/session";
import { getRow } from "@/lib/db";
import { otpauthUrl } from "@/lib/auth/totp";
import type { UserRow } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Сигурност" };
export const dynamic = "force-dynamic";

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const session = await requireUser();
  const sp = await searchParams;
  const user = await getRow<UserRow>("users", session.id);

  const pendingSetup = Boolean(user?.totp_secret && !user?.totp_enabled);
  const enabled = Boolean(user?.totp_enabled && user?.totp_secret);

  let qrDataUrl: string | null = null;
  let uri: string | null = null;
  if (pendingSetup && user?.totp_secret) {
    uri = otpauthUrl(user.totp_secret, session.email);
    qrDataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 220, color: { dark: "#17365D", light: "#FFFFFF" } });
  }

  return (
    <div>
      <Flash ok={sp.ok} err={sp.err} />

      <PageHeader
        title="Сигурност на профила"
        subtitle="Двуфакторна автентикация, сесии и защита на достъпа."
        actions={
          <Badge tone={enabled ? "success" : "warning"}>
            {enabled ? "2FA включена" : "2FA изключена"}
          </Badge>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title="Двуфакторна автентикация (TOTP)"
            description="Допълнителен код от приложение за автентикация при всяко влизане."
            icon={ShieldCheck}
          />
          <CardBody className="space-y-4">
            {enabled ? (
              <>
                <Alert tone="success" title="Защитата е активна">
                  При вход системата изисква 6-цифрен код от приложението (Google Authenticator,
                  Authy, 1Password, Microsoft Authenticator).
                </Alert>
                <form action={disableTwoFactorAction} className="space-y-3 border-t border-hairline pt-4">
                  <Field label="Потвърдете с парола" required hint="За да изключите защитата, въведете текущата си парола.">
                    <Input name="password" type="password" required autoComplete="current-password" />
                  </Field>
                  <SubmitButton
                    variant="danger"
                    pendingText="Изключване…"
                    confirm="Изключването на 2FA намалява сигурността на профила. Продължавате ли?"
                  >
                    <ShieldOff size={14} /> Изключи двуфакторната защита
                  </SubmitButton>
                </form>
              </>
            ) : pendingSetup && qrDataUrl ? (
              <>
                <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-start">
                  <div className="rounded-xl border border-hairline bg-white p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrDataUrl} alt="QR код за двуфакторна автентикация" width={200} height={200} />
                  </div>
                  <div className="space-y-2 text-[12.5px] leading-6 text-muted">
                    <p className="font-medium text-content">1. Сканирайте кода с приложението си.</p>
                    <p>2. Ако не можете да сканирате, въведете ключа ръчно:</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="break-all rounded-md bg-panel2 px-2 py-1 font-mono text-[11.5px] text-content">
                        {user?.totp_secret}
                      </code>
                      <CopyButton value={user?.totp_secret || ""} label="Копирай ключа" />
                    </div>
                    <p>3. Въведете генерирания 6-цифрен код по-долу.</p>
                  </div>
                </div>

                <form action={confirmTwoFactorAction} className="space-y-3 border-t border-hairline pt-4">
                  <Field label="Код за потвърждение" required>
                    <Input
                      name="code"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      placeholder="000000"
                      className="max-w-[180px] text-center font-mono text-[18px] tracking-[0.3em]"
                    />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <SubmitButton pendingText="Проверка…">Включи защитата</SubmitButton>
                  </div>
                </form>
                <form action={cancelTwoFactorSetupAction}>
                  <SubmitButton variant="ghost" size="sm" pendingText="…">
                    Откажи настройката
                  </SubmitButton>
                </form>
                {uri ? (
                  <p className="break-all text-[10.5px] text-muted">URI: {uri}</p>
                ) : null}
              </>
            ) : (
              <>
                <Alert tone="info" title="Препоръчително за административни профили">
                  Двуфакторната автентикация предпазва от неоторизиран достъп дори при компрометирана
                  парола. Настройката отнема под минута.
                </Alert>
                <form action={startTwoFactorAction}>
                  <SubmitButton pendingText="Генериране…">
                    <Smartphone size={15} /> Настрой двуфакторна автентикация
                  </SubmitButton>
                </form>
              </>
            )}
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Сесия" icon={KeyRound} />
            <CardBody className="space-y-2 text-[12.5px]">
              <div className="flex justify-between">
                <span className="text-muted">Профил</span>
                <span className="font-medium">{session.full_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Имейл</span>
                <span className="truncate">{session.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Последен вход</span>
                <span>{user?.last_login_at ? formatDateTime(user.last_login_at) : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Неуспешни опити</span>
                <span>{user?.failed_attempts ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Блокиран до</span>
                <span>{user?.locked_until ? formatDateTime(user.locked_until) : "—"}</span>
              </div>
              <div className="mt-2 rounded-lg bg-panel2 px-3 py-2 text-[11.5px] leading-5 text-muted">
                Сесията е валидна до 8 часа и се прекратява при изход. При 8 неуспешни опита
                профилът се блокира за 15 минути.
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Правила за сигурност" icon={ShieldCheck} />
            <CardBody className="space-y-2 text-[12px] leading-6 text-muted">
              <p>• Никога не споделяйте кода за 2FA с други лица.</p>
              <p>• При подозрение за компрометиран профил сменете паролата незабавно.</p>
              <p>• Използвайте служебен имейл и уникална парола.</p>
              <p>• Всички административни действия се записват с IP и час.</p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
