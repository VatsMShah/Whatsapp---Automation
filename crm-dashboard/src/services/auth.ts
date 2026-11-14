import { Employee } from '../types';

const AUTH_URL =
  import.meta.env.VITE_AUTH_URL || 'http://localhost:3005/api/auth';

export interface AdminUserProfile {
  id: string;
  username: string;
  email: string;
  name: string;
  phone?: string;
  role: 'admin';
  must_change_password?: boolean;
}

export interface AuthResponse<T = unknown> {
  success?: boolean;
  valid?: boolean;
  error?: string;
  message?: string;
  token?: string;
  expiresAt?: string;
  role?: 'admin' | 'employee';
  user?: T;
  employees?: Employee[];
  employee?: Employee;
}

const TOKEN_STORAGE_KEY = 'traket_jwt';
const LEGACY_KEYS = [
  'traket_authenticated',
  'traket_role',
  'traket_emp_id',
  'traket_employee_json',
  'traket_employees',
];

function getAuthEndpoint(): string {
  return AUTH_URL.replace(/\/$/, '');
}

export function clearLegacyAuthStorage(): void {
  for (const key of LEGACY_KEYS) {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch {}
  }
}

export function getStoredToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY) || localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveStoredToken(token: string, rememberMe: boolean): void {
  clearLegacyAuthStorage();
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    if (rememberMe) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    }
  } catch {}
}

export function clearStoredAuth(): void {
  clearLegacyAuthStorage();
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {}
}

async function callAuth<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {}
): Promise<{ status: number; data: AuthResponse<T> }> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['x-traket-token'] = token;
  }

  let res: Response;
  try {
    res = await fetch(getAuthEndpoint(), {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, ...payload }),
    });
  } catch {
    return {
      status: 0,
      data: {
        success: false,
        error:
          'Unable to reach the local auth server at http://localhost:3005. Make sure "npm run dev" is running in the project root.',
      },
    };
  }

  if (res.status === 404) {
    return {
      status: 404,
      data: {
        success: false,
        error:
          'Local /api/auth endpoint was not found on port 3005. Restart "npm run dev" in the project root.',
      },
    };
  }

  let parsed: AuthResponse<T> = {};
  try {
    parsed = (await res.json()) as AuthResponse<T>;
  } catch {
    parsed = {
      success: false,
      error: res.ok ? 'Invalid server response.' : `Authentication error (HTTP ${res.status}).`,
    };
  }

  return { status: res.status, data: parsed };
}

export const authService = {
  getStoredToken,
  saveStoredToken,
  clearStoredAuth,

  async checkHealth(): Promise<{ online: boolean; configured: boolean; latencyMs: number | null }> {
    const start = performance.now();
    try {
      const res = await fetch(getAuthEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'health' }),
      });
      const latencyMs = Math.round(performance.now() - start);
      if (!res.ok) {
        return { online: false, configured: false, latencyMs: null };
      }
      const json = (await res.json().catch(() => ({}))) as { configured?: boolean };
      return { online: true, configured: json?.configured !== false, latencyMs };
    } catch {
      return { online: false, configured: false, latencyMs: null };
    }
  },

  async loginAdmin(
    identifier: string,
    password: string,
    rememberMe: boolean
  ): Promise<{
    success: boolean;
    error?: string;
    token?: string;
    user?: AdminUserProfile;
  }> {
    const { data } = await callAuth<AdminUserProfile>('login_admin', {
      identifier: identifier.trim(),
      password,
      rememberMe,
    });

    if (!data.success || !data.token || !data.user) {
      return { success: false, error: data.error || 'Invalid administrator email or password.' };
    }

    saveStoredToken(data.token, rememberMe);
    return {
      success: true,
      token: data.token,
      user: data.user,
    };
  },

  async loginEmployee(
    identifier: string,
    password: string,
    rememberMe: boolean
  ): Promise<{
    success: boolean;
    error?: string;
    token?: string;
    user?: Employee;
  }> {
    const { data } = await callAuth<Employee>('login_employee', {
      identifier: identifier.trim(),
      password,
      rememberMe,
    });

    if (!data.success || !data.token || !data.user) {
      return { success: false, error: data.error || 'Invalid Employee ID/Email or password.' };
    }

    saveStoredToken(data.token, rememberMe);
    return {
      success: true,
      token: data.token,
      user: data.user,
    };
  },

  async refreshToken(): Promise<boolean> {
    const token = getStoredToken();
    if (!token) return false;
    const { status, data } = await callAuth<AdminUserProfile | Employee>('refresh_token');
    if (status === 200 && data.success && data.token) {
      const isRemembered = Boolean(localStorage.getItem(TOKEN_STORAGE_KEY));
      saveStoredToken(data.token, isRemembered);
      return true;
    }
    return false;
  },

  async verifySession(): Promise<{
    valid: boolean;
    role?: 'admin' | 'employee';
    user?: AdminUserProfile | Employee;
  }> {
    const token = getStoredToken();
    if (!token) {
      clearLegacyAuthStorage();
      return { valid: false };
    }

    const { status, data } = await callAuth<AdminUserProfile | Employee>('verify_session');
    if (status === 401 || status === 403 || !data.valid || !data.role || !data.user) {
      if (status === 401 || status === 403 || data.valid === false) {
        clearStoredAuth();
      }
      return { valid: false };
    }

    // Auto-refresh token in background so active users never experience abrupt session drop
    try {
      this.refreshToken().catch(() => {});
    } catch {}

    return {
      valid: true,
      role: data.role,
      user: data.user,
    };
  },

  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    const { data } = await callAuth('change_password', {
      currentPassword,
      newPassword,
    });
    if (!data.success) {
      return { success: false, error: data.error || 'Failed to update password.' };
    }
    return { success: true };
  },

  async requestPasswordReset(
    portal: 'admin' | 'employee',
    identifier: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    const { data } = await callAuth('request_password_reset', {
      portal,
      identifier: identifier.trim(),
    });
    if (!data.success) {
      return { success: false, error: data.error || 'Could not initiate password reset.' };
    }
    return {
      success: true,
      message:
        data.message ||
        'If an active account with a registered WhatsApp number matches, a 6-digit verification code has been sent.',
    };
  },

  async confirmPasswordReset(
    portal: 'admin' | 'employee',
    identifier: string,
    otp: string,
    newPassword: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    const { data } = await callAuth('confirm_password_reset', {
      portal,
      identifier: identifier.trim(),
      otp: otp.trim(),
      newPassword,
    });
    if (!data.success) {
      return { success: false, error: data.error || 'Password reset failed.' };
    }
    return {
      success: true,
      message: data.message || 'Password updated! You can now sign in with your new password.',
    };
  },

  async getEmployees(): Promise<{ success: boolean; employees: Employee[]; error?: string }> {
    const { data } = await callAuth('get_employees');
    if (!data.success) {
      return { success: false, employees: [], error: data.error };
    }
    return {
      success: true,
      employees: Array.isArray(data.employees) ? data.employees : [],
    };
  },

  async upsertEmployee(
    employee: Omit<Employee, 'id' | 'created_at'>
  ): Promise<{ success: boolean; employee?: Employee; error?: string }> {
    const { data } = await callAuth('upsert_employee', { employee });
    if (!data.success || !data.employee) {
      return { success: false, error: data.error || 'Failed to save employee.' };
    }
    return { success: true, employee: data.employee };
  },

  async deactivateEmployee(employeeId: string): Promise<{ success: boolean; error?: string }> {
    const { data } = await callAuth('deactivate_employee', { employeeId });
    if (!data.success) {
      return { success: false, error: data.error || 'Failed to deactivate employee.' };
    }
    return { success: true };
  },
};
