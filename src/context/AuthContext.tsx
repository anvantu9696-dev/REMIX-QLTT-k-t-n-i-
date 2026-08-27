import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, RoleCode, ScopeType } from '../types';
import { api, setAuthToken } from '../lib/api';

interface AuthContextType {
  user: User | null;
  permissions: string[];
  isLoading: boolean;
  login: (u: string, p: string) => Promise<any>;
  guestLogin: () => Promise<any>;
  logout: () => void;
  hasPermission: (perm: string) => boolean;
  hasRole: (role: RoleCode) => boolean;
  isGuest: () => boolean;
  hasScope: (type: ScopeType) => boolean;
  simulatedRole: RoleCode | null;
  setSimulatedRole: (role: RoleCode | null) => void;
  isRealAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const rolePermissionsMap: Record<string, string[]> = {
  ADMIN: ['*'],
  CAN_BO_PHUONG_THUC: ['equipment:read', 'equipment:create', 'equipment:update', 'tasks:read', 'tasks:create', 'tasks:update', 'documents:read', 'documents:create', 'reports:read', 'audit:read', 'DEVICE_VIEW', 'GIS_VIEW', 'LOOP_VIEW', 'FEEDER_VIEW', 'SUBSTATION_VIEW', 'CHANGE_REQUEST_VIEW', 'proposals:read', 'proposals:review'],
  TRUONG_CA: ['equipment:read', 'equipment:update', 'tasks:read', 'tasks:create', 'tasks:update', 'documents:read', 'reports:read', 'DEVICE_VIEW', 'GIS_VIEW', 'LOOP_VIEW', 'FEEDER_VIEW', 'SUBSTATION_VIEW', 'CHANGE_REQUEST_VIEW', 'proposals:read', 'proposals:review'],
  PHO_CA: ['equipment:read', 'equipment:update', 'tasks:read', 'tasks:create', 'tasks:update', 'documents:read', 'reports:read', 'DEVICE_VIEW', 'GIS_VIEW', 'LOOP_VIEW', 'FEEDER_VIEW', 'SUBSTATION_VIEW', 'CHANGE_REQUEST_VIEW', 'proposals:read', 'proposals:review'],
  DOI_TRUONG: ['equipment:read', 'tasks:read', 'tasks:update', 'documents:read', 'reports:read', 'DEVICE_VIEW', 'GIS_VIEW', 'LOOP_VIEW', 'FEEDER_VIEW', 'SUBSTATION_VIEW', 'CHANGE_REQUEST_VIEW', 'proposals:create', 'proposals:read', 'proposals:review'],
  NHAN_VIEN_VAN_HANH: ['equipment:read', 'tasks:read', 'tasks:update', 'documents:read', 'reports:read', 'DEVICE_VIEW', 'GIS_VIEW', 'LOOP_VIEW', 'FEEDER_VIEW', 'SUBSTATION_VIEW', 'DEVICE_PROPOSE_CREATE', 'DEVICE_PROPOSE_UPDATE', 'DEVICE_PROPOSE_DELETE', 'DEVICE_IMAGE_UPLOAD', 'CHANGE_REQUEST_CREATE', 'CHANGE_REQUEST_VIEW', 'proposals:create', 'proposals:read'],
  FIELD_OPERATOR: ['equipment:read', 'tasks:read', 'tasks:create', 'tasks:update', 'documents:read', 'reports:read', 'DEVICE_VIEW', 'GIS_VIEW', 'LOOP_VIEW', 'FEEDER_VIEW', 'SUBSTATION_VIEW', 'DEVICE_PROPOSE_CREATE', 'DEVICE_PROPOSE_UPDATE', 'DEVICE_PROPOSE_DELETE', 'DEVICE_IMAGE_UPLOAD', 'CHANGE_REQUEST_CREATE', 'CHANGE_REQUEST_VIEW', 'proposals:create', 'proposals:read'],
  KHACH: ['equipment:read', 'documents:read', 'reports:read', 'tasks:read', 'DEVICE_VIEW', 'GIS_VIEW', 'LOOP_VIEW', 'FEEDER_VIEW', 'SUBSTATION_VIEW']
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [simulatedRole, setSimulatedRole] = useState<RoleCode | null>(null);

  useEffect(() => {
    checkCurrentAuth();
  }, []);

  const checkCurrentAuth = async () => {
    const token = localStorage.getItem('grid_auth_token');
    if (!token) {
      setUser(null);
      setPermissions([]);
      setIsLoading(false);
      return;
    }

    try {
      const res = await api.getMe();
      if (res.success && res.user) {
        setUser(res.user);
        setPermissions(res.permissions || []);
      } else {
        setUser(null);
        setPermissions([]);
      }
    } catch (err) {
      setUser(null);
      setPermissions([]);
      setAuthToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, p: string) => {
    const res = await api.login(username, p);
    if (res.success && res.token) {
      setAuthToken(res.token);
      setUser(res.user);
      setPermissions(res.permissions || []);
      setSimulatedRole(null);
    }
    return res;
  };

  const guestLogin = async () => {
    const res = await api.guestLogin();
    if (res.success && res.token) {
      setAuthToken(res.token);
      setUser(res.user);
      setPermissions(res.permissions || []);
      setSimulatedRole(null);
    }
    return res;
  };

  const logout = () => {
    setAuthToken(null);
    setUser(null);
    setPermissions([]);
    setSimulatedRole(null);
  };

  const isRealAdmin = user?.roles?.includes('ADMIN') || false;

  // Effective user for UI and checks
  const effectiveUser = React.useMemo(() => user ? {
    ...user,
    roles: simulatedRole ? [simulatedRole] : (user.roles || [])
  } : null, [user, simulatedRole]);

  const hasPermission = (perm: string): boolean => {
    if (!effectiveUser) return false;
    const currentRole = simulatedRole || (effectiveUser.roles?.[0]);
    if (currentRole === 'ADMIN') return true;
    if (effectiveUser.roles?.includes('ADMIN')) return true;

    const hasBase = permissions.includes(perm);
    const hasFallback = 
      (perm.endsWith(':import') && (permissions.includes('GRID_DATA_IMPORT') || permissions.includes(perm))) ||
      (perm.endsWith(':export') && (permissions.includes('reports:read') || permissions.includes('GRID_DATA_IMPORT') || permissions.includes(perm)));

    if (simulatedRole) {
      const allowed = rolePermissionsMap[simulatedRole] || [];
      if (allowed.includes('*') || allowed.includes(perm)) return true;
      if (perm.endsWith(':import') && (allowed.includes('GRID_DATA_IMPORT') || allowed.includes(perm))) return true;
      if (perm.endsWith(':export') && (allowed.includes('reports:read') || allowed.includes('GRID_DATA_IMPORT') || allowed.includes(perm))) return true;
      return false;
    }
    return hasBase || hasFallback;
  };

  const hasRole = (role: RoleCode): boolean => {
    if (!effectiveUser || !effectiveUser.roles) return false;
    if (simulatedRole) {
      return simulatedRole === role;
    }
    return effectiveUser.roles.includes(role);
  };

  const isGuest = (): boolean => {
    const currentRole = simulatedRole || (effectiveUser?.roles?.[0]);
    if (currentRole === 'KHACH') return true;
    if (!effectiveUser || !effectiveUser.roles) return false;
    return effectiveUser.roles.length === 1 && effectiveUser.roles[0] === 'KHACH';
  };

  const hasScope = (type: ScopeType): boolean => {
    if (!effectiveUser || !effectiveUser.scopes) return false;
    const currentRole = simulatedRole || (effectiveUser.roles?.[0]);
    if (currentRole === 'ADMIN') return true;
    return effectiveUser.scopes.some(s => s.scope_type === type || s.scope_type === 'SYSTEM');
  };

  return (
    <AuthContext.Provider
      value={{
        user: effectiveUser,
        permissions,
        isLoading,
        login,
        guestLogin,
        logout,
        hasPermission,
        hasRole,
        isGuest,
        hasScope,
        simulatedRole,
        setSimulatedRole,
        isRealAdmin
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
