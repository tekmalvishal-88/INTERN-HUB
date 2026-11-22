import type { Opportunity, StudentProfile } from '../types';

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function offsetIso(daysFromToday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00`);
  const to = new Date(`${toIso}T00:00:00`);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

export function formatShortDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export type ClashStatus = 'fit' | 'partial' | 'clash';

export interface ExamClashResult {
  status: ClashStatus;
  label: string;
}

export function getExamClash(opp: Opportunity, profile: StudentProfile): ExamClashResult {
  const exStart = profile.examStart;
  const exEnd = profile.examEnd;
  if (!exStart || !exEnd) {
    return { status: 'fit', label: 'Fits schedule' };
  }
  if (opp.endDate < exStart || opp.startDate > exEnd) {
    return { status: 'fit', label: 'Fits your exams' };
  }
  if (opp.startDate <= exStart && opp.endDate >= exEnd) {
    return { status: 'clash', label: 'Clashes with exams' };
  }
  return { status: 'partial', label: 'Partly overlaps exams' };
}

export interface SkillMatchResult {
  pct: number;
  matched: string[];
  missing: string[];
  semesterEligible: boolean;
}

export function getSkillMatch(opp: Opportunity, profile: StudentProfile): SkillMatchResult {
  const userSkillsLower = new Set(profile.skills.map((s) => s.trim().toLowerCase()));
  const matched = opp.skills.filter((s) => userSkillsLower.has(s.toLowerCase()));
  const missing = opp.skills.filter((s) => !userSkillsLower.has(s.toLowerCase()));
  const pct = opp.skills.length > 0 ? Math.round((matched.length / opp.skills.length) * 100) : 100;

  return {
    pct,
    matched,
    missing,
    semesterEligible: profile.semester >= opp.minSemester,
  };
}

export function getSkillMatchForList(oppSkills: string[], candidateSkills: string[]): number {
  if (oppSkills.length === 0) return 100;
  const set = new Set(candidateSkills.map((s) => s.trim().toLowerCase()));
  const matched = oppSkills.filter((s) => set.has(s.toLowerCase())).length;
  return Math.round((matched / oppSkills.length) * 100);
}

export interface SkillGapItem {
  skill: string;
  demandCount: number;
  totalOpportunities: number;
  unlockedTitles: string[];
}

export function analyzeSkillGaps(opportunities: Opportunity[], profile: StudentProfile): SkillGapItem[] {
  const counts = new Map<string, { count: number; titles: string[] }>();
  for (const opp of opportunities) {
    const { missing } = getSkillMatch(opp, profile);
    for (const skill of missing) {
      const existing = counts.get(skill) ?? { count: 0, titles: [] };
      existing.count += 1;
      existing.titles.push(`${opp.company} · ${opp.title}`);
      counts.set(skill, existing);
    }
  }

  return Array.from(counts.entries())
    .map(([skill, data]) => ({
      skill,
      demandCount: data.count,
      totalOpportunities: opportunities.length,
      unlockedTitles: data.titles,
    }))
    .sort((a, b) => b.demandCount - a.demandCount);
}

export function formatStipend(opp: Opportunity): string {
  if (opp.stipendLabel) return opp.stipendLabel;
  if (opp.stipend >= 100000) return `₹${(opp.stipend / 100000).toFixed(1)}L/mo`;
  if (opp.stipend >= 1000) return `₹${Math.round(opp.stipend / 1000)}K/mo`;
  return `₹${opp.stipend.toLocaleString('en-IN')}/mo`;
}
