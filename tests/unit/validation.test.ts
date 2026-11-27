import { describe, expect, it } from "vitest";

import {
  applicationSchema,
  criterionSchema,
  cycleSchema,
  documentSchema,
  loginSchema,
  registerSchema,
  staffSchema,
  taskSchema,
} from "@/lib/validation/schemas";
import { MAX_FILE_SIZE, safeFileName, validateUpload } from "@/lib/validation/files";

const uuid = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

function fakeFile(name: string, size: number, type = "application/pdf"): File {
  const bytes = new Uint8Array(size);
  return new File([bytes], name, { type });
}

describe("валидация на вход", () => {
  it("приема валиден вход и нормализира имейла", () => {
    const parsed = loginSchema.safeParse({ email: "  Ivan@PIG-Ohridski.BG ", password: "x" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe("ivan@pig-ohridski.bg");
  });

  it("отхвърля невалиден имейл и празна парола", () => {
    expect(loginSchema.safeParse({ email: "не-имейл", password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.bg", password: "" }).success).toBe(false);
  });

  it("изисква съгласие при регистрация", () => {
    const base = {
      full_name: "Иван Петров",
      email: "ivan@example.com",
      phone: "",
      password: "Парола123",
      password_confirm: "Парола123",
    };
    expect(registerSchema.safeParse(base).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, consent: "on" }).success).toBe(true);
    expect(
      registerSchema.safeParse({ ...base, password_confirm: "друга", consent: "on" }).success,
    ).toBe(false);
  });

  it("изисква поне 40 знака мотивация при кандидатстване", () => {
    const base = {
      job_post_id: uuid,
      first_name: "Иван",
      middle_name: "",
      last_name: "Петров",
      email: "ivan@example.com",
      phone: "+359 88 123 4567",
      city: "София",
      motivation: "Кратко.",
      consent: "on",
    };
    const short = applicationSchema.safeParse(base);
    expect(short.success).toBe(false);
    if (!short.success) {
      expect(short.error.issues[0].path).toContain("motivation");
    }
    expect(
      applicationSchema.safeParse({ ...base, motivation: "а".repeat(41) }).success,
    ).toBe(true);
  });

  it("валидира край на период след начало", () => {
    const base = {
      title: "Вътрешна акредитация 2026",
      kind: "internal" as const,
      period_start: "2026-01-01",
      period_end: "2025-12-31",
      description: "",
    };
    expect(cycleSchema.safeParse(base).success).toBe(false);
    expect(cycleSchema.safeParse({ ...base, period_end: "2026-06-30" }).success).toBe(true);
  });

  it("ограничава целевата оценка на критерий до 0–100", () => {
    const base = {
      cycle_id: uuid,
      code: "К1",
      title: "Качество на обучението",
      target_score: "101",
    };
    expect(criterionSchema.safeParse(base).success).toBe(false);
    expect(criterionSchema.safeParse({ ...base, target_score: "85" }).success).toBe(true);
  });

  it("приема само позволени типове документи", () => {
    expect(
      documentSchema.safeParse({
        title: "Заповед за прием",
        doc_type: "order",
        body: "Съдържание на заповедта.",
      }).success,
    ).toBe(true);
    expect(
      documentSchema.safeParse({ title: "Нещо", doc_type: "меморандум", body: "текст" }).success,
    ).toBe(false);
  });

  it("изисква приоритет от допустимите стойности при задача", () => {
    const base = { title: "Подготовка на отчет", priority: "нормален" };
    expect(taskSchema.safeParse(base).success).toBe(false);
    expect(taskSchema.safeParse({ ...base, priority: "high" }).success).toBe(true);
  });

  it("не позволява роля „candidate“ през служебния формуляр", () => {
    const base = {
      full_name: "Иван Петров",
      email: "ivan@example.com",
      position: "Учител",
      phone: "",
      role_keys: ["candidate"],
      password: "Парола123",
    };
    expect(staffSchema.safeParse(base).success).toBe(false);
    expect(staffSchema.safeParse({ ...base, role_keys: ["teacher"] }).success).toBe(true);
  });

  it("приема няколко роли едновременно", () => {
    const base = {
      full_name: "Мария Иванова",
      email: "maria@example.com",
      position: "Заместник-директор",
      phone: "",
      role_keys: ["deputy_director", "teacher"],
      password: "Парола123",
    };
    expect(staffSchema.safeParse(base).success).toBe(true);
    // поне една роля е задължителна
    expect(staffSchema.safeParse({ ...base, role_keys: [] }).success).toBe(false);
  });
});

describe("прикачени файлове", () => {
  it("изисква файл, когато е задължителен", () => {
    expect(validateUpload(null, { required: true }).ok).toBe(false);
    expect(validateUpload(null, { required: false }).ok).toBe(true);
  });

  it("приема PDF, JPG и PNG", () => {
    expect(validateUpload(fakeFile("cv.pdf", 1024)).ok).toBe(true);
    expect(validateUpload(fakeFile("scan.jpg", 1024, "image/jpeg")).ok).toBe(true);
    expect(validateUpload(fakeFile("scan.png", 1024, "image/png")).ok).toBe(true);
  });

  it("отхвърля опасни и неподдържани формати", () => {
    expect(validateUpload(fakeFile("script.exe", 1024, "application/octet-stream")).ok).toBe(false);
    expect(validateUpload(fakeFile("cv.docx", 1024)).ok).toBe(false);
    expect(validateUpload(fakeFile("cv.pdf", 1024, "text/html")).ok).toBe(false);
  });

  it("отхвърля файл над 10 MB", () => {
    expect(validateUpload(fakeFile("big.pdf", MAX_FILE_SIZE + 1)).ok).toBe(false);
    expect(validateUpload(fakeFile("ok.pdf", MAX_FILE_SIZE)).ok).toBe(true);
  });

  it("почиства имената на файловете", () => {
    expect(safeFileName("../../etc/passwd")).toBe("passwd");
    expect(safeFileName("Моята автобиография.pdf")).toBe("Моята-автобиография.pdf");
    expect(safeFileName("a<b>c:d.pdf")).toBe("a_b_c_d.pdf");
  });
});
