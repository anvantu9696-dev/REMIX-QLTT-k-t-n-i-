import { AuthSession, User, AuditLog, Notification, DocumentItem, GuideItem, DashboardStats, SystemBackup } from '../types';

const API_BASE = '/api';

export function getAuthToken(): string | null {
  return localStorage.getItem('grid_auth_token');
}

export function setAuthToken(token: string | null): void {
  if (token) {
    localStorage.setItem('grid_auth_token', token);
  } else {
    localStorage.removeItem('grid_auth_token');
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const maxRetries = 2;
  let attempt = 0;

  while (attempt <= maxRetries) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        signal: options.signal || controller.signal,
        headers
      });
      clearTimeout(timeoutId);
      
      const text = await response.text();
      let data: any;
      try {
        data = text ? JSON.parse(text) : {};
      } catch (e) {
        data = { message: text.includes('<!doctype') || text.includes('<html') ? `Lỗi máy chủ hoặc không tìm thấy đường dẫn (${response.status})` : text || response.statusText };
      }
    
      if (!response.ok) {
        if (response.status === 401) {
          setAuthToken(null);
        }
        let message = data?.message;
        if (response.status === 413) {
          message = data?.message || 'Ảnh vượt quá dung lượng cho phép (413). Hệ thống đã tự động nén ảnh nhưng vẫn vượt giới hạn, vui lòng chọn ảnh nhỏ hơn.';
        } else if (response.status === 401) {
          message = data?.message || 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.';
        } else if (response.status === 403) {
          message = data?.message || 'Bạn không có quyền thực hiện thao tác này.';
        } else if (response.status === 404) {
          message = data?.message || 'Không tìm thấy API hoặc đường dẫn yêu cầu (404).';
        } else if (response.status >= 500) {
          message = data?.message || 'Máy chủ gặp lỗi khi xử lý yêu cầu hoặc dữ liệu.';
        }
        const error: any = new Error(message || `Lỗi yêu cầu hệ thống (${response.status})`);
        error.status = response.status;
        error.data = data;
        error.errors = data?.errors;
        error.usage = data?.usage;
        throw error;
      }
    
      return data as T;
    } catch (error: any) {
      clearTimeout(timeoutId);

      // If error has status, it's an HTTP error response from server (not a network failure), so don't retry
      if (error.status) {
        if (error.status !== 401) {
          console.error('API Error:', error);
        }
        throw error;
      }

      // Network error or fetch failure
      attempt++;
      if (attempt > maxRetries) {
        console.warn('API Network Error after retries:', error);
        throw new Error(error.name === 'AbortError' ? 'Thời gian chờ máy chủ quá lâu (timeout)' : (error.message || 'Kết nối đến máy chủ thất bại'));
      }
      // Wait before retry (exponential backoff: 500ms, 1000ms)
      await new Promise(resolve => setTimeout(resolve, attempt * 500));
    }
  }

  throw new Error('Kết nối đến máy chủ thất bại');
}

export interface ImportItemResult {
  row_index: number;
  code: string;
  name: string;
  type?: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  action?: 'INSERTED' | 'UPDATED' | 'SKIPPED';
  reason?: string;
  details?: string;
}

export interface ImportReport {
  total_processed: number;
  success_count: number;
  imported_new: number;
  updated_existing: number;
  failed_count: number;
  skipped_count: number;
  success_items: ImportItemResult[];
  failed_items: ImportItemResult[];
  skipped_items?: ImportItemResult[];
  errors?: string[];
}

export const api = {
  // Auth
  login: (username: string, password: string) => 
    request<AuthSession & { success: boolean; message: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    }),

  register: (registerData: {
    full_name: string;
    username: string;
    email: string;
    phone?: string;
    unit: string;
    team?: string;
    title?: string;
    password: string;
    confirmPassword?: string;
    confirm_password?: string;
  }) =>
    request<{ success: boolean; message: string; data?: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(registerData)
    }),

  guestLogin: () =>
    request<AuthSession & { success: boolean; message: string }>('/auth/guest-login', {
      method: 'POST'
    }),

  getMe: () => 
    request<{ success: boolean; user: User; permissions: string[] }>('/auth/me'),

  forgotPassword: (usernameOrEmail: string) =>
    request<{ success: boolean; message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ usernameOrEmail })
    }),

  // Users
  getUsers: (params?: { search?: string; role?: string; status?: string; unit?: string; team?: string }) => {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return request<{ success: boolean; data: User[]; total: number }>(`/users${query ? '?' + query : ''}`);
  },

  getPendingUsers: () =>
    request<{ success: boolean; data: User[]; total: number }>('/users/pending'),

  getUser: (id: number) =>
    request<{ success: boolean; data: User & { role_ids: number[] } }>(`/users/${id}`),

  createUser: (userData: any) =>
    request<{ success: boolean; message: string }>('/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    }),

  updateUser: (id: number, userData: any) =>
    request<{ success: boolean; message: string }>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData)
    }),

  approveUser: (id: number, data?: { role?: string; roles?: string[]; unit?: string; team?: string; title?: string; scopes?: any[] }) =>
    request<{ success: boolean; message: string }>(`/users/${id}/approve`, {
      method: 'PATCH',
      body: JSON.stringify(data || {})
    }),

  rejectUser: (id: number, reason: string) =>
    request<{ success: boolean; message: string }>(`/users/${id}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ reason })
    }),

  lockUser: (id: number, locked: boolean) =>
    request<{ success: boolean; message: string }>(`/users/${id}/lock`, {
      method: 'PATCH',
      body: JSON.stringify({ locked })
    }),

  updateUserRole: (id: number, roles: string[], scopes?: any[]) =>
    request<{ success: boolean; message: string }>(`/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ roles, scopes })
    }),

  updateUserStatus: (id: number, status: 'ACTIVE' | 'LOCKED' | 'DISABLED' | 'PENDING' | 'REJECTED', reason?: string) =>
    request<{ success: boolean; message: string }>(`/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason })
    }),

  deleteUser: (id: number) =>
    request<{ success: boolean; message: string }>(`/users/${id}`, {
      method: 'DELETE'
    }),

  // Roles & Permissions
  getRolesAndPermissions: () =>
    request<{ success: boolean; roles: any[]; permissions: any[] }>('/roles'),

  // Audit Logs
  getAuditLogs: (params?: { search?: string; module?: string; result?: string; limit?: number }) => {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return request<{ success: boolean; data: AuditLog[]; total: number }>(`/audit-logs${query ? '?' + query : ''}`);
  },

  // Dashboard Stats
  getDashboardStats: () =>
    request<{ success: boolean; data: DashboardStats }>('/dashboard/stats'),

  // Notifications
  getNotifications: (params?: { status?: string; limit?: number }) => {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return request<{ success: boolean; data: Notification[]; unread_count: number }>(`/notifications${query ? '?' + query : ''}`);
  },

  markNotificationRead: (id: number) =>
    request<{ success: boolean; message: string }>(`/notifications/${id}/read`, {
      method: 'PATCH'
    }),

  markAllNotificationsRead: () =>
    request<{ success: boolean; message: string }>('/notifications/mark-all-read', { method: 'PATCH' }),

  clearReadNotifications: () =>
    request<{ success: boolean; message: string }>('/notifications/clear-read', { method: 'DELETE' }),

  // Documents & Guides
  getDocuments: () =>
    request<{ success: boolean; data: DocumentItem[] }>('/documents'),

  createDocument: (doc: { title: string; document_code: string; category: string; file_url?: string }) =>
    request<{ success: boolean; message: string }>('/documents', {
      method: 'POST',
      body: JSON.stringify(doc)
    }),

  getGuides: () =>
    request<{ success: boolean; data: GuideItem[] }>('/guides'),

  // Substations (Trạm 110kV)
  getSubstations: (params?: { search?: string; status?: string }) => {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return request<{ success: boolean; data: any[] }>(`/substations${query ? '?' + query : ''}`);
  },

  getSubstation: (id: number) =>
    request<{ success: boolean; data: any }>(`/substations/${id}`),

  createSubstation: (data: any, operationId?: string) =>
    request<{ success: boolean; message: string; data: any }>('/substations', {
      method: 'POST',
      body: JSON.stringify({ ...data, operationId: operationId || crypto.randomUUID() })
    }),

  updateSubstation: (id: number, data: any, operationId?: string, expectedVersion?: number) =>
    request<{ success: boolean; message: string; data: any }>(`/substations/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...data, operationId: operationId || crypto.randomUUID(), expectedVersion })
    }),

  deleteSubstation: (id: number, operationId?: string) =>
    request<{ success: boolean; message: string }>(`/substations/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ operationId: operationId || crypto.randomUUID() })
    }),

  // Feeders (Phát tuyến)
  getFeeders: (params?: { search?: string; substation_id?: string | number; status?: string }) => {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return request<{ success: boolean; data: any[] }>(`/feeders${query ? '?' + query : ''}`);
  },

  getFeeder: (id: number) =>
    request<{ success: boolean; data: any }>(`/feeders/${id}`),

  createFeeder: (data: any, operationId?: string) =>
    request<{ success: boolean; message: string; data: any }>('/feeders', {
      method: 'POST',
      body: JSON.stringify({ ...data, operationId: operationId || crypto.randomUUID() })
    }),

  updateFeeder: (id: number, data: any, operationId?: string, expectedVersion?: number) =>
    request<{ success: boolean; message: string; data: any }>(`/feeders/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...data, operationId: operationId || crypto.randomUUID(), expectedVersion })
    }),

  deleteFeeder: (id: number, operationId?: string, force?: boolean) =>
    request<{ success: boolean; message: string }>(`/feeders/${id}${force ? '?force=true' : ''}`, {
      method: 'DELETE',
      body: JSON.stringify({ operationId: operationId || crypto.randomUUID() })
    }),

  // Devices (Thiết bị)
  checkDeviceId: (deviceId: string, excludeId?: number) => {
    const query = excludeId ? `?excludeId=${excludeId}` : '';
    return request<{ success: boolean; exists: boolean; device: any; message: string }>(
      `/devices/check-device-id/${encodeURIComponent(deviceId)}${query}`
    );
  },

  getDevices: (params?: any) => {
    const query = new URLSearchParams(params).toString();
    return request<{ success: boolean; data: any[] }>(`/devices${query ? '?' + query : ''}`);
  },

  getDevice: (id: number | string) =>
    request<{ success: boolean; data: any }>(`/devices/${id}`),

  createDevice: (data: any, operationId?: string) =>
    request<{ success: boolean; message: string; data: any }>('/devices', {
      method: 'POST',
      body: JSON.stringify({ ...data, operationId: operationId || crypto.randomUUID() })
    }),

  updateDevice: (id: number | string, data: any, operationId?: string, expectedVersion?: number) =>
    request<{ success: boolean; message: string; data: any }>(`/devices/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...data, operationId: operationId || crypto.randomUUID(), expectedVersion })
    }),

  deleteDevice: (id: number | string, operationId?: string) =>
    request<{ success: boolean; message: string }>(`/devices/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ operationId: operationId || crypto.randomUUID() })
    }),

  bulkUpdateDevices: (data: { device_ids: (number | string)[]; updates: any; reason?: string }) =>
    request<{ success: boolean; message: string; updated_count: number }>('/devices/bulk-update', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  addDeviceImage: (deviceId: number | string, data: { image_url: string; caption?: string; is_primary?: boolean }) =>
    request<{ success: boolean; message: string; data: any[] }>(`/devices/${deviceId}/images`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  deleteDeviceImage: (deviceId: number | string, imageId: number | string) =>
    request<{ success: boolean; message: string; data: any[] }>(`/devices/${deviceId}/images/${imageId}`, {
      method: 'DELETE'
    }),

  setPrimaryDeviceImage: (deviceId: number | string, imageId: number | string) =>
    request<{ success: boolean; message: string; data: any[] }>(`/devices/${deviceId}/images/${imageId}/primary`, {
      method: 'PUT'
    }),

  // Phase 3: Loops (Khép vòng)
  getLoops: (params?: { search?: string; status?: string; substation_id?: string | number; feeder_id?: string | number }) => {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return request<{ success: boolean; data: any[] }>(`/loops${query ? '?' + query : ''}`);
  },

  getLoop: (id: number | string, version_id?: number | string) => {
    const query = version_id ? `?version_id=${version_id}` : '';
    return request<{
      success: boolean;
      data: {
        loop: any;
        active_version: any;
        versions: any[];
        nodes: any[];
        edges: any[];
        pending_request?: any;
      };
    }>(`/loops/${id}${query}`);
  },

  createLoop: (data: any) =>
    request<{ success: boolean; message: string; loopId: number }>('/loops', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  updateLoop: (id: number | string, data: any) =>
    request<{ success: boolean; message: string }>(`/loops/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  deleteLoop: (id: number | string) =>
    request<{ success: boolean; message: string }>(`/loops/${id}`, {
      method: 'DELETE'
    }),

  saveTopologyVersion: (
    loopId: number | string,
    payload: {
      nodes: any[];
      edges: any[];
      change_summary?: string;
      reason?: string;
      submit_for_approval?: boolean;
      schemaVersion?: number;
    }
  ) =>
    request<{ success: boolean; message: string; version: string; versionId: number }>(`/loops/${loopId}/versions`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  restoreTopologyVersion: (loopId: number | string, version_id: number, reason?: string) =>
    request<{ success: boolean; message: string; newVersion: string }>(`/loops/${loopId}/restore-version`, {
      method: 'POST',
      body: JSON.stringify({ version_id, reason })
    }),

  // Reset all loop connections data
  getLoopResetStats: () =>
    request<{
      success: boolean;
      counts: {
        loops: number;
        active_loops: number;
        versions: number;
        nodes: number;
        edges: number;
        change_requests: number;
      };
    }>('/loops/reset-stats'),

  resetAllLoops: (confirmation: string) =>
    request<{
      success: boolean;
      message: string;
      deleted_count: {
        loops: number;
        versions: number;
        nodes: number;
        edges: number;
        change_requests: number;
      };
      preserved: {
        substations: boolean;
        feeders: boolean;
        devices: boolean;
        users: boolean;
      };
    }>('/loops/reset', {
      method: 'POST',
      body: JSON.stringify({ confirmation })
    }),

  // Phase 3: Approvals (Phê duyệt Sơ đồ)
  getApprovals: (params?: { status?: string; search?: string }) => {
    const cleanParams: Record<string, string> = {};
    if (params) {
      if (params.status) cleanParams.status = params.status;
      if (params.search) cleanParams.search = params.search;
    }
    const query = new URLSearchParams(cleanParams).toString();
    return request<{ success: boolean; data: any[] }>(`/approvals${query ? '?' + query : ''}`);
  },

  reviewApproval: (id: number, action: 'APPROVED' | 'REJECTED' | 'REQUEST_INFO', review_notes?: string) =>
    request<{ success: boolean; message: string }>(`/approvals/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ action, review_notes })
    }),

  // Phase 4: Tasks (Công việc & Giao việc)
  getTasks: (params?: { search?: string; status?: string; priority?: string; device_id?: string | number; team?: string; assigned_to?: string | number; archived?: 'true' | 'false' | 'only' | 'all' | boolean | string }) => {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return request<{ success: boolean; data: any[]; total: number; archived_count?: number }>(`/tasks${query ? '?' + query : ''}`);
  },

  getMyTasks: (params?: { search?: string; status?: string; priority?: string; archived?: 'true' | 'false' | 'only' | 'all' | boolean | string }) => {
    const query = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
    return request<{ success: boolean; data: any[]; total?: number; archived_count?: number; active_count?: number }>(`/tasks/my-tasks${query ? '?' + query : ''}`);
  },

  getTask: (id: number | string) =>
    request<{ success: boolean; data: any }>(`/tasks/${id}`),

  createTask: (data: any) =>
    request<{ success: boolean; message: string; data: any }>('/tasks', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  updateTaskStatus: (id: number | string, data: { status: string; return_reason?: string; notes?: string; progress?: number }) =>
    request<{ success: boolean; message: string }>(`/tasks/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  acceptTask: (id: number | string, notes?: string) =>
    request<{ success: boolean; message: string }>(`/tasks/${id}/accept`, {
      method: 'POST',
      body: JSON.stringify({ notes })
    }),

  startTask: (id: number | string, notes?: string) =>
    request<{ success: boolean; message: string }>(`/tasks/${id}/start`, {
      method: 'POST',
      body: JSON.stringify({ notes })
    }),

  updateTaskProgress: (id: number | string, data: { progress: number; notes?: string }) =>
    request<{ success: boolean; message: string }>(`/tasks/${id}/progress`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  submitTaskResults: (id: number | string, data: { results: any[]; notes?: string; progress?: number }) =>
    request<{ success: boolean; message: string }>(`/tasks/${id}/submit-results`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  approveTask: (id: number | string, data?: { approval_notes?: string }) =>
    request<{ success: boolean; message: string }>(`/tasks/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(data || {})
    }),

  rejectTaskCompletion: (id: number | string, data: { reason: string }) =>
    request<{ success: boolean; message: string }>(`/tasks/${id}/reject-completion`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  returnTask: (id: number | string, data: { return_reason: string }) =>
    request<{ success: boolean; message: string }>(`/tasks/${id}/return`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  pauseTask: (id: number | string, data?: { reason?: string }) =>
    request<{ success: boolean; message: string }>(`/tasks/${id}/pause`, {
      method: 'POST',
      body: JSON.stringify(data || {})
    }),

  resumeTask: (id: number | string, data?: { notes?: string }) =>
    request<{ success: boolean; message: string }>(`/tasks/${id}/resume`, {
      method: 'POST',
      body: JSON.stringify(data || {})
    }),

  cancelTask: (id: number | string, data?: { reason?: string }) =>
    request<{ success: boolean; message: string }>(`/tasks/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify(data || {})
    }),

  getTaskHistory: (id: number | string) =>
    request<{ success: boolean; data: any[] }>(`/tasks/${id}/history`),

  deleteTask: (id: number | string) =>
    request<{ success: boolean; message: string }>(`/tasks/${id}`, {
      method: 'DELETE'
    }),

  // Phase 4: Checklists (Mẫu kiểm tra)
  getChecklists: (params?: { search?: string; category?: string; target_device_type?: string }) => {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return request<{ success: boolean; data: any[] }>(`/checklists${query ? '?' + query : ''}`);
  },

  getChecklistPresets: () =>
    request<{ success: boolean; data: any[] }>('/checklists/presets'),

  syncEvnChecklists: () =>
    request<{ success: boolean; message: string }>('/checklists/sync-evn-templates', {
      method: 'POST'
    }),

  getChecklist: (id: number | string) =>
    request<{ success: boolean; data: any }>(`/checklists/${id}`),

  createChecklist: (data: any) =>
    request<{ success: boolean; message: string; data: any }>('/checklists', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  updateChecklist: (id: number | string, data: any) =>
    request<{ success: boolean; message: string }>(`/checklists/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  cloneChecklist: (id: number | string) =>
    request<{ success: boolean; message: string; data: any }>(`/checklists/${id}/clone`, {
      method: 'POST'
    }),

  deleteChecklist: (id: number | string) =>
    request<{ success: boolean; message: string }>(`/checklists/${id}`, {
      method: 'DELETE'
    }),

  // Phase 4: Inspection Schedules (Kiểm tra định kỳ)
  getSchedules: () =>
    request<{ success: boolean; data: any[] }>('/schedules'),

  createSchedule: (data: any) =>
    request<{ success: boolean; message: string; data: any }>('/schedules', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  generateScheduleTasks: () =>
    request<{ success: boolean; message: string; generated_count: number }>('/schedules/generate-tasks', {
      method: 'POST'
    }),

  deleteSchedule: (id: number | string, data: { reason: string }) =>
    request<{ success: boolean; message: string }>(`/schedules/${id}`, {
      method: 'DELETE',
      body: JSON.stringify(data)
    }),

  restoreSchedule: (id: number | string) =>
    request<{ success: boolean; message: string }>(`/schedules/${id}/restore`, {
      method: 'POST'
    }),

  // Phase 4: Issues / Anomalies (Bất thường)
  getIssues: (params?: { search?: string; status?: string; severity?: string; device_id?: string | number }) => {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return request<{ success: boolean; data: any[]; total: number }>(`/issues${query ? '?' + query : ''}`);
  },

  getIssue: (id: number | string) =>
    request<{ success: boolean; data: any }>(`/issues/${id}`),

  reportIssue: (data: any) =>
    request<{ success: boolean; message: string; data: any }>('/issues', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  updateIssueStatus: (id: number | string, data: { status: string; assigned_to_username?: string; resolution_notes?: string }) =>
    request<{ success: boolean; message: string }>(`/issues/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  deleteIssue: (id: number | string) =>
    request<{ success: boolean; message: string }>(`/issues/${id}`, {
      method: 'DELETE'
    }),

  // Phase 5: Import Excel/CSV
  analyzeImportRows: (rows: any[]) =>
    request<{
      success: boolean;
      data: {
        summary: any;
        validRows: any[];
        invalidRows: any[];
        fileDuplicates: any[];
        conflicts: any[];
        exactDuplicates: any[];
        newRows: any[];
      };
    }>('/import/analyze', {
      method: 'POST',
      body: JSON.stringify({ rows })
    }),

  confirmImport: (data: {
    newRows: any[];
    conflictResolutions: { device_id: string; action: 'KEEP_OLD' | 'UPDATE_FROM_FILE' | 'SKIP'; fileData: any }[];
  }) =>
    request<{
      success: boolean;
      message: string;
      report: {
        total_processed: number;
        imported_new: number;
        updated_existing: number;
        skipped: number;
        errors: string[];
      };
    }>('/import/confirm', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  importDirect: (rows: any[]) =>
    request<{
      success: boolean;
      message: string;
      report: ImportReport;
    }>('/import/direct', {
      method: 'POST',
      body: JSON.stringify({ rows })
    }),

  importSubstations: (rows: any[]) =>
    request<{ success: boolean; message: string; report?: ImportReport }>('/import/substations', {
      method: 'POST',
      body: JSON.stringify({ rows })
    }),

  importFeeders: (rows: any[]) =>
    request<{ success: boolean; message: string; report?: ImportReport }>('/import/feeders', {
      method: 'POST',
      body: JSON.stringify({ rows })
    }),

  importLoops: (rows: any[]) =>
    request<{ success: boolean; message: string; report?: ImportReport }>('/import/loops', {
      method: 'POST',
      body: JSON.stringify({ rows })
    }),

  // Phase 5: Reports & Export Data
  getReportData: (type: string, filters?: { fromDate?: string; toDate?: string; team?: string; substation?: string; feeder?: string; device_type?: string; status?: string }) => {
    const params = new URLSearchParams({ type });
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params.append(k, v);
      });
    }
    return request<{ success: boolean; type: string; total: number; data: any[] }>(`/reports/data?${params.toString()}`);
  },

  getLoopTopologyReport: (id: number | string) =>
    request<{ success: boolean; data: { loop: any; topologyPipeline: any; meta: any } }>(`/reports/loop-topology/${id}`),

  // Device Proposals & Operator Approvals
  checkDuplicateDevice: (data: { device_id?: string; name?: string; pole_number?: string; feeder_id?: number | string; substation_id?: number | string; latitude?: number; longitude?: number }) =>
    request<{
      success: boolean;
      is_duplicate: boolean;
      warning_message: string;
      matched_devices: any[];
      matched_proposals: any[];
    }>('/proposals/check-duplicate', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  createProposal: (data: {
    type: 'CREATE' | 'UPDATE' | 'LOCATION' | 'STATUS' | 'DELETE' | 'IMAGE';
    device_id?: number;
    target_device_id_str?: string;
    device_name?: string;
    proposed_data: any;
    reason?: string;
  }) =>
    request<{ success: boolean; message: string; data: any }>('/proposals', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  getProposals: (params?: { status?: string; type?: string; search?: string }) => {
    const cleanParams: Record<string, string> = {};
    if (params) {
      if (params.status) cleanParams.status = params.status;
      if (params.type) cleanParams.type = params.type;
      if (params.search) cleanParams.search = params.search;
    }
    const query = new URLSearchParams(cleanParams).toString();
    return request<{ success: boolean; data: any[] }>(`/proposals${query ? '?' + query : ''}`);
  },

  getMyProposals: (params?: { status?: string; type?: string; search?: string }) => {
    const cleanParams: Record<string, string> = {};
    if (params) {
      if (params.status) cleanParams.status = params.status;
      if (params.type) cleanParams.type = params.type;
      if (params.search) cleanParams.search = params.search;
    }
    const query = new URLSearchParams(cleanParams).toString();
    return request<{ success: boolean; data: any[] }>(`/proposals/my-proposals${query ? '?' + query : ''}`);
  },

  getProposal: (id: number | string) =>
    request<{ success: boolean; data: any }>(`/proposals/${id}`),

  reviewProposal: (id: number | string, data: { action: 'APPROVED' | 'REJECTED'; review_notes?: string }) =>
    request<{ success: boolean; message: string; data: any }>(`/proposals/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  resetAll: (verification_code: string) =>
    request<{ success: boolean; message: string; report?: any }>('/system/reset-all', {
      method: 'POST',
      body: JSON.stringify({ verification_code })
    }),

  getResetStats: () =>
    request<{ success: boolean; counts: { devices: number; work: number; feeders: number; stations: number; topology: number; loops: number; links: number } }>('/system/reset-stats'),

  // Phase 5: System Backups & Snapshot Restore for Admin
  getSystemBackups: () =>
    request<{ success: boolean; backups: SystemBackup[] }>('/system/backups'),

  getLatestBackup: () =>
    request<{ success: boolean; backup: SystemBackup | null; current_counts: any }>('/system/backups/latest'),

  createBackup: (data: { name?: string; notes?: string }) =>
    request<{ success: boolean; message: string; backup: SystemBackup }>('/system/backups', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  restoreLatestBackup: () =>
    request<{
      success: boolean;
      message: string;
      backup_id: number;
      backup_name: string;
      backup_created_at: string;
      counts_before: any;
      counts_after: any;
    }>('/system/backups/restore-latest', {
      method: 'POST',
      body: JSON.stringify({})
    }),

  restoreBackup: (id: number | string) =>
    request<{
      success: boolean;
      message: string;
      backup_id: number;
      backup_name: string;
      backup_created_at: string;
      counts_before: any;
      counts_after: any;
    }>(`/system/backups/${id}/restore`, {
      method: 'POST',
      body: JSON.stringify({})
    }),

  deleteBackup: (id: number | string) =>
    request<{ success: boolean; message: string }>(`/system/backups/${id}`, {
      method: 'DELETE'
    }),

  changePassword: (id: number, data: { old_password?: string; new_password: string }) =>
    request<{ success: boolean; message: string }>(`/password/change/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
};



