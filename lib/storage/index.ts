import "server-only";

import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { dataMode } from "@/lib/db";
import { fbReadNode, fbWriteNode } from "@/lib/db/firebase";
import { localDataDir } from "@/lib/db/local";
import { isSupabaseConfigured, supabaseAdmin } from "@/lib/db/supabase";
import { safeFileName } from "@/lib/validation/files";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "candidate-documents";
const UPLOAD_ROOT = "uploads";

/**
 * В Firebase режим файловете се пазят в Realtime Database на части по 2 MB
 * (base64), защото Storage не е активиран в проекта. Така качените документи
 * оцеляват при рестарт на средата, както и останалите данни.
 */
const FIREBASE_CHUNK = 2 * 1024 * 1024;
const FIREBASE_ROOT = "_files";

/**
 * RTDB не допуска „.“, „#“, „$“, „[“, „]“ в имената на възли, а имената на
 * файловете почти винаги съдържат разширение. Затова ключът се нормализира,
 * а оригиналното име и MIME типът се пазят в метаданните на възела.
 */
function firebaseSafeKey(key: string): string {
  return key.replace(/[.#$\[\]]/g, "_");
}

export interface StoredFile {
  path: string;
  name: string;
  mime: string;
  size: number;
}

function mimeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

/** Качва файл в Supabase Storage или в локалната папка .data/uploads. */
export async function saveUpload(file: File, folder: string): Promise<StoredFile> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = safeFileName(file.name || "document.pdf");
  const key = `${folder}/${randomUUID()}-${name}`;
  const mime = file.type || mimeFromName(name);

  if (isSupabaseConfigured()) {
    const { error } = await supabaseAdmin()
      .storage.from(BUCKET)
      .upload(key, buffer, { contentType: mime, upsert: false });
    if (error) throw new Error(`Качването не успя: ${error.message}`);
    return { path: key, name, mime, size: buffer.length };
  }

  if (dataMode() === "firebase") {
    const safeKey = firebaseSafeKey(key);
    const nodePath = `${FIREBASE_ROOT}/${safeKey}`;
    const chunkCount = Math.max(1, Math.ceil(buffer.length / FIREBASE_CHUNK));
    await fbWriteNode(nodePath, {
      name,
      mime,
      size: buffer.length,
      chunkCount,
      created_at: new Date().toISOString(),
    });
    for (let index = 0; index < chunkCount; index += 1) {
      const part = buffer
        .subarray(index * FIREBASE_CHUNK, (index + 1) * FIREBASE_CHUNK)
        .toString("base64");
      await fbWriteNode(`${nodePath}/parts/${index}`, part);
    }
    return { path: safeKey, name, mime, size: buffer.length };
  }

  const target = path.join(localDataDir(), UPLOAD_ROOT, key);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, buffer);
  return { path: key, name, mime, size: buffer.length };
}

/** Връща съдържанието на файл (локален режим или Firebase RTDB). */
export async function readStoredFile(key: string): Promise<{ buffer: Buffer; mime: string } | null> {
  if (!key || key.includes("..")) return null;

  if (dataMode() === "firebase") {
    const node = await fbReadNode<{
      mime?: string;
      chunkCount?: number;
      parts?: Record<string, string>;
    }>(`${FIREBASE_ROOT}/${firebaseSafeKey(key)}`);
    if (!node || !node.parts) return null;
    const count = node.chunkCount || Object.keys(node.parts).length;
    const chunks: Buffer[] = [];
    for (let index = 0; index < count; index += 1) {
      const part = node.parts[String(index)];
      if (!part) return null;
      chunks.push(Buffer.from(part, "base64"));
    }
    return { buffer: Buffer.concat(chunks), mime: node.mime || mimeFromName(key) };
  }

  const target = path.resolve(localDataDir(), UPLOAD_ROOT, key);
  const root = path.resolve(localDataDir(), UPLOAD_ROOT);
  if (!target.startsWith(root + path.sep)) return null;
  try {
    const buffer = await fs.readFile(target);
    return { buffer, mime: mimeFromName(key) };
  } catch {
    return null;
  }
}

/** Подписан линк за сваляне (Supabase) или null, ако се ползва локален режим. */
export async function signedUrl(key: string, expiresIn = 120): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await supabaseAdmin().storage.from(BUCKET).createSignedUrl(key, expiresIn);
  if (error) return null;
  return data?.signedUrl ?? null;
}
