export type UserRole = 'learner' | 'faculty' | 'organizer';

export type OpportunityType = 'Internship' | 'Hackathon' | 'Job';
export type WorkMode = 'Remote' | 'On-site' | 'Hybrid';
export type DomainCategory = 'Software' | 'Data' | 'Design' | 'Electronics' | 'Marketing';

export type ApplicationStage =
  | 'Applied'
  | 'Shortlisted'
  | 'Recruiter Call'
  | 'Phone Screen'
  | 'Selected'
  | 'Rejected';

export type LearnerTab =
  | 'dashboard'
  | 'hub'
  | 'applications'
  | 'approvals'
  | 'skills'
  | 'profile';
export type FacultyTab = 'approvals' | 'noc' | 'applications' | 'students' | 'calendar';
export type OrganizerTab = 'analytics' | 'post' | 'applicants' | 'org-profile';

export type LeaveType =
  | 'Internship Joining'
  | 'On-Duty (Hackathon/Event)'
  | 'Interview / Assessment'
  | 'Academic Leave';

export type LeaveRequestStatus = 'Pending' | 'Approved' | 'Rejected';

export interface DigitalSignatureRecord {
  signerName: string;
  signerDesignation: string;
  signatureDataUrl: string;
  signedAt: string;
  verificationCode: string;
  remarks?: string;
}

export interface LeaveRequest {
  id: string;
  studentName: string;
  rollNumber: string;
  studentEmail: string;
  branch: string;
  semester: number;
  leaveType: LeaveType;
  companyOrEvent: string;
  startDate: string;
  endDate: string;
  timingNote: string;
  reason: string;
  submittedOn: string;
  status: LeaveRequestStatus;
  digitalSignature?: DigitalSignatureRecord;
}

export type NocStatus = 'Pending' | 'Approved' | 'Rejected';

export interface NocRequest {
  id: string;
  nocNumber: string;
  studentName: string;
  rollNumber: string;
  studentEmail: string;
  branch: string;
  semester: number;
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
  parentSigned: boolean;
  academicRemarks?: string;
  submittedOn: string;
  status: NocStatus;
  facultySignature?: DigitalSignatureRecord;
}

export interface ParentConsentSheet {
  id: string;
  consentCode: string;
  studentName: string;
  rollNumber: string;
  studentEmail: string;
  branch: string;
  semester: number;
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
  signedOn: string;
  facultyVerified: boolean;
  verifiedBy?: string;
  verifiedOn?: string;
}

export interface StudentEventItem {
  id: string;
  title: string;
  date: string;
  timing: string;
  category: 'Hackathon' | 'Interview' | 'Workshop' | 'Review';
}

export interface StudentScheduleRecord {
  id: string;
  studentName: string;
  rollNumber: string;
  email: string;
  branch: string;
  semester: number;
  internshipCompany: string;
  internshipRole: string;
  internshipTiming: string;
  internshipStart: string;
  internshipEnd: string;
  upcomingEvent: string;
  eventDate: string;
  eventTiming: string;
  extraEvents?: StudentEventItem[];
  examWindow: string;
  attendanceStatus: 'On Track' | 'Leave Approved' | 'Event OD' | 'Needs Review';
}

export interface UserPersonalization {
  preferredDomains: DomainCategory[];
  preferredModes: WorkMode[];
  preferredLocations: string[];
  minStipend: number;
  careerGoal: string;
  examSafeOnly: boolean;
  facultyDepartment?: string;
  facultyFocus?: string;
  organizerCompany?: string;
  organizerHiringDomains?: DomainCategory[];
}

export interface AiPersonalizationResult {
  summary: string;
  skillAdvice: string[];
  recommendations: AiSmartPick[];
  generatedAt: string;
}

export type ActivityActionType =
  | 'login'
  | 'role_switch'
  | 'apply'
  | 'profile_update'
  | 'personalize'
  | 'leave_submit'
  | 'leave_sign'
  | 'noc_submit'
  | 'noc_sign'
  | 'consent_submit'
  | 'consent_verify'
  | 'application_sign'
  | 'organizer_confirm'
  | 'opportunity_publish'
  | 'hub_sync'
  | 'schedule_update';

export interface UserActivityLog {
  id: string;
  role: UserRole;
  actionType: ActivityActionType;
  title: string;
  details: string;
  deviceSummary: string;
  occurredAt: string;
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organization?: string;
  designation?: string;
  verified?: boolean;
  lastLoginAt?: string;
  lastLoginMethod?: 'google' | 'local';
  loginCount?: number;
  onboardingCompleted?: boolean;
  personalization?: UserPersonalization;
  aiSuggestions?: AiPersonalizationResult;
}

export interface ResumeItem {
  id: string;
  name: string;
  targetRole: string;
  updatedAt: string;
  sizeLabel: string;
  isDefault?: boolean;
}

export interface ProjectItem {
  id: string;
  title: string;
  role: string;
  techStack: string;
  summary: string;
  url?: string;
}

export interface StudentProfile {
  name: string;
  headline: string;
  about: string;
  branch: string;
  semester: number;
  college: string;
  cgpa: string;
  gradYear: string;
  location: string;
  skills: string[];
  resumeName: string;
  resumes: ResumeItem[];
  projects: ProjectItem[];
  githubUrl: string;
  linkedinUrl: string;
  portfolioUrl: string;
  examStart: string;
  examEnd: string;
  targetRole: string;
}

export interface Opportunity {
  id: string;
  title: string;
  company: string;
  type: OpportunityType;
  domain: DomainCategory;
  mode: WorkMode;
  location: string;
  stipend: number;
  stipendLabel?: string;
  durationLabel: string;
  deadline: string;
  startDate: string;
  endDate: string;
  skills: string[];
  minSemester: number;
  description: string;
  sourcePlatform: string;
  officialUrl: string;
  ownerOrg: string;
  verified: boolean;
}

export type ProgramClearanceStatus =
  | 'Pending Review'
  | 'Open / Allowed for Program'
  | 'Not Cleared';

export interface FacultyApplicationApproval {
  status: 'Pending' | 'Approved' | 'Rejected';
  programClearance: ProgramClearanceStatus;
  digitalSignature?: DigitalSignatureRecord;
}

export interface ApplicationCriteriaPayload {
  fullName: string;
  email: string;
  rollNumber: string;
  branch: string;
  semester: number;
  cgpa: string;
  resumeUsed: string;
  portfolioUrl: string;
  availability: string;
  coverNote: string;
  attachedNocId?: string;
  attachedNocNumber?: string;
  attachedConsentId?: string;
  attachedConsentCode?: string;
  confirmedCriteria: boolean;
  confirmedExamCompliance: boolean;
  confirmedAuthenticity: boolean;
}

export interface ApplicationRecord {
  id: string;
  opportunityId: string;
  company: string;
  roleTitle: string;
  location: string;
  applicantEmail: string;
  applicantName: string;
  applicantBranch?: string;
  applicantSemester?: number;
  applicantSkills?: string[];
  resumeUsed?: string;
  stage: ApplicationStage;
  appliedOn: string;
  nextAction?: string;
  notes?: string;
  isExternal?: boolean;
  applicationDetails?: ApplicationCriteriaPayload;
  attachedNocId?: string;
  attachedNocNumber?: string;
  attachedConsentId?: string;
  attachedConsentCode?: string;
  facultyApproval?: FacultyApplicationApproval;
  organizerConfirmedAllowed?: boolean;
  organizerConfirmedAt?: string;
}

export interface CourseResource {
  id: string;
  title: string;
  provider: string;
  category: string;
  duration: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  skillUnlocked: string;
  description: string;
  url: string;
  accentBg: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  latencyMs?: number;
}

export interface AiSmartPick {
  opportunityId: string;
  reason: string;
  fitTag: string;
}
