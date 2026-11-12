import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { KeyRound, Eye, EyeOff, AlertCircle, CheckCircle2, X, ShieldAlert, Loader2, LogOut } from 'lucide-react';
import { authService } from '../../services/auth';

interface ChangePasswordModalProps {
  isOpen: boolean;
  forced?: boolean;
  userLabel: string;
  onClose: () => void;
  onSuccess: () => void;
  onLogout?: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  forced = false,
  userLabel,
  onClose,
  onSuccess,
  onLogout,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const resetAndClose = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!currentPassword) {
      setError('Please enter your current password.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('New password must be different from your current password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await authService.changePassword(currentPassword, newPassword);
      if (!res.success) {
        setError(res.error || 'Could not update password.');
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setError('');
        setSuccess(false);
        onSuccess();
      }, 900);
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[120] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (!forced && e.target === e.currentTarget) resetAndClose();
      }}
    >
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${forced ? 'bg-amber-500' : 'bg-blue-600'} text-white`}>
              {forced ? <ShieldAlert className="w-4 h-4" /> : <KeyRound className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">
                {forced ? 'Update Default Password Required' : 'Change Password'}
              </h2>
              <p className="text-[11px] text-slate-500">{userLabel}</p>
            </div>
          </div>

          {!forced && (
            <button
              type="button"
              onClick={resetAndClose}
              aria-label="Close change password dialog"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {forced && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed">
              Your account is currently using a default or temporary password. Set a private personal password now to continue securely.
            </div>
          )}

          <div className="space-y-1">
            <label htmlFor="traket-cp-current" className="text-xs font-bold text-slate-700 block">
              Current Password
            </label>
            <input
              id="traket-cp-current"
              type={showPasswords ? 'text' : 'password'}
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              required
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="traket-cp-new" className="text-xs font-bold text-slate-700 block">
              New Password (minimum 6 characters)
            </label>
            <div className="relative">
              <input
                id="traket-cp-new"
                type={showPasswords ? 'text' : 'password'}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Choose a strong password"
                className="w-full pl-3.5 pr-10 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                required
              />
              <button
                type="button"
                onClick={() => setShowPasswords((v) => !v)}
                aria-label={showPasswords ? 'Hide passwords' : 'Show passwords'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="traket-cp-confirm" className="text-xs font-bold text-slate-700 block">
              Confirm New Password
            </label>
            <input
              id="traket-cp-confirm"
              type={showPasswords ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              required
            />
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start space-x-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div
              role="status"
              className="flex items-center space-x-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Password updated cleanly!</span>
            </div>
          )}

          <div className="flex items-center justify-end space-x-2.5 pt-2">
            {forced && onLogout ? (
              <button
                type="button"
                onClick={onLogout}
                className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold flex items-center space-x-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={resetAndClose}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={isSaving || success}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm flex items-center space-x-1.5 disabled:opacity-60 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <span>Save New Password</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
