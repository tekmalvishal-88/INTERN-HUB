import React, { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signOut, type User as FirebaseUser } from 'firebase/auth';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  Award,
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  Calendar as CalendarIcon,
  ChevronDown,
  Compass,
  FileCheck2,
  FileSignature,
  GraduationCap,
  Kanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PlusSquare,
  Search,
  SlidersHorizontal,
  Sparkles,
  Sun,
  UserCheck,
  UserCircle,
  Users,
  X,
} from 'lucide-react';
import {
  COURSE_RESOURCES,
  INITIAL_APPLICATIONS,
  INITIAL_LEAVE_REQUESTS,
  INITIAL_NOC_REQUESTS,
  INITIAL_OPPORTUNITIES,
  INITIAL_PARENT_CONSENTS,
  INITIAL_PROFILE,
  INITIAL_STUDENT_SCHEDULES,
} from './data/realData';
import type {
  ActivityActionType,
  AiPersonalizationResult,
  ApplicationCriteriaPayload,
  ApplicationRecord,
  ApplicationStage,
  FacultyTab,
  LearnerTab,
  LeaveRequest,
  LeaveType,
  NocRequest,
  Opportunity,
  OrganizerTab,
  ParentConsentSheet,
  ResumeItem,
  StudentEventItem,
  StudentProfile,
  StudentScheduleRecord,
  UserAccount,
  UserActivityLog,
  UserPersonalization,
  UserRole,
  WorkMode,
} from './types';
import { daysBetween, todayIso } from './utils/matching';
import { LoginView } from './components/LoginView';
import { LearnerDashboard } from './components/LearnerDashboard';
import { OpportunityHub } from './components/OpportunityHub';
import { ApplicationTracker } from './components/ApplicationTracker';
import { StudentApprovalsView } from './components/StudentApprovalsView';
import { ProfileView, SkillsView } from './components/SkillsAndProfile';
import { OrganizerWorkspace } from './components/OrganizerWorkspace';
import { FacultyWorkspace } from './components/FacultyWorkspace';
import { AiAssistantDrawer } from './components/AiAssistantDrawer';
import { PersonalizationModal } from './components/PersonalizationModal';
import { ActivityHistoryModal } from './components/ActivityHistoryModal';
import { GoogleVAvatar } from './components/GoogleVAvatar';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import { auth, testFirestoreConnection } from './lib/firebase';
import {
  appendUserActivityLog,
  createUserLeaveRequest,
  createUserNocRequest,
  createUserParentConsent,
  createUserStudentSchedule,
  ensureUserWorkspace,
  publishOpportunityToHub,
  saveUserApplication,
  saveUserPersonalization,
  saveUserProfile,
  seedOpportunitiesIfEmpty,
  signUserLeaveRequest,
  signUserNocRequest,
  subscribeToOpportunities,
  subscribeToUserWorkspace,
  syncLiveOpportunityHub,
  updateUserAccountPrefs,
  updateUserApplication,
  updateUserStudentSchedule,
  verifyUserParentConsent,
} from './lib/firestoreStore';

const STORAGE_KEY = 'internhub_state_v5';

interface PersistedState {
  user: UserAccount | null;
  profile: StudentProfile;
  opportunities: Opportunity[];
  applications: ApplicationRecord[];
  leaveRequests: LeaveRequest[];
  nocRequests: NocRequest[];
  parentConsents: ParentConsentSheet[];
  studentSchedules: StudentScheduleRecord[];
  activityLogs: UserActivityLog[];
  darkMode: boolean;
}

function getDeviceSummary(): string {
  const isTouch = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
  return isTouch ? 'InternHub Web · Mobile/Touch' : 'InternHub Web · Desktop';
}

function loadInitialState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('internhub_state_v4');
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      const mergedProfile: StudentProfile = {
        ...INITIAL_PROFILE,
        ...(parsed.profile ?? {}),
        resumes:
          Array.isArray(parsed.profile?.resumes) && parsed.profile.resumes.length > 0
            ? parsed.profile.resumes
            : INITIAL_PROFILE.resumes,
        projects:
          Array.isArray(parsed.profile?.projects) && parsed.profile.projects.length > 0
            ? parsed.profile.projects
            : INITIAL_PROFILE.projects,
      };
      return {
        user: parsed.user ?? null,
        profile: mergedProfile,
        opportunities:
          Array.isArray(parsed.opportunities) && parsed.opportunities.length >= 100
            ? parsed.opportunities
            : INITIAL_OPPORTUNITIES,
        applications:
          Array.isArray(parsed.applications) && parsed.applications.length > 0
            ? parsed.applications
            : INITIAL_APPLICATIONS,
        leaveRequests:
          Array.isArray(parsed.leaveRequests) && parsed.leaveRequests.length > 0
            ? parsed.leaveRequests
            : INITIAL_LEAVE_REQUESTS,
        nocRequests:
          Array.isArray(parsed.nocRequests) && parsed.nocRequests.length > 0
            ? parsed.nocRequests
            : INITIAL_NOC_REQUESTS,
        parentConsents:
          Array.isArray(parsed.parentConsents) && parsed.parentConsents.length > 0
            ? parsed.parentConsents
            : INITIAL_PARENT_CONSENTS,
        studentSchedules:
          Array.isArray(parsed.studentSchedules) && parsed.studentSchedules.length > 0
            ? parsed.studentSchedules
            : INITIAL_STUDENT_SCHEDULES,
        activityLogs: Array.isArray(parsed.activityLogs) ? parsed.activityLogs : [],
        darkMode: Boolean(parsed.darkMode),
      };
    }
  } catch {
    // fallback to defaults
  }
  return {
    user: null,
    profile: INITIAL_PROFILE,
    opportunities: INITIAL_OPPORTUNITIES,
    applications: INITIAL_APPLICATIONS,
    leaveRequests: INITIAL_LEAVE_REQUESTS,
    nocRequests: INITIAL_NOC_REQUESTS,
    parentConsents: INITIAL_PARENT_CONSENTS,
    studentSchedules: INITIAL_STUDENT_SCHEDULES,
    activityLogs: [],
    darkMode: false,
  };
}

export default function App() {
  const initial = useMemo(() => loadInitialState(), []);

  const [user, setUser] = useState<UserAccount | null>(initial.user);
  const [profile, setProfile] = useState<StudentProfile>(initial.profile);
  const [opportunities, setOpportunities] = useState<Opportunity[]>(initial.opportunities);
  const [applications, setApplications] = useState<ApplicationRecord[]>(initial.applications);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(initial.leaveRequests);
  const [nocRequests, setNocRequests] = useState<NocRequest[]>(initial.nocRequests);
  const [parentConsents, setParentConsents] = useState<ParentConsentSheet[]>(
    initial.parentConsents
  );
  const [studentSchedules, setStudentSchedules] = useState<StudentScheduleRecord[]>(
    initial.studentSchedules
  );
  const [activityLogs, setActivityLogs] = useState<UserActivityLog[]>(initial.activityLogs);
  const [darkMode, setDarkMode] = useState<boolean>(initial.darkMode);

  const [learnerTab, setLearnerTab] = useState<LearnerTab>('dashboard');
  const [facultyTab, setFacultyTab] = useState<FacultyTab>('approvals');
  const [organizerTab, setOrganizerTab] = useState<OrganizerTab>('analytics');
  const [globalSearch, setGlobalSearch] = useState('');
  const [hubInitialSearch, setHubInitialSearch] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiInitialPrompt, setAiInitialPrompt] = useState<string | undefined>(undefined);
  const [showPersonalization, setShowPersonalization] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isSyncingHub, setIsSyncingHub] = useState(false);
  const [fatalDbError, setFatalDbError] = useState<Error | null>(null);
  const preferredRoleRef = useRef<UserRole>('learner');
  const recordedLoginForUidRef = useRef<string | null>(null);

  if (fatalDbError) {
    throw fatalDbError;
  }

  const [roleAccounts, setRoleAccounts] = useState<Record<UserRole, UserAccount>>(() => ({
    learner:
      initial.user?.role === 'learner'
        ? initial.user
        : {
            id: 'demo-learner',
            name: initial.profile.name || 'Vishal Tekmal',
            email: 'vishal.tekmal@ifheindia.org',
            role: 'learner',
          },
    faculty:
      initial.user?.role === 'faculty'
        ? initial.user
        : {
            id: 'demo-faculty',
            name: 'Dr. Priya Rao',
            email: 'priya.rao@ifheindia.org',
            role: 'faculty',
            organization: 'IFHE Hyderabad · CSE Dept',
            designation: 'Faculty Internship Coordinator',
            verified: true,
          },
    organizer:
      initial.user?.role === 'organizer'
        ? initial.user
        : {
            id: 'demo-organizer',
            name: 'TechCorp HR Team',
            email: 'hiring@techcorp.in',
            role: 'organizer',
            organization: 'TechCorp India',
            verified: true,
          },
  }));

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [darkMode]);

  useEffect(() => {
    try {
      const payload: PersistedState = {
        user,
        profile,
        opportunities,
        applications,
        leaveRequests,
        nocRequests,
        parentConsents,
        studentSchedules,
        activityLogs: activityLogs.slice(0, 120),
        darkMode,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore quota errors
    }
  }, [
    user,
    profile,
    opportunities,
    applications,
    leaveRequests,
    nocRequests,
    parentConsents,
    studentSchedules,
    activityLogs,
    darkMode,
  ]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  const logActivity = (
    actionType: ActivityActionType,
    title: string,
    details: string,
    roleOverride?: UserRole,
    explicitUid?: string
  ) => {
    const activeRole = roleOverride ?? user?.role ?? 'learner';
    const entry: UserActivityLog = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: activeRole,
      actionType,
      title,
      details,
      deviceSummary: getDeviceSummary(),
      occurredAt: new Date().toISOString(),
    };
    setActivityLogs((prev) => [entry, ...prev].slice(0, 200));
    const targetUid = explicitUid ?? firebaseUser?.uid;
    if (targetUid) {
      void appendUserActivityLog(targetUid, {
        role: entry.role,
        actionType: entry.actionType,
        title: entry.title,
        details: entry.details,
        deviceSummary: entry.deviceSummary,
        occurredAt: entry.occurredAt,
      });
    }
  };

  useEffect(() => {
    void testFirestoreConnection();
    let unsubUserWs: (() => void) | null = null;
    let unsubOpps: (() => void) | null = null;
    let hubInterval: ReturnType<typeof setInterval> | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (unsubUserWs) {
        unsubUserWs();
        unsubUserWs = null;
      }
      if (unsubOpps) {
        unsubOpps();
        unsubOpps = null;
      }
      if (hubInterval) {
        clearInterval(hubInterval);
        hubInterval = null;
      }

      setFirebaseUser(fbUser);

      if (!fbUser) {
        recordedLoginForUidRef.current = null;
        return;
      }

      try {
        const { account, darkMode: savedDark, isNewWorkspace } = await ensureUserWorkspace(
          fbUser,
          preferredRoleRef.current,
          darkMode
        );
        setUser(account);
        setDarkMode(savedDark);
        setRoleAccounts((prev) => ({ ...prev, [account.role]: account }));

        if (recordedLoginForUidRef.current !== fbUser.uid) {
          recordedLoginForUidRef.current = fbUser.uid;
          logActivity(
            'login',
            `Signed in via Google (${account.email})`,
            `Login #${account.loginCount ?? 1} into ${account.role} workspace`,
            account.role,
            fbUser.uid
          );
        }

        if (!account.onboardingCompleted) {
          setShowPersonalization(true);
        }

        unsubUserWs = subscribeToUserWorkspace(
          fbUser.uid,
          {
            onAccountMeta: (meta) => {
              setUser((prev) => (prev ? { ...prev, ...meta } : prev));
            },
            onProfile: (p) => setProfile(p),
            onApplications: (apps) => setApplications(apps),
            onLeaves: (lvs) => setLeaveRequests(lvs),
            onNocs: (nocs) => setNocRequests(nocs),
            onParentConsents: (sheets) => setParentConsents(sheets),
            onSchedules: (stus) => setStudentSchedules(stus),
            onActivityLogs: (logs) => setActivityLogs(logs),
          },
          (err) => setFatalDbError(err)
        );

        await seedOpportunitiesIfEmpty(fbUser.uid);

        unsubOpps = subscribeToOpportunities(
          (liveOpps) => setOpportunities(liveOpps),
          (err) => setFatalDbError(err)
        );

        await syncLiveOpportunityHub(fbUser.uid);

        hubInterval = setInterval(() => {
          void syncLiveOpportunityHub(fbUser.uid).catch((err) => {
            setFatalDbError(err instanceof Error ? err : new Error('Failed to sync Opportunity Hub'));
          });
        }, 5 * 60 * 1000);

        if (isNewWorkspace) {
          showToast(`Created your personal InternHub workspace for ${account.email}`);
        }
      } catch (err) {
        setFatalDbError(err instanceof Error ? err : new Error('Failed to load workspace'));
      }
    });

    return () => {
      unsubAuth();
      if (unsubUserWs) unsubUserWs();
      if (unsubOpps) unsubOpps();
      if (hubInterval) clearInterval(hubInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAuthenticate = (
    account: UserAccount,
    setupDetails?: { branch?: string; semester?: number; college?: string }
  ) => {
    const isDemoAccount = account.id.startsWith('demo-');
    const firstName =
      account.name
        .trim()
        .replace(/^(dr|prof|mr|mrs|ms)\.?\s+/i, '')
        .split(/\s+/)[0] || 'User';

    setUser(account);
    setRoleAccounts((prev) => ({ ...prev, [account.role]: account }));
    setGlobalSearch('');
    setNotificationsOpen(false);
    setAccountMenuOpen(false);
    setMobileMenuOpen(false);

    if (!isDemoAccount) {
      setActivityLogs([]);
      setProfile({
        ...INITIAL_PROFILE,
        name: account.name,
        branch: setupDetails?.branch || 'Computer Science & Engineering',
        semester: setupDetails?.semester || 5,
        college: setupDetails?.college || 'Campus Partner University',
        resumeName: `${firstName}_Resume_2026.pdf`,
        resumes: [
          {
            id: `res-${Date.now()}`,
            name: `${firstName}_Resume_2026.pdf`,
            targetRole: 'Software & Analytics Internships',
            updatedAt: todayIso(),
            sizeLabel: '220 KB',
            isDefault: true,
          },
        ],
        projects: [],
      });
    } else if (account.id === 'demo-learner') {
      setProfile(INITIAL_PROFILE);
    }

    const entry: UserActivityLog = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: account.role,
      actionType: 'login',
      title: `Signed in (${account.email})`,
      details: `Entered ${account.role} workspace via local session`,
      deviceSummary: getDeviceSummary(),
      occurredAt: new Date().toISOString(),
    };
    setActivityLogs((prev) => (isDemoAccount ? [entry, ...prev].slice(0, 200) : [entry]));

    if (!account.onboardingCompleted) {
      setShowPersonalization(true);
    }
    if (account.role === 'learner') {
      setLearnerTab('dashboard');
    } else if (account.role === 'faculty') {
      setFacultyTab('approvals');
    } else {
      setOrganizerTab('analytics');
    }
  };

  const handleSwitchRoleView = (nextRole: UserRole) => {
    if (user?.role === nextRole) return;
    if (user) {
      setRoleAccounts((prev) => ({ ...prev, [user.role]: user }));
    }
    if (firebaseUser) {
      const updatedAccount: UserAccount = {
        ...(user || roleAccounts[nextRole]),
        id: firebaseUser.uid,
        name: profile.name || firebaseUser.displayName || user?.name || 'InternHub User',
        email: firebaseUser.email || user?.email || '',
        role: nextRole,
        organization:
          nextRole === 'organizer'
            ? roleAccounts.organizer.organization || 'Campus Partner'
            : roleAccounts.faculty.organization || 'IFHE Hyderabad · CSE Dept',
        designation:
          nextRole === 'faculty'
            ? 'Faculty Placement & Leave Coordinator'
            : undefined,
        verified: true,
      };
      setUser(updatedAccount);
      void updateUserAccountPrefs(firebaseUser.uid, { activeRole: nextRole });
    } else {
      const targetAccount = {
        ...roleAccounts[nextRole],
        lastLoginAt: user?.lastLoginAt,
        lastLoginMethod: user?.lastLoginMethod,
        loginCount: user?.loginCount,
        personalization: user?.personalization,
        aiSuggestions: user?.aiSuggestions,
        onboardingCompleted: user?.onboardingCompleted,
      };
      setUser(targetAccount);
    }
    logActivity(
      'role_switch',
      `Switched workspace to ${nextRole === 'faculty' ? 'Faculty' : nextRole === 'organizer' ? 'Organizer' : 'Student'}`,
      `Active account: ${user?.email || ''}`,
      nextRole
    );
    setNotificationsOpen(false);
    setMobileMenuOpen(false);
    if (nextRole === 'learner') {
      setLearnerTab('dashboard');
      showToast('Switched to Student View');
    } else if (nextRole === 'faculty') {
      setFacultyTab('approvals');
      showToast('Switched to Faculty View');
    } else {
      setOrganizerTab('analytics');
      showToast('Switched to Organizer View');
    }
  };

  const handleApply = (opp: Opportunity, details?: ApplicationCriteriaPayload) => {
    if (!user) return;
    const targetEmail = (details?.email || user.email).trim().toLowerCase();
    const already = applications.some(
      (a) => a.opportunityId === opp.id && a.applicantEmail.trim().toLowerCase() === targetEmail
    );
    if (already) return;

    const chosenResume =
      details?.resumeUsed ||
      profile.resumes.find((r) => r.isDefault)?.name ||
      profile.resumeName;

    const newApp: ApplicationRecord = {
      id: `app-${Date.now()}`,
      opportunityId: opp.id,
      company: opp.company,
      roleTitle: opp.title,
      location: opp.location,
      applicantEmail: details?.email || user.email,
      applicantName: details?.fullName || profile.name || user.name,
      applicantBranch: details?.branch || profile.branch,
      applicantSemester: details?.semester || profile.semester,
      applicantSkills: profile.skills,
      resumeUsed: chosenResume,
      stage: 'Applied',
      appliedOn: todayIso(),
      nextAction: details
        ? `Criteria verified · Available: ${details.availability} · Pending Faculty signature`
        : `Submitted with ${chosenResume} · Pending Faculty signature`,
      notes: details?.coverNote,
      applicationDetails: details,
      attachedNocId: details?.attachedNocId,
      attachedNocNumber: details?.attachedNocNumber,
      attachedConsentId: details?.attachedConsentId,
      attachedConsentCode: details?.attachedConsentCode,
      facultyApproval: {
        status: 'Pending',
        programClearance: 'Pending Review',
      },
      organizerConfirmedAllowed: false,
    };
    setApplications((prev) => [newApp, ...prev]);
    if (firebaseUser) {
      void saveUserApplication(firebaseUser.uid, newApp);
    }
    const attachedSummary = [
      details?.attachedNocNumber ? `NOC ${details.attachedNocNumber}` : null,
      details?.attachedConsentCode ? `Consent ${details.attachedConsentCode}` : null,
    ]
      .filter(Boolean)
      .join(' & ');
    logActivity(
      'apply',
      `Applied to ${opp.company} (${opp.title})`,
      `Resume: ${chosenResume}${details ? ` · CGPA ${details.cgpa}` : ''}${
        attachedSummary ? ` · Attached ${attachedSummary}` : ''
      }`,
      'learner'
    );
    showToast(
      attachedSummary
        ? `Applied to ${opp.company} with ${attachedSummary} attached for Faculty signature`
        : `Applied to ${opp.company} · Sent to Faculty for signature`
    );
  };

  const handleCompletePersonalization = (
    personalization: UserPersonalization,
    aiSuggestions: AiPersonalizationResult,
    updatedSkills?: string[]
  ) => {
    if (updatedSkills && updatedSkills.length > 0) {
      const nextProfile: StudentProfile = { ...profile, skills: updatedSkills };
      setProfile(nextProfile);
      if (firebaseUser) {
        void saveUserProfile(firebaseUser.uid, nextProfile);
      }
    }
    setUser((prev) =>
      prev
        ? {
            ...prev,
            personalization,
            aiSuggestions,
            onboardingCompleted: true,
          }
        : prev
    );
    if (firebaseUser) {
      void saveUserPersonalization(firebaseUser.uid, personalization, aiSuggestions);
    }
    logActivity(
      'personalize',
      'Completed AI Workspace Personalization',
      `Domains: ${personalization.preferredDomains.join(', ')} · Modes: ${personalization.preferredModes.join(', ')}`
    );
    setShowPersonalization(false);
    showToast('AI suggestions tailored to your preferences!');
  };

  const handleUpdateStage = (appId: string, nextStage: ApplicationStage) => {
    setApplications((prev) =>
      prev.map((a) => (a.id === appId ? { ...a, stage: nextStage } : a))
    );
    if (firebaseUser) {
      void updateUserApplication(firebaseUser.uid, appId, { stage: nextStage });
    }
    showToast(`Updated application stage to ${nextStage}`);
  };

  const handleUpdateApplicationResume = (appId: string, resumeName: string) => {
    setApplications((prev) =>
      prev.map((a) => (a.id === appId ? { ...a, resumeUsed: resumeName } : a))
    );
    if (firebaseUser) {
      void updateUserApplication(firebaseUser.uid, appId, { resumeUsed: resumeName });
    }
    showToast(`Attached ${resumeName}`);
  };

  const handleAddExternalApplication = (payload: {
    company: string;
    roleTitle: string;
    location: string;
    stage: ApplicationStage;
    nextAction: string;
    resumeUsed: string;
  }) => {
    if (!user) return;
    const newApp: ApplicationRecord = {
      id: `ext-${Date.now()}`,
      opportunityId: `external-${Date.now()}`,
      company: payload.company,
      roleTitle: payload.roleTitle,
      location: payload.location,
      applicantEmail: user.email,
      applicantName: profile.name || user.name,
      resumeUsed: payload.resumeUsed,
      stage: payload.stage,
      appliedOn: todayIso(),
      nextAction: payload.nextAction,
      isExternal: true,
    };
    setApplications((prev) => [newApp, ...prev]);
    if (firebaseUser) {
      void saveUserApplication(firebaseUser.uid, newApp);
    }
    showToast(`Added ${payload.company} to tracker`);
  };

  const handleAddResume = (fileName: string, targetRole: string) => {
    const newItem: ResumeItem = {
      id: `res-${Date.now()}`,
      name: fileName,
      targetRole,
      updatedAt: todayIso(),
      sizeLabel: '230 KB',
      isDefault: true,
    };
    const nextProfile: StudentProfile = {
      ...profile,
      resumeName: fileName,
      resumes: [newItem, ...profile.resumes.map((r) => ({ ...r, isDefault: false }))],
    };
    setProfile(nextProfile);
    if (firebaseUser) {
      void saveUserProfile(firebaseUser.uid, nextProfile);
    }
    showToast(`Added resume: ${fileName}`);
  };

  const handleUploadResume = (fileName: string) => {
    handleAddResume(fileName, 'General SWE & Analytics');
  };

  const handleSetDefaultResume = (resumeId: string) => {
    const target = profile.resumes.find((r) => r.id === resumeId);
    if (!target) return;
    const nextProfile: StudentProfile = {
      ...profile,
      resumeName: target.name,
      resumes: profile.resumes.map((r) => ({ ...r, isDefault: r.id === resumeId })),
    };
    setProfile(nextProfile);
    if (firebaseUser) {
      void saveUserProfile(firebaseUser.uid, nextProfile);
    }
    showToast('Default resume updated');
  };

  const handleDeleteResume = (resumeId: string) => {
    if (profile.resumes.length <= 1) return;
    const remaining = profile.resumes.filter((r) => r.id !== resumeId);
    const hasDefault = remaining.some((r) => r.isDefault);
    const normalized = hasDefault
      ? remaining
      : remaining.map((r, i) => ({ ...r, isDefault: i === 0 }));
    const nextDefault = normalized.find((r) => r.isDefault)?.name || normalized[0].name;
    const nextProfile: StudentProfile = {
      ...profile,
      resumeName: nextDefault,
      resumes: normalized,
    };
    setProfile(nextProfile);
    if (firebaseUser) {
      void saveUserProfile(firebaseUser.uid, nextProfile);
    }
    showToast('Removed resume from vault');
  };

  const handleAddSkill = (skill: string) => {
    if (profile.skills.some((s) => s.toLowerCase() === skill.toLowerCase())) return;
    const nextProfile: StudentProfile = {
      ...profile,
      skills: [...profile.skills, skill],
    };
    setProfile(nextProfile);
    if (firebaseUser) {
      void saveUserProfile(firebaseUser.uid, nextProfile);
    }
    showToast(`Added "${skill}" to your profile skills`);
  };

  const handlePublishOpportunity = (opp: Opportunity) => {
    setOpportunities((prev) => [opp, ...prev]);
    if (firebaseUser) {
      void publishOpportunityToHub(firebaseUser.uid, opp);
    }
    logActivity(
      'opportunity_publish',
      `Published ${opp.title}`,
      `${opp.company} · ${opp.mode} (${opp.location})`,
      'organizer'
    );
    showToast(`Published ${opp.title} to live Opportunity Hub`);
  };

  const handleRefreshOpportunityHub = async () => {
    setIsSyncingHub(true);
    try {
      if (firebaseUser) {
        const count = await syncLiveOpportunityHub(firebaseUser.uid, opportunities);
        logActivity(
          'hub_sync',
          'Synced Opportunity Hub',
          `Synced ${count} new & refreshed opportunities`
        );
        showToast(
          count > 0
            ? `Synced ${count} new & updated opportunities in Opportunity Hub`
            : 'Opportunity Hub is up to date with the latest live roles'
        );
      } else {
        logActivity('hub_sync', 'Refreshed Opportunity Hub', 'Verified live catalog listings');
        showToast('Opportunity Hub refreshed');
      }
    } finally {
      setIsSyncingHub(false);
    }
  };

  const handleSubmitLeaveRequest = (payload: {
    leaveType: LeaveType;
    companyOrEvent: string;
    startDate: string;
    endDate: string;
    timingNote: string;
    reason: string;
  }) => {
    if (!user) return;
    const newLeave: LeaveRequest = {
      id: `lv-${Date.now()}`,
      studentName: profile.name || user.name,
      rollNumber: '23IFHE0142',
      studentEmail: user.email,
      branch: profile.branch,
      semester: profile.semester,
      leaveType: payload.leaveType,
      companyOrEvent: payload.companyOrEvent,
      startDate: payload.startDate,
      endDate: payload.endDate,
      timingNote: payload.timingNote,
      reason: payload.reason,
      submittedOn: todayIso(),
      status: 'Pending',
    };
    setLeaveRequests((prev) => [newLeave, ...prev]);
    if (firebaseUser) {
      void createUserLeaveRequest(firebaseUser.uid, newLeave);
    }
    logActivity(
      'leave_submit',
      `Submitted ${payload.leaveType} leave request`,
      `${payload.companyOrEvent} (${payload.startDate} to ${payload.endDate})`,
      'learner'
    );
    showToast('Leave request sent to Faculty Coordinator for digital signature');
  };

  const handleSignLeaveRequest = (
    requestId: string,
    decision: 'Approved' | 'Rejected',
    signature: {
      signerName: string;
      signerDesignation: string;
      signatureDataUrl: string;
      remarks?: string;
    }
  ) => {
    const code = `IH-FAC-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const sigRecord = {
      signerName: signature.signerName,
      signerDesignation: signature.signerDesignation,
      signatureDataUrl: signature.signatureDataUrl,
      signedAt: todayIso(),
      verificationCode: code,
      remarks: signature.remarks,
    };
    setLeaveRequests((prev) =>
      prev.map((lv) =>
        lv.id === requestId
          ? {
              ...lv,
              status: decision,
              digitalSignature: sigRecord,
            }
          : lv
      )
    );
    if (firebaseUser) {
      void signUserLeaveRequest(firebaseUser.uid, requestId, decision, sigRecord);
    }
    logActivity(
      'leave_sign',
      `Digitally ${decision.toLowerCase()} leave request`,
      `Verification code ${code} by ${signature.signerName}`,
      'faculty'
    );
    showToast(`Leave ${decision.toLowerCase()} with digital signature (${code})`);
  };

  const handleAddStudentSchedule = (student: Omit<StudentScheduleRecord, 'id'>) => {
    const rec: StudentScheduleRecord = { ...student, id: `stu-${Date.now()}` };
    setStudentSchedules((prev) => [rec, ...prev]);
    if (firebaseUser) {
      void createUserStudentSchedule(firebaseUser.uid, rec);
    }
    logActivity(
      'schedule_update',
      `Added student schedule (${student.studentName})`,
      `${student.internshipCompany} · ${student.internshipTiming}`,
      'faculty'
    );
    showToast(`Added ${student.studentName} to student roster`);
  };

  const handleAddStudentEvent = (studentId: string, event: Omit<StudentEventItem, 'id'>) => {
    const newEv: StudentEventItem = { ...event, id: `ev-${Date.now()}` };
    const targetStu = studentSchedules.find((s) => s.id === studentId);
    const nextExtraEvents = [...(targetStu?.extraEvents ?? []), newEv];
    setStudentSchedules((prev) =>
      prev.map((stu) =>
        stu.id === studentId
          ? { ...stu, extraEvents: [...(stu.extraEvents ?? []), newEv] }
          : stu
      )
    );
    if (firebaseUser) {
      void updateUserStudentSchedule(firebaseUser.uid, studentId, {
        extraEvents: nextExtraEvents,
      });
    }
    logActivity(
      'schedule_update',
      `Scheduled event: ${event.title}`,
      `${event.date} · ${event.timing}`,
      'faculty'
    );
    showToast(`Added event "${event.title}"`);
  };

  const handleUpdateStudentTiming = (
    studentId: string,
    updates: {
      internshipCompany: string;
      internshipRole: string;
      internshipTiming: string;
      internshipStart: string;
      internshipEnd: string;
    }
  ) => {
    setStudentSchedules((prev) =>
      prev.map((stu) => (stu.id === studentId ? { ...stu, ...updates } : stu))
    );
    if (firebaseUser) {
      void updateUserStudentSchedule(firebaseUser.uid, studentId, updates);
    }
    logActivity(
      'schedule_update',
      `Updated student timing (${updates.internshipCompany})`,
      `${updates.internshipRole} · ${updates.internshipTiming}`,
      'faculty'
    );
    showToast('Updated student internship timing');
  };

  const handleSubmitNocRequest = (payload: {
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
  }) => {
    if (!user) return;
    const refNo = `IFHE/CSE/NOC/2026/${String(100 + nocRequests.length + 1).padStart(3, '0')}`;
    const newNoc: NocRequest = {
      id: `noc-${Date.now()}`,
      nocNumber: refNo,
      studentName: profile.name || user.name,
      rollNumber: '23IFHE0142',
      studentEmail: user.email,
      branch: profile.branch,
      semester: profile.semester,
      companyName: payload.companyName,
      roleTitle: payload.roleTitle,
      workMode: payload.workMode,
      location: payload.location,
      stipendLabel: payload.stipendLabel,
      internshipStart: payload.internshipStart,
      internshipEnd: payload.internshipEnd,
      dailyTiming: payload.dailyTiming,
      hrContactName: payload.hrContactName,
      hrContactEmail: payload.hrContactEmail,
      offerLetterName: payload.offerLetterName,
      parentConsentId: payload.parentConsentId,
      parentSigned: Boolean(payload.parentConsentId),
      academicRemarks: payload.academicRemarks,
      submittedOn: todayIso(),
      status: 'Pending',
    };
    setNocRequests((prev) => [newNoc, ...prev]);
    if (firebaseUser) {
      void createUserNocRequest(firebaseUser.uid, newNoc);
    }
    logActivity(
      'noc_submit',
      `Submitted NOC request (${refNo})`,
      `${payload.companyName} · ${payload.roleTitle}`,
      'learner'
    );
    showToast(`NOC Request (${refNo}) sent to Faculty Coordinator`);
  };

  const handleSubmitParentConsent = (payload: {
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
  }) => {
    if (!user) return;
    const code = `IH-PC-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const sheet: ParentConsentSheet = {
      id: `pc-${Date.now()}`,
      consentCode: code,
      studentName: profile.name || user.name,
      rollNumber: '23IFHE0142',
      studentEmail: user.email,
      branch: profile.branch,
      semester: profile.semester,
      ...payload,
      signedOn: todayIso(),
      facultyVerified: false,
    };
    setParentConsents((prev) => [sheet, ...prev]);
    if (firebaseUser) {
      void createUserParentConsent(firebaseUser.uid, sheet);
    }
    logActivity(
      'consent_submit',
      `Submitted Parent Consent Sheet (${code})`,
      `Guardian: ${payload.parentName} (${payload.relationship}) · ${payload.companyOrEvent}`,
      'learner'
    );
    showToast(`Parent Consent Sheet (${code}) saved and shared with Faculty`);
  };

  const handleSignNocRequest = (
    nocId: string,
    decision: 'Approved' | 'Rejected',
    signature: {
      signerName: string;
      signerDesignation: string;
      signatureDataUrl: string;
      remarks?: string;
    }
  ) => {
    const code = `IH-NOC-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const sigRecord = {
      signerName: signature.signerName,
      signerDesignation: signature.signerDesignation,
      signatureDataUrl: signature.signatureDataUrl,
      signedAt: todayIso(),
      verificationCode: code,
      remarks: signature.remarks,
    };
    setNocRequests((prev) =>
      prev.map((n) =>
        n.id === nocId
          ? {
              ...n,
              status: decision,
              facultySignature: sigRecord,
            }
          : n
      )
    );
    if (firebaseUser) {
      void signUserNocRequest(firebaseUser.uid, nocId, decision, sigRecord);
    }
    logActivity(
      'noc_sign',
      `Digitally ${decision.toLowerCase()} NOC`,
      `Verification code ${code} by ${signature.signerName}`,
      'faculty'
    );
    showToast(`NOC ${decision.toLowerCase()} with digital signature (${code})`);
  };

  const handleVerifyParentConsent = (consentId: string) => {
    const verifier = user?.name || 'Dr. Priya Rao';
    setParentConsents((prev) =>
      prev.map((sheet) =>
        sheet.id === consentId
          ? {
              ...sheet,
              facultyVerified: true,
              verifiedBy: verifier,
              verifiedOn: todayIso(),
            }
          : sheet
      )
    );
    if (firebaseUser) {
      void verifyUserParentConsent(firebaseUser.uid, consentId, verifier);
    }
    logActivity(
      'consent_verify',
      'Verified Parent Consent Sheet',
      `Verified by ${verifier}`,
      'faculty'
    );
    showToast('Parent Consent Sheet verified by Faculty');
  };

  const handleSignApplication = (
    appId: string,
    decision: 'Approved' | 'Rejected',
    signature: {
      signerName: string;
      signerDesignation: string;
      signatureDataUrl: string;
      remarks?: string;
    }
  ) => {
    const code = `IH-APP-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const sigRecord = {
      signerName: signature.signerName,
      signerDesignation: signature.signerDesignation,
      signatureDataUrl: signature.signatureDataUrl,
      signedAt: todayIso(),
      verificationCode: code,
      remarks: signature.remarks,
    };
    const programClearance =
      decision === 'Approved' ? 'Open / Allowed for Program' : 'Not Cleared';
    const nextApproval = {
      status: decision,
      programClearance,
      digitalSignature: sigRecord,
    } as const;
    const nextActionMsg =
      decision === 'Approved'
        ? `Faculty Signed (${code}) · Open / Allowed for Program`
        : `Faculty clearance declined (${code})`;

    const targetApp = applications.find((a) => a.id === appId);
    setApplications((prev) =>
      prev.map((a) =>
        a.id === appId
          ? {
              ...a,
              facultyApproval: nextApproval,
              nextAction: nextActionMsg,
            }
          : a
      )
    );
    if (firebaseUser) {
      void updateUserApplication(firebaseUser.uid, appId, {
        facultyApproval: nextApproval,
        nextAction: nextActionMsg,
      });
    }
    logActivity(
      'application_sign',
      `Faculty ${decision === 'Approved' ? 'signed & allowed' : 'declined'} ${
        targetApp?.applicantName || 'student'
      }`,
      `${targetApp?.company || ''} · ${programClearance} (${code})`,
      'faculty'
    );
    showToast(
      decision === 'Approved'
        ? `Signed (${code}) — Student sees pass & Organizer notified: Open / Allowed for Program`
        : `Application declined by Faculty (${code})`
    );
  };

  const handleAttachDocsToApplication = (
    appId: string,
    attachments: {
      attachedNocId?: string;
      attachedNocNumber?: string;
      attachedConsentId?: string;
      attachedConsentCode?: string;
    }
  ) => {
    setApplications((prev) =>
      prev.map((a) =>
        a.id === appId
          ? {
              ...a,
              attachedNocId: attachments.attachedNocId || undefined,
              attachedNocNumber: attachments.attachedNocNumber || undefined,
              attachedConsentId: attachments.attachedConsentId || undefined,
              attachedConsentCode: attachments.attachedConsentCode || undefined,
            }
          : a
      )
    );
    if (firebaseUser) {
      void updateUserApplication(firebaseUser.uid, appId, {
        attachedNocId: attachments.attachedNocId ?? '',
        attachedNocNumber: attachments.attachedNocNumber ?? '',
        attachedConsentId: attachments.attachedConsentId ?? '',
        attachedConsentCode: attachments.attachedConsentCode ?? '',
      });
    }
    showToast('Updated attached NOC Request & Parent Consent Sheet');
  };

  const handleConfirmApplicantForProgram = (appId: string) => {
    const confirmedDate = todayIso();
    const targetApp = applications.find((a) => a.id === appId);
    const nextStage: ApplicationStage =
      targetApp && targetApp.stage === 'Applied'
        ? 'Shortlisted'
        : targetApp?.stage || 'Shortlisted';
    const nextActionMsg = 'Organizer confirmed Open / Allowed for Program';

    setApplications((prev) =>
      prev.map((a) =>
        a.id === appId
          ? {
              ...a,
              organizerConfirmedAllowed: true,
              organizerConfirmedAt: confirmedDate,
              stage: nextStage,
              nextAction: nextActionMsg,
            }
          : a
      )
    );
    if (firebaseUser) {
      void updateUserApplication(firebaseUser.uid, appId, {
        organizerConfirmedAllowed: true,
        organizerConfirmedAt: confirmedDate,
        stage: nextStage,
        nextAction: nextActionMsg,
      });
    }
    logActivity(
      'organizer_confirm',
      `Confirmed ${targetApp?.applicantName || 'candidate'} Open / Allowed for Program`,
      `${targetApp?.company || ''} · ${targetApp?.roleTitle || ''}`,
      'organizer'
    );
    showToast(
      `Confirmed ${targetApp?.applicantName || 'student'} as Open / Allowed for Program`
    );
  };

  const handleLogout = async () => {
    recordedLoginForUidRef.current = null;
    setShowPersonalization(false);
    setShowActivityModal(false);
    setAccountMenuOpen(false);
    setNotificationsOpen(false);
    setMobileMenuOpen(false);
    setGlobalSearch('');
    if (firebaseUser) {
      try {
        await signOut(auth);
      } catch {
        // ignore signOut errors
      }
    }
    setUser(null);
  };

  const deadlineAlerts = useMemo(() => {
    const today = todayIso();
    return opportunities
      .map((o) => ({ opp: o, daysLeft: daysBetween(today, o.deadline) }))
      .filter((x) => x.daysLeft >= 0 && x.daysLeft <= 14)
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [opportunities]);

  if (!user) {
    return (
      <LoginView
        darkMode={darkMode}
        onToggleTheme={() => setDarkMode((d) => !d)}
        onAuthenticate={handleAuthenticate}
        onSelectPreferredRole={(nextRole) => {
          preferredRoleRef.current = nextRole;
        }}
      />
    );
  }

  const isLearner = user.role === 'learner';
  const isFaculty = user.role === 'faculty';
  const pendingLeaveCount = leaveRequests.filter((lv) => lv.status === 'Pending').length;
  const pendingNocCount = nocRequests.filter((n) => n.status === 'Pending').length;
  const pendingAppClearanceCount = applications.filter(
    (a) => !a.facultyApproval || a.facultyApproval.status === 'Pending'
  ).length;
  const pendingFacultyCount = pendingLeaveCount + pendingNocCount + pendingAppClearanceCount;

  const learnerNav: Array<{
    id: LearnerTab;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      shortLabel: 'Home',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'hub',
      label: 'Opportunity Hub',
      shortLabel: 'Hub',
      icon: <Compass className="w-4 h-4" />,
    },
    {
      id: 'applications',
      label: 'My Applications',
      shortLabel: 'Applied',
      icon: <Kanban className="w-4 h-4" />,
    },
    {
      id: 'approvals',
      label: 'Approvals',
      shortLabel: 'Approvals',
      icon: <FileSignature className="w-4 h-4" />,
    },
    {
      id: 'skills',
      label: 'Skills & Prep',
      shortLabel: 'Skills',
      icon: <GraduationCap className="w-4 h-4" />,
    },
    {
      id: 'profile',
      label: 'Profile & Resume',
      shortLabel: 'Profile',
      icon: <UserCircle className="w-4 h-4" />,
    },
  ];

  const facultyNav: Array<{
    id: FacultyTab;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'approvals',
      label: 'Leave Approvals',
      shortLabel: 'Leaves',
      icon: <FileCheck2 className="w-4 h-4" />,
    },
    {
      id: 'noc',
      label: 'NOC & Consent',
      shortLabel: 'NOC',
      icon: <FileSignature className="w-4 h-4" />,
    },
    {
      id: 'applications',
      label: 'App Clearances',
      shortLabel: 'Apps',
      icon: <Award className="w-4 h-4" />,
    },
    {
      id: 'students',
      label: 'Students & Timings',
      shortLabel: 'Students',
      icon: <Users className="w-4 h-4" />,
    },
    {
      id: 'calendar',
      label: 'Events Calendar',
      shortLabel: 'Calendar',
      icon: <CalendarIcon className="w-4 h-4" />,
    },
  ];

  const organizerNav: Array<{
    id: OrganizerTab;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'analytics',
      label: 'Analytics',
      shortLabel: 'Stats',
      icon: <BarChart3 className="w-4 h-4" />,
    },
    {
      id: 'post',
      label: 'Post Opportunity',
      shortLabel: 'Post',
      icon: <PlusSquare className="w-4 h-4" />,
    },
    {
      id: 'applicants',
      label: 'Applicants',
      shortLabel: 'People',
      icon: <UserCheck className="w-4 h-4" />,
    },
    {
      id: 'org-profile',
      label: 'Organization',
      shortLabel: 'Org',
      icon: <Building2 className="w-4 h-4" />,
    },
  ];

  const pageTitle = isLearner
    ? learnerNav.find((n) => n.id === learnerTab)?.label || 'Dashboard'
    : isFaculty
    ? facultyNav.find((n) => n.id === facultyTab)?.label || 'Leave Approvals'
    : organizerNav.find((n) => n.id === organizerTab)?.label || 'Analytics';

  const handleGlobalSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLearner) {
      setHubInitialSearch(globalSearch);
      setLearnerTab('hub');
    } else if (isFaculty) {
      setFacultyTab('students');
    } else {
      setOrganizerTab('applicants');
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f6fb] dark:bg-[#0b1120] text-[#12203a] dark:text-[#e8eefc] flex">
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Left Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-64 shrink-0 flex flex-col justify-between border-r transition-transform duration-200 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${
          isLearner
            ? 'bg-white dark:bg-[#11192c] border-[#dbe3f0] dark:border-[#24324d]'
            : 'bg-[#0f172a] text-slate-100 border-[#1e293b]'
        }`}
      >
        <div className="p-5 space-y-6">
          {/* Brand Lockup */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#2f5bea] text-white flex items-center justify-center font-extrabold text-sm">
                IH
              </div>
              <span className="text-lg font-extrabold tracking-tight">
                Intern<span className="text-[#2f5bea] dark:text-[#7a9bff]">Hub</span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1.5 rounded-lg opacity-70 hover:opacity-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Role indicator */}
          <div
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 ${
              isLearner
                ? 'bg-[#f3f6fb] dark:bg-[#16213a] text-[#5b6b86] dark:text-[#9fb0cc]'
                : 'bg-white/10 text-slate-200'
            }`}
          >
            {isLearner ? (
              <>
                <GraduationCap className="w-4 h-4 text-[#12805f] dark:text-[#5fe0b6]" />
                <span>Learner Workspace</span>
              </>
            ) : isFaculty ? (
              <>
                <UserCheck className="w-4 h-4 text-emerald-400" />
                <span>Faculty Portal</span>
              </>
            ) : (
              <>
                <Briefcase className="w-4 h-4 text-[#7a9bff]" />
                <span>Organizer Workspace</span>
              </>
            )}
          </div>

          {/* Nav items */}
          <nav className="space-y-1">
            {isLearner
              ? learnerNav.map((item) => {
                  const active = learnerTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setLearnerTab(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                        active
                          ? 'bg-[#e8eeff] dark:bg-[#1c2a50] text-[#2f5bea] dark:text-[#7a9bff]'
                          : 'text-[#5b6b86] dark:text-[#9fb0cc] hover:bg-[#f3f6fb] dark:hover:bg-[#16213a] hover:text-[#12203a] dark:hover:text-white'
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  );
                })
              : isFaculty
              ? facultyNav.map((item) => {
                  const active = facultyTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setFacultyTab(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                        active
                          ? 'bg-[#2f5bea] text-white'
                          : 'text-slate-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  );
                })
              : organizerNav.map((item) => {
                  const active = organizerTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setOrganizerTab(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                        active
                          ? 'bg-[#2f5bea] text-white'
                          : 'text-slate-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  );
                })}
          </nav>
        </div>

        {/* Bottom Profile (Dynamic First-Letter Monogram) & Sign Out */}
        <div
          className={`p-4 border-t space-y-2 ${
            isLearner ? 'border-[#dbe3f0] dark:border-[#24324d]' : 'border-white/10'
          }`}
        >
          <button
            type="button"
            onClick={() => {
              if (isLearner) setLearnerTab('profile');
              else setShowActivityModal(true);
              setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-left transition-colors cursor-pointer ${
              isLearner ? 'hover:bg-[#f3f6fb] dark:hover:bg-[#16213a]' : 'hover:bg-white/10'
            }`}
          >
            <GoogleVAvatar
              name={isLearner ? profile.name || user.name : user.name}
              email={user.email}
              role={user.role}
              size="sm"
              showRing={false}
            />
            <div className="min-w-0">
              <p className="text-xs font-bold truncate">
                {isLearner ? profile.name || user.name : user.name}
              </p>
              <p
                className={`text-[11px] truncate ${
                  isLearner ? 'text-[#5b6b86] dark:text-[#9fb0cc]' : 'text-slate-400'
                }`}
              >
                {user.email}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => void handleLogout()}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              isLearner
                ? 'text-[#5b6b86] dark:text-[#9fb0cc] hover:bg-[#f3f6fb] dark:hover:bg-[#16213a]'
                : 'text-slate-300 hover:bg-white/10'
            }`}
          >
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-[#f3f6fb]/90 dark:bg-[#0b1120]/90 backdrop-blur-md border-b border-[#dbe3f0] dark:border-[#24324d] px-4 sm:px-7 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 flex-1 max-w-xl">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 rounded-xl bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>

            <form onSubmit={handleGlobalSearchSubmit} className="relative flex-1">
              <Search className="w-4 h-4 text-[#5b6b86] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder={
                  isLearner
                    ? 'Search 164+ internships, hackathons, or skills...'
                    : isFaculty
                    ? 'Search students, leave requests, or timings...'
                    : 'Search postings or applicants...'
                }
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] text-sm focus:outline-none focus:border-[#2f5bea]"
              />
            </form>

            {/* AI Assistant CTA button */}
            <button
              type="button"
              onClick={() => setAiOpen(true)}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl bg-white dark:bg-[#131d33] border border-[#2f5bea] dark:border-[#7a9bff] text-[#2f5bea] dark:text-[#7a9bff] hover:bg-[#e8eeff] dark:hover:bg-[#1c2a50] hover:-translate-y-0.5 active:translate-y-0 text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">AI Assistant</span>
              <span className="sm:hidden">AI</span>
            </button>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2 shrink-0 relative">
            {/* Top-Corner View Switcher (Student / Faculty View / Organizer) */}
            <div
              role="group"
              aria-label="Workspace view switcher"
              className="hidden md:inline-flex items-center p-1 rounded-xl bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] gap-0.5 shrink-0"
            >
              <button
                type="button"
                onClick={() => handleSwitchRoleView('learner')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  user.role === 'learner'
                    ? 'bg-[#2f5bea] text-white shadow-2xs'
                    : 'text-[#5b6b86] dark:text-[#9fb0cc] hover:text-[#12203a] dark:hover:text-white'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Student</span>
              </button>
              <button
                type="button"
                onClick={() => handleSwitchRoleView('faculty')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  user.role === 'faculty'
                    ? 'bg-[#12805f] text-white shadow-2xs'
                    : 'text-[#5b6b86] dark:text-[#9fb0cc] hover:text-[#12203a] dark:hover:text-white'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Faculty View</span>
                {pendingFacultyCount > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold tabular-nums ${
                      user.role === 'faculty'
                        ? 'bg-white/25 text-white'
                        : 'bg-[#dff5ec] dark:bg-[#12342b] text-[#12805f] dark:text-[#5fe0b6]'
                    }`}
                  >
                    {pendingFacultyCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => handleSwitchRoleView('organizer')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  user.role === 'organizer'
                    ? 'bg-[#12203a] dark:bg-[#2f5bea] text-white shadow-2xs'
                    : 'text-[#5b6b86] dark:text-[#9fb0cc] hover:text-[#12203a] dark:hover:text-white'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>Organizer</span>
              </button>
            </div>

            {/* Mobile Top-Corner Quick Faculty View Toggle */}
            <button
              type="button"
              onClick={() => handleSwitchRoleView(isFaculty ? 'learner' : 'faculty')}
              className={`md:hidden inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                isFaculty
                  ? 'bg-[#12805f] border-[#12805f] text-white'
                  : 'bg-white dark:bg-[#131d33] border-[#dbe3f0] dark:border-[#24324d] text-[#12805f] dark:text-[#5fe0b6]'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>{isFaculty ? 'Student' : 'Faculty View'}</span>
            </button>

            <PWAInstallButton />

            <button
              type="button"
              onClick={() => {
                const next = !darkMode;
                setDarkMode(next);
                if (firebaseUser) {
                  void updateUserAccountPrefs(firebaseUser.uid, { darkMode: next });
                }
              }}
              aria-label="Toggle theme"
              className="p-2 rounded-xl bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] text-[#5b6b86] dark:text-[#9fb0cc] hover:text-[#12203a] dark:hover:text-white transition-colors cursor-pointer"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => {
                setNotificationsOpen((o) => !o);
                setAccountMenuOpen(false);
              }}
              aria-label="Deadline notifications"
              className="relative p-2 rounded-xl bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] text-[#5b6b86] dark:text-[#9fb0cc] hover:text-[#12203a] dark:hover:text-white transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {deadlineAlerts.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {deadlineAlerts.length > 9 ? '9+' : deadlineAlerts.length}
                </span>
              )}
            </button>

            {/* Clean First-Letter PFP Account Trigger */}
            <button
              type="button"
              onClick={() => {
                setAccountMenuOpen((o) => !o);
                setNotificationsOpen(false);
              }}
              aria-label="Account menu and preferences"
              aria-expanded={accountMenuOpen}
              className="inline-flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-xl bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] hover:border-[#2f5bea] transition-colors cursor-pointer shrink-0"
            >
              <GoogleVAvatar
                name={isLearner ? profile.name || user.name : user.name}
                email={user.email}
                role={user.role}
                size="sm"
                showRing={false}
              />
              <span className="hidden sm:inline text-xs font-bold max-w-[120px] truncate">
                {(() => {
                  const full = (isLearner ? profile.name || user.name : user.name).trim();
                  const parts = full.split(/\s+/);
                  if (parts.length > 1 && /^(dr|prof|mr|mrs|ms)\.?$/i.test(parts[0])) {
                    return `${parts[0]} ${parts[1]}`;
                  }
                  return parts[0] || 'Account';
                })()}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[#5b6b86] dark:text-[#9fb0cc]" />
            </button>

            {accountMenuOpen && (
              <div className="absolute right-0 top-12 w-72 bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl shadow-xl z-50 overflow-hidden">
                <div className="p-4 border-b border-[#dbe3f0] dark:border-[#24324d] bg-[#f8fafe] dark:bg-[#0e1626] flex items-center gap-3">
                  <GoogleVAvatar
                    name={isLearner ? profile.name || user.name : user.name}
                    email={user.email}
                    role={user.role}
                    size="md"
                    showRing={false}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold truncate">
                      {isLearner ? profile.name || user.name : user.name}
                    </p>
                    <p className="text-[11px] text-[#5b6b86] dark:text-[#9fb0cc] truncate">
                      {user.email}
                    </p>
                    <p className="text-[10px] font-semibold text-[#2f5bea] dark:text-[#7a9bff] mt-0.5 capitalize">
                      {user.role === 'learner' ? 'Student' : user.role} ·{' '}
                      {user.lastLoginMethod === 'google' ? 'Google Auth' : 'Local Session'}
                    </p>
                  </div>
                </div>

                <div className="p-2 space-y-1 text-xs">
                  {isLearner && (
                    <button
                      type="button"
                      onClick={() => {
                        setLearnerTab('profile');
                        setAccountMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#f3f6fb] dark:hover:bg-[#16213a] font-semibold text-left cursor-pointer"
                    >
                      <UserCircle className="w-4 h-4 text-[#5b6b86] dark:text-[#9fb0cc]" />
                      <span>Profile & Resume</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowPersonalization(true);
                      setAccountMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#f3f6fb] dark:hover:bg-[#16213a] font-semibold text-left cursor-pointer"
                  >
                    <SlidersHorizontal className="w-4 h-4 text-[#2f5bea] dark:text-[#7a9bff]" />
                    <span>AI Preferences & Goals</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowActivityModal(true);
                      setAccountMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#f3f6fb] dark:hover:bg-[#16213a] font-semibold text-left cursor-pointer"
                  >
                    <Activity className="w-4 h-4 text-[#12805f] dark:text-[#5fe0b6]" />
                    <span>Login & Activity History</span>
                  </button>
                  <div className="my-1 border-t border-[#dbe3f0] dark:border-[#24324d]" />
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-semibold text-left cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign out</span>
                  </button>
                </div>
              </div>
            )}

            {notificationsOpen && (
              <div className="absolute right-0 top-12 w-80 bg-white dark:bg-[#131d33] border border-[#dbe3f0] dark:border-[#24324d] rounded-2xl p-4 shadow-xl z-50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">Urgent Deadlines</span>
                  <button
                    type="button"
                    onClick={() => setNotificationsOpen(false)}
                    className="text-xs text-[#5b6b86] cursor-pointer"
                  >
                    Close
                  </button>
                </div>
                {deadlineAlerts.length === 0 ? (
                  <p className="text-xs text-[#5b6b86]">No deadlines in the next 14 days.</p>
                ) : (
                  deadlineAlerts.slice(0, 5).map(({ opp, daysLeft }) => {
                    const urgencyColor =
                      daysLeft < 3
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-orange-600 dark:text-orange-400';
                    return (
                      <div
                        key={opp.id}
                        className="text-xs p-2.5 rounded-xl bg-[#f8fafe] dark:bg-[#0e1626] flex items-center justify-between gap-2"
                      >
                        <span className="truncate font-medium">
                          {opp.company} · {opp.title}
                        </span>
                        <span className={`font-mono font-bold shrink-0 tabular-nums ${urgencyColor}`}>
                          {daysLeft === 0 ? 'Today' : `${daysLeft}d`}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </header>

        {/* Page Header + Active View */}
        <main className="flex-1 p-4 sm:p-7 pb-24 lg:pb-8 max-w-[1400px] w-full mx-auto space-y-5">
          {isLearner && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight">
                  {learnerTab === 'dashboard'
                    ? `Welcome back, ${(profile.name || user.name).split(' ')[0]}`
                    : pageTitle}
                </h1>
                <p className="text-xs text-[#5b6b86] dark:text-[#9fb0cc]">
                  {learnerTab === 'dashboard'
                    ? `Exam window: ${profile.examStart} to ${profile.examEnd} · Opportunities matched automatically`
                    : `${opportunities.length} curated opportunities · ${profile.skills.length} skills active · ${profile.resumes.length} resumes ready`}
                </p>
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={
                isLearner
                  ? `l-${learnerTab}`
                  : isFaculty
                  ? `f-${facultyTab}`
                  : `o-${organizerTab}`
              }
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            >
              {isLearner ? (
                <>
                  {learnerTab === 'dashboard' && (
                    <LearnerDashboard
                      user={user}
                      profile={profile}
                      opportunities={opportunities}
                      applications={applications}
                      courses={COURSE_RESOURCES}
                      nocRequests={nocRequests}
                      parentConsents={parentConsents}
                      nocCount={
                        nocRequests.filter(
                          (n) =>
                            n.studentEmail.trim().toLowerCase() === user.email.trim().toLowerCase() ||
                            n.studentName.trim().toLowerCase() ===
                              (profile.name || user.name).trim().toLowerCase()
                        ).length
                      }
                      approvedNocCount={
                        nocRequests.filter(
                          (n) =>
                            (n.studentEmail.trim().toLowerCase() ===
                              user.email.trim().toLowerCase() ||
                              n.studentName.trim().toLowerCase() ===
                                (profile.name || user.name).trim().toLowerCase()) &&
                            n.status === 'Approved'
                        ).length
                      }
                      parentConsentCount={
                        parentConsents.filter(
                          (c) =>
                            c.studentEmail.trim().toLowerCase() === user.email.trim().toLowerCase() ||
                            c.studentName.trim().toLowerCase() ===
                              (profile.name || user.name).trim().toLowerCase()
                        ).length
                      }
                      onNavigate={setLearnerTab}
                      onApply={handleApply}
                      onUploadResume={handleUploadResume}
                      onLaunchAiPrompt={(prompt) => {
                        setAiInitialPrompt(prompt);
                        setAiOpen(true);
                      }}
                      onOpenPersonalization={() => setShowPersonalization(true)}
                    />
                  )}

                  {learnerTab === 'hub' && (
                    <OpportunityHub
                      opportunities={opportunities}
                      profile={profile}
                      applications={applications}
                      nocRequests={nocRequests}
                      parentConsents={parentConsents}
                      userEmail={user.email}
                      initialSearch={hubInitialSearch}
                      onApply={handleApply}
                      onRefreshHub={handleRefreshOpportunityHub}
                      isSyncingHub={isSyncingHub}
                    />
                  )}

                  {learnerTab === 'applications' && (
                    <ApplicationTracker
                      applications={applications}
                      resumes={profile.resumes}
                      defaultResumeName={profile.resumeName}
                      leaveRequests={leaveRequests}
                      nocRequests={nocRequests}
                      parentConsents={parentConsents}
                      userEmail={user.email}
                      userName={profile.name || user.name}
                      onUpdateStage={handleUpdateStage}
                      onUpdateApplicationResume={handleUpdateApplicationResume}
                      onAttachDocsToApplication={handleAttachDocsToApplication}
                      onAddResume={handleAddResume}
                      onSetDefaultResume={handleSetDefaultResume}
                      onDeleteResume={handleDeleteResume}
                      onSubmitLeaveRequest={handleSubmitLeaveRequest}
                      onAddExternalApplication={handleAddExternalApplication}
                    />
                  )}

                  {learnerTab === 'approvals' && (
                    <StudentApprovalsView
                      profile={profile}
                      userEmail={user.email}
                      userName={profile.name || user.name}
                      opportunities={opportunities}
                      applications={applications}
                      nocRequests={nocRequests}
                      parentConsents={parentConsents}
                      leaveRequests={leaveRequests}
                      onSubmitNocRequest={handleSubmitNocRequest}
                      onSubmitParentConsent={handleSubmitParentConsent}
                    />
                  )}

                  {learnerTab === 'skills' && (
                    <SkillsView
                      opportunities={opportunities}
                      profile={profile}
                      courses={COURSE_RESOURCES}
                      onAddSkill={handleAddSkill}
                      onLaunchAiPrompt={(prompt) => {
                        setAiInitialPrompt(prompt);
                        setAiOpen(true);
                      }}
                    />
                  )}

                  {learnerTab === 'profile' && (
                    <ProfileView
                      profile={profile}
                      opportunities={opportunities}
                      userEmail={user.email}
                      onSaveProfile={(updated) => {
                        setProfile(updated);
                        if (firebaseUser) {
                          void saveUserProfile(firebaseUser.uid, updated);
                        }
                        logActivity(
                          'profile_update',
                          'Updated Student Profile & Exam Window',
                          `Sem ${updated.semester} · ${updated.skills.length} skills · Exams ${updated.examStart}–${updated.examEnd}`,
                          'learner'
                        );
                        showToast('Profile and exam schedule saved');
                      }}
                    />
                  )}
                </>
              ) : isFaculty ? (
                <FacultyWorkspace
                  activeTab={facultyTab}
                  user={user}
                  applications={applications}
                  leaveRequests={leaveRequests}
                  nocRequests={nocRequests}
                  parentConsents={parentConsents}
                  studentSchedules={studentSchedules}
                  onSignApplication={handleSignApplication}
                  onAttachDocsToApplication={handleAttachDocsToApplication}
                  onSignLeaveRequest={handleSignLeaveRequest}
                  onSignNocRequest={handleSignNocRequest}
                  onVerifyParentConsent={handleVerifyParentConsent}
                  onAddStudentSchedule={handleAddStudentSchedule}
                  onAddStudentEvent={handleAddStudentEvent}
                  onUpdateStudentTiming={handleUpdateStudentTiming}
                />
              ) : (
                <OrganizerWorkspace
                  activeTab={organizerTab}
                  user={user}
                  opportunities={opportunities}
                  applications={applications}
                  nocRequests={nocRequests}
                  parentConsents={parentConsents}
                  onPublishOpportunity={handlePublishOpportunity}
                  onUpdateApplicationStage={handleUpdateStage}
                  onConfirmApplicantForProgram={handleConfirmApplicantForProgram}
                  onNavigate={setOrganizerTab}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Standalone / Mobile App Bottom Tab Navigation */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-[#11192c]/95 backdrop-blur-md border-t border-[#dbe3f0] dark:border-[#24324d] px-2 py-1.5 flex items-center justify-around"
      >
        {isLearner
          ? learnerNav.map((item) => {
              const active = learnerTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setLearnerTab(item.id)}
                  className={`flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-xl text-[10px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'text-[#2f5bea] dark:text-[#7a9bff]'
                      : 'text-[#5b6b86] dark:text-[#9fb0cc]'
                  }`}
                >
                  {item.icon}
                  <span>{item.shortLabel}</span>
                </button>
              );
            })
          : isFaculty
          ? facultyNav.map((item) => {
              const active = facultyTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFacultyTab(item.id)}
                  className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-[10px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'text-[#2f5bea] dark:text-[#7a9bff]'
                      : 'text-[#5b6b86] dark:text-[#9fb0cc]'
                  }`}
                >
                  {item.icon}
                  <span>{item.shortLabel}</span>
                </button>
              );
            })
          : organizerNav.map((item) => {
              const active = organizerTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setOrganizerTab(item.id)}
                  className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-[10px] font-bold transition-colors cursor-pointer ${
                    active
                      ? 'text-[#2f5bea] dark:text-[#7a9bff]'
                      : 'text-[#5b6b86] dark:text-[#9fb0cc]'
                  }`}
                >
                  {item.icon}
                  <span>{item.shortLabel}</span>
                </button>
              );
            })}
      </nav>

      {/* Personalized AI Career Assistant Drawer */}
      <AiAssistantDrawer
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        user={user}
        profile={profile}
        opportunities={opportunities}
        applications={applications}
        initialPrompt={aiInitialPrompt}
        onConsumedInitialPrompt={() => setAiInitialPrompt(undefined)}
      />

      {/* New-Login Personalization & AI Recommendations Modal */}
      <PersonalizationModal
        open={showPersonalization}
        user={user}
        profile={profile}
        opportunities={opportunities}
        onClose={() => {
          setShowPersonalization(false);
          setUser((prev) => (prev ? { ...prev, onboardingCompleted: true } : prev));
          if (firebaseUser) {
            void updateUserAccountPrefs(firebaseUser.uid, { onboardingCompleted: true });
          }
        }}
        onComplete={handleCompletePersonalization}
      />

      {/* Multi-Role Login Info & Activity History Modal */}
      <ActivityHistoryModal
        open={showActivityModal}
        user={user}
        logs={activityLogs}
        onClose={() => setShowActivityModal(false)}
      />

      {/* Offline PWA Banner */}
      <OfflineIndicator />

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-20 lg:bottom-5 right-5 z-50 px-4 py-3 rounded-xl bg-[#12203a] dark:bg-[#2f5bea] text-white text-xs font-bold shadow-lg"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
