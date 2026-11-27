import { NextResponse } from "next/server";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

import { audit } from "@/lib/audit";
import { getCurrentUser, hasPermission, requestMeta } from "@/lib/auth/session";
import { getRow, getSettings, listRows } from "@/lib/db";
import { DOC_STATUS, DOC_TYPE } from "@/lib/labels";
import type { DocumentRow, UserRow } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NAVY = "17365D";
const GOLD = "C5A253";
const GREY = "4A5A70";

function labelCell(text: string) {
  return new TableCell({
    width: { size: 22, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    },
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, size: 18, color: GREY })],
      }),
    ],
  });
}

function valueCell(text: string) {
  return new TableCell({
    width: { size: 78, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    },
    children: [new Paragraph({ children: [new TextRun({ text, size: 19 })] })],
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Изисква се вход в системата" }, { status: 401 });
  }
  if (!hasPermission(user, "documents.view")) {
    return NextResponse.json({ error: "Няма достъп до документи" }, { status: 403 });
  }

  const { id } = await params;
  const document = await getRow<DocumentRow>("documents", id);
  if (!document) {
    return NextResponse.json({ error: "Документът не е намерен" }, { status: 404 });
  }

  const [settings, users] = await Promise.all([getSettings(), listRows<UserRow>("users")]);
  const author = users.find((u) => u.id === document.author_id);
  const approver = users.find((u) => u.id === document.approved_by);
  const institution = settings.institution_name || "ПИГ „Св. Климент Охридски“";

  const meta = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [labelCell("Вид документ"), valueCell(DOC_TYPE[document.doc_type].label)],
      }),
      new TableRow({
        children: [labelCell("Регистрационен №"), valueCell(document.number)],
      }),
      new TableRow({
        children: [labelCell("Дата"), valueCell(formatDate(document.created_at))],
      }),
      new TableRow({
        children: [labelCell("Статус"), valueCell(DOC_STATUS[document.status].label)],
      }),
      new TableRow({
        children: [labelCell("Версия"), valueCell(String(document.version))],
      }),
      new TableRow({
        children: [labelCell("Изготвил"), valueCell(author?.full_name || "—")],
      }),
    ],
  });

  const bodyParagraphs = document.body
    .split(/\n{2,}/)
    .map(
      (block) =>
        new Paragraph({
          spacing: { after: 160 },
          alignment: AlignmentType.JUSTIFIED,
          children: [new TextRun({ text: block.replace(/\n/g, " "), size: 21 })],
        }),
    );

  const doc = new Document({
    creator: institution,
    title: document.title,
    description: `${DOC_TYPE[document.doc_type].label} ${document.number}`,
    sections: [
      {
        properties: {
          page: { margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } },
        },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: "РЕПУБЛИКА БЪЛГАРИЯ",
                size: 16,
                color: GOLD,
                characterSpacing: 40,
                bold: true,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 60 },
            children: [new TextRun({ text: institution, size: 30, bold: true, color: NAVY })],
          }),
          new Paragraph({
            spacing: { after: 40 },
            children: [
              new TextRun({
                text: settings.institution_address || "",
                size: 17,
                color: GREY,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 240 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: NAVY, space: 6 } },
            children: [
              new TextRun({
                text: settings.institution_email || "",
                size: 17,
                color: GREY,
              }),
            ],
          }),

          new Paragraph({
            spacing: { before: 200, after: 40 },
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: DOC_TYPE[document.doc_type].label.toUpperCase(),
                size: 18,
                color: GREY,
                characterSpacing: 30,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 260 },
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: document.title, size: 26, bold: true, color: NAVY })],
          }),

          meta,

          new Paragraph({
            spacing: { before: 260, after: 200 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GOLD, space: 4 } },
            children: [new TextRun({ text: "", size: 4 })],
          }),

          ...bodyParagraphs,

          new Paragraph({
            spacing: { before: 600, after: 120 },
            children: [new TextRun({ text: "Изготвил:", size: 18, color: GREY })],
          }),
          new Paragraph({
            spacing: { after: 320 },
            children: [
              new TextRun({
                text: `${author?.full_name || "—"}${author?.position ? `, ${author.position}` : ""}`,
                size: 20,
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 240, after: 120 },
            children: [
              new TextRun({
                text: `Утвърдил: ${approver?.full_name || settings.institution_director || "—"}`,
                size: 18,
                color: GREY,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `${settings.institution_director_role || "Директор"}${document.approved_at ? ` · ${formatDateTime(document.approved_at)}` : ""}`,
                size: 18,
                color: GREY,
              }),
            ],
          }),

          new Paragraph({
            spacing: { before: 500 },
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: "E2E7EF", space: 6 } },
            children: [
              new TextRun({
                text: `PIG e-ADMIN · ${institution} · версия ${document.version} · ${document.number}`,
                size: 14,
                color: "8A96A6",
              }),
            ],
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);

  const metaInfo = await requestMeta();
  await audit({
    actor: user,
    action: "document.exported_docx",
    entity: "documents",
    entityId: document.id,
    meta: { number: document.number },
    ip: metaInfo.ip,
    userAgent: metaInfo.userAgent,
  });

  const fileName = `${document.number}-${document.title}.docx`.replace(/[\\/:*?"<>|]+/g, "-");

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
