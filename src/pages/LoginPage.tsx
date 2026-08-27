import React, { useState } from 'react';
import { 
  Zap, 
  Lock, 
  User as UserIcon, 
  ShieldCheck, 
  AlertCircle, 
  KeyRound, 
  CheckCircle2, 
  UserPlus, 
  Building2, 
  Phone, 
  Mail, 
  ArrowLeft,
  Users
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

export const LoginPage: React.FC = () => {
  const { login, guestLogin } = useAuth();
  
  // Auth view mode: 'login' | 'register'
  const [viewMode, setViewMode] = useState<'login' | 'register'>('login');

  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);

  // Register form state
  const [regFullName, setRegFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regUnit, setRegUnit] = useState('Công ty Điện lực Hà Nội');
  const [regTeam, setRegTeam] = useState('Đội Vận hành Lưới điện');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<string | null>(null);

  // Forgot password modal state
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotInput, setForgotInput] = useState('');
  const [forgotMsg, setForgotMsg] = useState<string | null>(null);
  const [forgotErr, setForgotErr] = useState<string | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Vui lòng nhập Tên đăng nhập và Mật khẩu.');
      return;
    }

    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await login(username, password);
      if (res?.user?.roles?.includes('KHACH')) {
        setSuccessMsg('Đăng nhập thành công với quyền KHÁCH - CHỈ XEM.');
      } else {
        setSuccessMsg('Đăng nhập thành công.');
      }
    } catch (err: any) {
      setError(err.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setRegSuccess(null);

    // Client-side validations
    if (!regFullName.trim()) {
      setRegError('Vui lòng nhập Họ và tên.');
      return;
    }
    if (!regUsername.trim()) {
      setRegError('Vui lòng nhập Tên đăng nhập.');
      return;
    }
    if (regUsername.trim().length < 3) {
      setRegError('Tên đăng nhập phải có tối thiểu 3 ký tự.');
      return;
    }
    if (!regEmail.trim()) {
      setRegError('Vui lòng nhập Email.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(regEmail.trim())) {
      setRegError('Email không đúng định dạng.');
      return;
    }
    if (!regUnit.trim()) {
      setRegError('Vui lòng chọn hoặc nhập Đơn vị công tác.');
      return;
    }
    if (!regPassword) {
      setRegError('Vui lòng nhập Mật khẩu.');
      return;
    }
    if (regPassword.length < 6) {
      setRegError('Mật khẩu phải có độ dài tối thiểu 6 ký tự.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setRegError('Mật khẩu và Xác nhận mật khẩu không khớp.');
      return;
    }

    setRegLoading(true);
    try {
      const res = await api.register({
        full_name: regFullName.trim(),
        username: regUsername.trim(),
        email: regEmail.trim(),
        phone: regPhone.trim(),
        unit: regUnit.trim(),
        team: regTeam.trim(),
        password: regPassword,
        confirmPassword: regConfirmPassword
      });

      setRegSuccess(res.message || 'Đăng ký tài khoản thành công! Tài khoản đang ở trạng thái CHỜ DUYỆT.');
      
      // Pre-fill username in login form and switch to login tab after 2.5s
      setTimeout(() => {
        setUsername(regUsername.trim());
        setPassword('');
        setViewMode('login');
        setSuccessMsg('Tài khoản đã tạo thành công và đang chờ Quản trị viên phê duyệt kích hoạt.');
      }, 2500);
    } catch (err: any) {
      setRegError(err.message || 'Không thể tạo tài khoản. Vui lòng thử lại.');
    } finally {
      setRegLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotInput) return;
    setForgotLoading(true);
    setForgotErr(null);
    setForgotMsg(null);

    try {
      const res = await api.forgotPassword(forgotInput);
      setForgotMsg(res.message);
    } catch (err: any) {
      setForgotErr(err.message || 'Gửi yêu cầu thất bại');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 font-sans relative overflow-hidden">
      {/* Dynamic Background Pattern */}
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px]" />

      <div className="w-full max-w-4xl z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Side Branding */}
        <div className="lg:col-span-5 text-white text-center lg:text-left space-y-4">
          <div className="inline-flex items-center space-x-3 bg-blue-600/20 text-cyan-300 border border-cyan-500/30 px-3 py-1.5 rounded-full text-xs font-semibold">
            <Zap className="w-4 h-4 fill-cyan-400" />
            <span>TẬP ĐOÀN ĐIỆN LỰC VIỆT NAM</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            QUẢN LÝ THIẾT BỊ
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            Hệ thống Quản lý Thiết bị — Nền tảng Database, Đăng ký Tài khoản, Phân quyền RBAC & Scope.
          </p>
          <div className="pt-2 flex flex-wrap gap-2 text-xs text-slate-400 justify-center lg:justify-start">
            <span className="bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700">✓ Đăng ký & Tự kích hoạt</span>
            <span className="bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700">✓ RBAC 7 Nhóm Quyền</span>
            <span className="bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700">✓ Scope 5 Cấp</span>
            <span className="bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700">✓ Audit Log Tự động</span>
          </div>
        </div>

        {/* Right Side Form Card */}
        <div className="lg:col-span-7 bg-white rounded-2xl shadow-2xl p-6 sm:p-8 border border-slate-200">
          {/* Tabs header */}
          <div className="flex border-b border-slate-200 mb-6">
            <button
              type="button"
              onClick={() => {
                setViewMode('login');
                setError(null);
                setRegError(null);
              }}
              className={`flex-1 pb-3 text-xs font-bold text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                viewMode === 'login'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              ĐĂNG NHẬP
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('register');
                setError(null);
                setRegError(null);
              }}
              className={`flex-1 pb-3 text-xs font-bold text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                viewMode === 'register'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              ĐĂNG KÝ TÀI KHOẢN
            </button>
          </div>

          {/* ===================== VIEW 1: LOGIN ===================== */}
          {viewMode === 'login' ? (
            <div>
              <div className="mb-5">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-6 h-6 text-blue-600" />
                  Đăng nhập Hệ thống
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Nhập Tên đăng nhập / Email và Mật khẩu để tiếp tục.
                </p>
              </div>

              {error && (
                <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {successMsg && (
                <div className="mb-5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tên đăng nhập / Email / Mã NV <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Ví dụ: admin, cb_phuongthuc, truongca_a"
                      className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mật khẩu <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all font-medium"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <button
                    type="button"
                    onClick={() => setForgotOpen(true)}
                    className="text-blue-600 hover:text-blue-800 font-semibold hover:underline flex items-center gap-1"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    [Quên mật khẩu]
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('register');
                      setError(null);
                      setSuccessMsg(null);
                    }}
                    className="text-blue-600 hover:text-blue-800 font-semibold hover:underline flex items-center gap-1"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    [Đăng ký tài khoản]
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading || guestLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-3 rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center space-x-2"
                >
                  {loading ? (
                    <span>Đang xác thực...</span>
                  ) : (
                    <>
                      <span>[ĐĂNG NHẬP]</span>
                      <Zap className="w-4 h-4 fill-white" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-4 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  disabled={loading || guestLoading}
                  onClick={async () => {
                    setError(null);
                    setSuccessMsg(null);
                    setGuestLoading(true);
                    try {
                      const res = await guestLogin();
                      if (res.success) {
                        setSuccessMsg('Đăng nhập thành công với tư cách KHÁCH - CHỈ XEM.');
                      }
                    } catch (err: any) {
                      setError(err.message || 'Không thể đăng nhập khách');
                    } finally {
                      setGuestLoading(false);
                    }
                  }}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs py-3 rounded-xl border border-slate-300 transition-all flex items-center justify-center space-x-2 shadow-sm"
                >
                  {guestLoading ? (
                    <span>Đang kết nối chế độ Khách...</span>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>[ĐĂNG NHẬP NHANH - KHÁCH XEM]</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* ===================== VIEW 2: REGISTER ===================== */
            <div>
              <div className="mb-4">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <UserPlus className="w-6 h-6 text-blue-600" />
                  Đăng ký Tài khoản Mới
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Đăng ký tài khoản nhân sự EVN. Sau khi đăng ký, tài khoản sẽ ở trạng thái <span className="font-semibold text-amber-600">Chờ Quản trị viên duyệt</span>.
                </p>
              </div>

              {regError && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <span>{regError}</span>
                </div>
              )}

              {regSuccess && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold">{regSuccess}</p>
                    <p className="text-[11px] mt-1 text-emerald-700">Hệ thống đang tự động chuyển về màn hình Đăng nhập...</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Họ và tên <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <UserIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={regFullName}
                        onChange={(e) => setRegFullName(e.target.value)}
                        placeholder="Ví dụ: Nguyễn Văn An"
                        required
                        className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tên đăng nhập <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <UserIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                        placeholder="Ví dụ: nvan_hn"
                        required
                        className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-medium"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Email công tác <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="an.nguyen@evnhanoi.vn"
                        required
                        className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Số điện thoại
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="tel"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="0912345678"
                        className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-medium"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Đơn vị <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={regUnit}
                        onChange={(e) => setRegUnit(e.target.value)}
                        placeholder="Công ty Điện lực..."
                        required
                        className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Đội / Tổ / Nhóm
                    </label>
                    <div className="relative">
                      <Users className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={regTeam}
                        onChange={(e) => setRegTeam(e.target.value)}
                        placeholder="Đội Vận hành Lưới điện..."
                        className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-medium"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Mật khẩu <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="password"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Tối thiểu 6 ký tự"
                        required
                        className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Xác nhận mật khẩu <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="password"
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        placeholder="Nhập lại mật khẩu"
                        required
                        className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-medium"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('login');
                      setRegError(null);
                      setRegSuccess(null);
                    }}
                    className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    [Quay lại đăng nhập]
                  </button>

                  <button
                    type="submit"
                    disabled={regLoading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center space-x-2"
                  >
                    {regLoading ? (
                      <span>Đang xử lý đăng ký...</span>
                    ) : (
                      <>
                        <span>[ĐĂNG KÝ]</span>
                        <UserPlus className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Forgot Password Modal */}
      {forgotOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-blue-600" />
              Yêu cầu Khôi phục Mật khẩu
            </h3>
            <p className="text-xs text-slate-600">
              Nhập Username hoặc Email tài khoản của bạn để gửi yêu cầu đặt lại mật khẩu tới Admin.
            </p>

            {forgotMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <span>{forgotMsg}</span>
              </div>
            )}

            {forgotErr && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
                {forgotErr}
              </div>
            )}

            {!forgotMsg && (
              <form onSubmit={handleForgotSubmit} className="space-y-3">
                <input
                  type="text"
                  value={forgotInput}
                  onChange={(e) => setForgotInput(e.target.value)}
                  placeholder="Nhập Username hoặc Email"
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotOpen(false);
                      setForgotMsg(null);
                      setForgotErr(null);
                    }}
                    className="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md"
                  >
                    {forgotLoading ? 'Đang gửi...' : 'Gửi yêu cầu'}
                  </button>
                </div>
              </form>
            )}

            {forgotMsg && (
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => {
                    setForgotOpen(false);
                    setForgotMsg(null);
                  }}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl"
                >
                  Đóng
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
