import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileSignature,
  FileText,
  Sparkles,
  UploadCloud,
  Users,
} from 'lucide-react';
import type {
  ApplicationCriteriaPayload,
  ApplicationRecord,
  CourseResource,
  LearnerTab,
  NocRequest,
  Opportunity,
  ParentConsentSheet,
  StudentProfile,
  UserAccount,
} from '../types';
import {
  daysBetween,
  formatShortDate,
  formatStipend,
  getExamClash,
  getSkillMatch,
  todayIso,
} from '../utils/matching';
import { ApplicationCriteriaModal } from './ApplicationCriteriaModal';
import { GoogleVAvatar } from './GoogleVAvatar';

interface LearnerDashboardProps {
  user: UserAccount;
  profile: StudentProfile;
  opportunities: Opportunity[];
  applications: ApplicationRecord[];
  courses: CourseResource[];
  nocRequests?: NocRequest[];
  parentConsents?: ParentConsentSheet[];
  nocCount?: number;
  approvedNocCount?: number;
  parentConsentCount?: number;
  onNavigate: (tab: LearnerTab) => void;
  onApply: (opp: Opportunity, details?: ApplicationCriteriaPayload) => void;
  onUploadResume: (fileName: string) => void;
  onLaunchAiPrompt: (prompt: string) => void;
  onOpenPersonalization?: () => void;
}

type UrgencyTier = 'none' | 'red' | 'orange' | 'green';

function getUrgencyTier(daysLeft: number): UrgencyTier {
  if (daysLeft < 0) return 'none';
  if (daysLeft < 3) return 'red';
  if (daysLeft <= 14) return 'orange';
  return 'green';
}

export const LearnerDashboard: React.FC<LearnerDashboardProps> = ({
  user,
  profile,
  opportunities,
  applications,
  courses,
  nocRequests = [],
  parentConsents = [],
  nocCount = 0,
  approvedNocCount = 0,
  parentConsentCount = 0,
  onNavigate,
  onApply,
  onUploadResume,
  onLaunchAiPrompt,
  onOpenPersonalization,
}) => {
  const [matchIndex, setMatchIndex] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>(todayIso());
  const [applyingOpp, setApplyingOpp] = useState<Opportunity | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const myApps = useMemo(
    () =>
      applications.filter((a) => a.applicantEmail.toLowerCase() === user.email.toLowerCase()),
    [applications, user.email]
  );

  const recommended = useMemo(() => {
    const today = todayIso();
    return opportunities
      .map((opp) => ({
        opp,
        match: getSkillMatch(opp, profile),
        clash: getExamClash(opp, profile),
        daysLeft: daysBetween(today, opp.deadline),
      }))
      .filter((item) => item.daysLeft >= 0 && item.clash.status !== 'clash')
      .sort((a, b) => b.match.pct - a.match.pct || a.daysLeft - b.daysLeft);
  }, [opportunities, profile]);

  const featuredItem =
    recommended.length > 0 ? recommended[matchIndex % recommended.length] : undefined;

  const upcomingDeadlines = useMemo(() => {
    const today = todayIso();
    return opportunities
      .map((opp) => ({ opp, daysLeft: daysBetween(today, opp.deadline) }))
      .filter((x) => x.daysLeft >= 0)
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 4);
  }, [opportunities]);

  const domainProgress = useMemo(() => {
    const domains: Array<{ name: string; color: string; keywords: string[] }> = [
      {
        name: 'Software Engineering',
        color: 'bg-emerald-500',
        keywords: ['React', 'TypeScript', 'JavaScript', 'Node.js', 'Git', 'APIs', 'Java'],
      },
      {
        name: 'Data & Machine Learning',
        color: 'bg-[#2f5bea]',
        keywords: ['Python', 'SQL', 'Machine Learning', 'Tableau', 'Excel', 'Statistics'],
      },
      {
        name: 'Design & Product',
        color: 'bg-amber-500',
        keywords: ['Figma', 'Adobe XD', 'User Research', 'Prototyping', 'Canva'],
      },
    ];
    const userSet = new Set(profile.skills.map((s) => s.toLowerCase()));
    return domains.map((d) => {
      const count = d.keywords.filter((k) => userSet.has(k.toLowerCase())).length;
      const pct = Math.min(100, Math.round((count / d.keywords.length) * 100));
      return { name: d.name, pct, color: d.color };
    });
  }, [profile.skills]);

  // Calendar month cells with Red (<3d), Orange (3-14d), Green (>14d) due-date color coding
  const calendarData = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const monthLabel = now.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = todayIso();

    const deadlineMap = new Map<string, Opportunity[]>();
    for (const opp of opportunities) {
      const list = deadlineMap.get(opp.deadline) ?? [];
      list.push(opp);
      deadlineMap.set(opp.deadline, list);
    }

    const cells: Array<{
      iso: string | null;
      dayNum: number | null;
      isExam: boolean;
      urgency: UrgencyTier;
      deadlineCount: number;
      isToday: boolean;
    }> = [];

    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({
        iso: null,
        dayNum: null,
        isExam: false,
        urgency: 'none',
        deadlineCount: 0,
        isToday: false,
      });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isExam =
        Boolean(profile.examStart && profile.examEnd) &&
        iso >= profile.examStart &&
        iso <= profile.examEnd;
      const list = deadlineMap.get(iso) ?? [];
      const daysLeft = daysBetween(today, iso);
      const urgency: UrgencyTier = list.length > 0 ? getUrgencyTier(daysLeft) : 'none';

      cells.push({
        iso,
        dayNum: d,
        isExam,
        urgency,
        deadlineCount: list.length,
        isToday: iso === today,
      });
    }

    return { monthLabel, cells, deadlineMap };
  }, [opportunities, profile.examStart, profile.examEnd]);

  const handleFileChange = (files: FileList | null) => {
    if (files && files[0]) {
      onUploadResume(files[0].name);
    }
  };

  const selectedDayOpps = calendarData.deadlineMap.get(selectedDay) ?? [];
  const selectedDayIsExam =
    Boolean(profile.examStart && profile.examEnd) &&
    selectedDay >= profile.examStart &&
    selectedDay <= profile.examEnd;

  const shortlistedCount = myApps.filter(
    (a) =>
      a.stage === 'Shortlisted' ||
      a.stage === 'Recruiter Call' ||
      a.stage === 'Phone Screen' ||
      a.stage === 'Selected'
  ).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left 8 columns */}
        <div className="xl:col-span-8 space-y-5">
          {/* Top Row: Applications KPI + Skill Tracker */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            <div className="md:col-span-5 bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[#12203a] dark:text-[#e8eefc]">
                  Applications sent
                </span>
                <button
                  type="button"
                  onClick={() => onNavigate('applications')}
                  className="px-2.5 py-1 rounded-lg border border-[#dbe3f0] dark:border-[#24324d] text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] hover:text-[#12203a] dark:hover:text-white transition-colors cursor-pointer"
                >
                  Details
                </button>
              </div>

              <div className="my-4 flex items-end justify-between gap-4">
                <div>
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-4xl font-extrabold tracking-tight tabular-nums">
                      {myApps.length}
                    </span>
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {shortlistedCount} active calls
                    </span>
                  </div>
                  <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc] mt-1">
                    {myApps.length === 0
                      ? `${recommended.length} exam-safe roles ready in Hub`
                      : `${recommended.length} exam-safe opportunities matched`}
                  </p>
                </div>

                <svg viewBox="0 0 110 44" className="w-24 h-11 shrink-0" aria-hidden="true">
                  <path
                    d="M4 34 L26 24 L48 28 L72 13 L92 18 L106 6"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="106" cy="6" r="3" fill="#f59e0b" />
                </svg>
              </div>
            </div>

            <div className="md:col-span-7 bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold">Skill tracker</span>
                <button
                  type="button"
                  onClick={() => onNavigate('skills')}
                  className="text-xs font-semibold text-[#2f5bea] dark:text-[#7a9bff] hover:underline cursor-pointer"
                >
                  + view skill gaps
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                <div className="sm:col-span-5">
                  <div className="text-3xl font-extrabold tracking-tight tabular-nums">
                    {profile.skills.length}{' '}
                    <span className="text-base font-semibold text-[#5b6b86]">skills</span>
                  </div>
                  <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc] mt-1">
                    Semester {profile.semester} · {profile.branch.split(' ')[0]}
                  </p>
                </div>

                <div className="sm:col-span-7 space-y-2.5">
                  {domainProgress.map((item) => (
                    <div key={item.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-[#12203a] dark:text-[#e8eefc]">
                          {item.name}
                        </span>
                        <span className="font-mono font-semibold tabular-nums text-[#5b6b86] dark:text-[#9fb0cc]">
                          {item.pct}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-[#edf1f8] dark:bg-[#1f2c48] overflow-hidden">
                        <div
                          className={`h-full rounded-full ${item.color} transition-all duration-300`}
                          style={{ width: `${Math.max(8, item.pct)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Middle Row: Featured Opportunity Dark Card + Mock Interview + Upload CV */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            <div className="md:col-span-5 bg-[#12192c] dark:bg-[#0f172a] text-white border border-[#232f4e] rounded-2xl p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-300">Recommended Match</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setMatchIndex((i) =>
                        recommended.length ? (i - 1 + recommended.length) % recommended.length : 0
                      )
                    }
                    aria-label="Previous recommended role"
                    className="p-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setMatchIndex((i) => (recommended.length ? (i + 1) % recommended.length : 0))
                    }
                    aria-label="Next recommended role"
                    className="p-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {featuredItem ? (
                <>
                  <div className="bg-white text-[#12203a] rounded-xl p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-[#2f5bea]">
                          {featuredItem.opp.company} · {featuredItem.opp.location}
                        </p>
                        <h3 className="text-base font-bold leading-snug mt-0.5">
                          {featuredItem.opp.title}
                        </h3>
                      </div>
                      <span className="font-mono text-xs font-bold text-emerald-700 tabular-nums shrink-0">
                        {featuredItem.match.pct}% fit
                      </span>
                    </div>

                    <div className="text-xs text-[#5b6b86] flex flex-wrap items-center gap-1.5 tabular-nums">
                      <span className="font-semibold text-[#12203a]">
                        {formatStipend(featuredItem.opp)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{featuredItem.opp.durationLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span>{featuredItem.clash.label}</span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    {myApps.some((a) => a.opportunityId === featuredItem.opp.id) ? (
                      <button
                        type="button"
                        onClick={() => onNavigate('applications')}
                        className="flex-1 py-2 px-3 rounded-xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold cursor-pointer"
                      >
                        Applied · View in Tracker
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setApplyingOpp(featuredItem.opp)}
                        className="flex-1 py-2 px-3 rounded-xl bg-[#2f5bea] hover:bg-[#3e68f0] text-white text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Apply with saved resume
                      </button>
                    )}
                    <a
                      href={featuredItem.opp.officialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open official company portal"
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-300 py-6">
                  Add skills in your profile to unlock personalized role matches.
                </p>
              )}
            </div>

            {/* Mock Interview Card with User First-Letter Avatar */}
            <div className="md:col-span-4 bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-5 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <GoogleVAvatar
                    name={profile.name || user.name}
                    email={user.email}
                    role={user.role}
                    size="md"
                    showRing={false}
                  />
                  <span className="text-[11px] font-semibold text-[#2f5bea] dark:text-[#7a9bff]">
                    AI Voice Coach
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold leading-snug">Try our Mock Interview coach</h3>
                  <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc] mt-1 leading-relaxed">
                    Fast voice & text interview practice tailored to your target roles.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  onLaunchAiPrompt(
                    `Start a quick mock interview for ${featuredItem?.opp.title || 'Software Engineering Intern'} at ${featuredItem?.opp.company || 'a tech company'}. Ask Question 1 concisely.`
                  )
                }
                className="mt-4 w-full py-2 px-3 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] hover:border-[#2f5bea] text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
              >
                <span>Start AI mock interview</span>
                <Sparkles className="w-3.5 h-3.5 text-[#2f5bea] dark:text-[#7a9bff]" />
              </button>
            </div>

            {/* Upload CV Card */}
            <div className="md:col-span-3 bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold">Saved Resumes ({profile.resumes.length})</h3>
                <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc] mt-0.5">
                  Reused on 1-click apply
                </p>
              </div>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  handleFileChange(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
                }}
                className={`mt-3 flex-1 min-h-[108px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-3 text-center cursor-pointer transition-colors ${
                  dragActive
                    ? 'border-[#2f5bea] bg-[#e8eeff]/50 dark:bg-[#1c2a50]'
                    : 'border-[#dbe3f0] dark:border-[#24324d] bg-[#f8fafe] dark:bg-[#0e1626] hover:border-[#2f5bea]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={(e) => handleFileChange(e.target.files)}
                />
                <UploadCloud className="w-5 h-5 text-[#2f5bea] dark:text-[#7a9bff] mb-1.5" />
                {profile.resumeName ? (
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 max-w-full">
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate max-w-[130px]">{profile.resumeName}</span>
                  </div>
                ) : (
                  <span className="text-[11px] text-[#5b6b86] dark:text-[#9fb0cc]">
                    Drop PDF or click
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Personalized AI Suggestions Panel */}
          <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-5 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#2f5bea] dark:text-[#7a9bff]" />
                <h2 className="text-sm font-bold">AI Personalized Picks For You</h2>
              </div>
              {onOpenPersonalization && (
                <button
                  type="button"
                  onClick={onOpenPersonalization}
                  className="text-xs font-bold text-[#2f5bea] dark:text-[#7a9bff] hover:underline cursor-pointer self-start sm:self-auto"
                >
                  {user.aiSuggestions ? 'Update AI Preferences' : 'Set Preferences & Generate Picks'}
                </button>
              )}
            </div>

            {user.aiSuggestions ? (
              <div className="space-y-3">
                <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc] leading-relaxed">
                  {user.aiSuggestions.summary}
                </p>

                {user.aiSuggestions.skillAdvice.length > 0 && (
                  <p className="text-xs font-semibold text-[#12203a] dark:text-[#e8eefc]">
                    AI Focus Skills:{' '}
                    <span className="text-[#2f5bea] dark:text-[#7a9bff]">
                      {user.aiSuggestions.skillAdvice.join(' · ')}
                    </span>
                  </p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {user.aiSuggestions.recommendations
                    .map((rec) => {
                      const opp = opportunities.find((o) => o.id === rec.opportunityId);
                      return opp ? { rec, opp } : null;
                    })
                    .filter((x): x is NonNullable<typeof x> => x !== null)
                    .slice(0, 4)
                    .map(({ rec, opp }) => {
                      const applied = myApps.some((a) => a.opportunityId === opp.id);
                      return (
                        <div
                          key={opp.id}
                          className="p-3.5 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d] flex flex-col justify-between gap-2.5"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="font-bold text-[#2f5bea] dark:text-[#7a9bff]">
                                {rec.fitTag}
                              </span>
                              <span className="font-mono font-semibold text-[#5b6b86] dark:text-[#9fb0cc] tabular-nums">
                                {formatStipend(opp)}
                              </span>
                            </div>
                            <h3 className="text-xs font-bold leading-snug">
                              {opp.title} · {opp.company}
                            </h3>
                            <p className="text-[11px] text-[#5b6b86] dark:text-[#9fb0cc] leading-relaxed">
                              {rec.reason}
                            </p>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#dbe3f0] dark:border-[#24324d]">
                            <span className="text-[11px] text-[#5b6b86] dark:text-[#9fb0cc]">
                              {opp.mode} · {opp.location}
                            </span>
                            {applied ? (
                              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                                Applied
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setApplyingOpp(opp)}
                                className="px-3 py-1 rounded-lg bg-[#2f5bea] hover:bg-[#244bc9] text-white text-[11px] font-bold cursor-pointer"
                              >
                                Apply
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d]">
                <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc]">
                  Complete your workspace personalization so Gemini AI can tailor top internships and skill tips for your goals.
                </p>
                {onOpenPersonalization && (
                  <button
                    type="button"
                    onClick={onOpenPersonalization}
                    className="px-4 py-2 rounded-xl bg-[#2f5bea] hover:bg-[#244bc9] text-white text-xs font-bold shrink-0 cursor-pointer"
                  >
                    Personalize Now
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Bottom Row: Skill Track Recommendations */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">Recommended Skill Tracks</h2>
              <button
                type="button"
                onClick={() => onNavigate('skills')}
                className="text-xs font-semibold text-[#2f5bea] dark:text-[#7a9bff] hover:underline cursor-pointer"
              >
                Open Skills Studio
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {courses.map((course) => (
                <a
                  key={course.id}
                  href={course.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`rounded-2xl p-4 border border-[#dbe3f0] dark:border-[#24324d] ${course.accentBg} hover:border-[#2f5bea] transition-colors flex flex-col justify-between group`}
                >
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-[#5b6b86] dark:text-[#9fb0cc]">
                      <span>{course.provider}</span>
                      <span className="tabular-nums">{course.duration}</span>
                    </div>
                    <h3 className="text-sm font-bold mt-2 group-hover:text-[#2f5bea] dark:group-hover:text-[#7a9bff] transition-colors">
                      {course.title}
                    </h3>
                    <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc] mt-1 line-clamp-2 leading-relaxed">
                      {course.description}
                    </p>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-black/5 dark:border-white/10 flex items-center justify-between text-[11px] font-semibold">
                    <span>Unlocks: {course.skillUnlocked}</span>
                    <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Right 4 columns: Color-Coded Deadline Calendar (<3d Red, 1-2w Orange, >2w Green) */}
        <div className="xl:col-span-4 space-y-5">
          <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-[#2f5bea] dark:text-[#7a9bff]" />
                <span className="text-sm font-bold">Deadline & Exam Calendar</span>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-[#f3f6fb] dark:bg-[#0b1120] text-[#5b6b86] dark:text-[#9fb0cc]">
                {calendarData.monthLabel}
              </span>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-2">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
                <div key={idx} className="py-1">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5 text-center">
              {calendarData.cells.map((cell, idx) => {
                if (!cell.iso || !cell.dayNum) {
                  return <div key={idx} className="h-8" />;
                }
                const isSelected = cell.iso === selectedDay;
                const urgencyClass =
                  cell.urgency === 'red'
                    ? 'bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/75 dark:text-rose-200 dark:border-rose-700'
                    : cell.urgency === 'orange'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/75 dark:text-amber-200 dark:border-amber-700'
                    : cell.urgency === 'green'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/75 dark:text-emerald-200 dark:border-emerald-700'
                    : '';

                return (
                  <button
                    key={cell.iso}
                    type="button"
                    onClick={() => setSelectedDay(cell.iso!)}
                    className={`h-8 rounded-lg text-xs font-bold tabular-nums relative flex items-center justify-center transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#12203a] dark:bg-[#2f5bea] text-white ring-2 ring-[#2f5bea]'
                        : urgencyClass
                        ? urgencyClass
                        : cell.isToday
                        ? 'border border-[#2f5bea] text-[#2f5bea] dark:text-[#7a9bff]'
                        : 'hover:bg-[#f3f6fb] dark:hover:bg-[#16213a]'
                    } ${cell.isExam && !isSelected ? 'underline decoration-2 decoration-[#2f5bea]' : ''}`}
                  >
                    {cell.dayNum}
                  </button>
                );
              })}
            </div>

            {/* Urgency Color Legend */}
            <div className="mt-4 pt-3 border-t border-[#dbe3f0] dark:border-[#24324d] space-y-2.5">
              <div className="grid grid-cols-3 gap-1.5 text-[11px] font-semibold">
                <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 shrink-0" />
                  <span>&lt;3d urgent</span>
                </div>
                <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 shrink-0" />
                  <span>1–2w soon</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 shrink-0" />
                  <span>&gt;2w safe</span>
                </div>
              </div>

              <div className="text-[11px] text-[#5b6b86] dark:text-[#9fb0cc] flex items-center justify-between">
                <span>Selected: {formatShortDate(selectedDay)}</span>
                <span>Underlined = Exam dates</span>
              </div>

              {selectedDayIsExam && (
                <p className="text-xs font-semibold text-[#2f5bea] dark:text-[#7a9bff]">
                  University exam window active on this date.
                </p>
              )}

              {selectedDayOpps.length > 0 ? (
                <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                  {selectedDayOpps.slice(0, 4).map((o) => (
                    <div key={o.id} className="text-xs font-medium flex items-center justify-between">
                      <span className="truncate">
                        {o.company} · {o.title}
                      </span>
                      <span className="text-[#2f5bea] dark:text-[#7a9bff] shrink-0 ml-2">Due</span>
                    </div>
                  ))}
                  {selectedDayOpps.length > 4 && (
                    <p className="text-[11px] text-[#5b6b86]">
                      +{selectedDayOpps.length - 4} more due on this date
                    </p>
                  )}
                </div>
              ) : (
                !selectedDayIsExam && (
                  <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc]">
                    No application deadlines on {formatShortDate(selectedDay)}.
                  </p>
                )
              )}
            </div>
          </div>

          {/* Upcoming Deadlines Card */}
          <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold">Upcoming Deadlines</h3>
              <button
                type="button"
                onClick={() => onNavigate('hub')}
                className="text-xs font-semibold text-[#2f5bea] dark:text-[#7a9bff] hover:underline cursor-pointer"
              >
                View all ({opportunities.length})
              </button>
            </div>

            <div className="space-y-2.5">
              {upcomingDeadlines.map(({ opp, daysLeft }) => {
                const tier = getUrgencyTier(daysLeft);
                const badgeClass =
                  tier === 'red'
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                    : tier === 'orange'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300';

                return (
                  <div
                    key={opp.id}
                    className="p-3 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d] flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{opp.title}</p>
                      <p className="text-[11px] text-[#5b6b86] dark:text-[#9fb0cc] truncate">
                        {opp.company} · {opp.mode}
                      </p>
                    </div>
                    <span
                      className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md tabular-nums shrink-0 ${badgeClass}`}
                    >
                      {daysLeft === 0 ? 'Today' : `${daysLeft}d left`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* NOC & Parent Consent Approvals Card */}
          <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileSignature className="w-4 h-4 text-[#2f5bea] dark:text-[#7a9bff]" />
                <h3 className="text-sm font-bold">NOC & Parent Consent</h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('approvals')}
                className="text-xs font-semibold text-[#2f5bea] dark:text-[#7a9bff] hover:underline cursor-pointer"
              >
                Open Approvals
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d]">
                <p className="text-[#5b6b86] dark:text-[#9fb0cc]">NOC Requests</p>
                <p className="text-lg font-extrabold tabular-nums mt-0.5">{nocCount}</p>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  {approvedNocCount} signed
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d]">
                <p className="text-[#5b6b86] dark:text-[#9fb0cc]">Parent Consents</p>
                <p className="text-lg font-extrabold tabular-nums mt-0.5">{parentConsentCount}</p>
                <p className="text-[11px] text-[#2f5bea] dark:text-[#7a9bff] font-semibold">
                  Sheet ready
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('approvals')}
              className="w-full py-2 px-3 rounded-xl bg-[#e8eeff] dark:bg-[#1c2a50] text-[#2f5bea] dark:text-[#7a9bff] text-xs font-bold flex items-center justify-between hover:opacity-90 transition-opacity cursor-pointer"
            >
              <span>Request NOC or Sign Parent Consent</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Community card */}
          <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-5 flex items-center justify-between gap-4">
            <div>
              <div className="text-2xl font-extrabold tabular-nums">1,350+</div>
              <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc] mt-0.5">
                Students preparing across campuses
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('hub')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#f3f6fb] dark:bg-[#1c2a50] hover:bg-[#e8eeff] text-xs font-bold transition-colors cursor-pointer shrink-0"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Explore Hub</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <ApplicationCriteriaModal
        opportunity={applyingOpp}
        profile={profile}
        userEmail={user.email}
        nocRequests={nocRequests}
        parentConsents={parentConsents}
        onClose={() => setApplyingOpp(null)}
        onSubmit={(opp, details) => {
          onApply(opp, details);
          setApplyingOpp(null);
        }}
      />
    </div>
  );
};
