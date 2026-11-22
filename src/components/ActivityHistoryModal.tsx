import React, { useMemo, useState } from 'react';
import {
  Activity,
  Briefcase,
  Clock,
  GraduationCap,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import type { UserAccount, UserActivityLog, UserRole } from '../types';

interface ActivityHistoryModalProps {
  open: boolean;
  user: UserAccount;
  logs: UserActivityLog[];
  onClose: () => void;
}

function formatDateTime(iso?: string): string {
  if (!iso) return 'Just now';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function roleLabel(role: UserRole): string {
  if (role === 'faculty') return 'Faculty';
  if (role === 'organizer') return 'Organizer';
  return 'Student';
}

export const ActivityHistoryModal: React.FC<ActivityHistoryModalProps> = ({
  open,
  user,
  logs,
  onClose,
}) => {
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');

  const counts = useMemo(() => {
    return {
      all: logs.length,
      learner: logs.filter((l) => l.role === 'learner').length,
      faculty: logs.filter((l) => l.role === 'faculty').length,
      organizer: logs.filter((l) => l.role === 'organizer').length,
    };
  }, [logs]);

  const filtered = useMemo(() => {
    if (roleFilter === 'all') return logs;
    return logs.filter((l) => l.role === roleFilter);
  }, [logs, roleFilter]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="activity-history-title"
    >
      <div className="w-full max-w-2xl bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#dbe3f0] dark:border-[#24324d] bg-[#f8fafe] dark:bg-[#0e1626] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#e8eeff] dark:bg-[#1c2a50] text-[#2f5bea] dark:text-[#7a9bff] flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h2 id="activity-history-title" className="text-base font-extrabold tracking-tight">
                Login Info & Multi-Role Activity History
              </h2>
              <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc]">
                Recorded actions across Student, Faculty, and Organizer workspaces
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close activity log"
            className="p-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#131d33] text-[#5b6b86] hover:text-[#12203a] dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Account Login Summary */}
        <div className="px-6 py-4 border-b border-[#dbe3f0] dark:border-[#24324d] grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white dark:bg-[#131d33]">
          <div className="p-3 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d]">
            <p className="text-[11px] font-semibold text-[#5b6b86] dark:text-[#9fb0cc]">Account</p>
            <p className="text-xs font-bold truncate mt-0.5">{user.email}</p>
          </div>
          <div className="p-3 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d]">
            <p className="text-[11px] font-semibold text-[#5b6b86] dark:text-[#9fb0cc]">
              Sign-In Method
            </p>
            <p className="text-xs font-bold mt-0.5 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{user.lastLoginMethod === 'google' ? 'Google Auth' : 'Local Session'}</span>
            </p>
          </div>
          <div className="p-3 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d]">
            <p className="text-[11px] font-semibold text-[#5b6b86] dark:text-[#9fb0cc]">
              Total Logins
            </p>
            <p className="text-sm font-extrabold tabular-nums mt-0.5">{user.loginCount ?? 1}</p>
          </div>
          <div className="p-3 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d]">
            <p className="text-[11px] font-semibold text-[#5b6b86] dark:text-[#9fb0cc]">
              Last Login
            </p>
            <p className="text-[11px] font-bold mt-0.5 tabular-nums">
              {formatDateTime(user.lastLoginAt)}
            </p>
          </div>
        </div>

        {/* Role Filter Tabs */}
        <div className="px-6 py-3 border-b border-[#dbe3f0] dark:border-[#24324d] flex flex-wrap gap-2">
          {(
            [
              { id: 'all', label: `All (${counts.all})` },
              { id: 'learner', label: `Student (${counts.learner})` },
              { id: 'faculty', label: `Faculty (${counts.faculty})` },
              { id: 'organizer', label: `Organizer (${counts.organizer})` },
            ] as const
          ).map((tab) => {
            const active = roleFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setRoleFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#2f5bea] text-white'
                    : 'bg-[#f3f6fb] dark:bg-[#0b1120] text-[#5b6b86] dark:text-[#9fb0cc] hover:text-[#12203a] dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Timeline List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-10 space-y-1.5">
              <p className="text-sm font-bold">No activity recorded in this role yet</p>
              <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc]">
                Logins, applications, NOC requests, faculty signatures, and postings appear here automatically.
              </p>
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-[#f8fafe] dark:bg-[#0e1626] flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] flex items-center justify-center shrink-0 mt-0.5">
                    {item.role === 'faculty' ? (
                      <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    ) : item.role === 'organizer' ? (
                      <Briefcase className="w-4 h-4 text-[#2f5bea] dark:text-[#7a9bff]" />
                    ) : (
                      <GraduationCap className="w-4 h-4 text-[#12805f] dark:text-[#5fe0b6]" />
                    )}
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="font-bold text-[#12203a] dark:text-white">
                        {item.title}
                      </span>
                      <span className="text-[#5b6b86] dark:text-[#9fb0cc]">·</span>
                      <span className="font-semibold text-[#2f5bea] dark:text-[#7a9bff]">
                        {roleLabel(item.role)}
                      </span>
                    </div>
                    {item.details && (
                      <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc] leading-relaxed">
                        {item.details}
                      </p>
                    )}
                    <p className="text-[11px] text-[#5b6b86] dark:text-[#9fb0cc] flex items-center gap-1.5 tabular-nums pt-0.5">
                      <Clock className="w-3 h-3" />
                      <span>{formatDateTime(item.occurredAt)}</span>
                      {item.deviceSummary && (
                        <>
                          <span>·</span>
                          <span className="truncate">{item.deviceSummary}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
