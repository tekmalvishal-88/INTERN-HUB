import React, { useState } from 'react';
import {
  ArrowRight,
  Briefcase,
  CalendarCheck,
  GraduationCap,
  Layers,
  ShieldCheck,
  Sparkles,
  Sun,
  Moon,
  UserCheck,
} from 'lucide-react';
import type { UserAccount, UserRole } from '../types';

interface LoginViewProps {
  darkMode: boolean;
  onToggleTheme: () => void;
  onAuthenticate: (user: UserAccount, setupDetails?: { branch?: string; semester?: number; college?: string }) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  darkMode,
  onToggleTheme,
  onAuthenticate,
}) => {
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [role, setRole] = useState<UserRole>('learner');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organization, setOrganization] = useState('');
  const [branch, setBranch] = useState('Computer Science & Engineering');
  const [semester, setSemester] = useState<number>(5);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanEmail = email.trim();
    const cleanName = name.trim() || (role === 'organizer' ? organization.trim() : '');

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (mode === 'register' && !cleanName) {
      setError(role === 'learner' ? 'Please enter your full name.' : 'Please enter your organization name.');
      return;
    }

    if (password.trim().length < 4) {
      setError('Please enter a password of at least 4 characters.');
      return;
    }

    const derivedName =
      cleanName ||
      cleanEmail
        .split('@')[0]
        .replace(/[._-]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());

    onAuthenticate(
      {
        id: `usr-${Date.now()}`,
        name: derivedName,
        email: cleanEmail,
        role,
        organization: role === 'organizer' ? organization.trim() || derivedName : undefined,
        designation: role === 'faculty' ? organization.trim() || 'Faculty Leave Coordinator' : undefined,
        verified: role !== 'learner',
      },
      role === 'learner'
        ? {
            branch: branch.trim() || 'CSE',
            semester,
            college: 'Campus Partner',
          }
        : undefined
    );
  };

  const quickDemoLearner = () => {
    onAuthenticate({
      id: 'demo-learner',
      name: 'Vishal Tekmal',
      email: 'vishal.tekmal@ifheindia.org',
      role: 'learner',
    });
  };

  const quickDemoFaculty = () => {
    onAuthenticate({
      id: 'demo-faculty',
      name: 'Dr. Priya Rao',
      email: 'priya.rao@ifheindia.org',
      role: 'faculty',
      designation: 'Faculty Placement & Leave Coordinator, CSE',
      verified: true,
    });
  };

  const quickDemoOrganizer = () => {
    onAuthenticate({
      id: 'demo-organizer',
      name: 'TechCorp HR Team',
      email: 'talent@techcorp.in',
      role: 'organizer',
      organization: 'TechCorp India',
      verified: true,
    });
  };

  return (
    <div className="min-h-screen bg-[#f3f6fb] dark:bg-[#0b1120] text-[#12203a] dark:text-[#e8eefc] flex flex-col">
      {/* Clean top bar */}
      <header className="w-full max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#2f5bea] text-white flex items-center justify-center font-extrabold text-base tracking-tight">
            IH
          </div>
          <span className="text-xl font-extrabold tracking-tight">
            Intern<span className="text-[#2f5bea] dark:text-[#7a9bff]">Hub</span>
          </span>
        </div>
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label="Toggle color theme"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#131d33] text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] hover:text-[#12203a] dark:hover:text-white transition-colors"
        >
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          <span>{darkMode ? 'Light mode' : 'Dark mode'}</span>
        </button>
      </header>

      {/* Main split workspace */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-6 lg:py-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        {/* Left: Product Overview & Quick Role Entry (from Architecture Comparison photo) */}
        <div className="lg:col-span-7 space-y-8">
          <div className="space-y-4">
            <p className="text-sm font-semibold text-[#2f5bea] dark:text-[#7a9bff]">
              AI-Powered Internship & Opportunity Ecosystem
            </p>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.12] text-balance">
              Your skills. Your opportunities. Your career.
            </h1>
            <p className="text-base text-[#5b6b86] dark:text-[#9fb0cc] max-w-xl leading-relaxed">
              Discover verified internships and hackathons from top teams, detect academic exam clashes automatically, track every stage in a Kanban pipeline, and get personalized guidance from our Gemini AI career assistant.
            </p>
          </div>

          {/* 4 core modules summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-bold">
                <CalendarCheck className="w-4 h-4 text-[#2f5bea] dark:text-[#7a9bff]" />
                <span>Exam-Clash Matching</span>
              </div>
              <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc] leading-relaxed">
                Automatically flags internships that conflict with your semester exam schedule before you apply.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-bold">
                <Layers className="w-4 h-4 text-[#12805f] dark:text-[#5fe0b6]" />
                <span>Kanban & Skill Tracker</span>
              </div>
              <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc] leading-relaxed">
                Track Applied, Shortlisted, and Interview rounds alongside real-time skill gap recommendations.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-bold">
                <ShieldCheck className="w-4 h-4 text-[#2f5bea] dark:text-[#7a9bff]" />
                <span>Organizer Analytics</span>
              </div>
              <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc] leading-relaxed">
                Recruiters publish opportunities, score candidate skill match, and monitor acceptance funnels.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-bold">
                <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>AI Career Assistant</span>
              </div>
              <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc] leading-relaxed">
                Personalized interview prep, resume alignment, and opportunity prioritization powered by Gemini.
              </p>
            </div>
          </div>

          {/* Instant Demo Access */}
          <div className="pt-2 space-y-2.5">
            <p className="text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc]">
              Instant local preview — sign in with one click:
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={quickDemoLearner}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] text-sm font-semibold hover:border-[#2f5bea] dark:hover:border-[#7a9bff] transition-colors cursor-pointer"
              >
                <GraduationCap className="w-4 h-4 text-[#12805f] dark:text-[#5fe0b6]" />
                <span>Demo Student (Vishal Tekmal)</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#5b6b86]" />
              </button>

              <button
                type="button"
                onClick={quickDemoFaculty}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] text-sm font-semibold hover:border-[#2f5bea] dark:hover:border-[#7a9bff] transition-colors cursor-pointer"
              >
                <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Demo Faculty (Dr. Priya Rao)</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#5b6b86]" />
              </button>

              <button
                type="button"
                onClick={quickDemoOrganizer}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] text-sm font-semibold hover:border-[#2f5bea] dark:hover:border-[#7a9bff] transition-colors cursor-pointer"
              >
                <Briefcase className="w-4 h-4 text-[#2f5bea] dark:text-[#7a9bff]" />
                <span>Demo Organizer (TechCorp HR)</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#5b6b86]" />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Auth Card */}
        <div className="lg:col-span-5">
          <div className="bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-6 sm:p-8 shadow-sm">
            {/* Sign In / Create Account tabs */}
            <div className="grid grid-cols-2 p-1 rounded-xl bg-[#f3f6fb] dark:bg-[#0b1120] mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError('');
                }}
                className={`py-2 text-sm font-bold rounded-lg transition-colors cursor-pointer ${
                  mode === 'signin'
                    ? 'bg-white dark:bg-[#1a2744] text-[#12203a] dark:text-white shadow-xs'
                    : 'text-[#5b6b86] dark:text-[#9fb0cc] hover:text-[#12203a] dark:hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError('');
                }}
                className={`py-2 text-sm font-bold rounded-lg transition-colors cursor-pointer ${
                  mode === 'register'
                    ? 'bg-white dark:bg-[#1a2744] text-[#12203a] dark:text-white shadow-xs'
                    : 'text-[#5b6b86] dark:text-[#9fb0cc] hover:text-[#12203a] dark:hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Role Selector */}
              <div>
                <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-2">
                  Select account workspace
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('learner')}
                    className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                      role === 'learner'
                        ? 'border-[#2f5bea] bg-[#e8eeff]/60 dark:bg-[#1c2a50] dark:border-[#7a9bff]'
                        : 'border-[#dbe3f0] dark:border-[#24324d] hover:bg-[#f8fafe] dark:hover:bg-[#16213a]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm">
                      <GraduationCap className="w-4 h-4 text-[#12805f] dark:text-[#5fe0b6] shrink-0" />
                      <span>Learner</span>
                    </div>
                    <div className="text-[10px] text-[#5b6b86] dark:text-[#9fb0cc] mt-0.5 truncate">
                      Student hub
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole('faculty')}
                    className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                      role === 'faculty'
                        ? 'border-[#2f5bea] bg-[#e8eeff]/60 dark:bg-[#1c2a50] dark:border-[#7a9bff]'
                        : 'border-[#dbe3f0] dark:border-[#24324d] hover:bg-[#f8fafe] dark:hover:bg-[#16213a]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm">
                      <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Faculty</span>
                    </div>
                    <div className="text-[10px] text-[#5b6b86] dark:text-[#9fb0cc] mt-0.5 truncate">
                      Leave & signs
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole('organizer')}
                    className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                      role === 'organizer'
                        ? 'border-[#2f5bea] bg-[#e8eeff]/60 dark:bg-[#1c2a50] dark:border-[#7a9bff]'
                        : 'border-[#dbe3f0] dark:border-[#24324d] hover:bg-[#f8fafe] dark:hover:bg-[#16213a]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm">
                      <Briefcase className="w-4 h-4 text-[#2f5bea] dark:text-[#7a9bff] shrink-0" />
                      <span>Organizer</span>
                    </div>
                    <div className="text-[10px] text-[#5b6b86] dark:text-[#9fb0cc] mt-0.5 truncate">
                      Recruiter
                    </div>
                  </button>
                </div>
              </div>

              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1.5">
                    {role === 'learner'
                      ? 'Full name'
                      : role === 'faculty'
                      ? 'Faculty name'
                      : 'Recruiter or company name'}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={
                      role === 'learner'
                        ? 'e.g. Ananya Reddy'
                        : role === 'faculty'
                        ? 'e.g. Dr. Priya Rao'
                        : 'e.g. Razorpay Campus Hiring'
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f5bea]"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1.5">
                  Work or university email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={role === 'learner' ? 'name@university.edu' : 'hiring@company.com'}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f5bea]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f5bea]"
                />
              </div>

              {mode === 'register' && role === 'learner' && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1.5">
                      Branch
                    </label>
                    <input
                      type="text"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f5bea]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1.5">
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
                </div>
              )}

              {mode === 'register' && role === 'organizer' && (
                <div>
                  <label className="block text-xs font-semibold text-[#5b6b86] dark:text-[#9fb0cc] mb-1.5">
                    Organization name
                  </label>
                  <input
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    placeholder="e.g. TechCorp India"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#dbe3f0] dark:border-[#24324d] bg-white dark:bg-[#0b1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f5bea]"
                  />
                </div>
              )}

              {error && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-700 dark:text-rose-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl bg-[#2f5bea] hover:bg-[#244bc9] text-white font-bold text-sm transition-colors cursor-pointer"
              >
                {mode === 'signin' ? 'Sign in to InternHub' : 'Create InternHub account'}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};
