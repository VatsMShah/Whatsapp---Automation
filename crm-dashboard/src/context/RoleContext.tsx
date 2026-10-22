import React, { createContext, useContext, useState, useCallback } from 'react';
import { Employee } from '../types';

export type UserRole = 'admin' | 'employee';

interface RoleContextValue {
  role: UserRole;
  currentEmployee: Employee | null;
  setRole: (role: UserRole) => void;
  setCurrentEmployee: (emp: Employee | null) => void;
  switchToAdmin: () => void;
  switchToEmployee: (emp: Employee) => void;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRoleState] = useState<UserRole>(() => {
    return (localStorage.getItem('traket_role') as UserRole) || 'admin';
  });
  const [currentEmployee, setCurrentEmployeeState] = useState<Employee | null>(() => {
    try {
      const stored = localStorage.getItem('traket_current_employee');
      return stored ? JSON.parse(stored) : null;
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
    setRole('admin');
    setCurrentEmployee(null);
  }, [setRole, setCurrentEmployee]);

  const switchToEmployee = useCallback((emp: Employee) => {
    setRole('employee');
    setCurrentEmployee(emp);
  }, [setRole, setCurrentEmployee]);

  return (
    <RoleContext.Provider value={{ role, currentEmployee, setRole, setCurrentEmployee, switchToAdmin, switchToEmployee }}>
      {children}
    </RoleContext.Provider>
  );
};

export const useRole = (): RoleContextValue => {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used within RoleProvider');
  return ctx;
};
