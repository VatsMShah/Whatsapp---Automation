import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Employee } from '../types';
import { authService, AdminUserProfile } from '../services/auth';

export type UserRole = 'admin' | 'employee';

interface RoleContextValue {
  /** True only after server-verified JWT login or verify_session succeeds */
  isAuthenticated: boolean;
  /** True while verifying a stored JWT on initial page load */
  isAuthChecking: boolean;
  /** The real role signed inside the JWT ('admin' or 'employee') — immutable without re-login */
  authRole: UserRole | null;
  /** Active UI view role (admins may temporarily preview Employee View; employees are locked to 'employee') */
  role: UserRole;
  /** Authenticated admin profile when authRole === 'admin' */
  currentAdmin: AdminUserProfile | null;
  /** Authenticated employee (or admin previewing an employee) */
  currentEmployee: Employee | null;
  /** True when the server flagged must_change_password on the authenticated account */
  mustChangePassword: boolean;
  switchToAdmin: () => void;
  switchToEmployee: (emp: Employee) => void;
  loginAsAdmin: (
    identifier: string,
    password: string,
    rememberMe?: boolean
  ) => Promise<{ success: boolean; error?: string }>;
  loginAsEmployee: (
    empIdOrEmail: string,
    password: string,
    rememberMe?: boolean
  ) => Promise<{ success: boolean; error?: string }>;
  clearMustChangePassword: () => void;
  refreshSession: () => Promise<void>;
  logout: () => void;
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

export const RoleProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(() => Boolean(authService.getStoredToken()));
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authRole, setAuthRole] = useState<UserRole | null>(null);
  const [role, setRole] = useState<UserRole>('admin');
  const [currentAdmin, setCurrentAdmin] = useState<AdminUserProfile | null>(null);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(false);

  const applyVerifiedSession = useCallback(
    (verifiedRole: UserRole, user: AdminUserProfile | Employee) => {
      setIsAuthenticated(true);
      setAuthRole(verifiedRole);
      setRole(verifiedRole);
      if (verifiedRole === 'admin') {
        const admin = user as AdminUserProfile;
        setCurrentAdmin(admin);
        setCurrentEmployee(null);
        setMustChangePassword(Boolean(admin.must_change_password));
      } else {
        const emp = user as Employee;
        setCurrentAdmin(null);
        setCurrentEmployee(emp);
        setMustChangePassword(Boolean(emp.must_change_password));
      }
    },
    []
  );

  const refreshSession = useCallback(async () => {
    const token = authService.getStoredToken();
    if (!token) {
      setIsAuthenticated(false);
      setAuthRole(null);
      setCurrentAdmin(null);
      setCurrentEmployee(null);
      setMustChangePassword(false);
      setIsAuthChecking(false);
      return;
    }

    try {
      const res = await authService.verifySession();
      if (res.valid && res.role && res.user) {
        applyVerifiedSession(res.role, res.user);
      } else {
        setIsAuthenticated(false);
        setAuthRole(null);
        setCurrentAdmin(null);
        setCurrentEmployee(null);
        setMustChangePassword(false);
      }
    } finally {
      setIsAuthChecking(false);
    }
  }, [applyVerifiedSession]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  // Only a JWT-verified admin can switch between Admin HQ and Employee Preview Mode.
  const switchToAdmin = useCallback(() => {
    if (!isAuthenticated || authRole !== 'admin') return;
    setRole('admin');
    setCurrentEmployee(null);
  }, [isAuthenticated, authRole]);

  const switchToEmployee = useCallback(
    (emp: Employee) => {
      if (!isAuthenticated || authRole !== 'admin') return;
      setRole('employee');
      setCurrentEmployee(emp);
    },
    [isAuthenticated, authRole]
  );

  const loginAsAdmin = useCallback(
    async (
      identifier: string,
      password: string,
      rememberMe = false
    ): Promise<{ success: boolean; error?: string }> => {
      if (!identifier.trim() || !password) {
        return { success: false, error: 'Please enter both Admin email/username and password.' };
      }

      const res = await authService.loginAdmin(identifier, password, rememberMe);
      if (!res.success || !res.user) {
        return { success: false, error: res.error || 'Invalid administrator email or password.' };
      }

      applyVerifiedSession('admin', res.user);
      return { success: true };
    },
    [applyVerifiedSession]
  );

  const loginAsEmployee = useCallback(
    async (
      empIdOrEmail: string,
      password: string,
      rememberMe = false
    ): Promise<{ success: boolean; error?: string }> => {
      if (!empIdOrEmail.trim() || !password) {
        return { success: false, error: 'Please enter both your Employee ID/Email and password.' };
      }

      const res = await authService.loginEmployee(empIdOrEmail, password, rememberMe);
      if (!res.success || !res.user) {
        return { success: false, error: res.error || 'Invalid Employee ID/Email or password.' };
      }

      applyVerifiedSession('employee', res.user);
      return { success: true };
    },
    [applyVerifiedSession]
  );

  const clearMustChangePassword = useCallback(() => {
    setMustChangePassword(false);
    setCurrentAdmin((prev) => (prev ? { ...prev, must_change_password: false } : prev));
    setCurrentEmployee((prev) => (prev ? { ...prev, must_change_password: false } : prev));
  }, []);

  const logout = useCallback(() => {
    authService.clearStoredAuth();
    setIsAuthenticated(false);
    setAuthRole(null);
    setRole('admin');
    setCurrentAdmin(null);
    setCurrentEmployee(null);
    setMustChangePassword(false);
  }, []);

  return (
    <RoleContext.Provider
      value={{
        isAuthenticated,
        isAuthChecking,
        authRole,
        role,
        currentAdmin,
        currentEmployee,
        mustChangePassword,
        switchToAdmin,
        switchToEmployee,
        loginAsAdmin,
        loginAsEmployee,
        clearMustChangePassword,
        refreshSession,
        logout,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
};

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used inside <RoleProvider>');
  return ctx;
}
