"use client";

import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * Резервен екран за административния панел.
 *
 * Ако някоя заявка към базата се провали (напр. кратко прекъсване на връзката
 * при студен старт), потребителят вижда обяснение на български и бутон за
 * повторен опит, вместо сурова грешка на сървъра.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl py-16">
      <div className="surface-card p-8 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-50 text-amber-600 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:ring-amber-800">
          <AlertTriangle size={22} />
        </span>
        <h1 className="mt-4 font-display text-xl font-semibold">Разделът не се зареди</h1>
        <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-6 text-muted">
          Връзката с базата не отговори навреме. Данните не са загубени — опитайте отново,
          а ако проблемът се повтори, презаредете страницата след минута.
        </p>
        {error.digest ? (
          <p className="mt-3 text-[11.5px] text-muted">Код за поддръжка: {error.digest}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg bg-navy-700 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-navy-800"
          >
            <RefreshCw size={14} /> Опитай отново
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg border border-hairline px-4 py-2 text-[13px] font-medium text-content transition-colors hover:bg-panel2"
          >
            Към таблото
          </Link>
        </div>
      </div>
    </div>
  );
}
