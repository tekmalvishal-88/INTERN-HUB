import React, { useState } from 'react';
import { Check, Loader2, Sparkles, X } from 'lucide-react';
import type {
  AiPersonalizationResult,
  DomainCategory,
  Opportunity,
  StudentProfile,
  UserAccount,
  UserPersonalization,
  WorkMode,
} from '../types';
import { daysBetween, getExamClash, getSkillMatch, todayIso } from '../utils/matching';

interface PersonalizationModalProps {
  open: boolean;
  user: UserAccount;
  profile: StudentProfile;
  opportunities: Opportunity[];
  onClose: () => void;
  onComplete: (
    personalization: UserPersonalization,
    aiSuggestions: AiPersonalizationResult,
    updatedSkills?: string[]
  ) => void;
}

const ALL_DOMAINS: DomainCategory[] = [
  'Software',
  'Data',
  'Design',
  'Electronics',
  'Marketing',
];

const ALL_MODES: WorkMode[] = ['Remote', 'Hybrid', 'On-site'];

const CITY_OPTIONS = [
  'Hyderabad',
  'Bengaluru',
  'Remote',
  'Pune',
  'Mumbai',
  'Chennai',
  'Delhi NCR',
];

const QUICK_SKILLS = [
  'Python',
  'React',
  'TypeScript',
  'SQL',
  'Java',
  'Node.js',
  'Machine Learning',
  'Figma',
  'APIs',
  'Data Structures',
];

function computeFallbackAiSuggestions(
  role: UserAccount['role'],
  skills: string[],
  profile: StudentProfile,
  opportunities: Opportunity[],
  pref: UserPersonalization
): AiPersonalizationResult {
  const today = todayIso();
  const scored = opportunities
    .map((opp) => {
      const match = getSkillMatch(opp, { ...profile, skills });
      const clash = getExamClash(opp, profile);
      const daysLeft = daysBetween(today, opp.deadline);
      let score = match.pct;
      if (pref.preferredDomains.includes(opp.domain)) score += 30;
      if (pref.preferredModes.includes(opp.mode)) score += 20;
      if (
        pref.preferredLocations.some(
          (loc) =>
            opp.location.toLowerCase().includes(loc.toLowerCase()) ||
            (loc === 'Remote' && opp.mode === 'Remote')
        )
      ) {
        score += 18;
      }
      if (opp.stipend >= pref.minStipend) score += 12;
      if (pref.examSafeOnly && clash.status === 'clash') score -= 60;
      if (daysLeft < 0) score -= 200;
      return { opp, match, clash, score };
    })
    .filter((item) => item.score > -100)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  const missingFreq = new Map<string, number>();
  for (const item of scored) {
    for (const sk of item.match.missing) {
      missingFreq.set(sk, (missingFreq.get(sk) ?? 0) + 1);
    }
  }
  const skillAdvice = Array.from(missingFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);

  const summary =
    role === 'faculty'
      ? `Configured Faculty Coordinator workspace for ${pref.facultyDepartment || 'CSE'} focusing on ${pref.facultyFocus || 'NOC & Leave approvals'}, highlighting high-alignment student openings.`
      : role === 'organizer'
      ? `Configured Recruiter workspace for ${pref.organizerCompany || 'your organization'} targeting ${pref.preferredDomains.join(', ') || 'Software & Data'} candidates across ${pref.preferredModes.join(', ') || 'Hybrid & Remote'} roles.`
      : `Tailored your hub for ${pref.preferredDomains.join(', ') || 'Software & Data'} (${pref.preferredModes.join(' / ') || 'Remote & Hybrid'}) with ${pref.examSafeOnly ? 'exam-safe scheduling enabled' : 'flexible dates'} targeting ₹${Math.round(pref.minStipend / 1000)}K+ stipends.`;

  return {
    summary,
    skillAdvice: skillAdvice.length > 0 ? skillAdvice : ['System Design', 'SQL', 'TypeScript'],
    recommendations: scored.map((item) => ({
      opportunityId: item.opp.id,
      fitTag: `${item.match.pct}% Skill Fit`,
      reason: `${item.opp.domain} · ${item.opp.mode} in ${item.opp.location} with ${item.clash.label.toLowerCase()}.`,
    })),
    generatedAt: new Date().toISOString(),
  };
}

export const PersonalizationModal: React.FC<PersonalizationModalProps> = ({
  open,
  user,
  profile,
  opportunities,
  onClose,
  onComplete,
}) => {
  const existing = user.personalization;

  const [preferredDomains, setPreferredDomains] = useState<DomainCategory[]>(
    existing?.preferredDomains?.length ? existing.preferredDomains : ['Software', 'Data']
  );
  const [preferredModes, setPreferredModes] = useState<WorkMode[]>(
    existing?.preferredModes?.length ? existing.preferredModes : ['Remote', 'Hybrid']
  );
  const [preferredLocations, setPreferredLocations] = useState<string[]>(
    existing?.preferredLocations?.length ? existing.preferredLocations : ['Hyderabad', 'Remote']
  );
  const [minStipend, setMinStipend] = useState<number>(existing?.minStipend ?? 20000);
  const [examSafeOnly, setExamSafeOnly] = useState<boolean>(existing?.examSafeOnly ?? true);
  const [careerGoal, setCareerGoal] = useState<string>(
    existing?.careerGoal ||
      (user.role === 'faculty'
        ? 'Streamline student NOC approvals, parent consents, and exam-safe placements'
        : user.role === 'organizer'
        ? 'Discover high-skill pre-verified student applicants for engineering internships'
        : 'Land a high-impact paid internship matching my skills without clashing with semester exams')
  );
  const [skills, setSkills] = useState<string[]>(profile.skills || ['Python', 'React', 'SQL']);
  const [customSkill, setCustomSkill] = useState('');
  const [facultyDepartment, setFacultyDepartment] = useState(
    existing?.facultyDepartment || 'Computer Science & Engineering'
  );
  const [facultyFocus, setFacultyFocus] = useState(
    existing?.facultyFocus || 'NOC & Parent Consent Verification'
  );
  const [organizerCompany, setOrganizerCompany] = useState(
    existing?.organizerCompany || user.organization || 'Campus Partner Organization'
  );
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const toggleDomain = (d: DomainCategory) => {
    setPreferredDomains((prev) =>
      prev.includes(d) ? (prev.length > 1 ? prev.filter((x) => x !== d) : prev) : [...prev, d]
    );
  };

  const toggleMode = (m: WorkMode) => {
    setPreferredModes((prev) =>
      prev.includes(m) ? (prev.length > 1 ? prev.filter((x) => x !== m) : prev) : [...prev, m]
    );
  };

  const toggleCity = (c: string) => {
    setPreferredLocations((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  };

  const toggleSkill = (sk: string) => {
    setSkills((prev) =>
      prev.some((x) => x.toLowerCase() === sk.toLowerCase())
        ? prev.filter((x) => x.toLowerCase() !== sk.toLowerCase())
        : [...prev, sk]
    );
  };

  const addCustomSkill = () => {
    const val = customSkill.trim();
    if (!val) return;
    if (!skills.some((x) => x.toLowerCase() === val.toLowerCase())) {
      setSkills((prev) => [...prev, val]);
    }
    setCustomSkill('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const personalization: UserPersonalization = {
      preferredDomains,
      preferredModes,
      preferredLocations,
      minStipend,
      careerGoal: careerGoal.trim(),
      examSafeOnly,
      facultyDepartment: user.role === 'faculty' ? facultyDepartment.trim() : undefined,
      facultyFocus: user.role === 'faculty' ? facultyFocus.trim() : undefined,
      organizerCompany: user.role === 'organizer' ? organizerCompany.trim() : undefined,
      organizerHiringDomains: user.role === 'organizer' ? preferredDomains : undefined,
    };

    try {
      const candidates = opportunities
        .filter((o) => daysBetween(todayIso(), o.deadline) >= 0)
        .slice(0, 20)
        .map((opp) => ({
          id: opp.id,
          title: opp.title,
          company: opp.company,
          type: opp.type,
          mode: opp.mode,
          location: opp.location,
          stipend: opp.stipend,
          deadline: opp.deadline,
          matchPct: getSkillMatch(opp, { ...profile, skills }).pct,
          examStatus: getExamClash(opp, profile).label,
          skills: opp.skills,
        }));

      const res = await fetch('/api/personalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: user.role,
          userName: user.name,
          skills,
          semester: profile.semester,
          personalization,
          candidates,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          summary?: string;
          skillAdvice?: string[];
          recommendations?: AiPersonalizationResult['recommendations'];
        };
        if (data.summary && Array.isArray(data.recommendations) && data.recommendations.length > 0) {
          onComplete(
            personalization,
            {
              summary: data.summary,
              skillAdvice: Array.isArray(data.skillAdvice) ? data.skillAdvice : [],
              recommendations: data.recommendations,
              generatedAt: new Date().toISOString(),
            },
            skills
          );
          setLoading(false);
          return;
        }
      }
    } catch {
      // smoothly use local recommendation engine if Gemini API key is not configured locally
    }

    const fallback = computeFallbackAiSuggestions(
      user.role,
      skills,
      profile,
      opportunities,
      personalization
    );
    onComplete(personalization, fallback, skills);
    setLoading(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="personalize-modal-title"
    >
      <div className="w-full max-w-2xl bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl shadow-2xl overflow-hidden my-6">
        <div className="px-6 py-4 border-b border-[#dbe3f0] dark:border-[#24324d] bg-[#12192c] text-white flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-[#7a9bff]">
              <Sparkles className="w-4 h-4" />
              <span>AI Workspace Personalization</span>
            </div>
            <h2 id="personalize-modal-title" className="text-lg font-extrabold tracking-tight">
              Welcome, {user.name.split(' ')[0]} — Tailor Your InternHub Feed
            </h2>
            <p className="text-xs text-slate-300">
              Tell us your preferences so AI curates internships, exam-safe matches, and skill focus areas for you.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Skip personalization"
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="p-6 space-y-5 max-h-[78vh] overflow-y-auto">
          {user.role === 'faculty' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1">
                  Faculty Department
                </label>
                <input
                  type="text"
                  value={facultyDepartment}
                  onChange={(e) => setFacultyDepartment(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f5bea]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1">
                  Primary Coordinator Focus
                </label>
                <select
                  value={facultyFocus}
                  onChange={(e) => setFacultyFocus(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f5bea]"
                >
                  <option value="NOC & Parent Consent Verification">
                    NOC & Parent Consent Verification
                  </option>
                  <option value="Leave & On-Duty Approvals">Leave & On-Duty Approvals</option>
                  <option value="Student Exam-Safe Tracking">Student Exam-Safe Tracking</option>
                </select>
              </div>
            </div>
          )}

          {user.role === 'organizer' && (
            <div>
              <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1">
                Hiring Organization / Company Name
              </label>
              <input
                type="text"
                value={organizerCompany}
                onChange={(e) => setOrganizerCompany(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f5bea]"
              />
            </div>
          )}

          {/* Domains */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-[#12203a] dark:text-[#e8eefc]">
              {user.role === 'organizer'
                ? 'Target Hiring Domains'
                : 'Preferred Domains & Tracks'}
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_DOMAINS.map((d) => {
                const active = preferredDomains.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDomain(d)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#2f5bea] text-white border-[#2f5bea]'
                        : 'bg-[#f8fafe] dark:bg-[#0e1626] border-[#dbe3f0] dark:border-[#24324d] text-[#5b6b86] dark:text-[#9fb0cc]'
                    }`}
                  >
                    {active && <Check className="w-3.5 h-3.5" />}
                    <span>{d}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Work Modes + Cities */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#12203a] dark:text-[#e8eefc]">
                Preferred Work Modes
              </label>
              <div className="flex flex-wrap gap-2">
                {ALL_MODES.map((m) => {
                  const active = preferredModes.includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggleMode(m)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#12805f] text-white border-[#12805f]'
                          : 'bg-[#f8fafe] dark:bg-[#0e1626] border-[#dbe3f0] dark:border-[#24324d] text-[#5b6b86] dark:text-[#9fb0cc]'
                      }`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#12203a] dark:text-[#e8eefc]">
                  Minimum Stipend Target
                </span>
                <span className="font-mono font-bold text-[#2f5bea] dark:text-[#7a9bff] tabular-nums">
                  ₹{Math.round(minStipend / 1000)}K / mo
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={80000}
                step={5000}
                value={minStipend}
                onChange={(e) => setMinStipend(Number(e.target.value))}
                className="w-full accent-[#2f5bea] cursor-pointer"
              />
            </div>
          </div>

          {/* Locations */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-[#12203a] dark:text-[#e8eefc]">
              Preferred Locations
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CITY_OPTIONS.map((city) => {
                const active = preferredLocations.includes(city);
                return (
                  <button
                    key={city}
                    type="button"
                    onClick={() => toggleCity(city)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#e8eeff] dark:bg-[#1c2a50] border-[#2f5bea] text-[#2f5bea] dark:text-[#7a9bff]'
                        : 'bg-white dark:bg-[#0b1120] border-[#dbe3f0] dark:border-[#24324d] text-[#5b6b86] dark:text-[#9fb0cc]'
                    }`}
                  >
                    {city}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Skills */}
          {user.role === 'learner' && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#12203a] dark:text-[#e8eefc]">
                Key Skills for AI Matching
              </label>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_SKILLS.map((sk) => {
                  const active = skills.some((x) => x.toLowerCase() === sk.toLowerCase());
                  return (
                    <button
                      key={sk}
                      type="button"
                      onClick={() => toggleSkill(sk)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                        active
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-400 text-emerald-700 dark:text-emerald-300'
                          : 'bg-[#f8fafe] dark:bg-[#0e1626] border-[#dbe3f0] dark:border-[#24324d] text-[#5b6b86] dark:text-[#9fb0cc]'
                      }`}
                    >
                      {sk}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={customSkill}
                  onChange={(e) => setCustomSkill(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomSkill();
                    }
                  }}
                  placeholder="Add custom skill (e.g. Docker, Go, Next.js)"
                  className="flex-1 px-3 py-1.5 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-xs focus:outline-none focus:ring-2 focus:ring-[#2f5bea]"
                />
                <button
                  type="button"
                  onClick={addCustomSkill}
                  className="px-3 py-1.5 rounded-xl bg-[#f3f6fb] dark:bg-[#1c2a50] text-xs font-bold cursor-pointer"
                >
                  Add
                </button>
              </div>
            </div>
          )}

          {/* Goal + Exam Safe */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold text-[#12203a] dark:text-[#e8eefc]">
              Career / Workspace Goal
            </label>
            <input
              type="text"
              value={careerGoal}
              onChange={(e) => setCareerGoal(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f5bea]"
            />
            <label className="flex items-center gap-2.5 text-xs font-medium text-[#5b6b86] dark:text-[#9fb0cc] cursor-pointer">
              <input
                type="checkbox"
                checked={examSafeOnly}
                onChange={(e) => setExamSafeOnly(e.target.checked)}
                className="rounded border-[#dbe3f0] text-[#2f5bea]"
              />
              <span>Prioritize opportunities that do not clash with my semester exam dates</span>
            </label>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#dbe3f0] dark:border-[#24324d]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] hover:text-[#12203a] dark:hover:text-white cursor-pointer"
            >
              Skip for now
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2f5bea] hover:bg-[#244bc9] text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating AI Suggestions...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Save & Get AI Suggestions</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
