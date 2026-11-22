import React, { useMemo, useState } from 'react';
import {
  Award,
  Briefcase,
  CheckCircle2,
  Eye,
  FileCheck2,
  FileSignature,
  HeartHandshake,
  Plus,
  ShieldCheck,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import type {
  ApplicationRecord,
  ApplicationStage,
  DomainCategory,
  NocRequest,
  Opportunity,
  OpportunityType,
  OrganizerTab,
  ParentConsentSheet,
  UserAccount,
  WorkMode,
} from '../types';
import { offsetDate } from '../data/realData';
import { formatShortDate, formatStipend, getSkillMatchForList, todayIso } from '../utils/matching';

interface OrganizerWorkspaceProps {
  activeTab: OrganizerTab;
  user: UserAccount;
  opportunities: Opportunity[];
  applications: ApplicationRecord[];
  nocRequests?: NocRequest[];
  parentConsents?: ParentConsentSheet[];
  onPublishOpportunity: (opp: Opportunity) => void;
  onUpdateApplicationStage: (appId: string, stage: ApplicationStage) => void;
  onConfirmApplicantForProgram?: (appId: string) => void;
  onNavigate: (tab: OrganizerTab) => void;
}

export const OrganizerWorkspace: React.FC<OrganizerWorkspaceProps> = ({
  activeTab,
  user,
  opportunities,
  applications,
  nocRequests = [],
  parentConsents = [],
  onPublishOpportunity,
  onUpdateApplicationStage,
  onConfirmApplicantForProgram,
  onNavigate,
}) => {
  const orgName = user.organization || user.name;

  // Post form state
  const [title, setTitle] = useState('');
  const [type, setType] = useState<OpportunityType>('Internship');
  const [domain, setDomain] = useState<DomainCategory>('Software');
  const [mode, setMode] = useState<WorkMode>('Remote');
  const [location, setLocation] = useState('Remote');
  const [stipend, setStipend] = useState(25000);
  const [minSemester, setMinSemester] = useState(3);
  const [skillsText, setSkillsText] = useState('React, TypeScript, Node.js');
  const [deadline, setDeadline] = useState(offsetDate(14));
  const [startDate, setStartDate] = useState(offsetDate(30));
  const [endDate, setEndDate] = useState(offsetDate(115));
  const [officialUrl, setOfficialUrl] = useState('https://unstop.com/internships');
  const [description, setDescription] = useState('');

  // Applicants filter & dossier state
  const [viewScope, setViewScope] = useState<'all' | 'org'>('all');
  const [filterOppId, setFilterOppId] = useState<string>('all');
  const [filterStage, setFilterStage] = useState<string>('all');
  const [filterClearance, setFilterClearance] = useState<
    'all' | 'allowed' | 'pending' | 'confirmed'
  >('all');
  const [inspectingApp, setInspectingApp] = useState<ApplicationRecord | null>(null);

  const orgOpportunities = useMemo(
    () =>
      opportunities.filter(
        (o) =>
          o.ownerOrg.toLowerCase() === orgName.toLowerCase() ||
          o.company.toLowerCase() === orgName.toLowerCase()
      ),
    [opportunities, orgName]
  );

  const orgOppIds = useMemo(() => new Set(orgOpportunities.map((o) => o.id)), [orgOpportunities]);

  const scopedApplications = useMemo(() => {
    if (viewScope === 'all') return applications;
    return applications.filter(
      (a) =>
        orgOppIds.has(a.opportunityId) || a.company.toLowerCase() === orgName.toLowerCase()
    );
  }, [viewScope, applications, orgOppIds, orgName]);

  const stats = useMemo(() => {
    const totalApps = scopedApplications.length;
    const selected = scopedApplications.filter((a) => a.stage === 'Selected').length;
    const shortlisted = scopedApplications.filter(
      (a) => a.stage === 'Shortlisted' || a.stage === 'Recruiter Call' || a.stage === 'Phone Screen'
    ).length;
    const pending = scopedApplications.filter((a) => a.stage === 'Applied').length;
    const rejected = scopedApplications.filter((a) => a.stage === 'Rejected').length;
    const facultyAllowed = scopedApplications.filter(
      (a) => a.facultyApproval?.status === 'Approved'
    ).length;
    const confirmedEntry = scopedApplications.filter((a) => a.organizerConfirmedAllowed).length;
    const acceptanceRate = totalApps > 0 ? ((selected / totalApps) * 100).toFixed(1) : '0.0';
    return {
      totalApps,
      selected,
      shortlisted,
      pending,
      rejected,
      facultyAllowed,
      confirmedEntry,
      acceptanceRate,
    };
  }, [scopedApplications]);

  // Donut chart SVG math (matching Photo 3 InternshipPro)
  const donutSegments = useMemo(() => {
    const total = Math.max(1, stats.totalApps);
    const slices = [
      { label: 'Pending', count: stats.pending, color: '#eab308' },
      { label: 'Shortlisted / Interview', count: stats.shortlisted, color: '#3b82f6' },
      { label: 'Selected', count: stats.selected, color: '#10b981' },
      { label: 'Rejected', count: stats.rejected, color: '#ef4444' },
    ];
    let offset = 0;
    const circumference = 2 * Math.PI * 52;
    return slices.map((s) => {
      const pct = stats.totalApps > 0 ? s.count / total : 0;
      const length = pct * circumference;
      const seg = {
        ...s,
        pctLabel: stats.totalApps > 0 ? `${Math.round(pct * 100)}%` : '0%',
        dashArray: `${length} ${circumference}`,
        dashOffset: -offset,
      };
      offset += length;
      return seg;
    });
  }, [stats]);

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const weeks = Math.max(
      1,
      Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (86_400_000 * 7))
    );
    const newOpp: Opportunity = {
      id: `op-${Date.now()}`,
      title: title.trim(),
      company: orgName,
      type,
      domain,
      mode,
      location: mode === 'Remote' ? 'Remote' : location.trim() || 'Bengaluru',
      stipend: Number(stipend) || 0,
      durationLabel: `${weeks} weeks`,
      deadline,
      startDate,
      endDate,
      skills: skillsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      minSemester: Number(minSemester) || 1,
      description:
        description.trim() ||
        `Join ${orgName} as a ${title.trim()} and collaborate directly with our engineering & product mentors.`,
      sourcePlatform: 'InternHub Direct',
      officialUrl: officialUrl.trim() || 'https://unstop.com/internships',
      ownerOrg: orgName,
      verified: Boolean(user.verified),
    };
    onPublishOpportunity(newOpp);
    setTitle('');
    setDescription('');
    onNavigate('analytics');
  };

  if (activeTab === 'post') {
    return (
      <div className="max-w-4xl">
        <form
          onSubmit={handlePublish}
          className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-6 space-y-5"
        >
          <div className="pb-4 border-b border-[#dbe3f0] dark:border-[#24324d]">
            <h2 className="text-lg font-bold">Post a New Opportunity</h2>
            <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc] mt-0.5">
              Published listings appear immediately in the Learner Opportunity Hub with exam-clash matching
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1.5">
                Role or Hackathon Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Cloud Engineering Intern"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1.5">
                Opportunity Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as OpportunityType)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm"
              >
                <option value="Internship">Internship</option>
                <option value="Hackathon">Hackathon</option>
                <option value="Job">Full-Time / PPO</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1.5">
                Domain
              </label>
              <select
                value={domain}
                onChange={(e) => setDomain(e.target.value as DomainCategory)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm"
              >
                <option value="Software">Software</option>
                <option value="Data">Data & AI</option>
                <option value="Design">Design</option>
                <option value="Electronics">Electronics</option>
                <option value="Marketing">Marketing</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1.5">
                Work Mode
              </label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as WorkMode)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm"
              >
                <option value="Remote">Remote</option>
                <option value="On-site">On-site</option>
                <option value="Hybrid">Hybrid</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1.5">
                City / Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1.5">
                Monthly Stipend / Prize (₹)
              </label>
              <input
                type="number"
                min={0}
                value={stipend}
                onChange={(e) => setStipend(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1.5">
                Minimum Semester
              </label>
              <select
                value={minSemester}
                onChange={(e) => setMinSemester(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm"
              >
                {[1, 2, 3, 4, 5, 6, 7].map((s) => (
                  <option key={s} value={s}>
                    Semester {s}+
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1.5">
                Required Skills (comma separated)
              </label>
              <input
                type="text"
                value={skillsText}
                onChange={(e) => setSkillsText(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1.5">
                Application Deadline
              </label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1.5">
                Official Application Portal URL
              </label>
              <input
                type="url"
                value={officialUrl}
                onChange={(e) => setOfficialUrl(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1.5">
                Internship Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1.5">
                Internship End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1.5">
                Role Description
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe key responsibilities, mentorship, and expected outcomes..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2f5bea] hover:bg-[#244bc9] text-white text-sm font-bold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Publish Opportunity</span>
            </button>
          </div>
        </form>
      </div>
    );
  }

  const resolveNocForApp = (app: ApplicationRecord) => {
    const studentEmail = app.applicantEmail.trim().toLowerCase();
    return (
      nocRequests.find((n) => n.id === app.attachedNocId) ||
      (app.attachedNocNumber
        ? nocRequests.find((n) => n.nocNumber === app.attachedNocNumber)
        : undefined) ||
      nocRequests.find(
        (n) =>
          n.studentEmail.trim().toLowerCase() === studentEmail &&
          (n.companyName.toLowerCase() === app.company.toLowerCase() || n.status === 'Approved')
      )
    );
  };

  const resolveConsentForApp = (app: ApplicationRecord) => {
    const studentEmail = app.applicantEmail.trim().toLowerCase();
    return (
      parentConsents.find((c) => c.id === app.attachedConsentId) ||
      (app.attachedConsentCode
        ? parentConsents.find((c) => c.consentCode === app.attachedConsentCode)
        : undefined) ||
      parentConsents.find((c) => c.studentEmail.trim().toLowerCase() === studentEmail)
    );
  };

  if (activeTab === 'applicants') {
    const filteredApps = scopedApplications.filter((app) => {
      if (filterOppId !== 'all' && app.opportunityId !== filterOppId) return false;
      if (filterStage !== 'all' && app.stage !== filterStage) return false;
      if (filterClearance === 'allowed' && app.facultyApproval?.status !== 'Approved') return false;
      if (
        filterClearance === 'pending' &&
        (app.facultyApproval?.status === 'Approved' || app.facultyApproval?.status === 'Rejected')
      ) {
        return false;
      }
      if (filterClearance === 'confirmed' && !app.organizerConfirmedAllowed) return false;
      return true;
    });

    const activeInspectedApp = inspectingApp
      ? applications.find((a) => a.id === inspectingApp.id) || inspectingApp
      : null;

    return (
      <div className="space-y-5">
        <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">
              Program Applicants & Faculty Clearances ({filteredApps.length})
            </h2>
            <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc]">
              Verify Faculty-signed clearance (&quot;Open / Allowed for Program&quot;), attached NOC &amp; Parent Consent, and confirm student entry
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Scope Toggle */}
            <div className="inline-flex p-0.5 rounded-xl bg-[#f3f6fb] dark:bg-[#0b1120] border border-[#dbe3f0] dark:border-[#24324d]">
              <button
                type="button"
                onClick={() => setViewScope('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  viewScope === 'all'
                    ? 'bg-[#2f5bea] text-white'
                    : 'text-[#5b6b86] dark:text-[#9fb0cc]'
                }`}
              >
                All Program Applicants
              </button>
              <button
                type="button"
                onClick={() => setViewScope('org')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  viewScope === 'org'
                    ? 'bg-[#2f5bea] text-white'
                    : 'text-[#5b6b86] dark:text-[#9fb0cc]'
                }`}
              >
                My Org Postings
              </button>
            </div>

            <select
              value={filterClearance}
              onChange={(e) =>
                setFilterClearance(e.target.value as 'all' | 'allowed' | 'pending' | 'confirmed')
              }
              className="px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-[#f8fafe] dark:bg-[#0b1120] text-xs font-semibold"
            >
              <option value="all">All Clearances</option>
              <option value="allowed">Faculty Signed (Open / Allowed)</option>
              <option value="pending">Pending Faculty Sign</option>
              <option value="confirmed">Organizer Confirmed Entry</option>
            </select>

            <select
              value={filterOppId}
              onChange={(e) => setFilterOppId(e.target.value)}
              className="px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-[#f8fafe] dark:bg-[#0b1120] text-xs font-semibold"
            >
              <option value="all">All postings</option>
              {(viewScope === 'org' ? orgOpportunities : opportunities.slice(0, 25)).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.company} — {o.title}
                </option>
              ))}
            </select>

            <select
              value={filterStage}
              onChange={(e) => setFilterStage(e.target.value)}
              className="px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-[#f8fafe] dark:bg-[#0b1120] text-xs font-semibold"
            >
              <option value="all">All stages</option>
              {(
                ['Applied', 'Shortlisted', 'Recruiter Call', 'Phone Screen', 'Selected', 'Rejected'] as ApplicationStage[]
              ).map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl overflow-hidden">
          {filteredApps.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <p className="text-sm font-bold">No applicants match your current filter</p>
              <div className="flex items-center justify-center gap-2">
                {viewScope === 'org' && (
                  <button
                    type="button"
                    onClick={() => setViewScope('all')}
                    className="px-4 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] text-xs font-bold cursor-pointer"
                  >
                    Show All Program Applicants
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onNavigate('post')}
                  className="px-4 py-2 rounded-xl bg-[#2f5bea] text-white text-xs font-bold cursor-pointer"
                >
                  Post a new opportunity
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#dbe3f0] dark:border-[#24324d] text-xs font-bold text-[#5b6b86] dark:text-[#9fb0cc]">
                    <th className="py-3.5 px-4">Candidate</th>
                    <th className="py-3.5 px-4">Company & Role</th>
                    <th className="py-3.5 px-4">Faculty Clearance & Docs</th>
                    <th className="py-3.5 px-4">Skill Match</th>
                    <th className="py-3.5 px-4">Stage</th>
                    <th className="py-3.5 px-4 text-right">Program Confirmation & Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dbe3f0] dark:divide-[#24324d] text-sm">
                  {filteredApps.map((app) => {
                    const opp = opportunities.find((o) => o.id === app.opportunityId);
                    const matchPct = opp
                      ? getSkillMatchForList(opp.skills, app.applicantSkills || [])
                      : 75;
                    const approval = app.facultyApproval;
                    const isFacultyAllowed = approval?.status === 'Approved';
                    const isFacultyRejected = approval?.status === 'Rejected';
                    const noc = resolveNocForApp(app);
                    const consent = resolveConsentForApp(app);

                    return (
                      <tr key={app.id} className="hover:bg-[#f8fafe] dark:hover:bg-[#16213a]">
                        <td className="py-3.5 px-4">
                          <div className="font-bold">{app.applicantName}</div>
                          <div className="text-xs text-[#5b6b86] dark:text-[#9fb0cc]">
                            {app.applicantBranch || 'CSE'} · Sem {app.applicantSemester || 5}
                          </div>
                          <div className="text-[11px] font-mono text-[#5b6b86] dark:text-[#9fb0cc]">
                            {app.applicantEmail}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-bold text-xs text-[#2f5bea] dark:text-[#7a9bff]">
                            {app.company}
                          </div>
                          <div className="font-medium text-sm">{app.roleTitle}</div>
                          <div className="text-[11px] font-mono text-[#5b6b86] tabular-nums">
                            Applied {formatShortDate(app.appliedOn)}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 space-y-1">
                          <div
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${
                              isFacultyAllowed
                                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                                : isFacultyRejected
                                ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300'
                                : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            <ShieldCheck className="w-3 h-3 shrink-0" />
                            {isFacultyAllowed
                              ? 'Open / Allowed for Program (Faculty Signed)'
                              : isFacultyRejected
                              ? 'Not Cleared by Faculty'
                              : 'Pending Faculty Sign'}
                          </div>
                          {approval?.digitalSignature && (
                            <div className="text-[10px] font-mono text-[#5b6b86] dark:text-[#9fb0cc]">
                              {approval.digitalSignature.signerName} ·{' '}
                              {approval.digitalSignature.verificationCode}
                            </div>
                          )}
                          <div className="text-[11px] font-mono text-[#5b6b86] dark:text-[#9fb0cc]">
                            NOC: {noc?.nocNumber || app.attachedNocNumber || '—'} · Consent:{' '}
                            {consent?.consentCode || app.attachedConsentCode || '—'}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-mono text-xs font-bold tabular-nums text-[#2f5bea] dark:text-[#7a9bff]">
                            {matchPct}%
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`text-xs font-bold ${
                              app.stage === 'Selected'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : app.stage === 'Rejected'
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-[#2f5bea] dark:text-[#7a9bff]'
                            }`}
                          >
                            {app.stage}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex flex-col items-end gap-1.5">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => setInspectingApp(app)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#dbe3f0] dark:border-[#24324d] hover:border-[#2f5bea] text-xs font-semibold cursor-pointer whitespace-nowrap"
                              >
                                <FileCheck2 className="w-3.5 h-3.5 text-[#2f5bea] dark:text-[#7a9bff]" />
                                <span>Inspect Clearance</span>
                              </button>

                              {app.organizerConfirmedAllowed ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold whitespace-nowrap">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Entry Confirmed</span>
                                </span>
                              ) : onConfirmApplicantForProgram ? (
                                <button
                                  type="button"
                                  disabled={!isFacultyAllowed}
                                  onClick={() => onConfirmApplicantForProgram(app.id)}
                                  title={
                                    isFacultyAllowed
                                      ? 'Confirm student as Open / Allowed for Program'
                                      : 'Waiting for Faculty digital signature first'
                                  }
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                                    isFacultyAllowed
                                      ? 'bg-[#12805f] hover:opacity-90 text-white cursor-pointer'
                                      : 'bg-[#f3f6fb] dark:bg-[#0e1626] text-[#5b6b86] dark:text-[#7d90b3] border border-[#dbe3f0] dark:border-[#24324d] cursor-not-allowed opacity-75'
                                  }`}
                                >
                                  <Award className="w-3.5 h-3.5" />
                                  <span>
                                    {isFacultyAllowed ? 'Confirm Program Entry' : 'Awaiting Faculty Sign'}
                                  </span>
                                </button>
                              ) : null}
                            </div>

                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => onUpdateApplicationStage(app.id, 'Shortlisted')}
                                className="px-2 py-0.5 rounded-lg border border-[#dbe3f0] dark:border-[#24324d] hover:border-[#2f5bea] text-[11px] font-semibold cursor-pointer"
                              >
                                Shortlist
                              </button>
                              <button
                                type="button"
                                onClick={() => onUpdateApplicationStage(app.id, 'Recruiter Call')}
                                className="px-2 py-0.5 rounded-lg border border-[#dbe3f0] dark:border-[#24324d] hover:border-[#2f5bea] text-[11px] font-semibold cursor-pointer"
                              >
                                Call
                              </button>
                              <button
                                type="button"
                                onClick={() => onUpdateApplicationStage(app.id, 'Selected')}
                                className="px-2 py-0.5 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold cursor-pointer"
                              >
                                Select
                              </button>
                              <button
                                type="button"
                                onClick={() => onUpdateApplicationStage(app.id, 'Rejected')}
                                className="px-2 py-0.5 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-[11px] font-semibold cursor-pointer"
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Clearance Dossier Modal */}
        {activeInspectedApp && (() => {
          const noc = resolveNocForApp(activeInspectedApp);
          const consent = resolveConsentForApp(activeInspectedApp);
          const approval = activeInspectedApp.facultyApproval;
          const isAllowed = approval?.status === 'Approved';

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-[2px]">
              <div className="w-full max-w-2xl bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-start justify-between gap-3 border-b border-[#dbe3f0] dark:border-[#24324d] pb-3">
                  <div>
                    <p className="text-xs font-bold text-[#2f5bea] dark:text-[#7a9bff]">
                      Organizer Candidate &amp; Faculty Clearance Dossier
                    </p>
                    <h3 className="text-lg font-extrabold mt-0.5">
                      {activeInspectedApp.applicantName} · {activeInspectedApp.company}
                    </h3>
                    <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc]">
                      {activeInspectedApp.roleTitle} · {activeInspectedApp.applicantBranch || 'CSE'} · Sem{' '}
                      {activeInspectedApp.applicantSemester || 5} · {activeInspectedApp.applicantEmail}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInspectingApp(null)}
                    className="p-1.5 rounded-lg text-[#5b6b86] hover:bg-[#f3f6fb] dark:hover:bg-[#16213a] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Faculty Digital Approval & Signature */}
                <div
                  className={`p-4 rounded-xl border space-y-2.5 ${
                    isAllowed
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                      : 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-[#12805f]" />
                      Faculty Program Clearance:{' '}
                      <span
                        className={
                          isAllowed
                            ? 'text-emerald-700 dark:text-emerald-300'
                            : 'text-amber-700 dark:text-amber-300'
                        }
                      >
                        {approval?.programClearance || 'Pending Review'}
                      </span>
                    </span>
                    {activeInspectedApp.organizerConfirmedAllowed && (
                      <span className="text-xs font-bold text-[#12805f] dark:text-[#5fe0b6]">
                        Organizer Entry Confirmed (
                        {formatShortDate(activeInspectedApp.organizerConfirmedAt || todayIso())})
                      </span>
                    )}
                  </div>

                  {approval?.digitalSignature ? (
                    <div className="p-3 rounded-xl bg-white dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d] flex items-center justify-between gap-3">
                      <div className="text-xs space-y-0.5">
                        <p className="font-bold">
                          Signed by {approval.digitalSignature.signerName}
                        </p>
                        <p className="text-[11px] text-[#5b6b86] dark:text-[#9fb0cc]">
                          {approval.digitalSignature.signerDesignation}
                        </p>
                        <p className="text-[11px] font-mono text-[#5b6b86] dark:text-[#9fb0cc]">
                          {approval.digitalSignature.verificationCode} ·{' '}
                          {formatShortDate(approval.digitalSignature.signedAt)}
                        </p>
                        {approval.digitalSignature.remarks && (
                          <p className="text-[11px] text-[#5b6b86] dark:text-[#9fb0cc] pt-0.5">
                            Remarks: {approval.digitalSignature.remarks}
                          </p>
                        )}
                      </div>
                      <img
                        src={approval.digitalSignature.signatureDataUrl}
                        alt="Faculty digital signature"
                        className="h-14 w-32 object-contain bg-white rounded-lg border border-[#dbe3f0] px-1.5 shrink-0"
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc]">
                      Awaiting Faculty digital signature on this application. Switch to Faculty View → App Clearances to sign.
                    </p>
                  )}
                </div>

                {/* Attached NOC & Parent Consent Sheet */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d] space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold flex items-center gap-1.5 text-[#2f5bea] dark:text-[#7a9bff]">
                        <FileSignature className="w-3.5 h-3.5" />
                        Attached NOC Request
                      </span>
                      <span className="font-mono text-[11px] font-bold">
                        {noc?.status || 'Not linked'}
                      </span>
                    </div>
                    {noc ? (
                      <>
                        <p className="font-mono text-[11px] font-bold">{noc.nocNumber}</p>
                        <p className="text-[#5b6b86] dark:text-[#9fb0cc]">
                          {noc.companyName} · {noc.roleTitle} ({noc.workMode})
                        </p>
                        <p className="font-mono text-[11px] text-[#5b6b86] dark:text-[#9fb0cc]">
                          {formatShortDate(noc.internshipStart)} – {formatShortDate(noc.internshipEnd)}
                        </p>
                        {noc.facultySignature && (
                          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                            NOC Signed ({noc.facultySignature.verificationCode})
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-[#5b6b86] dark:text-[#9fb0cc]">
                        {activeInspectedApp.attachedNocNumber
                          ? `Ref: ${activeInspectedApp.attachedNocNumber}`
                          : 'No NOC attached yet.'}
                      </p>
                    )}
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d] space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold flex items-center gap-1.5 text-[#12805f] dark:text-[#5fe0b6]">
                        <HeartHandshake className="w-3.5 h-3.5" />
                        Parent Consent Sheet
                      </span>
                      <span className="font-mono text-[11px] font-bold">
                        {consent ? (consent.facultyVerified ? 'Verified' : 'Signed') : 'Not linked'}
                      </span>
                    </div>
                    {consent ? (
                      <>
                        <p className="font-mono text-[11px] font-bold">{consent.consentCode}</p>
                        <p>
                          Guardian: <strong>{consent.parentName}</strong> ({consent.relationship})
                        </p>
                        <p className="font-mono text-[11px] text-[#5b6b86] dark:text-[#9fb0cc]">
                          {consent.parentPhone} · Emergency: {consent.emergencyContact}
                        </p>
                        <img
                          src={consent.parentSignatureDataUrl}
                          alt="Parent signature"
                          className="h-10 w-28 object-contain bg-white rounded border border-[#dbe3f0] px-1"
                        />
                      </>
                    ) : (
                      <p className="text-[#5b6b86] dark:text-[#9fb0cc]">
                        {activeInspectedApp.attachedConsentCode
                          ? `Ref: ${activeInspectedApp.attachedConsentCode}`
                          : 'No Parent Consent Sheet attached yet.'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Criteria / SOP Snapshot */}
                {activeInspectedApp.applicationDetails && (
                  <div className="p-3.5 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d] text-xs space-y-1.5">
                    <div className="font-bold">
                      Academic &amp; Application Criteria · CGPA {activeInspectedApp.applicationDetails.cgpa} ·{' '}
                      {activeInspectedApp.applicationDetails.availability}
                    </div>
                    <p className="text-[#5b6b86] dark:text-[#9fb0cc]">
                      {activeInspectedApp.applicationDetails.coverNote}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#dbe3f0] dark:border-[#24324d]">
                  {isAllowed && !activeInspectedApp.organizerConfirmedAllowed && onConfirmApplicantForProgram && (
                    <button
                      type="button"
                      onClick={() => {
                        onConfirmApplicantForProgram(activeInspectedApp.id);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#12805f] hover:opacity-90 text-white text-xs font-bold cursor-pointer"
                    >
                      <Award className="w-4 h-4" />
                      <span>Confirm Student Open / Allowed for Program</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setInspectingApp(null)}
                    className="px-4 py-2 rounded-xl bg-[#2f5bea] text-white text-xs font-bold cursor-pointer"
                  >
                    Close Dossier
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  if (activeTab === 'org-profile') {
    return (
      <div className="max-w-3xl bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#2f5bea] text-white flex items-center justify-center font-extrabold text-lg">
              {orgName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">{orgName}</h2>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                  Verified Organizer
                </span>
              </div>
              <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc]">{user.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('post')}
            className="px-4 py-2 rounded-xl bg-[#2f5bea] text-white text-xs font-bold cursor-pointer"
          >
            + New Posting
          </button>
        </div>

        <div className="pt-4 border-t border-[#dbe3f0] dark:border-[#24324d] space-y-2">
          <h3 className="text-sm font-bold">Active Postings ({orgOpportunities.length})</h3>
          {orgOpportunities.map((o) => (
            <div
              key={o.id}
              className="p-3.5 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d] flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-bold">{o.title}</p>
                <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc]">
                  {o.mode} · {formatStipend(o)} · Deadline {formatShortDate(o.deadline)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('applicants')}
                className="text-xs font-bold text-[#2f5bea] dark:text-[#7a9bff] cursor-pointer"
              >
                Review applicants
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Default: Analytics Dashboard (matching Photo 3 InternshipPro)
  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Company Analytics</h2>
          <p className="text-sm text-[#5b6b86] dark:text-[#9fb0cc]">
            Track your internship program performance and recruitment funnel for {orgName}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('post')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2f5bea] hover:bg-[#244bc9] text-white text-xs font-bold cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Post Opportunity</span>
        </button>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc]">Total Internships</p>
            <p className="text-3xl font-extrabold mt-1 tabular-nums">{orgOpportunities.length}</p>
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
              {opportunities.length} total live in Hub
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#e8eeff] dark:bg-[#1c2a50] text-[#2f5bea] dark:text-[#7a9bff] flex items-center justify-center">
            <Briefcase className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc]">
              Open / Allowed for Program
            </p>
            <p className="text-3xl font-extrabold mt-1 tabular-nums text-emerald-600 dark:text-emerald-400">
              {stats.facultyAllowed}
            </p>
            <p className="text-xs font-semibold text-[#12805f] dark:text-[#5fe0b6] mt-1 tabular-nums">
              {stats.confirmedEntry} Organizer confirmed
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc]">Total Applications</p>
            <p className="text-3xl font-extrabold mt-1 tabular-nums">{stats.totalApps}</p>
            <p className="text-xs font-semibold text-[#2f5bea] dark:text-[#7a9bff] mt-1 tabular-nums">
              {stats.pending} awaiting review
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc]">Acceptance Rate</p>
            <p className="text-3xl font-extrabold mt-1 tabular-nums">{stats.acceptanceRate}%</p>
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
              {stats.selected} selected
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Live Faculty-Signed Candidates Banner */}
      {stats.facultyAllowed > 0 && (
        <div className="bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-800/70 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Eye className="w-5 h-5 text-[#12805f] dark:text-[#5fe0b6] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                {stats.facultyAllowed} student application{stats.facultyAllowed > 1 ? 's' : ''} digitally signed by Faculty as Open / Allowed for Program
              </p>
              <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc]">
                Review attached NOC Requests &amp; Parent Consent Sheets and confirm candidate entry for the program.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('applicants')}
            className="px-4 py-2 rounded-xl bg-[#12805f] hover:opacity-90 text-white text-xs font-bold whitespace-nowrap cursor-pointer shrink-0"
          >
            Review Cleared Applicants
          </button>
        </div>
      )}

      {/* Charts Row (Application Trends Area Chart + Application Status Donut) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Application Trends */}
        <div className="lg:col-span-7 bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold">Application Trends</h3>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-[#e8eeff] dark:bg-[#1c2a50] text-[#2f5bea] dark:text-[#7a9bff]">
              Monthly
            </span>
          </div>

          <div className="pt-2">
            <svg viewBox="0 0 460 190" className="w-full h-48 overflow-visible">
              <defs>
                <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {/* Grid lines */}
              {[30, 70, 110, 150].map((y) => (
                <line
                  key={y}
                  x1="36"
                  y1={y}
                  x2="440"
                  y2={y}
                  stroke="currentColor"
                  className="text-[#dbe3f0] dark:text-[#24324d]"
                  strokeDasharray="3 3"
                />
              ))}
              {/* Area path */}
              <path
                d="M 40 150 L 118 148 L 196 146 L 274 142 L 352 128 L 430 34 L 430 150 Z"
                fill="url(#trendGrad)"
              />
              {/* Line path */}
              <path
                d="M 40 150 L 118 148 L 196 146 L 274 142 L 352 128 L 430 34"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Month labels */}
              {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((m, idx) => (
                <text
                  key={m}
                  x={40 + idx * 78}
                  y={174}
                  textAnchor="middle"
                  className="fill-[#5b6b86] dark:fill-[#9fb0cc] text-[11px] font-medium"
                >
                  {m}
                </text>
              ))}
              {/* Y labels */}
              {[
                { y: 34, val: Math.max(4, stats.totalApps) },
                { y: 74, val: Math.max(3, Math.round(stats.totalApps * 0.66)) },
                { y: 114, val: Math.max(1, Math.round(stats.totalApps * 0.33)) },
                { y: 154, val: 0 },
              ].map((tick) => (
                <text
                  key={tick.y}
                  x="26"
                  y={tick.y}
                  textAnchor="end"
                  className="fill-[#5b6b86] dark:fill-[#9fb0cc] text-[11px] font-mono"
                >
                  {tick.val}
                </text>
              ))}
            </svg>
          </div>
        </div>

        {/* Application Status Donut */}
        <div className="lg:col-span-5 bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold">Application Status</h3>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400">
              Current
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6 pt-2">
            <div className="relative w-36 h-36 shrink-0">
              <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
                <circle
                  cx="70"
                  cy="70"
                  r="52"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="22"
                  className="text-[#edf1f8] dark:text-[#1f2c48]"
                />
                {donutSegments.map((seg) => (
                  <circle
                    key={seg.label}
                    cx="70"
                    cy="70"
                    r="52"
                    fill="none"
                    stroke={seg.color}
                    strokeWidth="22"
                    strokeDasharray={seg.dashArray}
                    strokeDashoffset={seg.dashOffset}
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-extrabold tabular-nums">{stats.totalApps}</span>
                <span className="text-[11px] text-[#5b6b86] dark:text-[#9fb0cc]">Total</span>
              </div>
            </div>

            <div className="flex-1 w-full space-y-2.5">
              {donutSegments.map((seg) => (
                <div key={seg.label} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: seg.color }}
                    />
                    <span className="font-semibold">{seg.label}</span>
                  </div>
                  <span className="font-mono font-bold tabular-nums text-[#5b6b86] dark:text-[#9fb0cc]">
                    {seg.count} ({seg.pctLabel})
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-[#dbe3f0] dark:border-[#24324d] flex justify-end">
            <button
              type="button"
              onClick={() => onNavigate('applicants')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2f5bea] dark:text-[#7a9bff] hover:underline cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Review all applicants</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
