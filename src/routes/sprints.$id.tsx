import { Fragment, useMemo, useState, useEffect, type Dispatch, type SetStateAction } from "react";
import { Outlet, createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { AlertCircle, Check, CheckCircle, ChevronRight, Clock, MessageSquare, Paperclip, Pencil, Plus, Search, TimerReset, Trash2, TrendingUp, Users, X } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { AppShell } from "@/components/app/AppShell";
import { ConfirmDelete } from "@/components/app/ConfirmDelete";
import { PageHeader } from "@/components/app/PageHeader";
import {
  WorkItemUpdatesDialog,
  type WorkItemUpdatesDialogItem,
} from "@/components/app/WorkItemUpdatesDialog";
import { WorkItemModal } from "@/components/workitem/WorkItemModal";
import { WorkItemBlockDialog } from "@/components/workitem/WorkItemDialogs";
import type { WorkItemRef } from "@/lib/workItem";
import {
  SprintActivityPlanForm,
  toSprintActivityPlanFormData,
  type SprintActivityPlanOption,
} from "@/components/forms/SprintActivityPlanForm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatHoursLabel,
  getActivityExecutionSummary,
  getSprintPlanExecutionSummary,
  sumPlannedHours,
  sumRealizedHours,
} from "@/lib/activityFlow";
import { formatSprintStatusLabel } from "@/lib/labels";
import type { Activity, SprintActivityPlan, SprintParticipant, SprintTicketPlan, Ticket } from "@/lib/types";
import { listSprintParticipants, saveSprintParticipant, deleteSprintParticipant } from "@/services/sprintParticipantService";
import { listActivities, updateActivity } from "@/services/activityService";
import { listActivityTimeEntries } from "@/services/activityTimeEntryService";
import { listTickets, updateTicket } from "@/services/ticketService";
import { listActivityTags } from "@/services/activityTagService";
import {
  deleteSprintActivityPlan,
  listSprintActivityPlans,
  listSprintPlansBySprint,
  saveSprintActivityPlan,
} from "@/services/sprintActivityPlanService";
import {
  listSprintTicketPlansBySprint,
  saveSprintTicketPlan,
  deleteSprintTicketPlan,
} from "@/services/sprintTicketPlanService";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  closeSprint,
  startSprint,
  deleteSprint,
  getSprint,
  getSprintRetrospective,
  getSprintReview,
  getSprintVelocity,
  saveSprintRetrospective,
} from "@/services/sprintService";
import { formatDate, toNumber , parseApiError} from "@/services/utils";
import { listUsers } from "@/services/userService";
import { api } from "@/services/api";
import { BurndownChart } from "@/components/dashboard/Charts";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/sprints/$id")({
  head: () => ({ meta: [{ title: "Detalhes da sprint · NimbusDesk" }] }),
  component: SprintDetail,
});

type WizardTicketRow = { ticketId: string; responsibleIds: string[]; userHours: Record<string,string>; plannedHours: string; storyPoints: string; priority: string; complexity: string; plannedEndDate: string; notes: string; savedId?: string };
type WizardActivityRow = { activityId: string; responsibleIds: string[]; userHours: Record<string,string>; plannedHours: string; storyPoints: string; priority: string; complexity: string; plannedEndDate: string; notes: string; savedId?: string };
type PlanningTicketItem = { id: string; code?: string; title?: string; status?: string; priority?: string };
type KanbanCard = {
  key: string;
  type: "ticket" | "activity";
  id: string;
  status: string;
  title: string;
  code: string;
  priority?: string;
  subtitle?: string;
  tags: string[];
  responsibleIds: string[];
  hoursLabel: string;
  metaLabel: string;
};

function normalizeKanbanText(value?: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeKanbanPriority(priority?: string | null) {
  const normalized = normalizeKanbanText(priority);
  if (normalized.includes("critic")) return PRIORITY_OPTIONS[0];
  if (normalized.includes("alta")) return PRIORITY_OPTIONS[1];
  if (normalized.includes("baix")) return PRIORITY_OPTIONS[3];
  if (normalized.includes("media") || normalized.includes("medi")) return PRIORITY_OPTIONS[2];
  return priority || PRIORITY_OPTIONS[2];
}

function getActivityKanbanColumn(status?: string | null) {
  const normalized = normalizeKanbanText(status);
  if (normalized.includes("conclu") || normalized.includes("final")) return "Finalizado";
  if (normalized.includes("revis") || normalized.includes("valid")) return "ValidaÃ§Ã£o";
  if (normalized.includes("paus")) return "Pausado";
  if (normalized.includes("bloque") || normalized.includes("aguard")) return "Aguardando cliente";
  if (normalized.includes("progres") || normalized.includes("andamento")) return "Em atendimento";
  return "Triagem";
}

function getActivityStatusForKanbanColumn(column: string) {
  const normalized = normalizeKanbanText(column);
  if (normalized.includes("final")) return "Concluido";
  if (normalized.includes("valid")) return "Em revisao";
  if (normalized.includes("aguard") || normalized.includes("paus")) return "Bloqueado";
  if (normalized.includes("atendimento")) return "Em progresso";
  return "Backlog";
}

const FIBONACCI_SP = [1, 2, 3, 5, 8, 13, 21] as const;
const SP_HOUR_THRESHOLDS: Record<number, number> = { 1: 2, 2: 4, 3: 8, 5: 16, 8: 24, 13: 40, 21: Infinity };

function hoursToSP(hours: number): number {
  for (const sp of FIBONACCI_SP) {
    if (hours <= SP_HOUR_THRESHOLDS[sp]) return sp;
  }
  return 21;
}

function spToHours(sp: number): number {
  const map: Record<number, number> = { 1: 2, 2: 4, 3: 8, 5: 16, 8: 24, 13: 40, 21: 48 };
  return map[sp] ?? 0;
}

const PRIORITY_OPTIONS = ["Crítica", "Alta", "Média", "Baixa"] as const;
const PRIORITY_COLORS: Record<string, string> = {
  "Crítica": "bg-red-500/15 text-red-500 border-red-500/30",
  "Alta": "bg-orange-500/15 text-orange-500 border-orange-500/30",
  "Média": "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
  "Baixa": "bg-blue-500/15 text-blue-500 border-blue-500/30",
};

function SprintAvatarGroup({ names }: { names: string[] }) {
  if (!names.length) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex items-center">
      {names.slice(0, 3).map((name, i) => {
        const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
        return (
          <div key={i} title={name} className={`${i > 0 ? "-ml-2" : ""} h-7 w-7 grid place-items-center rounded-full bg-gradient-primary text-[11px] font-semibold text-primary-foreground ring-2 ring-background`}>
            {initials}
          </div>
        );
      })}
      {names.length > 3 && (
        <div className="-ml-2 h-7 w-7 grid place-items-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground ring-2 ring-background">
          +{names.length - 3}
        </div>
      )}
    </div>
  );
}

const SPRINT_STATUS_COLORS: Record<string, string> = {
  "Triagem": "bg-slate-500 text-white",
  "Em atendimento": "bg-primary text-primary-foreground",
  "Aguardando cliente": "bg-amber-500 text-white",
  "Validação": "bg-purple-500 text-white",
  "Pausado": "bg-sky-500 text-white",
  "Finalizado": "bg-emerald-500 text-white",
  "Concluída": "bg-emerald-500 text-white",
  "Em andamento": "bg-primary text-primary-foreground",
  "Pendente": "bg-slate-500 text-white",
};

const SPRINT_PRIORITY_COLORS: Record<string, string> = {
  "Crítica": "bg-red-500 text-white",
  "Alta": "bg-orange-500 text-white",
  "Média": "bg-yellow-500 text-black",
  "Baixa": "bg-blue-500 text-white",
};

const SPRINT_TYPE_COLORS: Record<string, string> = {
  "Bug": "bg-red-600 text-white",
  "Feature": "bg-violet-600 text-white",
  "Melhoria": "bg-teal-600 text-white",
  "Suporte": "bg-sky-600 text-white",
  "Tarefa": "bg-indigo-600 text-white",
  "Chamado": "bg-slate-600 text-white",
  "Atividade": "bg-emerald-700 text-white",
};

function SprintStatusBadge({ status }: { status?: string }) {
  const s = status ?? "";
  const cls = SPRINT_STATUS_COLORS[s] ?? "bg-muted text-muted-foreground";
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{s || "—"}</span>;
}

function SprintPriorityBadge({ priority }: { priority?: string }) {
  const p = priority ?? "";
  const cls = SPRINT_PRIORITY_COLORS[p] ?? "bg-muted text-muted-foreground";
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{p || "—"}</span>;
}

function SprintTypeBadge({ type }: { type?: string }) {
  const t = type ?? "";
  const cls = SPRINT_TYPE_COLORS[t] ?? "bg-slate-600 text-white";
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{t || "—"}</span>;
}

function SprintFieldBox({ label, children, noPadding = false, wide = false, left = false }: { label: string; children: React.ReactNode; noPadding?: boolean; wide?: boolean; left?: boolean }) {
  return (
    <div className={wide ? "md:col-span-2" : undefined}>
      <div className="mb-1.5 text-xs font-semibold text-muted-foreground">{label}</div>
      <div className={`flex min-h-10 items-stretch overflow-hidden rounded-md border border-border bg-muted/40 text-sm text-foreground ${noPadding ? "" : `px-3 items-center ${left ? "" : "justify-center"}`}`}>
        {children}
      </div>
    </div>
  );
}

const SPRINT_OVERVIEW_STATUS: Record<string, string> = {
  "Planejada": "bg-muted text-muted-foreground",
  "Em andamento": "bg-primary text-primary-foreground",
  "Concluída": "bg-success text-success-foreground",
  "Cancelada": "bg-destructive text-destructive-foreground",
  "Pausada": "bg-warning text-warning-foreground",
};

const sprintKanbanCols = [
  { name: "Triagem", label: "Backlog", accent: "bg-muted-foreground" },
  { name: "Em atendimento", label: "Em progresso", accent: "bg-primary" },
  { name: "Aguardando cliente", label: "Aguardando", accent: "bg-warning" },
  { name: "Validação", label: "Homologação", accent: "bg-accent" },
  { name: "Pausado", label: "Pausado", accent: "bg-info" },
  { name: "Finalizado", label: "Finalizado", accent: "bg-success" },
] as const;

function UserHoursBreakdown({ users, responsible, userHours, totalHours, onChange }: {
  users: import("@/lib/types").User[]; responsible: string[]; userHours: Record<string,string>;
  totalHours: number; onChange: (uh: Record<string,string>) => void;
}) {
  const sum = responsible.reduce((s, uid) => s + (Number(userHours[uid]) || 0), 0);
  const diff = totalHours - sum;
  const getName = (uid: string) => {
    const u = users.find(x => String(x.id) === String(uid));
    if (!u) return "Carregando...";
    return u.name || [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || u.email || "Usuário";
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Distribuição de horas por técnico</span>
        {responsible.length > 0 && totalHours > 0 && (
          <span className={`text-xs font-medium ${Math.abs(diff) < 0.01 ? "text-success" : "text-warning"}`}>
            {Math.abs(diff) < 0.01 ? "✓ Balanceado" : diff > 0 ? `Faltam ${diff.toFixed(1)}h` : `Excedente ${Math.abs(diff).toFixed(1)}h`}
          </span>
        )}
      </div>
      {responsible.length === 0 && <p className="text-xs text-muted-foreground">Adicione responsáveis para distribuir as horas.</p>}
      {responsible.map(uid => {
        const name = getName(uid);
        const h = Number(userHours[uid]) || 0;
        const pct = totalHours > 0 ? Math.min(100, (h / totalHours) * 100) : 0;
        return (
          <div key={uid} className="flex items-center gap-3">
            <span className="w-32 truncate text-xs font-medium">{name}</span>
            <input
              type="number" min="0" step="0.5"
              value={userHours[uid] ?? ""}
              onChange={e => onChange({ ...userHours, [uid]: e.target.value })}
              className="w-20 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs outline-none focus:border-primary"
            />
            <span className="text-xs text-muted-foreground">h</span>
            <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-gradient-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="w-10 text-right text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
          </div>
        );
      })}
      {responsible.length > 1 && (
        <button type="button"
          onClick={() => {
            const perUser = totalHours / responsible.length;
            onChange(Object.fromEntries(responsible.map(uid => [uid, String(perUser.toFixed(1))])));
          }}
          className="text-xs text-primary hover:underline"
        >
          Distribuir igualmente
        </button>
      )}
    </div>
  );
}

function TicketPlanningSection({
  description,
  users,
  tickets,
  rows,
  setRows,
  search,
  setSearch,
  expandedRows,
  setExpandedRows,
  emptyRowsLabel,
  excludedIds = [],
  isLoading = false,
  onBeforeRemoveRow,
}: {
  description: string;
  users: import("@/lib/types").User[];
  tickets: PlanningTicketItem[];
  rows: WizardTicketRow[];
  setRows: Dispatch<SetStateAction<WizardTicketRow[]>>;
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  expandedRows: Set<string>;
  setExpandedRows: Dispatch<SetStateAction<Set<string>>>;
  emptyRowsLabel: string;
  excludedIds?: string[];
  isLoading?: boolean;
  onBeforeRemoveRow?: (row: WizardTicketRow) => Promise<void> | void;
}) {
  const excludedIdSet = new Set(excludedIds);
  const openTickets = tickets.filter((ticket) => ticket.status !== "Resolvido" && ticket.status !== "Fechado" && ticket.status !== "Cancelado");
  const addedIds = new Set(rows.map((row) => row.ticketId));
  const availableTickets = openTickets.filter((ticket) => !addedIds.has(ticket.id) && !excludedIdSet.has(ticket.id));
  const searchLower = search.toLowerCase();
  const filteredAvailable = search.trim()
    ? availableTickets.filter(
        (ticket) =>
          (ticket.title ?? "").toLowerCase().includes(searchLower)
          || (ticket.code ?? "").toLowerCase().includes(searchLower),
      )
    : availableTickets;

  const updateRow = (ticketId: string, patch: Partial<WizardTicketRow>) => {
    setRows((prev) => prev.map((row) => (row.ticketId === ticketId ? { ...row, ...patch } : row)));
  };

  const toggleExpandedRow = (rowKey: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{description}</p>

      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className="flex w-full items-center gap-2 rounded-xl border border-dashed border-primary/40 px-4 py-2.5 text-sm text-primary transition hover:border-primary hover:bg-primary/5">
            <Plus className="h-4 w-4" />
            Adicionar chamado
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[500px] p-0 glass" align="start">
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por código ou título..."
                className="w-full rounded-lg border border-border bg-muted/50 py-1.5 pl-9 pr-3 text-sm outline-none"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {isLoading ? (
              <p className="py-4 text-center text-xs text-muted-foreground">Carregando...</p>
            ) : filteredAvailable.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">Nenhum chamado disponível.</p>
            ) : (
              filteredAvailable.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition hover:bg-muted/40"
                  onClick={() => {
                    setRows((prev) => [
                      ...prev,
                      {
                        ticketId: ticket.id,
                        responsibleIds: [],
                        userHours: {},
                        plannedHours: "",
                        storyPoints: "",
                        priority: "Média",
                        complexity: "",
                        plannedEndDate: "",
                        notes: "",
                      },
                    ]);
                    setSearch("");
                  }}
                >
                  <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">{ticket.code}</span>
                  <span className="min-w-0 flex-1 truncate">{ticket.title}</span>
                  {ticket.priority && <span className="shrink-0 text-[10px] text-muted-foreground">{ticket.priority}</span>}
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

      <div>
        {rows.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">Chamado</th>
                  <th className="w-44 px-3 py-2 text-left font-medium">Responsáveis</th>
                  <th className="w-20 px-3 py-2 text-left font-medium">SP</th>
                  <th className="w-20 px-3 py-2 text-left font-medium">Horas</th>
                  <th className="w-28 px-3 py-2 text-left font-medium">Previsão término</th>
                  <th className="w-8 px-3 py-2" />
                  <th className="w-8 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const ticket = tickets.find((item) => item.id === row.ticketId);
                  const rowKey = `ticket-${row.ticketId}`;
                  const isExpanded = expandedRows.has(rowKey);
                  return (
                    <Fragment key={row.ticketId}>
                      <tr className="border-b border-border transition last:border-0 hover:bg-muted/20">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Badge className={`shrink-0 border text-[10px] ${PRIORITY_COLORS[row.priority] || ""}`}>{row.priority}</Badge>
                            <div>
                              <span className="font-mono text-xs text-muted-foreground">{ticket?.code} </span>
                              <span className="truncate">{ticket?.title ?? row.ticketId}</span>
                              {row.savedId && <span className="ml-2 text-[10px] text-primary">✓</span>}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <WizardUserSelect
                            users={users}
                            selected={row.responsibleIds}
                            onChange={(ids) => updateRow(row.ticketId, { responsibleIds: ids })}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={row.storyPoints}
                            onChange={(event) => {
                              const storyPoints = Number(event.target.value);
                              updateRow(row.ticketId, {
                                storyPoints: event.target.value,
                                plannedHours: storyPoints ? String(spToHours(storyPoints)) : row.plannedHours,
                              });
                            }}
                            className="w-full rounded-md border border-border bg-muted/40 px-2 py-1 text-sm outline-none focus:border-primary"
                          >
                            <option value="">—</option>
                            {FIBONACCI_SP.map((storyPoints) => (
                              <option key={storyPoints} value={storyPoints}>
                                {storyPoints}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={row.plannedHours}
                            onChange={(event) => {
                              const plannedHours = Number(event.target.value);
                              updateRow(row.ticketId, {
                                plannedHours: event.target.value,
                                storyPoints: plannedHours ? String(hoursToSP(plannedHours)) : row.storyPoints,
                              });
                            }}
                            placeholder="0"
                            className="w-full rounded-md border border-border bg-muted/40 px-2 py-1 text-sm outline-none focus:border-primary"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="date"
                            value={row.plannedEndDate}
                            onChange={(event) => updateRow(row.ticketId, { plannedEndDate: event.target.value })}
                            className="w-full rounded-md border border-border bg-muted/40 px-2 py-1 text-xs outline-none focus:border-primary"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => toggleExpandedRow(rowKey)}
                            className="text-xs text-muted-foreground transition hover:text-foreground"
                          >
                            {isExpanded ? "▲" : "▼"}
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={async () => {
                              await onBeforeRemoveRow?.(row);
                              setRows((prev) => prev.filter((item) => item.ticketId !== row.ticketId));
                            }}
                            className="text-destructive/50 transition hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b border-border bg-muted/10">
                          <td colSpan={7} className="space-y-3 px-4 py-3">
                            <UserHoursBreakdown
                              users={users}
                              responsible={row.responsibleIds}
                              userHours={row.userHours}
                              totalHours={Number(row.plannedHours) || 0}
                              onChange={(userHours) => updateRow(row.ticketId, { userHours })}
                            />
                            <div className="flex items-start gap-6">
                              <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Prioridade</label>
                                <div className="flex gap-1.5">
                                  {PRIORITY_OPTIONS.map((priority) => (
                                    <button
                                      key={priority}
                                      type="button"
                                      onClick={() => updateRow(row.ticketId, { priority })}
                                      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${row.priority === priority ? PRIORITY_COLORS[priority] : "border-border text-muted-foreground hover:border-primary/50"}`}
                                    >
                                      {priority}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="flex-1 space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Observações</label>
                                <textarea
                                  rows={2}
                                  value={row.notes}
                                  onChange={(event) => updateRow(row.ticketId, { notes: event.target.value })}
                                  placeholder="Adicione observações sobre este chamado na sprint..."
                                  className="w-full resize-none rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs outline-none focus:border-primary"
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">{emptyRowsLabel}</p>
        )}
      </div>
    </div>
  );
}

function ActivityPlanningSection({
  description,
  users,
  activityOptions,
  rows,
  setRows,
  search,
  setSearch,
  expandedRows,
  setExpandedRows,
  emptyRowsLabel,
  excludedIds = [],
  onBeforeRemoveRow,
}: {
  description: string;
  users: import("@/lib/types").User[];
  activityOptions: SprintActivityPlanOption[];
  rows: WizardActivityRow[];
  setRows: Dispatch<SetStateAction<WizardActivityRow[]>>;
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  expandedRows: Set<string>;
  setExpandedRows: Dispatch<SetStateAction<Set<string>>>;
  emptyRowsLabel: string;
  excludedIds?: string[];
  onBeforeRemoveRow?: (row: WizardActivityRow) => Promise<void> | void;
}) {
  const excludedIdSet = new Set(excludedIds);
  const addedIds = new Set(rows.map((row) => row.activityId));
  const availableActivities = activityOptions.filter((activity) => !addedIds.has(activity.id) && !excludedIdSet.has(activity.id));
  const searchLower = search.toLowerCase();
  const filteredActivities = search.trim()
    ? availableActivities.filter(
        (activity) =>
          activity.title.toLowerCase().includes(searchLower)
          || (activity.projectName ?? "").toLowerCase().includes(searchLower),
      )
    : availableActivities;

  const updateRow = (activityId: string, patch: Partial<WizardActivityRow>) => {
    setRows((prev) => prev.map((row) => (row.activityId === activityId ? { ...row, ...patch } : row)));
  };

  const toggleExpandedRow = (rowKey: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{description}</p>

      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className="flex w-full items-center gap-2 rounded-xl border border-dashed border-primary/40 px-4 py-2.5 text-sm text-primary transition hover:border-primary hover:bg-primary/5">
            <Plus className="h-4 w-4" />
            Adicionar atividade
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[540px] p-0 glass" align="start">
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por título ou projeto..."
                className="w-full rounded-lg border border-border bg-muted/50 py-1.5 pl-9 pr-3 text-sm outline-none"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filteredActivities.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">Nenhuma atividade disponível.</p>
            ) : (
              filteredActivities.map((activity) => (
                <button
                  key={activity.id}
                  type="button"
                  className="flex w-full items-start gap-3 px-4 py-2.5 text-left text-sm transition hover:bg-muted/40"
                  onClick={() => {
                    setRows((prev) => [
                      ...prev,
                      {
                        activityId: activity.id,
                        responsibleIds: [],
                        userHours: {},
                        plannedHours: String(activity.estimatedBalanceHours > 0 ? activity.estimatedBalanceHours : ""),
                        storyPoints: "",
                        priority: "Média",
                        complexity: "",
                        plannedEndDate: "",
                        notes: "",
                      },
                    ]);
                    setSearch("");
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{activity.title}</div>
                    <div className="text-xs text-muted-foreground">{activity.projectName} · saldo: {formatHoursLabel(activity.estimatedBalanceHours)}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

      <div>
        {rows.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">Atividade</th>
                  <th className="w-44 px-3 py-2 text-left font-medium">Responsáveis</th>
                  <th className="w-20 px-3 py-2 text-left font-medium">SP</th>
                  <th className="w-20 px-3 py-2 text-left font-medium">Horas</th>
                  <th className="w-28 px-3 py-2 text-left font-medium">Previsão término</th>
                  <th className="w-8 px-3 py-2" />
                  <th className="w-8 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const activity = activityOptions.find((item) => item.id === row.activityId);
                  const rowKey = `activity-${row.activityId}`;
                  const isExpanded = expandedRows.has(rowKey);
                  return (
                    <Fragment key={row.activityId}>
                      <tr className="border-b border-border transition last:border-0 hover:bg-muted/20">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Badge className={`shrink-0 border text-[10px] ${PRIORITY_COLORS[row.priority] || ""}`}>{row.priority}</Badge>
                            <div>
                              <div className="max-w-[150px] truncate font-medium">{activity?.title ?? row.activityId}</div>
                              {activity?.projectName && <div className="max-w-[150px] truncate text-[10px] text-muted-foreground">{activity.projectName}</div>}
                              {row.savedId && <span className="text-[10px] text-primary">✓</span>}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <WizardUserSelect
                            users={users}
                            selected={row.responsibleIds}
                            onChange={(ids) => updateRow(row.activityId, { responsibleIds: ids })}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={row.storyPoints}
                            onChange={(event) => {
                              const storyPoints = Number(event.target.value);
                              updateRow(row.activityId, {
                                storyPoints: event.target.value,
                                plannedHours: storyPoints ? String(spToHours(storyPoints)) : row.plannedHours,
                              });
                            }}
                            className="w-full rounded-md border border-border bg-muted/40 px-2 py-1 text-sm outline-none focus:border-primary"
                          >
                            <option value="">—</option>
                            {FIBONACCI_SP.map((storyPoints) => (
                              <option key={storyPoints} value={storyPoints}>
                                {storyPoints}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={row.plannedHours}
                            onChange={(event) => {
                              const plannedHours = Number(event.target.value);
                              updateRow(row.activityId, {
                                plannedHours: event.target.value,
                                storyPoints: plannedHours ? String(hoursToSP(plannedHours)) : row.storyPoints,
                              });
                            }}
                            placeholder="0"
                            className="w-full rounded-md border border-border bg-muted/40 px-2 py-1 text-sm outline-none focus:border-primary"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="date"
                            value={row.plannedEndDate}
                            onChange={(event) => updateRow(row.activityId, { plannedEndDate: event.target.value })}
                            className="w-full rounded-md border border-border bg-muted/40 px-2 py-1 text-xs outline-none focus:border-primary"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => toggleExpandedRow(rowKey)}
                            className="text-xs text-muted-foreground transition hover:text-foreground"
                          >
                            {isExpanded ? "▲" : "▼"}
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={async () => {
                              await onBeforeRemoveRow?.(row);
                              setRows((prev) => prev.filter((item) => item.activityId !== row.activityId));
                            }}
                            className="text-destructive/50 transition hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b border-border bg-muted/10">
                          <td colSpan={7} className="space-y-3 px-4 py-3">
                            <UserHoursBreakdown
                              users={users}
                              responsible={row.responsibleIds}
                              userHours={row.userHours}
                              totalHours={Number(row.plannedHours) || 0}
                              onChange={(userHours) => updateRow(row.activityId, { userHours })}
                            />
                            <div className="flex items-start gap-6">
                              <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Prioridade</label>
                                <div className="flex gap-1.5">
                                  {PRIORITY_OPTIONS.map((priority) => (
                                    <button
                                      key={priority}
                                      type="button"
                                      onClick={() => updateRow(row.activityId, { priority })}
                                      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${row.priority === priority ? PRIORITY_COLORS[priority] : "border-border text-muted-foreground hover:border-primary/50"}`}
                                    >
                                      {priority}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="flex-1 space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Observações</label>
                                <textarea
                                  rows={2}
                                  value={row.notes}
                                  onChange={(event) => updateRow(row.activityId, { notes: event.target.value })}
                                  placeholder="Adicione observações sobre esta atividade na sprint..."
                                  className="w-full resize-none rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs outline-none focus:border-primary"
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">{emptyRowsLabel}</p>
        )}
      </div>
    </div>
  );
}


function SprintDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [updatesDialogItem, setUpdatesDialogItem] = useState<WorkItemUpdatesDialogItem | null>(null);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SprintActivityPlan | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [unplannedOpen, setUnplannedOpen] = useState(false);
  const [unplannedTab, setUnplannedTab] = useState<"chamados" | "atividades">("chamados");
  const [unplannedTicketSearch, setUnplannedTicketSearch] = useState("");
  const [unplannedActivitySearch, setUnplannedActivitySearch] = useState("");
  const [unplannedTicketRows, setUnplannedTicketRows] = useState<WizardTicketRow[]>([]);
  const [unplannedActivityRows, setUnplannedActivityRows] = useState<WizardActivityRow[]>([]);
  const [unplannedExpandedRows, setUnplannedExpandedRows] = useState<Set<string>>(new Set());
  const [unplannedSaving, setUnplannedSaving] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [wizardParticipantRows, setWizardParticipantRows] = useState<{
    userId: string;
    hoursPerDay: string;
    workingDays: string;
    availabilityFactor: string;
    savedId?: string;
  }[]>([]);
  const [wizardTicketRows, setWizardTicketRows] = useState<WizardTicketRow[]>([]);
  const [wizardActivityRows, setWizardActivityRows] = useState<WizardActivityRow[]>([]);
  const [wizardTicketSearch, setWizardTicketSearch] = useState("");
  const [wizardActivitySearch, setWizardActivitySearch] = useState("");
  const [wizardSaving, setWizardSaving] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("overview");
  const [closeSprintOpen, setCloseSprintOpen] = useState(false);
  const [closeNotes, setCloseNotes] = useState("");
  const [closingSprintPending, setClosingSprintPending] = useState(false);
  const [retroWentWell, setRetroWentWell] = useState("");
  const [retroToImprove, setRetroToImprove] = useState("");
  const [retroSaving, setRetroSaving] = useState(false);
  const [kanbanLocalTickets, setKanbanLocalTickets] = useState<Ticket[]>([]);
  const [kanbanLocalActivities, setKanbanLocalActivities] = useState<Activity[]>([]);
  const [kanbanDragId, setKanbanDragId] = useState<string | null>(null);
  const [wiRef, setWiRef] = useState<WorkItemRef | null>(null);
  const [wiTab, setWiTab] = useState<"conversa" | "resolucao">("conversa");
  const [kanbanPauseCard, setKanbanPauseCard] = useState<{ key: string; column: string } | null>(null);
  const [kanbanActiveCol, setKanbanActiveCol] = useState<string | null>(null);
  const [kanbanFilterTech, setKanbanFilterTech] = useState<string>("");
  const [kanbanFilterPriority, setKanbanFilterPriority] = useState<string>("");
  const [kanbanShowFilters, setKanbanShowFilters] = useState(false);

  const sprintQuery = useQuery({ queryKey: ["sprint", id], queryFn: () => getSprint(id) });
  const participantsQuery = useQuery({
    queryKey: ["sprint-participants", id],
    queryFn: () => listSprintParticipants(id),
  });
  const activitiesQuery = useQuery({ queryKey: ["activities"], queryFn: () => listActivities() });
  const usersQuery = useQuery({ queryKey: ["form-users"], queryFn: () => listUsers() });
  const ticketsQuery = useQuery({
    queryKey: ["tickets-for-sprint-wizard"],
    queryFn: () => listTickets({ page_size: 200 }),
  });
  const ticketPlansQuery = useQuery({
    queryKey: ["sprint-ticket-plans", id],
    queryFn: () => listSprintTicketPlansBySprint(id),
  });
  const plansQuery = useQuery({
    queryKey: ["sprint-activity-plans", id],
    queryFn: () => listSprintPlansBySprint(id),
  });
  const allPlansQuery = useQuery({
    queryKey: ["all-sprint-activity-plans"],
    queryFn: () => listSprintActivityPlans(),
  });
  const allTimeEntriesQuery = useQuery({
    queryKey: ["activity-time-entries"],
    queryFn: () => listActivityTimeEntries(),
  });
  const activityTagsQuery = useQuery({
    queryKey: ["activity-tag-configs"],
    queryFn: () => listActivityTags(),
  });
  type BurndownRaw = { day?: string; date?: string; ideal: number; real?: number; actual?: number };
  const burndownQuery = useQuery({
    queryKey: ["sprint-burndown", id],
    queryFn: async () => {
      const response = await api.get<{ data?: BurndownRaw[]; results?: BurndownRaw[] } | BurndownRaw[]>(
        `/dashboard/widget-data/?source=sprint_burndown&sprint_id=${id}`,
      );
      const raw = response.data;
      const list: BurndownRaw[] = Array.isArray(raw)
        ? raw
        : ("results" in raw && Array.isArray(raw.results))
          ? raw.results
          : ("data" in raw && Array.isArray(raw.data))
            ? raw.data
            : [];
      return list.map((p) => ({
        name: p.day ?? p.date ?? "",
        Planejado: p.ideal,
        Realizado: p.real ?? p.actual ?? 0,
      }));
    },
    enabled: activeTab === "burndown",
  });

  const retroQuery = useQuery({
    queryKey: ["sprint-retrospective", id],
    queryFn: () => getSprintRetrospective(id),
  });

  const reviewQuery = useQuery({
    queryKey: ["sprint-review", id],
    queryFn: () => getSprintReview(id),
  });

  const velocityQuery = useQuery({
    queryKey: ["sprint-velocity"],
    queryFn: () => getSprintVelocity(),
  });

  useEffect(() => {
    const allT = (Array.isArray(ticketsQuery.data)
      ? ticketsQuery.data
      : (ticketsQuery.data as { results?: unknown[] } | undefined)?.results ?? []) as Ticket[];
    const ids = new Set((ticketPlansQuery.data ?? []).map((p: SprintTicketPlan) => p.ticketId));
    setKanbanLocalTickets(allT.filter(t => ids.has(t.id)));
  }, [ticketsQuery.data, ticketPlansQuery.data]);

  const kanbanUpdateMutation = useMutation({
    mutationFn: ({ ticketId, status, reason }: { ticketId: string; status: string; reason?: string }) =>
      updateTicket(ticketId, { status, ...(reason ? { status_change_reason: reason } : {}) } as Partial<Ticket>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets-for-sprint-wizard"] });
    },
  });

  const kanbanActivityUpdateMutation = useMutation({
    mutationFn: ({ activityId, status, reason }: { activityId: string; status: string; reason?: string }) =>
      updateActivity(activityId, { status, ...(reason ? { status_reason: reason.slice(0, 255) } : {}) } as Partial<Activity>),
    onSuccess: (_activity, variables) => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["activity", variables.activityId] });
    },
  });

  const moveKanbanTicket = (ticketId: string, nextStatus: string, reason?: string) => {
    const current = kanbanLocalTickets.find(t => t.id === ticketId);
    if (!current || current.status === nextStatus) return;
    const prev = current.status || "Triagem";
    setKanbanLocalTickets(ts => ts.map(t => t.id === ticketId ? { ...t, status: nextStatus } : t));
    kanbanUpdateMutation.mutate({ ticketId, status: nextStatus, reason }, {
      onError: () => setKanbanLocalTickets(ts => ts.map(t => t.id === ticketId ? { ...t, status: prev } : t)),
    });
  };

  const moveKanbanActivity = (activityId: string, nextColumn: string, reason?: string) => {
    const current = kanbanLocalActivities.find(activity => activity.id === activityId);
    if (!current || getActivityKanbanColumn(current.status) === nextColumn) return;
    const prev = current.status || "Backlog";
    const nextStatus = getActivityStatusForKanbanColumn(nextColumn);
    setKanbanLocalActivities(items => items.map(activity => activity.id === activityId ? { ...activity, status: nextStatus } : activity));
    kanbanActivityUpdateMutation.mutate({ activityId, status: nextStatus, reason }, {
      onError: () => setKanbanLocalActivities(items => items.map(activity => activity.id === activityId ? { ...activity, status: prev } : activity)),
    });
  };

  const applyKanbanMove = (cardKey: string, nextColumn: string, reason?: string) => {
    const [type, itemId] = cardKey.split(":");
    if (!itemId) return;
    if (type === "activity") {
      moveKanbanActivity(itemId, nextColumn, reason);
      return;
    }
    moveKanbanTicket(itemId, nextColumn, reason);
  };

  const moveKanbanCard = (cardKey: string, nextColumn: string) => {
    const [type, itemId] = cardKey.split(":");
    if (!itemId) return;
    // Concluir exige resolução documentada — abre o popup no fluxo de finalização.
    if (nextColumn === "Finalizado") {
      setWiTab("resolucao");
      setWiRef({ type: type === "activity" ? "sprint_activity" : "ticket", id: itemId });
      toast.info("Preencha a resolução para concluir este item.");
      return;
    }
    // Pausar/Bloquear exige motivo registrado.
    if (nextColumn === "Pausado" || nextColumn === "Aguardando cliente") {
      setKanbanPauseCard({ key: cardKey, column: nextColumn });
      return;
    }
    applyKanbanMove(cardKey, nextColumn);
  };

  const sprint = sprintQuery.data;
  const activities = activitiesQuery.data || [];
  const users = usersQuery.data || [];

  const sprintDays = useMemo(() => {
    if (!sprint?.start_at || !sprint?.end_at) return 10;
    const start = new Date(sprint.start_at);
    const end = new Date(sprint.end_at);
    let days = 0;
    const cur = new Date(start);
    while (cur <= end) {
      const dow = cur.getDay();
      if (dow !== 0 && dow !== 6) days++;
      cur.setDate(cur.getDate() + 1);
    }
    return Math.max(1, days);
  }, [sprint?.start_at, sprint?.end_at]);
  const sprintPlans = plansQuery.data || [];
  const participants = participantsQuery.data || [];

  const totalCapacity = participants.length > 0
    ? participants.reduce((s, p) => s + p.capacity, 0)
    : toNumber(sprint?.capacity, 0);

  const allPlans = allPlansQuery.data || [];
  const allTimeEntries = allTimeEntriesQuery.data || [];
  const activityTags = activityTagsQuery.data || [];

  const activityMap = useMemo(
    () => new Map(activities.map((activity) => [activity.id, activity])),
    [activities],
  );
  useEffect(() => {
    const loadedActivities = activitiesQuery.data || [];
    const loadedPlans = plansQuery.data || [];
    const loadedActivityMap = new Map(loadedActivities.map((activity) => [activity.id, activity]));

    setKanbanLocalActivities(
      loadedPlans
        .map((plan) => loadedActivityMap.get(plan.activityId))
        .filter((activity): activity is Activity => Boolean(activity)),
    );
  }, [activitiesQuery.data, plansQuery.data]);

  const userMap = useMemo(
    () =>
      new Map(
        users.map((user) => [
          String(user.id),
          user.name
          || [user.first_name, user.last_name].filter(Boolean).join(" ")
          || user.username
          || user.email
          || "Usuário",
        ]),
      ),
    [users],
  );
  const getUserName = (userId: string | number) =>
    userMap.get(String(userId))
    || participants.find((participant) => String(participant.userId) === String(userId))?.userName
    || "Usuario";

  const getUniqueNames = (names: Array<string | null | undefined>) =>
    Array.from(new Set(names.map((name) => name?.trim()).filter(Boolean))) as string[];

  const getResponsibleNamesFromIds = (ids?: string[]) =>
    ids?.length ? getUniqueNames(ids.map((uid) => getUserName(uid))) : [];

  const tagNameSet = useMemo(
    () => new Set(activityTags.filter((tag) => tag.active).map((tag) => tag.name)),
    [activityTags],
  );

  const techPlannedHours = useMemo(() => {
    const map: Record<string, number> = {};
    for (const plan of sprintPlans) {
      for (const [uid, h] of Object.entries(plan.userHours || {})) {
        map[uid] = (map[uid] || 0) + Number(h);
      }
    }
    for (const tPlan of ticketPlansQuery.data ?? []) {
      for (const [uid, h] of Object.entries(tPlan.userHours || {})) {
        map[uid] = (map[uid] || 0) + Number(h);
      }
    }
    return map;
  }, [sprintPlans, ticketPlansQuery.data]);

  const planningOptions = useMemo(() => {
    return activities
      .map((activity) => {
        const activityPlans = allPlans.filter((plan) => plan.activityId === activity.id);
        const activityPlansOutsideSprint = activityPlans.filter((plan) => plan.sprintId !== id);
        const activityEntries = allTimeEntries.filter((entry) => entry.activityId === activity.id);
        const summary = getActivityExecutionSummary({
          activity,
          plans: activityPlans,
          timeEntries: activityEntries,
        });

        return {
          id: activity.id,
          title: activity.title,
          projectName: activity.project_name || "Sem projeto",
          estimatedHours: summary.estimatedHours,
          plannedHoursOutsideSprint: sumPlannedHours(activityPlansOutsideSprint),
          realizedHours: summary.realizedHours,
          estimatedBalanceHours: summary.estimatedBalanceHours,
        } satisfies SprintActivityPlanOption;
      })
      .sort((left, right) => left.title.localeCompare(right.title, "pt-BR"));
  }, [activities, allPlans, allTimeEntries, id]);
  const allTicketsForPlanning = useMemo(() => {
    return (Array.isArray(ticketsQuery.data)
      ? ticketsQuery.data
      : (ticketsQuery.data as { results?: unknown[] } | undefined)?.results ?? []) as PlanningTicketItem[];
  }, [ticketsQuery.data]);
  const plannedTicketIds = useMemo(
    () => (ticketPlansQuery.data ?? []).map((plan) => plan.ticketId),
    [ticketPlansQuery.data],
  );
  const plannedActivityIds = useMemo(
    () => sprintPlans.map((plan) => plan.activityId),
    [sprintPlans],
  );
  const kanbanCards = useMemo<KanbanCard[]>(() => {
    const ticketPlanByTicket = new Map((ticketPlansQuery.data ?? []).map((plan) => [plan.ticketId, plan]));
    const activityById = new Map(kanbanLocalActivities.map((activity) => [activity.id, activity]));

    const ticketCards = kanbanLocalTickets.map((ticket) => {
      const plan = ticketPlanByTicket.get(ticket.id);
      const responsibleIds = plan?.responsibleIds?.length
        ? plan.responsibleIds.map(String)
        : [
            ...(ticket.technicians || []).map(String),
            ...(ticket.responsible_technician ? [String(ticket.responsible_technician)] : []),
          ];
      return {
        key: `ticket:${ticket.id}`,
        type: "ticket" as const,
        id: ticket.id,
        status: ticket.status || "Triagem",
        title: ticket.title,
        code: ticket.code || ticket.id.slice(0, 8),
        priority: ticket.priority,
        subtitle: ticket.client_name || ticket.organization_name || "Chamado",
        tags: ticket.tags || [],
        responsibleIds,
        hoursLabel: plan ? `${plan.plannedHours ?? 0}h` : `${ticket.est_hours || 0}h`,
        metaLabel: ticket.sla || "Chamado",
      };
    });

    const activityCards = sprintPlans.flatMap((plan) => {
      const activity = activityById.get(plan.activityId) || activityMap.get(plan.activityId);
      if (!activity) return [];
      const responsibleIds = plan.responsibleIds?.length
        ? plan.responsibleIds.map(String)
        : [
            ...(activity.assignees || []).map(String),
            ...(activity.assignee ? [String(activity.assignee)] : []),
          ];
      return [{
        key: `activity:${activity.id}`,
        type: "activity" as const,
        id: activity.id,
        status: getActivityKanbanColumn(activity.status),
        title: activity.title,
        code: activity.ticket_code || activity.id.slice(0, 8),
        priority: plan.priority || activity.priority,
        subtitle: activity.project_name || activity.ticket_code || "Atividade",
        tags: activity.tags || [],
        responsibleIds,
        hoursLabel: `${plan.plannedHours ?? activity.est_hours ?? 0}h`,
        metaLabel: activity.status || "Backlog",
      }];
    });

    return [...ticketCards, ...activityCards];
  }, [activityMap, kanbanLocalActivities, kanbanLocalTickets, sprintPlans, ticketPlansQuery.data]);

  const openTicketUpdates = (ticket: PlanningTicketItem | Ticket, plan?: SprintTicketPlan) => {
    const fullTicket = ticket as Ticket;
    const responsibleNames = getResponsibleNamesFromIds(plan?.responsibleIds);
    const fallbackResponsibleNames = getUniqueNames([
      fullTicket.responsible_technician_name,
      ...(fullTicket.technician_names || []),
    ]);

    setUpdatesDialogItem({
      type: "ticket",
      id: ticket.id,
      code: fullTicket.code,
      title: fullTicket.title,
      status: fullTicket.status,
      priority: plan?.priority || fullTicket.priority,
      typeLabel: fullTicket.type || "Chamado",
      description: fullTicket.description,
      responsibleNames: responsibleNames.length ? responsibleNames : fallbackResponsibleNames,
      plannedHours: plan?.plannedHours ?? fullTicket.est_hours,
      doneHours: fullTicket.done_hours,
      storyPoints: plan?.storyPoints,
      sprintName: sprint?.name,
      plannedEndDate: plan?.plannedEndDate || fullTicket.due_at || undefined,
      subtitle: fullTicket.client_name || fullTicket.organization_name || "Chamado",
    });
  };

  const openActivityUpdates = (activity: Activity, plan?: SprintActivityPlan, realizedHours?: number) => {
    const responsibleNames = getResponsibleNamesFromIds(plan?.responsibleIds);
    const fallbackResponsibleNames = getUniqueNames([
      activity.assignee_name,
      ...(activity.assignee_names || []),
    ]);

    setUpdatesDialogItem({
      type: "activity",
      id: activity.id,
      code: activity.ticket_code || activity.id.slice(0, 8),
      title: activity.title,
      status: activity.status,
      priority: plan?.priority || activity.priority,
      typeLabel: activity.type || "Atividade",
      description: activity.description,
      responsibleNames: responsibleNames.length ? responsibleNames : fallbackResponsibleNames,
      plannedHours: plan?.plannedHours ?? activity.est_hours,
      doneHours: realizedHours ?? activity.done_hours,
      storyPoints: plan?.storyPoints ?? activity.story_points,
      sprintName: sprint?.name,
      plannedEndDate: plan?.plannedEndDate || activity.due_at || undefined,
      subtitle: activity.project_name || activity.ticket_code || "Atividade",
    });
  };

  // Todo card do kanban da sprint abre o mesmo popup unificado de atendimento.
  const openKanbanCardUpdates = (card: KanbanCard) => {
    setWiTab("conversa");
    setWiRef({ type: card.type === "activity" ? "sprint_activity" : "ticket", id: card.id });
  };

  // Merge registered participants with users who have planned hours in this sprint
  const technicianList = useMemo(() => {
    const list: { userId: string; userName: string; capacity: number }[] = [];
    const seen = new Set<string>();
    for (const p of participants) {
      seen.add(String(p.userId));
      list.push({ userId: String(p.userId), userName: p.userName || p.userId, capacity: p.capacity });
    }
    for (const uid of Object.keys(techPlannedHours)) {
      if (!seen.has(uid)) {
        seen.add(uid);
        const user = users.find(u => String(u.id) === uid);
        const name = user ? (user.name || [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || uid) : uid;
        list.push({ userId: uid, userName: name, capacity: 0 });
      }
    }
    return list;
  }, [participants, techPlannedHours, users]);

  const totalPlannedHours = sumPlannedHours(sprintPlans);
  const sprintTimeEntries = allTimeEntries.filter((entry) => entry.sprintId === id);
  const totalRealizedHours = sumRealizedHours(sprintTimeEntries);
  const capacityUtilization = totalCapacity > 0
    ? Math.min(999, Math.round((totalPlannedHours / totalCapacity) * 100))
    : 0;
  const overrunPlans = sprintPlans.filter((plan) => {
    const relatedEntries = allTimeEntries.filter((entry) => entry.activityId === plan.activityId);
    return getSprintPlanExecutionSummary(plan, relatedEntries).status === "over";
  }).length;

  const handleOpenCreatePlan = () => {
    setEditingPlan(null);
    setPlanDialogOpen(true);
  };

  const openWizard = () => {
    setWizardStep(1);
    // Load existing participants
    const existingParticipants = participantsQuery.data || [];
    if (existingParticipants.length > 0) {
      setWizardParticipantRows(existingParticipants.map(p => ({
        userId: p.userId,
        hoursPerDay: String(p.hoursPerDay),
        workingDays: String(p.workingDays),
        availabilityFactor: String(p.availabilityFactor),
        savedId: p.id,
      })));
    } else {
      setWizardParticipantRows([]);
    }
    // Keep existing ticket/activity row loading code below
    setWizardTicketSearch("");
    setWizardActivitySearch("");
    // pre-populate from existing saved plans
    const existingTicketPlans = ticketPlansQuery.data || [];
    setWizardTicketRows(existingTicketPlans.map((p) => ({
      ticketId: p.ticketId,
      responsibleIds: p.responsibleIds || [],
      userHours: Object.fromEntries(Object.entries(p.userHours || {}).map(([k,v]) => [k, String(v)])),
      plannedHours: String(p.plannedHours ?? ""),
      storyPoints: p.storyPoints != null ? String(p.storyPoints) : "",
      priority: p.priority || "Média",
      complexity: p.complexity ? String(p.complexity) : "",
      plannedEndDate: p.plannedEndDate || "",
      notes: p.notes || "",
      savedId: p.id,
    })));
    const existingActivityPlans = plansQuery.data || [];
    setWizardActivityRows(existingActivityPlans.map((p) => ({
      activityId: p.activityId,
      responsibleIds: p.responsibleIds || [],
      userHours: Object.fromEntries(Object.entries(p.userHours || {}).map(([k,v]) => [k, String(v)])),
      plannedHours: String(p.plannedHours ?? ""),
      storyPoints: p.storyPoints != null ? String(p.storyPoints) : "",
      priority: p.priority || "Média",
      complexity: p.complexity ? String(p.complexity) : "",
      plannedEndDate: p.plannedEndDate || "",
      notes: p.notes || "",
      savedId: p.id,
    })));
    setWizardOpen(true);
  };

  const handleWizardNext = async () => {
    if (wizardStep === 1) {
      if (wizardParticipantRows.length === 0) {
        toast.error("Adicione ao menos um participante à sprint.");
        return;
      }
      setWizardSaving(true);
      try {
        for (const row of wizardParticipantRows) {
          if (row.savedId) {
            await saveSprintParticipant(
              { sprintId: id, userId: row.userId, hoursPerDay: Number(row.hoursPerDay), workingDays: Number(row.workingDays), availabilityFactor: Number(row.availabilityFactor) },
              "edit", row.savedId
            );
          } else {
            const saved = await saveSprintParticipant(
              { sprintId: id, userId: row.userId, hoursPerDay: Number(row.hoursPerDay), workingDays: Number(row.workingDays), availabilityFactor: Number(row.availabilityFactor) },
              "create"
            );
            setWizardParticipantRows(prev => prev.map(r => r.userId === row.userId ? { ...r, savedId: saved.id } : r));
          }
        }
        participantsQuery.refetch();
        setWizardStep(2);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao salvar participantes.");
      } finally {
        setWizardSaving(false);
      }
      return;
    }
    if (wizardStep === 2) {
      if (wizardTicketRows.length === 0) { setWizardStep(3); return; }
      for (const row of wizardTicketRows) {
        const t = (Array.isArray(ticketsQuery.data) ? ticketsQuery.data : (ticketsQuery.data as { results?: { code?: string }[] } | undefined)?.results ?? []) as { id: string; code?: string }[];
        const code = t.find(x => x.id === row.ticketId)?.code ?? row.ticketId;
        if (!row.responsibleIds.length) { toast.error(`Chamado ${code}: adicione ao menos um responsável.`); return; }
        if (!Number(row.plannedHours)) { toast.error(`Chamado ${code}: informe as horas planejadas.`); return; }
        if (!row.plannedEndDate) { toast.error(`Chamado ${code}: informe a previsão de término.`); return; }
      }
      setWizardSaving(true);
      try {
        const updatedRows = [...wizardTicketRows];
        for (let i = 0; i < updatedRows.length; i++) {
          const row = updatedRows[i];
          const payload = {
            sprintId: id,
            ticketId: row.ticketId,
            responsibleIds: row.responsibleIds,
            plannedHours: Number(row.plannedHours || 0),
            storyPoints: row.storyPoints ? Number(row.storyPoints) : undefined,
            notes: row.notes,
            userHours: Object.fromEntries(Object.entries(row.userHours).map(([k,v]) => [k, Number(v) || 0])),
            priority: row.priority || "Média",
            complexity: row.complexity ? Number(row.complexity) : undefined,
            plannedEndDate: row.plannedEndDate || "",
          };
          if (row.savedId) {
            await saveSprintTicketPlan({ ...payload, id: row.savedId }, "edit", row.savedId);
          } else {
            const saved = await saveSprintTicketPlan(payload, "create");
            updatedRows[i] = { ...row, savedId: saved.id };
          }
        }
        setWizardTicketRows(updatedRows);
        await queryClient.invalidateQueries({ queryKey: ["sprint-ticket-plans", id] });
        toast.success("Chamados salvos.");
        setWizardStep(3);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao salvar chamados.");
      } finally {
        setWizardSaving(false);
      }
    } else if (wizardStep === 3) {
      if (wizardActivityRows.length === 0) { setWizardStep(4); return; }
      for (const row of wizardActivityRows) {
        const activity = activities.find(a => a.id === row.activityId);
        const label = activity?.title ?? row.activityId;
        if (!row.responsibleIds.length) { toast.error(`Atividade "${label}": adicione ao menos um responsável.`); return; }
        if (!Number(row.plannedHours)) { toast.error(`Atividade "${label}": informe as horas planejadas.`); return; }
        if (!row.plannedEndDate) { toast.error(`Atividade "${label}": informe a previsão de término.`); return; }
      }
      setWizardSaving(true);
      try {
        const updatedRows = [...wizardActivityRows];
        for (let i = 0; i < updatedRows.length; i++) {
          const row = updatedRows[i];
          const activity = activities.find((a) => a.id === row.activityId);
          if (!activity) continue;
          const payload = {
            sprintId: id,
            activityId: row.activityId,
            projectId: activity.project || "",
            responsibleIds: row.responsibleIds,
            plannedHours: Number(row.plannedHours || 0),
            storyPoints: row.storyPoints ? Number(row.storyPoints) : undefined,
            plannedEndDate: row.plannedEndDate || "",
            notes: row.notes,
            userHours: Object.fromEntries(Object.entries(row.userHours).map(([k,v]) => [k, Number(v) || 0])),
            priority: row.priority || "Média",
            complexity: row.complexity ? Number(row.complexity) : undefined,
          };
          if (row.savedId) {
            await saveSprintActivityPlan({ ...payload, id: row.savedId }, "edit", row.savedId);
          } else {
            const saved = await saveSprintActivityPlan(payload, "create");
            updatedRows[i] = { ...row, savedId: saved.id };
          }
        }
        setWizardActivityRows(updatedRows);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["sprint-activity-plans", id] }),
          queryClient.invalidateQueries({ queryKey: ["all-sprint-activity-plans"] }),
        ]);
        toast.success("Atividades salvas.");
        setWizardStep(4);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao salvar atividades.");
      } finally {
        setWizardSaving(false);
      }
    }
  };

  const handleWizardFinish = async () => {
    await queryClient.invalidateQueries({ queryKey: ["sprint", id] });
    toast.success("Planejamento concluído!");
    setWizardOpen(false);
  };

  const handleOpenEditPlan = (plan: SprintActivityPlan) => {
    setEditingPlan(plan);
    setPlanDialogOpen(true);
  };

  const handleSavePlan = async (data: ReturnType<typeof toSprintActivityPlanFormData>) => {
    const selectedActivity = activities.find((activity) => activity.id === data.activityId) || null;

    if (!selectedActivity) {
      toast.error("Selecione a atividade que será planejada.");
      return;
    }

    setSavingPlan(true);
    try {
      await saveSprintActivityPlan(
        {
          id: editingPlan?.id,
          sprintId: id,
          activityId: data.activityId,
          projectId: selectedActivity.project || "",
          responsibleIds: data.responsibleIds,
          plannedHours: Number(data.plannedHours || 0),
          storyPoints: data.storyPoints ? Number(data.storyPoints) : undefined,
          plannedStartDate: data.plannedStartDate || "",
          plannedEndDate: data.plannedEndDate || "",
          order: data.order ? Number(data.order) : undefined,
          notes: data.notes || "",
        },
        editingPlan ? "edit" : "create",
        editingPlan?.id,
      );

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sprint-activity-plans", id] }),
        queryClient.invalidateQueries({ queryKey: ["all-sprint-activity-plans"] }),
        queryClient.invalidateQueries({ queryKey: ["activity-sprint-plans", data.activityId] }),
      ]);

      toast.success(editingPlan ? "Planejamento atualizado." : "Planejamento criado.");
      setPlanDialogOpen(false);
      setEditingPlan(null);
    } catch (error) {
      toast.error(parseApiError(error, "Não foi possível salvar o planejamento."));
    } finally {
      setSavingPlan(false);
    }
  };

  const handleDeletePlan = async (plan: SprintActivityPlan) => {
    try {
      await deleteSprintActivityPlan(plan.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sprint-activity-plans", id] }),
        queryClient.invalidateQueries({ queryKey: ["all-sprint-activity-plans"] }),
        queryClient.invalidateQueries({ queryKey: ["activity-sprint-plans", plan.activityId] }),
      ]);
      toast.success("Planejamento removido.");
    } catch (error) {
      toast.error(parseApiError(error, "Não foi possível remover o planejamento."));
    }
  };

  const handleStartSprint = async () => {
    try {
      await startSprint(id);
      await queryClient.invalidateQueries({ queryKey: ["sprint", id] });
      await queryClient.invalidateQueries({ queryKey: ["sprints"] });
      toast.success("Sprint iniciada!");
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      if (error?.response?.status === 409) {
        const shouldForce = window.confirm(`${detail}\n\nIniciar mesmo assim?`);
        if (shouldForce) {
          try {
            await startSprint(id, { force: true });
            await queryClient.invalidateQueries({ queryKey: ["sprint", id] });
            toast.success("Sprint iniciada!");
            return;
          } catch {
            toast.error("Não foi possível iniciar a sprint.");
            return;
          }
        }
        return;
      }
      toast.error(detail || "Não foi possível iniciar a sprint.");
    }
  };

  const handleCloseSprint = async () => {
    try {
      setClosingSprintPending(true);
      await closeSprint(id, { notes: closeNotes });
      await queryClient.invalidateQueries({ queryKey: ["sprint", id] });
      await queryClient.invalidateQueries({ queryKey: ["sprint-review", id] });
      setCloseSprintOpen(false);
      toast.success("Sprint encerrada com sucesso!");
    } catch {
      toast.error("Não foi possível encerrar a sprint.");
    } finally {
      setClosingSprintPending(false);
    }
  };

  const handleSaveRetro = async () => {
    try {
      setRetroSaving(true);
      await saveSprintRetrospective(
        { sprint: id, went_well: retroWentWell, to_improve: retroToImprove, action_items: [] },
        retroQuery.data?.id,
      );
      await queryClient.invalidateQueries({ queryKey: ["sprint-retrospective", id] });
      toast.success("Retrospectiva salva!");
    } catch {
      toast.error("Não foi possível salvar a retrospectiva.");
    } finally {
      setRetroSaving(false);
    }
  };

  if (pathname !== `/sprints/${id}`) {
    return <Outlet />;
  }

  if (sprintQuery.isLoading) {
    return (
      <AppShell>
        <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">Carregando sprint...</div>
      </AppShell>
    );
  }

  if (!sprint) {
    return (
      <AppShell>
        <div className="glass rounded-2xl p-6 text-sm text-destructive">Sprint não encontrada.</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          crumbs={[{ label: "Sprints", to: "/sprints" }, { label: sprint.name }]}
          title={sprint.name}
          subtitle={`${formatDate(sprint.start_at)} a ${formatDate(sprint.end_at)} · ${sprint.lead_name || "Sem responsável"}`}
          badges={
            <span className="rounded bg-success/15 px-2 py-1 text-[11px] text-success">
              {formatSprintStatusLabel(sprint.status || "Planejada")}
            </span>
          }
          actions={
            <>
              {(sprintPlans.length > 0 || (ticketPlansQuery.data?.length ?? 0) > 0) ? (
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => {
                    setUnplannedTicketRows([]);
                    setUnplannedActivityRows([]);
                    setUnplannedExpandedRows(new Set());
                    setUnplannedTicketSearch("");
                    setUnplannedActivitySearch("");
                    setUnplannedTab("chamados");
                    setUnplannedOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Adicionar não planejados
                </Button>
              ) : (
                <Button
                  type="button"
                  className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
                  onClick={openWizard}
                >
                  <Plus className="h-4 w-4" />
                  Planejar sprint
                </Button>
              )}
              {sprint.status === "Planejada" && (
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
                  onClick={() => void handleStartSprint()}
                >
                  ▶ Iniciar Sprint
                </Button>
              )}
              {sprint.status === "Em andamento" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-success/40 text-success hover:bg-success/10"
                  onClick={() => setCloseSprintOpen(true)}
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  Fechar Sprint
                </Button>
              )}
              <Button variant="outline" size="sm" className="gap-1.5" asChild>
                <Link to="/sprints/$id/edit" params={{ id }}>
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </Link>
              </Button>
              <ConfirmDelete
                onConfirm={async () => {
                  await Promise.all(sprintPlans.map((plan) => deleteSprintActivityPlan(plan.id)));
                  await deleteSprint(id);
                  toast.success("Sprint excluída.");
                  navigate({ to: "/sprints" });
                }}
              />
            </>
          }
        />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Itens planejados" value={String(sprintPlans.length + (ticketPlansQuery.data?.length ?? 0))} />
          <Stat label="Horas planejadas" value={formatHoursLabel(totalPlannedHours)} />
          <Stat label="Horas realizadas" value={formatHoursLabel(totalRealizedHours)} />
          <Stat label="Uso da capacidade" value={`${capacityUtilization}%`} />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="border border-border bg-muted/40">
            <TabsTrigger value="overview">Visão geral</TabsTrigger>
            <TabsTrigger value="planning">Planejamento</TabsTrigger>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
            <TabsTrigger value="burndown">Burndown</TabsTrigger>
            <TabsTrigger value="retrospective">Retrospectiva</TabsTrigger>
            <TabsTrigger value="review">Review</TabsTrigger>
            <TabsTrigger value="velocity">Velocidade</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
              {/* ── Left column ── */}
              <div className="space-y-4">
                {/* Details card */}
                <div className="rounded-lg border border-border bg-card">
                  <div className="flex items-center justify-between border-b border-border px-5 py-4">
                    <h3 className="text-lg font-semibold text-foreground">Detalhes da sprint</h3>
                  </div>
                  <div className="grid items-start gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
                    <SprintFieldBox label="Status" noPadding>
                      <span className={`grid w-full place-items-center text-sm font-semibold ${SPRINT_OVERVIEW_STATUS[formatSprintStatusLabel(sprint.status || "Planejada")] ?? "bg-muted text-muted-foreground"}`}>
                        {formatSprintStatusLabel(sprint.status || "Planejada")}
                      </span>
                    </SprintFieldBox>
                    <SprintFieldBox label="Responsável" left>
                      <div className="flex items-center gap-2">
                        {sprint.lead_name ? (
                          <>
                            <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gradient-primary text-[10px] font-bold text-primary-foreground">
                              {sprint.lead_name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()}
                            </div>
                            <span>{sprint.lead_name}</span>
                          </>
                        ) : <span className="text-muted-foreground">—</span>}
                      </div>
                    </SprintFieldBox>
                    <SprintFieldBox label="Capacidade">
                      <span className="font-medium">{formatHoursLabel(toNumber(sprint.capacity, 0))}</span>
                    </SprintFieldBox>
                    <SprintFieldBox label="Início">
                      <span>{formatDate(sprint.start_at)}</span>
                    </SprintFieldBox>
                    <SprintFieldBox label="Fim">
                      <span>{formatDate(sprint.end_at)}</span>
                    </SprintFieldBox>
                    <SprintFieldBox label="Horas planejadas">
                      <span className="font-medium">{formatHoursLabel(totalPlannedHours)}</span>
                    </SprintFieldBox>
                    <SprintFieldBox label="Total realizado">
                      <span className="font-medium">{formatHoursLabel(totalRealizedHours)}</span>
                    </SprintFieldBox>
                    <SprintFieldBox label="Chamados planejados">
                      <span className="font-medium">{ticketPlansQuery.data?.length ?? 0}</span>
                    </SprintFieldBox>
                    <SprintFieldBox label="Atividades planejadas">
                      <span className="font-medium">{sprintPlans.length}</span>
                    </SprintFieldBox>
                  </div>
                </div>

                {/* Objetivo */}
                <div className="rounded-lg border border-border bg-card">
                  <div className="flex items-center justify-between border-b border-border px-5 py-4">
                    <h3 className="text-lg font-semibold text-foreground">Objetivo da sprint</h3>
                  </div>
                  <div className="min-h-[80px] whitespace-pre-wrap px-5 py-4 text-sm leading-relaxed text-foreground/80">
                    {sprint.goal || "Nenhum objetivo informado."}
                  </div>
                </div>

                {/* Indicadores */}
                <div className="rounded-lg border border-border bg-card">
                  <div className="flex items-center justify-between border-b border-border px-5 py-4">
                    <h3 className="text-lg font-semibold text-foreground">Indicadores</h3>
                  </div>
                  <div className="grid gap-4 p-5 sm:grid-cols-2">
                    <SprintFieldBox label="Atividades estouradas">
                      <span className={`font-semibold ${overrunPlans > 0 ? "text-destructive" : "text-success"}`}>{overrunPlans}</span>
                    </SprintFieldBox>
                    <SprintFieldBox label="Apontamentos na sprint">
                      <span className="font-medium">{sprintTimeEntries.length}</span>
                    </SprintFieldBox>
                    <SprintFieldBox label="Saldo de capacidade">
                      {(() => { const saldo = toNumber(sprint.capacity, 0) - totalPlannedHours; return <span className={`font-semibold ${saldo < 0 ? "text-destructive" : "text-success"}`}>{saldo < 0 ? "-" : "+"}{formatHoursLabel(Math.abs(saldo))}</span>; })()}
                    </SprintFieldBox>
                    <SprintFieldBox label="Utilização">
                      {toNumber(sprint.capacity, 0) > 0 ? (
                        <div className="flex w-full items-center gap-3">
                          <div className="flex-1 h-2 overflow-hidden rounded-full bg-muted">
                            <div className={`h-full rounded-full transition-all ${capacityUtilization > 100 ? "bg-destructive" : "bg-gradient-primary"}`} style={{ width: `${Math.min(100, capacityUtilization)}%` }} />
                          </div>
                          <span className={`shrink-0 text-xs font-semibold ${capacityUtilization > 100 ? "text-destructive" : "text-foreground"}`}>{capacityUtilization}%</span>
                        </div>
                      ) : <span className="text-muted-foreground">—</span>}
                    </SprintFieldBox>
                  </div>
                </div>
              </div>

              {/* ── Right column: technicians ── */}
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-card">
                  <div className="flex items-center justify-between border-b border-border px-5 py-4">
                    <h3 className="text-lg font-semibold text-foreground">Capacidade por técnico</h3>
                  </div>
                  <div className="p-4 space-y-2">
                    {technicianList.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Nenhum técnico com horas planejadas.</p>
                    ) : technicianList.map(p => {
                      const plannedH = techPlannedHours[p.userId] || 0;
                      const realizedH = allTimeEntries.filter(e => e.sprintId === id && String(e.collaboratorId) === p.userId).reduce((s, e) => s + toNumber(e.hours, 0), 0);
                      const pct = plannedH > 0 ? Math.min(100, Math.round((realizedH / plannedH) * 100)) : 0;
                      const over = realizedH > plannedH;
                      return (
                        <div key={p.userId} className="rounded-lg border border-border bg-muted/20 px-3 py-2.5 space-y-2">
                          <div className="flex items-center gap-3">
                            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-primary text-[11px] font-semibold text-primary-foreground">
                              {(p.userName || "?")[0].toUpperCase()}
                            </div>
                            <span className="flex-1 text-sm font-medium truncate">{p.userName || p.userId}</span>
                            <span className={`shrink-0 text-xs font-semibold ${over ? "text-destructive" : "text-muted-foreground"}`}>
                              {formatHoursLabel(realizedH)} / {formatHoursLabel(plannedH)}
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div className={`h-full rounded-full transition-all ${over ? "bg-destructive" : "bg-gradient-primary"}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="planning" className="space-y-4">
            {(() => {
              const allTicketsForPlan = (Array.isArray(ticketsQuery.data)
                ? ticketsQuery.data
                : (ticketsQuery.data as { results?: unknown[] } | undefined)?.results ?? []) as Ticket[];

              const totalRows = (ticketPlansQuery.data?.length ?? 0) + sprintPlans.length;

              // Per-technician hour totals from userHours of all plans
              const techHours: Record<string, number> = {};
              for (const plan of sprintPlans) {
                for (const [uid, h] of Object.entries(plan.userHours || {})) {
                  techHours[uid] = (techHours[uid] || 0) + Number(h);
                }
              }
              for (const tPlan of ticketPlansQuery.data ?? []) {
                for (const [uid, h] of Object.entries(tPlan.userHours || {})) {
                  techHours[uid] = (techHours[uid] || 0) + Number(h);
                }
              }
              const techEntries = Object.entries(techHours).filter(([, h]) => h > 0);
              const sprintCapacity = toNumber(sprint.capacity, 0);

              if (totalRows === 0) {
                return (
                  <div className="glass rounded-2xl p-5 text-sm text-muted-foreground shadow-card">
                    Nenhum item foi planejado para esta sprint ainda.
                  </div>
                );
              }

              return (
                <>
                {techEntries.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{totalRows} item(s) planejado(s)</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                          <Users className="h-3.5 w-3.5" />
                          Carga por técnico
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-4 glass" align="end">
                        <p className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Horas planejadas por técnico</p>
                        <div className="space-y-3">
                          {techEntries.map(([uid, h]) => {
                            const name = getUserName(uid);
                            const pct = sprintCapacity > 0 ? Math.min(100, Math.round((h / sprintCapacity) * 100)) : 0;
                            const over = sprintCapacity > 0 && h > sprintCapacity;
                            return (
                              <div key={uid} className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-medium truncate max-w-[140px]">{name}</span>
                                  <span className={over ? "text-destructive font-semibold" : "text-muted-foreground"}>
                                    {formatHoursLabel(h)}{sprintCapacity > 0 ? ` / ${formatHoursLabel(sprintCapacity)}` : ""}
                                  </span>
                                </div>
                                {sprintCapacity > 0 && (
                                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                    <div
                                      className={`h-full rounded-full ${over ? "bg-destructive" : "bg-gradient-primary"}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                <div className="glass rounded-2xl shadow-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
                          <th className="px-4 py-3 text-left font-medium">Tarefa</th>
                          <th className="w-28 px-4 py-3 text-left font-medium">Resp.</th>
                          <th className="w-36 px-4 py-3 text-left font-medium">Status</th>
                          <th className="w-28 px-4 py-3 text-left font-medium">Prioridade</th>
                          <th className="w-36 px-4 py-3 text-left font-medium">Tipo</th>
                          <th className="w-28 px-4 py-3 text-right font-medium">Horas Planejadas</th>
                          <th className="w-28 px-4 py-3 text-right font-medium">Horas Executadas</th>
                          <th className="w-20 px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {/* Ticket rows */}
                        {(ticketPlansQuery.data ?? []).map((tPlan) => {
                          const ticket = allTicketsForPlan.find((t) => t.id === tPlan.ticketId);
                          const respNames = getResponsibleNamesFromIds(tPlan.responsibleIds);
                          return (
                            <tr
                              key={`ticket-${tPlan.id}`}
                              className="group border-b border-border/60 last:border-0 transition-colors hover:bg-muted/30 cursor-pointer"
                              onClick={() => ticket && openTicketUpdates(ticket, tPlan)}
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="shrink-0 grid h-5 w-5 place-items-center rounded-full bg-primary/20 text-primary">
                                    <MessageSquare className="h-3 w-3" />
                                  </span>
                                  {ticket?.code && (
                                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{ticket.code}</span>
                                  )}
                                  <span className="truncate font-medium text-foreground">{ticket?.title ?? tPlan.ticketId}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <SprintAvatarGroup names={respNames} />
                              </td>
                              <td className="px-4 py-3">
                                {ticket?.status ? (
                                  <SprintStatusBadge status={ticket.status} />
                                ) : <span className="text-xs text-muted-foreground">—</span>}
                              </td>
                              <td className="px-4 py-3">
                                <SprintPriorityBadge priority={tPlan.priority ?? ticket?.priority ?? ""} />
                              </td>
                              <td className="px-4 py-3">
                                <SprintTypeBadge type={ticket?.type ?? ticket?.category_name ?? "Chamado"} />
                              </td>
                              <td className="px-4 py-3 text-right text-sm font-medium text-foreground">{formatHoursLabel(tPlan.plannedHours ?? 0)}</td>
                              <td className="px-4 py-3 text-right text-sm text-muted-foreground">{ticket?.done_hours != null ? `${ticket.done_hours} h` : "—"}</td>
                              <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                <ConfirmDelete
                                  trigger={
                                    <button type="button" className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive/50 hover:text-destructive">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  }
                                  title="Remover planejamento?"
                                  description="Este chamado sairá do planejamento desta sprint."
                                  onConfirm={async () => { await deleteSprintTicketPlan(tPlan.id); ticketPlansQuery.refetch(); }}
                                />
                              </td>
                            </tr>
                          );
                        })}

                        {/* Activity rows */}
                        {sprintPlans.map((plan) => {
                          const activity = activityMap.get(plan.activityId);
                          const relatedEntries = allTimeEntries.filter((e) => e.activityId === plan.activityId);
                          const planSummary = getSprintPlanExecutionSummary(plan, relatedEntries);
                          const respNames = getResponsibleNamesFromIds(plan.responsibleIds);
                          return (
                            <tr
                              key={`activity-${plan.id}`}
                              className="group border-b border-border/60 last:border-0 transition-colors hover:bg-muted/30 cursor-pointer"
                              onClick={() => activity && openActivityUpdates(activity, plan, planSummary.realizedHours)}
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="shrink-0 grid h-5 w-5 place-items-center rounded-full bg-violet-500/20 text-violet-400">
                                    <CheckCircle className="h-3 w-3" />
                                  </span>
                                  <span className="truncate font-medium text-foreground">{activity?.title ?? plan.activityId}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <SprintAvatarGroup names={respNames} />
                              </td>
                              <td className="px-4 py-3">
                                {activity?.status ? (
                                  <SprintStatusBadge status={activity.status} />
                                ) : <span className="text-xs text-muted-foreground">—</span>}
                              </td>
                              <td className="px-4 py-3">
                                <SprintPriorityBadge priority={plan.priority ?? activity?.priority ?? ""} />
                              </td>
                              <td className="px-4 py-3">
                                <SprintTypeBadge type={activity?.type ?? "Atividade"} />
                              </td>
                              <td className="px-4 py-3 text-right text-sm font-medium text-foreground">{formatHoursLabel(planSummary.plannedHours)}</td>
                              <td className="px-4 py-3 text-right text-sm text-muted-foreground">{formatHoursLabel(planSummary.realizedHours)}</td>
                              <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                <ConfirmDelete
                                  trigger={
                                    <button type="button" className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive/50 hover:text-destructive">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  }
                                  title="Remover planejamento?"
                                  description="Esta atividade sairá do planejamento desta sprint."
                                  onConfirm={() => handleDeletePlan(plan)}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                </>
              );
            })()}
          </TabsContent>

          <TabsContent value="kanban">
  <div className="flex flex-col gap-4" style={{ height: "calc(100dvh - 18rem)" }}>
    {/* Filter bar */}
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setKanbanShowFilters(f => !f)}
        className="glass rounded-lg px-3 py-1.5 text-xs transition-colors hover:border-primary/40"
      >
        Filtrar {kanbanShowFilters ? "▲" : "▼"}
      </button>
      {kanbanShowFilters && (
        <>
          <select
            value={kanbanFilterTech}
            onChange={e => setKanbanFilterTech(e.target.value)}
            className="rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs outline-none focus:border-primary"
          >
            <option value="">Todos os técnicos</option>
            {users.map(u => (
              <option key={u.id} value={String(u.id)}>
                {u.name || [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username}
              </option>
            ))}
          </select>
          <select
            value={kanbanFilterPriority}
            onChange={e => setKanbanFilterPriority(e.target.value)}
            className="rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs outline-none focus:border-primary"
          >
            <option value="">Todas as prioridades</option>
            {["Crítica", "Alta", "Média", "Baixa"].map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          {(kanbanFilterTech || kanbanFilterPriority) && (
            <button
              type="button"
              onClick={() => { setKanbanFilterTech(""); setKanbanFilterPriority(""); }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Limpar
            </button>
          )}
        </>
      )}
      <span className="ml-auto text-xs text-muted-foreground">
        {kanbanCards.filter(card => card.type === "ticket").length} chamado(s) · {kanbanCards.filter(card => card.type === "activity").length} atividade(s)
      </span>
    </div>

    {/* Columns */}
    <div className="-mx-2 flex min-h-0 flex-1 gap-4 overflow-x-auto px-2 pb-4">
      {sprintKanbanCols.map(col => {
        const colCards = kanbanCards
          .filter(card => card.status === col.name)
          .filter(card => !kanbanFilterTech || card.responsibleIds.map(String).includes(kanbanFilterTech))
          .filter(card => !kanbanFilterPriority || normalizeKanbanPriority(card.priority) === kanbanFilterPriority);

        return (
          <div
            key={col.name}
            className={`glass flex h-full min-h-0 w-72 shrink-0 flex-col rounded-2xl p-3 ${kanbanActiveCol === col.name ? "border-primary/50 ring-1 ring-primary/30" : ""}`}
            onDragOver={e => { e.preventDefault(); if (kanbanDragId) { e.dataTransfer.dropEffect = "move"; setKanbanActiveCol(col.name); } }}
            onDragLeave={() => { if (kanbanActiveCol === col.name) setKanbanActiveCol(null); }}
            onDrop={e => {
              e.preventDefault();
              const cardKey = e.dataTransfer.getData("text/plain") || kanbanDragId;
              setKanbanActiveCol(null);
              setKanbanDragId(null);
              if (cardKey) moveKanbanCard(cardKey, col.name);
            }}
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${col.accent}`} />
                <span className="text-sm font-medium">{col.label}</span>
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{colCards.length}</span>
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {colCards.map(card => {
                const openCard = () => openKanbanCardUpdates(card);
                const priorityLabel = normalizeKanbanPriority(card.priority);
                return (
                  <div
                    key={card.key}
                    draggable
                    onDragStart={e => { setKanbanDragId(card.key); setKanbanActiveCol(col.name); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", card.key); }}
                    onDragEnd={() => { setKanbanDragId(null); setKanbanActiveCol(null); }}
                    className={`group rounded-xl border border-border bg-card/80 p-3 transition-all hover:border-primary/40 hover:shadow-glow ${kanbanDragId === card.key ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <button type="button"
                        onClick={openCard}
                        className="font-mono text-[10px] text-muted-foreground hover:text-primary">
                        {card.code}
                      </button>
                      <div className="flex items-center gap-1">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${card.type === "activity" ? "bg-violet-500/15 text-violet-400 border-violet-500/30" : "bg-blue-500/15 text-blue-400 border-blue-500/30"}`}>
                          {card.type === "activity" ? "Atividade" : "Chamado"}
                        </span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${PRIORITY_COLORS[priorityLabel] || ""}`}>
                          {priorityLabel}
                        </span>
                      </div>
                    </div>
                    <button type="button"
                      onClick={openCard}
                      className="mt-1.5 block w-full text-left text-sm leading-snug hover:text-primary">
                      {card.title}
                    </button>
                    {card.subtitle && <p className="mt-1 text-[11px] text-muted-foreground">{card.subtitle}</p>}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(card.tags || []).map(tag => (
                        <span key={tag} className="rounded border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">{tag}</span>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{card.metaLabel}</span>
                        <span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" />0</span>
                        <span className="inline-flex items-center gap-1"><Paperclip className="h-3 w-3" />0</span>
                      </div>
                      <span className="rounded bg-accent/15 px-1.5 py-0.5 font-mono text-[10px] text-accent">
                        {card.hoursLabel}
                      </span>
                    </div>
                    <label className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="shrink-0">Mover para</span>
                      <select
                        value={card.status}
                        onChange={e => moveKanbanCard(card.key, e.target.value)}
                        className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none transition-colors hover:border-primary/40 focus:border-primary/40"
                      >
                        {sprintKanbanCols.map(s => <option key={s.name} value={s.name}>{s.label}</option>)}
                      </select>
                    </label>
                  </div>
                );
              })}
              {colCards.length === 0 && (
                <div className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                  Solte um card aqui
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  </div>
</TabsContent>

          <TabsContent value="burndown" className="space-y-4">
                <div className="glass rounded-2xl p-5 shadow-card">
                  <h3 className="mb-4 text-sm font-semibold">Burndown da sprint</h3>
                  {burndownQuery.isLoading ? (
                    <div className="text-sm text-muted-foreground">Carregando...</div>
                  ) : !burndownQuery.data || burndownQuery.data.length === 0 ? (
                    <div className="glass rounded-2xl p-5 text-sm text-muted-foreground">
                      Sem dados de burndown disponíveis para este sprint.
                    </div>
                  ) : (
                    <SprintBurndownChart data={burndownQuery.data} />
                  )}
                </div>
              </TabsContent>

              <TabsContent value="retrospective" className="space-y-4">
                <div className="glass rounded-2xl p-5 shadow-card space-y-4">
                  <h3 className="text-sm font-semibold">Retrospectiva da Sprint</h3>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">O que foi bem?</label>
                    <textarea
                      className="w-full min-h-[80px] rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none"
                      placeholder="Liste os pontos positivos da sprint..."
                      value={retroQuery.data?.went_well || retroWentWell}
                      onChange={(e) => setRetroWentWell(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">O que pode melhorar?</label>
                    <textarea
                      className="w-full min-h-[80px] rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none"
                      placeholder="Liste pontos de melhoria..."
                      value={retroQuery.data?.to_improve || retroToImprove}
                      onChange={(e) => setRetroToImprove(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      disabled={retroSaving}
                      onClick={handleSaveRetro}
                    >
                      {retroSaving ? "Salvando..." : "Salvar retrospectiva"}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="review" className="space-y-4">
                <div className="glass rounded-2xl p-5 shadow-card space-y-4">
                  <h3 className="text-sm font-semibold">Review da Sprint</h3>
                  {reviewQuery.data ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-xl border border-border bg-muted/10 p-4 text-center">
                        <div className="text-2xl font-bold">{reviewQuery.data.delivered_points}</div>
                        <div className="text-xs text-muted-foreground">Pontos entregues</div>
                        <div className="mt-1 text-xs text-muted-foreground">de {reviewQuery.data.planned_points} planejados</div>
                      </div>
                      <div className="rounded-xl border border-border bg-muted/10 p-4 text-center">
                        <div className="text-2xl font-bold">{reviewQuery.data.delivered_items}</div>
                        <div className="text-xs text-muted-foreground">Itens entregues</div>
                        <div className="mt-1 text-xs text-muted-foreground">de {reviewQuery.data.planned_items} planejados</div>
                      </div>
                      {reviewQuery.data.notes && (
                        <div className="col-span-2 rounded-xl border border-border bg-muted/10 p-4 text-sm">
                          {reviewQuery.data.notes}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border bg-muted/10 px-4 py-6 text-center text-sm text-muted-foreground">
                      Review ainda não gerado. Feche a sprint para gerar automaticamente.
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="velocity" className="space-y-4">
                <div className="glass rounded-2xl p-5 shadow-card space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Velocidade histórica</h3>
                    {velocityQuery.data && (
                      <span className="rounded-md bg-primary/10 px-2 py-1 text-xs text-primary">
                        Média: {velocityQuery.data.avg_velocity} pts/sprint
                      </span>
                    )}
                  </div>
                  {velocityQuery.isLoading ? (
                    <div className="text-xs text-muted-foreground">Carregando velocidade...</div>
                  ) : !velocityQuery.data?.sprints?.length ? (
                    <div className="rounded-xl border border-border bg-muted/10 px-4 py-6 text-center text-sm text-muted-foreground">
                      Nenhum dado de velocidade disponível ainda.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={velocityQuery.data.sprints} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="sprint_name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                        />
                        <Bar dataKey="delivered_points" name="Pontos entregues" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        {velocityQuery.data.avg_velocity > 0 && (
                          <ReferenceLine y={velocityQuery.data.avg_velocity} stroke="hsl(var(--warning))" strokeDasharray="4 4" label={{ value: "Média", fontSize: 10 }} />
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </TabsContent>
          </Tabs>
      </div>


      {/* ─── 3-step planning wizard ─── */}
      <WorkItemUpdatesDialog
        open={Boolean(updatesDialogItem)}
        item={updatesDialogItem}
        onOpenChange={(open) => {
          if (!open) setUpdatesDialogItem(null);
        }}
      />

      {/* Popup unificado de atendimento (chamados e atividades da sprint) */}
      <WorkItemModal
        workRef={wiRef}
        open={Boolean(wiRef)}
        initialTab={wiTab}
        onOpenChange={(open) => {
          if (!open) { setWiRef(null); setWiTab("conversa"); }
        }}
        onChanged={() => {
          void queryClient.invalidateQueries({ queryKey: ["activities"] });
          void queryClient.invalidateQueries({ queryKey: ["tickets-for-sprint-wizard"] });
          void queryClient.invalidateQueries({ queryKey: ["all-activity-time-entries"] });
          void queryClient.invalidateQueries({ queryKey: ["sprint-activity-plans", id] });
        }}
      />

      {/* Pausar/Bloquear no kanban exige motivo */}
      <WorkItemBlockDialog
        open={Boolean(kanbanPauseCard)}
        onOpenChange={(open) => { if (!open) setKanbanPauseCard(null); }}
        title={kanbanPauseCard?.column === "Pausado" ? "Pausar item" : "Bloquear / aguardar"}
        description="Informe o motivo — ele fica registrado no histórico do item."
        actionLabel="Confirmar"
        saving={kanbanUpdateMutation.isPending || kanbanActivityUpdateMutation.isPending}
        onConfirm={(reason) => {
          if (kanbanPauseCard) applyKanbanMove(kanbanPauseCard.key, kanbanPauseCard.column, reason);
          setKanbanPauseCard(null);
        }}
      />

      <Dialog open={wizardOpen} onOpenChange={(open) => { if (!open) setWizardOpen(false); }}>
        <DialogContent className="max-w-[98vw] w-[1600px] glass-strong max-h-[90vh] flex flex-col overflow-hidden p-0">
          {/* wizard header + step indicators */}
          <div className="flex-shrink-0 border-b border-border px-6 pt-5 pb-4">
            <DialogTitle className="text-lg font-semibold">Planejamento da sprint</DialogTitle>
            <DialogDescription className="sr-only">Planejamento em 4 etapas</DialogDescription>
            <div className="mt-4 flex items-center gap-2">
              {(["Participantes", "Chamados", "Atividades", "Finalização"] as const).map((label, idx) => {
                const step = (idx + 1) as 1 | 2 | 3 | 4;
                const done = wizardStep > step;
                const active = wizardStep === step;
                return (
                  <div key={label} className="flex items-center gap-2">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                      done ? "bg-primary text-primary-foreground" :
                      active ? "bg-gradient-primary text-white shadow-glow" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {done ? <Check className="h-3.5 w-3.5" /> : step}
                    </div>
                    <span className={`text-sm font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
                    {idx < 3 && <ChevronRight className="h-4 w-4 text-muted-foreground/50" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* live technician load bar — visible on steps 2 and 3 (tickets and activities) */}
          {wizardStep > 1 && wizardStep < 4 && (() => {
            // sum userHours from all wizard rows
            const liveHours: Record<string, number> = {};
            for (const row of [...wizardTicketRows, ...wizardActivityRows]) {
              for (const [uid, h] of Object.entries(row.userHours || {})) {
                liveHours[uid] = (liveHours[uid] || 0) + Number(h);
              }
            }
            const techEntries = Object.entries(liveHours).filter(([, h]) => h > 0);
            if (techEntries.length === 0) return null;
            return (
              <div className="flex-shrink-0 border-b border-border bg-muted/20 px-6 py-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Carga por técnico</p>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  {techEntries.map(([uid, h]) => {
                    const name = getUserName(uid);
                    const participantCapacity = wizardParticipantRows.find(r => r.userId === uid);
                    const indivCapacity = participantCapacity
                      ? Number(participantCapacity.hoursPerDay) * Number(participantCapacity.workingDays) * (Number(participantCapacity.availabilityFactor) / 100)
                      : toNumber(sprint?.capacity, 0);
                    const pct = indivCapacity > 0 ? Math.min(100, Math.round((h / indivCapacity) * 100)) : 0;
                    const over = indivCapacity > 0 && h > indivCapacity;
                    return (
                      <div key={uid} className="flex items-center gap-2 min-w-[180px]">
                        <span className="text-xs font-medium truncate max-w-[100px]">{name}</span>
                        <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-muted min-w-[60px]">
                          <div className={`h-full rounded-full ${over ? "bg-destructive" : "bg-gradient-primary"}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className={`text-[10px] whitespace-nowrap shrink-0 ${over ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                          {formatHoursLabel(h)}{indivCapacity > 0 ? ` / ${formatHoursLabel(indivCapacity)}` : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* step content */}
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">

            {/* ── STEP 1: Participantes ── */}
            {wizardStep === 1 && (() => {
              const alreadyAddedIds = new Set(wizardParticipantRows.map(r => r.userId));
              const availableUsers = users.filter(u => !alreadyAddedIds.has(String(u.id)));

              const updateParticipantRow = (userId: string, patch: Partial<typeof wizardParticipantRows[0]>) => {
                setWizardParticipantRows(prev => prev.map(r => r.userId === userId ? { ...r, ...patch } : r));
              };

              return (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Selecione os participantes desta sprint e defina a disponibilidade de cada um. A capacidade total da sprint será calculada automaticamente.
                  </p>

                  {/* Add participant */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" className="flex w-full items-center gap-2 rounded-xl border border-dashed border-primary/40 py-2.5 px-4 text-sm text-primary transition hover:border-primary hover:bg-primary/5">
                        <Plus className="h-4 w-4" />
                        Adicionar participante
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-0 glass" align="start">
                      <div className="max-h-60 overflow-y-auto">
                        {availableUsers.length === 0 ? (
                          <p className="py-4 text-center text-xs text-muted-foreground">Todos os usuários já foram adicionados.</p>
                        ) : availableUsers.map(u => (
                          <button
                            key={u.id}
                            type="button"
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted/40 transition"
                            onClick={() => {
                              setWizardParticipantRows(prev => [...prev, {
                                userId: String(u.id),
                                hoursPerDay: "8",
                                workingDays: String(sprintDays),
                                availabilityFactor: "100",
                              }]);
                            }}
                          >
                            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-primary text-[10px] font-semibold text-primary-foreground">
                              {(u.name || u.first_name || u.username || "?")[0].toUpperCase()}
                            </div>
                            <span>{u.name || [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username}</span>
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* Participants table */}
                  {wizardParticipantRows.length > 0 && (
                    <div className="overflow-x-auto rounded-xl border border-border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/40 border-b border-border text-xs text-muted-foreground">
                            <th className="px-3 py-2 text-left font-medium">Participante</th>
                            <th className="px-3 py-2 text-left font-medium w-24">Horas/dia</th>
                            <th className="px-3 py-2 text-left font-medium w-24">Dias úteis</th>
                            <th className="px-3 py-2 text-left font-medium w-24">Disponib. %</th>
                            <th className="px-3 py-2 text-left font-medium w-28">Capacidade</th>
                            <th className="px-3 py-2 w-8" />
                          </tr>
                        </thead>
                        <tbody>
                          {wizardParticipantRows.map(row => {
                            const u = users.find(x => String(x.id) === String(row.userId));
                            const name = u ? (u.name || [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || "Usuário") : row.userId;
                            const capacity = Number(row.hoursPerDay) * Number(row.workingDays) * (Number(row.availabilityFactor) / 100);
                            return (
                              <tr key={row.userId} className="border-b border-border last:border-0 hover:bg-muted/10">
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gradient-primary text-[9px] font-semibold text-primary-foreground">
                                      {name[0].toUpperCase()}
                                    </div>
                                    <span className="font-medium text-xs">{name}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-2">
                                  <input type="number" min="0.5" max="24" step="0.5" value={row.hoursPerDay}
                                    onChange={e => updateParticipantRow(row.userId, { hoursPerDay: e.target.value })}
                                    className="w-full rounded-md border border-border bg-muted/40 px-2 py-1 text-sm outline-none focus:border-primary" />
                                </td>
                                <td className="px-3 py-2">
                                  <input type="number" min="1" max="365" step="1" value={row.workingDays}
                                    onChange={e => updateParticipantRow(row.userId, { workingDays: e.target.value })}
                                    className="w-full rounded-md border border-border bg-muted/40 px-2 py-1 text-sm outline-none focus:border-primary" />
                                </td>
                                <td className="px-3 py-2">
                                  <input type="number" min="0" max="100" step="5" value={row.availabilityFactor}
                                    onChange={e => updateParticipantRow(row.userId, { availabilityFactor: e.target.value })}
                                    className="w-full rounded-md border border-border bg-muted/40 px-2 py-1 text-sm outline-none focus:border-primary" />
                                </td>
                                <td className="px-3 py-2">
                                  <span className="text-xs font-semibold text-primary">{formatHoursLabel(capacity)}</span>
                                </td>
                                <td className="px-3 py-2">
                                  <button type="button"
                                    onClick={async () => {
                                      if (row.savedId) {
                                        try { await deleteSprintParticipant(row.savedId); } catch { /* ignore */ }
                                      }
                                      setWizardParticipantRows(prev => prev.filter(r => r.userId !== row.userId));
                                    }}
                                    className="text-destructive/50 hover:text-destructive transition">
                                    <X className="h-4 w-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-border bg-muted/20">
                            <td colSpan={4} className="px-3 py-2 text-xs font-semibold text-muted-foreground text-right">Capacidade total da sprint:</td>
                            <td className="px-3 py-2">
                              <span className="text-sm font-bold text-primary">
                                {formatHoursLabel(wizardParticipantRows.reduce((s, r) => s + Number(r.hoursPerDay) * Number(r.workingDays) * (Number(r.availabilityFactor) / 100), 0))}
                              </span>
                            </td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── STEP 2: Chamados ── */}
            {wizardStep === 2 && (
              <TicketPlanningSection
                description="Adicione chamados que serao trabalhados nesta sprint e defina responsaveis e horas planejadas para cada um."
                users={users}
                tickets={allTicketsForPlanning}
                rows={wizardTicketRows}
                setRows={setWizardTicketRows}
                search={wizardTicketSearch}
                setSearch={setWizardTicketSearch}
                expandedRows={expandedRows}
                setExpandedRows={setExpandedRows}
                emptyRowsLabel="Nenhum chamado adicionado ainda."
                isLoading={ticketsQuery.isLoading}
                onBeforeRemoveRow={async (row) => {
                  if (!row.savedId) return;
                  try {
                    await deleteSprintTicketPlan(row.savedId);
                  } catch {
                    // ignore to keep the local editing flow responsive
                  }
                }}
              />
            )}
            {false && (() => {
              type TicketItem = { id: string; code?: string; title?: string; status?: string; sprint?: string | null; priority?: string };
              const allTickets = (Array.isArray(ticketsQuery.data)
                ? ticketsQuery.data
                : (ticketsQuery.data as { results?: unknown[] } | undefined)?.results ?? []) as TicketItem[];
              const openTickets = allTickets.filter((t) => t.status !== "Resolvido" && t.status !== "Fechado" && t.status !== "Cancelado");
              const addedIds = new Set(wizardTicketRows.map((r) => r.ticketId));
              const available = openTickets.filter((t) => !addedIds.has(t.id));
              const searchLower = wizardTicketSearch.toLowerCase();
              const filteredAvailable = wizardTicketSearch.trim()
                ? available.filter((t) => (t.title ?? "").toLowerCase().includes(searchLower) || (t.code ?? "").toLowerCase().includes(searchLower))
                : available;

              const updateTicketRow = (ticketId: string, patch: Partial<WizardTicketRow>) => {
                setWizardTicketRows((prev) => prev.map((r) => r.ticketId === ticketId ? { ...r, ...patch } : r));
              };

              return (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Adicione chamados que serão trabalhados nesta sprint e defina responsáveis e horas planejadas para cada um.</p>

                  {/* add ticket search */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" className="flex w-full items-center gap-2 rounded-xl border border-dashed border-primary/40 py-2.5 px-4 text-sm text-primary transition hover:border-primary hover:bg-primary/5">
                        <Plus className="h-4 w-4" />
                        Adicionar chamado
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[500px] p-0 glass" align="start">
                      <div className="p-3 border-b border-border">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                          <input
                            autoFocus
                            value={wizardTicketSearch}
                            onChange={(e) => setWizardTicketSearch(e.target.value)}
                            placeholder="Buscar por código ou título..."
                            className="w-full rounded-lg border border-border bg-muted/50 py-1.5 pl-9 pr-3 text-sm outline-none"
                          />
                        </div>
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        {ticketsQuery.isLoading ? (
                          <p className="py-4 text-center text-xs text-muted-foreground">Carregando...</p>
                        ) : filteredAvailable.length === 0 ? (
                          <p className="py-4 text-center text-xs text-muted-foreground">Nenhum chamado disponível.</p>
                        ) : (
                          filteredAvailable.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted/40 transition"
                              onClick={() => {
                                setWizardTicketRows((prev) => [...prev, { ticketId: t.id, responsibleIds: [], userHours: {}, plannedHours: "", storyPoints: "", priority: "Média", complexity: "", plannedEndDate: "", notes: "" }]);
                                setWizardTicketSearch("");
                              }}
                            >
                              <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">{t.code}</span>
                              <span className="min-w-0 flex-1 truncate">{t.title}</span>
                              {t.priority && <span className="shrink-0 text-[10px] text-muted-foreground">{t.priority}</span>}
                            </button>
                          ))
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* inline table */}
                  <div>
                      {wizardTicketRows.length > 0 && (
                        <div className="overflow-x-auto rounded-xl border border-border">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                                <th className="px-3 py-2 text-left font-medium">Chamado</th>
                                <th className="px-3 py-2 text-left font-medium w-44">Responsáveis</th>
                                <th className="px-3 py-2 text-left font-medium w-20">SP</th>
                                <th className="px-3 py-2 text-left font-medium w-20">Horas</th>
                                <th className="px-3 py-2 text-left font-medium w-28">Previsão término</th>
                                <th className="px-3 py-2 w-8" />
                                <th className="px-3 py-2 w-8" />
                              </tr>
                            </thead>
                            <tbody>
                              {wizardTicketRows.map((row) => {
                                const ticket = (allTickets as TicketItem[]).find((t) => t.id === row.ticketId);
                                const rowKey = `ticket-${row.ticketId}`;
                                const isExpanded = expandedRows.has(rowKey);
                                return (
                                  <>
                                    <tr key={row.ticketId} className="border-b border-border last:border-0 hover:bg-muted/20 transition">
                                      <td className="px-3 py-2">
                                        <div className="flex items-center gap-2">
                                          <Badge className={`shrink-0 text-[10px] border ${PRIORITY_COLORS[row.priority] || ""}`}>{row.priority}</Badge>
                                          <div>
                                            <span className="font-mono text-xs text-muted-foreground">{ticket?.code} </span>
                                            <span className="truncate">{ticket?.title ?? row.ticketId}</span>
                                            {row.savedId && <span className="ml-2 text-[10px] text-primary">✓</span>}
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-3 py-2">
                                        <WizardUserSelect
                                          users={users}
                                          selected={row.responsibleIds}
                                          onChange={(ids) => updateTicketRow(row.ticketId, { responsibleIds: ids })}
                                        />
                                      </td>
                                      <td className="px-3 py-2">
                                        <select
                                          value={row.storyPoints}
                                          onChange={(e) => {
                                            const sp = Number(e.target.value);
                                            updateTicketRow(row.ticketId, { storyPoints: e.target.value, plannedHours: sp ? String(spToHours(sp)) : row.plannedHours });
                                          }}
                                          className="w-full rounded-md border border-border bg-muted/40 px-2 py-1 text-sm outline-none focus:border-primary"
                                        >
                                          <option value="">—</option>
                                          {FIBONACCI_SP.map(sp => <option key={sp} value={sp}>{sp}</option>)}
                                        </select>
                                      </td>
                                      <td className="px-3 py-2">
                                        <input
                                          type="number"
                                          min="0"
                                          step="0.5"
                                          value={row.plannedHours}
                                          onChange={(e) => {
                                            const h = Number(e.target.value);
                                            updateTicketRow(row.ticketId, { plannedHours: e.target.value, storyPoints: h ? String(hoursToSP(h)) : row.storyPoints });
                                          }}
                                          placeholder="0"
                                          className="w-full rounded-md border border-border bg-muted/40 px-2 py-1 text-sm outline-none focus:border-primary"
                                        />
                                      </td>
                                      <td className="px-3 py-2">
                                        <input
                                          type="date"
                                          value={row.plannedEndDate}
                                          onChange={(e) => updateTicketRow(row.ticketId, { plannedEndDate: e.target.value })}
                                          className="w-full rounded-md border border-border bg-muted/40 px-2 py-1 text-xs outline-none focus:border-primary"
                                        />
                                      </td>
                                      <td className="px-3 py-2">
                                        <button type="button" onClick={() => setExpandedRows(prev => { const n = new Set(prev); n.has(rowKey) ? n.delete(rowKey) : n.add(rowKey); return n; })} className="text-muted-foreground hover:text-foreground transition text-xs">
                                          {isExpanded ? "▲" : "▼"}
                                        </button>
                                      </td>
                                      <td className="px-3 py-2">
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            if (row.savedId) {
                                              try { await deleteSprintTicketPlan(row.savedId); } catch { /* ignore */ }
                                            }
                                            setWizardTicketRows((prev) => prev.filter((r) => r.ticketId !== row.ticketId));
                                          }}
                                          className="text-destructive/50 hover:text-destructive transition"
                                        >
                                          <X className="h-4 w-4" />
                                        </button>
                                      </td>
                                    </tr>
                                    {isExpanded && (
                                      <tr key={`${row.ticketId}-expanded`} className="border-b border-border bg-muted/10">
                                        <td colSpan={7} className="px-4 py-3 space-y-3">
                                          <UserHoursBreakdown
                                            users={users}
                                            responsible={row.responsibleIds}
                                            userHours={row.userHours}
                                            totalHours={Number(row.plannedHours) || 0}
                                            onChange={(uh) => updateTicketRow(row.ticketId, { userHours: uh })}
                                          />
                                          <div className="flex items-start gap-6">
                                            <div className="space-y-1">
                                              <label className="text-xs font-medium text-muted-foreground">Prioridade</label>
                                              <div className="flex gap-1.5">
                                                {PRIORITY_OPTIONS.map(p => (
                                                  <button key={p} type="button"
                                                    onClick={() => updateTicketRow(row.ticketId, { priority: p })}
                                                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${row.priority === p ? PRIORITY_COLORS[p] : "border-border text-muted-foreground hover:border-primary/50"}`}
                                                  >{p}</button>
                                                ))}
                                              </div>
                                            </div>
                                            <div className="flex-1 space-y-1">
                                              <label className="text-xs font-medium text-muted-foreground">Observações</label>
                                              <textarea
                                                rows={2}
                                                value={row.notes}
                                                onChange={e => updateTicketRow(row.ticketId, { notes: e.target.value })}
                                                placeholder="Adicione observações sobre este chamado na sprint..."
                                                className="w-full resize-none rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs outline-none focus:border-primary"
                                              />
                                            </div>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {wizardTicketRows.length === 0 && (
                        <p className="py-4 text-center text-sm text-muted-foreground">Nenhum chamado adicionado ainda.</p>
                      )}
                  </div>
                </div>
              );
            })()}

            {/* ── STEP 3: Atividades de projetos ── */}
            {wizardStep === 3 && (
              <ActivityPlanningSection
                description="Adicione atividades de projetos que serao executadas nesta sprint. Edite diretamente na tabela."
                users={users}
                activityOptions={planningOptions}
                rows={wizardActivityRows}
                setRows={setWizardActivityRows}
                search={wizardActivitySearch}
                setSearch={setWizardActivitySearch}
                expandedRows={expandedRows}
                setExpandedRows={setExpandedRows}
                emptyRowsLabel="Nenhuma atividade adicionada ainda."
                onBeforeRemoveRow={async (row) => {
                  if (!row.savedId) return;
                  try {
                    await deleteSprintActivityPlan(row.savedId);
                    await queryClient.invalidateQueries({ queryKey: ["sprint-activity-plans", id] });
                  } catch {
                    // ignore to keep the local editing flow responsive
                  }
                }}
              />
            )}
            {false && (() => {
              const addedActivityIds = new Set(wizardActivityRows.map((r) => r.activityId));
              const availableActivities = planningOptions.filter((a) => !addedActivityIds.has(a.id));
              const actSearchLower = wizardActivitySearch.toLowerCase();
              const filteredActivities = wizardActivitySearch.trim()
                ? availableActivities.filter((a) => a.title.toLowerCase().includes(actSearchLower) || (a.projectName ?? "").toLowerCase().includes(actSearchLower))
                : availableActivities;

              const updateActivityRow = (activityId: string, patch: Partial<WizardActivityRow>) => {
                setWizardActivityRows((prev) => prev.map((r) => r.activityId === activityId ? { ...r, ...patch } : r));
              };

              return (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Adicione atividades de projetos que serão executadas nesta sprint. Edite diretamente na tabela.</p>

                  {/* add activity */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" className="flex w-full items-center gap-2 rounded-xl border border-dashed border-primary/40 py-2.5 px-4 text-sm text-primary transition hover:border-primary hover:bg-primary/5">
                        <Plus className="h-4 w-4" />
                        Adicionar atividade
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[540px] p-0 glass" align="start">
                      <div className="p-3 border-b border-border">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                          <input
                            autoFocus
                            value={wizardActivitySearch}
                            onChange={(e) => setWizardActivitySearch(e.target.value)}
                            placeholder="Buscar por título ou projeto..."
                            className="w-full rounded-lg border border-border bg-muted/50 py-1.5 pl-9 pr-3 text-sm outline-none"
                          />
                        </div>
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        {filteredActivities.length === 0 ? (
                          <p className="py-4 text-center text-xs text-muted-foreground">Nenhuma atividade disponível.</p>
                        ) : (
                          filteredActivities.map((a) => (
                            <button
                              key={a.id}
                              type="button"
                              className="flex w-full items-start gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted/40 transition"
                              onClick={() => {
                                setWizardActivityRows((prev) => [...prev, { activityId: a.id, responsibleIds: [], userHours: {}, plannedHours: String(a.estimatedBalanceHours > 0 ? a.estimatedBalanceHours : ""), storyPoints: "", priority: "Média", complexity: "", plannedEndDate: "", notes: "" }]);
                                setWizardActivitySearch("");
                              }}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-medium">{a.title}</div>
                                <div className="text-xs text-muted-foreground">{a.projectName} · saldo: {formatHoursLabel(a.estimatedBalanceHours)}</div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* inline table */}
                  <div>
                      {wizardActivityRows.length > 0 && (
                        <div className="overflow-x-auto rounded-xl border border-border">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                                <th className="px-3 py-2 text-left font-medium">Atividade</th>
                                <th className="px-3 py-2 text-left font-medium w-44">Responsáveis</th>
                                <th className="px-3 py-2 text-left font-medium w-20">SP</th>
                                <th className="px-3 py-2 text-left font-medium w-20">Horas</th>
                                <th className="px-3 py-2 text-left font-medium w-28">Previsão término</th>
                                <th className="px-3 py-2 w-8" />
                                <th className="px-3 py-2 w-8" />
                              </tr>
                            </thead>
                            <tbody>
                              {wizardActivityRows.map((row) => {
                                const activity = activities.find((a) => a.id === row.activityId);
                                const rowKey = `activity-${row.activityId}`;
                                const isExpanded = expandedRows.has(rowKey);
                                return (
                                  <>
                                    <tr key={row.activityId} className="border-b border-border last:border-0 hover:bg-muted/20 transition">
                                      <td className="px-3 py-2">
                                        <div className="flex items-center gap-2">
                                          <Badge className={`shrink-0 text-[10px] border ${PRIORITY_COLORS[row.priority] || ""}`}>{row.priority}</Badge>
                                          <div>
                                            <div className="truncate font-medium max-w-[150px]">{activity?.title ?? row.activityId}</div>
                                            {activity?.project_name && <div className="text-[10px] text-muted-foreground truncate max-w-[150px]">{activity.project_name}</div>}
                                            {row.savedId && <span className="text-[10px] text-primary">✓</span>}
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-3 py-2">
                                        <WizardUserSelect
                                          users={users}
                                          selected={row.responsibleIds}
                                          onChange={(ids) => updateActivityRow(row.activityId, { responsibleIds: ids })}
                                        />
                                      </td>
                                      <td className="px-3 py-2">
                                        <select
                                          value={row.storyPoints}
                                          onChange={(e) => {
                                            const sp = Number(e.target.value);
                                            updateActivityRow(row.activityId, { storyPoints: e.target.value, plannedHours: sp ? String(spToHours(sp)) : row.plannedHours });
                                          }}
                                          className="w-full rounded-md border border-border bg-muted/40 px-2 py-1 text-sm outline-none focus:border-primary"
                                        >
                                          <option value="">—</option>
                                          {FIBONACCI_SP.map(sp => <option key={sp} value={sp}>{sp}</option>)}
                                        </select>
                                      </td>
                                      <td className="px-3 py-2">
                                        <input
                                          type="number"
                                          min="0"
                                          step="0.5"
                                          value={row.plannedHours}
                                          onChange={(e) => {
                                            const h = Number(e.target.value);
                                            updateActivityRow(row.activityId, { plannedHours: e.target.value, storyPoints: h ? String(hoursToSP(h)) : row.storyPoints });
                                          }}
                                          placeholder="0"
                                          className="w-full rounded-md border border-border bg-muted/40 px-2 py-1 text-sm outline-none focus:border-primary"
                                        />
                                      </td>
                                      <td className="px-3 py-2">
                                        <input
                                          type="date"
                                          value={row.plannedEndDate}
                                          onChange={(e) => updateActivityRow(row.activityId, { plannedEndDate: e.target.value })}
                                          className="w-full rounded-md border border-border bg-muted/40 px-2 py-1 text-xs outline-none focus:border-primary"
                                        />
                                      </td>
                                      <td className="px-3 py-2">
                                        <button type="button" onClick={() => setExpandedRows(prev => { const n = new Set(prev); n.has(rowKey) ? n.delete(rowKey) : n.add(rowKey); return n; })} className="text-muted-foreground hover:text-foreground transition text-xs">
                                          {isExpanded ? "▲" : "▼"}
                                        </button>
                                      </td>
                                      <td className="px-3 py-2">
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            if (row.savedId) {
                                              try { await deleteSprintActivityPlan(row.savedId); await queryClient.invalidateQueries({ queryKey: ["sprint-activity-plans", id] }); } catch { /* ignore */ }
                                            }
                                            setWizardActivityRows((prev) => prev.filter((r) => r.activityId !== row.activityId));
                                          }}
                                          className="text-destructive/50 hover:text-destructive transition"
                                        >
                                          <X className="h-4 w-4" />
                                        </button>
                                      </td>
                                    </tr>
                                    {isExpanded && (
                                      <tr key={`${row.activityId}-expanded`} className="border-b border-border bg-muted/10">
                                        <td colSpan={7} className="px-4 py-3 space-y-3">
                                          <UserHoursBreakdown
                                            users={users}
                                            responsible={row.responsibleIds}
                                            userHours={row.userHours}
                                            totalHours={Number(row.plannedHours) || 0}
                                            onChange={(uh) => updateActivityRow(row.activityId, { userHours: uh })}
                                          />
                                          <div className="flex items-start gap-6">
                                            <div className="space-y-1">
                                              <label className="text-xs font-medium text-muted-foreground">Prioridade</label>
                                              <div className="flex gap-1.5">
                                                {PRIORITY_OPTIONS.map(p => (
                                                  <button key={p} type="button"
                                                    onClick={() => updateActivityRow(row.activityId, { priority: p })}
                                                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${row.priority === p ? PRIORITY_COLORS[p] : "border-border text-muted-foreground hover:border-primary/50"}`}
                                                  >{p}</button>
                                                ))}
                                              </div>
                                            </div>
                                            <div className="flex-1 space-y-1">
                                              <label className="text-xs font-medium text-muted-foreground">Observações</label>
                                              <textarea
                                                rows={2}
                                                value={row.notes}
                                                onChange={e => updateActivityRow(row.activityId, { notes: e.target.value })}
                                                placeholder="Adicione observações sobre esta atividade na sprint..."
                                                className="w-full resize-none rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs outline-none focus:border-primary"
                                              />
                                            </div>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {wizardActivityRows.length === 0 && (
                        <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma atividade adicionada ainda.</p>
                      )}
                  </div>
                </div>
              );
            })()}

            {/* ── STEP 4: Finalização ── */}
            {wizardStep === 4 && (() => {
              const totalTicketHours = wizardTicketRows.reduce((s, r) => s + Number(r.plannedHours || 0), 0);
              const totalActivityHours = wizardActivityRows.reduce((s, r) => s + Number(r.plannedHours || 0), 0);
              const totalPlannedAfter = totalTicketHours + totalActivityHours;
              const totalSP = [...wizardTicketRows, ...wizardActivityRows].reduce((s, r) => s + (Number(r.storyPoints) || 0), 0);
              const capacity = sprint?.capacity ?? 0;
              const capacityPct = capacity > 0 ? Math.min(999, Math.round((totalPlannedAfter / capacity) * 100)) : 0;
              type TicketItem3 = { id: string; code?: string; title?: string };
              const allTickets3 = (Array.isArray(ticketsQuery.data)
                ? ticketsQuery.data
                : (ticketsQuery.data as { results?: unknown[] } | undefined)?.results ?? []) as TicketItem3[];

              return (
                <div className="space-y-5">
                  {/* 4 stat cards */}
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: "Total SP", value: String(totalSP) },
                      { label: "Total Horas", value: formatHoursLabel(totalPlannedAfter) },
                      { label: "Capacidade", value: formatHoursLabel(capacity) },
                      { label: "Utilização", value: `${capacityPct}%`, color: capacityPct > 100 ? "text-destructive" : capacityPct > 80 ? "text-warning" : "text-success" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="rounded-xl border border-border bg-card/60 p-4">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className={`mt-1 text-xl font-bold ${color ?? ""}`}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {capacity > 0 && (
                    <div className="space-y-1">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full transition-all ${capacityPct > 100 ? "bg-destructive" : "bg-gradient-primary"}`}
                          style={{ width: `${Math.min(100, capacityPct)}%` }}
                        />
                      </div>
                      {capacityPct > 100 && (
                        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          Planejamento excede a capacidade da sprint.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Side-by-side editable tables */}
                  {(() => {
                    const updateTicketRow3 = (ticketId: string, patch: Partial<WizardTicketRow>) =>
                      setWizardTicketRows((prev) => prev.map((r) => r.ticketId === ticketId ? { ...r, ...patch } : r));
                    const updateActivityRow3 = (activityId: string, patch: Partial<WizardActivityRow>) =>
                      setWizardActivityRows((prev) => prev.map((r) => r.activityId === activityId ? { ...r, ...patch } : r));

                    const ticketTable = (
                      <div className="rounded-xl border border-border min-w-[580px] flex-1">
                        <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted/40 border-b border-border text-xs text-muted-foreground">
                              <th className="px-3 py-2 text-left font-medium">Chamados ({wizardTicketRows.length})</th>
                              <th className="px-3 py-2 text-left font-medium w-44">Responsáveis</th>
                              <th className="px-3 py-2 text-left font-medium w-16">SP</th>
                              <th className="px-3 py-2 text-left font-medium w-20">Horas</th>
                              <th className="px-3 py-2 text-left font-medium w-32">Previsão término</th>
                            </tr>
                          </thead>
                          <tbody>
                            {wizardTicketRows.length === 0 ? (
                              <tr><td colSpan={5} className="px-3 py-4 text-center text-muted-foreground text-xs">Nenhum chamado.</td></tr>
                            ) : wizardTicketRows.map((row) => {
                              const ticket = allTickets3.find((t) => t.id === row.ticketId);
                              return (
                                <tr key={row.ticketId} className="border-b border-border last:border-0 hover:bg-muted/20 transition">
                                  <td className="px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <Badge className={`shrink-0 text-[10px] border ${PRIORITY_COLORS[row.priority] || ""}`}>{row.priority}</Badge>
                                      <div>
                                        <span className="font-mono text-xs text-muted-foreground">{ticket?.code} </span>
                                        <span className="truncate">{ticket?.title ?? row.ticketId}</span>
                                        {row.savedId && <span className="ml-2 text-[10px] text-primary">✓</span>}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2">
                                    <WizardUserSelect
                                      users={users}
                                      selected={row.responsibleIds}
                                      onChange={(ids) => updateTicketRow3(row.ticketId, { responsibleIds: ids })}
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <select
                                      value={row.storyPoints}
                                      onChange={(e) => {
                                        const sp = Number(e.target.value);
                                        updateTicketRow3(row.ticketId, { storyPoints: e.target.value, plannedHours: sp ? String(spToHours(sp)) : row.plannedHours });
                                      }}
                                      className="w-full rounded-md border border-border bg-muted/40 px-2 py-1 text-sm outline-none focus:border-primary"
                                    >
                                      <option value="">—</option>
                                      {FIBONACCI_SP.map(sp => <option key={sp} value={sp}>{sp}</option>)}
                                    </select>
                                  </td>
                                  <td className="px-3 py-2">
                                    <input
                                      type="number" min="0" step="0.5"
                                      value={row.plannedHours}
                                      onChange={(e) => {
                                        const h = Number(e.target.value);
                                        updateTicketRow3(row.ticketId, { plannedHours: e.target.value, storyPoints: h ? String(hoursToSP(h)) : row.storyPoints });
                                      }}
                                      placeholder="0"
                                      className="w-full rounded-md border border-border bg-muted/40 px-2 py-1 text-sm outline-none focus:border-primary"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <input
                                      type="date"
                                      value={row.plannedEndDate}
                                      onChange={(e) => updateTicketRow3(row.ticketId, { plannedEndDate: e.target.value })}
                                      className="w-full rounded-md border border-border bg-muted/40 px-2 py-1 text-xs outline-none focus:border-primary"
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        </div>
                      </div>
                    );

                    const activityTable = (
                      <div className="rounded-xl border border-border min-w-[580px] flex-1">
                        <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted/40 border-b border-border text-xs text-muted-foreground">
                              <th className="px-3 py-2 text-left font-medium">Atividades ({wizardActivityRows.length})</th>
                              <th className="px-3 py-2 text-left font-medium w-44">Responsáveis</th>
                              <th className="px-3 py-2 text-left font-medium w-16">SP</th>
                              <th className="px-3 py-2 text-left font-medium w-20">Horas</th>
                              <th className="px-3 py-2 text-left font-medium w-32">Previsão término</th>
                            </tr>
                          </thead>
                          <tbody>
                            {wizardActivityRows.length === 0 ? (
                              <tr><td colSpan={5} className="px-3 py-4 text-center text-muted-foreground text-xs">Nenhuma atividade.</td></tr>
                            ) : wizardActivityRows.map((row) => {
                              const activity = activities.find((a) => a.id === row.activityId);
                              return (
                                <tr key={row.activityId} className="border-b border-border last:border-0 hover:bg-muted/20 transition">
                                  <td className="px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <Badge className={`shrink-0 text-[10px] border ${PRIORITY_COLORS[row.priority] || ""}`}>{row.priority}</Badge>
                                      <div className="min-w-0">
                                        <p className="truncate font-medium">{activity?.title ?? row.activityId}</p>
                                        {(activity as { project_name?: string } | undefined)?.project_name && (
                                          <p className="text-[10px] text-muted-foreground truncate">{(activity as { project_name?: string }).project_name}</p>
                                        )}
                                        {row.savedId && <span className="text-[10px] text-primary">✓</span>}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2">
                                    <WizardUserSelect
                                      users={users}
                                      selected={row.responsibleIds}
                                      onChange={(ids) => updateActivityRow3(row.activityId, { responsibleIds: ids })}
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <select
                                      value={row.storyPoints}
                                      onChange={(e) => {
                                        const sp = Number(e.target.value);
                                        updateActivityRow3(row.activityId, { storyPoints: e.target.value, plannedHours: sp ? String(spToHours(sp)) : row.plannedHours });
                                      }}
                                      className="w-full rounded-md border border-border bg-muted/40 px-2 py-1 text-sm outline-none focus:border-primary"
                                    >
                                      <option value="">—</option>
                                      {FIBONACCI_SP.map(sp => <option key={sp} value={sp}>{sp}</option>)}
                                    </select>
                                  </td>
                                  <td className="px-3 py-2">
                                    <input
                                      type="number" min="0" step="0.5"
                                      value={row.plannedHours}
                                      onChange={(e) => {
                                        const h = Number(e.target.value);
                                        updateActivityRow3(row.activityId, { plannedHours: e.target.value, storyPoints: h ? String(hoursToSP(h)) : row.storyPoints });
                                      }}
                                      placeholder="0"
                                      className="w-full rounded-md border border-border bg-muted/40 px-2 py-1 text-sm outline-none focus:border-primary"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <input
                                      type="date"
                                      value={row.plannedEndDate}
                                      onChange={(e) => updateActivityRow3(row.activityId, { plannedEndDate: e.target.value })}
                                      className="w-full rounded-md border border-border bg-muted/40 px-2 py-1 text-xs outline-none focus:border-primary"
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        </div>
                      </div>
                    );

                    return (
                      <div className="overflow-x-auto rounded-xl">
                        <div className="flex gap-4" style={{ minWidth: "1160px" }}>
                          {ticketTable}
                          {activityTable}
                        </div>
                      </div>
                    );
                  })()}

                </div>
              );
            })()}
          </div>

          {/* wizard footer */}
          <div className="flex-shrink-0 flex items-center justify-between border-t border-border px-6 py-4">
            <Button
              variant="outline"
              onClick={() => {
                if (wizardStep === 1) setWizardOpen(false);
                else setWizardStep((s) => (s - 1) as 1 | 2 | 3 | 4);
              }}
              disabled={wizardSaving}
            >
              {wizardStep === 1 ? "Cancelar" : "← Voltar"}
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Etapa {wizardStep} de 4</span>
              {wizardStep < 4 ? (
                <Button
                  onClick={handleWizardNext}
                  disabled={wizardSaving}
                  className="gap-1.5 bg-gradient-primary text-white shadow-glow hover:opacity-90"
                >
                  {wizardSaving ? "Salvando..." : <><span>Próximo</span><ChevronRight className="h-4 w-4" /></>}
                </Button>
              ) : (
                <Button
                  onClick={handleWizardFinish}
                  disabled={wizardSaving}
                  className="gap-1.5 bg-gradient-primary text-white shadow-glow hover:opacity-90"
                >
                  Concluir planejamento
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Adicionar não planejados dialog ─── */}
      <Dialog open={unplannedOpen} onOpenChange={setUnplannedOpen}>
        <DialogContent className="max-h-[90vh] w-[1320px] max-w-[98vw] overflow-hidden p-0 glass-strong flex flex-col">
          <div className="flex-shrink-0 border-b border-border px-6 pb-4 pt-5">
            <DialogTitle>Adicionar não planejados</DialogTitle>
            <DialogDescription>Adicione chamados ou atividades fora do planejamento original da sprint.</DialogDescription>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <Tabs value={unplannedTab} onValueChange={(v) => setUnplannedTab(v as "chamados" | "atividades")} className="space-y-4">
              <TabsList className="border border-border bg-muted/40">
                <TabsTrigger value="chamados">Chamados ({unplannedTicketRows.length})</TabsTrigger>
                <TabsTrigger value="atividades">Atividades ({unplannedActivityRows.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="chamados" className="mt-0">
                <TicketPlanningSection
                  description="Adicione chamados que serao trabalhados nesta sprint e defina responsaveis e horas planejadas para cada um."
                  users={users}
                  tickets={allTicketsForPlanning}
                  rows={unplannedTicketRows}
                  setRows={setUnplannedTicketRows}
                  search={unplannedTicketSearch}
                  setSearch={setUnplannedTicketSearch}
                  expandedRows={unplannedExpandedRows}
                  setExpandedRows={setUnplannedExpandedRows}
                  emptyRowsLabel="Nenhum chamado adicionado ainda."
                  excludedIds={plannedTicketIds}
                  isLoading={ticketsQuery.isLoading}
                />
              </TabsContent>

              <TabsContent value="atividades" className="mt-0">
                <ActivityPlanningSection
                  description="Adicione atividades de projetos que serao executadas nesta sprint. Edite diretamente na tabela."
                  users={users}
                  activityOptions={planningOptions}
                  rows={unplannedActivityRows}
                  setRows={setUnplannedActivityRows}
                  search={unplannedActivitySearch}
                  setSearch={setUnplannedActivitySearch}
                  expandedRows={unplannedExpandedRows}
                  setExpandedRows={setUnplannedExpandedRows}
                  emptyRowsLabel="Nenhuma atividade adicionada ainda."
                  excludedIds={plannedActivityIds}
                />
              </TabsContent>
            </Tabs>
          </div>

          {false && (
          <Tabs value={unplannedTab} onValueChange={(v) => setUnplannedTab(v as "chamados" | "atividades")}>
            <TabsList className="mb-4">
              <TabsTrigger value="chamados">Chamados ({unplannedTicketRows.length})</TabsTrigger>
              <TabsTrigger value="atividades">Atividades ({unplannedActivityRows.length})</TabsTrigger>
            </TabsList>

            {/* ── Chamados tab ── */}
            <TabsContent value="chamados" className="space-y-3">
              <input
                placeholder="Buscar chamado..."
                value={unplannedTicketSearch}
                onChange={e => setUnplannedTicketSearch(e.target.value)}
                className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm outline-none focus:border-primary"
              />
              {(() => {
                const allTickets = (Array.isArray(ticketsQuery.data)
                  ? ticketsQuery.data
                  : (ticketsQuery.data as { results?: unknown[] } | undefined)?.results ?? []) as { id: string; code?: string; title?: string }[];
                const addedIds = new Set(unplannedTicketRows.map(r => r.ticketId));
                const visible = allTickets.filter(t =>
                  !addedIds.has(t.id) &&
                  (!unplannedTicketSearch || [t.code, t.title].join(" ").toLowerCase().includes(unplannedTicketSearch.toLowerCase()))
                ).slice(0, 20);
                return (
                  <div className="max-h-40 overflow-y-auto rounded-xl border border-border divide-y divide-border">
                    {visible.length === 0
                      ? <p className="px-4 py-3 text-xs text-muted-foreground">Nenhum chamado disponível.</p>
                      : visible.map(t => (
                        <button key={t.id} type="button"
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted/40 transition"
                          onClick={() => setUnplannedTicketRows(prev => [...prev, {
                            ticketId: t.id, responsibleIds: [], storyPoints: "", plannedHours: "", plannedEndDate: "", notes: "", priority: "Média", complexity: "", userHours: {},
                          }])}>
                          <span className="font-mono text-[10px] text-muted-foreground">{t.code ?? t.id.slice(0,8)}</span>
                          <span className="truncate">{t.title}</span>
                          <Plus className="ml-auto h-3.5 w-3.5 shrink-0 text-primary" />
                        </button>
                      ))}
                  </div>
                );
              })()}

              {unplannedTicketRows.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border text-xs text-muted-foreground">
                        <th className="px-3 py-2 text-left font-medium">Chamado</th>
                        <th className="px-3 py-2 text-left font-medium w-40">Responsáveis</th>
                        <th className="px-3 py-2 text-left font-medium w-20">Horas</th>
                        <th className="px-3 py-2 text-left font-medium w-32">Previsão término</th>
                        <th className="px-3 py-2 w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {unplannedTicketRows.map(row => {
                        const allTickets = (Array.isArray(ticketsQuery.data)
                          ? ticketsQuery.data
                          : (ticketsQuery.data as { results?: unknown[] } | undefined)?.results ?? []) as { id: string; code?: string; title?: string }[];
                        const t = allTickets.find(x => x.id === row.ticketId);
                        return (
                          <tr key={row.ticketId} className="border-b border-border last:border-0">
                            <td className="px-3 py-2">
                              <p className="font-medium text-xs truncate max-w-[160px]">{t?.title ?? row.ticketId}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">{t?.code}</p>
                            </td>
                            <td className="px-3 py-2">
                              <WizardUserSelect users={users} selected={row.responsibleIds}
                                onChange={ids => setUnplannedTicketRows(prev => prev.map(r => r.ticketId === row.ticketId ? { ...r, responsibleIds: ids } : r))} />
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" min="0" step="0.5" placeholder="0" value={row.plannedHours}
                                onChange={e => setUnplannedTicketRows(prev => prev.map(r => r.ticketId === row.ticketId ? { ...r, plannedHours: e.target.value } : r))}
                                className="w-full rounded-md border border-border bg-muted/40 px-2 py-1 text-sm outline-none focus:border-primary" />
                            </td>
                            <td className="px-3 py-2">
                              <input type="date" value={row.plannedEndDate}
                                onChange={e => setUnplannedTicketRows(prev => prev.map(r => r.ticketId === row.ticketId ? { ...r, plannedEndDate: e.target.value } : r))}
                                className="w-full rounded-md border border-border bg-muted/40 px-2 py-1 text-xs outline-none focus:border-primary" />
                            </td>
                            <td className="px-3 py-2">
                              <button type="button" onClick={() => setUnplannedTicketRows(prev => prev.filter(r => r.ticketId !== row.ticketId))}
                                className="text-destructive/50 hover:text-destructive transition">
                                <X className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* ── Atividades tab ── */}
            <TabsContent value="atividades" className="space-y-3">
              <input
                placeholder="Buscar atividade..."
                value={unplannedActivitySearch}
                onChange={e => setUnplannedActivitySearch(e.target.value)}
                className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm outline-none focus:border-primary"
              />
              {(() => {
                const addedIds = new Set(unplannedActivityRows.map(r => r.activityId));
                const visible = (activities || []).filter(a =>
                  !addedIds.has(a.id) &&
                  (!unplannedActivitySearch || a.title?.toLowerCase().includes(unplannedActivitySearch.toLowerCase()))
                ).slice(0, 20);
                return (
                  <div className="max-h-40 overflow-y-auto rounded-xl border border-border divide-y divide-border">
                    {visible.length === 0
                      ? <p className="px-4 py-3 text-xs text-muted-foreground">Nenhuma atividade disponível.</p>
                      : visible.map(a => (
                        <button key={a.id} type="button"
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted/40 transition"
                          onClick={() => setUnplannedActivityRows(prev => [...prev, {
                            activityId: a.id, responsibleIds: [], storyPoints: "", plannedHours: "", plannedEndDate: "", notes: "", priority: "Média", complexity: "", userHours: {},
                          }])}>
                          <span className="truncate">{a.title}</span>
                          <Plus className="ml-auto h-3.5 w-3.5 shrink-0 text-primary" />
                        </button>
                      ))}
                  </div>
                );
              })()}

              {unplannedActivityRows.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border text-xs text-muted-foreground">
                        <th className="px-3 py-2 text-left font-medium">Atividade</th>
                        <th className="px-3 py-2 text-left font-medium w-40">Responsáveis</th>
                        <th className="px-3 py-2 text-left font-medium w-20">Horas</th>
                        <th className="px-3 py-2 text-left font-medium w-32">Previsão término</th>
                        <th className="px-3 py-2 w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {unplannedActivityRows.map(row => {
                        const a = (activities || []).find(x => x.id === row.activityId);
                        return (
                          <tr key={row.activityId} className="border-b border-border last:border-0">
                            <td className="px-3 py-2">
                              <p className="font-medium text-xs truncate max-w-[160px]">{a?.title ?? row.activityId}</p>
                            </td>
                            <td className="px-3 py-2">
                              <WizardUserSelect users={users} selected={row.responsibleIds}
                                onChange={ids => setUnplannedActivityRows(prev => prev.map(r => r.activityId === row.activityId ? { ...r, responsibleIds: ids } : r))} />
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" min="0" step="0.5" placeholder="0" value={row.plannedHours}
                                onChange={e => setUnplannedActivityRows(prev => prev.map(r => r.activityId === row.activityId ? { ...r, plannedHours: e.target.value } : r))}
                                className="w-full rounded-md border border-border bg-muted/40 px-2 py-1 text-sm outline-none focus:border-primary" />
                            </td>
                            <td className="px-3 py-2">
                              <input type="date" value={row.plannedEndDate}
                                onChange={e => setUnplannedActivityRows(prev => prev.map(r => r.activityId === row.activityId ? { ...r, plannedEndDate: e.target.value } : r))}
                                className="w-full rounded-md border border-border bg-muted/40 px-2 py-1 text-xs outline-none focus:border-primary" />
                            </td>
                            <td className="px-3 py-2">
                              <button type="button" onClick={() => setUnplannedActivityRows(prev => prev.filter(r => r.activityId !== row.activityId))}
                                className="text-destructive/50 hover:text-destructive transition">
                                <X className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
          )}

          <div className="flex-shrink-0 flex items-center justify-end gap-2 border-t border-border px-6 py-4">
            <Button variant="outline" onClick={() => setUnplannedOpen(false)} disabled={unplannedSaving}>Cancelar</Button>
            <Button
              disabled={unplannedSaving || (unplannedTicketRows.length === 0 && unplannedActivityRows.length === 0)}
              className="bg-gradient-primary text-white shadow-glow hover:opacity-90"
              onClick={async () => {
                for (const row of unplannedTicketRows) {
                  const ticket = allTicketsForPlanning.find((item) => item.id === row.ticketId);
                  const label = ticket?.code ?? row.ticketId;
                  if (!row.responsibleIds.length) { toast.error(`Chamado ${label}: adicione ao menos um responsavel.`); return; }
                  if (!Number(row.plannedHours)) { toast.error(`Chamado ${label}: informe as horas planejadas.`); return; }
                  if (!row.plannedEndDate) { toast.error(`Chamado ${label}: informe a previsao de termino.`); return; }
                }
                for (const row of unplannedActivityRows) {
                  const activity = activities.find((item) => item.id === row.activityId);
                  const label = activity?.title ?? row.activityId;
                  if (!row.responsibleIds.length) { toast.error(`Atividade "${label}": adicione ao menos um responsavel.`); return; }
                  if (!Number(row.plannedHours)) { toast.error(`Atividade "${label}": informe as horas planejadas.`); return; }
                  if (!row.plannedEndDate) { toast.error(`Atividade "${label}": informe a previsao de termino.`); return; }
                }
                for (const row of unplannedTicketRows) {
                  if (!row.responsibleIds.length) { toast.error("Chamado sem responsável."); return; }
                  if (!Number(row.plannedHours)) { toast.error("Chamado sem horas planejadas."); return; }
                }
                for (const row of unplannedActivityRows) {
                  if (!row.responsibleIds.length) { toast.error("Atividade sem responsável."); return; }
                  if (!Number(row.plannedHours)) { toast.error("Atividade sem horas planejadas."); return; }
                }
                setUnplannedSaving(true);
                try {
                  for (const row of unplannedTicketRows) {
                    await saveSprintTicketPlan({
                      sprintId: id, ticketId: row.ticketId,
                      responsibleIds: row.responsibleIds,
                      plannedHours: Number(row.plannedHours),
                      storyPoints: row.storyPoints ? Number(row.storyPoints) : undefined,
                      plannedEndDate: row.plannedEndDate || "",
                      notes: row.notes,
                      userHours: Object.fromEntries(Object.entries(row.userHours).map(([key, value]) => [key, Number(value) || 0])),
                      priority: row.priority || "Média",
                    }, "create");
                  }
                  for (const row of unplannedActivityRows) {
                    const a = (activities || []).find(x => x.id === row.activityId);
                    await saveSprintActivityPlan({
                      sprintId: id, activityId: row.activityId,
                      projectId: a?.project || "",
                      responsibleIds: row.responsibleIds,
                      plannedHours: Number(row.plannedHours),
                      storyPoints: row.storyPoints ? Number(row.storyPoints) : undefined,
                      plannedEndDate: row.plannedEndDate || "",
                      notes: row.notes,
                      userHours: Object.fromEntries(Object.entries(row.userHours).map(([key, value]) => [key, Number(value) || 0])),
                      priority: row.priority || "Média",
                    }, "create");
                  }
                  await Promise.all([
                    queryClient.invalidateQueries({ queryKey: ["sprint-ticket-plans", id] }),
                    queryClient.invalidateQueries({ queryKey: ["sprint-activity-plans", id] }),
                    queryClient.invalidateQueries({ queryKey: ["all-sprint-activity-plans"] }),
                  ]);
                  toast.success("Itens não planejados adicionados.");
                  setUnplannedOpen(false);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
                } finally {
                  setUnplannedSaving(false);
                }
              }}
            >
              {unplannedSaving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── edit single plan dialog (kept for inline edits) ─── */}
      <Dialog
        open={planDialogOpen}
        onOpenChange={(open) => {
          setPlanDialogOpen(open);
          if (!open) {
            setEditingPlan(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl glass-strong">
          <DialogHeader>
            <DialogTitle>
              {editingPlan ? "Editar planejamento da sprint" : "Planejar atividade na sprint"}
            </DialogTitle>
            <DialogDescription>
              Defina quem vai executar, quantas horas serão planejadas neste ciclo e as previsões da sprint.
            </DialogDescription>
          </DialogHeader>

          <SprintActivityPlanForm
            key={editingPlan?.id || "new-sprint-activity-plan"}
            initial={toSprintActivityPlanFormData(
              editingPlan
                ? {
                    activityId: editingPlan.activityId,
                    responsibleIds: editingPlan.responsibleIds || [],
                    plannedHours: String(editingPlan.plannedHours ?? ""),
                    storyPoints:
                      editingPlan.storyPoints != null ? String(editingPlan.storyPoints) : "",
                    plannedStartDate: editingPlan.plannedStartDate || "",
                    plannedEndDate: editingPlan.plannedEndDate || "",
                    order: editingPlan.order != null ? String(editingPlan.order) : "",
                    notes: editingPlan.notes || "",
                  }
                : null,
            )}
            activities={planningOptions}
            users={users}
            saving={savingPlan}
            submitLabel={editingPlan ? "Salvar planejamento" : "Adicionar à sprint"}
            onSubmit={handleSavePlan}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={closeSprintOpen} onOpenChange={setCloseSprintOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fechar Sprint</DialogTitle>
            <DialogDescription>
              Ao fechar a sprint, as atividades incompletas serão movidas para o backlog e o review será gerado automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="text-xs font-medium text-muted-foreground">Observações finais (opcional)</label>
            <textarea
              className="w-full min-h-[80px] rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none"
              placeholder="Adicione observações sobre o encerramento..."
              value={closeNotes}
              onChange={(e) => setCloseNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseSprintOpen(false)}>Cancelar</Button>
            <Button disabled={closingSprintPending} onClick={handleCloseSprint}>
              {closingSprintPending ? "Encerrando..." : "Confirmar encerramento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

interface BurndownPoint {
  name: string;
  Planejado: number;
  Realizado: number;
}

function SprintBurndownChart({ data }: { data: BurndownPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--background))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            fontSize: "12px",
          }}
        />
        <Legend wrapperStyle={{ fontSize: "12px" }} />
        <Line
          type="monotone"
          dataKey="Planejado"
          name="Ideal"
          stroke="hsl(var(--muted-foreground))"
          strokeDasharray="5 5"
          dot={false}
          strokeWidth={2}
        />
        <Line
          type="monotone"
          dataKey="Realizado"
          name="Real"
          stroke="hsl(var(--primary))"
          dot={{ r: 3 }}
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function InfoPanel({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="glass flex items-center gap-2 rounded-2xl p-5 text-sm text-muted-foreground shadow-card">
      <Icon className="h-4 w-4" /> {text}
    </div>
  );
}

function WizardUserSelect({ users, selected, onChange }: { users: import("@/lib/types").User[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const selectedSet = new Set(selected);

  const getUserLabel = (u: import("@/lib/types").User) =>
    u.name || [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || u.email || "Usuário";

  const toggle = (uid: string) => {
    const next = selectedSet.has(uid) ? selected.filter((x) => x !== uid) : [...selected, uid];
    onChange(next);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="flex min-h-[32px] w-full flex-wrap items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 text-left text-xs hover:border-primary transition">
          {selected.length === 0 ? (
            <span className="text-muted-foreground">Selecionar...</span>
          ) : (
            selected.slice(0, 3).map((uid) => {
              const u = users.find((x) => String(x.id) === String(uid));
              const name = u ? getUserLabel(u) : uid;
              return (
                <span key={uid} className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary font-medium">
                  {name.split(" ")[0]}
                </span>
              );
            })
          )}
          {selected.length > 3 && <span className="text-[10px] text-muted-foreground">+{selected.length - 3}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1 glass" align="start">
        <div className="max-h-48 overflow-y-auto">
          {users.map((u) => {
            const uid = String(u.id);
            const checked = selectedSet.has(uid);
            return (
              <button
                key={uid}
                type="button"
                onClick={() => toggle(uid)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted/40 transition"
              >
                <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${checked ? "border-primary bg-primary" : "border-border"}`}>
                  {checked && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                </div>
                <span className="truncate">{getUserLabel(u)}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function getPlanStatusClass(status: "balanced" | "under" | "over") {
  if (status === "over") {
    return "rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-[11px] text-destructive";
  }

  if (status === "under") {
    return "rounded-md border border-info/30 bg-info/10 px-2 py-1 text-[11px] text-info";
  }

  return "rounded-md border border-success/30 bg-success/10 px-2 py-1 text-[11px] text-success";
}
