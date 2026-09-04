export type RoleCode =
  | 'ADMIN'
  | 'MANAGER'
  | 'SHIFT_LEADER'
  | 'STAFF'
  | 'VIEWER';

export type UserStatus = 'ACTIVE' | 'LOCKED' | 'DISABLED' | 'PENDING' | 'REJECTED';


export interface Role {
  id: number;
  code: RoleCode;
  name: string;
  description: string;
  level: number;
  created_at: string;
}

export interface Permission {
  id: number;
  code: string;
  module: string;
  description: string;
  action: string;
}


export interface User {
  id: number | string;
  employee_code: string;
  full_name: string;
  username: string;
  email: string;
  phone: string;
  unit: string;
  team: string;
  title: string;
  status: UserStatus;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  deleted_at?: string | null;
  approved_by?: string;
  approved_at?: string;
  rejected_by?: string;
  rejected_at?: string;
  rejection_reason?: string;
  roles?: RoleCode[];
  role_names?: string[];
  permissions?: string[];
    lastLoginAt?: string;
}

export interface AuditLog {
  id: number;
  user_id: number;
  username: string;
  user_fullname: string;
  action: string;
  module: string;
  target_id?: string | number | null;
  details?: string;
  result: 'SUCCESS' | 'FAILURE';
  ip_address: string;
  created_at: string;
}

export interface Notification {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: 'INFO' | 'WARNING' | 'ALERT';
  is_read: boolean;
  created_at: string;
  link?: string;
}

export interface DocumentItem {
  id: number;
  title: string;
  document_code: string;
  category: string;
  file_url: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface GuideItem {
  id: number;
  title: string;
  category: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  total_equipment: number;
  total_stations_110kv: number;
  total_feeders: number;
  total_ring_loops: number;
  active_tasks: number;
  pending_approval_tasks?: number;
  today_tasks?: number;
  overdue_tasks?: number;
  completed_today?: number;
  upcoming_inspections?: number;
  active_issues?: number;
  critical_issues?: number;
  uninspected_devices?: number;
  open_devices?: number;
  scada_no_signal?: number;
  users_count: number;
  recent_audit_count: number;
}

export type DeviceType = 'LBS' | 'DS' | 'RCL' | 'REC' | 'RMU' | 'OTHER';
export type SwitchStatus = 'CLOSED' | 'OPEN' | 'UNKNOWN';
export type ScadaStatus = 'SIGNAL' | 'NO_SIGNAL' | 'UNKNOWN';
export type Relay79Status = 'ON' | 'OFF' | 'N_A';
export type SubstationStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';

export interface Substation {
  version?: number;
  id: number;
  substation_code: string;
  name: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  google_maps_url?: string;
  image_url?: string;
  notes?: string;
  status: SubstationStatus;
  created_at: string;
  updated_at: string;
  created_by?: string;
  feeder_count?: number;
  device_count?: number;
}

export interface Feeder {
  version?: number;
  id: number;
  feeder_code: string;
  name: string;
  substation_id: number;
  substation_name?: string;
  substation_code?: string;
  start_point?: string;
  end_point?: string;
  notes?: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
  created_by?: string;
  device_count?: number;
}

export interface DeviceImage {
  id: number;
  device_id: number;
  image_url: string;
  is_primary: number | boolean;
  caption?: string;
  created_at: string;
  created_by?: string;
}

export interface DeviceLocation {
  id: number;
  device_id: number;
  latitude?: number | null;
  longitude?: number | null;
  google_maps_url?: string;
  note?: string;
  updated_by?: string;
  created_at: string;
}

export interface DeviceStatusHistory {
  id: number;
  device_id: number;
  old_switch_status?: string;
  new_switch_status?: string;
  old_scada_status?: string;
  new_scada_status?: string;
  old_relay_79?: string;
  new_relay_79?: string;
  note?: string;
  updated_by?: string;
  created_at: string;
}

export interface Device {
  id: number;
  device_id: string; // UNIQUE STRING
  device_code?: string;
  name: string;
  device_type: DeviceType;
  pole_number?: string;
  feeder_id?: number | null;
  feeder_name?: string;
  feeder_code?: string;
  substation_id?: number | null;
  substation_name?: string;
  substation_code?: string;
  unit: string;
  team: string;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  switch_status: SwitchStatus;
  scada_status: ScadaStatus;
  relay_79: Relay79Status;
  battery_status?: 'GOOD' | 'WEAK' | 'BROKEN' | 'REPLACING' | 'UNCHECKED';
  latitude?: number | null;
  longitude?: number | null;
  google_maps_url?: string;
  notes?: string;
  current_setting?: string;
  primary_image?: string;
  version?: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
  images?: DeviceImage[];
  location_history?: DeviceLocation[];
  status_history?: DeviceStatusHistory[];
  audit_logs?: AuditLog[];
}

export interface AuthSession {
  token: string;
  user: User;
  permissions: string[];
}

// Phase 3: Loop & Topology Types
export type LoopStatus = 'OPEN' | 'CLOSED' | 'INACTIVE' | 'ACTIVE';

export interface Loop {
  id: number;
  loop_id: string; // e.g., 'KV-110-01'
  name: string; // Tên khép vòng
  substation_id_a: number;
  substation_name_a?: string;
  substation_code_a?: string;
  feeder_id_a: number;
  feeder_name_a?: string;
  feeder_code_a?: string;
  device_id_a: string; // DEVICE_ID
  device_name_a?: string;
  
  substation_id_b: number;
  substation_name_b?: string;
  substation_code_b?: string;
  feeder_id_b: number;
  feeder_name_b?: string;
  feeder_code_b?: string;
  device_id_b: string; // DEVICE_ID
  device_name_b?: string;
  device_code_b?: string;
  device_type_b?: string;
  switch_status_b?: string;
  
  device_code_a?: string;
  device_type_a?: string;
  switch_status_a?: string;

  loop_device_id?: string;
  loop_device_name?: string;
  loop_device_code?: string;
  loop_device_type?: string;
  loop_device_switch_status?: string;
  loop_device_status?: string;
  loop_device_pole?: string;
  loop_device_unit?: string;
  loop_device_team?: string;
  loop_device_latitude?: number | null;
  loop_device_longitude?: number | null;
  loop_device_maps_url?: string;
  loop_device_image?: string;
  operating_status?: string;
  config_status?: string;
  operation_status?: string;
  configuration_status?: string;
  latitude?: number | null;
  longitude?: number | null;
  google_maps_url?: string;
  inspection_cycle?: string;
  last_inspection_date?: string;
  next_inspection_date?: string;
  assigned_user_id?: number;

  status: LoopStatus;
  notes?: string;
  schemaVersion?: number;
  created_at: string;
  updated_at: string;
  created_by?: string;

  // Joined/Computed fields
  active_version?: string;
  active_version_status?: TopologyVersionStatus;
  node_count?: number;
  edge_count?: number;
}

export type TopologyVersionStatus = 'DRAFT' | 'SUBMITTED' | 'REVIEW' | 'APPROVED' | 'PUBLISHED' | 'REJECTED';

export interface TopologyNode {
  id?: number;
  loop_id?: number;
  version_id?: number;
  device_id: string; // DEVICE_ID
  pos_x: number;
  pos_y: number;
  device?: Device;
}

export interface TopologyEdge {
  id?: number;
  loop_id?: number;
  version_id?: number;
  source_device_id: string;
  target_device_id: string;
  connection_type?: 'OVERHEAD' | 'UNDERGROUND' | 'BUSBAR' | 'CABLE' | 'DEFAULT';
  status?: 'ACTIVE' | 'INACTIVE' | 'OPEN' | 'CLOSED';
  created_by?: string;
  created_at?: string;
}

export interface TopologyVersion {
  id: number;
  loop_id: number;
  version: string;
  status: TopologyVersionStatus;
  change_summary?: string;
  reason?: string;
  nodes_json: string;
  edges_json: string;
  nodes?: TopologyNode[];
  edges?: TopologyEdge[];
  created_by: string;
  created_at: string;
  approved_by?: string;
  approved_at?: string;
  rejected_by?: string;
  rejected_at?: string;
  rejection_reason?: string;
}

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REQUEST_INFO';

export interface TopologyChangeRequest {
  id: number;
  loop_id: number;
  loop_name?: string;
  version_id: number;
  version_str: string;
  requester_username: string;
  requester_fullname: string;
  status: ApprovalStatus;
  reason: string;
  change_summary?: string;
  before_snapshot?: string; // JSON string
  after_snapshot?: string; // JSON string
  reviewer_username?: string;
  reviewer_fullname?: string;
  review_notes?: string;
  created_at: string;
  updated_at: string;
}

// ==================== PHASE 4 TYPES ====================
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type TaskStatus =
  | 'NEW'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'PENDING_APPROVAL'
  | 'COMPLETED'
  | 'OVERDUE'
  | 'RETURNED'
  | 'REJECTED'
  | 'PAUSED'
  | 'CANCELLED';

export interface TaskHistory {
  id: number;
  task_id: number;
  user_id?: number | null;
  username?: string;
  user_fullname?: string;
  action: string;
  action_label?: string;
  old_status?: string | null;
  new_status?: string | null;
  progress?: number | null;
  notes?: string | null;
  created_at: string;
}

export interface TaskPermissions {
  is_assignee: boolean;
  is_creator: boolean;
  is_supervisor: boolean;
  can_execute: boolean;
  can_approve: boolean;
  can_cancel: boolean;
}

export interface Task {
  id: number;
  task_code: string;
  title: string;
  task_devices?: any[];
  device_id?: number | null;
  device_code?: string;
  device_name?: string;
  device_type?: string;
  pole_number?: string;
  device_unit?: string;
  device_team?: string;
  latitude?: number;
  longitude?: number;
  google_maps_url?: string;
  assigned_to_user_id?: number | null;
  assigned_to_username?: string | null;
  assigned_to_fullname?: string | null;
  team?: string;
  checklist_id?: number | null;
  checklist_title?: string;
  checklist_category?: string;
  assigned_date?: string;
  due_date: string;
  progress?: number;
  accepted_at?: string | null;
  started_at?: string | null;
  submitted_at?: string | null;
  completed_at?: string | null;
  completed_by?: string | null;
  creator_id?: number | null;
  creator_username?: string | null;
  creator_fullname?: string | null;
  approved_by_user_id?: number | null;
  approved_by_username?: string | null;
  approved_by_fullname?: string | null;
  approved_at?: string | null;
  approval_notes?: string | null;
  paused_at?: string | null;
  pause_reason?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  content: string;
  notes?: string;
  return_reason?: string;
  is_archived?: boolean;
  days_since_completed?: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  checklist_items?: ChecklistItem[];
  results?: TaskChecklistResult[];
  history?: TaskHistory[];
  permissions?: TaskPermissions;
}

export type ChecklistInputType = 'PASS_FAIL' | 'NUMBER' | 'TEXT' | 'MULTIPLE_CHOICE';

export interface ChecklistItem {
  id: number;
  checklist_id: number;
  item_order: number;
  item_code: string;
  content: string;
  standard_value?: string;
  unit?: string;
  input_type: ChecklistInputType;
  options_json?: string;
  created_at?: string;
}

export interface Checklist {
  id: number;
  checklist_code: string;
  title: string;
  category: string;
  description?: string;
  version: string;
  target_device_type: string;
  is_template?: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  item_count?: number;
  items?: ChecklistItem[];
}

export interface TaskChecklistResult {
  id: number;
  task_id: number;
  checklist_id: number;
  checklist_item_id: number;
  item_content: string;
  standard_value?: string;
  unit?: string;
  result_value?: string;
  is_pass?: boolean | number | null;
  notes?: string;
  image_url?: string;
  completed_at?: string;
  completed_by?: string;
}

export type InspectionFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY';

export interface InspectionSchedule {
  id: number;
  schedule_code: string;
  title: string;
  frequency: InspectionFrequency;
  device_id: number;
  device_code?: string;
  device_name?: string;
  device_type?: string;
  checklist_id: number;
  checklist_title?: string;
  assigned_team: string;
  assigned_to_user_id?: number;
  assigned_to_fullname?: string;
  last_run_date?: string;
  next_run_date: string;
  status: 'ACTIVE' | 'PAUSED' | 'INACTIVE' | 'DELETED';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type IssueSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IssueStatus = 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export interface Issue {
  id: number;
  issue_code: string;
  device_id: number;
  device_code?: string;
  device_name?: string;
  device_type?: string;
  pole_number?: string;
  substation_name?: string;
  feeder_name?: string;
  title: string;
  content: string;
  severity: IssueSeverity;
  status: IssueStatus;
  image_url?: string;
  reported_by_username: string;
  reported_by_fullname: string;
  reported_at: string;
  assigned_to_username?: string;
  assigned_to_fullname?: string;
  notes?: string;
  resolution_notes?: string;
  resolved_at?: string;
  closed_at?: string;
  closed_by?: string;
}

export type BackupType = 'AUTO_BEFORE_RESET' | 'AUTO_BEFORE_RESTORE' | 'MANUAL' | 'SNAPSHOT' | 'PERIODIC';

export interface SystemBackup {
  id: number;
  name: string;
  backup_type: BackupType;
  file_path?: string;
  counts_summary: {
    devices: number;
    feeders: number;
    stations: number;
    loops: number;
    work: number;
    tasks?: number;
    checklists?: number;
    schedules?: number;
    issues?: number;
    topology?: number;
    links?: number;
  };
  file_size_bytes: number;
  created_by?: number;
  created_by_name?: string;
  created_at: string;
  notes?: string;
}

