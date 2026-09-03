const fs = require('fs');
let code = fs.readFileSync('src/lib/api.ts', 'utf8');

const syncAuthStr = `  syncAuth: (data: { idToken: string; full_name?: string; photoURL?: string }) => 
    request<AuthSession & { success: boolean; message: string }>('/auth/sync', {
      method: 'POST',
      body: JSON.stringify(data)
    }),`;

if (code.includes(syncAuthStr)) {
  code = code.replace(syncAuthStr, syncAuthStr + `\n  logout: () =>\n    request<{ success: boolean; message: string }>('/auth/logout', { method: 'POST' }),`);
  fs.writeFileSync('src/lib/api.ts', code);
  console.log('Patched API logout');
} else {
  console.log('Could not find syncAuth string');
}
