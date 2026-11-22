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
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import type {
  LeaveRequest,
  NocRequest,
  Opportunity,
  ParentConsentSheet,
  StudentProfile,
  WorkMode,
} from '../types';
import { formatShortDate, offsetIso, todayIso } from '../utils/matching';

interface StudentApprovalsViewProps {
  profile: StudentProfile;
  userEmail: string;
  userName: string;
  opportunities: Opportunity[];
  nocRequests: NocRequest[];
  parentConsents: ParentConsentSheet[];
  leaveRequests: LeaveRequest[];
  onSubmitNocRequest: (payload: {
    companyName: string;
    roleTitle: string;
    workMode: WorkMode;
    location: string;
    stipendLabel: string;
    internshipStart: string;
    internshipEnd: string;
    dailyTiming: string;
    hrContactName: string;
    hrContactEmail: string;
    offerLetterName?: string;
    parentConsentId?: string;
    academicRemarks?: string;
  }) => void;
  onSubmitParentConsent: (payload: {
    parentName: string;
    relationship: 'Father' | 'Mother' | 'Legal Guardian';
    parentPhone: string;
    parentEmail: string;
    emergencyContact: string;
    companyOrEvent: string;
    internshipLocation: string;
    workMode: WorkMode;
    startDate: string;
    endDate: string;
    travelAndStayConfirmed: boolean;
    medicalInsuranceConfirmed: boolean;
    academicAttendanceUnderstood: boolean;
    parentSignatureDataUrl: string;
  }) => void;
}

export const StudentApprovalsView: React.FC<StudentApprovalsViewProps> = ({
  profile,
  userEmail,
  userName,
  opportunities,
  nocRequests,
  parentConsents,
  leaveRequests,
  onSubmitNocRequest,
  onSubmitParentConsent,
}) => {
  const [activeSection, setActiveSection] = useState<'noc' | 'consent' | 'leaves'>('noc');

  // NOC Request Form modal
  const [showNocModal, setShowNocModal] = useState(false);
  const [nocCompany, setNocCompany] = useState('TechCorp India');
  const [nocRole, setNocRole] = useState('Full Stack Developer Intern');
  const [nocMode, setNocMode] = useState<WorkMode>('Remote');
  const [nocLocation, setNocLocation] = useState('Remote / Hyderabad');
  const [nocStipend, setNocStipend] = useState('₹40,000 / mo');
  const [nocStart, setNocStart] = useState(offsetIso(30));
  const [nocEnd, setNocEnd] = useState(offsetIso(120));
  const [nocTiming, setNocTiming] = useState('Mon–Fri · 10:00 AM – 06:00 PM IST');
  const [nocHrName, setNocHrName] = useState('');
  const [nocHrEmail, setNocHrEmail] = useState('');
  const [nocOfferName, setNocOfferName] = useState('Offer_Letter_2026.pdf');
  const [selectedConsentId, setSelectedConsentId] = useState('');
  const [nocRemarks, setNocRemarks] = useState('');

  // Official Printable Modals
  const [viewingNoc, setViewingNoc] = useState<NocRequest | null>(null);
  const [viewingConsent, setViewingConsent] = useState<ParentConsentSheet | null>(null);

  // Parent Consent Sheet Form modal
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [parentName, setParentName] = useState('');
  const [relationship, setRelationship] = useState<'Father' | 'Mother' | 'Legal Guardian'>('Father');
  const [parentPhone, setParentPhone] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [consentCompany, setConsentCompany] = useState('TechCorp India — Full Stack Developer Intern');
  const [consentLocation, setConsentLocation] = useState('Remote / Hyderabad');
  const [consentMode, setConsentMode] = useState<WorkMode>('Remote');
  const [consentStart, setConsentStart] = useState(offsetIso(30));
  const [consentEnd, setConsentEnd] = useState(offsetIso(120));
  const [confirmTravel, setConfirmTravel] = useState(true);
  const [confirmMedical, setConfirmMedical] = useState(true);
  const [confirmAcademic, setConfirmAcademic] = useState(true);

  // Guardian Canvas Signature Pad
  const [inkColor, setInkColor] = useState<'#0f172a' | '#1e3a8a'>('#0f172a');
  const [hasSignedConsent, setHasSignedConsent] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

  const myNocs = useMemo(
    () =>
      nocRequests.filter(
        (n) =>
          n.studentEmail === userEmail ||
          n.studentName.toLowerCase() === (profile.name || userName).toLowerCase()
      ),
    [nocRequests, userEmail, profile.name, userName]
  );

  const myConsents = useMemo(
    () =>
      parentConsents.filter(
        (c) =>
          c.studentEmail === userEmail ||
          c.studentName.toLowerCase() === (profile.name || userName).toLowerCase()
      ),
    [parentConsents, userEmail, profile.name, userName]
  );

  const myLeaves = useMemo(
    () =>
      leaveRequests.filter(
        (lv) =>
          lv.studentEmail === userEmail ||
          lv.studentName.toLowerCase() === (profile.name || userName).toLowerCase()
      ),
    [leaveRequests, userEmail, profile.name, userName]
  );

  useEffect(() => {
    if (myConsents.length > 0 && !selectedConsentId) {
      setSelectedConsentId(myConsents[0].id);
    }
  }, [myConsents, selectedConsentId]);

  useEffect(() => {
    if (!showConsentModal || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = inkColor;
    setHasSignedConsent(false);
  }, [showConsentModal]);

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
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    setHasSignedConsent(true);
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

  const clearPad = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignedConsent(false);
  };

  const applySampleGuardianSign = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(28, 70);
    ctx.bezierCurveTo(48, 22, 82, 22, 84, 62);
    ctx.bezierCurveTo(86, 82, 118, 36, 144, 52);
    ctx.bezierCurveTo(170, 68, 206, 26, 238, 52);
    ctx.bezierCurveTo(266, 74, 306, 38, 344, 48);
    ctx.stroke();
    ctx.font = 'italic 600 12px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = inkColor;
    ctx.fillText(`Guardian: ${parentName.trim() || 'Parent / Guardian'}`, 28, 98);
    setHasSignedConsent(true);
  };

  const handlePrefillFromOpp = (oppId: string) => {
    const found = opportunities.find((o) => o.id === oppId);
    if (!found) return;
    setNocCompany(found.company);
    setNocRole(found.title);
    setNocMode(found.mode);
    setNocLocation(found.location);
    setNocStipend(
      found.stipendLabel || (found.stipend > 0 ? `₹${found.stipend.toLocaleString('en-IN')} / mo` : 'Unpaid / Credit')
    );
    setNocStart(found.startDate || offsetIso(25));
    setNocEnd(found.endDate || offsetIso(115));
  };

  const handleCreateNoc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nocCompany.trim() || !nocRole.trim()) return;
    onSubmitNocRequest({
      companyName: nocCompany.trim(),
      roleTitle: nocRole.trim(),
      workMode: nocMode,
      location: nocLocation.trim() || 'Remote',
      stipendLabel: nocStipend.trim() || 'Unpaid',
      internshipStart: nocStart,
      internshipEnd: nocEnd,
      dailyTiming: nocTiming.trim() || 'Mon–Fri · 09:30 AM – 06:00 PM IST',
      hrContactName: nocHrName.trim() || 'Campus Recruiting Lead',
      hrContactEmail: nocHrEmail.trim() || 'hr@company.com',
      offerLetterName: nocOfferName.trim() || undefined,
      parentConsentId: selectedConsentId || undefined,
      academicRemarks: nocRemarks.trim() || undefined,
    });
    setShowNocModal(false);
    setNocHrName('');
    setNocHrEmail('');
    setNocRemarks('');
  };

  const handleCreateConsent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentName.trim() || !parentPhone.trim() || !canvasRef.current) return;
    if (!hasSignedConsent) {
      applySampleGuardianSign();
    }
    const sigUrl = canvasRef.current.toDataURL('image/png');
    onSubmitParentConsent({
      parentName: parentName.trim(),
      relationship,
      parentPhone: parentPhone.trim(),
      parentEmail: parentEmail.trim() || 'guardian@email.com',
      emergencyContact: emergencyContact.trim() || parentPhone.trim(),
      companyOrEvent: consentCompany.trim(),
      internshipLocation: consentLocation.trim() || 'Hyderabad',
      workMode: consentMode,
      startDate: consentStart,
      endDate: consentEnd,
      travelAndStayConfirmed: confirmTravel,
      medicalInsuranceConfirmed: confirmMedical,
      academicAttendanceUnderstood: confirmAcademic,
      parentSignatureDataUrl: sigUrl,
    });
    setShowConsentModal(false);
    setParentName('');
    setParentPhone('');
    setParentEmail('');
    setEmergencyContact('');
  };

  const approvedNocs = myNocs.filter((n) => n.status === 'Approved').length;
  const verifiedConsents = myConsents.filter((c) => c.facultyVerified).length;

  return (
    <div className="space-y-6">
      {/* Header Summary Banner */}
      <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#2f5bea] dark:text-[#7a9bff] mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Student Permission Center · Synced Live with Faculty Portal</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Approvals, NOC Requests & Parent Consent Sheet
          </h2>
          <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc] mt-1">
            Submit official No Objection Certificate (NOC) requests for Faculty signature and upload signed Parent Consent Sheets for internship & event clearance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveSection('consent');
              setShowConsentModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-[#2f5bea] text-[#2f5bea] dark:text-[#7a9bff] hover:bg-[#e8eeff] dark:hover:bg-[#1c2a50] text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
          >
            <HeartHandshake className="w-4 h-4" />
            <span>Fill Parent Consent Sheet</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveSection('noc');
              setShowNocModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#2f5bea] hover:bg-[#244bc9] text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Request NOC Permission</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc]">NOC Requests</p>
            <p className="text-2xl font-extrabold tabular-nums mt-0.5">{myNocs.length}</p>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
              {approvedNocs} digitally signed by Faculty
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#e8eeff] dark:bg-[#1c2a50] text-[#2f5bea] dark:text-[#7a9bff] flex items-center justify-center">
            <FileSignature className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc]">
              Parent Consent Sheets
            </p>
            <p className="text-2xl font-extrabold tabular-nums mt-0.5">{myConsents.length}</p>
            <p className="text-[11px] text-[#2f5bea] dark:text-[#7a9bff] font-semibold mt-0.5">
              {verifiedConsents} verified by Coordinator
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <HeartHandshake className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc]">Leave / OD Passes</p>
            <p className="text-2xl font-extrabold tabular-nums mt-0.5">{myLeaves.length}</p>
            <p className="text-[11px] text-[#5b6b86] dark:text-[#9fb0cc] font-semibold mt-0.5">
              {myLeaves.filter((l) => l.status === 'Approved').length} active passes
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <FileCheck2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Sub-navigation tabs */}
      <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-2 inline-flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setActiveSection('noc')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
            activeSection === 'noc'
              ? 'bg-[#2f5bea] text-white'
              : 'text-[#5b6b86] dark:text-[#9fb0cc] hover:bg-[#f3f6fb] dark:hover:bg-[#16213a]'
          }`}
        >
          <FileSignature className="w-3.5 h-3.5" />
          <span>1. NOC Requests ({myNocs.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('consent')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
            activeSection === 'consent'
              ? 'bg-[#12805f] text-white'
              : 'text-[#5b6b86] dark:text-[#9fb0cc] hover:bg-[#f3f6fb] dark:hover:bg-[#16213a]'
          }`}
        >
          <HeartHandshake className="w-3.5 h-3.5" />
          <span>2. Parent Consent Sheet ({myConsents.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('leaves')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
            activeSection === 'leaves'
              ? 'bg-[#12203a] dark:bg-[#2f5bea] text-white'
              : 'text-[#5b6b86] dark:text-[#9fb0cc] hover:bg-[#f3f6fb] dark:hover:bg-[#16213a]'
          }`}
        >
          <FileCheck2 className="w-3.5 h-3.5" />
          <span>3. Leave & OD Passes ({myLeaves.length})</span>
        </button>
      </div>

      {/* SECTION 1: NOC REQUESTS */}
      {activeSection === 'noc' && (
        <div className="space-y-4">
          {myNocs.length === 0 ? (
            <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-10 text-center space-y-3">
              <p className="text-sm font-bold">No NOC requests submitted yet</p>
              <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc]">
                Need an official No Objection Certificate for an internship? Request one for instant Faculty digital approval.
              </p>
              <button
                type="button"
                onClick={() => setShowNocModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2f5bea] text-white text-xs font-bold cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Request NOC Permission</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {myNocs.map((noc) => (
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
                        <h3 className="text-base font-extrabold mt-0.5">{noc.companyName}</h3>
                        <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc]">
                          {noc.roleTitle} · {noc.workMode} ({noc.location}) · {noc.stipendLabel}
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
                        {noc.status === 'Approved'
                          ? 'Signed & Issued'
                          : noc.status === 'Rejected'
                          ? 'Declined'
                          : 'Awaiting Faculty Sign'}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d] space-y-1.5 text-xs">
                      <div className="flex flex-wrap items-center gap-3 text-[#5b6b86] dark:text-[#9fb0cc]">
                        <span className="inline-flex items-center gap-1 font-mono">
                          <CalendarIcon className="w-3.5 h-3.5" />
                          {formatShortDate(noc.internshipStart)} – {formatShortDate(noc.internshipEnd)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {noc.dailyTiming}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#5b6b86] dark:text-[#9fb0cc]">
                        HR Contact: <strong className="text-[#12203a] dark:text-[#e8eefc]">{noc.hrContactName}</strong> ({noc.hrContactEmail})
                      </p>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            noc.parentSigned
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                              : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          <HeartHandshake className="w-3 h-3" />
                          {noc.parentSigned ? 'Parent Consent Attached' : 'Parent Consent Not Linked'}
                        </span>
                        {noc.offerLetterName && (
                          <span className="text-[10px] font-mono text-[#5b6b86] dark:text-[#9fb0cc]">
                            Doc: {noc.offerLetterName}
                          </span>
                        )}
                      </div>
                    </div>

                    {noc.facultySignature && (
                      <div className="p-3 rounded-xl border border-dashed border-emerald-400 dark:border-emerald-700 bg-emerald-50/40 dark:bg-emerald-950/20 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-emerald-800 dark:text-emerald-200">
                            Digitally Signed by {noc.facultySignature.signerName}
                          </p>
                          <p className="text-[10px] font-mono text-[#5b6b86] dark:text-[#9fb0cc]">
                            Code: {noc.facultySignature.verificationCode} ·{' '}
                            {formatShortDate(noc.facultySignature.signedAt)}
                          </p>
                          {noc.facultySignature.remarks && (
                            <p className="text-[11px] text-[#5b6b86] dark:text-[#9fb0cc] mt-1">
                              {noc.facultySignature.remarks}
                            </p>
                          )}
                        </div>
                        <img
                          src={noc.facultySignature.signatureDataUrl}
                          alt={`Faculty signature by ${noc.facultySignature.signerName}`}
                          className="h-12 w-28 object-contain bg-white rounded-lg border border-[#dbe3f0] px-1 shrink-0"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#dbe3f0] dark:border-[#24324d] text-[11px]">
                    <span className="text-[#5b6b86] dark:text-[#9fb0cc]">
                      Requested {formatShortDate(noc.submittedOn)}
                    </span>
                    {noc.facultySignature ? (
                      <button
                        type="button"
                        onClick={() => setViewingNoc(noc)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#12805f] hover:opacity-90 text-white text-xs font-bold cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>View & Print NOC</span>
                      </button>
                    ) : (
                      <span className="font-semibold text-[#5b6b86] dark:text-[#9fb0cc]">
                        Visible in Faculty → NOC & Consent
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: PARENT CONSENT SHEETS */}
      {activeSection === 'consent' && (
        <div className="space-y-4">
          <div className="bg-[#f8fafe] dark:bg-[#111a2e] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-[#5b6b86] dark:text-[#9fb0cc]">
              <strong className="text-[#12203a] dark:text-[#e8eefc]">Why Parent Consent Sheet?</strong>{' '}
              Required by IFHE Faculty Coordinator before approving on-site/hybrid internships, outstation hackathons, or issuing a college NOC.
            </div>
            <button
              type="button"
              onClick={() => setShowConsentModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#12805f] hover:opacity-90 text-white text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>Sign New Consent Sheet</span>
            </button>
          </div>

          {myConsents.length === 0 ? (
            <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-10 text-center space-y-3">
              <p className="text-sm font-bold">No Parent Consent Sheets signed yet</p>
              <button
                type="button"
                onClick={() => setShowConsentModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#12805f] text-white text-xs font-bold cursor-pointer"
              >
                <PenTool className="w-4 h-4" />
                <span>Sign Parent Consent Sheet</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {myConsents.map((sheet) => (
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
                        <h3 className="text-base font-extrabold mt-0.5">{sheet.companyOrEvent}</h3>
                        <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc]">
                          {sheet.workMode} · {sheet.internshipLocation} ·{' '}
                          {formatShortDate(sheet.startDate)} – {formatShortDate(sheet.endDate)}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 ${
                          sheet.facultyVerified
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                            : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {sheet.facultyVerified ? (
                          <>
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Faculty Verified</span>
                          </>
                        ) : (
                          <span>Awaiting Verification</span>
                        )}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d] grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[#5b6b86] dark:text-[#9fb0cc]">Parent / Guardian:</span>
                        <p className="font-bold">
                          {sheet.parentName} ({sheet.relationship})
                        </p>
                      </div>
                      <div>
                        <span className="text-[#5b6b86] dark:text-[#9fb0cc]">Guardian Contact:</span>
                        <p className="font-mono font-semibold">{sheet.parentPhone}</p>
                      </div>
                      <div>
                        <span className="text-[#5b6b86] dark:text-[#9fb0cc]">Emergency Phone:</span>
                        <p className="font-mono font-semibold">{sheet.emergencyContact}</p>
                      </div>
                      <div>
                        <span className="text-[#5b6b86] dark:text-[#9fb0cc]">Declarations:</span>
                        <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                          Travel · Medical · Academic OK
                        </p>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl border border-dashed border-[#c3cfe2] dark:border-[#2d3e63] bg-white dark:bg-[#0b1120] flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-bold">
                          Signed by {sheet.parentName} ({sheet.relationship})
                        </p>
                        <p className="text-[10px] font-mono text-[#5b6b86] dark:text-[#9fb0cc]">
                          Signed {formatShortDate(sheet.signedOn)}
                          {sheet.verifiedBy ? ` · Verified by ${sheet.verifiedBy}` : ''}
                        </p>
                      </div>
                      <img
                        src={sheet.parentSignatureDataUrl}
                        alt={`Parent signature by ${sheet.parentName}`}
                        className="h-12 w-28 object-contain bg-white rounded-lg border border-[#dbe3f0] px-1 shrink-0"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end pt-2 border-t border-[#dbe3f0] dark:border-[#24324d]">
                    <button
                      type="button"
                      onClick={() => setViewingConsent(sheet)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] hover:border-[#2f5bea] text-xs font-bold cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-[#2f5bea] dark:text-[#7a9bff]" />
                      <span>View & Print Consent Sheet</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: LEAVE & OD PASSES SUMMARY */}
      {activeSection === 'leaves' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {myLeaves.length === 0 ? (
            <div className="md:col-span-2 bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-8 text-center text-xs text-[#5b6b86] dark:text-[#9fb0cc]">
              No leave or on-duty passes submitted yet. Use <strong>My Applications → Faculty Leave Passes</strong> to apply for event or onboarding leave.
            </div>
          ) : (
            myLeaves.map((lv) => (
              <div
                key={lv.id}
                className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-bold text-[#2f5bea] dark:text-[#7a9bff]">
                      {lv.leaveType}
                    </span>
                    <h4 className="text-sm font-bold mt-0.5">{lv.companyOrEvent}</h4>
                    <p className="text-xs font-mono text-[#5b6b86] dark:text-[#9fb0cc]">
                      {formatShortDate(lv.startDate)} – {formatShortDate(lv.endDate)} · {lv.timingNote}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
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
                {lv.digitalSignature && (
                  <div className="p-2.5 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d] flex items-center justify-between gap-2 text-[11px]">
                    <span>
                      Signed by <strong>{lv.digitalSignature.signerName}</strong> ({lv.digitalSignature.verificationCode})
                    </span>
                    <img
                      src={lv.digitalSignature.signatureDataUrl}
                      alt="Signature"
                      className="h-9 w-24 object-contain bg-white rounded border border-[#dbe3f0]"
                    />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* MODAL: REQUEST NEW NOC */}
      {showNocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-[2px]">
          <div className="w-full max-w-lg bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-6 shadow-xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSignature className="w-4 h-4 text-[#2f5bea] dark:text-[#7a9bff]" />
                <h3 className="text-base font-bold">Request NOC Permission from Faculty</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNocModal(false)}
                className="p-1.5 rounded-lg text-[#5b6b86] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNoc} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#5b6b86] mb-1">
                  Quick-fill from Opportunity Hub (optional)
                </label>
                <select
                  onChange={(e) => handlePrefillFromOpp(e.target.value)}
                  defaultValue=""
                  className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120]"
                >
                  <option value="">-- Choose an internship to pre-fill details --</option>
                  {opportunities.slice(0, 20).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.company} — {o.title} ({o.mode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#5b6b86] mb-1">Company Name</label>
                  <input
                    type="text"
                    required
                    value={nocCompany}
                    onChange={(e) => setNocCompany(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#5b6b86] mb-1">Role Title</label>
                  <input
                    type="text"
                    required
                    value={nocRole}
                    onChange={(e) => setNocRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#5b6b86] mb-1">Work Mode</label>
                  <select
                    value={nocMode}
                    onChange={(e) => setNocMode(e.target.value as WorkMode)}
                    className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120]"
                  >
                    <option value="Remote">Remote</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="On-site">On-site</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#5b6b86] mb-1">Location</label>
                  <input
                    type="text"
                    value={nocLocation}
                    onChange={(e) => setNocLocation(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#5b6b86] mb-1">Stipend</label>
                  <input
                    type="text"
                    value={nocStipend}
                    onChange={(e) => setNocStipend(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#5b6b86] mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={nocStart}
                    onChange={(e) => setNocStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#5b6b86] mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={nocEnd}
                    onChange={(e) => setNocEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#5b6b86] mb-1">Daily Shift Timing</label>
                <input
                  type="text"
                  value={nocTiming}
                  onChange={(e) => setNocTiming(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#5b6b86] mb-1">HR / Manager Name</label>
                  <input
                    type="text"
                    value={nocHrName}
                    onChange={(e) => setNocHrName(e.target.value)}
                    placeholder="e.g. Anjali Deshmukh"
                    className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#5b6b86] mb-1">HR Email</label>
                  <input
                    type="email"
                    value={nocHrEmail}
                    onChange={(e) => setNocHrEmail(e.target.value)}
                    placeholder="hr@company.com"
                    className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#5b6b86] mb-1">
                    Offer / Shortlist Document
                  </label>
                  <input
                    type="text"
                    value={nocOfferName}
                    onChange={(e) => setNocOfferName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#5b6b86] mb-1">
                    Attach Signed Parent Consent Sheet
                  </label>
                  <select
                    value={selectedConsentId}
                    onChange={(e) => setSelectedConsentId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120]"
                  >
                    <option value="">Not attached yet</option>
                    {myConsents.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.consentCode} · {c.parentName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#5b6b86] mb-1">
                  Academic Remarks for Faculty
                </label>
                <textarea
                  rows={2}
                  value={nocRemarks}
                  onChange={(e) => setNocRemarks(e.target.value)}
                  placeholder="Confirming internship schedule does not overlap with final exams..."
                  className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNocModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#2f5bea] text-white font-bold cursor-pointer"
                >
                  Submit NOC to Faculty
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SIGN NEW PARENT CONSENT SHEET */}
      {showConsentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-[2px]">
          <div className="w-full max-w-lg bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-6 shadow-xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HeartHandshake className="w-4 h-4 text-[#12805f]" />
                <h3 className="text-base font-bold">Parent / Guardian Consent Sheet</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConsentModal(false)}
                className="p-1.5 rounded-lg text-[#5b6b86] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateConsent} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#5b6b86] mb-1">
                    Parent / Guardian Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={parentName}
                    onChange={(e) => setParentName(e.target.value)}
                    placeholder="e.g. Srinivas Tekmal"
                    className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#5b6b86] mb-1">Relationship</label>
                  <select
                    value={relationship}
                    onChange={(e) =>
                      setRelationship(e.target.value as 'Father' | 'Mother' | 'Legal Guardian')
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120]"
                  >
                    <option value="Father">Father</option>
                    <option value="Mother">Mother</option>
                    <option value="Legal Guardian">Legal Guardian</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#5b6b86] mb-1">Guardian Phone</label>
                  <input
                    type="tel"
                    required
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                    placeholder="+91 98490 54120"
                    className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#5b6b86] mb-1">Emergency Phone</label>
                  <input
                    type="tel"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    placeholder="+91 98490 54121"
                    className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#5b6b86] mb-1">Guardian Email</label>
                  <input
                    type="email"
                    value={parentEmail}
                    onChange={(e) => setParentEmail(e.target.value)}
                    placeholder="parent@email.com"
                    className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#5b6b86] mb-1">
                    Internship Company / Event
                  </label>
                  <input
                    type="text"
                    required
                    value={consentCompany}
                    onChange={(e) => setConsentCompany(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#5b6b86] mb-1">
                    Work Mode & Location
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={consentMode}
                      onChange={(e) => setConsentMode(e.target.value as WorkMode)}
                      className="px-2 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120]"
                    >
                      <option value="Remote">Remote</option>
                      <option value="Hybrid">Hybrid</option>
                      <option value="On-site">On-site</option>
                    </select>
                    <input
                      type="text"
                      value={consentLocation}
                      onChange={(e) => setConsentLocation(e.target.value)}
                      className="flex-1 px-2.5 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120]"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#5b6b86] mb-1">Start Date</label>
                  <input
                    type="date"
                    value={consentStart}
                    onChange={(e) => setConsentStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#5b6b86] mb-1">End Date</label>
                  <input
                    type="date"
                    value={consentEnd}
                    onChange={(e) => setConsentEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] font-mono"
                  />
                </div>
              </div>

              {/* Consent Declarations */}
              <div className="p-3 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d] space-y-2">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmTravel}
                    onChange={(e) => setConfirmTravel(e.target.checked)}
                    required
                    className="mt-0.5 accent-[#12805f]"
                  />
                  <span>
                    I permit my ward ({profile.name || userName}) to attend the internship / event and assume responsibility for local travel & accommodation.
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmMedical}
                    onChange={(e) => setConfirmMedical(e.target.checked)}
                    required
                    className="mt-0.5 accent-[#12805f]"
                  />
                  <span>
                    I confirm medical coverage and emergency contact availability throughout the period.
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmAcademic}
                    onChange={(e) => setConfirmAcademic(e.target.checked)}
                    required
                    className="mt-0.5 accent-[#12805f]"
                  />
                  <span>
                    I understand university examination schedules and minimum attendance rules remain mandatory.
                  </span>
                </label>
              </div>

              {/* Guardian Signature Canvas */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold">Draw Parent / Guardian Digital Signature</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setInkColor('#0f172a')}
                      className={`w-4 h-4 rounded-full bg-[#0f172a] border cursor-pointer ${
                        inkColor === '#0f172a' ? 'ring-2 ring-[#2f5bea]' : ''
                      }`}
                      title="Black Ink"
                    />
                    <button
                      type="button"
                      onClick={() => setInkColor('#1e3a8a')}
                      className={`w-4 h-4 rounded-full bg-[#1e3a8a] border cursor-pointer ${
                        inkColor === '#1e3a8a' ? 'ring-2 ring-[#2f5bea]' : ''
                      }`}
                      title="Blue Ink"
                    />
                    <button
                      type="button"
                      onClick={applySampleGuardianSign}
                      className="px-2 py-1 rounded-lg bg-[#e8eeff] dark:bg-[#1c2a50] text-[#2f5bea] dark:text-[#7a9bff] text-[11px] font-bold cursor-pointer"
                    >
                      Auto-Sign
                    </button>
                    <button
                      type="button"
                      onClick={clearPad}
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
                  height={115}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                  className="w-full h-28 rounded-xl border-2 border-dashed border-[#c3cfe2] dark:border-[#2d3e63] bg-white touch-none cursor-crosshair"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConsentModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#12805f] text-white font-bold cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Submit Signed Consent Sheet</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VIEW & PRINT OFFICIAL NOC CERTIFICATE */}
      {viewingNoc && viewingNoc.facultySignature && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-[2px]">
          <div className="w-full max-w-lg bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#dbe3f0] dark:border-[#24324d] pb-3">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-[#12805f]" />
                <div>
                  <h3 className="text-sm font-extrabold">No Objection Certificate (NOC)</h3>
                  <p className="text-[11px] font-mono text-[#5b6b86]">
                    {viewingNoc.nocNumber} · {viewingNoc.facultySignature.verificationCode}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingNoc(null)}
                className="p-1.5 rounded-lg text-[#5b6b86] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs leading-relaxed space-y-2 p-4 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d]">
              <p className="font-bold uppercase tracking-wide text-[11px] text-[#2f5bea]">
                To Whomsoever It May Concern
              </p>
              <p>
                This is to certify that <strong>{viewingNoc.studentName}</strong> (Roll No:{' '}
                <strong className="font-mono">{viewingNoc.rollNumber}</strong>), a bonafide student of{' '}
                <strong>{viewingNoc.branch}</strong> (Semester {viewingNoc.semester}) at{' '}
                <strong>{profile.college}</strong>, is permitted to undertake an internship as{' '}
                <strong>{viewingNoc.roleTitle}</strong> at <strong>{viewingNoc.companyName}</strong> ({viewingNoc.workMode},{' '}
                {viewingNoc.location}).
              </p>
              <p>
                Duration: <strong className="font-mono">{formatShortDate(viewingNoc.internshipStart)}</strong> to{' '}
                <strong className="font-mono">{formatShortDate(viewingNoc.internshipEnd)}</strong> ({viewingNoc.dailyTiming}).
                The institution has no objection to this internship subject to university examination attendance.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d] flex items-center justify-between gap-4">
              <div className="text-xs">
                <p className="font-bold">{viewingNoc.facultySignature.signerName}</p>
                <p className="text-[11px] text-[#5b6b86]">{viewingNoc.facultySignature.signerDesignation}</p>
                <p className="text-[11px] font-mono text-[#5b6b86] mt-0.5">
                  Signed: {formatShortDate(viewingNoc.facultySignature.signedAt)}
                </p>
              </div>
              <img
                src={viewingNoc.facultySignature.signatureDataUrl}
                alt="Faculty Signature"
                className="h-14 w-32 object-contain bg-white rounded-lg border border-[#dbe3f0] px-2"
              />
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
                onClick={() => setViewingNoc(null)}
                className="px-4 py-2 rounded-xl bg-[#2f5bea] text-white text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VIEW & PRINT OFFICIAL PARENT CONSENT SHEET */}
      {viewingConsent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-[2px]">
          <div className="w-full max-w-lg bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#dbe3f0] dark:border-[#24324d] pb-3">
              <div className="flex items-center gap-2">
                <HeartHandshake className="w-5 h-5 text-[#12805f]" />
                <div>
                  <h3 className="text-sm font-extrabold">Parent / Guardian Consent Sheet</h3>
                  <p className="text-[11px] font-mono text-[#5b6b86]">{viewingConsent.consentCode}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingConsent(null)}
                className="p-1.5 rounded-lg text-[#5b6b86] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs p-4 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d]">
              <p>
                I, <strong>{viewingConsent.parentName}</strong> ({viewingConsent.relationship} of{' '}
                <strong>{viewingConsent.studentName}</strong>, Roll No.{' '}
                <strong className="font-mono">{viewingConsent.rollNumber}</strong>), grant full consent for my ward to participate in{' '}
                <strong>{viewingConsent.companyOrEvent}</strong> ({viewingConsent.workMode} ·{' '}
                {viewingConsent.internshipLocation}) from{' '}
                <strong className="font-mono">{formatShortDate(viewingConsent.startDate)}</strong> to{' '}
                <strong className="font-mono">{formatShortDate(viewingConsent.endDate)}</strong>.
              </p>
              <p className="text-[#5b6b86] dark:text-[#9fb0cc]">
                Guardian Phone: <strong className="font-mono text-[#12203a] dark:text-[#e8eefc]">{viewingConsent.parentPhone}</strong> · Emergency:{' '}
                <strong className="font-mono text-[#12203a] dark:text-[#e8eefc]">{viewingConsent.emergencyContact}</strong>
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d] flex items-center justify-between gap-4">
              <div className="text-xs">
                <p className="font-bold">{viewingConsent.parentName}</p>
                <p className="text-[11px] text-[#5b6b86]">
                  Signed {formatShortDate(viewingConsent.signedOn)}
                </p>
                {viewingConsent.facultyVerified && (
                  <p className="text-[11px] font-bold text-emerald-600 mt-0.5">
                    Verified by {viewingConsent.verifiedBy}
                  </p>
                )}
              </div>
              <img
                src={viewingConsent.parentSignatureDataUrl}
                alt="Guardian Signature"
                className="h-14 w-32 object-contain bg-white rounded-lg border border-[#dbe3f0] px-2"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] text-xs font-bold cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Consent Sheet</span>
              </button>
              <button
                type="button"
                onClick={() => setViewingConsent(null)}
                className="px-4 py-2 rounded-xl bg-[#12805f] text-white text-xs font-bold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
