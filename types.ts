
export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER', 
  TEACHER = 'TEACHER'
}

export type PlanHighlightType = 'NONE' | 'POPULAR' | 'BEST_VALUE' | 'CHEAPEST';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'ACTIVE' | 'INACTIVE';
  plan: string; 
  subscriptionEnd: string; 
  subscriptionStart?: string;
  photoUrl?: string; 
  institutionId?: string; 
  ownerId?: string; 
  accessGrants?: string[]; // IDs de Componentes Curriculares
  subjects?: string[]; // IDs de Componentes Curriculares
  requiresPasswordChange?: boolean; 
  lastSignedContractId?: string; 
}

export interface ExamAttempt {
  id: string;
  examId: string;
  studentId?: string; 
  studentName: string;
  studentIdentifier?: string; 
  startedAt: string;
  submittedAt?: string;
  answers: Record<string, string>; 
  score: number; 
  totalQuestions: number;
  status: 'IN_PROGRESS' | 'COMPLETED';
  manualGradingComplete?: boolean; 
  questionScores?: Record<string, number>; 
}

// Hierarquia de 5 níveis
export interface Topic { id: string; name: string; unitId: string; createdAt?: string; authorId?: string; }
export interface Unit { id: string; name: string; chapterId: string; topics: Topic[]; createdAt?: string; authorId?: string; }
export interface Chapter { id: string; name: string; disciplineId: string; units: Unit[]; createdAt?: string; authorId?: string; }
export interface Discipline { id: string; name: string; componentId: string; chapters: Chapter[]; createdAt?: string; authorId?: string; }
export interface CurricularComponent { id: string; name: string; disciplines: Discipline[]; createdAt?: string; authorId?: string; }

export enum QuestionType {
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  TRUE_FALSE = 'TRUE_FALSE',
  SHORT_ANSWER = 'SHORT_ANSWER',
  NUMERIC = 'NUMERIC', 
  ASSOCIATION = 'ASSOCIATION' 
}

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface Question {
  id: string;
  authorId?: string; 
  institutionId?: string; 
  visibility?: 'PRIVATE' | 'INSTITUTION' | 'PUBLIC'; 
  reviewStatus?: 'PENDING' | 'APPROVED' | 'REJECTED'; 
  type: QuestionType;
  enunciado: string; 
  componentId: string;
  disciplineId: string;
  chapterId: string;
  unitId: string;
  topicId: string;
  options?: QuestionOption[]; 
  difficulty: 'Easy' | 'Medium' | 'Hard';
  createdAt: string;
  tags?: string[]; 
  isInstitutional?: boolean;
  pairs?: { id: string; left: string; right: string }[];
  institutionalApprovedById?: string;
}

export interface ExamContentScope {
  id: string; 
  componentId: string;
  componentName: string;
  disciplineId?: string;
  disciplineName?: string;
  chapterId?: string;
  chapterName?: string;
  unitId?: string;
  unitName?: string;
  topicId?: string;
  topicName?: string;
  questionCount: number; 
}

export interface PublicExamConfig {
  isPublished: boolean;
  startDate: string; 
  endDate: string; 
  timeLimitMinutes: number; 
  allowedAttempts: number; 
  randomizeQuestions: boolean; 
  requireIdentifier: boolean; 
  showFeedback: boolean; 
}

export interface Exam {
  id: string;
  authorId?: string; 
  title: string;
  headerText: string; 
  institutionId?: string;
  classId?: string; 
  columns: 1 | 2;
  instructions: string; 
  contentScopes: ExamContentScope[]; 
  questions: Question[]; 
  createdAt: string;
  showAnswerKey: boolean;
  publicConfig?: PublicExamConfig;
  tags?: string[]; 
}

export interface Plan {
  id: string;
  name: string; 
  description: string;
  price: number;
  interval: 'monthly' | 'yearly' | 'lifetime';
  isPopular: boolean; 
  highlightType?: PlanHighlightType; 
  features: string[]; 
  limits: {
    maxUsers: number; 
    maxQuestions: number; 
    maxClasses: number;
    maxAiGenerations: number;
    allowPdfImport: boolean;
    allowWhiteLabel: boolean; 
  };
}

export interface Institution { 
  id: string; 
  name: string; 
  logoUrl: string; 
  address?: string; 
  phone?: string; 
  email?: string; 
  website?: string; 
  ownerId?: string; 
}

export interface SchoolClass { id: string; name: string; year: number; institutionId: string; }
export interface Payment { id: string; userId: string; userName: string; planName: string; amount: number; date: string; method: string; periodMonths: number; status: string; }
export interface Campaign { id: string; title: string; channel: string; status: string; segmentation: any; content: any; stats: any; createdAt: string; sentAt?: string; }
export interface Coupon { id: string; code: string; type: string; value: number; maxUses: number; usedCount: number; expiresAt?: string; isActive: boolean; createdAt: string; }
export interface AuditLog { id: string; actorId: string; actorName: string; actorRole: string; action: string; targetResource: string; targetId?: string; details: string; timestamp: string; metadata?: any; }
export interface Ticket { id: string; authorId: string; authorName: string; authorEmail: string; authorRole: UserRole; subject: string; description: string; status: TicketStatus; category: string; priority: string; createdAt: string; updatedAt: string; lastMessageAt?: string; }
export interface TicketMessage { id: string; ticketId: string; authorId: string; authorName: string; message: string; createdAt: string; isAdminReply: boolean; }
export interface SystemSettings { banner: { active: boolean; message: string; type: 'INFO' | 'WARNING' | 'ERROR'; }; aiConfig: { totalGenerations: number; monthlyLimit: number; costPerRequestEst: number; }; whiteLabel: { appName: string; logoUrl?: string; primaryColor?: string; }; }
export interface Tutorial { id: string; title: string; description: string; category: string; type: 'VIDEO' | 'ARTICLE'; contentUrl?: string; contentBody?: string; videoDuration?: string; attachmentUrl?: string; attachmentLabel?: string; createdAt: string; }
export interface Student { id: string; name: string; registration: string; classId: string; institutionId: string; email?: string; createdAt: string; }
export interface ContractTemplate { id: string; planId: string; title: string; content: string; version: number; isActive: boolean; createdAt: string; updatedAt: string; }
export interface SignatureLog { id: string; userId: string; userName: string; templateId: string; version: number; timestamp: string; ipAddress: string; userAgent: string; contentHash: string; typedName: string; }
