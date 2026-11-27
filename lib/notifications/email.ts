import "server-only";

interface EmailInput {
  to: string | string[];
  subject: string;
  html: string;
}

export type EmailResult = "sent" | "skipped" | "failed";

/**
 * Изпраща имейл през Resend, ако е зададен RESEND_API_KEY.
 * Без ключ връща "skipped" — известието остава само в системата.
 * Никога не хвърля, за да не блокира основното действие.
 */
export async function sendEmail({ to, subject, html }: EmailInput): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return "skipped";
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "PIG e-ADMIN <no-reply@pig-ohridski.bg>",
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
      }),
    });
    return response.ok ? "sent" : "failed";
  } catch (error) {
    console.error("[email] грешка при изпращане", error);
    return "failed";
  }
}

export function emailLayout(title: string, bodyHtml: string, footer?: string): string {
  return `<!doctype html><html lang="bg"><body style="margin:0;background:#F3F5F8;font-family:Segoe UI,Arial,sans-serif;color:#202B3C">
  <div style="max-width:600px;margin:0 auto;padding:32px 20px">
    <div style="background:#17365D;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0">
      <div style="font-size:12px;letter-spacing:.16em;color:#C5A253;text-transform:uppercase">PIG e-ADMIN</div>
      <div style="font-size:19px;margin-top:6px">${title}</div>
    </div>
    <div style="background:#fff;padding:24px;border:1px solid #E2E7EF;border-top:0;border-radius:0 0 12px 12px;font-size:14px;line-height:1.7">
      ${bodyHtml}
      <hr style="border:none;border-top:1px solid #E2E7EF;margin:22px 0" />
      <div style="font-size:12px;color:#5B6B82">${footer || "ПИГ „Св. Климент Охридски“ · PIG e-ADMIN 1.0"}</div>
    </div>
  </div></body></html>`;
}
