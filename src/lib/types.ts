import type { PermissionMap } from "@/lib/permissions";

export type ChecklistItem = {
  text: string;
  done: boolean;
};

export type ProjectStage = {
  id: string;
  title: string;
  expectedEndDate?: string;
  completed: boolean;
};

export type ProjectCostType = "hours" | "manual";

export type ProjectCostRelatedType = "activity" | "ticket";

export type ProjectCostSource = "manual" | "activity_time_entry";

export type ProjectCost = {
  id: string;
  projectId: string;
  type: ProjectCostType;
  source?: ProjectCostSource;
  isActive?: boolean;
  description?: string;
  collaboratorId?: string;
  collaboratorName?: string;
  relatedItemId?: string;
  relatedItemType?: ProjectCostRelatedType;
  relatedItemTitle?: string;
  timeEntryId?: string;
  category: string;
  date: string;
  hours?: number;
  hourlyRate?: number;
  amount: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ActivityTag = {
  id: string;
  name: string;
  color?: string;
  description?: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
  usage_count?: number;
};

export type OrganizationType =
  | "CLIENTE_EMPRESA"
  | "CLIENTE_PESSOA"
  | "EMPRESA_INTERNA"
  | "SETOR_INTERNO"
  | "DEPARTAMENTO"
  | "FILIAL"
  | "OUTRO";

export type TicketStatus =
  | "Aberto"
  | "Aguardando aprovacao"
  | "Aprovado"
  | "Reprovado"
  | "Triagem / Categorizacao"
  | "Em atendimento"
  | "Aguardando cliente"
  | "Validacao / Avaliacao"
  | "Pausado"
  | "Cancelado"
  | "Finalizado";

export type TicketVisibility = "internal" | "client";

export type TicketAttachment = {
  id?: string;
  name: string;
  url?: string;
  content_type?: string;
  size?: number;
};

export type TicketCategory = {
  id: string;
  name: string;
  description?: string;
  active?: boolean;
  sla?: string;
  sla_unit?: string;
  approval_required?: boolean;
  default_priority?: string;
  default_impact?: string;
  default_type?: string;
  default_team?: string;
  allow_project_activity?: boolean;
  requires_technical_categorization?: boolean;
  requires_client_validation?: boolean;
  color?: string;
  icon?: string;
  created_at?: string;
  updated_at?: string;
};

export type TicketApproval = {
  status?: "pending" | "approved" | "rejected" | "not_required";
  approved_by?: string;
  approved_by_name?: string;
  approved_at?: string;
  rejected_by?: string;
  rejected_by_name?: string;
  rejected_at?: string;
  justification?: string;
};

export type TicketWorkflowStatusConfig = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  color?: string;
  active: boolean;
  pauses_sla?: boolean;
  is_final?: boolean;
  allows_resume?: boolean;
  order: number;
  origin_statuses?: string[];
  next_statuses?: string[];
  system?: boolean;
};

export type TicketStatusHistory = {
  id: string;
  ticketId: string;
  fromStatus?: string;
  toStatus: string;
  action: string;
  reason?: string;
  userId?: string;
  userName?: string;
  createdAt: string;
};

export type TicketWorkflowMeta = {
  ticket_id: string;
  category?: string;
  category_id?: string | null;
  category_name?: string;
  triage_completed?: boolean;
  triage_completed_at?: string | null;
  triage_completed_by?: string | null;
  triage_completed_by_name?: string;
  triage_notes?: string;
  subcategory?: string;
  priority?: string;
  team?: string;
  responsible_technician?: string | null;
  responsible_technician_name?: string;
  technicians?: string[];
  technician_names?: string[];
  started_at?: string | null;
  started_by?: string | null;
  started_by_name?: string;
  paused_at?: string | null;
  paused_by?: string | null;
  paused_by_name?: string;
  pause_reason?: string;
  waiting_reason?: string;
  validation_notes?: string;
  finished_at?: string | null;
  finished_by?: string | null;
  finished_by_name?: string;
  resolution_description?: string;
  final_observation?: string;
  cancel_reason?: string;
  canceled_at?: string | null;
  canceled_by?: string | null;
  canceled_by_name?: string;
  sla_paused?: boolean;
  sla_paused_at?: string | null;
  sla_pause_total_ms?: number;
  linked_activity?: string | null;
  linked_activity_name?: string;
  linked_activities?: string[];
  status_history?: TicketStatusHistory[];
  timeline_events?: TicketTimelineEvent[];
};

export type TicketTimelineEvent = {
  id: string;
  ticket?: string;
  author?: string;
  author_name?: string;
  created_at?: string;
  type?: string;
  message?: string;
  visibility?: TicketVisibility;
  attachments?: TicketAttachment[];
  metadata?: Record<string, unknown>;
};

export type SprintBacklogItem = {
  id?: string;
  item_id: string;
  item_type: "ticket" | "activity";
  title?: string;
  code?: string;
  status?: string;
  sprint?: string | null;
  entered_at?: string;
  removed_at?: string;
  moved_to_sprint?: string | null;
  moved_by?: string | null;
};

export type SprintMovementLog = {
  id?: string;
  sprintId?: string;
  itemId: string;
  itemType: "ticket" | "activity";
  enteredAt?: string;
  removedAt?: string;
  statusWhenEntered?: string;
  statusWhenRemoved?: string;
  movedToSprintId?: string | null;
  movedBy?: string | null;
};

export type OrganizationLink = {
  id: string;
  organization: string;
  organization_id?: string;
  organization_name?: string;
  role?: string;
  active?: boolean;
};

export type Organization = {
  id: string;
  name: string;
  organization_type?: OrganizationType | string;
  type?: OrganizationType | string;
  document?: string;
  email?: string;
  phone?: string;
  address?: string;
  sector?: string;
  contact_name?: string;
  active?: boolean;
  parent?: string | null;
  organization_parent_id?: string | null;
  organization_parent_name?: string;
  plan?: string;
  mrr?: string | number;
  health?: string;
  status?: string;
  notes?: string;
  tickets?: number;
  projects?: number;
  created_at?: string;
  updated_at?: string;
};

export type Client = Organization;

export type Project = {
  id: string;
  name: string;
  description?: string;
  client?: string;
  client_name?: string;
  organization_id?: string;
  organization_name?: string;
  owner?: string | null;
  owner_name?: string;
  leader_name?: string;
  contact_principal?: string | null;
  contact_principal_name?: string;
  team?: string[];
  team_names?: string[];
  member_links?: Array<{
    id: string;
    user: string;
    user_name?: string;
    role?: string;
    active?: boolean;
  }>;
  status?: string;
  progress?: number;
  budget?: string | number;
  real_cost?: string | number;
  due_at?: string | null;
  start_at?: string | null;
  tags?: string[];
  checklist?: ProjectStage[];
  cost_entries?: ProjectCost[];
  costs?: ProjectCost[];
  project_costs?: ProjectCost[];
  created_at?: string;
  updated_at?: string;
};

export type Ticket = {
  id: string;
  code?: string;
  title: string;
  description?: string;
  client?: string;
  client_name?: string;
  organization_id?: string;
  organization_name?: string;
  project?: string | null;
  project_name?: string;
  sprint?: string | null;
  sprint_name?: string;
  requester?: string;
  requester_name?: string;
  requester_user?: string | null;
  requester_user_name?: string;
  contact_responsible?: string | null;
  contact_responsible_name?: string;
  contact_responsible_phone?: string;
  category?: string;
  category_id?: string;
  category_name?: string;
  subcategory?: string;
  type?: string;
  priority?: string;
  impact?: string;
  urgency?: string;
  status?: TicketStatus | string;
  team?: string;
  responsible_technician?: string | null;
  responsible_technician_name?: string;
  sla?: string;
  origin?: string;
  approval_required?: boolean;
  approval?: TicketApproval;
  approval_status?: string;
  approval_route?: string;
  approval_reason?: string;
  current_approver?: string | null;
  current_approver_name?: string;
  converted_activity?: string | null;
  conversion_reason?: string;
  approved_by?: string;
  approved_by_name?: string;
  approved_at?: string;
  rejected_by?: string;
  rejected_by_name?: string;
  rejected_at?: string;
  approval_justification?: string;
  requires_client_validation?: boolean;
  internal_notes?: string;
  technicians?: string[];
  technician_names?: string[];
  tags?: string[];
  checklist?: ChecklistItem[];
  attachments?: TicketAttachment[];
  linked_activity?: string | null;
  linked_activity_name?: string;
  linked_activities?: string[];
  timeline?: TicketTimelineEvent[];
  comments?: TicketTimelineEvent[];
  status_history?: TicketStatusHistory[];
  triage_completed?: boolean;
  triage_completed_at?: string | null;
  triage_completed_by?: string | null;
  triage_completed_by_name?: string;
  triage_notes?: string;
  started_at?: string | null;
  started_by?: string | null;
  started_by_name?: string;
  paused_at?: string | null;
  paused_by?: string | null;
  paused_by_name?: string;
  pause_reason?: string;
  waiting_reason?: string;
  validation_notes?: string;
  finished_by?: string | null;
  finished_by_name?: string;
  resolution_description?: string;
  final_observation?: string;
  cancel_reason?: string;
  canceled_at?: string | null;
  canceled_by?: string | null;
  canceled_by_name?: string;
  sla_paused?: boolean;
  sla_paused_at?: string | null;
  sla_pause_total_ms?: number;
  returns_count?: number;
  converted_to_activity?: boolean;
  converted_at?: string | null;
  converted_reason?: string;
  est_hours?: string | number;
  done_hours?: string | number;
  opened_at?: string | null;
  due_at?: string | null;
  finished_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type User = {
  id: string;
  username?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  role?: string;
  client?: string | null;
  client_id?: string | null;
  client_name?: string;
  organization_id?: string | null;
  organization_name?: string;
  organization_links?: OrganizationLink[];
  job_title?: string;
  specialty?: string;
  hourly_cost?: number;
  total_hours?: number;
  used_hours?: number;
  technical_group?: string;
  permission_blocks?: string[];
  permission_blocks_data?: PermissionBlock[];
  granted_permissions?: PermissionMap;
  denied_permissions?: PermissionMap;
  resolved_permissions?: PermissionMap;
  permissions_json?: string[];
  is_active?: boolean;
  department?: string | null;
  department_name?: string;
  position?: string | null;
  position_name?: string;
  supervisor?: string | null;
  supervisor_name?: string;
  manager?: string | null;
  manager_name?: string;
  approval_mode?: string;
  is_service_desk_approver?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type Department = {
  id: string;
  name: string;
  description?: string;
  manager?: string | null;
  manager_name?: string;
  member_count?: number;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type Position = {
  id: string;
  name: string;
  description?: string;
  auto_approval?: boolean;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type NotificationCategory =
  | "Chamados"
  | "Aprovacoes"
  | "Projetos"
  | "Atividades"
  | "Comentarios"
  | "Sistema";

export type AppNotification = {
  id: string;
  recipient?: string;
  actor?: string | null;
  actor_name?: string;
  category?: NotificationCategory | string;
  event?: string;
  origin?: string;
  title: string;
  message?: string;
  link?: string;
  entity_type?: string;
  entity_id?: string;
  is_read?: boolean;
  is_favorite?: boolean;
  is_archived?: boolean;
  read_at?: string | null;
  email_sent?: boolean;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

export type NotificationPreference = {
  id?: string;
  email_enabled?: boolean;
  inbox_enabled?: boolean;
  disabled_events?: string[];
  email_disabled_events?: string[];
  digest_frequency?: string;
};

export type TicketApprovalEntry = {
  id: string;
  ticket?: string;
  approver?: string | null;
  approver_name?: string;
  decision?: "PENDENTE" | "APROVADO" | "REPROVADO" | "AJUSTES" | string;
  route?: string;
  comment?: string;
  decided_at?: string | null;
  created_at?: string;
};

export type PermissionBlock = {
  id: string;
  name: string;
  description?: string;
  permissions?: PermissionMap;
  active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type Sprint = {
  id: string;
  name: string;
  goal?: string;
  project?: string | null;
  project_name?: string;
  lead?: string | null;
  lead_name?: string;
  status?: string;
  start_at?: string | null;
  end_at?: string | null;
  capacity?: number;
  story_points?: number;
  backlog?: Array<string | SprintBacklogItem>;
  tasks?: Array<string | SprintBacklogItem>;
  movement_log?: SprintMovementLog[];
  created_at?: string;
  updated_at?: string;
};

export type Activity = {
  id: string;
  title: string;
  description?: string;
  type?: string;
  status?: string;
  priority?: string;
  calculateHourlyCost?: boolean;
  calculate_hourly_cost?: boolean;
  assignee?: string | null;
  assignee_name?: string;
  project?: string | null;
  project_name?: string;
  sprint?: string | null;
  sprint_name?: string;
  ticket?: string | null;
  ticket_code?: string;
  est_hours?: string | number;
  done_hours?: string | number;
  story_points?: number;
  work_description?: string;
  start_at?: string | null;
  due_at?: string | null;
  tags?: string[];
  checklist?: ChecklistItem[];
  created_at?: string;
  updated_at?: string;
};

export type SprintActivityPlan = {
  id: string;
  sprintId: string;
  activityId: string;
  projectId: string;
  responsibleIds?: string[];
  plannedHours: number;
  storyPoints?: number;
  plannedStartDate?: string;
  plannedEndDate?: string;
  order?: number;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
};

export type ActivityTimeEntry = {
  id: string;
  activityId: string;
  sprintId?: string;
  projectId: string;
  collaboratorId: string;
  collaboratorName?: string;
  date: string;
  hours: number;
  workDescription?: string;
  generatedCostId?: string;
  createdAt: string;
  updatedAt?: string;
};

export type TimeEntry = {
  id: string;
  projectId: string;
  activityId: string;
  collaboratorId: string;
  collaboratorName: string;
  date: string;
  hours: number;
  description?: string;
  createdAt: string;
  updatedAt?: string;
};

export type DashboardData = {
  tickets_open: number;
  tickets_critical: number;
  clients: number;
  projects_active: number;
  activities: number;
  recent_tickets: Array<Pick<Ticket, "id" | "code" | "title" | "priority" | "status" | "sla">>;
  projects_at_risk: Array<Pick<Project, "id" | "name" | "progress" | "due_at">>;
};
