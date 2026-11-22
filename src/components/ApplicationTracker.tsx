import React, { useMemo, useRef, useState } from 'react';
import {
  Archive,
  Award,
  Briefcase,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronRight,
  Columns3,
  FileCheck2,
  FileSignature,
  FileText,
  HeartHandshake,
  MapPin,
  Plus,
  Printer,
  ShieldCheck,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import type {
  ApplicationRecord,
  ApplicationStage,
  LeaveRequest,
  LeaveType,
  NocRequest,
  ParentConsentSheet,
  ResumeItem,
} from '../types';
import { formatShortDate, todayIso } from '../utils/matching';

interface ApplicationTrackerProps {
  applications: ApplicationRecord[];
  resumes: ResumeItem[];
  defaultResumeName: string;
  leaveRequests: LeaveRequest[];
  nocRequests?: NocRequest[];
  parentConsents?: ParentConsentSheet[];
  userEmail: string;
  userName: string;
  onUpdateStage: (appId: string, nextStage: ApplicationStage) => void;
  onUpdateApplicationResume: (appId: string, resumeName: string) => void;
  onAttachDocsToApplication?: (
    appId: string,
    attachments: {
      attachedNocId?: string;
      attachedNocNumber?: string;
      attachedConsentId?: string;
      attachedConsentCode?: string;
    }
  ) => void;
  onAddResume: (fileName: string, targetRole: string) => void;
  onSetDefaultResume: (resumeId: string) => void;
  onDeleteResume: (resumeId: string) => void;
  onSubmitLeaveRequest: (payload: {
    leaveType: LeaveType;
    companyOrEvent: string;
    startDate: string;
    endDate: string;
    timingNote: string;
    reason: string;
  }) => void;
  onAddExternalApplication: (payload: {
    company: string;
    roleTitle: string;
    location: string;
    stage: ApplicationStage;
    nextAction: string;
    resumeUsed: string;
  }) => void;
}

const KANBAN_COLUMNS: ApplicationStage[] = [
  'Applied',
  'Shortlisted',
  'Recruiter Call',
  'Phone Screen',
  'Selected',
];

export const ApplicationTracker: React.FC<ApplicationTrackerProps> = ({
  applications,
  resumes,
  defaultResumeName,
  leaveRequests,
  nocRequests = [],
  parentConsents = [],
  userEmail,
  userName,
  onUpdateStage,
  onUpdateApplicationResume,
  onAttachDocsToApplication,
  onAddResume,
  onSetDefaultResume,
  onDeleteResume,
  onSubmitLeaveRequest,
  onAddExternalApplication,
}) => {
  const [view, setView] = useState<'kanban' | 'calendar' | 'leave' | 'rejected'>('kanban');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [viewingPassApp, setViewingPassApp] = useState<ApplicationRecord | null>(null);

  const [company, setCompany] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [location, setLocation] = useState('Remote');
  const [stage, setStage] = useState<ApplicationStage>('Applied');
  const [nextAction, setNextAction] = useState('');
  const [selectedResume, setSelectedResume] = useState(defaultResumeName || resumes[0]?.name || '');

  // Leave request form state
  const [leaveType, setLeaveType] = useState<LeaveType>('Internship Joining');
  const [leaveTarget, setLeaveTarget] = useState('');
  const [leaveStart, setLeaveStart] = useState(todayIso());
  const [leaveEnd, setLeaveEnd] = useState(todayIso());
  const [leaveTiming, setLeaveTiming] = useState('09:30 AM – 06:00 PM IST');
  const [leaveReason, setLeaveReason] = useState('');

  const [newResumeRole, setNewResumeRole] = useState('Software Engineering');
  const resumeInputRef = useRef<HTMLInputElement | null>(null);

  const normalizedEmail = userEmail.trim().toLowerCase();
  const normalizedName = userName.trim().toLowerCase();

  const myApps = useMemo(
    () => applications.filter((a) => a.applicantEmail.trim().toLowerCase() === normalizedEmail),
    [applications, normalizedEmail]
  );

  const myLeaves = useMemo(
    () =>
      leaveRequests.filter(
        (l) =>
          l.studentEmail.trim().toLowerCase() === normalizedEmail ||
          l.studentName.trim().toLowerCase() === normalizedName
      ),
    [leaveRequests, normalizedEmail, normalizedName]
  );

  const myNocs = useMemo(
    () =>
      nocRequests.filter(
        (n) =>
          n.studentEmail.trim().toLowerCase() === normalizedEmail ||
          n.studentName.trim().toLowerCase() === normalizedName
      ),
    [nocRequests, normalizedEmail, normalizedName]
  );

  const myConsents = useMemo(
    () =>
      parentConsents.filter(
        (c) =>
          c.studentEmail.trim().toLowerCase() === normalizedEmail ||
          c.studentName.trim().toLowerCase() === normalizedName
      ),
    [parentConsents, normalizedEmail, normalizedName]
  );

  const rejectedApps = useMemo(
    () => myApps.filter((a) => a.stage === 'Rejected'),
    [myApps]
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim() || !roleTitle.trim()) return;
    onAddExternalApplication({
      company: company.trim(),
      roleTitle: roleTitle.trim(),
      location: location.trim() || 'Remote',
      stage,
      nextAction: nextAction.trim() || 'Follow up in 5 days',
      resumeUsed: selectedResume || defaultResumeName,
    });
    setCompany('');
    setRoleTitle('');
    setLocation('Remote');
    setStage('Applied');
    setNextAction('');
    setShowAddModal(false);
  };

  const getNextStage = (current: ApplicationStage): ApplicationStage | null => {
    const idx = KANBAN_COLUMNS.indexOf(current);
    if (idx === -1 || idx >= KANBAN_COLUMNS.length - 1) return null;
    return KANBAN_COLUMNS[idx + 1];
  };

  return (
    <div className="space-y-5">
      {/* Multi-Resume Vault Strip (2-3 tailored resumes inside My Applications) */}
      <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold">Tailored Resume Vault ({resumes.length})</h2>
            <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc]">
              Keep multiple role-specific resumes ready and choose which version was sent to each company
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowResumeModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] hover:border-[#2f5bea] text-xs font-bold cursor-pointer self-start sm:self-auto"
          >
            <UploadCloud className="w-3.5 h-3.5 text-[#2f5bea] dark:text-[#7a9bff]" />
            <span>Add Resume</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {resumes.map((res) => (
            <div
              key={res.id}
              className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2 ${
                res.isDefault
                  ? 'border-[#2f5bea] bg-[#e8eeff]/40 dark:bg-[#1c2a50]/60'
                  : 'border-[#dbe3f0] dark:border-[#24324d] bg-[#f8fafe] dark:bg-[#0e1626]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-[#2f5bea] dark:text-[#7a9bff] shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">{res.name}</p>
                    <p className="text-[11px] text-[#5b6b86] dark:text-[#9fb0cc] truncate">
                      {res.targetRole}
                    </p>
                  </div>
                </div>
                {resumes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onDeleteResume(res.id)}
                    title="Delete resume"
                    className="text-[#5b6b86] hover:text-rose-600 p-0.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1">
                <span className="font-mono text-[#5b6b86] dark:text-[#9fb0cc]">
                  {res.sizeLabel} · {formatShortDate(res.updatedAt)}
                </span>
                {res.isDefault ? (
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" />
                    Default
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSetDefaultResume(res.id)}
                    className="font-bold text-[#2f5bea] dark:text-[#7a9bff] hover:underline cursor-pointer"
                  >
                    Set default
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* View Switcher & Add Company Header */}
      <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setView('kanban')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              view === 'kanban'
                ? 'bg-[#e8eeff] dark:bg-[#1c2a50] text-[#2f5bea] dark:text-[#7a9bff]'
                : 'text-[#5b6b86] dark:text-[#9fb0cc] hover:bg-[#f3f6fb] dark:hover:bg-[#16213a]'
            }`}
          >
            <Columns3 className="w-3.5 h-3.5" />
            <span>Kanban</span>
          </button>

          <button
            type="button"
            onClick={() => setView('calendar')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              view === 'calendar'
                ? 'bg-[#e8eeff] dark:bg-[#1c2a50] text-[#2f5bea] dark:text-[#7a9bff]'
                : 'text-[#5b6b86] dark:text-[#9fb0cc] hover:bg-[#f3f6fb] dark:hover:bg-[#16213a]'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>Timeline</span>
          </button>

          <button
            type="button"
            onClick={() => setView('leave')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              view === 'leave'
                ? 'bg-[#e8eeff] dark:bg-[#1c2a50] text-[#2f5bea] dark:text-[#7a9bff]'
                : 'text-[#5b6b86] dark:text-[#9fb0cc] hover:bg-[#f3f6fb] dark:hover:bg-[#16213a]'
            }`}
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            <span>Faculty Leave Passes ({myLeaves.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setView('rejected')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              view === 'rejected'
                ? 'bg-[#e8eeff] dark:bg-[#1c2a50] text-[#2f5bea] dark:text-[#7a9bff]'
                : 'text-[#5b6b86] dark:text-[#9fb0cc] hover:bg-[#f3f6fb] dark:hover:bg-[#16213a]'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Rejected / Closed ({rejectedApps.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowLeaveModal(true)}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#2f5bea] dark:border-[#7a9bff] text-[#2f5bea] dark:text-[#7a9bff] hover:bg-[#e8eeff] dark:hover:bg-[#1c2a50] text-xs font-bold transition-colors cursor-pointer"
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            <span>Request Leave / OD</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#2f5bea] hover:bg-[#244bc9] text-white text-xs font-bold transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Company</span>
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      {view === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-start">
          {KANBAN_COLUMNS.map((col) => {
            const colItems = myApps.filter((a) => a.stage === col);
            return (
              <div
                key={col}
                className="bg-[#eaf0f8] dark:bg-[#11192c] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-3.5 space-y-3 min-h-[260px]"
              >
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold text-[#12203a] dark:text-[#e8eefc]">{col}</h3>
                  <span className="font-mono text-xs font-bold text-[#5b6b86] dark:text-[#9fb0cc] tabular-nums">
                    {colItems.length}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {colItems.map((item) => {
                    const nextStage = getNextStage(item.stage);
                    const approval = item.facultyApproval;
                    const attachedNoc =
                      nocRequests.find((n) => n.id === item.attachedNocId) ||
                      (item.attachedNocNumber
                        ? nocRequests.find((n) => n.nocNumber === item.attachedNocNumber)
                        : undefined);
                    const attachedConsent =
                      parentConsents.find((c) => c.id === item.attachedConsentId) ||
                      (item.attachedConsentCode
                        ? parentConsents.find((c) => c.consentCode === item.attachedConsentCode)
                        : undefined);

                    return (
                      <div
                        key={item.id}
                        className="bg-white dark:bg-[#16213a] border border-[#dbe3f0] dark:border-[#26365a] rounded-xl p-3.5 space-y-2.5 shadow-2xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="text-sm font-bold truncate">{item.company}</h4>
                            <div className="flex items-center gap-1 text-xs text-[#5b6b86] dark:text-[#9fb0cc] mt-0.5">
                              <Briefcase className="w-3 h-3 shrink-0" />
                              <span className="truncate">{item.roleTitle}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onUpdateStage(item.id, 'Rejected')}
                            title="Move to Rejected / Closed"
                            className="text-[#5b6b86] hover:text-rose-600 p-0.5 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] text-[#5b6b86] dark:text-[#9fb0cc]">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span>{item.location}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">{formatShortDate(item.appliedOn)}</span>
                        </div>

                        {/* Faculty Clearance & Organizer Confirmation Status */}
                        <div
                          className={`p-2 rounded-lg border text-[11px] space-y-1 ${
                            approval?.status === 'Approved'
                              ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/70'
                              : approval?.status === 'Rejected'
                              ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/70'
                              : 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5 font-bold">
                            <span
                              className={`inline-flex items-center gap-1 ${
                                approval?.status === 'Approved'
                                  ? 'text-emerald-700 dark:text-emerald-300'
                                  : approval?.status === 'Rejected'
                                  ? 'text-rose-700 dark:text-rose-300'
                                  : 'text-amber-700 dark:text-amber-300'
                              }`}
                            >
                              <ShieldCheck className="w-3 h-3 shrink-0" />
                              {approval?.status === 'Approved'
                                ? 'Open / Allowed for Program'
                                : approval?.status === 'Rejected'
                                ? 'Not Cleared by Faculty'
                                : 'Awaiting Faculty Sign'}
                            </span>
                            {approval?.digitalSignature && (
                              <button
                                type="button"
                                onClick={() => setViewingPassApp(item)}
                                className="text-[10px] font-bold text-[#2f5bea] dark:text-[#7a9bff] hover:underline shrink-0 cursor-pointer"
                              >
                                View Signed Pass
                              </button>
                            )}
                          </div>
                          {approval?.digitalSignature && (
                            <p className="text-[10px] text-[#5b6b86] dark:text-[#9fb0cc] font-mono truncate">
                              Signed: {approval.digitalSignature.signerName} ·{' '}
                              {approval.digitalSignature.verificationCode}
                            </p>
                          )}
                          {item.organizerConfirmedAllowed && (
                            <p className="text-[10px] font-bold text-[#12805f] dark:text-[#5fe0b6] flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 shrink-0" />
                              Organizer Confirmed Entry
                            </p>
                          )}
                        </div>

                        {/* Attached Resume Selector */}
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-3 h-3 text-[#2f5bea] dark:text-[#7a9bff] shrink-0" />
                          <select
                            value={item.resumeUsed || defaultResumeName}
                            onChange={(e) => onUpdateApplicationResume(item.id, e.target.value)}
                            aria-label="Select resume used"
                            className="w-full text-[11px] font-semibold bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d] rounded-lg px-2 py-1 truncate"
                          >
                            {resumes.map((r) => (
                              <option key={r.id} value={r.name}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Attached NOC & Parent Consent Sheet */}
                        <div className="space-y-1.5 pt-0.5">
                          <div className="flex items-center gap-1.5">
                            <FileSignature className="w-3 h-3 text-[#2f5bea] dark:text-[#7a9bff] shrink-0" />
                            {onAttachDocsToApplication ? (
                              <select
                                aria-label="Attach NOC request"
                                value={attachedNoc?.id || item.attachedNocId || ''}
                                onChange={(e) => {
                                  const noc = nocRequests.find((n) => n.id === e.target.value);
                                  onAttachDocsToApplication(item.id, {
                                    attachedNocId: noc?.id,
                                    attachedNocNumber: noc?.nocNumber,
                                    attachedConsentId: item.attachedConsentId,
                                    attachedConsentCode: item.attachedConsentCode,
                                  });
                                }}
                                className="w-full text-[10px] font-semibold bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d] rounded-lg px-2 py-1 truncate"
                              >
                                <option value="">
                                  {item.attachedNocNumber
                                    ? `NOC: ${item.attachedNocNumber}`
                                    : 'Attach NOC Request...'}
                                </option>
                                {myNocs.map((n) => (
                                  <option key={n.id} value={n.id}>
                                    NOC: {n.nocNumber} ({n.status})
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-[10px] font-mono text-[#5b6b86] dark:text-[#9fb0cc] truncate">
                                NOC: {attachedNoc?.nocNumber || item.attachedNocNumber || 'Not attached'}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <HeartHandshake className="w-3 h-3 text-[#12805f] dark:text-[#5fe0b6] shrink-0" />
                            {onAttachDocsToApplication ? (
                              <select
                                aria-label="Attach Parent Consent Sheet"
                                value={attachedConsent?.id || item.attachedConsentId || ''}
                                onChange={(e) => {
                                  const consent = parentConsents.find((c) => c.id === e.target.value);
                                  onAttachDocsToApplication(item.id, {
                                    attachedNocId: item.attachedNocId,
                                    attachedNocNumber: item.attachedNocNumber,
                                    attachedConsentId: consent?.id,
                                    attachedConsentCode: consent?.consentCode,
                                  });
                                }}
                                className="w-full text-[10px] font-semibold bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d] rounded-lg px-2 py-1 truncate"
                              >
                                <option value="">
                                  {item.attachedConsentCode
                                    ? `Consent: ${item.attachedConsentCode}`
                                    : 'Attach Parent Consent...'}
                                </option>
                                {myConsents.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    Consent: {c.consentCode} ({c.facultyVerified ? 'Verified' : 'Signed'})
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-[10px] font-mono text-[#5b6b86] dark:text-[#9fb0cc] truncate">
                                Consent:{' '}
                                {attachedConsent?.consentCode ||
                                  item.attachedConsentCode ||
                                  'Not attached'}
                              </span>
                            )}
                          </div>
                        </div>

                        {item.nextAction && (
                          <p className="text-[11px] font-medium text-[#2f5bea] dark:text-[#7a9bff] bg-[#f3f6fb] dark:bg-[#0e1626] px-2.5 py-1.5 rounded-lg">
                            {item.nextAction}
                          </p>
                        )}

                        {nextStage && (
                          <button
                            type="button"
                            onClick={() => onUpdateStage(item.id, nextStage)}
                            className="w-full py-1.5 px-2.5 rounded-lg border border-[#dbe3f0] dark:border-[#24324d] hover:border-[#2f5bea] text-[11px] font-semibold flex items-center justify-between transition-colors cursor-pointer"
                          >
                            <span>Advance to {nextStage}</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {col === 'Applied' && (
                    <button
                      type="button"
                      onClick={() => setShowAddModal(true)}
                      className="w-full py-2.5 rounded-xl border border-dashed border-[#c3cfe2] dark:border-[#2d3e63] text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] hover:border-[#2f5bea] hover:text-[#2f5bea] transition-colors cursor-pointer"
                    >
                      + Add Company
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Timeline / Table View */}
      {view === 'calendar' && (
        <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#dbe3f0] dark:border-[#24324d] text-xs font-bold text-[#5b6b86] dark:text-[#9fb0cc]">
                  <th className="py-3.5 px-5">Company & Role</th>
                  <th className="py-3.5 px-5">Attached NOC & Consent</th>
                  <th className="py-3.5 px-5">Faculty Clearance</th>
                  <th className="py-3.5 px-5">Resume Sent</th>
                  <th className="py-3.5 px-5">Applied On</th>
                  <th className="py-3.5 px-5">Stage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dbe3f0] dark:divide-[#24324d] text-sm">
                {myApps.map((app) => {
                  const approval = app.facultyApproval;
                  return (
                    <tr key={app.id} className="hover:bg-[#f8fafe] dark:hover:bg-[#16213a]">
                      <td className="py-3.5 px-5">
                        <div className="font-bold">{app.company}</div>
                        <div className="text-xs text-[#5b6b86] dark:text-[#9fb0cc]">
                          {app.roleTitle}
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-xs space-y-1">
                        <div className="font-mono text-[11px] text-[#2f5bea] dark:text-[#7a9bff]">
                          NOC: {app.attachedNocNumber || 'Not attached'}
                        </div>
                        <div className="font-mono text-[11px] text-[#12805f] dark:text-[#5fe0b6]">
                          Consent: {app.attachedConsentCode || 'Not attached'}
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-xs space-y-1">
                        <div
                          className={`font-bold ${
                            approval?.status === 'Approved'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : approval?.status === 'Rejected'
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {approval?.status === 'Approved'
                            ? 'Open / Allowed for Program'
                            : approval?.status === 'Rejected'
                            ? 'Not Cleared'
                            : 'Awaiting Faculty Sign'}
                        </div>
                        {approval?.digitalSignature && (
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] text-[#5b6b86] dark:text-[#9fb0cc]">
                              {approval.digitalSignature.verificationCode}
                            </span>
                            <button
                              type="button"
                              onClick={() => setViewingPassApp(app)}
                              className="text-[11px] font-bold text-[#2f5bea] dark:text-[#7a9bff] hover:underline cursor-pointer"
                            >
                              Signed Pass
                            </button>
                          </div>
                        )}
                        {app.organizerConfirmedAllowed && (
                          <div className="text-[10px] font-bold text-[#12805f] dark:text-[#5fe0b6]">
                            Organizer Confirmed Entry
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-5">
                        <select
                          value={app.resumeUsed || defaultResumeName}
                          onChange={(e) => onUpdateApplicationResume(app.id, e.target.value)}
                          className="px-2.5 py-1 rounded-lg border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0e1626] text-xs font-semibold"
                        >
                          {resumes.map((r) => (
                            <option key={r.id} value={r.name}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3.5 px-5 font-mono text-xs tabular-nums">
                        {formatShortDate(app.appliedOn)}
                      </td>
                      <td className="py-3.5 px-5">
                        <select
                          value={app.stage}
                          onChange={(e) => onUpdateStage(app.id, e.target.value as ApplicationStage)}
                          className="px-2.5 py-1 rounded-lg border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0e1626] text-xs font-semibold"
                        >
                          {[...KANBAN_COLUMNS, 'Rejected'].map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Faculty Leave / On-Duty Passes View */}
      {view === 'leave' && (
        <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold">Faculty Leave & On-Duty Approvals</h3>
              <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc]">
                Submit internship joining or event OD requests and download digitally signed faculty passes
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowLeaveModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2f5bea] text-white text-xs font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Leave Request</span>
            </button>
          </div>

          {myLeaves.length === 0 ? (
            <p className="text-sm text-[#5b6b86] dark:text-[#9fb0cc] py-6 text-center">
              No leave or on-duty requests submitted yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {myLeaves.map((lv) => (
                <div
                  key={lv.id}
                  className="p-4 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d] space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-[#2f5bea] dark:text-[#7a9bff]">
                        {lv.leaveType}
                      </p>
                      <h4 className="text-sm font-bold">{lv.companyOrEvent}</h4>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[11px] font-bold shrink-0 ${
                        lv.status === 'Approved'
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                          : lv.status === 'Rejected'
                          ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300'
                          : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'
                      }`}
                    >
                      {lv.status}
                    </span>
                  </div>

                  <p className="text-xs font-mono text-[#5b6b86] dark:text-[#9fb0cc]">
                    {formatShortDate(lv.startDate)} – {formatShortDate(lv.endDate)} · {lv.timingNote}
                  </p>
                  <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc]">{lv.reason}</p>

                  {lv.digitalSignature && (
                    <div className="p-2.5 rounded-xl bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold">
                          Signed: {lv.digitalSignature.signerName}
                        </p>
                        <p className="text-[10px] font-mono text-[#5b6b86]">
                          {lv.digitalSignature.verificationCode}
                        </p>
                      </div>
                      <img
                        src={lv.digitalSignature.signatureDataUrl}
                        alt="Faculty digital signature"
                        className="h-10 w-28 object-contain bg-white rounded border border-[#dbe3f0]"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Rejected / Closed View */}
      {view === 'rejected' && (
        <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-5">
          {rejectedApps.length === 0 ? (
            <p className="text-sm text-[#5b6b86] dark:text-[#9fb0cc] py-6 text-center">
              No rejected or closed applications yet.
            </p>
          ) : (
            <div className="space-y-3">
              {rejectedApps.map((app) => (
                <div
                  key={app.id}
                  className="p-4 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d] flex items-center justify-between gap-4"
                >
                  <div>
                    <p className="text-sm font-bold">
                      {app.company} · {app.roleTitle}
                    </p>
                    <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc]">
                      Applied {formatShortDate(app.appliedOn)} · {app.resumeUsed || defaultResumeName}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onUpdateStage(app.id, 'Applied')}
                    className="px-3 py-1.5 rounded-lg border border-[#dbe3f0] dark:border-[#24324d] text-xs font-semibold hover:border-[#2f5bea] cursor-pointer"
                  >
                    Restore to Applied
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add External Application Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-[2px]">
          <div className="w-full max-w-md bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Track External Application</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg text-[#5b6b86] hover:bg-[#f3f6fb] dark:hover:bg-[#16213a] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1">
                  Company name
                </label>
                <input
                  type="text"
                  required
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Spotify, Atlassian, Swiggy"
                  className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1">
                  Role title
                </label>
                <input
                  type="text"
                  required
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  placeholder="e.g. Product Engineering Intern"
                  className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1">
                  Resume attached
                </label>
                <select
                  value={selectedResume}
                  onChange={(e) => setSelectedResume(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm"
                >
                  {resumes.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name} ({r.targetRole})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1">
                    Stage
                  </label>
                  <select
                    value={stage}
                    onChange={(e) => setStage(e.target.value as ApplicationStage)}
                    className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm"
                  >
                    {KANBAN_COLUMNS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1">
                  Next action / reminder
                </label>
                <input
                  type="text"
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                  placeholder="e.g. Schedule phone screen by Friday"
                  className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#2f5bea] text-white text-xs font-bold cursor-pointer"
                >
                  Save to Board
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload New Resume Modal */}
      {showResumeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-[2px]">
          <div className="w-full max-w-md bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Add Tailored Resume</h3>
              <button
                type="button"
                onClick={() => setShowResumeModal(false)}
                className="p-1.5 rounded-lg text-[#5b6b86] hover:bg-[#f3f6fb] dark:hover:bg-[#16213a] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1">
                  Target role focus
                </label>
                <input
                  type="text"
                  value={newResumeRole}
                  onChange={(e) => setNewResumeRole(e.target.value)}
                  placeholder="e.g. Frontend Engineering, Product Design"
                  className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm"
                />
              </div>

              <button
                type="button"
                onClick={() => resumeInputRef.current?.click()}
                className="w-full py-6 rounded-xl border-2 border-dashed border-[#dbe3f0] dark:border-[#24324d] hover:border-[#2f5bea] flex flex-col items-center justify-center gap-2 text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] cursor-pointer"
              >
                <UploadCloud className="w-6 h-6 text-[#2f5bea] dark:text-[#7a9bff]" />
                <span>Choose PDF or Word file</span>
                <input
                  ref={resumeInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      onAddResume(file.name, newResumeRole.trim() || 'General Tech');
                      setShowResumeModal(false);
                    }
                  }}
                />
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Request Faculty Leave / OD Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-[2px]">
          <div className="w-full max-w-md bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Request Faculty Leave / OD Approval</h3>
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                className="p-1.5 rounded-lg text-[#5b6b86] hover:bg-[#f3f6fb] dark:hover:bg-[#16213a] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!leaveTarget.trim() || !leaveReason.trim()) return;
                onSubmitLeaveRequest({
                  leaveType,
                  companyOrEvent: leaveTarget.trim(),
                  startDate: leaveStart,
                  endDate: leaveEnd || leaveStart,
                  timingNote: leaveTiming.trim() || '09:30 AM – 06:00 PM IST',
                  reason: leaveReason.trim(),
                });
                setLeaveTarget('');
                setLeaveReason('');
                setShowLeaveModal(false);
                setView('leave');
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-semibold text-[#5b6b86] mb-1">Leave Category</label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                  className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120]"
                >
                  <option value="Internship Joining">Internship Joining</option>
                  <option value="On-Duty (Hackathon/Event)">On-Duty (Hackathon/Event)</option>
                  <option value="Interview / Assessment">Interview / Assessment</option>
                  <option value="Academic Leave">Academic Leave</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#5b6b86] mb-1">
                  Company or Event Name
                </label>
                <input
                  type="text"
                  required
                  value={leaveTarget}
                  onChange={(e) => setLeaveTarget(e.target.value)}
                  placeholder="e.g. Microsoft Phone Screen / Smart India Hackathon"
                  className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#5b6b86] mb-1">From Date</label>
                  <input
                    type="date"
                    value={leaveStart}
                    onChange={(e) => setLeaveStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#5b6b86] mb-1">To Date</label>
                  <input
                    type="date"
                    value={leaveEnd}
                    onChange={(e) => setLeaveEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#5b6b86] mb-1">
                  Internship / Event Timing
                </label>
                <input
                  type="text"
                  value={leaveTiming}
                  onChange={(e) => setLeaveTiming(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#5b6b86] mb-1">Reason</label>
                <textarea
                  rows={2}
                  required
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder="Brief note for your Faculty Coordinator..."
                  className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#2f5bea] text-white font-bold cursor-pointer"
                >
                  Send to Faculty
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Official Program Clearance Pass Modal (Signed by Faculty) */}
      {viewingPassApp && viewingPassApp.facultyApproval?.digitalSignature && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-[2px]">
          <div className="w-full max-w-lg bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#dbe3f0] dark:border-[#24324d] pb-3">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-[#12805f]" />
                <div>
                  <h3 className="text-sm font-extrabold">
                    Official Program Clearance Pass · Digitally Signed
                  </h3>
                  <p className="text-[11px] font-mono text-[#5b6b86] dark:text-[#9fb0cc]">
                    {viewingPassApp.facultyApproval.digitalSignature.verificationCode} ·{' '}
                    {viewingPassApp.facultyApproval.programClearance}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingPassApp(null)}
                className="p-1.5 rounded-lg text-[#5b6b86] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d] text-xs space-y-2 leading-relaxed">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#12805f] dark:text-[#5fe0b6]">
                Student & Organizer Clearance Confirmation
              </p>
              <p>
                This certifies that <strong>{viewingPassApp.applicantName}</strong> (
                {viewingPassApp.applicantBranch || 'CSE'}, Sem{' '}
                {viewingPassApp.applicantSemester || 5}) is{' '}
                <strong>{viewingPassApp.facultyApproval.programClearance}</strong> for{' '}
                <strong>{viewingPassApp.roleTitle}</strong> at{' '}
                <strong>{viewingPassApp.company}</strong> ({viewingPassApp.location}).
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                <div className="p-2 rounded-lg bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d]">
                  <span className="text-[#5b6b86] dark:text-[#9fb0cc] block text-[10px]">
                    Attached NOC Request
                  </span>
                  <strong>{viewingPassApp.attachedNocNumber || 'Not attached'}</strong>
                </div>
                <div className="p-2 rounded-lg bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d]">
                  <span className="text-[#5b6b86] dark:text-[#9fb0cc] block text-[10px]">
                    Parent Consent Sheet
                  </span>
                  <strong>{viewingPassApp.attachedConsentCode || 'Not attached'}</strong>
                </div>
              </div>
              <p className="text-[11px] font-semibold text-[#12805f] dark:text-[#5fe0b6]">
                Organizer Status:{' '}
                {viewingPassApp.organizerConfirmedAllowed
                  ? `Confirmed Program Entry (${formatShortDate(
                      viewingPassApp.organizerConfirmedAt || todayIso()
                    )})`
                  : 'Shared with Organizer — Open / Allowed for Program'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d] flex items-center justify-between gap-4">
              <div className="text-xs">
                <p className="font-bold">
                  {viewingPassApp.facultyApproval.digitalSignature.signerName}
                </p>
                <p className="text-[11px] text-[#5b6b86] dark:text-[#9fb0cc]">
                  {viewingPassApp.facultyApproval.digitalSignature.signerDesignation}
                </p>
                <p className="text-[11px] font-mono text-[#5b6b86] dark:text-[#9fb0cc] mt-0.5">
                  Signed {formatShortDate(viewingPassApp.facultyApproval.digitalSignature.signedAt)}
                </p>
                {viewingPassApp.facultyApproval.digitalSignature.remarks && (
                  <p className="text-[11px] text-[#5b6b86] dark:text-[#9fb0cc] mt-1">
                    Note: {viewingPassApp.facultyApproval.digitalSignature.remarks}
                  </p>
                )}
              </div>
              <img
                src={viewingPassApp.facultyApproval.digitalSignature.signatureDataUrl}
                alt="Faculty Signature"
                className="h-14 w-32 object-contain bg-white rounded-lg border border-[#dbe3f0] px-2 shrink-0"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] text-xs font-bold cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Pass</span>
              </button>
              <button
                type="button"
                onClick={() => setViewingPassApp(null)}
                className="px-4 py-2 rounded-xl bg-[#2f5bea] text-white text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
