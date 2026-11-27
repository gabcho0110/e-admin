import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/auth/session";
import { getRow, getSettings, listRows } from "@/lib/db";
import { APPLICATION_STATUS, COMMITTEE_ROLE } from "@/lib/labels";
import type {
  ApplicationRow,
  CommitteeMemberRow,
  CommitteeRow,
  EvaluationCriterionRow,
  EvaluationRow,
  UserRow,
} from "@/lib/types";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Протокол" };
export const dynamic = "force-dynamic";

export default async function ProtocolPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("committees.manage");
  const { id } = await params;

  const committee = await getRow<CommitteeRow>("committees", id);
  if (!committee) notFound();

  const [members, criteria, applications, evaluations, users, settings] = await Promise.all([
    listRows<CommitteeMemberRow>("committee_members", { where: { committee_id: id } }),
    listRows<EvaluationCriterionRow>("evaluation_criteria", { where: { committee_id: id }, orderBy: "position", ascending: true }),
    listRows<ApplicationRow>("applications", { where: { committee_id: id } }),
    listRows<EvaluationRow>("evaluations", { where: { committee_id: id } }),
    listRows<UserRow>("users"),
    getSettings(),
  ]);

  const userName = (userId: string | null) => users.find((u) => u.id === userId)?.full_name || "—";

  const ranking = applications
    .map((application) => ({
      application,
      scores: members.map((member) => {
        const rows = evaluations.filter(
          (e) => e.application_id === application.id && e.member_id === member.user_id,
        );
        const totalWeight = criteria.reduce((sum, c) => sum + Number(c.weight), 0) || 1;
        const weighted = rows.reduce((sum, row) => {
          const criterion = criteria.find((c) => c.id === row.criterion_id);
          return sum + (Number(row.score) / Number(criterion?.max_score || 10)) * Number(criterion?.weight || 1);
        }, 0);
        return { member, percent: rows.length ? (weighted / totalWeight) * 100 : null };
      }),
    }))
    .sort((a, b) => (b.application.score_total ?? 0) - (a.application.score_total ?? 0));

  return (
    <article className="print-sheet mx-auto max-w-[820px] bg-white px-10 py-12 text-[#111] shadow-card print:shadow-none">
      <header className="border-b-2 border-[#17365D] pb-5">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#C5A253]">Протокол</div>
            <div className="mt-1 font-display text-[18px] font-semibold leading-tight text-[#17365D]">
              {settings.institution_name || "ПИГ „Св. Климент Охридски“"}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[9.5px] uppercase tracking-[0.14em] text-[#7A8798]">№</div>
            <div className="font-mono text-[12.5px] font-semibold text-[#17365D]">
              {committee.protocol_number || "—"}
            </div>
            <div className="mt-1 text-[10px] text-[#4A5A70]">{formatDate(committee.created_at)}</div>
          </div>
        </div>
      </header>

      <h1 className="mt-6 text-center font-display text-[20px] font-semibold text-[#17365D]">
        {committee.name}
      </h1>
      <p className="mt-1 text-center text-[11px] text-[#4A5A70]">
        {committee.purpose || "Протокол от заседание на комисията"}
      </p>

      <section className="mt-8">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#17365D]">
          1. Състав на комисията
        </h2>
        <table className="w-full border-collapse text-[11.5px]">
          <thead>
            <tr className="bg-[#F3F5F8] text-left text-[10px] uppercase tracking-[0.06em] text-[#4A5A70]">
              <th className="border border-[#DDE3EC] px-2 py-1.5">№</th>
              <th className="border border-[#DDE3EC] px-2 py-1.5">Име</th>
              <th className="border border-[#DDE3EC] px-2 py-1.5">Роля</th>
              <th className="border border-[#DDE3EC] px-2 py-1.5">Конфликт на интереси</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member, index) => (
              <tr key={member.id}>
                <td className="border border-[#DDE3EC] px-2 py-1.5">{index + 1}</td>
                <td className="border border-[#DDE3EC] px-2 py-1.5">{userName(member.user_id)}</td>
                <td className="border border-[#DDE3EC] px-2 py-1.5">{COMMITTEE_ROLE[member.member_role]}</td>
                <td className="border border-[#DDE3EC] px-2 py-1.5">
                  {member.conflict_declared ? "деклариран" : "няма"}
                </td>
              </tr>
            ))}
            {members.length === 0 ? (
              <tr>
                <td colSpan={4} className="border border-[#DDE3EC] px-2 py-2 text-center text-[#7A8798]">
                  Няма вписани членове.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#17365D]">
          2. Критерии за оценяване
        </h2>
        <ul className="list-inside list-disc text-[11.5px] leading-6">
          {criteria.map((criterion) => (
            <li key={criterion.id}>
              {criterion.name} — макс. {Number(criterion.max_score)}, тегло {Number(criterion.weight)}
            </li>
          ))}
          {criteria.length === 0 ? <li>Няма зададени критерии.</li> : null}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#17365D]">
          3. Класиране на кандидатите
        </h2>
        <table className="w-full border-collapse text-[11.5px]">
          <thead>
            <tr className="bg-[#F3F5F8] text-left text-[10px] uppercase tracking-[0.06em] text-[#4A5A70]">
              <th className="border border-[#DDE3EC] px-2 py-1.5">Място</th>
              <th className="border border-[#DDE3EC] px-2 py-1.5">Кандидат</th>
              <th className="border border-[#DDE3EC] px-2 py-1.5">Рег. №</th>
              <th className="border border-[#DDE3EC] px-2 py-1.5">Резултат</th>
              <th className="border border-[#DDE3EC] px-2 py-1.5">Статус</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map(({ application }, index) => (
              <tr key={application.id}>
                <td className="border border-[#DDE3EC] px-2 py-1.5">{index + 1}</td>
                <td className="border border-[#DDE3EC] px-2 py-1.5">
                  {application.first_name} {application.last_name}
                </td>
                <td className="border border-[#DDE3EC] px-2 py-1.5 font-mono text-[10.5px]">
                  {application.registration_number}
                </td>
                <td className="border border-[#DDE3EC] px-2 py-1.5">
                  {application.score_total != null ? `${application.score_total.toFixed(2)} %` : "—"}
                </td>
                <td className="border border-[#DDE3EC] px-2 py-1.5">
                  {APPLICATION_STATUS[application.status].label}
                </td>
              </tr>
            ))}
            {ranking.length === 0 ? (
              <tr>
                <td colSpan={5} className="border border-[#DDE3EC] px-2 py-2 text-center text-[#7A8798]">
                  Няма възложени кандидатури към комисията.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#17365D]">
          4. Решение на комисията
        </h2>
        <p className="text-[11.5px] leading-7">
          Комисията приключва работата си с обобщени резултати по критериите. Индивидуалните
          оценъчни карти се съхраняват в електронната система и са достъпни единствено за членовете
          на комисията и директора. Окончателното решение се утвърждава от директора със заповед.
        </p>
      </section>

      <div className="mt-12 grid grid-cols-3 gap-6 text-[10.5px] text-[#4A5A70]">
        {members.slice(0, 3).map((member) => (
          <div key={member.id}>
            <div className="mb-8 uppercase tracking-[0.08em]">{COMMITTEE_ROLE[member.member_role]}</div>
            <div className="border-t border-[#C7CED8] pt-1.5">{userName(member.user_id)}</div>
          </div>
        ))}
      </div>

      <footer className="mt-12 flex items-center justify-between border-t border-[#E2E7EF] pt-3 text-[9px] text-[#8A96A6]">
        <span>PIG e-ADMIN · {settings.institution_name}</span>
        <span>Документът е генериран автоматично от системата</span>
      </footer>
    </article>
  );
}
