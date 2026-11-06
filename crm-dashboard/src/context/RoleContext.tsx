import React, { createContext, useContext, useState, useCallback } from 'react';
import { Employee } from '../types';

export type UserRole = 'admin' | 'employee';

export interface AuthSession {
  isAuthenticated: boolean;
  role: UserRole;
  employee: Employee | null;
  userEmail?: string;
  userName?: string;
}

interface RoleContextValue {
  isAuthenticated: boolean;
  role: UserRole;
  currentEmployee: Employee | null;
  setRole: (role: UserRole) => void;
  setCurrentEmployee: (emp: Employee | null) => void;
  switchToAdmin: () => void;
  switchToEmployee: (emp: Employee) => void;
  loginAsAdmin: (usernameOrEmail: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginAsEmployee: (identifier: string, password: string, allEmployees: Employee[]) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Authentication session state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('traket_authenticated');
      return stored === 'true';
    } catch {
      return false;
    }
  });

  const [role, setRoleState] = useState<UserRole>(() => {
    try {
      return (localStorage.getItem('traket_role') as UserRole) || 'admin';
    } catch {
      return 'admin';
    }
  });

  const [currentEmployee, setCurrentEmployeeState] = useState<Employee | null>(() => {
    try {
      const stored = localStorage.getItem('traket_current_employee');
      if (stored) {
        return JSON.parse(stored) as Employee;
      }
      return null;
    } catch {
      return null;
    }
  });

  const setRole = useCallback((r: UserRole) => {
    setRoleState(r);
    localStorage.setItem('traket_role', r);
  }, []);

  const setCurrentEmployee = useCallback((emp: Employee | null) => {
    setCurrentEmployeeState(emp);
    if (emp) {
      localStorage.setItem('traket_current_employee', JSON.stringify(emp));
    } else {
      localStorage.removeItem('traket_current_employee');
    }
  }, []);

  const switchToAdmin = useCallback(() => {
    setRoleState('admin');
    setCurrentEmployeeState(null);
    localStorage.setItem('traket_role', 'admin');
    localStorage.removeItem('traket_current_employee');
  }, []);

  const switchToEmployee = useCallback((emp: Employee) => {
    setRoleState('employee');
    setCurrentEmployeeState(emp);
    localStorage.setItem('traket_role', 'employee');
    localStorage.setItem('traket_current_employee', JSON.stringify(emp));
  }, []);

  // Login as Admin
  const loginAsAdmin = useCallback(async (usernameOrEmail: string, password: string) => {
    const cleanId = usernameOrEmail.toLowerCase().trim();
    const cleanPass = password.trim();

    // Accepted Admin usernames and passwords
    const validUsernames = ['admin', 'admin@traket.in', 'dispatch@traket.in', 'manager@traket.in', 'vatsal@traket.in'];
    const validPasswords = ['admin123', 'admin', 'traket2026', 'traket@123', 'Tk#admin2026', 'traket123'];

    const isUsernameMatch = validUsernames.includes(cleanId) || cleanId.startsWith('admin');
    const isPasswordMatch = validPasswords.includes(cleanPass) || cleanPass === 'admin123' || cleanPass === 'admin';

    if (!isUsernameMatch) {
      return {
        success: false,
        error: 'Invalid admin username or email. Please use admin@traket.in or admin.',
      };
    }

    if (!isPasswordMatch) {
      return {
        success: false,
        error: 'Incorrect admin password. (Hint: default is admin123)',
      };
    }

    setIsAuthenticated(true);
    setRoleState('admin');
    setCurrentEmployeeState(null);

    localStorage.setItem('traket_authenticated', 'true');
    localStorage.setItem('traket_role', 'admin');
    localStorage.removeItem('traket_current_employee');

    return { success: true };
  }, []);

  // Login as Employee
  const loginAsEmployee = useCallback(
    async (identifier: string, password: string, allEmployees: Employee[]) => {
      const cleanId = identifier.toLowerCase().trim();
      const cleanPass = password.trim();

      // Find employee by employee_id or email or name
      const match = allEmployees.find((e) => {
        const idMatch = e.employee_id?.toLowerCase().trim() === cleanId;
        const emailMatch = e.email && e.email.toLowerCase().trim() === cleanId;
        const nameMatch = e.name && e.name.toLowerCase().trim() === cleanId;
        return idMatch || emailMatch || nameMatch;
      });

      if (!match) {
        return {
          success: false,
          error: `No employee found with ID or Email "${identifier}". Please check with your Admin.`,
        };
      }

      if (!match.is_active) {
        return {
          success: false,
          error: `Account for ${match.name} (${match.employee_id}) is currently deactivated. Please contact your dispatch Admin.`,
        };
      }

      // If employee has a password set, verify it
      if (match.password && match.password.trim() !== '') {
        if (match.password.trim() !== cleanPass) {
          return {
            success: false,
            error: `Incorrect password for ${match.name} (${match.employee_id}).`,
          };
        }
      }

      setIsAuthenticated(true);
      setRoleState('employee');
      setCurrentEmployeeState(match);

      localStorage.setItem('traket_authenticated', 'true');
      localStorage.setItem('traket_role', 'employee');
      localStorage.setItem('traket_current_employee', JSON.stringify(match));

      return { success: true };
    },
    []
  );

  // Logout from CRM
  const logout = useCallback(() => {
    setIsAuthenticated(false);
    localStorage.removeItem('traket_authenticated');
    localStorage.removeItem('traket_current_employee');
    setRoleState('admin');
    setCurrentEmployeeState(null);
  }, []);

  return (
    <RoleContext.Provider
      value={{
        isAuthenticated,
        role,
        currentEmployee,
        setRole,
        setCurrentEmployee,
        switchToAdmin,
        switchToEmployee,
        loginAsAdmin,
        loginAsEmployee,
        logout,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
};

export const useRole = (): RoleContextValue => {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used within RoleProvider');
  return ctx;
};
