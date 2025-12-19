
export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER', // Gestor da Escola
  TEACHER = 'TEACHER'
}

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
  accessGrants?: string[]; 
  subjects?: string[]; 
  requiresPasswordChange?: boolean; 
}

// Alunos vinculados a uma turma
export interface Student {
  id: string;
  name: string;
  registration: string; // Matrícula
  classId: string;
  institutionId: string;
  email?: string;
  createdAt: string;
}

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  category: 'ONBOARDING' | 'EXAMS' | 'MANAGEMENT' | 'FINANCE' | 'OTHER';
  type: 'VIDEO' | 'ARTICLE';
  contentUrl?: string; 
  contentBody?: string; 
  videoDuration?: string; 
  attachmentUrl?: string; 
  attachmentLabel?: string; 
  createdAt: string;
}

export interface SystemSettings {
  banner: {
    active: boolean;
    message: string;
    type: 'INFO' | 'WARNING' | 'ERROR';
  };
  aiConfig: {
    totalGenerations: number; 
    monthlyLimit: number; 
    costPerRequestEst: number; 
  };
  whiteLabel: {
    appName: string;
    logoUrl?: string;
    primaryColor?: string;
  };
}

export interface AuditLog {
  id: string;
  actorId: string; 
  actorName: string;
  actorRole: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'EXPORT' | 'SECURITY';
  targetResource: string; 
  targetId?: string; 
  details: string; 
  metadata?: any; 
  timestamp: string;
  ip?: string; 
}

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Ticket {
  id: string;
  authorId: string;
  authorName: string;
  authorEmail: string; 
  authorRole: UserRole;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: 'BUG' | 'DOUBT' | 'BILLING' | 'FEATURE_REQUEST' | 'OTHER';
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string; 
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  authorId: string; 
  authorName: string;
  message: string;
  createdAt: string;
  isAdminReply: boolean; 
}

export interface Payment {
  id: string;
  userId: string;
  userName: string;
  planName: string;
  amount: number;
  date: string; 
  method: 'PIX' | 'CREDIT_CARD' | 'BOLETO' | 'MANUAL';
  periodMonths: number; 
  status: 'PAID' | 'PENDING' | 'FAILED';
  notes?: string;
}

export interface Campaign {
  id: string;
  title: string;
  channel: 'EMAIL' | 'WHATSAPP';
  status: 'DRAFT' | 'COMPLETED' | 'CANCELLED';
  segmentation: {
    roles: UserRole[];
    plans?: string[];
    status?: string[];
  };
  content: {
    subject?: string;
    body: string; 
  };
  stats: {
    targetCount: number;
    sentCount: number;
    failedCount: number;
  };
  createdAt: string;
  sentAt?: string;
}

export type CouponType = 'PERCENTAGE' | 'FIXED' | 'TRIAL_DAYS';

export interface Coupon {
  id: string;
  code: string; 
  type: CouponType;
  value: number; 
  maxUses?: number; 
  usedCount: number;
  expiresAt?: string; 
  isActive: boolean;
  createdAt: string;
}

export interface Institution {
  id: string;
  authorId?: string; 
  name: string;
  logoUrl: string; 
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
}

export interface SchoolClass {
  id: string;
  authorId?: string; 
  name: string; 
  year: number;
  institutionId: string;
}

export interface Topic { id: string; name: string; unitId: string; createdAt?: string; authorId?: string; }
export interface Unit { id: string; name: string; chapterId: string; topics: Topic[]; createdAt?: string; authorId?: string; }
export interface Chapter { id: string; name: string; disciplineId: string; units: Unit[]; createdAt?: string; authorId?: string; }
export interface Discipline { id: string; name: string; chapters: Chapter[]; createdAt?: string; authorId?: string; }

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

export interface AssociationPair {
  id: string;
  itemA: string;
  itemB: string;
}

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Question {
  id: string;
  authorId?: string; 
  institutionId?: string; 
  visibility?: 'PRIVATE' | 'INSTITUTION' | 'PUBLIC'; 
  reviewStatus?: ReviewStatus; 
  rejectionReason?: string;
  isInstitutional?: boolean; // Se a escola aprovou como oficial dela
  institutionalApprovedById?: string; // Quem aprovou na escola
  enunciado: string; 
  type: QuestionType;
  disciplineId: string;
  chapterId: string;
  unitId: string;
  topicId: string;
  options?: QuestionOption[]; 
  pairs?: AssociationPair[]; 
  imageUrl?: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  createdAt: string;
  tags?: string[]; 
}

export interface ExamContentScope {
  id: string; 
  disciplineId: string;
  disciplineName: string;
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

export interface ExamAttempt {
  id: string;
  examId: string;
  studentId?: string; // Vínculo opcional para alunos cadastrados
  studentName: string;
  studentIdentifier?: string; 
  startedAt: string;
  submittedAt?: string;
  answers: Record<string, string>; 
  score: number; 
  totalQuestions: number;
  status: 'IN_PROGRESS' | 'COMPLETED';
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

export type PlanHighlightType = 'NONE' | 'POPULAR' | 'BEST_VALUE' | 'CHEAPEST';

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
