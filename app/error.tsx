"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

/** Общ резервен екран за публичните страници. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl items-center px-5">
      <div className="surface-card w-full p-8 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-50 text-amber-600 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:ring-amber-800">
          <AlertTriangle size={22} />
        </span>
        <h1 className="mt-4 font-display text-xl font-semibold">Страницата не се зареди</h1>
        <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-6 text-muted">
          Възникна временна техническа грешка. Опитайте отново след няколко секунди.
        </p>
        {error.digest ? (
          <p className="mt-3 text-[11.5px] text-muted">Код за поддръжка: {error.digest}</p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-navy-700 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-navy-800"
        >
          <RefreshCw size={14} /> Опитай отново
        </button>
      </div>
    </div>
  );
}
