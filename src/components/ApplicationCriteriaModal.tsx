import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileSignature,
  FileText,
  HeartHandshake,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import type {
  ApplicationCriteriaPayload,
  NocRequest,
  Opportunity,
  ParentConsentSheet,
  StudentProfile,
} from '../types';
import {
  daysBetween,
  formatShortDate,
  formatStipend,
  getExamClash,
  getSkillMatch,
  todayIso,
} from '../utils/matching';

interface ApplicationCriteriaModalProps {
  opportunity: Opportunity | null;
  profile: StudentProfile;
  userEmail: string;
  nocRequests?: NocRequest[];
  parentConsents?: ParentConsentSheet[];
  onClose: () => void;
  onSubmit: (opportunity: Opportunity, details: ApplicationCriteriaPayload) => void;
}

export const ApplicationCriteriaModal: React.FC<ApplicationCriteriaModalProps> = ({
  opportunity,
  profile,
  userEmail,
  nocRequests = [],
  parentConsents = [],
  onClose,
  onSubmit,
}) => {
  const defaultResume =
    profile.resumes.find((r) => r.isDefault)?.name || profile.resumeName || 'Resume.pdf';

  const [fullName, setFullName] = useState(profile.name || '');
  const [email, setEmail] = useState(userEmail || '');
  const [rollNumber, setRollNumber] = useState('23IFHE0142');
  const [branch, setBranch] = useState(profile.branch || 'Computer Science & Engineering');
  const [semester, setSemester] = useState<number>(profile.semester || 5);
  const [cgpa, setCgpa] = useState(profile.cgpa || '8.50 / 10');
  const [resumeUsed, setResumeUsed] = useState(defaultResume);
  const [portfolioUrl, setPortfolioUrl] = useState(
    profile.githubUrl || profile.portfolioUrl || ''
  );
  const [availability, setAvailability] = useState('Immediate / Post-Exam Window');
  const [coverNote, setCoverNote] = useState('');
  const [selectedNocId, setSelectedNocId] = useState('');
  const [selectedConsentId, setSelectedConsentId] = useState('');
  const [confirmedCriteria, setConfirmedCriteria] = useState(false);
  const [confirmedExamCompliance, setConfirmedExamCompliance] = useState(false);
  const [confirmedAuthenticity, setConfirmedAuthenticity] = useState(false);
  const [error, setError] = useState('');

  const myNocs = useMemo(() => {
    const emailLower = userEmail.toLowerCase();
    const nameLower = (profile.name || '').toLowerCase();
    return nocRequests.filter(
      (n) =>
        n.studentEmail.toLowerCase() === emailLower ||
        (nameLower && n.studentName.toLowerCase() === nameLower)
    );
  }, [nocRequests, userEmail, profile.name]);

  const myConsents = useMemo(() => {
    const emailLower = userEmail.toLowerCase();
    const nameLower = (profile.name || '').toLowerCase();
    return parentConsents.filter(
      (c) =>
        c.studentEmail.toLowerCase() === emailLower ||
        (nameLower && c.studentName.toLowerCase() === nameLower)
    );
  }, [parentConsents, userEmail, profile.name]);

  useEffect(() => {
    if (!opportunity) return;
    setEmail(userEmail || '');
    setFullName(profile.name || '');
    const matchingNoc =
      myNocs.find((n) =>
        n.companyName.toLowerCase().includes(opportunity.company.toLowerCase())
      ) || myNocs[0];
    setSelectedNocId(matchingNoc ? matchingNoc.id : '');

    const linkedConsent =
      (matchingNoc?.parentConsentId &&
        myConsents.find((c) => c.id === matchingNoc.parentConsentId)) ||
      myConsents.find((c) =>
        c.companyOrEvent.toLowerCase().includes(opportunity.company.toLowerCase())
      ) ||
      myConsents[0];
    setSelectedConsentId(linkedConsent ? linkedConsent.id : '');
    setError('');
  }, [opportunity?.id, userEmail, profile.name, myNocs, myConsents]);

  const assessment = useMemo(() => {
    if (!opportunity) return null;
    const match = getSkillMatch(opportunity, { ...profile, semester });
    const clash = getExamClash(opportunity, profile);
    const daysLeft = daysBetween(todayIso(), opportunity.deadline);
    return { match, clash, daysLeft };
  }, [opportunity, profile, semester]);

  if (!opportunity || !assessment) return null;

  const { match, clash, daysLeft } = assessment;

  const handleAutoDraftSop = () => {
    const matchedList =
      match.matched.length > 0
        ? match.matched.join(', ')
        : profile.skills.slice(0, 3).join(', ');
    setCoverNote(
      `Applying for the ${opportunity.title} role at ${opportunity.company}. As a Semester ${semester} ${branch} student with hands-on experience in ${matchedList}, I am ready to contribute to ${opportunity.domain} engineering milestones starting ${formatShortDate(opportunity.startDate)}.`
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim() || !email.trim() || !rollNumber.trim()) {
      setError('Please complete your full name, email, and university roll number.');
      return;
    }

    if (semester < opportunity.minSemester) {
      setError(
        `This opportunity requires at least Semester ${opportunity.minSemester}. Your selected semester is ${semester}.`
      );
      return;
    }

    if (coverNote.trim().length < 20) {
      setError(
        'Please write a brief Statement of Purpose (at least 20 characters) explaining your fit.'
      );
      return;
    }

    if (!confirmedCriteria || !confirmedExamCompliance || !confirmedAuthenticity) {
      setError('Please acknowledge all three eligibility & compliance criteria statements.');
      return;
    }

    const chosenNoc = myNocs.find((n) => n.id === selectedNocId);
    const chosenConsent = myConsents.find((c) => c.id === selectedConsentId);

    onSubmit(opportunity, {
      fullName: fullName.trim(),
      email: email.trim(),
      rollNumber: rollNumber.trim(),
      branch: branch.trim(),
      semester,
      cgpa: cgpa.trim(),
      resumeUsed,
      portfolioUrl: portfolioUrl.trim(),
      availability,
      coverNote: coverNote.trim(),
      attachedNocId: chosenNoc?.id,
      attachedNocNumber: chosenNoc?.nocNumber,
      attachedConsentId: chosenConsent?.id,
      attachedConsentCode: chosenConsent?.consentCode,
      confirmedCriteria,
      confirmedExamCompliance,
      confirmedAuthenticity,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-criteria-title"
    >
      <div className="w-full max-w-2xl bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#dbe3f0] dark:border-[#24324d] flex items-start justify-between gap-4 bg-[#f8fafe] dark:bg-[#0e1626]">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 text-xs font-bold text-[#2f5bea] dark:text-[#7a9bff]">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Official Application & Eligibility Verification</span>
            </div>
            <h2 id="app-criteria-title" className="text-lg font-extrabold tracking-tight truncate">
              {opportunity.title}
            </h2>
            <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc] tabular-nums">
              {opportunity.company} · {opportunity.mode} ({opportunity.location}) ·{' '}
              {formatStipend(opportunity)} ·{' '}
              {daysLeft >= 0 ? `${daysLeft}d left` : 'Deadline passed'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close application form"
            className="p-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#131d33] text-[#5b6b86] hover:text-[#12203a] dark:hover:text-white cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[78vh] overflow-y-auto">
          {/* Eligibility Criteria Matrix */}
          <div className="rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-[#f8fafe] dark:bg-[#0e1626] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#5b6b86] dark:text-[#9fb0cc]">
                Eligibility Criteria Matrix
              </h3>
              <a
                href={opportunity.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#2f5bea] dark:text-[#7a9bff] hover:underline"
              >
                <span>View Role Listing</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d]">
                <p className="text-[#5b6b86] dark:text-[#9fb0cc]">Semester Requirement</p>
                <div className="flex items-center justify-between mt-1 font-bold tabular-nums">
                  <span>
                    Sem {semester} / Min {opportunity.minSemester}+
                  </span>
                  {semester >= opportunity.minSemester ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  )}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d]">
                <p className="text-[#5b6b86] dark:text-[#9fb0cc]">Skill Alignment</p>
                <div className="flex items-center justify-between mt-1 font-bold tabular-nums">
                  <span>{match.pct}% match</span>
                  <span className="text-[11px] font-semibold text-[#2f5bea] dark:text-[#7a9bff]">
                    {match.matched.length}/{opportunity.skills.length} skills
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d]">
                <p className="text-[#5b6b86] dark:text-[#9fb0cc]">Exam Schedule Check</p>
                <p
                  className={`mt-1 font-bold ${
                    clash.status === 'fit'
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : clash.status === 'partial'
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-rose-700 dark:text-rose-400'
                  }`}
                >
                  {clash.label}
                </p>
              </div>
            </div>

            {match.missing.length > 0 && (
              <p className="text-[11px] text-[#5b6b86] dark:text-[#9fb0cc]">
                Recommended skills to highlight or build: {match.missing.join(', ')}
              </p>
            )}
          </div>

          {/* Candidate Academic & Contact Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1">
                Candidate Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f5bea]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1">
                University Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f5bea]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1">
                University Roll / ID Number
              </label>
              <input
                type="text"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#2f5bea]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1">
                  Semester
                </label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f5bea]"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <option key={s} value={s}>
                      Sem {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1">
                  Current CGPA
                </label>
                <input
                  type="text"
                  value={cgpa}
                  onChange={(e) => setCgpa(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f5bea]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1">
                Department / Branch
              </label>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f5bea]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1">
                Availability & Joining Window
              </label>
              <select
                value={availability}
                onChange={(e) => setAvailability(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f5bea]"
              >
                <option value="Immediate / Post-Exam Window">Immediate / Post-Exam Window</option>
                <option value="Within 2 Weeks">Within 2 Weeks</option>
                <option value="Flexible (Part-time during Semester)">
                  Flexible (Part-time during Semester)
                </option>
                <option value="Summer Break Full-Time">Summer Break Full-Time</option>
              </select>
            </div>
          </div>

          {/* Resume Vault & Portfolio */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1">
                Attach Resume from Vault
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 text-[#2f5bea] absolute left-3 top-1/2 -translate-y-1/2" />
                <select
                  value={resumeUsed}
                  onChange={(e) => setResumeUsed(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f5bea]"
                >
                  {profile.resumes.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name} ({r.targetRole})
                    </option>
                  ))}
                  {!profile.resumes.some((r) => r.name === resumeUsed) && (
                    <option value={resumeUsed}>{resumeUsed}</option>
                  )}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1">
                GitHub / Portfolio Link
              </label>
              <input
                type="url"
                value={portfolioUrl}
                onChange={(e) => setPortfolioUrl(e.target.value)}
                placeholder="https://github.com/username"
                className="w-full px-3.5 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f5bea]"
              />
            </div>
          </div>

          {/* Attach NOC Request & Parent Consent Sheet */}
          <div className="rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-[#f8fafe] dark:bg-[#0e1626] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-[#12203a] dark:text-[#e8eefc]">
                Attach NOC Request & Parent Consent Sheet (For Faculty Clearance)
              </h3>
              <span className="text-[11px] text-[#2f5bea] dark:text-[#7a9bff] font-semibold">
                Sent to Faculty for signature
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1">
                  Attach NOC Request
                </label>
                <div className="relative">
                  <FileSignature className="w-4 h-4 text-[#2f5bea] absolute left-3 top-1/2 -translate-y-1/2" />
                  <select
                    value={selectedNocId}
                    onChange={(e) => setSelectedNocId(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2f5bea]"
                  >
                    <option value="">No NOC attached yet (attach later in My Applications)</option>
                    {myNocs.map((noc) => (
                      <option key={noc.id} value={noc.id}>
                        {noc.nocNumber} · {noc.companyName} ({noc.status})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1">
                  Attach Parent Consent Sheet
                </label>
                <div className="relative">
                  <HeartHandshake className="w-4 h-4 text-[#12805f] dark:text-[#5fe0b6] absolute left-3 top-1/2 -translate-y-1/2" />
                  <select
                    value={selectedConsentId}
                    onChange={(e) => setSelectedConsentId(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2f5bea]"
                  >
                    <option value="">No Consent attached yet (fill in Approvals tab)</option>
                    {myConsents.map((pc) => (
                      <option key={pc.id} value={pc.id}>
                        {pc.consentCode} · {pc.parentName} ({pc.facultyVerified ? 'Verified' : 'Guardian Signed'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-[#5b6b86] dark:text-[#9fb0cc]">
              Faculty will review your application alongside these attached documents. Once signed, Organizer receives confirmation that you are Open / Allowed for Program.
            </p>
          </div>

          {/* Statement of Purpose */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc]">
                Statement of Purpose / Role Motivation
              </label>
              <button
                type="button"
                onClick={handleAutoDraftSop}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#2f5bea] dark:text-[#7a9bff] hover:underline cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Auto-draft from matched skills</span>
              </button>
            </div>
            <textarea
              rows={3}
              value={coverNote}
              onChange={(e) => setCoverNote(e.target.value)}
              placeholder={`Explain why you are a strong fit for ${opportunity.title} at ${opportunity.company}...`}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f5bea]"
            />
          </div>

          {/* 3 Mandatory Criteria Checkboxes */}
          <div className="space-y-2.5 pt-2 border-t border-[#dbe3f0] dark:border-[#24324d]">
            <p className="text-xs font-bold text-[#12203a] dark:text-[#e8eefc]">
              Mandatory Application Criteria Confirmations
            </p>
            <label className="flex items-start gap-2.5 text-xs text-[#5b6b86] dark:text-[#9fb0cc] cursor-pointer">
              <input
                type="checkbox"
                checked={confirmedCriteria}
                onChange={(e) => setConfirmedCriteria(e.target.checked)}
                className="mt-0.5 rounded border-[#dbe3f0] text-[#2f5bea]"
              />
              <span>
                I confirm I meet the Semester {opportunity.minSemester}+ eligibility and{' '}
                {opportunity.domain} domain criteria for this {opportunity.type}.
              </span>
            </label>
            <label className="flex items-start gap-2.5 text-xs text-[#5b6b86] dark:text-[#9fb0cc] cursor-pointer">
              <input
                type="checkbox"
                checked={confirmedExamCompliance}
                onChange={(e) => setConfirmedExamCompliance(e.target.checked)}
                className="mt-0.5 rounded border-[#dbe3f0] text-[#2f5bea]"
              />
              <span>
                I have reviewed my academic exam schedule ({profile.examStart} to {profile.examEnd})
                and will obtain Faculty NOC / On-Duty leave if selected.
              </span>
            </label>
            <label className="flex items-start gap-2.5 text-xs text-[#5b6b86] dark:text-[#9fb0cc] cursor-pointer">
              <input
                type="checkbox"
                checked={confirmedAuthenticity}
                onChange={(e) => setConfirmedAuthenticity(e.target.checked)}
                className="mt-0.5 rounded border-[#dbe3f0] text-[#2f5bea]"
              />
              <span>
                I declare that the attached resume ({resumeUsed}) and academic metrics are genuine
                and up to date.
              </span>
            </label>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] text-xs font-bold text-[#5b6b86] dark:text-[#9fb0cc] hover:text-[#12203a] dark:hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#2f5bea] hover:bg-[#244bc9] text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Submit Verified Application
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
