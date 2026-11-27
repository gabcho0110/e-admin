import { PrintButton } from "@/components/ui/client";

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas py-8 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[820px] items-center justify-between px-4">
        <a href="/dashboard" className="text-[12px] text-muted hover:text-content">
          ← Обратно в системата
        </a>
        <PrintButton label="Печат / Запази като PDF" />
      </div>
      <div className="mx-auto max-w-[820px] px-4 print:px-0">{children}</div>
    </div>
  );
}
