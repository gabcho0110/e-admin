import { NextResponse } from "next/server";

import { getCurrentUser, hasPermission } from "@/lib/auth/session";
import { listRows } from "@/lib/db";
import { readStoredFile, signedUrl } from "@/lib/storage";
import type { CandidateDocumentRow, EvidenceRow } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Защитено сваляне на прикачен файл.
 *
 * Достъпът се проверява по права, а не по знание на пътя:
 *  - кандидатури → „applications.review“ (HR, директор, заместник, супер админ);
 *  - доказателства по акредитация → „accreditation.view“.
 * Кандидатът НЕ може да сваля файлове през този маршрут — той вижда само
 * собствените си данни в публичното проследяване.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  const key = segments.join("/");

  if (!key || key.includes("..")) {
    return NextResponse.json({ error: "Невалиден път" }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Изисква се вход в системата" }, { status: 401 });
  }

  const candidateDocs = await listRows<CandidateDocumentRow>("candidate_documents", {
    where: { storage_path: key },
    limit: 1,
  });
  const evidence = candidateDocs.length
    ? []
    : await listRows<EvidenceRow>("evidence", { where: { storage_path: key }, limit: 1 });

  let allowed = false;

  if (candidateDocs.length) {
    allowed = hasPermission(user, "applications.review");
  } else if (evidence.length) {
    allowed = hasPermission(user, "accreditation.manage");
  } else {
    // Непознат файл: позволяваме само на супер администратор (диагностика).
    allowed = user.roles.includes("superadmin");
  }

  if (!allowed) {
    return NextResponse.json({ error: "Няма достъп до този файл" }, { status: 403 });
  }

  const remote = await signedUrl(key, 120);
  if (remote) return NextResponse.redirect(remote);

  const stored = await readStoredFile(key);
  if (!stored) {
    return NextResponse.json({ error: "Файлът не е намерен" }, { status: 404 });
  }

  const fileName = key.split("/").pop() || "document";
  return new NextResponse(new Uint8Array(stored.buffer), {
    headers: {
      "Content-Type": stored.mime,
      "Content-Length": String(stored.buffer.length),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** Проверка дали файлът съществува и към какво е прикачен (без съдържание). */
export async function HEAD(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const response = await GET(request, context);
  return new NextResponse(null, { status: response.status, headers: response.headers });
}

export const runtime = "nodejs";
