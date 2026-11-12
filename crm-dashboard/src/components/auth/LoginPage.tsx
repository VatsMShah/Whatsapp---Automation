import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Truck,
  Radio,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Mail,
  MessageSquare,
  ArrowLeft,
  Loader2,
  Zap,
  Clock,
} from 'lucide-react';
import { authService } from '../../services/auth';

interface LoginPageProps {
  onLoginAdmin: (
    identifier: string,
    password: string,
    rememberMe: boolean
  ) => Promise<{ success: boolean; error?: string }>;
  onLoginEmployee: (
    empIdOrEmail: string,
    password: string,
    rememberMe: boolean
  ) => Promise<{ success: boolean; error?: string }>;
}

const FEATURE_PILLARS = [
  {
    icon: Zap,
    iconBoxClass: 'bg-amber-50 text-amber-600 border-amber-200',
    title: 'Instant WhatsApp Demand Capture',
    desc: 'Inbound chat requests automatically formatted with PIN-to-PIN distance & material specs.',
  },
  {
    icon: Truck,
    iconBoxClass: 'bg-blue-50 text-blue-600 border-blue-200',
    title: 'Strict Fleet Lead Matching',
    desc: 'Truck, Tempo, Container & Port FCL leads routed only to designated vehicle specialists.',
  },
  {
    icon: Clock,
    iconBoxClass: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    title: '3-Stage 24h Drop-Off Recovery',
    desc: 'Scheduled follow-up nudges (~1-2h, ~6-8h, ~18-22h) recover dropped orders.',
  },
  {
    icon: ShieldCheck,
    iconBoxClass: 'bg-violet-50 text-violet-600 border-violet-200',
    title: 'Role-Based Access Control',
    desc: 'Separated workspaces for Specialist Dispatch and Management Oversight.',
  },
];

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginAdmin,
  onLoginEmployee,
}) => {
  const [roleTab, setRoleTab] = useState<'admin' | 'employee'>('admin');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [successBanner, setSuccessBanner] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Forgot password (WhatsApp OTP) state
  const [forgotMode, setForgotMode] = useState(false);
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request');
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [resetNewPass, setResetNewPass] = useState('');
  const [resetConfirmPass, setResetConfirmPass] = useState('');
  const [showResetPass, setShowResetPass] = useState(false);
  const [resetInfo, setResetInfo] = useState('');

  // Live backend health status
  const [healthStatus, setHealthStatus] = useState<{
    checked: boolean;
    online: boolean;
    configured: boolean;
    latencyMs: number | null;
  }>({ checked: false, online: false, configured: false, latencyMs: null });

  const passwordInputRef = useRef<HTMLInputElement>(null);

  const isHttps =
    typeof window !== 'undefined' && window.location.protocol === 'https:';

  useEffect(() => {
    let mounted = true;
    authService.checkHealth().then((res) => {
      if (!mounted) return;
      setHealthStatus({
        checked: true,
        online: res.online,
        configured: res.configured,
        latencyMs: res.latencyMs,
      });
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleTabSwitch = (nextTab: 'admin' | 'employee') => {
    setRoleTab(nextTab);
    setError('');
    setSuccessBanner('');
    setIdentifier('');
    setPassword('');
    setForgotMode(false);
    setResetStep('request');
    setResetOtp('');
    setResetNewPass('');
    setResetConfirmPass('');
    setResetInfo('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessBanner('');

    const cleanId = identifier.trim();
    if (!cleanId) {
      setError(
        roleTab === 'admin'
          ? 'Please enter your Admin Email or Username.'
          : 'Please enter your Employee ID or Email.'
      );
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res =
        roleTab === 'admin'
          ? await onLoginAdmin(cleanId, password, rememberMe)
          : await onLoginEmployee(cleanId, password, rememberMe);

      if (!res.success) {
        setError(res.error || 'Authentication failed. Check your credentials and try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const openForgotFlow = () => {
    setForgotMode(true);
    setResetStep('request');
    setResetIdentifier(identifier.trim());
    setResetOtp('');
    setResetNewPass('');
    setResetConfirmPass('');
    setResetInfo('');
    setError('');
    setSuccessBanner('');
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResetInfo('');

    if (!resetIdentifier.trim()) {
      setError(
        roleTab === 'admin'
          ? 'Please enter your Admin Email or Username.'
          : 'Please enter your Employee ID or Email.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authService.requestPasswordReset(roleTab, resetIdentifier);
      if (!res.success) {
        setError(res.error || 'Could not initiate password reset.');
        return;
      }
      setResetInfo(
        res.message ||
          'If an active account with a registered WhatsApp number matches, a 6-digit code has been sent.'
      );
      setResetStep('confirm');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!/^\d{6}$/.test(resetOtp.trim())) {
      setError('Please enter the 6-digit numeric code sent to your WhatsApp.');
      return;
    }
    if (resetNewPass.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }
    if (resetNewPass !== resetConfirmPass) {
      setError('New password and confirmation do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authService.confirmPasswordReset(
        roleTab,
        resetIdentifier,
        resetOtp,
        resetNewPass
      );
      if (!res.success) {
        setError(res.error || 'Failed to verify reset code.');
        return;
      }

      setForgotMode(false);
      setIdentifier(resetIdentifier.trim());
      setPassword('');
      setSuccessBanner(res.message || 'Password updated! Sign in with your new password.');
      setTimeout(() => passwordInputRef.current?.focus(), 50);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between overflow-y-auto bg-slate-50 text-slate-900 font-sans">
      {/* Top Bar matching CRM Dashboard Header */}
      <header className="w-full bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shrink-0">
            <Radio className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="font-extrabold text-sm tracking-tight text-slate-900 leading-tight">
              TRAKET
            </div>
            <div className="text-[10px] text-slate-500 font-medium leading-tight">
              Logistics Dispatch Hub
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs font-medium text-slate-600">
            <KeyRound className={`w-3.5 h-3.5 ${isHttps ? 'text-emerald-600' : 'text-blue-600'}`} />
            <span>{isHttps ? 'Encrypted HTTPS' : 'JWT Signed Session'}</span>
          </div>

          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700">
            <span
              className={`w-2 h-2 rounded-full ${
                !healthStatus.checked
                  ? 'bg-slate-400 animate-pulse'
                  : healthStatus.online && healthStatus.configured
                  ? 'bg-emerald-500'
                  : 'bg-amber-500'
              }`}
            />
            <span>
              {!healthStatus.checked
                ? 'Checking Local Auth...'
                : !healthStatus.online
                ? 'Local Server Offline (:3005)'
                : !healthStatus.configured
                ? 'Add Service Role Key in .env'
                : `Local Auth Online${healthStatus.latencyMs !== null ? ` (${healthStatus.latencyMs}ms)` : ''}`}
            </span>
          </div>
        </div>
      </header>

      {/* Main Two-Column CRM Content Container */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Pane: Logistics Brand & Operations Overview (Dashboard Theme) */}
          <section className="hidden lg:flex lg:col-span-6 flex-col justify-between space-y-6 pr-2">
            <div>
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold mb-4">
                <Truck className="w-3.5 h-3.5 text-blue-600" />
                <span>Pan-India WhatsApp Freight Dispatch Engine</span>
              </div>

              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-snug">
                Intelligent Freight Routing &amp; Realtime Dispatch Operations
              </h1>
              <p className="text-sm text-slate-600 mt-3 leading-relaxed">
                Automates WhatsApp customer cargo demand capture, matches loads to vehicle specialists in real-time, and recovers dropped inquiries with 3-stage nudges.
              </p>
            </div>

            {/* 4 Clean Dashboard-Style Feature Cards */}
            <div className="space-y-3">
              {FEATURE_PILLARS.map((feature) => (
                <div
                  key={feature.title}
                  className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs flex items-start space-x-3.5 hover:border-slate-300 transition"
                >
                  <div
                    className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${feature.iconBoxClass}`}
                  >
                    <feature.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">{feature.title}</div>
                    <div className="text-xs text-slate-500 leading-relaxed mt-0.5">
                      {feature.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Fleet Categories Strip */}
            <div className="pt-3 border-t border-slate-200 flex items-center flex-wrap gap-x-4 gap-y-1.5 text-xs font-semibold text-slate-500">
              <span>Tempo (1-10 MT)</span>
              <span className="text-slate-300">•</span>
              <span>Trucks (12-40 MT)</span>
              <span className="text-slate-300">•</span>
              <span>32ft Containers</span>
              <span className="text-slate-300">•</span>
              <span>Port FCL 20/40</span>
            </div>
          </section>

          {/* Right Pane: Clean White Dashboard Sign-In Card */}
          <section className="lg:col-span-6 w-full max-w-[440px] mx-auto">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-sm">
              {/* Card Header */}
              <div className="mb-5">
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  {forgotMode ? 'Reset Account Password' : 'Sign in to Traket CRM'}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {forgotMode
                    ? 'Verify your identity via a 6-digit WhatsApp security code'
                    : 'Access your dispatch desk, live inquiries, and booking tools'}
                </p>
              </div>

              {/* Role Portal Switcher (Admin Blue / Employee Violet matching Sidebar & Header) */}
              <div
                role="tablist"
                aria-label="Account portal type"
                className="grid grid-cols-2 p-1 bg-slate-100 border border-slate-200 rounded-xl mb-5"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={roleTab === 'admin'}
                  onClick={() => handleTabSwitch('admin')}
                  className={`flex items-center justify-center space-x-2 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    roleTab === 'admin'
                      ? 'bg-white text-blue-700 shadow-2xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Admin HQ</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={roleTab === 'employee'}
                  onClick={() => handleTabSwitch('employee')}
                  className={`flex items-center justify-center space-x-2 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    roleTab === 'employee'
                      ? 'bg-white text-violet-700 shadow-2xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Employee Portal</span>
                </button>
              </div>

              {!forgotMode ? (
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  {/* Identifier Input */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="traket-login-identifier"
                      className="text-xs font-bold text-slate-700 flex items-center space-x-1.5"
                    >
                      {roleTab === 'admin' ? (
                        <Mail className="w-3.5 h-3.5 text-blue-600" />
                      ) : (
                        <User className="w-3.5 h-3.5 text-violet-600" />
                      )}
                      <span>
                        {roleTab === 'admin' ? 'Admin Email or Username' : 'Employee ID or Email'}
                      </span>
                    </label>
                    <input
                      id="traket-login-identifier"
                      type="text"
                      autoComplete="username"
                      value={identifier}
                      onChange={(e) => {
                        setIdentifier(e.target.value);
                        if (error) setError('');
                      }}
                      placeholder={
                        roleTab === 'admin' ? 'admin@traket.in' : 'EMP001 or name@traket.in'
                      }
                      className={`w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none transition ${
                        roleTab === 'admin'
                          ? 'focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15'
                          : 'focus:border-violet-600 focus:ring-2 focus:ring-violet-600/15'
                      }`}
                      required
                    />
                  </div>

                  {/* Password Input */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="traket-login-password"
                      className="text-xs font-bold text-slate-700 flex items-center space-x-1.5"
                    >
                      <Lock
                        className={`w-3.5 h-3.5 ${
                          roleTab === 'admin' ? 'text-blue-600' : 'text-violet-600'
                        }`}
                      />
                      <span>Password</span>
                    </label>
                    <div className="relative">
                      <input
                        id="traket-login-password"
                        ref={passwordInputRef}
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (error) setError('');
                        }}
                        placeholder="Enter your password"
                        className={`w-full pl-3.5 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none transition ${
                          roleTab === 'admin'
                            ? 'focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15'
                            : 'focus:border-violet-600 focus:ring-2 focus:ring-violet-600/15'
                        }`}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1.5 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Remember Me + Forgot Password Row */}
                  <div className="flex items-center justify-between pt-0.5 text-xs">
                    <label
                      htmlFor="traket-remember-me"
                      className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 cursor-pointer"
                    >
                      <input
                        id="traket-remember-me"
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span>Keep me signed in (7 days)</span>
                    </label>

                    <button
                      type="button"
                      onClick={openForgotFlow}
                      className={`font-semibold transition cursor-pointer ${
                        roleTab === 'admin'
                          ? 'text-blue-600 hover:text-blue-800'
                          : 'text-violet-600 hover:text-violet-800'
                      }`}
                    >
                      Forgot password?
                    </button>
                  </div>

                  {/* Success Feedback */}
                  {successBanner && (
                    <div
                      role="status"
                      className="flex items-start space-x-2.5 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{successBanner}</span>
                    </div>
                  )}

                  {/* Error Feedback */}
                  {error && (
                    <div
                      role="alert"
                      aria-live="assertive"
                      className="flex items-start space-x-2.5 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs"
                    >
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`w-full py-3 rounded-xl text-sm font-bold text-white shadow-sm flex items-center justify-center space-x-2 transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer ${
                      roleTab === 'admin'
                        ? 'bg-blue-600 hover:bg-blue-700'
                        : 'bg-violet-600 hover:bg-violet-700'
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verifying Credentials...</span>
                      </>
                    ) : (
                      <>
                        <span>
                          {roleTab === 'admin'
                            ? 'Sign In to Admin HQ'
                            : 'Sign In to Employee Desk'}
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              ) : resetStep === 'request' ? (
                <form onSubmit={handleRequestOtp} className="space-y-4" noValidate>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start space-x-2.5">
                    <MessageSquare className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <span>
                      Enter your{' '}
                      {roleTab === 'admin'
                        ? 'Admin Email or Username'
                        : 'Employee ID or Email'}
                      . We will send a 6-digit code to your registered WhatsApp number.
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="traket-reset-identifier"
                      className="text-xs font-bold text-slate-700 block"
                    >
                      {roleTab === 'admin' ? 'Admin Email or Username' : 'Employee ID or Email'}
                    </label>
                    <input
                      id="traket-reset-identifier"
                      type="text"
                      value={resetIdentifier}
                      onChange={(e) => {
                        setResetIdentifier(e.target.value);
                        if (error) setError('');
                      }}
                      placeholder={
                        roleTab === 'admin' ? 'admin@traket.in' : 'EMP001 or name@traket.in'
                      }
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition"
                      required
                    />
                  </div>

                  {error && (
                    <div
                      role="alert"
                      aria-live="assertive"
                      className="flex items-start space-x-2.5 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs"
                    >
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="flex items-center space-x-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setForgotMode(false);
                        setError('');
                      }}
                      className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back</span>
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm flex items-center justify-center space-x-2 disabled:opacity-60 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Sending Code...</span>
                        </>
                      ) : (
                        <>
                          <span>Send WhatsApp OTP</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleConfirmReset} className="space-y-4" noValidate>
                  {resetInfo && (
                    <div
                      role="status"
                      className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs"
                    >
                      {resetInfo}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label
                      htmlFor="traket-reset-otp"
                      className="text-xs font-bold text-slate-700 block"
                    >
                      6-Digit WhatsApp Code
                    </label>
                    <input
                      id="traket-reset-otp"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={resetOtp}
                      onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="123456"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono tracking-[0.35em] text-center text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="traket-reset-newpass"
                      className="text-xs font-bold text-slate-700 block"
                    >
                      New Password (min 6 characters)
                    </label>
                    <div className="relative">
                      <input
                        id="traket-reset-newpass"
                        type={showResetPass ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={resetNewPass}
                        onChange={(e) => setResetNewPass(e.target.value)}
                        placeholder="Enter a strong new password"
                        className="w-full pl-3.5 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowResetPass((prev) => !prev)}
                        aria-label={showResetPass ? 'Hide password' : 'Show password'}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1.5 cursor-pointer"
                      >
                        {showResetPass ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="traket-reset-confirmpass"
                      className="text-xs font-bold text-slate-700 block"
                    >
                      Confirm New Password
                    </label>
                    <input
                      id="traket-reset-confirmpass"
                      type={showResetPass ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={resetConfirmPass}
                      onChange={(e) => setResetConfirmPass(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                      required
                    />
                  </div>

                  {error && (
                    <div
                      role="alert"
                      aria-live="assertive"
                      className="flex items-start space-x-2.5 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs"
                    >
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="flex items-center space-x-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setResetStep('request');
                        setError('');
                      }}
                      className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back</span>
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm flex items-center justify-center space-x-2 disabled:opacity-60 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Updating Password...</span>
                        </>
                      ) : (
                        <>
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>Verify &amp; Set Password</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Clean Minimal Footer matching Dashboard Chrome */}
      <footer className="w-full bg-white border-t border-slate-200 py-3.5 px-4 text-center shrink-0">
        <div className="text-xs text-slate-500 font-medium">
          Traket Transport Solutions · Secure Dispatch &amp; Operations CRM
        </div>
      </footer>
    </div>
  );
};
