const fs = require('fs');

let apiCode = fs.readFileSync('src/lib/api.ts', 'utf8');
if (!apiCode.includes('logout: () =>')) {
    apiCode = apiCode.replace(/syncAuth: \(data: any\) =>(.*?)(\n)(.*?)\},/g, 'syncAuth: (data: any) =>$1$2$3},\n  logout: () => request<{ success: boolean; message: string }>(\'/auth/logout\', { method: \'POST\' }),');
    fs.writeFileSync('src/lib/api.ts', apiCode);
    console.log('Patched api.ts with logout');
}

let ctxCode = fs.readFileSync('src/context/AuthContext.tsx', 'utf8');
ctxCode = ctxCode.replace(/const logout = async \(\) => \{\n\s*await signOut\(auth\);\n\s*setAuthToken\(null\);\n\s*setUser\(null\);\n\s*\};/, 
  `const logout = async () => {
    try { await api.logout(); } catch(e) {}
    await signOut(auth);
    setAuthToken(null);
    setUser(null);
  };`);
fs.writeFileSync('src/context/AuthContext.tsx', ctxCode);
console.log('Patched AuthContext logout');

