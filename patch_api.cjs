const fs = require('fs');
let code = fs.readFileSync('src/lib/api.ts', 'utf8');

const oldGetSubs = `  getSubstations: async (params?: { search?: string; status?: string }, options?: {forceRefresh?: boolean}) => {
    let url = \`/api/substations\`;
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.status) query.append('status', params.status);`;

const newGetSubs = `  getSubstations: async (params?: { search?: string; status?: string; limit?: number; lastDocId?: string }, options?: {forceRefresh?: boolean}) => {
    let url = \`/api/substations\`;
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.status) query.append('status', params.status);
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.lastDocId) query.append('lastDocId', params.lastDocId);`;

code = code.replace(oldGetSubs, newGetSubs);
fs.writeFileSync('src/lib/api.ts', code);
console.log('Patched api.ts');
