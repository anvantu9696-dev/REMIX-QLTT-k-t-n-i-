import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { User } from '../types';

export const AdminUserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.getUsers();
      if (res.success) {
        setUsers(res.data);
      }
    } catch (e) {
      console.error('Failed to fetch users', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleUpdateStatus = async (id: number, status: 'ACTIVE' | 'PENDING' | 'REJECTED') => {
    try {
      await api.updateUserStatus(id, status);
      await fetchUsers(); // Refresh list
    } catch (e) {
      console.error('Failed to update status', e);
      alert('Lỗi cập nhật trạng thái');
    }
  };

  if (loading) return <div>Đang tải danh sách người dùng...</div>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Quản lý người dùng hệ thống</h2>
      <table className="min-w-full bg-white border">
        <thead>
          <tr>
            <th className="py-2 px-4 border">Tên</th>
            <th className="py-2 px-4 border">Email</th>
            <th className="py-2 px-4 border">Vai trò</th>
            <th className="py-2 px-4 border">Trạng thái</th>
            <th className="py-2 px-4 border">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user: any) => (
            <tr key={user.id}>
              <td className="py-2 px-4 border">{user.full_name}</td>
              <td className="py-2 px-4 border">{user.email}</td>
              <td className="py-2 px-4 border">{user.role || user.roles?.join(', ')}</td>
              <td className="py-2 px-4 border">{user.status}</td>
              <td className="py-2 px-4 border">
                {user.status !== 'ACTIVE' && (
                  <button onClick={() => handleUpdateStatus(user.id, 'ACTIVE')} className="bg-green-500 text-white px-2 py-1 rounded mr-2">Approve</button>
                )}
                {user.status !== 'REJECTED' && (
                  <button onClick={() => handleUpdateStatus(user.id, 'REJECTED')} className="bg-red-500 text-white px-2 py-1 rounded">Reject</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
