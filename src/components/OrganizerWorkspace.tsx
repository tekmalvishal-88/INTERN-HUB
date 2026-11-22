import React, { useMemo, useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  Eye,
  Plus,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react';
import type {
  ApplicationRecord,
  ApplicationStage,
  DomainCategory,
  Opportunity,
  OpportunityType,
  OrganizerTab,
  UserAccount,
  WorkMode,
} from '../types';
import { offsetDate } from '../data/realData';
import { formatShortDate, formatStipend, getSkillMatchForList } from '../utils/matching';

interface OrganizerWorkspaceProps {
  activeTab: OrganizerTab;
  user: UserAccount;
  opportunities: Opportunity[];
  applications: ApplicationRecord[];
  onPublishOpportunity: (opp: Opportunity) => void;
  onUpdateApplicationStage: (appId: string, stage: ApplicationStage) => void;
  onNavigate: (tab: OrganizerTab) => void;
}

export const OrganizerWorkspace: React.FC<OrganizerWorkspaceProps> = ({
  activeTab,
  user,
  opportunities,
  applications,
  onPublishOpportunity,
  onUpdateApplicationStage,
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

  // Applicants filter
  const [filterOppId, setFilterOppId] = useState<string>('all');
  const [filterStage, setFilterStage] = useState<string>('all');

  const orgOpportunities = useMemo(
    () => opportunities.filter((o) => o.ownerOrg === orgName || o.company === orgName),
    [opportunities, orgName]
  );

  // If new organizer has 0 own postings yet, show their own + allow posting cleanly; for Demo TechCorp India, matches op-2
  const orgOppIds = useMemo(() => new Set(orgOpportunities.map((o) => o.id)), [orgOpportunities]);

  const orgApplications = useMemo(
    () => applications.filter((a) => orgOppIds.has(a.opportunityId) || a.company === orgName),
    [applications, orgOppIds, orgName]
  );

  const stats = useMemo(() => {
    const totalApps = orgApplications.length;
    const selected = orgApplications.filter((a) => a.stage === 'Selected').length;
    const shortlisted = orgApplications.filter(
      (a) => a.stage === 'Shortlisted' || a.stage === 'Recruiter Call' || a.stage === 'Phone Screen'
    ).length;
    const pending = orgApplications.filter((a) => a.stage === 'Applied').length;
    const rejected = orgApplications.filter((a) => a.stage === 'Rejected').length;
    const acceptanceRate = totalApps > 0 ? ((selected / totalApps) * 100).toFixed(1) : '0.0';
    return { totalApps, selected, shortlisted, pending, rejected, acceptanceRate };
  }, [orgApplications]);

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

  if (activeTab === 'applicants') {
    const filteredApps = orgApplications.filter((app) => {
      if (filterOppId !== 'all' && app.opportunityId !== filterOppId) return false;
      if (filterStage !== 'all' && app.stage !== filterStage) return false;
      return true;
    });

    return (
      <div className="space-y-5">
        <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">Manage Applicants ({filteredApps.length})</h2>
            <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc]">
              Review candidate skill matches and move applicants across hiring stages
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={filterOppId}
              onChange={(e) => setFilterOppId(e.target.value)}
              className="px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-[#f8fafe] dark:bg-[#0b1120] text-xs font-semibold"
            >
              <option value="all">All postings</option>
              {orgOpportunities.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title}
                </option>
              ))}
            </select>

            <select
              value={filterStage}
              onChange={(e) => setFilterStage(e.target.value)}
              className="px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-[#f8fafe] dark:bg-[#0b1120] text-xs font-semibold"
            >
              <option value="all">All stages</option>
              {(['Applied', 'Shortlisted', 'Recruiter Call', 'Phone Screen', 'Selected', 'Rejected'] as ApplicationStage[]).map(
                (st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                )
              )}
            </select>
          </div>
        </div>

        <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl overflow-hidden">
          {filteredApps.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <p className="text-sm font-bold">No applicants match your current filter</p>
              <button
                type="button"
                onClick={() => onNavigate('post')}
                className="px-4 py-2 rounded-xl bg-[#2f5bea] text-white text-xs font-bold cursor-pointer"
              >
                Post a new opportunity
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#dbe3f0] dark:border-[#24324d] text-xs font-bold text-[#5b6b86] dark:text-[#9fb0cc]">
                    <th className="py-3.5 px-5">Candidate</th>
                    <th className="py-3.5 px-5">Role</th>
                    <th className="py-3.5 px-5">Skill Match</th>
                    <th className="py-3.5 px-5">Applied</th>
                    <th className="py-3.5 px-5">Stage</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dbe3f0] dark:divide-[#24324d] text-sm">
                  {filteredApps.map((app) => {
                    const opp = opportunities.find((o) => o.id === app.opportunityId);
                    const matchPct = opp
                      ? getSkillMatchForList(opp.skills, app.applicantSkills || [])
                      : 75;
                    return (
                      <tr key={app.id} className="hover:bg-[#f8fafe] dark:hover:bg-[#16213a]">
                        <td className="py-3.5 px-5">
                          <div className="font-bold">{app.applicantName}</div>
                          <div className="text-xs text-[#5b6b86] dark:text-[#9fb0cc]">
                            {app.applicantBranch || 'CSE'} · Sem {app.applicantSemester || 5}
                          </div>
                        </td>
                        <td className="py-3.5 px-5 font-medium">{app.roleTitle}</td>
                        <td className="py-3.5 px-5">
                          <span className="font-mono text-xs font-bold tabular-nums text-[#2f5bea] dark:text-[#7a9bff]">
                            {matchPct}%
                          </span>
                        </td>
                        <td className="py-3.5 px-5 font-mono text-xs tabular-nums text-[#5b6b86]">
                          {formatShortDate(app.appliedOn)}
                        </td>
                        <td className="py-3.5 px-5">
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
                        <td className="py-3.5 px-5">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => onUpdateApplicationStage(app.id, 'Shortlisted')}
                              className="px-2.5 py-1 rounded-lg border border-[#dbe3f0] dark:border-[#24324d] hover:border-[#2f5bea] text-xs font-semibold cursor-pointer"
                            >
                              Shortlist
                            </button>
                            <button
                              type="button"
                              onClick={() => onUpdateApplicationStage(app.id, 'Recruiter Call')}
                              className="px-2.5 py-1 rounded-lg border border-[#dbe3f0] dark:border-[#24324d] hover:border-[#2f5bea] text-xs font-semibold cursor-pointer"
                            >
                              Call
                            </button>
                            <button
                              type="button"
                              onClick={() => onUpdateApplicationStage(app.id, 'Selected')}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
                            >
                              Select
                            </button>
                            <button
                              type="button"
                              onClick={() => onUpdateApplicationStage(app.id, 'Rejected')}
                              className="px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs font-semibold cursor-pointer"
                            >
                              Reject
                            </button>
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
              Live in Hub
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#e8eeff] dark:bg-[#1c2a50] text-[#2f5bea] dark:text-[#7a9bff] flex items-center justify-center">
            <Briefcase className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc]">Active Postings</p>
            <p className="text-3xl font-extrabold mt-1 tabular-nums">{orgOpportunities.length}</p>
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
              Verified org
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Eye className="w-5 h-5" />
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
