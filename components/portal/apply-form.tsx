"use client";

import { AlertCircle, CheckCircle2, FileUp, Loader2, Send, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useActionState } from "react";

import { submitApplicationAction } from "@/lib/actions/applications";
import { initialActionState } from "@/lib/actions/types";
import { Field, Input, Textarea } from "@/components/ui/primitives";
import { formatBytes } from "@/lib/utils";
import { MAX_FILE_SIZE } from "@/lib/validation/files";

const ACCEPT = ".pdf,.jpg,.jpeg,.png";

type UploadSlot = {
  name: string;
  label: string;
  hint: string;
  required?: boolean;
};

const SLOTS: UploadSlot[] = [
  {
    name: "cv",
    label: "Автобиография (CV)",
    hint: "Задължително. PDF, JPG или PNG до 10 MB.",
    required: true,
  },
  {
    name: "motivation_file",
    label: "Мотивационно писмо (файл)",
    hint: "По желание — ако не качвате файл, използвайте полето за текст по-долу.",
  },
  {
    name: "diploma",
    label: "Диплома за завършено образование",
    hint: "По желание. Сканирано копие, PDF или изображение.",
  },
  {
    name: "certificate",
    label: "Сертификати и квалификации",
    hint: "По желание. Един файл — обединете няколко документа в PDF.",
  },
];

function FileSlot({ slot, error }: { slot: UploadSlot; error?: string }) {
  const [file, setFile] = React.useState<File | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0] ?? null;
    setFile(picked);
  }

  function clear() {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const tooBig = file ? file.size > MAX_FILE_SIZE : false;

  return (
    <div>
      <div className="field-label">
        {slot.label}
        {slot.required ? <span className="ml-0.5 text-danger">*</span> : null}
      </div>
      <div
        className={
          "relative flex items-center gap-3 rounded-lg border border-dashed px-3.5 py-3 transition-colors " +
          (error || tooBig
            ? "border-red-300 bg-red-50/60 dark:border-red-800 dark:bg-red-900/10"
            : "border-hairline bg-panel2/60 hover:border-navy-300")
        }
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-panel text-muted ring-1 ring-hairline">
          {file ? <CheckCircle2 size={16} className="text-emerald-600" /> : <FileUp size={16} />}
        </span>
        <div className="min-w-0 flex-1">
          {file ? (
            <>
              <div className="truncate text-[13px] font-medium">{file.name}</div>
              <div className="text-[11.5px] text-muted">
                {formatBytes(file.size)}
                {tooBig ? " · превишава допустимия размер" : ""}
              </div>
            </>
          ) : (
            <>
              <div className="text-[13px] text-content">Изберете файл</div>
              <div className="text-[11.5px] text-muted">{slot.hint}</div>
            </>
          )}
        </div>
        {file ? (
          <button
            type="button"
            onClick={clear}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-panel hover:text-danger"
            aria-label="Премахни файла"
          >
            <X size={14} />
          </button>
        ) : null}
        <input
          ref={inputRef}
          id={slot.name}
          name={slot.name}
          type="file"
          accept={ACCEPT}
          onChange={onChange}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label={slot.label}
        />
      </div>
      {error ? <p className="mt-1 text-[12px] font-medium text-danger">{error}</p> : null}
    </div>
  );
}

export function ApplyForm({ jobId, jobTitle }: { jobId: string; jobTitle: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(submitApplicationAction, initialActionState);

  React.useEffect(() => {
    if (state.status === "success" && state.redirectTo) {
      router.replace(state.redirectTo);
      router.refresh();
    }
  }, [state, router]);

  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-6" noValidate>
      <input type="hidden" name="job_post_id" value={jobId} />

      {state.status === "error" && state.message ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] leading-6 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
          <AlertCircle size={16} className="mt-1 shrink-0" />
          <span>{state.message}</span>
        </div>
      ) : null}

      <section className="surface-card p-5">
        <div className="mb-4">
          <h2 className="text-[15px] font-semibold">Лични данни</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">
            Подавате кандидатура за позиция „{jobTitle}“.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Име" required htmlFor="first_name" error={errors.first_name}>
            <Input id="first_name" name="first_name" autoComplete="given-name" required maxLength={60} />
          </Field>
          <Field label="Презиме" htmlFor="middle_name" error={errors.middle_name}>
            <Input id="middle_name" name="middle_name" autoComplete="additional-name" maxLength={60} />
          </Field>
          <Field label="Фамилия" required htmlFor="last_name" error={errors.last_name}>
            <Input id="last_name" name="last_name" autoComplete="family-name" required maxLength={60} />
          </Field>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            label="Имейл"
            required
            htmlFor="email"
            error={errors.email}
            hint="На този адрес ще получите регистрационния номер и всички уведомления."
          >
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </Field>
          <Field label="Телефон" required htmlFor="phone" error={errors.phone}>
            <Input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+359 88 000 0000"
              required
            />
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Населено място" htmlFor="city" error={errors.city}>
            <Input id="city" name="city" autoComplete="address-level2" className="sm:max-w-xs" />
          </Field>
        </div>
      </section>

      <section className="surface-card p-5">
        <div className="mb-4">
          <h2 className="text-[15px] font-semibold">Мотивационно писмо</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">
            Опишете мотивацията си и професионалния си опит, свързан с позицията. Минимум 40 знака.
          </p>
        </div>
        <Field error={errors.motivation}>
          <Textarea
            name="motivation"
            rows={7}
            required
            maxLength={6000}
            placeholder="Защо кандидатствате за тази позиция и какъв опит имате…"
            aria-label="Мотивационно писмо"
          />
        </Field>
      </section>

      <section className="surface-card p-5">
        <div className="mb-4">
          <h2 className="text-[15px] font-semibold">Прикачени документи</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">
            Допустими формати: PDF, JPG, PNG. Максимален размер на файл: 10 MB.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {SLOTS.map((slot) => (
            <FileSlot key={slot.name} slot={slot} error={errors[slot.name]} />
          ))}
        </div>
      </section>

      <section className="surface-card p-5">
        <label className="flex items-start gap-2.5 text-[12.5px] leading-6 text-muted">
          <input type="checkbox" name="consent" className="mt-1 h-4 w-4 shrink-0 accent-navy-700" required />
          <span>
            Съгласен/на съм личните ми данни и прикачените документи да бъдат обработвани от
            институцията за целите на процедурата по подбор съгласно Регламент (ЕС) 2016/679 (GDPR) и{" "}
            <Link href="/privacy" className="font-medium text-navy-600 hover:underline dark:text-gold-300">
              Политиката за поверителност
            </Link>
            . Уведомен/а съм, че мога да оттегля съгласието си по всяко време.
          </span>
        </label>
        {errors.consent ? (
          <p className="mt-2 text-[12px] font-medium text-danger">{errors.consent}</p>
        ) : null}
        {errors.form ? <p className="mt-2 text-[12px] font-medium text-danger">{errors.form}</p> : null}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
          <p className="max-w-md text-[11.5px] leading-5 text-muted">
            След изпращане получавате уникален регистрационен номер. Запазете го — с него
            проследявате статуса на кандидатурата.
          </p>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-navy-700 px-6 text-[14px] font-medium text-white shadow-sm transition-colors hover:bg-navy-800 disabled:opacity-60"
          >
            {pending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {pending ? "Изпращане…" : "Изпрати кандидатурата"}
          </button>
        </div>
      </section>
    </form>
  );
}
