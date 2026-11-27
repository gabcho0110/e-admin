import { z } from "zod";

const email = z
  .string({ required_error: "Въведете имейл адрес" })
  .trim()
  .min(1, "Въведете имейл адрес")
  .email("Невалиден имейл адрес")
  .transform((value) => value.toLowerCase());

const password = z
  .string({ required_error: "Въведете парола" })
  .min(8, "Паролата трябва да е поне 8 знака")
  .regex(/[A-Za-zА-Яа-я]/, "Паролата трябва да съдържа поне една буква")
  .regex(/\d/, "Паролата трябва да съдържа поне една цифра");

const phone = z
  .string({ required_error: "Въведете телефон" })
  .trim()
  .min(6, "Въведете телефон за връзка")
  .regex(/^[+0-9 ()\-]{6,20}$/, "Невалиден телефонен номер");

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : ""));

const optionalUuid = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value !== "" ? value : null))
  .refine((value) => value === null || /^[0-9a-f-]{36}$/i.test(value), "Невалиден идентификатор");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Въведете парола"),
});

export const twoFactorSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "Кодът е 6 цифри"),
});

export const registerSchema = z
  .object({
    full_name: z.string().trim().min(3, "Въведете име и фамилия").max(120),
    email,
    phone: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : ""))
      .refine((v) => v === "" || /^[+0-9 ()\-]{6,20}$/.test(v), "Невалиден телефонен номер"),
    password,
    password_confirm: z.string(),
    consent: z.literal("on", { errorMap: () => ({ message: "Необходимо е съгласие за обработка на данни" }) }),
  })
  .refine((data) => data.password === data.password_confirm, {
    message: "Паролите не съвпадат",
    path: ["password_confirm"],
  });

export const applicationSchema = z.object({
  job_post_id: z.string().uuid("Невалидна обява"),
  first_name: z.string().trim().min(2, "Въведете име").max(60),
  middle_name: optionalText,
  last_name: z.string().trim().min(2, "Въведете фамилия").max(60),
  email,
  phone,
  city: optionalText,
  motivation: z.string().trim().min(40, "Мотивационното писмо трябва да е поне 40 знака").max(6000),
  consent: z.literal("on", { errorMap: () => ({ message: "Необходимо е съгласие за обработка на данни" }) }),
});

export const jobSchema = z.object({
  title: z.string().trim().min(3, "Въведете длъжност").max(160),
  department: z.string().trim().min(2, "Изберете направление"),
  employment_type: z.string().trim().min(2, "Изберете вид договор"),
  positions_count: z.coerce.number().int().min(1, "Поне 1 позиция").max(50),
  deadline: z.string().min(10, "Изберете краен срок"),
  description: z.string().trim().min(20, "Опишете длъжността (поне 20 знака)"),
  requirements: z.string().trim().min(10, "Опишете изискванията"),
  responsibilities: optionalText,
  salary_range: optionalText,
});

export const committeeSchema = z.object({
  name: z.string().trim().min(3, "Въведете наименование на комисията").max(180),
  purpose: optionalText,
  protocol_number: optionalText,
});

export const criterionSchema = z.object({
  cycle_id: z.string().uuid(),
  code: z.string().trim().min(1, "Въведете код").max(20),
  title: z.string().trim().min(3, "Въведете критерий").max(240),
  description: optionalText,
  responsible_id: optionalUuid,
  due_date: optionalText,
  target_score: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (!Number.isNaN(v) && v >= 0 && v <= 100), "Оценката е между 0 и 100"),
});

export const cycleSchema = z
  .object({
    title: z.string().trim().min(3, "Въведете наименование").max(200),
    kind: z.enum(["internal", "external"]),
    period_start: z.string().min(10, "Изберете начало"),
    period_end: z.string().min(10, "Изберете край"),
    lead_id: optionalUuid,
    description: optionalText,
  })
  .refine((data) => data.period_end >= data.period_start, {
    message: "Краят трябва да е след началото",
    path: ["period_end"],
  });

export const taskSchema = z.object({
  title: z.string().trim().min(3, "Въведете задача").max(200),
  description: optionalText,
  assignee_id: optionalUuid,
  due_date: optionalText,
  priority: z.enum(["low", "normal", "high", "critical"]),
  related_type: optionalText,
});

export const documentSchema = z.object({
  title: z.string().trim().min(3, "Въведете заглавие").max(240),
  doc_type: z.enum(["order", "protocol", "report", "reference", "plan", "program", "incoming", "outgoing", "policy"]),
  body: z.string().trim().min(10, "Съдържанието е задължително"),
  related_type: optionalText,
});

export const reportSchema = z.object({
  cycle_id: z.string().uuid(),
  title: z.string().trim().min(3, "Въведете заглавие").max(240),
  kind: z.enum(["self_assessment", "analysis", "report", "improvement_plan", "recommendation"]),
  summary: z.string().trim().min(20, "Опишете накратко съдържанието"),
});

export const STAFF_ROLES = [
  "superadmin",
  "director",
  "deputy_director",
  "accreditation_expert",
  "hr_expert",
  "committee_chair",
  "committee_member",
  "ict_officer",
  "teacher",
] as const;

export const staffSchema = z.object({
  full_name: z.string().trim().min(3, "Въведете име").max(120),
  email,
  position: z.string().trim().min(2, "Въведете длъжност").max(120),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : ""))
    .refine((v) => v === "" || /^[+0-9 ()\-]{6,20}$/.test(v), "Невалиден телефон"),
  role_keys: z
    .array(z.enum(STAFF_ROLES))
    .min(1, "Изберете поне една роля")
    .max(STAFF_ROLES.length),
  password: z.string().min(8, "Временната парола е поне 8 знака"),
});

export const evaluationSchema = z.object({
  application_id: z.string().uuid(),
  committee_id: z.string().uuid(),
});

/* ─────────────────────────── Фактури ─────────────────────────── */

export const INVOICE_TYPES = [
  "invoice",
  "proforma",
  "debit_note",
  "credit_note",
  "storno",
] as const;

export const INVOICE_STATUSES = ["draft", "issued", "paid", "cancelled"] as const;

export const PAYMENT_METHODS = ["bank", "cash", "card", "other"] as const;

const isoDateField = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Невалидна дата (ГГГГ-ММ-ДД)");

/** Един ред от фактура. */
export const invoiceItemSchema = z.object({
  name: z.string().trim().min(1, "Въведете описание на реда").max(200),
  unit: z.string().trim().max(20).optional().transform((value) => (value ? value : "бр.")),
  quantity: z.coerce
    .number({ invalid_type_error: "Невалидно количество" })
    .positive("Количеството трябва да е положително")
    .max(1_000_000, "Количеството е твърде голямо"),
  unit_price: z.coerce
    .number({ invalid_type_error: "Невалидна цена" })
    .min(0, "Цената не може да е отрицателна")
    .max(100_000_000, "Цената е твърде голяма"),
  vat_rate: z.coerce.number().min(0, "Невалидна ставка").max(100, "Невалидна ставка"),
});

export const invoiceSchema = z.object({
  doc_type: z.enum(INVOICE_TYPES, { errorMap: () => ({ message: "Невалиден вид документ" }) }),
  client_id: optionalUuid,
  client_name: z.string().trim().min(2, "Въведете получател").max(200),
  client_eik: optionalText,
  client_vat: optionalText,
  client_mol: optionalText,
  client_address: optionalText,
  client_city: optionalText,
  client_country: optionalText,
  client_email: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : ""))
    .refine((value) => value === "" || /.+@.+\..+/.test(value), "Невалиден имейл адрес"),
  issue_date: isoDateField,
  due_date: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : ""))
    .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), "Невалиден падеж"),
  currency: z.enum(["EUR", "BGN"], { errorMap: () => ({ message: "Невалидна валута" }) }),
  payment_method: z.enum(PAYMENT_METHODS, {
    errorMap: () => ({ message: "Невалиден начин на плащане" }),
  }),
  basis: optionalText,
  note: optionalText,
  related_invoice_id: optionalUuid,
  items: z.array(invoiceItemSchema).min(1, "Добавете поне един ред").max(60, "Твърде много редове"),
});

export const invoiceClientSchema = z.object({
  name: z.string().trim().min(2, "Въведете наименование").max(200),
  eik: optionalText,
  vat_number: optionalText,
  mol: optionalText,
  address: optionalText,
  city: optionalText,
  country: optionalText,
  email: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : ""))
    .refine((value) => value === "" || /.+@.+\..+/.test(value), "Невалиден имейл адрес"),
  phone: optionalText,
  note: optionalText,
});

export type FieldErrors = Record<string, string>;

export function fieldErrors(error: z.ZodError): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}

export function formValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}
