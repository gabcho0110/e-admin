import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/auth/session";
import { getRow, getSettings, listRows } from "@/lib/db";
import { DOC_TYPE } from "@/lib/labels";
import type { DocumentRow, UserRow } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Печат на документ" };
export const dynamic = "force-dynamic";

export default async function DocumentPrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("documents.view");
  const { id } = await params;

  const document = await getRow<DocumentRow>("documents", id);
  if (!document) notFound();

  const [settings, users] = await Promise.all([getSettings(), listRows<UserRow>("users")]);
  const author = users.find((u) => u.id === document.author_id);
  const approver = users.find((u) => u.id === document.approved_by);

  return (
    <article className="print-sheet mx-auto max-w-[820px] bg-white px-10 py-12 text-[#111] shadow-card print:shadow-none">
      {/* Шапка */}
      <header className="border-b-2 border-[#17365D] pb-5">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#C5A253]">Република България</div>
            <div className="mt-1 font-display text-[19px] font-semibold leading-tight text-[#17365D]">
              {settings.institution_name || "ПИГ „Св. Климент Охридски“"}
            </div>
            <div className="mt-1 text-[10.5px] leading-5 text-[#4A5A70]">
              {settings.institution_address ? <div>{settings.institution_address}</div> : null}
              {settings.institution_email ? <div>{settings.institution_email}</div> : null}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[9.5px] uppercase tracking-[0.14em] text-[#7A8798]">Изходящ №</div>
            <div className="font-mono text-[12.5px] font-semibold text-[#17365D]">{document.number}</div>
            <div className="mt-1 text-[10px] text-[#4A5A70]">{formatDate(document.created_at)}</div>
          </div>
        </div>
      </header>

      <div className="mt-6 text-center">
        <div className="text-[10.5px] uppercase tracking-[0.16em] text-[#7A8798]">
          {DOC_TYPE[document.doc_type].label}
        </div>
        <h1 className="mt-1.5 font-display text-[21px] font-semibold leading-snug text-[#17365D]">
          {document.title}
        </h1>
      </div>

      <div className="mt-7 whitespace-pre-wrap text-[13px] leading-[1.9] text-[#1F2937]">{document.body}</div>

      <div className="mt-12 grid grid-cols-2 gap-8 text-[11px] text-[#4A5A70]">
        <div>
          <div className="mb-8 text-[10px] uppercase tracking-[0.1em]">Изготвил</div>
          <div className="border-t border-[#C7CED8] pt-1.5">
            {author?.full_name || "—"}
            {author?.position ? <div className="text-[10px]">{author.position}</div> : null}
          </div>
        </div>
        <div>
          <div className="mb-8 text-[10px] uppercase tracking-[0.1em]">Утвърдил</div>
          <div className="border-t border-[#C7CED8] pt-1.5">
            {approver?.full_name || settings.institution_director || "—"}
            <div className="text-[10px]">{settings.institution_director_role || "Директор"}</div>
          </div>
        </div>
      </div>

      <footer className="mt-14 flex items-center justify-between border-t border-[#E2E7EF] pt-3 text-[9px] text-[#8A96A6]">
        <span>PIG e-ADMIN · {settings.institution_name}</span>
        <span>
          Версия {document.version} · {document.status === "approved" ? "одобрен" : "работна версия"}
        </span>
      </footer>
    </article>
  );
}
