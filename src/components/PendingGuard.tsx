import React from 'react';
import { useAuth } from '../context/AuthContext';

export const PendingGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();

  if (user?.status === 'PENDING') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded shadow max-w-md text-center">
          <h2 className="text-xl font-bold text-yellow-600 mb-4">Tài khoản chờ phê duyệt</h2>
          <p className="text-gray-600 mb-6">Tài khoản của bạn đang chờ Quản trị viên duyệt. Vui lòng quay lại sau.</p>
          <button onClick={logout} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Đăng xuất</button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
