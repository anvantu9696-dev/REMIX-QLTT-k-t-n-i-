const fs = require('fs');

let api = fs.readFileSync('src/lib/api.ts', 'utf8');

api = api.replace(
  /getTasks: \(params\?: \{ search\?: string; status\?: string; priority\?: string; device_id\?: string \| number; team\?: string; assigned_to\?: string \| number; archived\?: 'true' \| 'false' \| 'only' \| 'all' \| boolean \| string \}\) => \{/,
  "getTasks: (params?: { search?: string; status?: string; priority?: string; device_id?: string | number; team?: string; assigned_to?: string | number; archived?: 'true' | 'false' | 'only' | 'all' | boolean | string; limit?: number; lastDocId?: string }) => {"
);

api = api.replace(
  /getMyTasks: \(params\?: \{ search\?: string; status\?: string; priority\?: string; archived\?: 'true' \| 'false' \| 'only' \| 'all' \| boolean \| string \}\) => \{/,
  "getMyTasks: (params?: { search?: string; status?: string; priority?: string; archived?: 'true' | 'false' | 'only' | 'all' | boolean | string; limit?: number; lastDocId?: string }) => {"
);

api = api.replace(
  /getIssues: \(params\?: \{ search\?: string; status\?: string; severity\?: string; device_id\?: string \| number \}\) => \{/,
  "getIssues: (params?: { search?: string; status?: string; severity?: string; device_id?: string | number; limit?: number; lastDocId?: string }) => {"
);

api = api.replace(
  /getSchedules: \(\) =>\n    request<\{ success: boolean; data: any\[\] \}>\('\/schedules'\),/,
  "getSchedules: (params?: { limit?: number; lastDocId?: string; device_id?: string | number; target_type?: string }) => {\n    const query = new URLSearchParams(params as Record<string, string>).toString();\n    return request<{ success: boolean; data: any[]; nextCursor?: string }>(`/schedules${query ? '?' + query : ''}`);\n  },"
);

api = api.replace(
  /getProposals: \(params\?: \{ status\?: string; type\?: string; search\?: string \}\) => \{/,
  "getProposals: (params?: { status?: string; type?: string; search?: string; limit?: number; lastDocId?: string }) => {"
);

fs.writeFileSync('src/lib/api.ts', api);
