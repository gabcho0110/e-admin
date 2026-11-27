import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Gavel,
  ListChecks,
  Plus,
  Send,
  ShieldAlert,
  Trash2,
  UsersRound,
} from "lucide-react";

import { SubmitButton } from "@/components/ui/client";
import { Flash } from "@/components/ui/flash";
import {
  Alert,
  Badge,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import {
  addCommitteeMemberAction,
  addEvaluationCriterionAction,
  closeCommitteeAction,
  declareConflictAction,
  deleteEvaluationCriterionAction,
  remindCommitteeAction,
  removeCommitteeMemberAction,
  setCommitteeStatusAction,
  updateCommitteeAction,
} from "@/lib/actions/committees";
import { requirePermission } from "@/lib/auth/session";
import { getRow, listRows } from "@/lib/db";
import { APPLICATION_STATUS, COMMITTEE_ROLE, COMMITTEE_STATUS } from "@/lib/labels";
import type {
  ApplicationRow,
  CommitteeMemberRow,
  CommitteeRow,
  EvaluationCriterionRow,
  EvaluationRow,
  UserRoleRow,
  UserRow,
} from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Комисия" };
export const dynamic = "force-dynamic";

export default async function CommitteeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const user = await requirePermission("committees.manage");
  const { id } = await params;
  const sp = await searchParams;

  const committee = await getRow<CommitteeRow>("committees", id);
  if (!committee) notFound();

  const [members, criteria, applications, evaluations, users, roles] = await Promise.all([
    listRows<CommitteeMemberRow>("committee_members", { where: { committee_id: id } }),
    listRows<EvaluationCriterionRow>("evaluation_criteria", { where: { committee_id: id }, orderBy: "position", ascending: true }),
    listRows<ApplicationRow>("applications", { where: { committee_id: id } }),
    listRows<EvaluationRow>("evaluations", { where: { committee_id: id } }),
    listRows<UserRow>("users"),
    listRows<UserRoleRow>("user_roles"),
  ]);

  const candidateIds = new Set(
    roles.filter((r) => r.role_key === "candidate").map((r) => r.user_id),
  );
  const staff = users.filter((u) => u.is_active && !candidateIds.has(u.id));
  const memberIds = new Set(members.map((m) => m.user_id));
  const available = staff.filter((u) => !memberIds.has(u.id));
  const userName = (userId: string) => users.find((u) => u.id === userId)?.full_name || "—";

  const completedCards = new Set(evaluations.map((e) => `${e.application_id}|${e.member_id}`)).size;

  return (
    <div>
      <Link
        href="/dashboard/committees"
        className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-content"
      >
        <ArrowLeft size={13} /> Към комисиите
      </Link>

      <Flash ok={sp.ok} err={sp.err} />

      <PageHeader
        title={committee.name}
        subtitle={committee.purpose || "Без описано предназначение"}
        eyebrow={`Комисия · ${COMMITTEE_STATUS[committee.status].label}`}
        actions={
          <>
            <form action={remindCommitteeAction}>
              <input type="hidden" name="id" value={committee.id} />
              <SubmitButton variant="subtle" size="sm" pendingText="…">
                <Send size={14} /> Напомни на членовете
              </SubmitButton>
            </form>
            {committee.status !== "closed" ? (
              <form action={closeCommitteeAction}>
                <input type="hidden" name="id" value={committee.id} />
                <SubmitButton
                  variant="gold"
                  size="sm"
                  pendingText="Изчисляване…"
                  confirm="Приключването изчислява крайните резултати и заключва комисията. Продължавате ли?"
                >
                  <CheckCircle2 size={14} /> Приключи комисията
                </SubmitButton>
              </form>
            ) : null}
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Членове"
              description={`${members.length} член(ове) · ${completedCards} попълнени оценъчни карти`}
              icon={UsersRound}
            />
            <CardBody className="p-0">
              {members.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    icon={UsersRound}
                    compact
                    title="Няма добавени членове"
                    description="Добавете председател, секретар и членове, за да започне оценяването."
                  />
                </div>
              ) : (
                <ul className="divide-y divide-hairline">
                  {members.map((member) => (
                    <li key={member.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium">{userName(member.user_id)}</div>
                        <div className="text-[11px] text-muted">{COMMITTEE_ROLE[member.member_role]}</div>
                      </div>
                      {member.conflict_declared ? (
                        <Badge tone="danger">
                          <ShieldAlert size={11} /> конфликт
                        </Badge>
                      ) : null}
                      {member.user_id === user.id ? (
                        <form action={declareConflictAction}>
                          <input type="hidden" name="id" value={member.id} />
                          <input type="hidden" name="committee_id" value={committee.id} />
                          <input type="hidden" name="conflict_declared" value={member.conflict_declared ? "" : "on"} />
                          <SubmitButton variant="ghost" size="sm" pendingText="…">
                            {member.conflict_declared ? "Оттегли декларацията" : "Декларирай конфликт"}
                          </SubmitButton>
                        </form>
                      ) : null}
                      <form action={removeCommitteeMemberAction}>
                        <input type="hidden" name="id" value={member.id} />
                        <input type="hidden" name="committee_id" value={committee.id} />
                        <SubmitButton
                          variant="ghost"
                          size="icon"
                          pendingText=""
                          confirm="Да премахна ли члена от комисията?"
                        >
                          <Trash2 size={14} className="text-danger" />
                        </SubmitButton>
                      </form>
                    </li>
                  ))}
                </ul>
              )}

              <div className="border-t border-hairline bg-panel2/50 px-5 py-4">
                {available.length === 0 ? (
                  <p className="text-[12px] text-muted">Всички активни служители вече са членове.</p>
                ) : (
                  <form action={addCommitteeMemberAction} className="grid gap-2 sm:grid-cols-[1.4fr_1fr_auto]">
                    <input type="hidden" name="committee_id" value={committee.id} />
                    <Field label="Служител">
                      <Select name="user_id" required defaultValue="">
                        <option value="" disabled>
                          Изберете…
                        </option>
                        {available.map((person) => (
                          <option key={person.id} value={person.id}>
                            {person.full_name}
                            {person.position ? ` — ${person.position}` : ""}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Роля">
                      <Select name="member_role" defaultValue="member">
                        <option value="chair">Председател</option>
                        <option value="secretary">Секретар</option>
                        <option value="member">Член</option>
                      </Select>
                    </Field>
                    <div className="flex items-end">
                      <SubmitButton pendingText="…">
                        <Plus size={14} /> Добави
                      </SubmitButton>
                    </div>
                  </form>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Критерии за оценяване"
              description="Оценките се попълват по кандидатура от всеки член"
              icon={ListChecks}
            />
            <CardBody className="p-0">
              {criteria.length === 0 ? (
                <div className="p-5">
                  <Alert tone="warning" title="Няма зададени критерии">
                    Без критерии членовете не могат да попълват оценъчни карти.
                  </Alert>
                </div>
              ) : (
                <div className="table-shell rounded-none border-0">
                  <table className="table-base">
                    <thead>
                      <tr>
                        <th>Критерий</th>
                        <th>Макс. оценка</th>
                        <th>Тегло</th>
                        <th className="text-right">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {criteria.map((criterion) => (
                        <tr key={criterion.id}>
                          <td>
                            <div className="text-[12.5px] font-medium">{criterion.name}</div>
                            {criterion.description ? (
                              <div className="text-[11px] text-muted">{criterion.description}</div>
                            ) : null}
                          </td>
                          <td className="text-[12.5px]">{Number(criterion.max_score)}</td>
                          <td className="text-[12.5px]">{Number(criterion.weight)}</td>
                          <td>
                            <form action={deleteEvaluationCriterionAction} className="flex justify-end">
                              <input type="hidden" name="id" value={criterion.id} />
                              <input type="hidden" name="committee_id" value={committee.id} />
                              <SubmitButton variant="ghost" size="icon" pendingText="" confirm="Да премахна ли критерия?">
                                <Trash2 size={14} className="text-danger" />
                              </SubmitButton>
                            </form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="border-t border-hairline bg-panel2/50 px-5 py-4">
                <form action={addEvaluationCriterionAction} className="grid gap-2 sm:grid-cols-[1.6fr_0.7fr_0.7fr_auto]">
                  <input type="hidden" name="committee_id" value={committee.id} />
                  <Field label="Критерий">
                    <Input name="name" required minLength={3} placeholder="Професионална квалификация" />
                  </Field>
                  <Field label="Макс. оценка">
                    <Input name="max_score" type="number" min={1} max={100} step="0.5" defaultValue={10} />
                  </Field>
                  <Field label="Тегло">
                    <Input name="weight" type="number" min={0.5} max={10} step="0.5" defaultValue={1} />
                  </Field>
                  <div className="flex items-end">
                    <SubmitButton variant="outline" pendingText="…">
                      <Plus size={14} /> Добави
                    </SubmitButton>
                  </div>
                </form>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Кандидатури към комисията"
              description={`${applications.length} записа`}
              icon={Gavel}
            />
            <CardBody className="p-0">
              {applications.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    icon={Gavel}
                    compact
                    title="Няма възложени кандидатури"
                    description="Възложете кандидатура към тази комисия от регистъра на подбора."
                    action={
                      <ButtonLink href="/dashboard/selection" size="sm" variant="outline">
                        Към регистъра
                      </ButtonLink>
                    }
                  />
                </div>
              ) : (
                <ul className="divide-y divide-hairline">
                  {applications.map((application) => (
                    <li key={application.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/dashboard/selection/${application.id}`}
                          className="text-[12.5px] font-medium hover:text-navy-600 dark:hover:text-gold-300"
                        >
                          {application.first_name} {application.last_name}
                        </Link>
                        <div className="text-[11px] text-muted">№ {application.registration_number}</div>
                      </div>
                      <span className="text-[11.5px] text-muted">
                        {evaluations.filter((e) => e.application_id === application.id).length} оценки
                      </span>
                      <Badge tone={APPLICATION_STATUS[application.status].tone}>
                        {APPLICATION_STATUS[application.status].label}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Настройки" icon={Gavel} />
            <CardBody>
              <form action={updateCommitteeAction} className="space-y-3">
                <input type="hidden" name="id" value={committee.id} />
                <Field label="Наименование">
                  <Input name="name" defaultValue={committee.name} required minLength={3} />
                </Field>
                <Field label="Предназначение">
                  <Textarea name="purpose" rows={3} defaultValue={committee.purpose || ""} />
                </Field>
                <Field label="Номер на протокол">
                  <Input name="protocol_number" defaultValue={committee.protocol_number || ""} />
                </Field>
                <SubmitButton variant="outline" pendingText="…">
                  Запази
                </SubmitButton>
              </form>

              <div className="mt-4 border-t border-hairline pt-4">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Статус
                </div>
                <form action={setCommitteeStatusAction} className="flex gap-2">
                  <input type="hidden" name="id" value={committee.id} />
                  <Select name="status" defaultValue={committee.status} className="h-9 py-1 text-[12.5px]">
                    <option value="draft">Чернова</option>
                    <option value="active">Активна</option>
                    <option value="closed">Приключена</option>
                  </Select>
                  <SubmitButton variant="subtle" size="sm" pendingText="…">
                    Задай
                  </SubmitButton>
                </form>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Протокол" icon={CheckCircle2} />
            <CardBody className="space-y-2 text-[12.5px]">
              <div className="flex justify-between">
                <span className="text-muted">Номер</span>
                <span className="font-medium">{committee.protocol_number || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Създадена</span>
                <span>{formatDateTime(committee.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Оценки</span>
                <span>{evaluations.length}</span>
              </div>
              {committee.status === "closed" ? (
                <ButtonLink
                  href={`/print/protocol/${committee.id}`}
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full"
                >
                  Преглед на протокол
                </ButtonLink>
              ) : (
                <p className="pt-1 text-[11px] leading-5 text-muted">
                  Протоколът се генерира автоматично при приключване на комисията.
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
