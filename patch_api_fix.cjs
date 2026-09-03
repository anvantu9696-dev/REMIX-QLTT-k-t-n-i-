const fs = require('fs');
let code = fs.readFileSync('src/lib/api.ts', 'utf8');

const oldGetSubs = "  getSubstations: (params?: { search?: string; status?: string }, options?: CustomRequestInit) => {\n    const query = new URLSearchParams(params as Record<string, string>).toString();\n    return request<{ success: boolean; data: any[] }>(`/substations${query ? '?' + query : ''}`, { cacheTtl: 86400, ...options });\n  },";

const newGetSubs = "  getSubstations: (params?: { search?: string; status?: string; limit?: number; lastDocId?: string }, options?: CustomRequestInit) => {\n    const validParams: any = {};\n    if (params) {\n       Object.keys(params).forEach(k => {\n           if ((params as any)[k] !== undefined) validParams[k] = (params as any)[k];\n       });\n    }\n    const query = new URLSearchParams(validParams).toString();\n    return request<{ success: boolean; data: any[], nextCursor?: string | null }>(`/substations\\${query ? '?' + query : ''}`, { cacheTtl: 86400, ...options });\n  },";

code = code.replace(oldGetSubs, newGetSubs);
fs.writeFileSync('src/lib/api.ts', code);
console.log('Patched api.ts getSubstations properly v2');
