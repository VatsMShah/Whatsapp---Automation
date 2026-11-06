import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  UserCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Truck,
  ArrowRight,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Phone,
  Hash,
  Key,
  Layers,
  Zap,
  Radio,
  Clock,
  Shield,
  HelpCircle,
} from 'lucide-react';
import { Employee } from '../../types';

interface LoginPageProps {
  employees: Employee[];
  onLoginAdmin: (usernameOrEmail: string, password: string) => Promise<{ success: boolean; error?: string }>;
  onLoginEmployee: (identifier: string, password: string) => Promise<{ success: boolean; error?: string }>;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  employees,
  onLoginAdmin,
  onLoginEmployee,
}) => {
  const [activeTab, setActiveTab] = useState<'admin' | 'employee'>('admin');
  
  // Admin form state
  const [adminIdentifier, setAdminIdentifier] = useState('admin@traket.in');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  
  // Employee form state
  const [empIdentifier, setEmpIdentifier] = useState('');
  const [empPassword, setEmpPassword] = useState('');
  const [showEmpPassword, setShowEmpPassword] = useState(false);

  // Common state
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Set default employee if available
  useEffect(() => {
    const activeEmps = employees.filter((e) => e.is_active);
    if (activeEmps.length > 0 && !empIdentifier) {
      setEmpIdentifier(activeEmps[0].employee_id);
      if (activeEmps[0].password) {
        setEmpPassword(activeEmps[0].password);
      }
    }
  }, [employees, empIdentifier]);

  // Clear errors when switching tabs
  const handleTabSwitch = (tab: 'admin' | 'employee') => {
    setActiveTab(tab);
    setErrorMessage(null);
  };

  // Quick fill demo admin
  const fillDemoAdmin = () => {
    setAdminIdentifier('admin@traket.in');
    setAdminPassword('admin123');
    setErrorMessage(null);
  };

  // Quick select employee
  const selectEmployeeQuick = (emp: Employee) => {
    setEmpIdentifier(emp.employee_id);
    setEmpPassword(emp.password || '');
    setErrorMessage(null);
  };

  // Handle Admin submit
  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminIdentifier.trim()) {
      setErrorMessage('Please enter your Admin Email or Username.');
      return;
    }
    if (!adminPassword.trim()) {
      setErrorMessage('Please enter your Admin password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await onLoginAdmin(adminIdentifier.trim(), adminPassword.trim());
      if (!res.success) {
        setErrorMessage(res.error || 'Authentication failed. Please verify credentials.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error during login.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Employee submit
  const handleEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empIdentifier.trim()) {
      setErrorMessage('Please enter your Employee ID (e.g. EMP001) or work email.');
      return;
    }
    if (!empPassword.trim()) {
      setErrorMessage('Please enter your employee password / access key.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await onLoginEmployee(empIdentifier.trim(), empPassword.trim());
      if (!res.success) {
        setErrorMessage(res.error || 'Authentication failed. Please check Employee ID and password.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error during login.');
    } finally {
      setIsLoading(false);
    }
  };

  const activeEmployees = employees.filter((e) => e.is_active);

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 sm:p-6 lg:p-8 overflow-hidden font-sans bg-slate-950 text-slate-100">
      {/* ======================================================== */}
      {/* 1. PROFESSIONAL HIGHWAY TRUCK & FREIGHT BACKDROP */}
      {/* ======================================================== */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat scale-105 transform filter blur-[1px] brightness-50"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=2000&q=80')`,
        }}
      />

      {/* Cinematic Dark Gradient & Mesh Overlays */}
      <div className="absolute inset-0 z-0 bg-gradient-to-tr from-slate-950 via-slate-950/85 to-blue-950/75 backdrop-blur-xs" />
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-600/20 via-transparent to-transparent pointer-events-none" />

      {/* Top Floating Brand Status Bar */}
      <div className="absolute top-4 sm:top-6 left-4 sm:left-8 right-4 sm:right-8 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex items-center space-x-2.5 bg-slate-900/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-700/60 shadow-lg pointer-events-auto">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
          <span className="text-[11px] font-bold text-slate-200 tracking-wide uppercase">
            Traket Dispatch Cloud Online
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-[11px] text-emerald-400 font-mono font-bold">24ms Latency</span>
        </div>

        <div className="hidden md:flex items-center space-x-2 bg-slate-900/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-700/60 text-[11px] text-slate-300 font-medium pointer-events-auto">
          <Shield className="w-3.5 h-3.5 text-blue-400" />
          <span>Enterprise 256-Bit SSL • WhatsApp Meta Verified</span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. MAIN LOGIN CONTAINER (DUAL PANE ON LARGE SCREENS) */}
      {/* ======================================================== */}
      <div className="relative z-10 w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center my-auto pt-10 sm:pt-6">
        
        {/* Left Pane: Logistics Brand Presentation (Hidden on small screens) */}
        <div className="hidden lg:flex lg:col-span-6 flex-col justify-between space-y-6 text-white pr-4">
          <div>
            {/* Brand Logo & Name */}
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/25 border border-white/20">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white flex items-center space-x-2">
                  <span>TRAKET</span>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-blue-500/30 text-blue-300 font-bold border border-blue-400/30 uppercase tracking-wider">
                    Logistics Hub
                  </span>
                </h1>
                <p className="text-xs text-slate-300 font-medium">Pan-India WhatsApp Freight Dispatch Engine</p>
              </div>
            </div>

            <h2 className="text-3xl font-black tracking-tight leading-snug text-white mt-4">
              Intelligent Freight Routing & Realtime Dispatch Operations
            </h2>
            <p className="text-sm text-slate-300 mt-3 leading-relaxed">
              Automates WhatsApp customer cargo demand capture, matches loads to vehicle specialists in real-time, and recovers dropped inquiries with 3-stage nudges.
            </p>
          </div>

          {/* 4 Feature Value Pillars */}
          <div className="space-y-3">
            {[
              {
                icon: Zap,
                color: 'text-amber-400',
                title: 'Instant WhatsApp Demand Capture',
                desc: 'Inbound chat requests automatically formatted with PIN-to-PIN distance & material specs.',
              },
              {
                icon: Truck,
                color: 'text-blue-400',
                title: 'Strict Fleet Lead Matching',
                desc: 'Truck, Tempo, Container & Port FCL leads routed only to designated vehicle specialists.',
              },
              {
                icon: Clock,
                color: 'text-emerald-400',
                title: '3-Stage 24h Drop-Off Recovery',
                desc: 'Scheduled nudges (~1-2h, ~6-8h, ~18-22h) recover dropped orders at ₹0 Meta fees.',
              },
              {
                icon: ShieldCheck,
                color: 'text-purple-400',
                title: 'Role-Based Access Control',
                desc: 'Separated workspaces for Specialist Dispatch and Management Oversight.',
              },
            ].map((feature, idx) => (
              <div
                key={idx}
                className="p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm flex items-start space-x-3 transition hover:bg-white/10"
              >
                <div className="p-2 rounded-xl bg-white/10 shrink-0 mt-0.5">
                  <feature.icon className={`w-4 h-4 ${feature.color}`} />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">{feature.title}</div>
                  <div className="text-[11px] text-slate-300 leading-snug mt-0.5">{feature.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer stats pill */}
          <div className="pt-2 flex items-center space-x-4 text-[11px] text-slate-400 border-t border-white/10">
            <span>🚚 Tempo (1-10 MT)</span>
            <span>•</span>
            <span>🚛 Trucks (12-40 MT)</span>
            <span>•</span>
            <span>📦 32ft Containers</span>
            <span>•</span>
            <span>⚓ Port FCL 20/40</span>
          </div>
        </div>

        {/* Right Pane: High-End Login Card */}
        <div className="lg:col-span-6 w-full max-w-md mx-auto">
          <div className="bg-white/95 backdrop-blur-xl border border-white/40 shadow-2xl rounded-3xl p-6 sm:p-8 text-slate-900 transition-all duration-200">
            
            {/* Card Header */}
            <div className="text-center space-y-1 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto shadow-md shadow-blue-500/30 mb-2">
                <Lock className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Sign in to Traket CRM
              </h2>
              <p className="text-xs text-slate-500">
                Logistics Dispatch Hub & Lead Operations Console
              </p>
            </div>

            {/* Segmented Role Switcher: Admin vs Employee */}
            <div className="flex p-1 bg-slate-100 rounded-xl mb-5 text-xs font-bold">
              <button
                type="button"
                onClick={() => handleTabSwitch('admin')}
                className={`flex-1 py-2 rounded-lg transition-all duration-150 flex items-center justify-center space-x-2 cursor-pointer ${
                  activeTab === 'admin'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Admin Access</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabSwitch('employee')}
                className={`flex-1 py-2 rounded-lg transition-all duration-150 flex items-center justify-center space-x-2 cursor-pointer ${
                  activeTab === 'employee'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span>Employee Portal</span>
              </button>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start space-x-2 animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 leading-snug">{errorMessage}</div>
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB 1: ADMIN LOGIN FORM */}
            {/* ======================================================== */}
            {activeTab === 'admin' ? (
              <form onSubmit={handleAdminSubmit} className="space-y-4">
                {/* Admin Identifier */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block mb-1">
                    Admin Email or Username
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={adminIdentifier}
                      onChange={(e) => setAdminIdentifier(e.target.value)}
                      placeholder="admin@traket.in"
                      autoComplete="username"
                      className="w-full pl-10 pr-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-900 bg-white placeholder:text-slate-400 font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                    />
                  </div>
                </div>

                {/* Admin Password */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                      Security Password
                    </label>
                    <button
                      type="button"
                      onClick={fillDemoAdmin}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center space-x-0.5 cursor-pointer"
                      title="Auto-fill admin demo credentials"
                    >
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      <span>Fill Demo Admin</span>
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showAdminPassword ? 'text' : 'password'}
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Enter admin password (e.g. admin123)"
                      autoComplete="current-password"
                      className="w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-900 bg-white placeholder:text-slate-400 font-mono font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPassword(!showAdminPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    >
                      {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center space-x-2 text-slate-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                    />
                    <span className="font-medium">Stay signed in on this device</span>
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? (
                    <span>Verifying Admin Credentials...</span>
                  ) : (
                    <>
                      <span>Sign In as Administrator</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* ======================================================== */
              /* TAB 2: EMPLOYEE PORTAL LOGIN */
              /* ======================================================== */
              <form onSubmit={handleEmployeeSubmit} className="space-y-4">
                {/* Employee Quick Select Pills */}
                {activeEmployees.length > 0 && (
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                    <div className="text-[10px] font-bold uppercase text-slate-500 flex items-center space-x-1">
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      <span>Quick Select Specialist:</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {activeEmployees.map((emp) => (
                        <button
                          key={emp.employee_id}
                          type="button"
                          onClick={() => selectEmployeeQuick(emp)}
                          className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition flex items-center space-x-1 cursor-pointer ${
                            empIdentifier === emp.employee_id || empIdentifier === emp.email
                              ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                              : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          <span>{emp.name}</span>
                          <span className="font-mono text-[10px] opacity-75">({emp.employee_id})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Employee ID or Email */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block mb-1">
                    Employee ID or Work Email
                  </label>
                  <div className="relative">
                    <Hash className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={empIdentifier}
                      onChange={(e) => setEmpIdentifier(e.target.value)}
                      placeholder="e.g. EMP001 or preet@gmail.com"
                      autoComplete="username"
                      className="w-full pl-10 pr-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-900 bg-white placeholder:text-slate-400 font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                    />
                  </div>
                </div>

                {/* Employee Access Key / Password */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block mb-1">
                    Access Key / Password
                  </label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showEmpPassword ? 'text' : 'password'}
                      value={empPassword}
                      onChange={(e) => setEmpPassword(e.target.value)}
                      placeholder="Enter your employee access key"
                      autoComplete="current-password"
                      className="w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-900 bg-white placeholder:text-slate-400 font-mono font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEmpPassword(!showEmpPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    >
                      {showEmpPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center space-x-2 text-slate-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                    />
                    <span className="font-medium">Remember my login</span>
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:from-blue-800 active:to-indigo-800 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? (
                    <span>Verifying Employee Key...</span>
                  ) : (
                    <>
                      <span>Enter Employee Workspace</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Card Footer Help */}
            <div className="mt-5 pt-4 border-t border-slate-100 text-center">
              <p className="text-[11px] text-slate-400 flex items-center justify-center space-x-1">
                <HelpCircle className="w-3 h-3 text-slate-400" />
                <span>Forgot password? Contact your Traket dispatch admin.</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Copyright */}
      <div className="absolute bottom-3 left-0 right-0 z-10 text-center text-[10px] text-slate-400">
        © 2026 Traket Logistics Private Limited. All Rights Reserved. Enterprise WhatsApp Dispatch CRM.
      </div>
    </div>
  );
};
