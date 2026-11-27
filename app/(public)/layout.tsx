import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { getSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <PublicHeader institution={settings.institution_name || "ПИГ „Св. Климент Охридски“"} />
      <main className="flex-1">{children}</main>
      <PublicFooter settings={settings} />
    </div>
  );
}
