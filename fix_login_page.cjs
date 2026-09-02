const fs = require('fs');
let content = fs.readFileSync('src/pages/LoginPage.tsx', 'utf8');

const importStr = "import { Zap, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';";
const replaceImportStr = "import { Zap, ShieldCheck, AlertCircle, Loader2, UserCircle } from 'lucide-react';";
content = content.replace(importStr, replaceImportStr);

const stateStr = "const [loading, setLoading] = useState(false);";
const replaceStateStr = "const [loading, setLoading] = useState(false);\n  const [guestLoading, setGuestLoading] = useState(false);";
content = content.replace(stateStr, replaceStateStr);

// We need to add handleGuestLogin
const funcStr = `  const handleSubmit = async (e: React.FormEvent) => {`;
const newFuncStr = `  const handleGuestLogin = async () => {
    setError(null);
    setGuestLoading(true);
    try {
      const res = await useAuth().guestLogin();
      if (!res.success) {
        setError(res.message || 'Đăng nhập khách thất bại');
      }
    } catch (err: any) {
      setError(err.message || 'Đăng nhập khách thất bại');
    } finally {
      setGuestLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {`;
  
// But wait, `useAuth` is already called at the top of the component: `const { login, registerUser, guestLogin } = useAuth();`
// Wait, `LoginPage` uses `const { login, registerUser } = useAuth();`
const destructureStr = "const { login, registerUser } = useAuth();";
const replaceDestructureStr = "const { login, registerUser, guestLogin } = useAuth();";
content = content.replace(destructureStr, replaceDestructureStr);

const funcStrUpdated = `  const handleGuestLogin = async () => {
    setError(null);
    setGuestLoading(true);
    try {
      const res = await guestLogin();
      if (!res.success) {
        setError(res.message || 'Đăng nhập khách thất bại');
      }
    } catch (err: any) {
      setError(err.message || 'Đăng nhập khách thất bại');
    } finally {
      setGuestLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {`;
content = content.replace(funcStr, funcStrUpdated);

const guestBtnStr = `          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-slate-500">
                  Xác thực hệ thống
                </span>
              </div>
            </div>`;

const replaceGuestBtnStr = `          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-slate-500">
                  Hoặc
                </span>
              </div>
            </div>
            
            <div className="mt-6">
              <button
                type="button"
                onClick={handleGuestLogin}
                disabled={guestLoading || loading}
                className="w-full flex items-center justify-center space-x-2 py-3 px-4 border border-slate-200 rounded-xl shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {guestLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <UserCircle className="w-5 h-5 text-slate-400" />
                    <span>Đăng nhập nhanh (Chế độ Khách)</span>
                  </>
                )}
              </button>
            </div>`;

content = content.replace(guestBtnStr, replaceGuestBtnStr);

fs.writeFileSync('src/pages/LoginPage.tsx', content);
