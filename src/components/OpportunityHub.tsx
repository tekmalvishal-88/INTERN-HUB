import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Filter,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import type {
  AiSmartPick,
  ApplicationCriteriaPayload,
  ApplicationRecord,
  NocRequest,
  Opportunity,
  OpportunityType,
  ParentConsentSheet,
  StudentProfile,
  WorkMode,
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

interface OpportunityHubProps {
  opportunities: Opportunity[];
  profile: StudentProfile;
  applications: ApplicationRecord[];
  nocRequests?: NocRequest[];
  parentConsents?: ParentConsentSheet[];
  userEmail: string;
  initialSearch?: string;
  onApply: (opp: Opportunity, details?: ApplicationCriteriaPayload) => void;
  onRefreshHub?: () => Promise<void>;
  isSyncingHub?: boolean;
}

const FILTER_SKILLS = [
  'React',
  'Python',
  'JavaScript',
  'TypeScript',
  'SQL',
  'Node.js',
  'Machine Learning',
  'Figma',
  'Java',
  'APIs',
];

const PREFERENCE_PRESETS = [
  'High-paying Remote Software roles fitting my exams',
  'Data Science & SQL roles in Hyderabad or Remote',
  'Weekend Hackathons with big prizes',
  'Best overall match for my current skills',
];

const PAGE_SIZE = 18;

export const OpportunityHub: React.FC<OpportunityHubProps> = ({
  opportunities,
  profile,
  applications,
  nocRequests = [],
  parentConsents = [],
  userEmail,
  initialSearch = '',
  onApply,
  onRefreshHub,
  isSyncingHub = false,
}) => {
  const [search, setSearch] = useState(initialSearch);
  const [selectedTypes, setSelectedTypes] = useState<OpportunityType[]>([]);
  const [selectedModes, setSelectedModes] = useState<WorkMode[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [minStipend, setMinStipend] = useState<number>(0);
  const [examSafeOnly, setExamSafeOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'match' | 'deadline' | 'stipend'>('match');
  const [page, setPage] = useState<number>(1);

  // AI Smart Picker state
  const [prefPrompt, setPrefPrompt] = useState<string>(
    'High-paying Remote or Hyderabad roles that fit my skills and avoid exam clashes'
  );
  const [smartPicking, setSmartPicking] = useState(false);
  const [smartPicks, setSmartPicks] = useState<AiSmartPick[]>([]);
  const [smartPickError, setSmartPickError] = useState<string | null>(null);
  const [applyingOpp, setApplyingOpp] = useState<Opportunity | null>(null);

  const toggleType = (t: OpportunityType) => {
    setPage(1);
    setSelectedTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const toggleMode = (m: WorkMode) => {
    setPage(1);
    setSelectedModes((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  };

  const toggleSkill = (s: string) => {
    setPage(1);
    setSelectedSkills((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const clearFilters = () => {
    setPage(1);
    setSearch('');
    setSelectedTypes([]);
    setSelectedModes([]);
    setSelectedSkills([]);
    setMinStipend(0);
    setExamSafeOnly(false);
  };

  const enriched = useMemo(() => {
    const today = todayIso();
    const q = search.trim().toLowerCase();

    return opportunities
      .map((opp) => {
        const match = getSkillMatch(opp, profile);
        const clash = getExamClash(opp, profile);
        const daysLeft = daysBetween(today, opp.deadline);
        const existingApp = applications.find(
          (a) =>
            a.opportunityId === opp.id &&
            a.applicantEmail.toLowerCase() === userEmail.toLowerCase()
        );
        return { opp, match, clash, daysLeft, existingApp };
      })
      .filter(({ opp, clash }) => {
        if (q) {
          const haystack = `${opp.title} ${opp.company} ${opp.location} ${opp.skills.join(' ')} ${opp.domain}`.toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        if (selectedTypes.length > 0 && !selectedTypes.includes(opp.type)) return false;
        if (selectedModes.length > 0 && !selectedModes.includes(opp.mode)) return false;
        if (minStipend > 0 && opp.stipend < minStipend) return false;
        if (examSafeOnly && clash.status === 'clash') return false;
        if (selectedSkills.length > 0) {
          const oppSkillsLower = opp.skills.map((s) => s.toLowerCase());
          const hasAny = selectedSkills.some((sk) => oppSkillsLower.includes(sk.toLowerCase()));
          if (!hasAny) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'stipend') return b.opp.stipend - a.opp.stipend;
        if (sortBy === 'deadline') return a.daysLeft - b.daysLeft;
        return b.match.pct - a.match.pct || a.daysLeft - b.daysLeft;
      });
  }, [
    opportunities,
    profile,
    applications,
    userEmail,
    search,
    selectedTypes,
    selectedModes,
    selectedSkills,
    minStipend,
    examSafeOnly,
    sortBy,
  ]);

  const totalPages = Math.max(1, Math.ceil(enriched.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return enriched.slice(start, start + PAGE_SIZE);
  }, [enriched, currentPage]);

  const runSmartPicker = async (customPref?: string) => {
    const query = (customPref ?? prefPrompt).trim();
    if (customPref) setPrefPrompt(customPref);
    setSmartPicking(true);
    setSmartPickError(null);

    try {
      const pool = (enriched.length > 0 ? enriched : opportunities.map((opp) => ({
        opp,
        match: getSkillMatch(opp, profile),
        clash: getExamClash(opp, profile),
        daysLeft: daysBetween(todayIso(), opp.deadline),
        existingApp: undefined,
      })))
        .filter((item) => item.daysLeft >= 0 && item.match.semesterEligible)
        .slice(0, 24)
        .map(({ opp, match, clash }) => ({
          id: opp.id,
          title: opp.title,
          company: opp.company,
          type: opp.type,
          mode: opp.mode,
          location: opp.location,
          stipend: opp.stipend,
          deadline: opp.deadline,
          matchPct: match.pct,
          examStatus: clash.label,
          skills: opp.skills,
        }));

      const res = await fetch('/api/smart-pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferencePrompt: query,
          skills: profile.skills,
          semester: profile.semester,
          candidates: pool,
        }),
      });

      const data = (await res.json()) as { picks?: AiSmartPick[]; error?: string };
      if (!res.ok || !Array.isArray(data.picks)) {
        throw new Error(data.error || 'Could not generate AI Smart Picks.');
      }
      setSmartPicks(data.picks);
    } catch (err: unknown) {
      setSmartPickError(err instanceof Error ? err.message : 'Smart Picker failed.');
    } finally {
      setSmartPicking(false);
    }
  };

  const smartPickItems = useMemo(() => {
    return smartPicks
      .map((pick) => {
        const opp = opportunities.find((o) => o.id === pick.opportunityId);
        if (!opp) return null;
        const match = getSkillMatch(opp, profile);
        const clash = getExamClash(opp, profile);
        const existingApp = applications.find(
          (a) =>
            a.opportunityId === opp.id &&
            a.applicantEmail.toLowerCase() === userEmail.toLowerCase()
        );
        return { pick, opp, match, clash, existingApp };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [smartPicks, opportunities, profile, applications, userEmail]);

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* Left Filter Rail */}
      <aside className="w-full lg:w-64 shrink-0 bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Filter className="w-4 h-4 text-[#2f5bea] dark:text-[#7a9bff]" />
            <span>Filters</span>
          </div>
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#5b6b86] hover:text-[#12203a] dark:hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold text-[#5b6b86] dark:text-[#9fb0cc]">Type</p>
          {(['Internship', 'Hackathon', 'Job'] as OpportunityType[]).map((type) => (
            <label key={type} className="flex items-center gap-2.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={selectedTypes.includes(type)}
                onChange={() => toggleType(type)}
                className="rounded border-[#dbe3f0] text-[#2f5bea] focus:ring-[#2f5bea]"
              />
              <span>{type === 'Job' ? 'Full-Time / PPO' : `${type}s`}</span>
            </label>
          ))}
        </div>

        <div className="space-y-2 pt-3 border-t border-[#dbe3f0] dark:border-[#24324d]">
          <p className="text-xs font-bold text-[#5b6b86] dark:text-[#9fb0cc]">Location</p>
          {(['Remote', 'On-site', 'Hybrid'] as WorkMode[]).map((mode) => (
            <label key={mode} className="flex items-center gap-2.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={selectedModes.includes(mode)}
                onChange={() => toggleMode(mode)}
                className="rounded border-[#dbe3f0] text-[#2f5bea] focus:ring-[#2f5bea]"
              />
              <span>{mode}</span>
            </label>
          ))}
        </div>

        <div className="space-y-2 pt-3 border-t border-[#dbe3f0] dark:border-[#24324d]">
          <p className="text-xs font-bold text-[#5b6b86] dark:text-[#9fb0cc]">Academic Schedule</p>
          <label className="flex items-center gap-2.5 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={examSafeOnly}
              onChange={(e) => {
                setPage(1);
                setExamSafeOnly(e.target.checked);
              }}
              className="rounded border-[#dbe3f0] text-[#2f5bea] focus:ring-[#2f5bea]"
            />
            <span>Hide full exam clashes</span>
          </label>
        </div>

        <div className="space-y-2 pt-3 border-t border-[#dbe3f0] dark:border-[#24324d]">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[#5b6b86] dark:text-[#9fb0cc]">Min Stipend</span>
            <span className="font-mono font-bold tabular-nums text-[#2f5bea] dark:text-[#7a9bff]">
              ₹{Math.round(minStipend / 1000)}K+
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={80000}
            step={5000}
            value={minStipend}
            onChange={(e) => {
              setPage(1);
              setMinStipend(Number(e.target.value));
            }}
            className="w-full accent-[#2f5bea] cursor-pointer"
          />
          <div className="flex justify-between text-[11px] font-mono text-[#5b6b86]">
            <span>₹0K</span>
            <span>₹80K+</span>
          </div>
        </div>

        <div className="space-y-2 pt-3 border-t border-[#dbe3f0] dark:border-[#24324d]">
          <p className="text-xs font-bold text-[#5b6b86] dark:text-[#9fb0cc]">Skills</p>
          <div className="flex flex-wrap gap-1.5">
            {FILTER_SKILLS.map((skill) => {
              const active = selectedSkills.includes(skill);
              return (
                <button
                  key={skill}
                  type="button"
                  onClick={() => toggleSkill(skill)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#2f5bea] text-white border-[#2f5bea]'
                      : 'bg-[#f8fafe] dark:bg-[#0e1626] border-[#dbe3f0] dark:border-[#24324d] text-[#5b6b86] dark:text-[#9fb0cc] hover:border-[#2f5bea]'
                  }`}
                >
                  {skill}
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Main Opportunity Catalog */}
      <div className="flex-1 min-w-0 space-y-5">
        {/* AI Smart Picker Panel */}
        <div className="bg-[#12192c] dark:bg-[#131d33] text-white border border-[#232f4e] dark:border-[#24324d] rounded-2xl p-5 space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#7a9bff]" />
              <h2 className="text-sm font-bold">AI Smart Picker — Curated to Your Preferences</h2>
            </div>
            <span className="text-[11px] text-slate-300 tabular-nums">
              Scanning {opportunities.length} live opportunities
            </span>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void runSmartPicker();
            }}
            className="flex flex-col sm:flex-row gap-2.5"
          >
            <input
              type="text"
              value={prefPrompt}
              onChange={(e) => setPrefPrompt(e.target.value)}
              placeholder="Describe your ideal internship (e.g. Remote React role ₹35K+ avoiding exams)..."
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/15 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-[#7a9bff]"
            />
            <button
              type="submit"
              disabled={smartPicking}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#2f5bea] hover:bg-[#3e68f0] text-white text-xs font-bold transition-colors cursor-pointer shrink-0 disabled:opacity-60"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{smartPicking ? 'Picking best 4...' : 'AI Smart Pick'}</span>
            </button>
          </form>

          <div className="flex flex-wrap gap-1.5">
            {PREFERENCE_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => void runSmartPicker(preset)}
                disabled={smartPicking}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-medium text-slate-200 transition-colors cursor-pointer"
              >
                {preset}
              </button>
            ))}
          </div>

          {smartPickError && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{smartPickError}</span>
            </div>
          )}

          {smartPickItems.length > 0 && (
            <div className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
              {smartPickItems.map(({ pick, opp, match, clash, existingApp }) => (
                <div
                  key={opp.id}
                  className="bg-white text-[#12203a] rounded-xl p-4 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-[#2f5bea] bg-[#e8eeff] px-2 py-0.5 rounded-md">
                        {pick.fitTag}
                      </span>
                      <span className="font-mono text-xs font-bold text-emerald-700 tabular-nums">
                        {match.pct}% match · {formatStipend(opp)}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold leading-snug">
                      {opp.title} · <span className="text-[#5b6b86] font-semibold">{opp.company}</span>
                    </h3>
                    <p className="text-xs text-[#5b6b86] leading-relaxed">{pick.reason}</p>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <span className="text-[11px] font-semibold text-[#5b6b86]">
                      {opp.mode} · {clash.label}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {existingApp ? (
                        <span className="text-[11px] font-bold text-emerald-700">
                          {existingApp.stage}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setApplyingOpp(opp)}
                          className="px-3 py-1.5 rounded-lg bg-[#2f5bea] text-white text-[11px] font-bold cursor-pointer"
                        >
                          Apply
                        </button>
                      )}
                      <a
                        href={opp.officialUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-[#2f5bea]"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Search + Sort Bar */}
        <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-3 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#5b6b86] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder="Search 160+ opportunities, companies, or skills..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#f3f6fb] dark:bg-[#0b1120] border border-transparent focus:border-[#2f5bea] text-sm focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <span className="text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] tabular-nums">
              Showing {enriched.length} opportunities
            </span>
            {onRefreshHub && (
              <button
                type="button"
                onClick={() => void onRefreshHub()}
                disabled={isSyncingHub}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-[#f8fafe] dark:bg-[#0e1626] hover:border-[#2f5bea] text-xs font-semibold text-[#2f5bea] dark:text-[#7a9bff] transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingHub ? 'animate-spin' : ''}`} />
                <span>{isSyncingHub ? 'Updating...' : 'Sync Hub'}</span>
              </button>
            )}
            <select
              value={sortBy}
              onChange={(e) => {
                setPage(1);
                setSortBy(e.target.value as 'match' | 'deadline' | 'stipend');
              }}
              aria-label="Sort opportunities"
              className="px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-[#f8fafe] dark:bg-[#0e1626] text-xs font-semibold focus:outline-none"
            >
              <option value="match">Sort: Best Skill Match</option>
              <option value="deadline">Sort: Earliest Deadline</option>
              <option value="stipend">Sort: Highest Stipend</option>
            </select>
          </div>
        </div>

        {/* Cards Grid */}
        {enriched.length === 0 ? (
          <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-10 text-center space-y-3">
            <p className="text-base font-bold">No matching opportunities found</p>
            <p className="text-sm text-[#5b6b86] dark:text-[#9fb0cc]">
              Try clearing one or more filters or lowering the minimum stipend.
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="px-4 py-2 rounded-xl bg-[#2f5bea] text-white text-sm font-semibold cursor-pointer"
            >
              Reset all filters
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {paginated.map(({ opp, match, clash, daysLeft, existingApp }) => {
                const userSkillsLower = new Set(profile.skills.map((s) => s.toLowerCase()));
                const dlBadge =
                  daysLeft < 0
                    ? 'text-[#5b6b86]'
                    : daysLeft < 3
                    ? 'text-rose-600 dark:text-rose-400 font-bold'
                    : daysLeft <= 14
                    ? 'text-amber-600 dark:text-amber-400 font-bold'
                    : 'text-emerald-600 dark:text-emerald-400 font-bold';

                return (
                  <div
                    key={opp.id}
                    className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-5 flex flex-col justify-between hover:border-[#2f5bea]/60 transition-colors"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-base font-bold leading-snug">{opp.title}</h3>
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mt-0.5">
                            <span>{opp.company}</span>
                            {opp.verified && (
                              <ShieldCheck
                                className="w-3.5 h-3.5 text-[#2f5bea] dark:text-[#7a9bff]"
                                aria-label="Verified organization"
                              />
                            )}
                          </div>
                        </div>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#f3f6fb] dark:bg-[#1c2a50] text-[#5b6b86] dark:text-[#9fb0cc] shrink-0">
                          {opp.type}
                        </span>
                      </div>

                      <div className="text-xs text-[#5b6b86] dark:text-[#9fb0cc] flex flex-wrap items-center gap-1.5 tabular-nums">
                        <span className="font-semibold text-[#12203a] dark:text-[#e8eefc]">
                          {opp.mode === 'Remote' ? 'Remote' : `${opp.mode} · ${opp.location}`}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono font-semibold text-[#2f5bea] dark:text-[#7a9bff]">
                          {formatStipend(opp)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{opp.durationLabel}</span>
                      </div>

                      <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc] line-clamp-2 leading-relaxed">
                        {opp.description}
                      </p>

                      <div className="flex flex-wrap gap-1.5">
                        {opp.skills.map((skill) => {
                          const hasSkill = userSkillsLower.has(skill.toLowerCase());
                          return (
                            <span
                              key={skill}
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                                hasSkill
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-[#f8fafe] dark:bg-[#0e1626] border-[#dbe3f0] dark:border-[#24324d] text-[#5b6b86] dark:text-[#9fb0cc]'
                              }`}
                            >
                              {skill}
                            </span>
                          );
                        })}
                      </div>

                      <div className="pt-2 space-y-1.5">
                        <div className="flex items-center justify-between text-xs tabular-nums">
                          <span className="font-semibold">Skill match {match.pct}%</span>
                          <span
                            className={`font-semibold ${
                              clash.status === 'fit'
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : clash.status === 'partial'
                                ? 'text-amber-700 dark:text-amber-400'
                                : 'text-rose-700 dark:text-rose-400'
                            }`}
                          >
                            {clash.label}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[#edf1f8] dark:bg-[#1f2c48] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#2f5bea] dark:bg-[#7a9bff]"
                            style={{ width: `${Math.max(6, match.pct)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#dbe3f0] dark:border-[#24324d] space-y-2.5">
                      <div className="flex items-center justify-between text-[11px] tabular-nums">
                        <span className={dlBadge}>
                          Due {formatShortDate(opp.deadline)} ({daysLeft < 0 ? 'Closed' : `${daysLeft}d left`})
                        </span>
                        <span className="text-[#5b6b86] dark:text-[#9fb0cc]">
                          via {opp.sourcePlatform}
                        </span>
                      </div>

                      {!match.semesterEligible && (
                        <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                          Requires Semester {opp.minSemester}+ (you are Sem {profile.semester})
                        </p>
                      )}

                      <div className="flex items-center gap-2">
                        {existingApp ? (
                          <div className="flex-1 py-2 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{existingApp.stage}</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={!match.semesterEligible || daysLeft < 0}
                            onClick={() => setApplyingOpp(opp)}
                            className="flex-1 py-2 px-3 rounded-xl bg-[#2f5bea] hover:bg-[#244bc9] text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                          >
                            Apply Now
                          </button>
                        )}

                        <a
                          href={opp.officialUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 py-2 px-3 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] hover:border-[#2f5bea] text-xs font-semibold transition-colors shrink-0"
                        >
                          <span>Portal</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Bar */}
            {totalPages > 1 && (
              <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-3.5 flex items-center justify-between">
                <span className="text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] tabular-nums">
                  Page {currentPage} of {totalPages} · {enriched.length} total listings
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => {
                      setPage((p) => Math.max(1, p - 1));
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] text-xs font-bold disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Prev</span>
                  </button>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => {
                      setPage((p) => Math.min(totalPages, p + 1));
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] text-xs font-bold disabled:opacity-40 cursor-pointer"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <ApplicationCriteriaModal
        opportunity={applyingOpp}
        profile={profile}
        userEmail={userEmail}
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
