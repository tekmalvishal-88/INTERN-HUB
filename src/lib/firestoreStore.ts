import type { User as FirebaseUser } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import type {
  AiPersonalizationResult,
  ApplicationRecord,
  ApplicationStage,
  DigitalSignatureRecord,
  FacultyApplicationApproval,
  LeaveRequest,
  NocRequest,
  Opportunity,
  ParentConsentSheet,
  ProgramClearanceStatus,
  StudentEventItem,
  StudentProfile,
  StudentScheduleRecord,
  UserAccount,
  UserActivityLog,
  UserPersonalization,
  UserRole,
} from '../types';
import {
  INITIAL_APPLICATIONS,
  INITIAL_LEAVE_REQUESTS,
  INITIAL_NOC_REQUESTS,
  INITIAL_OPPORTUNITIES,
  INITIAL_PARENT_CONSENTS,
  INITIAL_PROFILE,
  INITIAL_STUDENT_SCHEDULES,
  offsetDate,
} from '../data/realData';
import { todayIso } from '../utils/matching';

function safeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return cleaned || `id_${Date.now()}`;
}

function clampStr(val: string | undefined | null, maxLen: number, fallback = ''): string {
  const s = (val ?? fallback).toString();
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function clampSem(val: number | undefined): number {
  const n = Math.round(Number(val) || 5);
  return Math.min(10, Math.max(1, n));
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      out[k] = v;
    }
  }
  return out as T;
}

function serializeFacultyApproval(
  approval?: FacultyApplicationApproval
): Record<string, unknown> | undefined {
  if (!approval) return undefined;
  const sig = approval.digitalSignature
    ? stripUndefined({
        signerName: clampStr(approval.digitalSignature.signerName, 120),
        signerDesignation: clampStr(approval.digitalSignature.signerDesignation, 140),
        signatureDataUrl: clampStr(approval.digitalSignature.signatureDataUrl, 250000),
        signedAt: clampStr(approval.digitalSignature.signedAt, 20),
        verificationCode: clampStr(approval.digitalSignature.verificationCode, 60),
        remarks: approval.digitalSignature.remarks
          ? clampStr(approval.digitalSignature.remarks, 500)
          : undefined,
      })
    : undefined;
  return stripUndefined({
    status: approval.status,
    programClearance: approval.programClearance,
    digitalSignature: sig,
  });
}

function serializeApplicationDetails(
  details?: ApplicationRecord['applicationDetails']
): Record<string, unknown> | undefined {
  if (!details) return undefined;
  return stripUndefined({
    fullName: clampStr(details.fullName, 120),
    email: clampStr(details.email, 200),
    rollNumber: clampStr(details.rollNumber, 40),
    branch: clampStr(details.branch, 120),
    semester: clampSem(details.semester),
    cgpa: clampStr(details.cgpa, 40),
    resumeUsed: clampStr(details.resumeUsed, 180),
    portfolioUrl: clampStr(details.portfolioUrl, 300),
    availability: clampStr(details.availability, 120),
    coverNote: clampStr(details.coverNote, 1000),
    attachedNocId: details.attachedNocId ? clampStr(details.attachedNocId, 128) : undefined,
    attachedNocNumber: details.attachedNocNumber
      ? clampStr(details.attachedNocNumber, 80)
      : undefined,
    attachedConsentId: details.attachedConsentId
      ? clampStr(details.attachedConsentId, 128)
      : undefined,
    attachedConsentCode: details.attachedConsentCode
      ? clampStr(details.attachedConsentCode, 80)
      : undefined,
    confirmedCriteria: Boolean(details.confirmedCriteria),
    confirmedExamCompliance: Boolean(details.confirmedExamCompliance),
    confirmedAuthenticity: Boolean(details.confirmedAuthenticity),
  });
}

function buildStarterProfileForUser(firebaseUser: FirebaseUser): StudentProfile {
  const email = (firebaseUser.email || 'student@campus.edu').toLowerCase();
  const displayName = firebaseUser.displayName?.trim() || email.split('@')[0] || 'InternHub Student';
  const isDefaultDemoUser = email === 'vishal.tekmal@ifheindia.org';

  if (isDefaultDemoUser) {
    return {
      ...INITIAL_PROFILE,
      name: displayName,
    };
  }

  const firstName = displayName.split(/\s+/)[0] || 'Student';
  return {
    name: displayName,
    headline: 'Undergraduate Student · Exploring Verified Internships & Hackathons',
    about:
      'Building production projects, tracking campus & industry internships, and aligning career applications with university exam schedules.',
    branch: 'Computer Science & Engineering',
    semester: 5,
    college: 'Campus Partner University',
    cgpa: '8.50 / 10',
    gradYear: '2027',
    location: 'Hyderabad, India',
    skills: ['Python', 'SQL', 'React', 'TypeScript', 'Git'],
    resumeName: `${firstName}_Resume_2026.pdf`,
    resumes: [
      {
        id: 'res-1',
        name: `${firstName}_Resume_2026.pdf`,
        targetRole: 'Full Stack & Software Engineering',
        updatedAt: offsetDate(-1),
        sizeLabel: '220 KB',
        isDefault: true,
      },
    ],
    projects: [],
    githubUrl: 'https://github.com',
    linkedinUrl: 'https://linkedin.com',
    portfolioUrl: 'https://internhub.app',
    examStart: offsetDate(15),
    examEnd: offsetDate(26),
    targetRole: 'Software & Data Internships',
  };
}

function serializeProfilePayload(
  uid: string,
  profile: StudentProfile,
  includeCreatedAt: boolean
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    ownerUid: uid,
    name: clampStr(profile.name, 120, 'Student'),
    headline: clampStr(profile.headline, 220),
    about: clampStr(profile.about, 1500),
    branch: clampStr(profile.branch, 120, 'CSE'),
    semester: clampSem(profile.semester),
    college: clampStr(profile.college, 160),
    cgpa: clampStr(profile.cgpa, 40),
    gradYear: clampStr(profile.gradYear, 16),
    location: clampStr(profile.location, 120),
    skills: (profile.skills || []).slice(0, 30).map((s) => clampStr(s, 60)).filter(Boolean),
    resumeName: clampStr(profile.resumeName, 180),
    resumes: (profile.resumes || []).slice(0, 15),
    projects: (profile.projects || []).slice(0, 20),
    githubUrl: clampStr(profile.githubUrl, 300),
    linkedinUrl: clampStr(profile.linkedinUrl, 300),
    portfolioUrl: clampStr(profile.portfolioUrl, 300),
    examStart: clampStr(profile.examStart, 20),
    examEnd: clampStr(profile.examEnd, 20),
    targetRole: clampStr(profile.targetRole, 140),
    updatedAt: serverTimestamp(),
  };
  if (includeCreatedAt) {
    base.createdAt = serverTimestamp();
  }
  return base;
}

function serializeOpportunityPayload(
  uid: string,
  opp: Opportunity,
  includeCreatedAt: boolean
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    title: clampStr(opp.title, 160, 'Software Intern'),
    company: clampStr(opp.company, 140, 'Tech Partner'),
    type: opp.type,
    domain: opp.domain,
    mode: opp.mode,
    location: clampStr(opp.location, 140, 'Remote'),
    stipend: Math.max(0, Number(opp.stipend) || 0),
    durationLabel: clampStr(opp.durationLabel, 80, '3 months'),
    deadline: clampStr(opp.deadline, 20, offsetDate(14)),
    startDate: clampStr(opp.startDate, 20, offsetDate(30)),
    endDate: clampStr(opp.endDate, 20, offsetDate(120)),
    skills: (opp.skills || ['TypeScript']).slice(0, 12).map((s) => clampStr(s, 50)).filter(Boolean),
    minSemester: clampSem(opp.minSemester),
    description: clampStr(opp.description, 1200, 'Verified internship opportunity.'),
    sourcePlatform: clampStr(opp.sourcePlatform, 120, 'InternHub Verified'),
    officialUrl: clampStr(opp.officialUrl, 400, 'https://internhub.app'),
    ownerOrg: clampStr(opp.ownerOrg, 140, opp.company),
    verified: true,
    createdByUid: uid,
    updatedAt: serverTimestamp(),
  };
  if (opp.stipendLabel) {
    payload.stipendLabel = clampStr(opp.stipendLabel, 80);
  }
  if (includeCreatedAt) {
    payload.createdAt = serverTimestamp();
  }
  return payload;
}

export async function ensureUserWorkspace(
  firebaseUser: FirebaseUser,
  preferredRole: UserRole = 'learner',
  darkMode = false
): Promise<{ account: UserAccount; darkMode: boolean; isNewWorkspace: boolean }> {
  const uid = safeId(firebaseUser.uid);
  const userRef = doc(db, 'users', uid);
  const nowIso = new Date().toISOString();

  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      const nextLoginCount = (Number(data.loginCount) || 0) + 1;
      await updateDoc(userRef, {
        lastLoginAt: nowIso,
        lastLoginMethod: 'google',
        loginCount: nextLoginCount,
        updatedAt: serverTimestamp(),
      });

      return {
        account: {
          id: uid,
          name: String(data.name || firebaseUser.displayName || 'InternHub User'),
          email: String(data.email || firebaseUser.email || ''),
          role: (data.activeRole as UserRole) || preferredRole,
          organization: data.organization ? String(data.organization) : undefined,
          designation: data.designation ? String(data.designation) : undefined,
          verified: Boolean(firebaseUser.emailVerified),
          lastLoginAt: nowIso,
          lastLoginMethod: 'google',
          loginCount: nextLoginCount,
          onboardingCompleted: Boolean(data.onboardingCompleted),
          personalization: (data.personalization as UserPersonalization | undefined) || undefined,
          aiSuggestions: (data.aiSuggestions as AiPersonalizationResult | undefined) || undefined,
        },
        darkMode: Boolean(data.darkMode),
        isNewWorkspace: false,
      };
    }

    const email = firebaseUser.email || 'user@internhub.app';
    const displayName = firebaseUser.displayName?.trim() || email.split('@')[0] || 'InternHub User';
    const isVishal = email.toLowerCase() === 'vishal.tekmal@ifheindia.org';
    const starterProfile = buildStarterProfileForUser(firebaseUser);

    await setDoc(userRef, {
      uid,
      name: clampStr(displayName, 120),
      email: clampStr(email, 200),
      activeRole: preferredRole,
      organization: preferredRole === 'organizer' ? 'Campus Partner' : 'IFHE Hyderabad',
      designation: preferredRole === 'faculty' ? 'Faculty Coordinator' : 'Student',
      darkMode: Boolean(darkMode),
      lastLoginAt: nowIso,
      lastLoginMethod: 'google',
      loginCount: 1,
      onboardingCompleted: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await setDoc(
      doc(db, 'users', uid, 'profile', 'main'),
      serializeProfilePayload(uid, starterProfile, true)
    );

    const batch = writeBatch(db);

    if (isVishal) {
      for (const appRec of INITIAL_APPLICATIONS) {
        const appId = safeId(appRec.id);
        const isSelfApp = appRec.applicantEmail.toLowerCase().includes('vishal');
        batch.set(
          doc(db, 'users', uid, 'applications', appId),
          stripUndefined({
            ownerUid: uid,
            opportunityId: clampStr(appRec.opportunityId, 128),
            company: clampStr(appRec.company, 140),
            roleTitle: clampStr(appRec.roleTitle, 160),
            location: clampStr(appRec.location, 120),
            applicantEmail: clampStr(isSelfApp ? email : appRec.applicantEmail, 200),
            applicantName: clampStr(isSelfApp ? displayName : appRec.applicantName, 120),
            applicantBranch: clampStr(appRec.applicantBranch || starterProfile.branch, 120),
            applicantSemester: clampSem(appRec.applicantSemester ?? starterProfile.semester),
            applicantSkills: (appRec.applicantSkills || starterProfile.skills).slice(0, 30),
            resumeUsed: clampStr(appRec.resumeUsed || starterProfile.resumeName, 180),
            stage: appRec.stage,
            appliedOn: clampStr(appRec.appliedOn, 20, todayIso()),
            nextAction: appRec.nextAction ? clampStr(appRec.nextAction, 300) : undefined,
            notes: appRec.notes ? clampStr(appRec.notes, 1000) : undefined,
            isExternal: Boolean(appRec.isExternal),
            applicationDetails: serializeApplicationDetails(appRec.applicationDetails),
            attachedNocId: appRec.attachedNocId ? clampStr(appRec.attachedNocId, 128) : undefined,
            attachedNocNumber: appRec.attachedNocNumber
              ? clampStr(appRec.attachedNocNumber, 80)
              : undefined,
            attachedConsentId: appRec.attachedConsentId
              ? clampStr(appRec.attachedConsentId, 128)
              : undefined,
            attachedConsentCode: appRec.attachedConsentCode
              ? clampStr(appRec.attachedConsentCode, 80)
              : undefined,
            facultyApproval: serializeFacultyApproval(appRec.facultyApproval),
            organizerConfirmedAllowed:
              typeof appRec.organizerConfirmedAllowed === 'boolean'
                ? appRec.organizerConfirmedAllowed
                : undefined,
            organizerConfirmedAt: appRec.organizerConfirmedAt
              ? clampStr(appRec.organizerConfirmedAt, 20)
              : undefined,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      }

      for (const lv of INITIAL_LEAVE_REQUESTS.filter((l) => l.status === 'Pending')) {
        const lvId = safeId(lv.id);
        const isSelf = lv.id === 'lv-1';
        batch.set(doc(db, 'users', uid, 'leaveRequests', lvId), {
          ownerUid: uid,
          studentName: clampStr(isSelf ? displayName : lv.studentName, 120),
          rollNumber: clampStr(lv.rollNumber, 40),
          studentEmail: clampStr(isSelf ? email : lv.studentEmail, 200),
          branch: clampStr(lv.branch, 120),
          semester: clampSem(lv.semester),
          leaveType: lv.leaveType,
          companyOrEvent: clampStr(lv.companyOrEvent, 180),
          startDate: clampStr(lv.startDate, 20),
          endDate: clampStr(lv.endDate, 20),
          timingNote: clampStr(lv.timingNote, 160),
          reason: clampStr(lv.reason, 1000),
          submittedOn: clampStr(lv.submittedOn, 20),
          status: 'Pending',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      for (const noc of INITIAL_NOC_REQUESTS.filter((n) => n.status === 'Pending')) {
        const nocId = safeId(noc.id);
        const isSelf = noc.id === 'noc-1';
        batch.set(
          doc(db, 'users', uid, 'nocRequests', nocId),
          stripUndefined({
            ownerUid: uid,
            nocNumber: clampStr(noc.nocNumber, 80),
            studentName: clampStr(isSelf ? displayName : noc.studentName, 120),
            rollNumber: clampStr(noc.rollNumber, 40),
            studentEmail: clampStr(isSelf ? email : noc.studentEmail, 200),
            branch: clampStr(noc.branch, 120),
            semester: clampSem(noc.semester),
            companyName: clampStr(noc.companyName, 160),
            roleTitle: clampStr(noc.roleTitle, 160),
            workMode: noc.workMode,
            location: clampStr(noc.location, 120),
            stipendLabel: clampStr(noc.stipendLabel, 80),
            internshipStart: clampStr(noc.internshipStart, 20),
            internshipEnd: clampStr(noc.internshipEnd, 20),
            dailyTiming: clampStr(noc.dailyTiming, 140),
            hrContactName: clampStr(noc.hrContactName, 120),
            hrContactEmail: clampStr(noc.hrContactEmail, 200),
            offerLetterName: noc.offerLetterName ? clampStr(noc.offerLetterName, 180) : undefined,
            parentConsentId: noc.parentConsentId ? clampStr(noc.parentConsentId, 128) : undefined,
            parentSigned: Boolean(noc.parentSigned),
            academicRemarks: noc.academicRemarks ? clampStr(noc.academicRemarks, 600) : undefined,
            submittedOn: clampStr(noc.submittedOn, 20),
            status: 'Pending',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      }

      for (const pc of INITIAL_PARENT_CONSENTS) {
        const pcId = safeId(pc.id);
        const isSelf = pc.id === 'pc-1';
        batch.set(doc(db, 'users', uid, 'parentConsents', pcId), {
          ownerUid: uid,
          consentCode: clampStr(pc.consentCode, 80),
          studentName: clampStr(isSelf ? displayName : pc.studentName, 120),
          rollNumber: clampStr(pc.rollNumber, 40),
          studentEmail: clampStr(isSelf ? email : pc.studentEmail, 200),
          branch: clampStr(pc.branch, 120),
          semester: clampSem(pc.semester),
          parentName: clampStr(pc.parentName, 120),
          relationship: pc.relationship,
          parentPhone: clampStr(pc.parentPhone, 40),
          parentEmail: clampStr(pc.parentEmail, 200),
          emergencyContact: clampStr(pc.emergencyContact, 40),
          companyOrEvent: clampStr(pc.companyOrEvent, 180),
          internshipLocation: clampStr(pc.internshipLocation, 140),
          workMode: pc.workMode,
          startDate: clampStr(pc.startDate, 20),
          endDate: clampStr(pc.endDate, 20),
          travelAndStayConfirmed: Boolean(pc.travelAndStayConfirmed),
          medicalInsuranceConfirmed: Boolean(pc.medicalInsuranceConfirmed),
          academicAttendanceUnderstood: Boolean(pc.academicAttendanceUnderstood),
          parentSignatureDataUrl: clampStr(pc.parentSignatureDataUrl, 250000),
          signedOn: clampStr(pc.signedOn, 20),
          facultyVerified: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      for (const stu of INITIAL_STUDENT_SCHEDULES) {
        const stuId = safeId(stu.id);
        batch.set(doc(db, 'users', uid, 'studentSchedules', stuId), {
          ownerUid: uid,
          studentName: clampStr(stu.studentName, 120),
          rollNumber: clampStr(stu.rollNumber, 40),
          email: clampStr(stu.email, 200),
          branch: clampStr(stu.branch, 120),
          semester: clampSem(stu.semester),
          internshipCompany: clampStr(stu.internshipCompany, 140),
          internshipRole: clampStr(stu.internshipRole, 160),
          internshipTiming: clampStr(stu.internshipTiming, 160),
          internshipStart: clampStr(stu.internshipStart, 20),
          internshipEnd: clampStr(stu.internshipEnd, 20),
          upcomingEvent: clampStr(stu.upcomingEvent, 180),
          eventDate: clampStr(stu.eventDate, 20),
          eventTiming: clampStr(stu.eventTiming, 120),
          extraEvents: (stu.extraEvents || []).slice(0, 20),
          examWindow: clampStr(stu.examWindow, 120),
          attendanceStatus: stu.attendanceStatus,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } else {
      // Unique, isolated clean workspace tailored specifically for this user
      const myRoll = `23IH${uid.slice(0, 4).toUpperCase()}`;
      batch.set(doc(db, 'users', uid, 'studentSchedules', 'stu-self'), {
        ownerUid: uid,
        studentName: clampStr(displayName, 120),
        rollNumber: myRoll,
        email: clampStr(email, 200),
        branch: clampStr(starterProfile.branch, 120),
        semester: clampSem(starterProfile.semester),
        internshipCompany: 'Searching in Opportunity Hub',
        internshipRole: 'Target Software / Data Intern',
        internshipTiming: 'Flexible / Post-Exams',
        internshipStart: offsetDate(30),
        internshipEnd: offsetDate(120),
        upcomingEvent: 'Semester End Exams',
        eventDate: starterProfile.examStart,
        eventTiming: '10:00 AM – 01:00 PM',
        extraEvents: [],
        examWindow: `${starterProfile.examStart} to ${starterProfile.examEnd}`,
        attendanceStatus: 'On Track',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();

    return {
      account: {
        id: uid,
        name: displayName,
        email,
        role: preferredRole,
        organization: preferredRole === 'organizer' ? 'Campus Partner' : 'IFHE Hyderabad',
        designation: preferredRole === 'faculty' ? 'Faculty Coordinator' : 'Student',
        verified: Boolean(firebaseUser.emailVerified),
        lastLoginAt: nowIso,
        lastLoginMethod: 'google',
        loginCount: 1,
        onboardingCompleted: false,
      },
      darkMode,
      isNewWorkspace: true,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
  }
}

export async function updateUserAccountPrefs(
  uid: string,
  updates: Partial<{
    activeRole: UserRole;
    darkMode: boolean;
    name: string;
    onboardingCompleted: boolean;
  }>
): Promise<void> {
  const safeUid = safeId(uid);
  const path = `users/${safeUid}`;
  try {
    await updateDoc(doc(db, 'users', safeUid), {
      ...stripUndefined(updates as Record<string, unknown>),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function saveUserPersonalization(
  uid: string,
  personalization: UserPersonalization,
  aiSuggestions: AiPersonalizationResult
): Promise<void> {
  const safeUid = safeId(uid);
  const path = `users/${safeUid}`;
  try {
    await updateDoc(doc(db, 'users', safeUid), {
      personalization: stripUndefined({
        preferredDomains: (personalization.preferredDomains || []).slice(0, 6),
        preferredModes: (personalization.preferredModes || []).slice(0, 4),
        preferredLocations: (personalization.preferredLocations || []).slice(0, 8),
        minStipend: Math.max(0, Number(personalization.minStipend) || 0),
        careerGoal: clampStr(personalization.careerGoal, 300),
        examSafeOnly: Boolean(personalization.examSafeOnly),
        facultyDepartment: personalization.facultyDepartment
          ? clampStr(personalization.facultyDepartment, 120)
          : undefined,
        facultyFocus: personalization.facultyFocus
          ? clampStr(personalization.facultyFocus, 180)
          : undefined,
        organizerCompany: personalization.organizerCompany
          ? clampStr(personalization.organizerCompany, 140)
          : undefined,
        organizerHiringDomains: personalization.organizerHiringDomains
          ? personalization.organizerHiringDomains.slice(0, 6)
          : undefined,
      }),
      aiSuggestions: {
        summary: clampStr(aiSuggestions.summary, 600),
        skillAdvice: (aiSuggestions.skillAdvice || []).slice(0, 5).map((s) => clampStr(s, 80)),
        recommendations: (aiSuggestions.recommendations || []).slice(0, 4).map((r) => ({
          opportunityId: clampStr(r.opportunityId, 128),
          fitTag: clampStr(r.fitTag, 60),
          reason: clampStr(r.reason, 260),
        })),
        generatedAt: clampStr(aiSuggestions.generatedAt, 40),
      },
      onboardingCompleted: true,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function appendUserActivityLog(
  uid: string,
  log: Omit<UserActivityLog, 'id'>
): Promise<void> {
  const safeUid = safeId(uid);
  const logId = safeId(`act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const path = `users/${safeUid}/activityLogs/${logId}`;
  try {
    await setDoc(doc(db, 'users', safeUid, 'activityLogs', logId), {
      ownerUid: safeUid,
      role: log.role,
      actionType: clampStr(log.actionType, 48),
      title: clampStr(log.title, 160),
      details: clampStr(log.details, 400),
      deviceSummary: clampStr(log.deviceSummary, 140),
      occurredAt: clampStr(log.occurredAt, 40),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function saveUserProfile(uid: string, profile: StudentProfile): Promise<void> {
  const safeUid = safeId(uid);
  const path = `users/${safeUid}/profile/main`;
  try {
    const ref = doc(db, 'users', safeUid, 'profile', 'main');
    const existing = await getDoc(ref);
    if (existing.exists()) {
      const payload = serializeProfilePayload(safeUid, profile, false);
      delete payload.ownerUid;
      await updateDoc(ref, payload);
    } else {
      await setDoc(ref, serializeProfilePayload(safeUid, profile, true));
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function saveUserApplication(uid: string, appRec: ApplicationRecord): Promise<void> {
  const safeUid = safeId(uid);
  const appId = safeId(appRec.id);
  const path = `users/${safeUid}/applications/${appId}`;
  try {
    const cleanDetails = serializeApplicationDetails(appRec.applicationDetails);
    const cleanApproval = serializeFacultyApproval(appRec.facultyApproval);

    await setDoc(
      doc(db, 'users', safeUid, 'applications', appId),
      stripUndefined({
        ownerUid: safeUid,
        opportunityId: clampStr(appRec.opportunityId, 128),
        company: clampStr(appRec.company, 140),
        roleTitle: clampStr(appRec.roleTitle, 160),
        location: clampStr(appRec.location, 120),
        applicantEmail: clampStr(appRec.applicantEmail, 200),
        applicantName: clampStr(appRec.applicantName, 120),
        applicantBranch: appRec.applicantBranch ? clampStr(appRec.applicantBranch, 120) : undefined,
        applicantSemester: appRec.applicantSemester ? clampSem(appRec.applicantSemester) : undefined,
        applicantSkills: appRec.applicantSkills ? appRec.applicantSkills.slice(0, 30) : undefined,
        resumeUsed: appRec.resumeUsed ? clampStr(appRec.resumeUsed, 180) : undefined,
        stage: appRec.stage,
        appliedOn: clampStr(appRec.appliedOn, 20, todayIso()),
        nextAction: appRec.nextAction ? clampStr(appRec.nextAction, 300) : undefined,
        notes: appRec.notes ? clampStr(appRec.notes, 1000) : undefined,
        isExternal: Boolean(appRec.isExternal),
        applicationDetails: cleanDetails,
        attachedNocId: appRec.attachedNocId ? clampStr(appRec.attachedNocId, 128) : undefined,
        attachedNocNumber: appRec.attachedNocNumber
          ? clampStr(appRec.attachedNocNumber, 80)
          : undefined,
        attachedConsentId: appRec.attachedConsentId
          ? clampStr(appRec.attachedConsentId, 128)
          : undefined,
        attachedConsentCode: appRec.attachedConsentCode
          ? clampStr(appRec.attachedConsentCode, 80)
          : undefined,
        facultyApproval: cleanApproval,
        organizerConfirmedAllowed:
          typeof appRec.organizerConfirmedAllowed === 'boolean'
            ? appRec.organizerConfirmedAllowed
            : undefined,
        organizerConfirmedAt: appRec.organizerConfirmedAt
          ? clampStr(appRec.organizerConfirmedAt, 20)
          : undefined,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateUserApplication(
  uid: string,
  appId: string,
  updates: Partial<{
    stage: ApplicationStage;
    resumeUsed: string;
    nextAction: string;
    notes: string;
    attachedNocId: string;
    attachedNocNumber: string;
    attachedConsentId: string;
    attachedConsentCode: string;
    facultyApproval: FacultyApplicationApproval;
    organizerConfirmedAllowed: boolean;
    organizerConfirmedAt: string;
  }>
): Promise<void> {
  const safeUid = safeId(uid);
  const id = safeId(appId);
  const path = `users/${safeUid}/applications/${id}`;
  try {
    const cleanUpdates = stripUndefined({
      ...updates,
      attachedNocId:
        updates.attachedNocId !== undefined ? clampStr(updates.attachedNocId, 128) : undefined,
      attachedNocNumber:
        updates.attachedNocNumber !== undefined
          ? clampStr(updates.attachedNocNumber, 80)
          : undefined,
      attachedConsentId:
        updates.attachedConsentId !== undefined
          ? clampStr(updates.attachedConsentId, 128)
          : undefined,
      attachedConsentCode:
        updates.attachedConsentCode !== undefined
          ? clampStr(updates.attachedConsentCode, 80)
          : undefined,
      facultyApproval:
        updates.facultyApproval !== undefined
          ? serializeFacultyApproval(updates.facultyApproval)
          : undefined,
      organizerConfirmedAt:
        updates.organizerConfirmedAt !== undefined
          ? clampStr(updates.organizerConfirmedAt, 20)
          : undefined,
    } as Record<string, unknown>);

    await updateDoc(doc(db, 'users', safeUid, 'applications', id), {
      ...cleanUpdates,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function createUserLeaveRequest(uid: string, leave: LeaveRequest): Promise<void> {
  const safeUid = safeId(uid);
  const id = safeId(leave.id);
  const path = `users/${safeUid}/leaveRequests/${id}`;
  try {
    await setDoc(doc(db, 'users', safeUid, 'leaveRequests', id), {
      ownerUid: safeUid,
      studentName: clampStr(leave.studentName, 120),
      rollNumber: clampStr(leave.rollNumber, 40),
      studentEmail: clampStr(leave.studentEmail, 200),
      branch: clampStr(leave.branch, 120),
      semester: clampSem(leave.semester),
      leaveType: leave.leaveType,
      companyOrEvent: clampStr(leave.companyOrEvent, 180),
      startDate: clampStr(leave.startDate, 20),
      endDate: clampStr(leave.endDate, 20),
      timingNote: clampStr(leave.timingNote, 160),
      reason: clampStr(leave.reason, 1000),
      submittedOn: clampStr(leave.submittedOn, 20),
      status: 'Pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function signUserLeaveRequest(
  uid: string,
  leaveId: string,
  decision: 'Approved' | 'Rejected',
  digitalSignature: DigitalSignatureRecord
): Promise<void> {
  const safeUid = safeId(uid);
  const id = safeId(leaveId);
  const path = `users/${safeUid}/leaveRequests/${id}`;
  try {
    await updateDoc(doc(db, 'users', safeUid, 'leaveRequests', id), {
      status: decision,
      digitalSignature,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function createUserNocRequest(uid: string, noc: NocRequest): Promise<void> {
  const safeUid = safeId(uid);
  const id = safeId(noc.id);
  const path = `users/${safeUid}/nocRequests/${id}`;
  try {
    await setDoc(
      doc(db, 'users', safeUid, 'nocRequests', id),
      stripUndefined({
        ownerUid: safeUid,
        nocNumber: clampStr(noc.nocNumber, 80),
        studentName: clampStr(noc.studentName, 120),
        rollNumber: clampStr(noc.rollNumber, 40),
        studentEmail: clampStr(noc.studentEmail, 200),
        branch: clampStr(noc.branch, 120),
        semester: clampSem(noc.semester),
        companyName: clampStr(noc.companyName, 160),
        roleTitle: clampStr(noc.roleTitle, 160),
        workMode: noc.workMode,
        location: clampStr(noc.location, 120),
        stipendLabel: clampStr(noc.stipendLabel, 80),
        internshipStart: clampStr(noc.internshipStart, 20),
        internshipEnd: clampStr(noc.internshipEnd, 20),
        dailyTiming: clampStr(noc.dailyTiming, 140),
        hrContactName: clampStr(noc.hrContactName, 120),
        hrContactEmail: clampStr(noc.hrContactEmail, 200),
        offerLetterName: noc.offerLetterName ? clampStr(noc.offerLetterName, 180) : undefined,
        parentConsentId: noc.parentConsentId ? clampStr(noc.parentConsentId, 128) : undefined,
        parentSigned: Boolean(noc.parentSigned),
        academicRemarks: noc.academicRemarks ? clampStr(noc.academicRemarks, 600) : undefined,
        submittedOn: clampStr(noc.submittedOn, 20),
        status: 'Pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function signUserNocRequest(
  uid: string,
  nocId: string,
  decision: 'Approved' | 'Rejected',
  facultySignature: DigitalSignatureRecord
): Promise<void> {
  const safeUid = safeId(uid);
  const id = safeId(nocId);
  const path = `users/${safeUid}/nocRequests/${id}`;
  try {
    await updateDoc(doc(db, 'users', safeUid, 'nocRequests', id), {
      status: decision,
      facultySignature,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function createUserParentConsent(
  uid: string,
  consent: ParentConsentSheet
): Promise<void> {
  const safeUid = safeId(uid);
  const id = safeId(consent.id);
  const path = `users/${safeUid}/parentConsents/${id}`;
  try {
    await setDoc(doc(db, 'users', safeUid, 'parentConsents', id), {
      ownerUid: safeUid,
      consentCode: clampStr(consent.consentCode, 80),
      studentName: clampStr(consent.studentName, 120),
      rollNumber: clampStr(consent.rollNumber, 40),
      studentEmail: clampStr(consent.studentEmail, 200),
      branch: clampStr(consent.branch, 120),
      semester: clampSem(consent.semester),
      parentName: clampStr(consent.parentName, 120),
      relationship: consent.relationship,
      parentPhone: clampStr(consent.parentPhone, 40),
      parentEmail: clampStr(consent.parentEmail, 200),
      emergencyContact: clampStr(consent.emergencyContact, 40),
      companyOrEvent: clampStr(consent.companyOrEvent, 180),
      internshipLocation: clampStr(consent.internshipLocation, 140),
      workMode: consent.workMode,
      startDate: clampStr(consent.startDate, 20),
      endDate: clampStr(consent.endDate, 20),
      travelAndStayConfirmed: Boolean(consent.travelAndStayConfirmed),
      medicalInsuranceConfirmed: Boolean(consent.medicalInsuranceConfirmed),
      academicAttendanceUnderstood: Boolean(consent.academicAttendanceUnderstood),
      parentSignatureDataUrl: clampStr(consent.parentSignatureDataUrl, 250000),
      signedOn: clampStr(consent.signedOn, 20),
      facultyVerified: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function verifyUserParentConsent(
  uid: string,
  consentId: string,
  verifiedBy: string
): Promise<void> {
  const safeUid = safeId(uid);
  const id = safeId(consentId);
  const path = `users/${safeUid}/parentConsents/${id}`;
  try {
    await updateDoc(doc(db, 'users', safeUid, 'parentConsents', id), {
      facultyVerified: true,
      verifiedBy: clampStr(verifiedBy, 120),
      verifiedOn: todayIso(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function createUserStudentSchedule(
  uid: string,
  stu: StudentScheduleRecord
): Promise<void> {
  const safeUid = safeId(uid);
  const id = safeId(stu.id);
  const path = `users/${safeUid}/studentSchedules/${id}`;
  try {
    await setDoc(doc(db, 'users', safeUid, 'studentSchedules', id), {
      ownerUid: safeUid,
      studentName: clampStr(stu.studentName, 120),
      rollNumber: clampStr(stu.rollNumber, 40),
      email: clampStr(stu.email, 200),
      branch: clampStr(stu.branch, 120),
      semester: clampSem(stu.semester),
      internshipCompany: clampStr(stu.internshipCompany, 140),
      internshipRole: clampStr(stu.internshipRole, 160),
      internshipTiming: clampStr(stu.internshipTiming, 160),
      internshipStart: clampStr(stu.internshipStart, 20),
      internshipEnd: clampStr(stu.internshipEnd, 20),
      upcomingEvent: clampStr(stu.upcomingEvent, 180),
      eventDate: clampStr(stu.eventDate, 20),
      eventTiming: clampStr(stu.eventTiming, 120),
      extraEvents: (stu.extraEvents || []).slice(0, 20),
      examWindow: clampStr(stu.examWindow, 120),
      attendanceStatus: stu.attendanceStatus,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateUserStudentSchedule(
  uid: string,
  scheduleId: string,
  updates: Partial<{
    internshipCompany: string;
    internshipRole: string;
    internshipTiming: string;
    internshipStart: string;
    internshipEnd: string;
    extraEvents: StudentEventItem[];
  }>
): Promise<void> {
  const safeUid = safeId(uid);
  const id = safeId(scheduleId);
  const path = `users/${safeUid}/studentSchedules/${id}`;
  try {
    await updateDoc(doc(db, 'users', safeUid, 'studentSchedules', id), {
      ...stripUndefined(updates as Record<string, unknown>),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

// --- Shared Live-Updating Opportunity Hub ---
export async function seedOpportunitiesIfEmpty(uid: string): Promise<void> {
  const safeUid = safeId(uid);
  const oppQuery = query(
    collection(db, 'opportunities'),
    where('verified', '==', true),
    limit(1)
  );
  try {
    const snap = await getDocs(oppQuery);
    if (!snap.empty) return;

    const chunkSize = 40;
    for (let i = 0; i < INITIAL_OPPORTUNITIES.length; i += chunkSize) {
      const slice = INITIAL_OPPORTUNITIES.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const opp of slice) {
        const oppId = safeId(opp.id);
        batch.set(
          doc(db, 'opportunities', oppId),
          serializeOpportunityPayload(safeUid, opp, true)
        );
      }
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'opportunities');
  }
}

export async function publishOpportunityToHub(uid: string, opp: Opportunity): Promise<void> {
  const safeUid = safeId(uid);
  const oppId = safeId(opp.id);
  const oppRef = doc(db, 'opportunities', oppId);
  const path = `opportunities/${oppId}`;
  try {
    const existingSnap = await getDoc(oppRef);
    if (!existingSnap.exists()) {
      await setDoc(oppRef, serializeOpportunityPayload(safeUid, opp, true));
    } else if (existingSnap.data().createdByUid === safeUid) {
      const updatePayload = serializeOpportunityPayload(safeUid, opp, false);
      delete updatePayload.createdByUid;
      await updateDoc(oppRef, updatePayload);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

const LIVE_HUB_DROPS: Array<Omit<Opportunity, 'deadline' | 'startDate' | 'endDate'> & { offsetDeadline: number; offsetStart: number; offsetEnd: number }> = [
  {
    id: 'live-drop-google-swe-2026',
    title: 'STEP & Software Engineering Intern',
    company: 'Google India',
    type: 'Internship',
    domain: 'Software',
    mode: 'Hybrid',
    location: 'Hyderabad / Bengaluru',
    stipend: 90000,
    stipendLabel: '₹90,000 / mo',
    durationLabel: '12 weeks',
    offsetDeadline: 12,
    offsetStart: 36,
    offsetEnd: 120,
    skills: ['Python', 'TypeScript', 'Data Structures', 'SQL'],
    minSemester: 4,
    description: 'Live campus update: Build scalable backend & full-stack tooling with Google Cloud & Search teams.',
    sourcePlatform: 'Google Careers Live',
    officialUrl: 'https://buildyourfuture.withgoogle.com/internships',
    ownerOrg: 'Google India',
    verified: true,
  },
  {
    id: 'live-drop-nvidia-ai-2026',
    title: 'Deep Learning & Systems Intern',
    company: 'NVIDIA',
    type: 'Internship',
    domain: 'Data',
    mode: 'On-site',
    location: 'Pune / Bengaluru',
    stipend: 85000,
    stipendLabel: '₹85,000 / mo',
    durationLabel: '6 months',
    offsetDeadline: 16,
    offsetStart: 40,
    offsetEnd: 210,
    skills: ['Python', 'Machine Learning', 'CUDA', 'PyTorch'],
    minSemester: 5,
    description: 'Live campus update: Optimize inference pipelines and GPU telemetry workflows with NVIDIA research engineers.',
    sourcePlatform: 'NVIDIA University Portal',
    officialUrl: 'https://www.nvidia.com/en-in/about-nvidia/careers/university-recruiting/',
    ownerOrg: 'NVIDIA India',
    verified: true,
  },
  {
    id: 'live-drop-ethindia-hack-2026',
    title: 'National AI & Cloud Innovation Hackathon',
    company: 'Microsoft & GitHub India',
    type: 'Hackathon',
    domain: 'Software',
    mode: 'Hybrid',
    location: 'Hyderabad Campus / Remote',
    stipend: 150000,
    stipendLabel: '₹1.5L Prize Pool',
    durationLabel: '48 hours',
    offsetDeadline: 5,
    offsetStart: 14,
    offsetEnd: 16,
    skills: ['React', 'TypeScript', 'APIs', 'Python'],
    minSemester: 2,
    description: 'Live event sync: Build production full-stack AI workflows and win fast-track summer internship interviews.',
    sourcePlatform: 'Devfolio Live',
    officialUrl: 'https://devfolio.co/hackathons',
    ownerOrg: 'Microsoft India',
    verified: true,
  },
];

export async function syncLiveOpportunityHub(
  uid: string,
  _currentOpportunities: Opportunity[] = []
): Promise<number> {
  const safeUid = safeId(uid);
  const today = todayIso();
  let updatedCount = 0;

  try {
    for (const drop of LIVE_HUB_DROPS) {
      const opp: Opportunity = {
        id: drop.id,
        title: drop.title,
        company: drop.company,
        type: drop.type,
        domain: drop.domain,
        mode: drop.mode,
        location: drop.location,
        stipend: drop.stipend,
        stipendLabel: drop.stipendLabel,
        durationLabel: drop.durationLabel,
        deadline: offsetDate(drop.offsetDeadline),
        startDate: offsetDate(drop.offsetStart),
        endDate: offsetDate(drop.offsetEnd),
        skills: drop.skills,
        minSemester: drop.minSemester,
        description: drop.description,
        sourcePlatform: drop.sourcePlatform,
        officialUrl: drop.officialUrl,
        ownerOrg: drop.ownerOrg,
        verified: true,
      };

      const oppRef = doc(db, 'opportunities', safeId(opp.id));
      const existingSnap = await getDoc(oppRef);

      if (!existingSnap.exists()) {
        await setDoc(oppRef, serializeOpportunityPayload(safeUid, opp, true));
        updatedCount += 1;
      } else {
        const existingData = existingSnap.data();
        if (
          existingData.createdByUid === safeUid &&
          String(existingData.deadline || '') < today
        ) {
          await updateDoc(oppRef, {
            deadline: opp.deadline,
            updatedAt: serverTimestamp(),
          });
          updatedCount += 1;
        }
      }
    }

    // Refresh deadlines on any expired opportunities originally created by this user
    const myOppsQuery = query(
      collection(db, 'opportunities'),
      where('verified', '==', true),
      where('createdByUid', '==', safeUid)
    );
    const myOppsSnap = await getDocs(myOppsQuery);
    for (const docSnap of myOppsSnap.docs) {
      const data = docSnap.data();
      if (String(data.deadline || '') < today) {
        await updateDoc(docSnap.ref, {
          deadline: offsetDate(18),
          updatedAt: serverTimestamp(),
        });
        updatedCount += 1;
      }
    }

    return updatedCount;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'opportunities');
  }
}

export function subscribeToUserWorkspace(
  uid: string,
  callbacks: {
    onAccountMeta?: (meta: Partial<UserAccount>) => void;
    onProfile: (profile: StudentProfile) => void;
    onApplications: (apps: ApplicationRecord[]) => void;
    onLeaves: (leaves: LeaveRequest[]) => void;
    onNocs: (nocs: NocRequest[]) => void;
    onParentConsents: (sheets: ParentConsentSheet[]) => void;
    onSchedules: (schedules: StudentScheduleRecord[]) => void;
    onActivityLogs?: (logs: UserActivityLog[]) => void;
  },
  onError?: (err: Error) => void
): Unsubscribe {
  const safeUid = safeId(uid);
  const unsubs: Unsubscribe[] = [];

  const forwardErr = (err: unknown, op: OperationType, path: string) => {
    try {
      handleFirestoreError(err, op, path);
    } catch (wrapped) {
      if (onError && wrapped instanceof Error) {
        onError(wrapped);
      }
    }
  };

  if (callbacks.onAccountMeta) {
    const onAccountMeta = callbacks.onAccountMeta;
    unsubs.push(
      onSnapshot(
        doc(db, 'users', safeUid),
        (snap) => {
          if (snap.exists()) {
            const d = snap.data();
            onAccountMeta({
              lastLoginAt: d.lastLoginAt ? String(d.lastLoginAt) : undefined,
              lastLoginMethod: (d.lastLoginMethod as 'google' | 'local') || undefined,
              loginCount: typeof d.loginCount === 'number' ? d.loginCount : undefined,
              onboardingCompleted: Boolean(d.onboardingCompleted),
              personalization: (d.personalization as UserPersonalization | undefined) || undefined,
              aiSuggestions: (d.aiSuggestions as AiPersonalizationResult | undefined) || undefined,
            });
          }
        },
        (err) => forwardErr(err, OperationType.GET, `users/${safeUid}`)
      )
    );
  }

  unsubs.push(
    onSnapshot(
      doc(db, 'users', safeUid, 'profile', 'main'),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          callbacks.onProfile({
            name: String(d.name || ''),
            headline: String(d.headline || ''),
            about: String(d.about || ''),
            branch: String(d.branch || 'CSE'),
            semester: Number(d.semester) || 5,
            college: String(d.college || ''),
            cgpa: String(d.cgpa || ''),
            gradYear: String(d.gradYear || ''),
            location: String(d.location || ''),
            skills: Array.isArray(d.skills) ? d.skills : [],
            resumeName: String(d.resumeName || ''),
            resumes: Array.isArray(d.resumes) ? d.resumes : [],
            projects: Array.isArray(d.projects) ? d.projects : [],
            githubUrl: String(d.githubUrl || ''),
            linkedinUrl: String(d.linkedinUrl || ''),
            portfolioUrl: String(d.portfolioUrl || ''),
            examStart: String(d.examStart || ''),
            examEnd: String(d.examEnd || ''),
            targetRole: String(d.targetRole || ''),
          });
        }
      },
      (err) => forwardErr(err, OperationType.GET, `users/${safeUid}/profile/main`)
    )
  );

  const subQuery = (colName: string) =>
    query(collection(db, 'users', safeUid, colName), where('ownerUid', '==', safeUid));

  unsubs.push(
    onSnapshot(
      subQuery('applications'),
      (snap) => {
        const list = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            opportunityId: String(d.opportunityId),
            company: String(d.company),
            roleTitle: String(d.roleTitle),
            location: String(d.location),
            applicantEmail: String(d.applicantEmail),
            applicantName: String(d.applicantName),
            applicantBranch: d.applicantBranch ? String(d.applicantBranch) : undefined,
            applicantSemester: d.applicantSemester ? Number(d.applicantSemester) : undefined,
            applicantSkills: Array.isArray(d.applicantSkills) ? d.applicantSkills : undefined,
            resumeUsed: d.resumeUsed ? String(d.resumeUsed) : undefined,
            stage: d.stage as ApplicationStage,
            appliedOn: String(d.appliedOn),
            nextAction: d.nextAction ? String(d.nextAction) : undefined,
            notes: d.notes ? String(d.notes) : undefined,
            isExternal: Boolean(d.isExternal),
            applicationDetails: d.applicationDetails || undefined,
            attachedNocId: d.attachedNocId ? String(d.attachedNocId) : undefined,
            attachedNocNumber: d.attachedNocNumber ? String(d.attachedNocNumber) : undefined,
            attachedConsentId: d.attachedConsentId ? String(d.attachedConsentId) : undefined,
            attachedConsentCode: d.attachedConsentCode ? String(d.attachedConsentCode) : undefined,
            facultyApproval: d.facultyApproval
              ? ({
                  status: d.facultyApproval.status || 'Pending',
                  programClearance: (d.facultyApproval.programClearance ||
                    'Pending Review') as ProgramClearanceStatus,
                  digitalSignature: d.facultyApproval.digitalSignature || undefined,
                } as FacultyApplicationApproval)
              : undefined,
            organizerConfirmedAllowed:
              typeof d.organizerConfirmedAllowed === 'boolean'
                ? d.organizerConfirmedAllowed
                : undefined,
            organizerConfirmedAt: d.organizerConfirmedAt
              ? String(d.organizerConfirmedAt)
              : undefined,
          } as ApplicationRecord;
        });
        list.sort((a, b) => b.appliedOn.localeCompare(a.appliedOn));
        callbacks.onApplications(list);
      },
      (err) => forwardErr(err, OperationType.LIST, `users/${safeUid}/applications`)
    )
  );

  unsubs.push(
    onSnapshot(
      subQuery('leaveRequests'),
      (snap) => {
        const list = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            studentName: String(d.studentName),
            rollNumber: String(d.rollNumber),
            studentEmail: String(d.studentEmail),
            branch: String(d.branch),
            semester: Number(d.semester) || 5,
            leaveType: d.leaveType,
            companyOrEvent: String(d.companyOrEvent),
            startDate: String(d.startDate),
            endDate: String(d.endDate),
            timingNote: String(d.timingNote || ''),
            reason: String(d.reason),
            submittedOn: String(d.submittedOn),
            status: d.status,
            digitalSignature: d.digitalSignature || undefined,
          } as LeaveRequest;
        });
        list.sort((a, b) => b.submittedOn.localeCompare(a.submittedOn));
        callbacks.onLeaves(list);
      },
      (err) => forwardErr(err, OperationType.LIST, `users/${safeUid}/leaveRequests`)
    )
  );

  unsubs.push(
    onSnapshot(
      subQuery('nocRequests'),
      (snap) => {
        const list = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            nocNumber: String(d.nocNumber),
            studentName: String(d.studentName),
            rollNumber: String(d.rollNumber),
            studentEmail: String(d.studentEmail),
            branch: String(d.branch),
            semester: Number(d.semester) || 5,
            companyName: String(d.companyName),
            roleTitle: String(d.roleTitle),
            workMode: d.workMode,
            location: String(d.location),
            stipendLabel: String(d.stipendLabel),
            internshipStart: String(d.internshipStart),
            internshipEnd: String(d.internshipEnd),
            dailyTiming: String(d.dailyTiming),
            hrContactName: String(d.hrContactName || ''),
            hrContactEmail: String(d.hrContactEmail || ''),
            offerLetterName: d.offerLetterName ? String(d.offerLetterName) : undefined,
            parentConsentId: d.parentConsentId ? String(d.parentConsentId) : undefined,
            parentSigned: Boolean(d.parentSigned),
            academicRemarks: d.academicRemarks ? String(d.academicRemarks) : undefined,
            submittedOn: String(d.submittedOn),
            status: d.status,
            facultySignature: d.facultySignature || undefined,
          } as NocRequest;
        });
        list.sort((a, b) => b.submittedOn.localeCompare(a.submittedOn));
        callbacks.onNocs(list);
      },
      (err) => forwardErr(err, OperationType.LIST, `users/${safeUid}/nocRequests`)
    )
  );

  unsubs.push(
    onSnapshot(
      subQuery('parentConsents'),
      (snap) => {
        const list = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            consentCode: String(d.consentCode),
            studentName: String(d.studentName),
            rollNumber: String(d.rollNumber),
            studentEmail: String(d.studentEmail),
            branch: String(d.branch),
            semester: Number(d.semester) || 5,
            parentName: String(d.parentName),
            relationship: d.relationship,
            parentPhone: String(d.parentPhone),
            parentEmail: String(d.parentEmail || ''),
            emergencyContact: String(d.emergencyContact),
            companyOrEvent: String(d.companyOrEvent),
            internshipLocation: String(d.internshipLocation),
            workMode: d.workMode,
            startDate: String(d.startDate),
            endDate: String(d.endDate),
            travelAndStayConfirmed: Boolean(d.travelAndStayConfirmed),
            medicalInsuranceConfirmed: Boolean(d.medicalInsuranceConfirmed),
            academicAttendanceUnderstood: Boolean(d.academicAttendanceUnderstood),
            parentSignatureDataUrl: String(d.parentSignatureDataUrl),
            signedOn: String(d.signedOn),
            facultyVerified: Boolean(d.facultyVerified),
            verifiedBy: d.verifiedBy ? String(d.verifiedBy) : undefined,
            verifiedOn: d.verifiedOn ? String(d.verifiedOn) : undefined,
          } as ParentConsentSheet;
        });
        list.sort((a, b) => b.signedOn.localeCompare(a.signedOn));
        callbacks.onParentConsents(list);
      },
      (err) => forwardErr(err, OperationType.LIST, `users/${safeUid}/parentConsents`)
    )
  );

  unsubs.push(
    onSnapshot(
      subQuery('studentSchedules'),
      (snap) => {
        const list = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            studentName: String(d.studentName),
            rollNumber: String(d.rollNumber),
            email: String(d.email),
            branch: String(d.branch),
            semester: Number(d.semester) || 5,
            internshipCompany: String(d.internshipCompany),
            internshipRole: String(d.internshipRole),
            internshipTiming: String(d.internshipTiming),
            internshipStart: String(d.internshipStart),
            internshipEnd: String(d.internshipEnd),
            upcomingEvent: String(d.upcomingEvent || ''),
            eventDate: String(d.eventDate || ''),
            eventTiming: String(d.eventTiming || ''),
            extraEvents: Array.isArray(d.extraEvents) ? d.extraEvents : [],
            examWindow: String(d.examWindow || ''),
            attendanceStatus: d.attendanceStatus,
          } as StudentScheduleRecord;
        });
        callbacks.onSchedules(list);
      },
      (err) => forwardErr(err, OperationType.LIST, `users/${safeUid}/studentSchedules`)
    )
  );

  if (callbacks.onActivityLogs) {
    const onActivityLogs = callbacks.onActivityLogs;
    unsubs.push(
      onSnapshot(
        subQuery('activityLogs'),
        (snap) => {
          const logs = snap.docs.map((docSnap) => {
            const d = docSnap.data();
            return {
              id: docSnap.id,
              role: d.role as UserRole,
              actionType: d.actionType,
              title: String(d.title || ''),
              details: String(d.details || ''),
              deviceSummary: String(d.deviceSummary || ''),
              occurredAt: String(d.occurredAt || ''),
            } as UserActivityLog;
          });
          logs.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
          onActivityLogs(logs);
        },
        (err) => forwardErr(err, OperationType.LIST, `users/${safeUid}/activityLogs`)
      )
    );
  }

  return () => {
    for (const unsub of unsubs) {
      unsub();
    }
  };
}

export function subscribeToOpportunities(
  onUpdate: (opportunities: Opportunity[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const oppQuery = query(collection(db, 'opportunities'), where('verified', '==', true));
  return onSnapshot(
    oppQuery,
    (snap) => {
      const items = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          title: String(d.title),
          company: String(d.company),
          type: d.type,
          domain: d.domain,
          mode: d.mode,
          location: String(d.location),
          stipend: Number(d.stipend) || 0,
          stipendLabel: d.stipendLabel ? String(d.stipendLabel) : undefined,
          durationLabel: String(d.durationLabel),
          deadline: String(d.deadline),
          startDate: String(d.startDate),
          endDate: String(d.endDate),
          skills: Array.isArray(d.skills) ? d.skills : [],
          minSemester: Number(d.minSemester) || 1,
          description: String(d.description),
          sourcePlatform: String(d.sourcePlatform),
          officialUrl: String(d.officialUrl),
          ownerOrg: String(d.ownerOrg),
          verified: Boolean(d.verified),
        } as Opportunity;
      });
      if (items.length > 0) {
        onUpdate(items);
      }
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, 'opportunities');
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    }
  );
}
