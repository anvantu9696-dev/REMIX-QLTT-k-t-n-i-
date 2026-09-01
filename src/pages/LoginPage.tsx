import React, { useState } from 'react';
import { Zap, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { login, registerUser } = useAuth();
  
  const [isLoginView, setIsLoginView] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      if (isLoginView) {
        const res = await login(email, password);
        if (res.success) {
          // App.tsx will automatically re-render when user is populated
        } else {
          setError(res.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại email và mật khẩu.');
        }
      } else {
        if (!fullName.trim()) {
          setError('Vui lòng nhập họ và tên');
          setLoading(false);
          return;
        }
        const res = await registerUser(email, password, fullName);
        if (res.success) {
          // Temporarily attach name for sync
          res.user.tmpFullName = fullName;
          // App.tsx will automatically re-render
        } else {
          setError(res.message || 'Đăng ký thất bại.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-blue-600 to-blue-800 -z-10" />
      <div className="absolute top-10 left-10 w-64 h-64 bg-white/10 rounded-full blur-3xl -z-10" />
      <div className="absolute top-20 right-20 w-96 h-96 bg-cyan-400/20 rounded-full blur-3xl -z-10" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-xl shadow-blue-900/20 border border-slate-100">
            <Zap className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-white tracking-tight">
          Hệ thống Quản lý Thiết bị
        </h2>
        <p className="mt-2 text-center text-sm text-blue-100">
          Lưới điện Thông minh & Giám sát SCADA
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-2xl sm:rounded-2xl sm:px-10 border border-slate-100 relative">
          
          <div className="flex mb-6 border-b border-slate-200">
            <button
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${isLoginView ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              onClick={() => { setIsLoginView(true); setError(null); }}
            >
              Đăng nhập
            </button>
            <button
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${!isLoginView ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              onClick={() => { setIsLoginView(false); setError(null); }}
            >
              Đăng ký
            </button>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {!isLoginView && (
              <div>
                <label className="block text-sm font-medium text-slate-700">Họ và tên</label>
                <div className="mt-1">
                  <input
                    type="text"
                    required={!isLoginView}
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    className="appearance-none block w-full px-4 py-3 border border-slate-300 rounded-xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                    placeholder="Nguyễn Văn A"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700">Email</label>
              <div className="mt-1">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border border-slate-300 rounded-xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                  placeholder="admin@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Mật khẩu</label>
              <div className="mt-1">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border border-slate-300 rounded-xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLoginView ? 'Đăng nhập' : 'Đăng ký')}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-slate-500">
                  Xác thực hệ thống
                </span>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-500 bg-slate-50 py-3 rounded-xl border border-slate-100">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              Bảo mật cấp độ Enterprise
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
