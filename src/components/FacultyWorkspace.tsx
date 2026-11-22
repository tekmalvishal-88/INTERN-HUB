import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  Briefcase,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  Eraser,
  FileCheck2,
  FileSignature,
  HeartHandshake,
  PenTool,
  Plus,
  Printer,
  Search,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import type {
  ApplicationRecord,
  FacultyTab,
  LeaveRequest,
  LeaveRequestStatus,
  NocRequest,
  NocStatus,
  ParentConsentSheet,
  StudentEventItem,
  StudentScheduleRecord,
  UserAccount,
} from '../types';
import { daysBetween, formatShortDate, todayIso } from '../utils/matching';
import { GoogleVAvatar } from './GoogleVAvatar';

interface FacultyWorkspaceProps {
  activeTab: FacultyTab;
  user: UserAccount;
  applications: ApplicationRecord[];
  leaveRequests: LeaveRequest[];
  nocRequests: NocRequest[];
  parentConsents: ParentConsentSheet[];
  studentSchedules: StudentScheduleRecord[];
  onSignApplication: (
    appId: string,
    decision: 'Approved' | 'Rejected',
    signature: {
      signerName: string;
      signerDesignation: string;
      signatureDataUrl: string;
      remarks?: string;
    }
  ) => void;
  onAttachDocsToApplication: (
    appId: string,
    attachments: {
      attachedNocId?: string;
      attachedNocNumber?: string;
      attachedConsentId?: string;
      attachedConsentCode?: string;
    }
  ) => void;
  onSignLeaveRequest: (
    requestId: string,
    decision: 'Approved' | 'Rejected',
    signature: {
      signerName: string;
      signerDesignation: string;
      signatureDataUrl: string;
      remarks?: string;
    }
  ) => void;
  onSignNocRequest: (
    nocId: string,
    decision: 'Approved' | 'Rejected',
    signature: {
      signerName: string;
      signerDesignation: string;
      signatureDataUrl: string;
      remarks?: string;
    }
  ) => void;
  onVerifyParentConsent: (consentId: string) => void;
  onAddStudentSchedule: (student: Omit<StudentScheduleRecord, 'id'>) => void;
  onAddStudentEvent: (studentId: string, event: Omit<StudentEventItem, 'id'>) => void;
  onUpdateStudentTiming: (
    studentId: string,
    updates: {
      internshipCompany: string;
      internshipRole: string;
      internshipTiming: string;
      internshipStart: string;
      internshipEnd: string;
    }
  ) => void;
}

function getUrgencyClasses(daysLeft: number) {
  if (daysLeft < 0) {
    return {
      badge: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
      cell: 'bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300',
      text: 'text-slate-500',
      label: 'Past',
    };
  }
  if (daysLeft < 3) {
    return {
      badge: 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800',
      cell: 'bg-rose-500 text-white font-bold',
      text: 'text-rose-600 dark:text-rose-400',
      label: daysLeft === 0 ? 'Today' : `${daysLeft}d left`,
    };
  }
  if (daysLeft <= 14) {
    return {
      badge: 'bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800',
      cell: 'bg-orange-500 text-white font-bold',
      text: 'text-orange-600 dark:text-orange-400',
      label: `${daysLeft}d left`,
    };
  }
  return {
    badge: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
    cell: 'bg-emerald-600 text-white font-bold',
    text: 'text-emerald-700 dark:text-emerald-400',
    label: `${daysLeft}d left`,
  };
}

export const FacultyWorkspace: React.FC<FacultyWorkspaceProps> = ({
  activeTab,
  user,
  applications,
  leaveRequests,
  nocRequests,
  parentConsents,
  studentSchedules,
  onSignApplication,
  onAttachDocsToApplication,
  onSignLeaveRequest,
  onSignNocRequest,
  onVerifyParentConsent,
  onAddStudentSchedule,
  onAddStudentEvent,
  onUpdateStudentTiming,
}) => {
  const [statusFilter, setStatusFilter] = useState<'All' | LeaveRequestStatus>('All');
  const [search, setSearch] = useState('');
  const [nocFilter, setNocFilter] = useState<'All' | NocStatus>('All');
  const [nocSearch, setNocSearch] = useState('');
  const [nocSection, setNocSection] = useState<'noc' | 'consents'>('noc');
  const [appFilter, setAppFilter] = useState<'All' | 'Pending' | 'Allowed' | 'Rejected'>('All');
  const [appSearch, setAppSearch] = useState('');

  // Digital Signature Modal state (works for Leave Requests, NOC Requests & Student Applications)
  const [signingTarget, setSigningTarget] = useState<
    | { kind: 'leave'; req: LeaveRequest }
    | { kind: 'noc'; req: NocRequest }
    | { kind: 'application'; req: ApplicationRecord }
    | null
  >(null);
  const [signerName, setSignerName] = useState(user.name || 'Dr. Priya Rao');
  const [signerDesignation, setSignerDesignation] = useState(
    user.designation || 'Faculty Placement & Leave Coordinator, CSE'
  );
  const [remarks, setRemarks] = useState('');
  const [inkColor, setInkColor] = useState<'#1e3a8a' | '#0f172a'>('#1e3a8a');
  const [hasDrawn, setHasDrawn] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

  useEffect(() => {
    setSignerName(user.name || 'Dr. Priya Rao');
    setSignerDesignation(user.designation || 'Faculty Placement & Leave Coordinator, CSE');
  }, [user.name, user.designation]);

  // View Pass / NOC / Application Clearance Modals
  const [passReq, setPassReq] = useState<LeaveRequest | null>(null);
  const [passNoc, setPassNoc] = useState<NocRequest | null>(null);
  const [passApp, setPassApp] = useState<ApplicationRecord | null>(null);

  // Student Roster Filters & Add Student Modal
  const [studentSearch, setStudentSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('All');
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStuName, setNewStuName] = useState('');
  const [newStuRoll, setNewStuRoll] = useState('');
  const [newStuEmail, setNewStuEmail] = useState('');
  const [newStuBranch, setNewStuBranch] = useState('CSE');
  const [newStuSem, setNewStuSem] = useState(5);
  const [newStuCompany, setNewStuCompany] = useState('');
  const [newStuRole, setNewStuRole] = useState('Software Engineering Intern');
  const [newStuTiming, setNewStuTiming] = useState('Mon–Fri · 09:30 AM – 06:00 PM');
  const [newStuStart, setNewStuStart] = useState(todayIso());
  const [newStuEnd, setNewStuEnd] = useState(todayIso());
  const [newStuEvent, setNewStuEvent] = useState('');
  const [newStuEventDate, setNewStuEventDate] = useState(todayIso());
  const [newStuEventTiming, setNewStuEventTiming] = useState('10:00 AM – 04:00 PM');
  const [newStuExamWindow, setNewStuExamWindow] = useState('Dec 05 – Dec 16');

  // Add Event / Edit Timing Modal for existing student
  const [editingStudent, setEditingStudent] = useState<StudentScheduleRecord | null>(null);
  const [modalMode, setModalMode] = useState<'event' | 'timing'>('event');
  const [evTitle, setEvTitle] = useState('');
  const [evDate, setEvDate] = useState(todayIso());
  const [evTiming, setEvTiming] = useState('10:00 AM – 01:00 PM');
  const [evCategory, setEvCategory] = useState<StudentEventItem['category']>('Hackathon');

  const [editCompany, setEditCompany] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editTiming, setEditTiming] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');

  // Calendar Selected Day
  const [selectedCalDay, setSelectedCalDay] = useState(todayIso());

  const pendingCount = leaveRequests.filter((r) => r.status === 'Pending').length;
  const approvedCount = leaveRequests.filter((r) => r.status === 'Approved').length;
  const rejectedCount = leaveRequests.filter((r) => r.status === 'Rejected').length;
  const pendingNocCount = nocRequests.filter((n) => n.status === 'Pending').length;
  const approvedNocCount = nocRequests.filter((n) => n.status === 'Approved').length;
  const pendingAppClearanceCount = applications.filter(
    (a) => a.stage !== 'Rejected' && a.facultyApproval?.status !== 'Approved' && a.facultyApproval?.status !== 'Rejected'
  ).length;
  const approvedAppClearanceCount = applications.filter(
    (a) => a.facultyApproval?.status === 'Approved'
  ).length;

  useEffect(() => {
    if (!signingTarget || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = inkColor;
    setHasDrawn(false);
  }, [signingTarget]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.strokeStyle = inkColor;
  }, [inkColor]);

  const getPointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    const pos = getPointerPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    setHasDrawn(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPointerPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const handlePointerUp = () => {
    isDrawingRef.current = false;
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const drawAutoSignatureStamp = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(32, 74);
    ctx.bezierCurveTo(56, 24, 92, 22, 86, 66);
    ctx.bezierCurveTo(82, 84, 118, 42, 146, 54);
    ctx.bezierCurveTo(172, 66, 206, 30, 238, 56);
    ctx.bezierCurveTo(266, 78, 302, 42, 348, 54);
    ctx.stroke();

    ctx.font = 'italic 600 13px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = inkColor;
    ctx.fillText(`Verified: ${signerName}`, 32, 102);
    setHasDrawn(true);
  };

  const submitSignatureDecision = (decision: 'Approved' | 'Rejected') => {
    if (!signingTarget || !canvasRef.current) return;
    if (!hasDrawn) {
      drawAutoSignatureStamp();
    }
    const dataUrl = canvasRef.current.toDataURL('image/png');
    const signaturePayload = {
      signerName: signerName.trim() || 'Dr. Priya Rao',
      signerDesignation: signerDesignation.trim() || 'Faculty Coordinator',
      signatureDataUrl: dataUrl,
      remarks: remarks.trim() || undefined,
    };

    if (signingTarget.kind === 'leave') {
      onSignLeaveRequest(signingTarget.req.id, decision, signaturePayload);
    } else if (signingTarget.kind === 'noc') {
      onSignNocRequest(signingTarget.req.id, decision, signaturePayload);
    } else {
      onSignApplication(signingTarget.req.id, decision, signaturePayload);
    }
    setSigningTarget(null);
    setRemarks('');
  };

  const filteredRequests = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leaveRequests.filter((r) => {
      if (statusFilter !== 'All' && r.status !== statusFilter) return false;
      if (q) {
        const hay = `${r.studentName} ${r.rollNumber} ${r.companyOrEvent} ${r.leaveType} ${r.branch}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [leaveRequests, statusFilter, search]);

  const filteredNocs = useMemo(() => {
    const q = nocSearch.trim().toLowerCase();
    return nocRequests.filter((n) => {
      if (nocFilter !== 'All' && n.status !== nocFilter) return false;
      if (q) {
        const hay = `${n.studentName} ${n.rollNumber} ${n.companyName} ${n.roleTitle} ${n.nocNumber}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [nocRequests, nocFilter, nocSearch]);

  const filteredApplications = useMemo(() => {
    const q = appSearch.trim().toLowerCase();
    return applications.filter((a) => {
      const approvalStatus = a.facultyApproval?.status || 'Pending';
      if (appFilter === 'Pending' && approvalStatus !== 'Pending') return false;
      if (appFilter === 'Allowed' && approvalStatus !== 'Approved') return false;
      if (appFilter === 'Rejected' && approvalStatus !== 'Rejected') return false;
      if (q) {
        const hay = `${a.applicantName} ${a.applicantEmail} ${a.company} ${a.roleTitle} ${a.attachedNocNumber || ''} ${a.attachedConsentCode || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [applications, appFilter, appSearch]);

  const branches = useMemo(() => {
    const set = new Set(studentSchedules.map((s) => s.branch));
    return ['All', ...Array.from(set)];
  }, [studentSchedules]);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    return studentSchedules.filter((s) => {
      if (branchFilter !== 'All' && s.branch !== branchFilter) return false;
      if (q) {
        const hay = `${s.studentName} ${s.rollNumber} ${s.internshipCompany} ${s.upcomingEvent} ${s.branch}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [studentSchedules, branchFilter, studentSearch]);

  const handleCreateStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStuName.trim() || !newStuRoll.trim()) return;
    onAddStudentSchedule({
      studentName: newStuName.trim(),
      rollNumber: newStuRoll.trim().toUpperCase(),
      email:
        newStuEmail.trim() ||
        `${newStuName.trim().toLowerCase().replace(/\s+/g, '.')}@ifheindia.org`,
      branch: newStuBranch.trim() || 'CSE',
      semester: newStuSem,
      internshipCompany: newStuCompany.trim() || 'Pending Placement',
      internshipRole: newStuRole.trim() || 'Software Intern',
      internshipTiming: newStuTiming.trim() || 'Mon–Fri · 09:30 AM – 06:00 PM',
      internshipStart: newStuStart,
      internshipEnd: newStuEnd,
      upcomingEvent: newStuEvent.trim() || 'Campus Technical Review',
      eventDate: newStuEventDate,
      eventTiming: newStuEventTiming.trim() || '10:00 AM – 01:00 PM',
      extraEvents: [],
      examWindow: newStuExamWindow.trim() || 'TBD',
      attendanceStatus: 'On Track',
    });
    setNewStuName('');
    setNewStuRoll('');
    setNewStuEmail('');
    setNewStuCompany('');
    setNewStuEvent('');
    setShowAddStudent(false);
  };

  const openEditStudentModal = (stu: StudentScheduleRecord, mode: 'event' | 'timing') => {
    setEditingStudent(stu);
    setModalMode(mode);
    setEvTitle('');
    setEvDate(todayIso());
    setEvTiming('10:00 AM – 01:00 PM');
    setEditCompany(stu.internshipCompany);
    setEditRole(stu.internshipRole);
    setEditTiming(stu.internshipTiming);
    setEditStart(stu.internshipStart);
    setEditEnd(stu.internshipEnd);
  };

  const handleSaveStudentEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    if (modalMode === 'event') {
      if (!evTitle.trim()) return;
      onAddStudentEvent(editingStudent.id, {
        title: evTitle.trim(),
        date: evDate,
        timing: evTiming.trim() || '10:00 AM – 01:00 PM',
        category: evCategory,
      });
    } else {
      onUpdateStudentTiming(editingStudent.id, {
        internshipCompany: editCompany.trim() || editingStudent.internshipCompany,
        internshipRole: editRole.trim() || editingStudent.internshipRole,
        internshipTiming: editTiming.trim() || editingStudent.internshipTiming,
        internshipStart: editStart || editingStudent.internshipStart,
        internshipEnd: editEnd || editingStudent.internshipEnd,
      });
    }
    setEditingStudent(null);
  };

  // Calendar aggregation for Faculty Calendar Tab
  const calendarModel = useMemo(() => {
    const today = todayIso();
    const now = new Date(`${today}T00:00:00`);
    const year = now.getFullYear();
    const month = now.getMonth();
    const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const eventsByDate = new Map<
      string,
      Array<{ student: string; title: string; timing: string; kind: string }>
    >();

    for (const s of studentSchedules) {
      const add = (iso: string, item: { student: string; title: string; timing: string; kind: string }) => {
        const list = eventsByDate.get(iso) ?? [];
        list.push(item);
        eventsByDate.set(iso, list);
      };
      if (s.eventDate) {
        add(s.eventDate, {
          student: s.studentName,
          title: s.upcomingEvent,
          timing: s.eventTiming,
          kind: 'Event',
        });
      }
      for (const extra of s.extraEvents ?? []) {
        add(extra.date, {
          student: s.studentName,
          title: extra.title,
          timing: extra.timing,
          kind: extra.category,
        });
      }
      if (s.internshipStart) {
        add(s.internshipStart, {
          student: s.studentName,
          title: `Internship Start: ${s.internshipCompany}`,
          timing: s.internshipTiming,
          kind: 'Internship',
        });
      }
    }

    const cells: Array<{
      iso: string | null;
      dayNum: number | null;
      count: number;
      daysLeft: number;
      isToday: boolean;
    }> = [];

    for (let i = 0; i < firstDay; i++) {
      cells.push({ iso: null, dayNum: null, count: 0, daysLeft: 99, isToday: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const list = eventsByDate.get(iso) ?? [];
      cells.push({
        iso,
        dayNum: d,
        count: list.length,
        daysLeft: daysBetween(today, iso),
        isToday: iso === today,
      });
    }

    return { monthLabel, cells, eventsByDate };
  }, [studentSchedules]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex items-start sm:items-center gap-4 min-w-0">
          <GoogleVAvatar
            name={user.name}
            email={user.email}
            role="faculty"
            size="lg"
            showRing={false}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#12805f] dark:text-[#5fe0b6] mb-0.5">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Faculty Coordinator Portal</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight truncate">
              {activeTab === 'approvals'
                ? 'Digital Leave & On-Duty Approvals'
                : activeTab === 'noc'
                ? 'NOC Permission Requests & Parent Consent Sheets'
                : activeTab === 'applications'
                ? 'Student Applications, Attached NOC & Program Clearances'
                : activeTab === 'students'
                ? 'Student Roster, Event Dates & Internship Timings'
                : 'Department Events & Internship Calendar'}
            </h1>
            <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc] mt-0.5 truncate">
              {user.name} · {user.designation || 'Faculty Coordinator'} · {user.email}
            </p>
          </div>
        </div>

        {/* Clean Hairline KPI Summary Strip */}
        <div className="grid grid-cols-5 divide-x divide-[#dbe3f0] dark:divide-[#24324d] rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-[#f8fafe] dark:bg-[#0e1626] shrink-0 overflow-hidden">
          <div className="px-3.5 py-2.5 text-center">
            <div className="font-mono text-lg font-extrabold text-[#2f5bea] dark:text-[#7a9bff] tabular-nums">
              {pendingAppClearanceCount}
            </div>
            <div className="text-[11px] font-medium text-[#5b6b86] dark:text-[#9fb0cc] whitespace-nowrap">
              Apps Due
            </div>
          </div>
          <div className="px-3.5 py-2.5 text-center">
            <div className="font-mono text-lg font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
              {pendingCount}
            </div>
            <div className="text-[11px] font-medium text-[#5b6b86] dark:text-[#9fb0cc] whitespace-nowrap">
              Leaves
            </div>
          </div>
          <div className="px-3.5 py-2.5 text-center">
            <div className="font-mono text-lg font-extrabold text-[#2f5bea] dark:text-[#7a9bff] tabular-nums">
              {pendingNocCount}
            </div>
            <div className="text-[11px] font-medium text-[#5b6b86] dark:text-[#9fb0cc] whitespace-nowrap">
              NOC Due
            </div>
          </div>
          <div className="px-3.5 py-2.5 text-center">
            <div className="font-mono text-lg font-extrabold text-[#12805f] dark:text-[#5fe0b6] tabular-nums">
              {approvedCount + approvedNocCount + approvedAppClearanceCount}
            </div>
            <div className="text-[11px] font-medium text-[#5b6b86] dark:text-[#9fb0cc] whitespace-nowrap">
              Signed
            </div>
          </div>
          <div className="px-3.5 py-2.5 text-center">
            <div className="font-mono text-lg font-extrabold tabular-nums">
              {studentSchedules.length}
            </div>
            <div className="text-[11px] font-medium text-[#5b6b86] dark:text-[#9fb0cc] whitespace-nowrap">
              Students
            </div>
          </div>
        </div>
      </div>

      {/* TAB 1: DIGITAL LEAVE APPROVALS */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(['All', 'Pending', 'Approved', 'Rejected'] as const).map((tab) => {
                const count =
                  tab === 'All'
                    ? leaveRequests.length
                    : tab === 'Pending'
                    ? pendingCount
                    : tab === 'Approved'
                    ? approvedCount
                    : rejectedCount;
                const active = statusFilter === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setStatusFilter(tab)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#2f5bea] text-white'
                        : 'bg-[#f3f6fb] dark:bg-[#0e1626] text-[#5b6b86] dark:text-[#9fb0cc] hover:text-[#12203a] dark:hover:text-white'
                    }`}
                  >
                    {tab} ({count})
                  </button>
                );
              })}
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-[#5b6b86] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search student, roll no, event..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-xs"
              />
            </div>
          </div>

          {/* Leave Cards */}
          {filteredRequests.length === 0 ? (
            <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-10 text-center text-sm text-[#5b6b86] dark:text-[#9fb0cc]">
              No leave requests match this filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredRequests.map((req) => {
                const daysUntil = daysBetween(todayIso(), req.startDate);
                const urg = getUrgencyClasses(daysUntil);
                return (
                  <div
                    key={req.id}
                    className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-5 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-bold">{req.studentName}</h3>
                            <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#f3f6fb] dark:bg-[#0e1626] text-[#5b6b86] dark:text-[#9fb0cc]">
                              {req.rollNumber}
                            </span>
                          </div>
                          <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc] mt-0.5">
                            {req.branch} · Semester {req.semester} · {req.studentEmail}
                          </p>
                        </div>

                        <span
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 ${
                            req.status === 'Approved'
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                              : req.status === 'Rejected'
                              ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300'
                              : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          {req.status}
                        </span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d] space-y-2">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-bold text-[#2f5bea] dark:text-[#7a9bff]">
                            {req.leaveType}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${urg.badge}`}>
                            {urg.label}
                          </span>
                        </div>
                        <p className="text-sm font-bold">{req.companyOrEvent}</p>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-[#5b6b86] dark:text-[#9fb0cc]">
                          <span className="inline-flex items-center gap-1 font-mono">
                            <CalendarIcon className="w-3.5 h-3.5" />
                            {formatShortDate(req.startDate)}
                            {req.endDate !== req.startDate ? ` – ${formatShortDate(req.endDate)}` : ''}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {req.timingNote}
                          </span>
                        </div>
                        <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc] leading-relaxed">
                          {req.reason}
                        </p>
                      </div>

                      {req.digitalSignature && (
                        <div className="p-3 rounded-xl border border-dashed border-[#c3cfe2] dark:border-[#2d3e63] bg-white dark:bg-[#0b1120] flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold text-[#12203a] dark:text-[#e8eefc]">
                              Signed by {req.digitalSignature.signerName}
                            </p>
                            <p className="text-[10px] font-mono text-[#5b6b86] dark:text-[#9fb0cc]">
                              {req.digitalSignature.verificationCode} ·{' '}
                              {formatShortDate(req.digitalSignature.signedAt)}
                            </p>
                            {req.digitalSignature.remarks && (
                              <p className="text-[11px] text-[#5b6b86] dark:text-[#9fb0cc] mt-1 truncate">
                                Note: {req.digitalSignature.remarks}
                              </p>
                            )}
                          </div>
                          <img
                            src={req.digitalSignature.signatureDataUrl}
                            alt={`Digital signature by ${req.digitalSignature.signerName}`}
                            className="h-12 w-32 object-contain bg-white rounded-lg border border-[#dbe3f0] px-1 shrink-0"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#dbe3f0] dark:border-[#24324d]">
                      <span className="text-[11px] text-[#5b6b86] dark:text-[#9fb0cc]">
                        Submitted {formatShortDate(req.submittedOn)}
                      </span>

                      <div className="flex items-center gap-2">
                        {req.digitalSignature && (
                          <button
                            type="button"
                            onClick={() => setPassReq(req)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] hover:border-[#2f5bea] text-xs font-bold cursor-pointer"
                          >
                            <FileCheck2 className="w-3.5 h-3.5 text-[#2f5bea] dark:text-[#7a9bff]" />
                            <span>View Signed Pass</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setSigningTarget({ kind: 'leave', req });
                            setRemarks(req.digitalSignature?.remarks || '');
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#2f5bea] hover:bg-[#244bc9] text-white text-xs font-bold cursor-pointer"
                        >
                          <PenTool className="w-3.5 h-3.5" />
                          <span>{req.status === 'Pending' ? 'Digitally Sign' : 'Re-sign'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 1B: NOC PERMISSION REQUESTS & PARENT CONSENT SHEETS */}
      {activeTab === 'noc' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-1.5 inline-flex gap-1">
              <button
                type="button"
                onClick={() => setNocSection('noc')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                  nocSection === 'noc'
                    ? 'bg-[#2f5bea] text-white'
                    : 'text-[#5b6b86] dark:text-[#9fb0cc] hover:text-[#12203a] dark:hover:text-white'
                }`}
              >
                <FileSignature className="w-3.5 h-3.5" />
                <span>NOC Requests ({nocRequests.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setNocSection('consents')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                  nocSection === 'consents'
                    ? 'bg-[#12805f] text-white'
                    : 'text-[#5b6b86] dark:text-[#9fb0cc] hover:text-[#12203a] dark:hover:text-white'
                }`}
              >
                <HeartHandshake className="w-3.5 h-3.5" />
                <span>Parent Consent Sheets ({parentConsents.length})</span>
              </button>
            </div>

            {nocSection === 'noc' && (
              <div className="flex flex-wrap items-center gap-2">
                {(['All', 'Pending', 'Approved', 'Rejected'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setNocFilter(tab)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                      nocFilter === tab
                        ? 'bg-[#12203a] dark:bg-[#2f5bea] text-white'
                        : 'bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] text-[#5b6b86] dark:text-[#9fb0cc]'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
                <div className="relative w-56">
                  <Search className="w-3.5 h-3.5 text-[#5b6b86] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={nocSearch}
                    onChange={(e) => setNocSearch(e.target.value)}
                    placeholder="Search student or company..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#131d33] text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {nocSection === 'noc' ? (
            filteredNocs.length === 0 ? (
              <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-10 text-center text-xs text-[#5b6b86] dark:text-[#9fb0cc]">
                No NOC requests match this filter.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredNocs.map((noc) => (
                  <div
                    key={noc.id}
                    className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-5 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="font-mono text-[11px] font-bold text-[#2f5bea] dark:text-[#7a9bff]">
                            {noc.nocNumber}
                          </span>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5">
                            <h3 className="text-base font-bold">{noc.studentName}</h3>
                            <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#f3f6fb] dark:bg-[#0e1626] text-[#5b6b86] dark:text-[#9fb0cc]">
                              {noc.rollNumber}
                            </span>
                          </div>
                          <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc]">
                            {noc.branch} · Sem {noc.semester} · {noc.studentEmail}
                          </p>
                        </div>

                        <span
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 ${
                            noc.status === 'Approved'
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                              : noc.status === 'Rejected'
                              ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300'
                              : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          {noc.status}
                        </span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d] space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-sm">
                            {noc.companyName} — {noc.roleTitle}
                          </span>
                          <span className="font-mono font-bold text-[#2f5bea] dark:text-[#7a9bff]">
                            {noc.stipendLabel}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-[#5b6b86] dark:text-[#9fb0cc]">
                          <span className="font-mono">
                            {formatShortDate(noc.internshipStart)} – {formatShortDate(noc.internshipEnd)}
                          </span>
                          <span>{noc.workMode} ({noc.location})</span>
                          <span>{noc.dailyTiming}</span>
                        </div>
                        <p className="text-[11px] text-[#5b6b86] dark:text-[#9fb0cc]">
                          HR: {noc.hrContactName} ({noc.hrContactEmail})
                        </p>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              noc.parentSigned
                                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                                : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300'
                            }`}
                          >
                            <HeartHandshake className="w-3 h-3" />
                            {noc.parentSigned
                              ? 'Parent Consent Sheet Attached'
                              : 'Parent Consent Missing'}
                          </span>
                          {noc.offerLetterName && (
                            <span className="font-mono text-[10px] text-[#5b6b86]">
                              {noc.offerLetterName}
                            </span>
                          )}
                        </div>
                      </div>

                      {noc.facultySignature && (
                        <div className="p-3 rounded-xl border border-dashed border-[#c3cfe2] dark:border-[#2d3e63] bg-white dark:bg-[#0b1120] flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-bold">
                              Signed by {noc.facultySignature.signerName}
                            </p>
                            <p className="text-[10px] font-mono text-[#5b6b86] dark:text-[#9fb0cc]">
                              {noc.facultySignature.verificationCode} ·{' '}
                              {formatShortDate(noc.facultySignature.signedAt)}
                            </p>
                          </div>
                          <img
                            src={noc.facultySignature.signatureDataUrl}
                            alt="Faculty Signature"
                            className="h-12 w-28 object-contain bg-white rounded-lg border border-[#dbe3f0] px-1"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#dbe3f0] dark:border-[#24324d]">
                      <span className="text-[11px] text-[#5b6b86] dark:text-[#9fb0cc]">
                        Submitted {formatShortDate(noc.submittedOn)}
                      </span>
                      <div className="flex items-center gap-2">
                        {noc.facultySignature && (
                          <button
                            type="button"
                            onClick={() => setPassNoc(noc)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] text-xs font-bold cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5 text-[#2f5bea]" />
                            <span>View NOC</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setSigningTarget({ kind: 'noc', req: noc });
                            setRemarks(noc.facultySignature?.remarks || '');
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#2f5bea] hover:bg-[#244bc9] text-white text-xs font-bold cursor-pointer"
                        >
                          <PenTool className="w-3.5 h-3.5" />
                          <span>{noc.status === 'Pending' ? 'Sign NOC' : 'Re-sign NOC'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {parentConsents.map((sheet) => (
                <div
                  key={sheet.id}
                  className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-5 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="font-mono text-[11px] font-bold text-[#12805f] dark:text-[#5fe0b6]">
                          {sheet.consentCode}
                        </span>
                        <h3 className="text-base font-bold mt-0.5">
                          {sheet.studentName} ({sheet.rollNumber})
                        </h3>
                        <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc]">
                          {sheet.companyOrEvent} · {sheet.workMode} ({sheet.internshipLocation})
                        </p>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 ${
                          sheet.facultyVerified
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                            : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {sheet.facultyVerified ? 'Verified' : 'Pending Review'}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d] text-xs grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[#5b6b86]">Guardian:</span>
                        <p className="font-bold">
                          {sheet.parentName} ({sheet.relationship})
                        </p>
                      </div>
                      <div>
                        <span className="text-[#5b6b86]">Phone / Emergency:</span>
                        <p className="font-mono font-semibold">{sheet.parentPhone}</p>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl border border-dashed border-[#c3cfe2] dark:border-[#2d3e63] bg-white dark:bg-[#0b1120] flex items-center justify-between gap-3">
                      <div className="text-[11px]">
                        <p className="font-bold">Guardian Signature Attached</p>
                        <p className="font-mono text-[#5b6b86]">
                          Signed {formatShortDate(sheet.signedOn)}
                        </p>
                      </div>
                      <img
                        src={sheet.parentSignatureDataUrl}
                        alt={`Guardian signature for ${sheet.studentName}`}
                        className="h-12 w-28 object-contain bg-white rounded-lg border border-[#dbe3f0] px-1"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#dbe3f0] dark:border-[#24324d] text-xs">
                    <span className="text-[11px] text-[#5b6b86]">
                      {sheet.verifiedBy ? `Verified by ${sheet.verifiedBy}` : 'Awaiting coordinator check'}
                    </span>
                    {!sheet.facultyVerified && (
                      <button
                        type="button"
                        onClick={() => onVerifyParentConsent(sheet.id)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#12805f] hover:opacity-90 text-white text-xs font-bold cursor-pointer"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Verify Parent Consent</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 1C: STUDENT APPLICATIONS, ATTACHED NOC & PARENT CONSENT SIGN-OFF */}
      {activeTab === 'applications' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'All', label: `All (${applications.length})` },
                  { id: 'Pending', label: `Pending Signature (${pendingAppClearanceCount})` },
                  {
                    id: 'Allowed',
                    label: `Open / Allowed for Program (${approvedAppClearanceCount})`,
                  },
                  {
                    id: 'Rejected',
                    label: `Not Cleared (${applications.filter((a) => a.facultyApproval?.status === 'Rejected').length})`,
                  },
                ] as const
              ).map((tab) => {
                const active = appFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setAppFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-[#2f5bea] text-white'
                        : 'bg-[#f3f6fb] dark:bg-[#0e1626] text-[#5b6b86] dark:text-[#9fb0cc] hover:text-[#12203a] dark:hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="relative w-full lg:w-72">
              <Search className="w-4 h-4 text-[#5b6b86] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={appSearch}
                onChange={(e) => setAppSearch(e.target.value)}
                placeholder="Search student, company, NOC #, Consent..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-xs"
              />
            </div>
          </div>

          {filteredApplications.length === 0 ? (
            <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-10 text-center text-xs text-[#5b6b86] dark:text-[#9fb0cc]">
              No student applications match this filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredApplications.map((app) => {
                const emailLower = app.applicantEmail.toLowerCase();
                const nameLower = app.applicantName.toLowerCase();
                const studentNocs = nocRequests.filter(
                  (n) =>
                    n.studentEmail.toLowerCase() === emailLower ||
                    n.studentName.toLowerCase() === nameLower
                );
                const studentConsents = parentConsents.filter(
                  (c) =>
                    c.studentEmail.toLowerCase() === emailLower ||
                    c.studentName.toLowerCase() === nameLower
                );

                const linkedNoc =
                  (app.attachedNocId && nocRequests.find((n) => n.id === app.attachedNocId)) ||
                  studentNocs.find((n) =>
                    n.companyName.toLowerCase().includes(app.company.toLowerCase())
                  );
                const linkedConsent =
                  (app.attachedConsentId &&
                    parentConsents.find((c) => c.id === app.attachedConsentId)) ||
                  (linkedNoc?.parentConsentId &&
                    parentConsents.find((c) => c.id === linkedNoc.parentConsentId)) ||
                  studentConsents.find((c) =>
                    c.companyOrEvent.toLowerCase().includes(app.company.toLowerCase())
                  );

                const clearance = app.facultyApproval?.programClearance || 'Pending Review';
                const approvalStatus = app.facultyApproval?.status || 'Pending';

                return (
                  <div
                    key={app.id}
                    className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-5 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-bold">{app.applicantName}</h3>
                            <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#f3f6fb] dark:bg-[#0e1626] text-[#5b6b86] dark:text-[#9fb0cc]">
                              {app.applicantBranch || 'CSE'} · Sem {app.applicantSemester || 5}
                            </span>
                          </div>
                          <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc] mt-0.5">
                            {app.applicantEmail} · Stage: <strong className="text-[#12203a] dark:text-[#e8eefc]">{app.stage}</strong>
                          </p>
                        </div>

                        <span
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 ${
                            approvalStatus === 'Approved'
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                              : approvalStatus === 'Rejected'
                              ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300'
                              : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          {clearance}
                        </span>
                      </div>

                      {/* Application Criteria Details */}
                      <div className="p-3.5 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d] space-y-1.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-sm">
                            {app.company} — {app.roleTitle}
                          </span>
                          <span className="font-mono text-[11px] text-[#5b6b86] dark:text-[#9fb0cc]">
                            {app.location}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#5b6b86] dark:text-[#9fb0cc]">
                          Resume: <strong className="text-[#12203a] dark:text-[#e8eefc]">{app.resumeUsed || 'Default CV'}</strong>
                          {app.applicationDetails?.cgpa ? ` · CGPA: ${app.applicationDetails.cgpa}` : ''}
                          {app.applicationDetails?.availability
                            ? ` · ${app.applicationDetails.availability}`
                            : ''}
                        </p>
                        {app.applicationDetails?.coverNote && (
                          <p className="text-[11px] text-[#5b6b86] dark:text-[#9fb0cc] line-clamp-2 leading-relaxed">
                            SOP: “{app.applicationDetails.coverNote}”
                          </p>
                        )}
                      </div>

                      {/* Attached NOC Request & Parent Consent Sheet */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                        {/* Attached NOC */}
                        <div className="p-3 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d] space-y-2">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="inline-flex items-center gap-1 font-bold text-[#2f5bea] dark:text-[#7a9bff] text-[11px]">
                              <FileSignature className="w-3.5 h-3.5" />
                              NOC Request
                            </span>
                            {linkedNoc && (
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  linkedNoc.status === 'Approved'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                                    : linkedNoc.status === 'Rejected'
                                    ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300'
                                    : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'
                                }`}
                              >
                                {linkedNoc.status}
                              </span>
                            )}
                          </div>

                          {linkedNoc ? (
                            <div className="space-y-1">
                              <p className="font-mono text-[11px] font-bold">{linkedNoc.nocNumber}</p>
                              <p className="text-[11px] text-[#5b6b86] dark:text-[#9fb0cc] truncate">
                                {linkedNoc.companyName} · {linkedNoc.workMode}
                              </p>
                              {linkedNoc.status === 'Pending' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSigningTarget({ kind: 'noc', req: linkedNoc });
                                    setRemarks('');
                                  }}
                                  className="text-[11px] font-bold text-[#2f5bea] dark:text-[#7a9bff] hover:underline cursor-pointer"
                                >
                                  Sign attached NOC →
                                </button>
                              )}
                            </div>
                          ) : (
                            <p className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold">
                              {app.attachedNocNumber || 'No NOC linked yet'}
                            </p>
                          )}

                          {studentNocs.length > 0 && (
                            <select
                              value={linkedNoc?.id || app.attachedNocId || ''}
                              onChange={(e) => {
                                const chosen = studentNocs.find((n) => n.id === e.target.value);
                                onAttachDocsToApplication(app.id, {
                                  attachedNocId: chosen?.id || '',
                                  attachedNocNumber: chosen?.nocNumber || '',
                                });
                              }}
                              aria-label="Link NOC Request"
                              className="w-full px-2 py-1 rounded-lg border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-[11px] font-semibold"
                            >
                              <option value="">Link student NOC...</option>
                              {studentNocs.map((n) => (
                                <option key={n.id} value={n.id}>
                                  {n.nocNumber} ({n.status})
                                </option>
                              ))}
                            </select>
                          )}
                        </div>

                        {/* Attached Parent Consent Sheet */}
                        <div className="p-3 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d] space-y-2">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="inline-flex items-center gap-1 font-bold text-[#12805f] dark:text-[#5fe0b6] text-[11px]">
                              <HeartHandshake className="w-3.5 h-3.5" />
                              Parent Consent
                            </span>
                            {linkedConsent && (
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  linkedConsent.facultyVerified
                                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'
                                }`}
                              >
                                {linkedConsent.facultyVerified ? 'Verified' : 'Signed'}
                              </span>
                            )}
                          </div>

                          {linkedConsent ? (
                            <div className="space-y-1">
                              <p className="font-mono text-[11px] font-bold">{linkedConsent.consentCode}</p>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] text-[#5b6b86] dark:text-[#9fb0cc] truncate">
                                  {linkedConsent.parentName} ({linkedConsent.relationship})
                                </span>
                                <img
                                  src={linkedConsent.parentSignatureDataUrl}
                                  alt="Parent signature"
                                  className="h-6 w-16 object-contain bg-white rounded border border-[#dbe3f0] shrink-0"
                                />
                              </div>
                              {!linkedConsent.facultyVerified && (
                                <button
                                  type="button"
                                  onClick={() => onVerifyParentConsent(linkedConsent.id)}
                                  className="text-[11px] font-bold text-[#12805f] dark:text-[#5fe0b6] hover:underline cursor-pointer"
                                >
                                  Verify guardian consent →
                                </button>
                              )}
                            </div>
                          ) : (
                            <p className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold">
                              {app.attachedConsentCode || 'No Parent Consent linked'}
                            </p>
                          )}

                          {studentConsents.length > 0 && (
                            <select
                              value={linkedConsent?.id || app.attachedConsentId || ''}
                              onChange={(e) => {
                                const chosen = studentConsents.find((c) => c.id === e.target.value);
                                onAttachDocsToApplication(app.id, {
                                  attachedConsentId: chosen?.id || '',
                                  attachedConsentCode: chosen?.consentCode || '',
                                });
                              }}
                              aria-label="Link Parent Consent Sheet"
                              className="w-full px-2 py-1 rounded-lg border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-[11px] font-semibold"
                            >
                              <option value="">Link consent sheet...</option>
                              {studentConsents.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.consentCode} ({c.parentName})
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>

                      {/* Faculty Digital Signature Preview */}
                      {app.facultyApproval?.digitalSignature && (
                        <div className="p-3 rounded-xl border border-dashed border-emerald-400 dark:border-emerald-700 bg-emerald-50/40 dark:bg-emerald-950/20 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold text-emerald-800 dark:text-emerald-200">
                              {app.facultyApproval.programClearance} · Signed by{' '}
                              {app.facultyApproval.digitalSignature.signerName}
                            </p>
                            <p className="text-[10px] font-mono text-[#5b6b86] dark:text-[#9fb0cc]">
                              {app.facultyApproval.digitalSignature.verificationCode} ·{' '}
                              {formatShortDate(app.facultyApproval.digitalSignature.signedAt)}
                            </p>
                            {app.organizerConfirmedAllowed && (
                              <p className="text-[10px] font-bold text-[#12805f] dark:text-[#5fe0b6] mt-0.5">
                                Organizer confirmed program entry
                              </p>
                            )}
                          </div>
                          <img
                            src={app.facultyApproval.digitalSignature.signatureDataUrl}
                            alt={`Faculty signature by ${app.facultyApproval.digitalSignature.signerName}`}
                            className="h-12 w-28 object-contain bg-white rounded-lg border border-[#dbe3f0] px-1 shrink-0"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#dbe3f0] dark:border-[#24324d]">
                      <span className="text-[11px] text-[#5b6b86] dark:text-[#9fb0cc]">
                        Applied {formatShortDate(app.appliedOn)}
                      </span>
                      <div className="flex items-center gap-2">
                        {app.facultyApproval?.digitalSignature && (
                          <button
                            type="button"
                            onClick={() => setPassApp(app)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] hover:border-[#2f5bea] text-xs font-bold cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5 text-[#2f5bea] dark:text-[#7a9bff]" />
                            <span>Clearance Pass</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              (linkedNoc && app.attachedNocId !== linkedNoc.id) ||
                              (linkedConsent && app.attachedConsentId !== linkedConsent.id)
                            ) {
                              onAttachDocsToApplication(app.id, {
                                attachedNocId: linkedNoc?.id || app.attachedNocId,
                                attachedNocNumber: linkedNoc?.nocNumber || app.attachedNocNumber,
                                attachedConsentId: linkedConsent?.id || app.attachedConsentId,
                                attachedConsentCode:
                                  linkedConsent?.consentCode || app.attachedConsentCode,
                              });
                            }
                            setSigningTarget({ kind: 'application', req: app });
                            setRemarks(app.facultyApproval?.digitalSignature?.remarks || '');
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#2f5bea] hover:bg-[#244bc9] text-white text-xs font-bold cursor-pointer"
                        >
                          <PenTool className="w-3.5 h-3.5" />
                          <span>
                            {app.facultyApproval?.digitalSignature
                              ? 'Re-sign'
                              : 'Digitally Sign & Allow'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: STUDENT ROSTER, EVENT DATES & INTERNSHIP TIMINGS */}
      {activeTab === 'students' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-[#5b6b86] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Search student, company, event..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-xs"
                />
              </div>

              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-xs font-semibold"
              >
                {branches.map((b) => (
                  <option key={b} value={b}>
                    {b === 'All' ? 'All Branches' : b}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setShowAddStudent(true)}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#2f5bea] hover:bg-[#244bc9] text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Student & Timing</span>
            </button>
          </div>

          <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#dbe3f0] dark:border-[#24324d] text-xs font-bold text-[#5b6b86] dark:text-[#9fb0cc]">
                    <th className="py-3.5 px-5">Student</th>
                    <th className="py-3.5 px-5">Internship & Shift Timing</th>
                    <th className="py-3.5 px-5">Event Dates & Timings</th>
                    <th className="py-3.5 px-5">Exam Window</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dbe3f0] dark:divide-[#24324d] text-xs">
                  {filteredStudents.map((stu) => {
                    const evDays = daysBetween(todayIso(), stu.eventDate);
                    const evUrg = getUrgencyClasses(evDays);
                    return (
                      <tr key={stu.id} className="hover:bg-[#f8fafe] dark:hover:bg-[#16213a] align-top">
                        <td className="py-4 px-5">
                          <div className="font-bold text-sm">{stu.studentName}</div>
                          <div className="font-mono text-[11px] text-[#5b6b86] dark:text-[#9fb0cc] mt-0.5">
                            {stu.rollNumber} · {stu.branch} Sem {stu.semester}
                          </div>
                          <span className="inline-block mt-1.5 px-2 py-0.5 rounded-md bg-[#e8eeff] dark:bg-[#1c2a50] text-[#2f5bea] dark:text-[#7a9bff] text-[10px] font-bold">
                            {stu.attendanceStatus}
                          </span>
                        </td>

                        <td className="py-4 px-5 min-w-[230px]">
                          <div className="font-bold flex items-center gap-1.5 text-sm">
                            <Briefcase className="w-3.5 h-3.5 text-[#2f5bea] dark:text-[#7a9bff] shrink-0" />
                            <span>{stu.internshipCompany}</span>
                          </div>
                          <div className="text-[#5b6b86] dark:text-[#9fb0cc] mt-0.5">
                            {stu.internshipRole}
                          </div>
                          <div className="inline-flex items-center gap-1 mt-1.5 font-mono text-[11px] font-semibold text-[#12203a] dark:text-[#e8eefc]">
                            <Clock className="w-3 h-3 text-[#2f5bea] dark:text-[#7a9bff]" />
                            <span>{stu.internshipTiming}</span>
                          </div>
                          <div className="text-[11px] text-[#5b6b86] dark:text-[#9fb0cc] mt-0.5 font-mono">
                            {formatShortDate(stu.internshipStart)} – {formatShortDate(stu.internshipEnd)}
                          </div>
                        </td>

                        <td className="py-4 px-5 min-w-[240px] space-y-2">
                          <div className="p-2.5 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d]">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold">{stu.upcomingEvent}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${evUrg.badge}`}>
                                {evUrg.label}
                              </span>
                            </div>
                            <div className="text-[11px] text-[#5b6b86] dark:text-[#9fb0cc] font-mono mt-1">
                              {formatShortDate(stu.eventDate)} · {stu.eventTiming}
                            </div>
                          </div>

                          {(stu.extraEvents ?? []).map((extra) => {
                            const dLeft = daysBetween(todayIso(), extra.date);
                            const u = getUrgencyClasses(dLeft);
                            return (
                              <div
                                key={extra.id}
                                className="p-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] flex items-center justify-between gap-2"
                              >
                                <div className="min-w-0">
                                  <p className="font-bold truncate">{extra.title}</p>
                                  <p className="text-[10px] font-mono text-[#5b6b86] dark:text-[#9fb0cc]">
                                    {formatShortDate(extra.date)} · {extra.timing}
                                  </p>
                                </div>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${u.badge}`}>
                                  {u.label}
                                </span>
                              </div>
                            );
                          })}
                        </td>

                        <td className="py-4 px-5 font-mono text-[11px] text-[#5b6b86] dark:text-[#9fb0cc] whitespace-nowrap">
                          {stu.examWindow}
                        </td>

                        <td className="py-4 px-5 text-right whitespace-nowrap space-y-1.5">
                          <div>
                            <button
                              type="button"
                              onClick={() => openEditStudentModal(stu, 'event')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#dbe3f0] dark:border-[#24324d] hover:border-[#2f5bea] text-[11px] font-bold cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Add Event</span>
                            </button>
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() => openEditStudentModal(stu, 'timing')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#dbe3f0] dark:border-[#24324d] hover:border-[#2f5bea] text-[11px] font-bold text-[#5b6b86] dark:text-[#9fb0cc] cursor-pointer"
                            >
                              <Clock className="w-3 h-3" />
                              <span>Edit Timing</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FACULTY EVENTS & INTERNSHIP CALENDAR */}
      {activeTab === 'calendar' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-7 bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold">{calendarModel.monthLabel}</h2>
                <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc]">
                  Student event dates & internship onboarding schedule
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold">
                <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" /> &lt;3 days
                </span>
                <span className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400">
                  <span className="w-2.5 h-2.5 rounded-sm bg-orange-500" /> 1–2 wks
                </span>
                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600" /> &gt;2 wks
                </span>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-[#5b6b86] dark:text-[#9fb0cc]">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {calendarModel.cells.map((cell, idx) => {
                if (!cell.iso || !cell.dayNum) {
                  return <div key={`e-${idx}`} className="h-11" />;
                }
                const urg = cell.count > 0 ? getUrgencyClasses(cell.daysLeft) : null;
                const isSelected = cell.iso === selectedCalDay;
                return (
                  <button
                    key={cell.iso}
                    type="button"
                    onClick={() => setSelectedCalDay(cell.iso!)}
                    className={`h-11 rounded-xl text-xs font-mono tabular-nums flex flex-col items-center justify-center transition-colors cursor-pointer ${
                      urg
                        ? urg.cell
                        : 'hover:bg-[#f3f6fb] dark:hover:bg-[#1a2744] text-[#12203a] dark:text-[#e8eefc]'
                    } ${isSelected ? 'ring-2 ring-[#2f5bea] ring-offset-1 dark:ring-offset-[#131d33]' : ''}`}
                  >
                    <span>{cell.dayNum}</span>
                    {cell.count > 0 && (
                      <span className="text-[9px] leading-none opacity-90">{cell.count} ev</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-5 bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">
                Schedule for {formatShortDate(selectedCalDay)}
              </h3>
              <Users className="w-4 h-4 text-[#2f5bea] dark:text-[#7a9bff]" />
            </div>

            {(calendarModel.eventsByDate.get(selectedCalDay) ?? []).length === 0 ? (
              <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc] py-6 text-center">
                No student events or onboarding milestones on this date.
              </p>
            ) : (
              <div className="space-y-2.5">
                {(calendarModel.eventsByDate.get(selectedCalDay) ?? []).map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d] space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold">{item.student}</span>
                      <span className="font-semibold text-[#2f5bea] dark:text-[#7a9bff]">
                        {item.kind}
                      </span>
                    </div>
                    <p className="text-xs font-semibold">{item.title}</p>
                    <p className="text-[11px] font-mono text-[#5b6b86] dark:text-[#9fb0cc]">
                      {item.timing}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* DIGITAL SIGNATURE APPROVAL MODAL (LEAVE OR NOC) */}
      {signingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-[2px]">
          <div className="w-full max-w-lg bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PenTool className="w-4 h-4 text-[#2f5bea] dark:text-[#7a9bff]" />
                <h3 className="text-base font-bold">
                  {signingTarget.kind === 'leave'
                    ? 'Digital Leave Approval & Signature'
                    : signingTarget.kind === 'noc'
                    ? 'Digital NOC Approval & Signature'
                    : 'Sign Student Application & Program Clearance'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSigningTarget(null)}
                className="p-1.5 rounded-lg text-[#5b6b86] hover:bg-[#f3f6fb] dark:hover:bg-[#16213a] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d] text-xs space-y-1">
              <p className="font-bold text-sm">
                {signingTarget.kind === 'application'
                  ? `${signingTarget.req.applicantName} (${signingTarget.req.applicantBranch || 'CSE'} · Sem ${signingTarget.req.applicantSemester || 5})`
                  : `${signingTarget.req.studentName} (${signingTarget.req.rollNumber})`}
              </p>
              {signingTarget.kind === 'leave' ? (
                <>
                  <p className="text-[#5b6b86] dark:text-[#9fb0cc]">
                    {signingTarget.req.leaveType} · {signingTarget.req.companyOrEvent}
                  </p>
                  <p className="font-mono text-[#2f5bea] dark:text-[#7a9bff]">
                    {formatShortDate(signingTarget.req.startDate)} –{' '}
                    {formatShortDate(signingTarget.req.endDate)} · {signingTarget.req.timingNote}
                  </p>
                </>
              ) : signingTarget.kind === 'noc' ? (
                <>
                  <p className="text-[#5b6b86] dark:text-[#9fb0cc]">
                    {signingTarget.req.nocNumber} · {signingTarget.req.companyName} ({signingTarget.req.roleTitle})
                  </p>
                  <p className="font-mono text-[#2f5bea] dark:text-[#7a9bff]">
                    {formatShortDate(signingTarget.req.internshipStart)} –{' '}
                    {formatShortDate(signingTarget.req.internshipEnd)} · {signingTarget.req.dailyTiming}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[#5b6b86] dark:text-[#9fb0cc]">
                    {signingTarget.req.company} — {signingTarget.req.roleTitle} ({signingTarget.req.location})
                  </p>
                  <p className="font-mono text-[#2f5bea] dark:text-[#7a9bff]">
                    NOC: {signingTarget.req.attachedNocNumber || 'Auto-matched / Optional'} · Parent Consent:{' '}
                    {signingTarget.req.attachedConsentCode || 'Auto-matched / Optional'}
                  </p>
                  <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 pt-0.5">
                    Approving notifies both Student and Organizer that candidate is Open / Allowed for Program.
                  </p>
                </>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1">
                  Faculty Signer Name
                </label>
                <input
                  type="text"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1">
                  Designation
                </label>
                <input
                  type="text"
                  value={signerDesignation}
                  onChange={(e) => setSignerDesignation(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-xs"
                />
              </div>
            </div>

            {/* Canvas Signature Pad */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold">Draw Faculty Digital Signature</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setInkColor('#1e3a8a')}
                    className={`w-4 h-4 rounded-full bg-[#1e3a8a] cursor-pointer ${
                      inkColor === '#1e3a8a' ? 'ring-2 ring-offset-1 ring-[#2f5bea]' : ''
                    }`}
                    title="Royal blue ink"
                  />
                  <button
                    type="button"
                    onClick={() => setInkColor('#0f172a')}
                    className={`w-4 h-4 rounded-full bg-[#0f172a] cursor-pointer ${
                      inkColor === '#0f172a' ? 'ring-2 ring-offset-1 ring-[#2f5bea]' : ''
                    }`}
                    title="Black ink"
                  />
                  <button
                    type="button"
                    onClick={drawAutoSignatureStamp}
                    className="px-2 py-1 rounded-lg bg-[#e8eeff] dark:bg-[#1c2a50] text-[#2f5bea] dark:text-[#7a9bff] text-[11px] font-bold cursor-pointer"
                  >
                    Quick Stamp
                  </button>
                  <button
                    type="button"
                    onClick={clearSignature}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[#dbe3f0] dark:border-[#24324d] text-[11px] font-semibold cursor-pointer"
                  >
                    <Eraser className="w-3 h-3" />
                    Clear
                  </button>
                </div>
              </div>

              <canvas
                ref={canvasRef}
                width={440}
                height={128}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                className="w-full h-32 rounded-xl border-2 border-dashed border-[#c3cfe2] dark:border-[#2d3e63] bg-white touch-none cursor-crosshair"
              />
              <p className="text-[11px] text-[#5b6b86] dark:text-[#9fb0cc]">
                Sign above with mouse, trackpad, or touch (or click Quick Stamp).
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1">
                Approval / Rejection Remarks
              </label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g. Approved OD. Submit attendance certificate after completion."
                className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => submitSignatureDecision('Rejected')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Sign & Reject</span>
              </button>
              <button
                type="button"
                onClick={() => submitSignatureDecision('Approved')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Digitally Sign & Approve</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW SIGNED DIGITAL PASS MODAL */}
      {passReq && passReq.digitalSignature && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-[2px]">
          <div className="w-full max-w-md bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#dbe3f0] dark:border-[#24324d] pb-3">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="text-sm font-extrabold">Official Digital Leave Pass</h3>
                  <p className="text-[11px] font-mono text-[#5b6b86]">
                    {passReq.digitalSignature.verificationCode}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPassReq(null)}
                className="p-1.5 rounded-lg text-[#5b6b86] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#5b6b86]">Student:</span>
                <span className="font-bold">
                  {passReq.studentName} ({passReq.rollNumber})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5b6b86]">Department:</span>
                <span className="font-semibold">
                  {passReq.branch} · Sem {passReq.semester}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5b6b86]">Category:</span>
                <span className="font-bold text-[#2f5bea]">{passReq.leaveType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5b6b86]">Company / Event:</span>
                <span className="font-bold text-right">{passReq.companyOrEvent}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5b6b86]">Dates & Timing:</span>
                <span className="font-mono font-bold text-right">
                  {formatShortDate(passReq.startDate)} – {formatShortDate(passReq.endDate)} ·{' '}
                  {passReq.timingNote}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5b6b86]">Status:</span>
                <span
                  className={`font-bold ${
                    passReq.status === 'Approved' ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {passReq.status}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d] space-y-2 text-center">
              <img
                src={passReq.digitalSignature.signatureDataUrl}
                alt="Verified Digital Signature"
                className="h-16 mx-auto bg-white rounded-lg border border-[#dbe3f0] px-3"
              />
              <p className="text-xs font-bold">{passReq.digitalSignature.signerName}</p>
              <p className="text-[11px] text-[#5b6b86]">
                {passReq.digitalSignature.signerDesignation} · Signed{' '}
                {formatShortDate(passReq.digitalSignature.signedAt)}
              </p>
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
                onClick={() => setPassReq(null)}
                className="px-4 py-2 rounded-xl bg-[#2f5bea] text-white text-xs font-bold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW SIGNED OFFICIAL NOC MODAL */}
      {passNoc && passNoc.facultySignature && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-[2px]">
          <div className="w-full max-w-md bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#dbe3f0] dark:border-[#24324d] pb-3">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-[#12805f]" />
                <div>
                  <h3 className="text-sm font-extrabold">Official Signed NOC Certificate</h3>
                  <p className="text-[11px] font-mono text-[#5b6b86]">
                    {passNoc.nocNumber} · {passNoc.facultySignature.verificationCode}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPassNoc(null)}
                className="p-1.5 rounded-lg text-[#5b6b86] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5 text-xs">
              <p>
                <strong>Student:</strong> {passNoc.studentName} ({passNoc.rollNumber})
              </p>
              <p>
                <strong>Company & Role:</strong> {passNoc.companyName} — {passNoc.roleTitle}
              </p>
              <p>
                <strong>Duration:</strong> {formatShortDate(passNoc.internshipStart)} –{' '}
                {formatShortDate(passNoc.internshipEnd)}
              </p>
              <p>
                <strong>Status:</strong>{' '}
                <span className={passNoc.status === 'Approved' ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                  {passNoc.status}
                </span>
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d] text-center space-y-1.5">
              <img
                src={passNoc.facultySignature.signatureDataUrl}
                alt="Verified Faculty Signature"
                className="h-14 mx-auto bg-white rounded-lg border border-[#dbe3f0] px-3"
              />
              <p className="text-xs font-bold">{passNoc.facultySignature.signerName}</p>
              <p className="text-[11px] text-[#5b6b86]">{passNoc.facultySignature.signerDesignation}</p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] text-xs font-bold cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print NOC</span>
              </button>
              <button
                type="button"
                onClick={() => setPassNoc(null)}
                className="px-4 py-2 rounded-xl bg-[#2f5bea] text-white text-xs font-bold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW OFFICIAL APPLICATION CLEARANCE PASS MODAL */}
      {passApp && passApp.facultyApproval?.digitalSignature && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-[2px]">
          <div className="w-full max-w-md bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#dbe3f0] dark:border-[#24324d] pb-3">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="text-sm font-extrabold">Official Program Clearance Pass</h3>
                  <p className="text-[11px] font-mono text-[#5b6b86]">
                    {passApp.facultyApproval.digitalSignature.verificationCode}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPassApp(null)}
                className="p-1.5 rounded-lg text-[#5b6b86] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5 text-xs">
              <p>
                <strong>Student:</strong> {passApp.applicantName} ({passApp.applicantEmail})
              </p>
              <p>
                <strong>Company & Role:</strong> {passApp.company} — {passApp.roleTitle}
              </p>
              <p>
                <strong>Attached NOC:</strong>{' '}
                <span className="font-mono">{passApp.attachedNocNumber || 'Linked in Faculty review'}</span>
              </p>
              <p>
                <strong>Attached Parent Consent:</strong>{' '}
                <span className="font-mono">{passApp.attachedConsentCode || 'Linked in Faculty review'}</span>
              </p>
              <p>
                <strong>Program Status:</strong>{' '}
                <span
                  className={`font-bold ${
                    passApp.facultyApproval.status === 'Approved'
                      ? 'text-emerald-600'
                      : 'text-rose-600'
                  }`}
                >
                  {passApp.facultyApproval.programClearance}
                </span>
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d] text-center space-y-1.5">
              <img
                src={passApp.facultyApproval.digitalSignature.signatureDataUrl}
                alt="Verified Faculty Signature"
                className="h-14 mx-auto bg-white rounded-lg border border-[#dbe3f0] px-3"
              />
              <p className="text-xs font-bold">
                {passApp.facultyApproval.digitalSignature.signerName}
              </p>
              <p className="text-[11px] text-[#5b6b86]">
                {passApp.facultyApproval.digitalSignature.signerDesignation}
              </p>
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
                onClick={() => setPassApp(null)}
                className="px-4 py-2 rounded-xl bg-[#2f5bea] text-white text-xs font-bold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD STUDENT & TIMING MODAL */}
      {showAddStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-[2px]">
          <div className="w-full max-w-lg bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Add Student, Event Date & Internship Timing</h3>
              <button
                type="button"
                onClick={() => setShowAddStudent(false)}
                className="p-1.5 rounded-lg text-[#5b6b86] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateStudent} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#5b6b86] mb-1">Student Name</label>
                  <input
                    type="text"
                    required
                    value={newStuName}
                    onChange={(e) => setNewStuName(e.target.value)}
                    placeholder="e.g. Karthik Rao"
                    className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#5b6b86] mb-1">Roll Number</label>
                  <input
                    type="text"
                    required
                    value={newStuRoll}
                    onChange={(e) => setNewStuRoll(e.target.value)}
                    placeholder="e.g. 23IFHE0412"
                    className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#5b6b86] mb-1">Branch</label>
                  <input
                    type="text"
                    value={newStuBranch}
                    onChange={(e) => setNewStuBranch(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#5b6b86] mb-1">Semester</label>
                  <select
                    value={newStuSem}
                    onChange={(e) => setNewStuSem(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120]"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={s}>
                        Sem {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#5b6b86] mb-1">Email</label>
                  <input
                    type="email"
                    value={newStuEmail}
                    onChange={(e) => setNewStuEmail(e.target.value)}
                    placeholder="student@uni.edu"
                    className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#5b6b86] mb-1">
                    Internship Company
                  </label>
                  <input
                    type="text"
                    value={newStuCompany}
                    onChange={(e) => setNewStuCompany(e.target.value)}
                    placeholder="e.g. Google India"
                    className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#5b6b86] mb-1">Role</label>
                  <input
                    type="text"
                    value={newStuRole}
                    onChange={(e) => setNewStuRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-3 sm:col-span-1">
                  <label className="block font-semibold text-[#5b6b86] mb-1">
                    Internship Timing
                  </label>
                  <input
                    type="text"
                    value={newStuTiming}
                    onChange={(e) => setNewStuTiming(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#5b6b86] mb-1">Start Date</label>
                  <input
                    type="date"
                    value={newStuStart}
                    onChange={(e) => setNewStuStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#5b6b86] mb-1">End Date</label>
                  <input
                    type="date"
                    value={newStuEnd}
                    onChange={(e) => setNewStuEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#5b6b86] mb-1">Event Name</label>
                  <input
                    type="text"
                    value={newStuEvent}
                    onChange={(e) => setNewStuEvent(e.target.value)}
                    placeholder="Hackathon / Interview"
                    className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#5b6b86] mb-1">Event Date</label>
                  <input
                    type="date"
                    value={newStuEventDate}
                    onChange={(e) => setNewStuEventDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#5b6b86] mb-1">Event Timing</label>
                  <input
                    type="text"
                    value={newStuEventTiming}
                    onChange={(e) => setNewStuEventTiming(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#5b6b86] mb-1">Exam Window</label>
                <input
                  type="text"
                  value={newStuExamWindow}
                  onChange={(e) => setNewStuExamWindow(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddStudent(false)}
                  className="px-4 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#2f5bea] text-white font-bold cursor-pointer"
                >
                  Save Student Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD EVENT / EDIT TIMING MODAL FOR EXISTING STUDENT */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-[2px]">
          <div className="w-full max-w-md bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">
                {modalMode === 'event'
                  ? `Add Event Date for ${editingStudent.studentName}`
                  : `Update Internship Timing — ${editingStudent.studentName}`}
              </h3>
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="p-1.5 rounded-lg text-[#5b6b86] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStudentEdit} className="space-y-3 text-xs">
              {modalMode === 'event' ? (
                <>
                  <div>
                    <label className="block font-semibold text-[#5b6b86] mb-1">
                      Event / Assessment Title
                    </label>
                    <input
                      type="text"
                      required
                      value={evTitle}
                      onChange={(e) => setEvTitle(e.target.value)}
                      placeholder="e.g. Google Technical Round 2"
                      className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-[#5b6b86] mb-1">Date</label>
                      <input
                        type="date"
                        value={evDate}
                        onChange={(e) => setEvDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#5b6b86] mb-1">Category</label>
                      <select
                        value={evCategory}
                        onChange={(e) =>
                          setEvCategory(e.target.value as StudentEventItem['category'])
                        }
                        className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120]"
                      >
                        <option value="Hackathon">Hackathon</option>
                        <option value="Interview">Interview</option>
                        <option value="Workshop">Workshop</option>
                        <option value="Review">Review</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-[#5b6b86] mb-1">Event Timing</label>
                    <input
                      type="text"
                      value={evTiming}
                      onChange={(e) => setEvTiming(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120]"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block font-semibold text-[#5b6b86] mb-1">Company</label>
                    <input
                      type="text"
                      value={editCompany}
                      onChange={(e) => setEditCompany(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#5b6b86] mb-1">Role</label>
                    <input
                      type="text"
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#5b6b86] mb-1">
                      Daily Internship Timing
                    </label>
                    <input
                      type="text"
                      value={editTiming}
                      onChange={(e) => setEditTiming(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-[#5b6b86] mb-1">Start Date</label>
                      <input
                        type="date"
                        value={editStart}
                        onChange={(e) => setEditStart(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#5b6b86] mb-1">End Date</label>
                      <input
                        type="date"
                        value={editEnd}
                        onChange={(e) => setEditEnd(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] font-mono"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#2f5bea] text-white font-bold cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
