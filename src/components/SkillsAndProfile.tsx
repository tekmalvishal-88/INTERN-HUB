import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Award,
  BookOpen,
  Building2,
  Calendar,
  CheckCircle2,
  Code2,
  Compass,
  Edit3,
  ExternalLink,
  FileText,
  Globe,
  GraduationCap,
  Layers,
  MapPin,
  Play,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import type { CourseResource, Opportunity, ProjectItem, StudentProfile } from '../types';
import { analyzeSkillGaps, formatShortDate, getExamClash, getSkillMatch } from '../utils/matching';
import { GoogleVAvatar } from './GoogleVAvatar';

interface SkillsViewProps {
  opportunities: Opportunity[];
  profile: StudentProfile;
  courses: CourseResource[];
  onAddSkill: (skill: string) => void;
  onLaunchAiPrompt: (prompt: string) => void;
}

type TrackFilter = 'All' | 'Software' | 'Data' | 'Design';

interface SprintTask {
  id: string;
  label: string;
  est: string;
  done: boolean;
}

const DEFAULT_SPRINT_TASKS: SprintTask[] = [
  { id: 'sp-1', label: 'Close your #1 missing skill gap on the right', est: '30 min', done: false },
  { id: 'sp-2', label: 'Run a 3-question AI mock interview drill', est: '15 min', done: true },
  { id: 'sp-3', label: 'Review exam-safe opportunities closing this week', est: '10 min', done: false },
  { id: 'sp-4', label: 'Verify saved resume matches target role keywords', est: '15 min', done: false },
];

const INTERVIEW_DRILLS = [
  {
    id: 'dr-1',
    title: 'SQL & Data Analytics Drill',
    focus: 'Joins, Window Functions & Cohort Queries',
    duration: '10 min',
    prompt:
      'Give me a hands-on SQL interview drill with 2 real e-commerce analytics query questions (one intermediate JOIN/GROUP BY, one window function). Ask Question 1 first and evaluate my SQL.',
  },
  {
    id: 'dr-2',
    title: 'React & TypeScript Architecture',
    focus: 'Hooks, State Lifting & Rendering Performance',
    duration: '12 min',
    prompt:
      'Quiz me on 2 practical React + TypeScript frontend internship interview scenarios (state management and async error handling). Ask Scenario 1 first.',
  },
  {
    id: 'dr-3',
    title: 'System Design & APIs',
    focus: 'REST Design, Caching & Rate Limiting',
    duration: '15 min',
    prompt:
      'Walk me through a beginner-friendly internship system design prompt: designing a URL shortener or job alert notification service. Guide me step-by-step.',
  },
  {
    id: 'dr-4',
    title: 'Behavioral STAR Mastery',
    focus: 'Ownership, Conflict & Project Impact',
    duration: '10 min',
    prompt:
      'Act as an Amazon/Microsoft campus recruiter and ask me 1 behavioral STAR interview question based on my resume skills, then critique my answer.',
  },
];

export const SkillsView: React.FC<SkillsViewProps> = ({
  opportunities,
  profile,
  courses,
  onAddSkill,
  onLaunchAiPrompt,
}) => {
  const [track, setTrack] = useState<TrackFilter>('All');
  const [prepTab, setPrepTab] = useState<'tracks' | 'drills' | 'sprint'>('tracks');
  const [simulatedSkill, setSimulatedSkill] = useState<string | null>(null);
  const [sprintTasks, setSprintTasks] = useState<SprintTask[]>(() => {
    try {
      const saved = localStorage.getItem('internhub_prep_sprint_v1');
      if (saved) return JSON.parse(saved) as SprintTask[];
    } catch {
      // ignore
    }
    return DEFAULT_SPRINT_TASKS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('internhub_prep_sprint_v1', JSON.stringify(sprintTasks));
    } catch {
      // ignore
    }
  }, [sprintTasks]);

  const filteredOpps = useMemo(() => {
    if (track === 'All') return opportunities;
    return opportunities.filter((o) => o.domain === track);
  }, [opportunities, track]);

  const gaps = useMemo(() => analyzeSkillGaps(filteredOpps, profile), [filteredOpps, profile]);

  // Competency Radar across 5 industry pillars
  const radarAxes = useMemo(() => {
    const pillars = [
      { label: 'Frontend', keys: ['React', 'TypeScript', 'JavaScript', 'CSS', 'HTML'] },
      { label: 'Backend', keys: ['Node.js', 'APIs', 'Java', 'Spring Boot', 'Microservices'] },
      { label: 'Data & SQL', keys: ['Python', 'SQL', 'Excel', 'Tableau', 'Statistics'] },
      { label: 'AI & ML', keys: ['Machine Learning', 'TensorFlow', 'PyTorch', 'Python'] },
      { label: 'Design & Core', keys: ['Figma', 'Git', 'Communication', 'Problem Solving'] },
    ];
    const userSet = new Set(profile.skills.map((s) => s.toLowerCase()));
    if (simulatedSkill) userSet.add(simulatedSkill.toLowerCase());

    return pillars.map((p) => {
      const hits = p.keys.filter((k) => userSet.has(k.toLowerCase())).length;
      const pct = Math.min(100, Math.round((hits / Math.max(1, p.keys.length - 1)) * 100));
      return { label: p.label, pct: Math.max(18, pct), rawHits: hits };
    });
  }, [profile.skills, simulatedSkill]);

  // Overall Role Readiness score
  const readiness = useMemo(() => {
    const activeSet = simulatedSkill
      ? { ...profile, skills: [...profile.skills, simulatedSkill] }
      : profile;
    const baseScores = filteredOpps.map((o) => getSkillMatch(o, profile).pct);
    const simScores = filteredOpps.map((o) => getSkillMatch(o, activeSet).pct);

    const avgBase = baseScores.length
      ? Math.round(baseScores.reduce((a, b) => a + b, 0) / baseScores.length)
      : 0;
    const avgSim = simScores.length
      ? Math.round(simScores.reduce((a, b) => a + b, 0) / simScores.length)
      : 0;

    const strongMatches = simScores.filter((s) => s >= 75).length;
    const baseStrong = baseScores.filter((s) => s >= 75).length;

    return {
      avgBase,
      avgSim,
      delta: avgSim - avgBase,
      strongMatches,
      unlockedExtra: strongMatches - baseStrong,
    };
  }, [filteredOpps, profile, simulatedSkill]);

  // Radar SVG polygon math
  const radarGeometry = useMemo(() => {
    const cx = 120;
    const cy = 115;
    const maxR = 76;
    const count = radarAxes.length;

    const pointAt = (idx: number, ratio: number) => {
      const angle = (Math.PI * 2 * idx) / count - Math.PI / 2;
      return {
        x: cx + Math.cos(angle) * maxR * ratio,
        y: cy + Math.sin(angle) * maxR * ratio,
      };
    };

    const rings = [0.33, 0.66, 1].map((r) =>
      radarAxes
        .map((_, idx) => {
          const pt = pointAt(idx, r);
          return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
        })
        .join(' ')
    );

    const dataPoints = radarAxes.map((axis, idx) => pointAt(idx, axis.pct / 100));
    const polygon = dataPoints.map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ');

    const labelPoints = radarAxes.map((axis, idx) => {
      const pt = pointAt(idx, 1.24);
      return { ...axis, x: pt.x, y: pt.y };
    });

    return { cx, cy, rings, polygon, dataPoints, labelPoints, spokes: radarAxes.map((_, idx) => pointAt(idx, 1)) };
  }, [radarAxes]);

  // Enrich each gap with average stipend of roles requiring it
  const enrichedGaps = useMemo(() => {
    return gaps.slice(0, 7).map((gap) => {
      const matchingOpps = filteredOpps.filter((o) =>
        o.skills.some((s) => s.toLowerCase() === gap.skill.toLowerCase())
      );
      const avgStipend = matchingOpps.length
        ? Math.round(matchingOpps.reduce((sum, o) => sum + o.stipend, 0) / matchingOpps.length)
        : 0;
      return { ...gap, avgStipend };
    });
  }, [gaps, filteredOpps]);

  const completedSprint = sprintTasks.filter((t) => t.done).length;
  const sprintPct = Math.round((completedSprint / sprintTasks.length) * 100);

  const toggleSprintTask = (id: string) => {
    setSprintTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  return (
    <div className="space-y-6">
      {/* Top Studio Header + Track Segmented Filter */}
      <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#2f5bea] dark:text-[#7a9bff]">
            <Compass className="w-4 h-4" />
            <span>Interactive Competency Graph & Prep Studio</span>
          </div>
          <h2 className="text-xl font-extrabold tracking-tight">
            Shape your skills around high-stipend internships
          </h2>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#f3f6fb] dark:bg-[#0b1120] border border-[#dbe3f0] dark:border-[#24324d] self-start md:self-auto">
          {(['All', 'Software', 'Data', 'Design'] as TrackFilter[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTrack(t);
                setSimulatedSkill(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                track === t
                  ? 'bg-white dark:bg-[#1a2744] text-[#12203a] dark:text-white shadow-2xs'
                  : 'text-[#5b6b86] dark:text-[#9fb0cc] hover:text-[#12203a] dark:hover:text-white'
              }`}
            >
              {t === 'All' ? 'All Tracks' : t}
            </button>
          ))}
        </div>
      </div>

      {/* Bento Row 1: Readiness Hero + Competency Radar + Active Skills */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Readiness Spotlight Card (Dark signature card) */}
        <div className="lg:col-span-4 bg-[#12192c] dark:bg-[#0f172a] text-white border border-[#232f4e] rounded-2xl p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Role Readiness Index</span>
            <Target className="w-4 h-4 text-[#7a9bff]" />
          </div>

          <div className="my-5 flex items-center gap-5">
            {/* Radial Gauge */}
            <div className="relative w-24 h-24 shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth="10"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#7a9bff"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${(readiness.avgSim / 100) * 251.3} 251.3`}
                  className="transition-all duration-300"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-extrabold tabular-nums">{readiness.avgSim}%</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-bold leading-snug">
                {readiness.strongMatches} strong-fit roles (75%+)
              </p>
              <p className="text-xs text-slate-300 leading-relaxed">
                {simulatedSkill ? (
                  <>
                    Previewing <span className="text-emerald-300 font-semibold">+{simulatedSkill}</span>
                    {readiness.delta > 0 ? ` (+${readiness.delta}% match lift)` : ''}
                    {readiness.unlockedExtra > 0 ? ` · unlocks ${readiness.unlockedExtra} more role` : ''}
                  </>
                ) : (
                  `Across ${filteredOpps.length} live ${track === 'All' ? '' : track + ' '}opportunities`
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              onLaunchAiPrompt(
                `My average skill readiness in ${track} opportunities is ${readiness.avgBase}%. Build a crisp 10-day roadmap around my missing skills: ${gaps
                  .slice(0, 3)
                  .map((g) => g.skill)
                  .join(', ')}.`
              )
            }
            className="w-full py-2.5 px-4 rounded-xl bg-[#2f5bea] hover:bg-[#3b67f0] text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate AI 10-Day Roadmap</span>
          </button>
        </div>

        {/* Competency Radar SVG Card */}
        <div className="lg:col-span-4 bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold">Skill Graph Radar</h3>
              <p className="text-[11px] text-[#5b6b86] dark:text-[#9fb0cc]">
                Coverage across 5 core domains
              </p>
            </div>
            {simulatedSkill && (
              <button
                type="button"
                onClick={() => setSimulatedSkill(null)}
                className="text-[11px] font-bold text-[#2f5bea] dark:text-[#7a9bff] hover:underline cursor-pointer"
              >
                Clear preview
              </button>
            )}
          </div>

          <div className="flex items-center justify-center py-1">
            <svg viewBox="0 0 240 225" className="w-full max-w-[240px] h-auto">
              {/* Concentric pentagons */}
              {radarGeometry.rings.map((pts, idx) => (
                <polygon
                  key={idx}
                  points={pts}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  className="text-[#dbe3f0] dark:text-[#24324d]"
                />
              ))}
              {/* Spokes */}
              {radarGeometry.spokes.map((pt, idx) => (
                <line
                  key={idx}
                  x1={radarGeometry.cx}
                  y1={radarGeometry.cy}
                  x2={pt.x}
                  y2={pt.y}
                  stroke="currentColor"
                  strokeWidth="1"
                  className="text-[#dbe3f0] dark:text-[#24324d]"
                />
              ))}
              {/* Active Data Polygon */}
              <polygon
                points={radarGeometry.polygon}
                fill="rgba(47, 91, 234, 0.18)"
                stroke="#2f5bea"
                strokeWidth="2.2"
                strokeLinejoin="round"
                className="transition-all duration-300"
              />
              {radarGeometry.dataPoints.map((pt, idx) => (
                <circle key={idx} cx={pt.x} cy={pt.y} r="3.5" fill="#2f5bea" />
              ))}
              {/* Axis Labels */}
              {radarGeometry.labelPoints.map((lbl, idx) => (
                <text
                  key={idx}
                  x={lbl.x}
                  y={lbl.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-[#12203a] dark:fill-[#e8eefc] text-[10px] font-bold"
                >
                  {lbl.label}
                </text>
              ))}
            </svg>
          </div>
        </div>

        {/* Verified Skills + Quick Add Card */}
        <div className="lg:col-span-4 bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-bold">Verified Skill Stack ({profile.skills.length})</h3>
              </div>
              <span className="text-[11px] font-mono font-semibold text-[#5b6b86] dark:text-[#9fb0cc]">
                Sem {profile.semester}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {profile.skills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-700 dark:text-emerald-300"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{skill}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-[#dbe3f0] dark:border-[#24324d] space-y-2">
            <p className="text-[11px] font-semibold text-[#5b6b86] dark:text-[#9fb0cc]">
              Domain coverage breakdown
            </p>
            <div className="grid grid-cols-5 gap-1.5 text-center">
              {radarAxes.map((ax) => (
                <div
                  key={ax.label}
                  className="p-2 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d]"
                >
                  <div className="font-mono text-xs font-extrabold tabular-nums text-[#2f5bea] dark:text-[#7a9bff]">
                    {ax.pct}%
                  </div>
                  <div className="text-[10px] text-[#5b6b86] dark:text-[#9fb0cc] truncate mt-0.5">
                    {ax.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bento Row 2: What-If Skill Gap Analyzer + Interactive Prep Studio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left 6 cols: Interactive Skill Gap Analyzer with What-If Preview */}
        <div className="lg:col-span-6 bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-bold">High-Impact Skill Gaps</h3>
              <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc] mt-0.5">
                Hover or click Preview to simulate readiness lift before adding a skill
              </p>
            </div>
            <span className="font-mono text-xs font-bold text-[#5b6b86] dark:text-[#9fb0cc] tabular-nums">
              {gaps.length} gaps
            </span>
          </div>

          {enrichedGaps.length === 0 ? (
            <div className="p-6 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              You already cover every required skill in this track!
            </div>
          ) : (
            <div className="space-y-3">
              {enrichedGaps.map((gap) => {
                const pct = Math.round((gap.demandCount / Math.max(1, gap.totalOpportunities)) * 100);
                const isSimulating = simulatedSkill === gap.skill;
                return (
                  <div
                    key={gap.skill}
                    className={`p-3.5 rounded-xl border transition-colors space-y-2.5 ${
                      isSimulating
                        ? 'border-[#2f5bea] bg-[#e8eeff]/40 dark:bg-[#1c2a50]/60'
                        : 'border-[#dbe3f0] dark:border-[#24324d] bg-[#f8fafe] dark:bg-[#0e1626]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">{gap.skill}</span>
                          <span className="font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                            Avg ₹{Math.round(gap.avgStipend / 1000)}K/mo
                          </span>
                        </div>
                        <p className="text-[11px] text-[#5b6b86] dark:text-[#9fb0cc] truncate mt-0.5">
                          Unlocks: {gap.unlockedTitles.slice(0, 2).join(', ')}
                          {gap.unlockedTitles.length > 2 ? ` +${gap.unlockedTitles.length - 2}` : ''}
                        </p>
                      </div>

                      <span className="font-mono text-xs font-bold text-[#5b6b86] dark:text-[#9fb0cc] tabular-nums shrink-0">
                        {gap.demandCount}/{gap.totalOpportunities} roles
                      </span>
                    </div>

                    <div className="h-1.5 rounded-full bg-[#e3e9f5] dark:bg-[#1f2c48] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-500 transition-all duration-300"
                        style={{ width: `${Math.max(12, pct)}%` }}
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() =>
                          setSimulatedSkill((cur) => (cur === gap.skill ? null : gap.skill))
                        }
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                          isSimulating
                            ? 'bg-[#2f5bea] text-white border-[#2f5bea]'
                            : 'bg-white dark:bg-[#131d33] border-[#dbe3f0] dark:border-[#24324d] text-[#5b6b86] dark:text-[#9fb0cc] hover:border-[#2f5bea]'
                        }`}
                      >
                        {isSimulating ? 'Previewing lift' : 'Preview impact'}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          onLaunchAiPrompt(
                            `Teach me the top 3 interview-critical concepts of ${gap.skill} in 5 bullet points and give me 1 quick practice exercise.`
                          )
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] hover:border-[#2f5bea] text-[11px] font-bold text-[#2f5bea] dark:text-[#7a9bff] cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>AI crash course</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (simulatedSkill === gap.skill) setSimulatedSkill(null);
                          onAddSkill(gap.skill);
                        }}
                        className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Mark learned</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 6 cols: Interactive Preparation Studio (Tracks / Interview Drills / Weekly Sprint) */}
        <div className="lg:col-span-6 bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold">Preparation Studio</h3>
              <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc]">
                Structured courses, interactive AI drills & weekly sprint tracker
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#f3f6fb] dark:bg-[#0b1120] border border-[#dbe3f0] dark:border-[#24324d] self-start">
              <button
                type="button"
                onClick={() => setPrepTab('tracks')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  prepTab === 'tracks'
                    ? 'bg-white dark:bg-[#1a2744] text-[#12203a] dark:text-white shadow-2xs'
                    : 'text-[#5b6b86] dark:text-[#9fb0cc]'
                }`}
              >
                Courses
              </button>
              <button
                type="button"
                onClick={() => setPrepTab('drills')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  prepTab === 'drills'
                    ? 'bg-white dark:bg-[#1a2744] text-[#12203a] dark:text-white shadow-2xs'
                    : 'text-[#5b6b86] dark:text-[#9fb0cc]'
                }`}
              >
                AI Drills
              </button>
              <button
                type="button"
                onClick={() => setPrepTab('sprint')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  prepTab === 'sprint'
                    ? 'bg-white dark:bg-[#1a2744] text-[#12203a] dark:text-white shadow-2xs'
                    : 'text-[#5b6b86] dark:text-[#9fb0cc]'
                }`}
              >
                Sprint ({completedSprint}/{sprintTasks.length})
              </button>
            </div>
          </div>

          {prepTab === 'tracks' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {courses.map((c) => {
                const unlockedCount = opportunities.filter((o) =>
                  o.skills.some((s) => s.toLowerCase() === c.skillUnlocked.toLowerCase())
                ).length;
                return (
                  <a
                    key={c.id}
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`rounded-2xl p-4 border border-[#dbe3f0] dark:border-[#24324d] ${c.accentBg} hover:border-[#2f5bea] transition-all flex flex-col justify-between group`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-[#5b6b86] dark:text-[#9fb0cc]">
                        <span>{c.provider}</span>
                        <span className="font-mono tabular-nums">{c.duration}</span>
                      </div>
                      <h4 className="text-sm font-bold group-hover:text-[#2f5bea] dark:group-hover:text-[#7a9bff] flex items-center justify-between gap-1">
                        <span>{c.title}</span>
                        <ArrowUpRight className="w-4 h-4 opacity-60 group-hover:opacity-100 shrink-0" />
                      </h4>
                      <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc] leading-relaxed">
                        {c.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-2.5 border-t border-black/5 dark:border-white/10 flex items-center justify-between text-[11px] font-bold">
                      <span className="inline-flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5 text-[#2f5bea] dark:text-[#7a9bff]" />
                        {c.level}
                      </span>
                      <span className="text-[#2f5bea] dark:text-[#7a9bff] tabular-nums">
                        +{c.skillUnlocked} ({unlockedCount} roles)
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>
          )}

          {prepTab === 'drills' && (
            <div className="space-y-3">
              {INTERVIEW_DRILLS.map((drill) => (
                <div
                  key={drill.id}
                  className="p-4 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d] flex items-center justify-between gap-4"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-[#2f5bea] dark:text-[#7a9bff] shrink-0" />
                      <h4 className="text-sm font-bold truncate">{drill.title}</h4>
                    </div>
                    <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc]">
                      {drill.focus} · <span className="font-mono">{drill.duration}</span>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onLaunchAiPrompt(drill.prompt)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2f5bea] hover:bg-[#244bc9] text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Start</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {prepTab === 'sprint' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d] space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>Weekly Readiness Sprint</span>
                  <span className="font-mono tabular-nums text-[#2f5bea] dark:text-[#7a9bff]">
                    {sprintPct}% complete
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[#e3e9f5] dark:bg-[#1f2c48] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${Math.max(4, sprintPct)}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                {sprintTasks.map((task) => (
                  <label
                    key={task.id}
                    className="p-3.5 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] hover:border-[#2f5bea] flex items-center justify-between gap-3 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={task.done}
                        onChange={() => toggleSprintTask(task.id)}
                        className="rounded border-[#dbe3f0] text-[#2f5bea] focus:ring-[#2f5bea]"
                      />
                      <span
                        className={`text-xs font-semibold ${
                          task.done
                            ? 'line-through text-[#5b6b86] dark:text-[#9fb0cc]'
                            : 'text-[#12203a] dark:text-[#e8eefc]'
                        }`}
                      >
                        {task.label}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-[#5b6b86] dark:text-[#9fb0cc] shrink-0">
                      {task.est}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface ProfileViewProps {
  profile: StudentProfile;
  opportunities: Opportunity[];
  userEmail?: string;
  onSaveProfile: (updated: StudentProfile) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  profile,
  opportunities,
  userEmail = 'vishal.tekmal@ifheindia.org',
  onSaveProfile,
}) => {
  const [form, setForm] = useState<StudentProfile>(profile);
  const [editing, setEditing] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);

  // New project form state
  const [addingProject, setAddingProject] = useState(false);
  const [projTitle, setProjTitle] = useState('');
  const [projRole, setProjRole] = useState('Full Stack Developer');
  const [projTech, setProjTech] = useState('');
  const [projSummary, setProjSummary] = useState('');
  const [projUrl, setProjUrl] = useState('https://github.com');

  const clashSummary = useMemo(() => {
    let fit = 0;
    let partial = 0;
    let clash = 0;
    for (const o of opportunities) {
      const c = getExamClash(o, form);
      if (c.status === 'fit') fit++;
      else if (c.status === 'partial') partial++;
      else clash++;
    }
    return { fit, partial, clash };
  }, [opportunities, form]);

  const profileStrength = useMemo(() => {
    let score = 20;
    if (form.headline.trim()) score += 15;
    if (form.about.trim().length > 20) score += 15;
    if (form.skills.length >= 4) score += 15;
    if (form.resumes.length >= 1 || form.resumeName) score += 15;
    if (form.projects.length >= 1) score += 10;
    if (form.examStart && form.examEnd) score += 10;
    return Math.min(100, score);
  }, [form]);

  const addSkillTag = () => {
    const clean = newSkill.trim();
    if (!clean) return;
    if (!form.skills.some((s) => s.toLowerCase() === clean.toLowerCase())) {
      const updated = { ...form, skills: [...form.skills, clean] };
      setForm(updated);
      if (!editing) onSaveProfile(updated);
    }
    setNewSkill('');
  };

  const removeSkillTag = (skill: string) => {
    const updated = { ...form, skills: form.skills.filter((s) => s !== skill) };
    setForm(updated);
    if (!editing) onSaveProfile(updated);
  };

  const handleAddProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projTitle.trim()) return;
    const item: ProjectItem = {
      id: `prj-${Date.now()}`,
      title: projTitle.trim(),
      role: projRole.trim() || 'Developer',
      techStack: projTech.trim() || 'React · TypeScript',
      summary: projSummary.trim() || 'Built and deployed end-to-end engineering project.',
      url: projUrl.trim() || undefined,
    };
    const updated = { ...form, projects: [item, ...form.projects] };
    setForm(updated);
    onSaveProfile(updated);
    setProjTitle('');
    setProjTech('');
    setProjSummary('');
    setAddingProject(false);
  };

  const removeProject = (id: string) => {
    const updated = { ...form, projects: form.projects.filter((p) => p.id !== id) };
    setForm(updated);
    onSaveProfile(updated);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveProfile(form);
    setEditing(false);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  return (
    <div className="max-w-5xl space-y-6">
      {/* Real LinkedIn/Handshake-style Profile Header Card */}
      <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl overflow-hidden">
        {/* Top Cover Banner */}
        <div className="h-32 sm:h-40 bg-gradient-to-r from-[#12203a] via-[#2f5bea] to-[#1e40af] relative">
          <div className="absolute right-5 bottom-4 flex items-center gap-2">
            {savedNotice && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Saved
              </span>
            )}
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/95 text-[#12203a] hover:bg-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{editing ? 'Cancel Edit' : 'Edit Profile'}</span>
            </button>
          </div>
        </div>

        {/* Profile Identity Row */}
        <div className="px-6 pb-6">
          <div className="-mt-11 mb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <GoogleVAvatar size="xl" showRing />
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              {form.githubUrl && (
                <a
                  href={form.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] hover:border-[#2f5bea] transition-colors"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>GitHub</span>
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
              )}
              {form.linkedinUrl && (
                <a
                  href={form.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] hover:border-[#2f5bea] transition-colors"
                >
                  <Globe className="w-3.5 h-3.5 text-[#2f5bea] dark:text-[#7a9bff]" />
                  <span>LinkedIn</span>
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-extrabold tracking-tight">{form.name}</h2>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-[#2f5bea] dark:text-[#7a9bff]">
                <ShieldCheck className="w-4 h-4" />
                Verified Student
              </span>
            </div>
            <p className="text-sm font-medium text-[#12203a] dark:text-[#e8eefc]">
              {form.headline}
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-[#5b6b86] dark:text-[#9fb0cc] pt-1">
              <span className="inline-flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5" />
                {form.college} · {form.branch}
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {form.location}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono font-semibold tabular-nums">
                Sem {form.semester} · CGPA {form.cgpa}
              </span>
              <span aria-hidden="true">·</span>
              <span>{userEmail}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Mode Drawer / Inline Form */}
      {editing && (
        <form
          onSubmit={handleSave}
          className="bg-white dark:bg-[#131d33] border border-[#2f5bea] dark:border-[#7a9bff] rounded-2xl p-6 space-y-5"
        >
          <div className="flex items-center justify-between pb-3 border-b border-[#dbe3f0] dark:border-[#24324d]">
            <h3 className="text-base font-bold">Edit Personal & Academic Details</h3>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2f5bea] hover:bg-[#244bc9] text-white text-xs font-bold cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1">
                Full name
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1">
                Headline
              </label>
              <input
                type="text"
                value={form.headline}
                onChange={(e) => setForm({ ...form, headline: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1">
                University / College
              </label>
              <input
                type="text"
                value={form.college}
                onChange={(e) => setForm({ ...form, college: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1">
                Branch / Major
              </label>
              <input
                type="text"
                value={form.branch}
                onChange={(e) => setForm({ ...form, branch: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1">
                  Semester
                </label>
                <select
                  value={form.semester}
                  onChange={(e) => setForm({ ...form, semester: Number(e.target.value) })}
                  className="w-full px-2.5 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm"
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
                  CGPA
                </label>
                <input
                  type="text"
                  value={form.cgpa}
                  onChange={(e) => setForm({ ...form, cgpa: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1">
                  Grad Year
                </label>
                <input
                  type="text"
                  value={form.gradYear}
                  onChange={(e) => setForm({ ...form, gradYear: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1">
                Location
              </label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1">
                Exams start date
              </label>
              <input
                type="date"
                value={form.examStart}
                onChange={(e) => setForm({ ...form, examStart: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1">
                Exams end date
              </label>
              <input
                type="date"
                value={form.examEnd}
                onChange={(e) => setForm({ ...form, examEnd: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1">
                GitHub URL
              </label>
              <input
                type="url"
                value={form.githubUrl}
                onChange={(e) => setForm({ ...form, githubUrl: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1">
                LinkedIn URL
              </label>
              <input
                type="url"
                value={form.linkedinUrl}
                onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1">
                About / Career Summary
              </label>
              <textarea
                rows={3}
                value={form.about}
                onChange={(e) => setForm({ ...form, about: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm"
              />
            </div>
          </div>
        </form>
      )}

      {/* 2-Column Real Career Profile Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 8 columns: About, Education, Projects, Exam Shield */}
        <div className="lg:col-span-8 space-y-5">
          {/* About */}
          <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-6 space-y-2.5">
            <h3 className="text-base font-bold">About</h3>
            <p className="text-sm text-[#5b6b86] dark:text-[#9fb0cc] leading-relaxed">
              {form.about}
            </p>
          </div>

          {/* Education */}
          <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold">Education</h3>
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-[#e8eeff] dark:bg-[#1c2a50] text-[#2f5bea] dark:text-[#7a9bff] flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold">{form.college}</h4>
                <p className="text-xs font-medium text-[#12203a] dark:text-[#e8eefc]">
                  B.Tech · {form.branch}
                </p>
                <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc] font-mono tabular-nums">
                  Semester {form.semester} · Class of {form.gradYear} · CGPA {form.cgpa}
                </p>
              </div>
            </div>
          </div>

          {/* Projects */}
          <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Featured Projects ({form.projects.length})</h3>
              <button
                type="button"
                onClick={() => setAddingProject((v) => !v)}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#2f5bea] dark:text-[#7a9bff] hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{addingProject ? 'Close' : 'Add project'}</span>
              </button>
            </div>

            {addingProject && (
              <form
                onSubmit={handleAddProject}
                className="p-4 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d] space-y-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    value={projTitle}
                    onChange={(e) => setProjTitle(e.target.value)}
                    placeholder="Project title"
                    className="px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-xs"
                  />
                  <input
                    type="text"
                    value={projTech}
                    onChange={(e) => setProjTech(e.target.value)}
                    placeholder="Tech stack (e.g. React · Python)"
                    className="px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-xs"
                  />
                </div>
                <textarea
                  rows={2}
                  value={projSummary}
                  onChange={(e) => setProjSummary(e.target.value)}
                  placeholder="Impact summary..."
                  className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-xs"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={projUrl}
                    onChange={(e) => setProjUrl(e.target.value)}
                    placeholder="GitHub or demo URL"
                    className="flex-1 px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-xs"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#2f5bea] text-white text-xs font-bold cursor-pointer"
                  >
                    Save project
                  </button>
                </div>
              </form>
            )}

            <div className="divide-y divide-[#dbe3f0] dark:divide-[#24324d]">
              {form.projects.map((proj) => (
                <div key={proj.id} className="py-3.5 first:pt-0 last:pb-0 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold">{proj.title}</h4>
                      <p className="text-xs font-semibold text-[#2f5bea] dark:text-[#7a9bff]">
                        {proj.role} · {proj.techStack}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {proj.url && (
                        <a
                          href={proj.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold text-[#5b6b86] hover:text-[#2f5bea]"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => removeProject(proj.id)}
                        className="text-[#5b6b86] hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc] leading-relaxed">
                    {proj.summary}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Academic Exam Shield */}
          <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#2f5bea] dark:text-[#7a9bff]" />
                <h3 className="text-base font-bold">Academic Exam Schedule</h3>
              </div>
              <span className="font-mono text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc]">
                {formatShortDate(form.examStart)} – {formatShortDate(form.examEnd)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center pt-1">
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40">
                <div className="font-mono text-lg font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {clashSummary.fit}
                </div>
                <div className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                  Exam-Safe
                </div>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40">
                <div className="font-mono text-lg font-extrabold text-amber-700 dark:text-amber-400 tabular-nums">
                  {clashSummary.partial}
                </div>
                <div className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                  Partial Overlap
                </div>
              </div>
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40">
                <div className="font-mono text-lg font-extrabold text-rose-700 dark:text-rose-400 tabular-nums">
                  {clashSummary.clash}
                </div>
                <div className="text-[11px] font-semibold text-rose-800 dark:text-rose-300">
                  Full Clash
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right 4 columns: Profile Strength, Skills Manager, Saved Resumes */}
        <div className="lg:col-span-4 space-y-5">
          {/* Profile Strength */}
          <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-5 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span>Profile Completeness</span>
              <span className="font-mono text-[#2f5bea] dark:text-[#7a9bff] tabular-nums">
                {profileStrength}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-[#edf1f8] dark:bg-[#1f2c48] overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${profileStrength}%` }}
              />
            </div>
            <p className="text-[11px] text-[#5b6b86] dark:text-[#9fb0cc]">
              All-Star profiles receive higher recruiter shortlist rates.
            </p>
          </div>

          {/* Skills Editor */}
          <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold">Skills & Tools ({form.skills.length})</h3>
            <div className="flex flex-wrap gap-1.5">
              {form.skills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#e8eeff] dark:bg-[#1c2a50] text-[#2f5bea] dark:text-[#7a9bff] text-xs font-bold"
                >
                  <span>{skill}</span>
                  <button
                    type="button"
                    onClick={() => removeSkillTag(skill)}
                    aria-label={`Remove ${skill}`}
                    className="hover:text-rose-600 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSkillTag();
                  }
                }}
                placeholder="Add skill (e.g. Docker)..."
                className="flex-1 px-3 py-1.5 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-xs"
              />
              <button
                type="button"
                onClick={addSkillTag}
                className="px-3 py-1.5 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] hover:border-[#2f5bea] text-xs font-bold cursor-pointer"
              >
                Add
              </button>
            </div>
          </div>

          {/* Resume Vault Preview */}
          <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Resumes ({form.resumes.length})</h3>
              <label className="text-xs font-bold text-[#2f5bea] dark:text-[#7a9bff] hover:underline cursor-pointer">
                + Upload
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const updated = {
                        ...form,
                        resumeName: f.name,
                        resumes: [
                          {
                            id: `res-${Date.now()}`,
                            name: f.name,
                            targetRole: 'Updated Resume',
                            updatedAt: new Date().toISOString().slice(0, 10),
                            sizeLabel: `${Math.max(95, Math.round(f.size / 1024))} KB`,
                            isDefault: true,
                          },
                          ...form.resumes.map((r) => ({ ...r, isDefault: false })),
                        ],
                      };
                      setForm(updated);
                      onSaveProfile(updated);
                    }
                  }}
                />
              </label>
            </div>

            <div className="space-y-2">
              {form.resumes.map((r) => (
                <div
                  key={r.id}
                  className="p-2.5 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] border border-[#dbe3f0] dark:border-[#24324d] flex items-center gap-2.5"
                >
                  <FileText className="w-4 h-4 text-[#2f5bea] dark:text-[#7a9bff] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate">{r.name}</p>
                    <p className="text-[11px] text-[#5b6b86] dark:text-[#9fb0cc] truncate">
                      {r.targetRole}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
