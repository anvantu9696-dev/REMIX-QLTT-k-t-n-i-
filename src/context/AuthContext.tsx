import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, RoleCode } from '../types';
import { api, setAuthToken } from '../lib/api';
import { clearAllCache } from '../lib/idbCache';
import { auth, db } from '../lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut, onIdTokenChanged } from 'firebase/auth';


interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (u: string, p: string) => Promise<any>;
  registerUser: (email: string, p: string, fullName: string) => Promise<any>;
  logout: () => void;
  hasRole: (role: RoleCode) => boolean;
  isGuest: () => boolean;
  isRealAdmin: boolean;
  guestLogin: () => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      // Only set loading to true if we don't have a user yet (initial load)
      // If we already have a user, we perform the sync in the background without clearing the UI.
      if (!user) setIsLoading(true);

      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          setAuthToken(idToken);
          
          const fullName = (firebaseUser as any).tmpFullName || firebaseUser.displayName || '';
          const res = await api.syncAuth({
            idToken,
            full_name: fullName,
            photoURL: firebaseUser.photoURL || ''
          });
          
          if (res.success && res.user) {
             const data = res.user;
             const mappedUser: User = {
                id: (data as any).uid || data.id || firebaseUser.uid,
                username: data.username || firebaseUser.email,
                employee_code: data.employee_code || '',
                full_name: data.full_name || firebaseUser.displayName || '',
                email: data.email || firebaseUser.email,
                unit: data.unit || '',
                team: data.team || '',
                title: data.title || '',
                status: data.status || 'ACTIVE',
                roles: (data as any).roles || ((data as any).role ? [(data as any).role] : []),
                phone: data.phone || '',
                created_at: (data as any).createdAt || data.created_at || new Date().toISOString(),
                updated_at: (data as any).updatedAt || data.updated_at || new Date().toISOString(),
              };
              setUser(mappedUser);
          } else {
             setUser(null);
             if (res.message) {
                console.warn('Sync failed:', res.message);
                if ( (res as any).errorType === 'USER_DISABLED' || (res as any).errorType === 'USER_LOCKED') {
                    await signOut(auth);
                    setAuthToken(null);
                    clearAllCache();
                }
             }
          }
        } catch (error: any) {
          console.error("Error fetching user profile:", error);
          setUser(null);
          setAuthToken(null);
          if (error.data && ['USER_DISABLED', 'USER_LOCKED'].includes((error.data as any).errorType)) {
             await signOut(auth);
          }
        }
      } else {
        setUser(null);
        setAuthToken(null);
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleAuthExpired = () => {
      setUser(null);
      setAuthToken(null);
    };
    window.addEventListener('grid_auth_expired', handleAuthExpired);
    return () => window.removeEventListener('grid_auth_expired', handleAuthExpired);
  }, []);

  const login = async (email: string, p: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, p);
      return { success: true, user: userCredential.user };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  };
  
  const registerUser = async (email: string, p: string, fullName: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, p);
      await updateProfile(userCredential.user, { displayName: fullName }).catch(console.error);
      return { success: true, user: userCredential.user, fullName };
    } catch (error: any) {
      let msg = error.message;
      if (error.code === 'auth/email-already-in-use') {
        msg = 'Email này đã được sử dụng';
      }
      return { success: false, message: msg };
    }
  };

  const guestLogin = async () => {
    try {
      // Fetch credentials securely from the backend to avoid exposing in client code
      const response = await api.getGuestConfig();
      if (response.success && response.email && response.password) {
        const userCredential = await signInWithEmailAndPassword(auth, response.email, response.password);
        return { success: true, user: userCredential.user };
      } else {
        return { success: false, message: 'Đăng nhập khách không khả dụng.' };
      }
    } catch (error: any) {
      console.error('Guest login failed:', error);
      return { success: false, message: 'Đăng nhập khách không khả dụng. Vui lòng liên hệ quản trị viên.' };
    }
  };

  const logout = async () => {
    try { await api.logout(); } catch(e) {}
    await signOut(auth);
    setAuthToken(null);
    setUser(null);
  };

  const isRealAdmin = user?.roles?.includes('ADMIN') || false;

  const hasRole = (role: RoleCode): boolean => {
    if (!user || !user.roles) return false;
    return user.roles.includes(role) || user.roles.includes('ADMIN');
  };

  const isGuest = (): boolean => {
    if (!user || !user.roles) return false;
    return user.roles.includes('VIEWER') || user.roles.includes('KHACH' as any);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        registerUser,
        guestLogin,
        logout,
        hasRole,
        isGuest,
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
