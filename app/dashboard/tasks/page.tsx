import type { Metadata } from "next";
import { AlertTriangle, CalendarClock, CheckCircle2, ListChecks, Plus } from "lucide-react";

import { SubmitButton } from "@/components/ui/client";
import { Flash } from "@/components/ui/flash";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  Collapsible,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  StatCard,
  Textarea,
} from "@/components/ui/primitives";
import { createTaskAction, setTaskStatusAction } from "@/lib/actions/tasks";
import { requirePermission } from "@/lib/auth/session";
import { listRows } from "@/lib/db";
import { TASK_PRIORITY, TASK_STATUS } from "@/lib/labels";
import type { TaskRow, UserRoleRow, UserRow } from "@/lib/types";
import { daysUntil, formatDateShort } from "@/lib/utils";

export const metadata: Metadata = { title: "Задачи" };
export const dynamic = "force-dynamic";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string; status?: string; assignee?: string }>;
}) {
  const user = await requirePermission("tasks.manage");
  const sp = await searchParams;

  const [tasks, users, roles] = await Promise.all([
    listRows<TaskRow>("tasks", { orderBy: "created_at" }),
    listRows<UserRow>("users"),
    listRows<UserRoleRow>("user_roles"),
  ]);

  const candidateIds = new Set(roles.filter((r) => r.role_key === "candidate").map((r) => r.user_id));
  const staff = users.filter((u) => u.is_active && !candidateIds.has(u.id));
  const userName = (id: string | null) => users.find((u) => u.id === id)?.full_name || "неизвестен";

  const status = sp.status || "";
  const assignee = sp.assignee || "";

  const filtered = tasks.filter((task) => {
    if (status && task.status !== status) return false;
    if (assignee && task.assignee_id !== assignee) return false;
    return true;
  });

  const open = tasks.filter((t) => t.status === "todo" || t.status === "in_progress");
  const overdue = open.filter((t) => t.due_date && new Date(t.due_date).getTime() < Date.now() - 86_400_000);
  const dueSoon = open.filter((t) => {
    if (!t.due_date) return false;
    const left = daysUntil(t.due_date);
    return left !== null && left >= 0 && left <= 3;
  });
  const done = tasks.filter((t) => t.status === "done");

  return (
    <div>
      <Flash ok={sp.ok} err={sp.err} />

      <PageHeader
        title="Задачи и срокове"
        subtitle="Възлагане, просрочване и проследяване на институционални задачи."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Отворени" value={open.length} icon={ListChecks} />
        <StatCard label="Просрочени" value={overdue.length} icon={AlertTriangle} accent={overdue.length ? "danger" : "success"} />
        <StatCard label="Изтичащи до 3 дни" value={dueSoon.length} icon={CalendarClock} accent="gold" />
        <StatCard label="Изпълнени" value={done.length} icon={CheckCircle2} accent="success" />
      </div>

      <Card className="mb-5">
        <CardHeader title="Нова задача" description="Известие се изпраща автоматично на изпълнителя" icon={Plus} />
        <CardBody>
          <Collapsible summary="Възложи задача">
            <form action={createTaskAction} className="grid gap-3 sm:grid-cols-2">
              <Field label="Задача" required className="sm:col-span-2">
                <Input name="title" required minLength={3} placeholder="Изготви доклад за самооценката" />
              </Field>
              <Field label="Описание" className="sm:col-span-2">
                <Textarea name="description" rows={2} />
              </Field>
              <Field label="Изпълнител">
                <Select name="assignee_id" defaultValue={user.id}>
                  <option value="">Без изпълнител</option>
                  {staff.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.full_name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Краен срок">
                <Input name="due_date" type="date" />
              </Field>
              <Field label="Приоритет">
                <Select name="priority" defaultValue="normal">
                  {Object.entries(TASK_PRIORITY).map(([key, meta]) => (
                    <option key={key} value={key}>
                      {meta.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="flex items-end">
                <SubmitButton pendingText="Възлагане…">
                  <Plus size={15} /> Възложи
                </SubmitButton>
              </div>
            </form>
          </Collapsible>
        </CardBody>
      </Card>

      <Card className="mb-4">
        <CardBody className="py-3">
          <form className="flex flex-wrap items-end gap-3">
            <Field label="Статус" className="w-full sm:w-44">
              <Select name="status" defaultValue={status} className="h-9 py-1 text-[12.5px]">
                <option value="">Всички</option>
                {Object.entries(TASK_STATUS).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Изпълнител" className="w-full sm:w-56">
              <Select name="assignee" defaultValue={assignee} className="h-9 py-1 text-[12.5px]">
                <option value="">Всички</option>
                {staff.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.full_name}
                  </option>
                ))}
              </Select>
            </Field>
            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-lg bg-navy-700 px-4 text-[12.5px] font-medium text-white hover:bg-navy-800"
            >
              Филтър
            </button>
          </form>
        </CardBody>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={tasks.length === 0 ? "Няма възложени задачи" : "Няма задачи по зададените филтри"}
          description={
            tasks.length === 0
              ? "Създайте първата задача, задайте изпълнител и краен срок. При просрочване системата напомня автоматично."
              : "Променете филтрите, за да видите други задачи."
          }
        />
      ) : (
        <Card>
          <CardBody className="p-0">
            <ul className="divide-y divide-hairline">
              {filtered.map((task) => {
                const left = daysUntil(task.due_date);
                const isOverdue = task.status !== "done" && task.status !== "cancelled" && left !== null && left < 0;
                return (
                  <li key={task.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[13px] font-medium ${task.status === "done" ? "line-through opacity-60" : ""}`}>
                          {task.title}
                        </span>
                        <Badge tone={TASK_PRIORITY[task.priority].tone}>{TASK_PRIORITY[task.priority].label}</Badge>
                        {isOverdue ? (
                          <Badge tone="danger">
                            <AlertTriangle size={10} /> просрочена
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] text-muted">
                        <span>{userName(task.assignee_id)}</span>
                        <span>
                          {task.due_date ? `срок ${formatDateShort(task.due_date)}` : "без срок"}
                        </span>
                        <span>създадена от {userName(task.created_by)}</span>
                      </div>
                      {task.description ? (
                        <p className="mt-1 line-clamp-1 text-[11.5px] text-muted">{task.description}</p>
                      ) : null}
                    </div>

                    <Badge tone={TASK_STATUS[task.status].tone}>{TASK_STATUS[task.status].label}</Badge>

                    <div className="flex items-center gap-1">
                      {task.status === "todo" ? (
                        <form action={setTaskStatusAction}>
                          <input type="hidden" name="id" value={task.id} />
                          <input type="hidden" name="status" value="in_progress" />
                          <SubmitButton variant="subtle" size="sm" pendingText="…">
                            Започни
                          </SubmitButton>
                        </form>
                      ) : null}
                      {task.status === "in_progress" ? (
                        <form action={setTaskStatusAction}>
                          <input type="hidden" name="id" value={task.id} />
                          <input type="hidden" name="status" value="done" />
                          <SubmitButton variant="outline" size="sm" pendingText="…">
                            <CheckCircle2 size={13} /> Готово
                          </SubmitButton>
                        </form>
                      ) : null}
                      {task.status === "done" ? (
                        <form action={setTaskStatusAction}>
                          <input type="hidden" name="id" value={task.id} />
                          <input type="hidden" name="status" value="todo" />
                          <SubmitButton variant="ghost" size="sm" pendingText="…">
                            Върни
                          </SubmitButton>
                        </form>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
