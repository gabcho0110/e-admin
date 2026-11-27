export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];

export interface FileValidation {
  ok: boolean;
  error?: string;
}

/** Проверка на размер, разширение и MIME тип на прикачен файл. */
export function validateUpload(
  file: File | null | undefined,
  options: { required?: boolean; maxSize?: number } = {},
): FileValidation {
  const { required = false, maxSize = MAX_FILE_SIZE } = options;

  if (!file || typeof file === "string" || file.size === 0) {
    return required ? { ok: false, error: "Прикачете файл" } : { ok: true };
  }

  if (file.size > maxSize) {
    return { ok: false, error: `Файлът е твърде голям (макс. ${Math.round(maxSize / 1024 / 1024)} MB)` };
  }

  const name = file.name.toLowerCase();
  const hasAllowedExtension = ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));
  if (!hasAllowedExtension) {
    return { ok: false, error: "Позволени формати: PDF, JPG, PNG" };
  }

  if (file.type && !ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
    return { ok: false, error: "Непозволен тип съдържание" };
  }

  return { ok: true };
}

/** Подсигурява име на файл без опасни символи. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() || "file";
  return base
    .normalize("NFKD")
    .replace(/[^\w.\-А-Яа-я ]+/g, "_")
    .replace(/\s+/g, "-")
    .slice(0, 120);
}
