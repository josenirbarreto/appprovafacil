
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
  plan: string; // Alterado de Union Type fixo para string para aceitar planos dinâmicos
  subscriptionEnd: string; // ISO String YYYY-MM-DD
  subscriptionStart?: string;
  photoUrl?: string; 
  institutionId?: string; // Vinculo: Se for Professor, aponta para o Gestor/Escola
  ownerId?: string; // ID do Gestor que criou este usuário
  accessGrants?: string[]; // NOVO: IDs das Disciplinas que este usuário pode acessar no Banco Global
  subjects?: string[]; // NOVO: IDs das Disciplinas que o professor leciona (Componente Curricular)
  requiresPasswordChange?: boolean; // NOVO: Força troca de senha no próximo login
}

// NOVO: Tutoriais e Knowledge Base
export interface Tutorial {
  id: string;
  title: string;
  description: string;
  category: 'ONBOARDING' | 'EXAMS' | 'MANAGEMENT' | 'FINANCE' | 'OTHER';
  type: 'VIDEO' | 'ARTICLE';
  contentUrl?: string; // Para Vídeos (YouTube link)
  contentBody?: string; // Para Artigos (HTML)
  videoDuration?: string; // Ex: "5 min"
  attachmentUrl?: string; // NOVO: Link para arquivo
  attachmentLabel?: string; // NOVO: Nome do arquivo para exibição
  createdAt: string;
}

// NOVO: Configurações Globais do Sistema
export interface SystemSettings {
  banner: {
    active: boolean;
    message: string;
    type: 'INFO' | 'WARNING' | 'ERROR';
  };
  aiConfig: {
    totalGenerations: number; // Contador acumulativo
    monthlyLimit: number; // Alerta visual
    costPerRequestEst: number; // Custo estimado (USD)
  };
  whiteLabel: {
    appName: string;
    logoUrl?: string;
    primaryColor?: string;
  };
}

// NOVO: Interface para Logs de Auditoria
export interface AuditLog {
  id: string;
  actorId: string; // Quem fez a ação
  actorName: string;
  actorRole: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'EXPORT' | 'SECURITY';
  targetResource: string; // Ex: "Prova de Matemática", "Usuário João"
  targetId?: string; // ID do recurso afetado
  details: string; // Descrição humanizada
  metadata?: any; // Dados técnicos (ex: nota anterior vs nova)
  timestamp: string;
  ip?: string; // Opcional (difícil de pegar via client-side puro com precisão, mas deixamos o campo)
}

// NOVO: Suporte / Helpdesk
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Ticket {
  id: string;
  authorId: string;
  authorName: string;
  authorEmail: string; // Facilitar contato
  authorRole: UserRole;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: 'BUG' | 'DOUBT' | 'BILLING' | 'FEATURE_REQUEST' | 'OTHER';
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string; // Para ordenar por atividade recente
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  authorId: string; // Quem escreveu a mensagem
  authorName: string;
  message: string;
  createdAt: string;
  isAdminReply: boolean; // Se true, foi o suporte que respondeu
}

export interface Payment {
  id: string;
  userId: string;
  userName: string;
  planName: string;
  amount: number;
  date: string; // ISO String
  method: 'PIX' | 'CREDIT_CARD' | 'BOLETO' | 'MANUAL';
  periodMonths: number; // Quantos meses foram adicionados
  status: 'PAID' | 'PENDING' | 'FAILED';
  notes?: string;
}

// Marketing Campaigns
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
    body: string; // HTML ou Texto
  };
  stats: {
    targetCount: number;
    sentCount: number;
    failedCount: number;
  };
  createdAt: string;
  sentAt?: string;
}

// NOVO: Marketing Coupons
export type CouponType = 'PERCENTAGE' | 'FIXED' | 'TRIAL_DAYS';

export interface Coupon {
  id: string;
  code: string; // Ex: VOLTAASAULAS
  type: CouponType;
  value: number; // 20 (%), 50 (R$), 30 (dias)
  maxUses?: number; // 0 ou undefined = ilimitado
  usedCount: number;
  expiresAt?: string; // ISO String data validade
  isActive: boolean;
  createdAt: string;
}

// Institution & Classes
export interface Institution {
  id: string;
  authorId?: string; // ID do usuário dono (Gestor ou Admin)
  name: string;
  logoUrl: string; // URL or Base64
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
}

export interface SchoolClass {
  id: string;
  authorId?: string; // ID do usuário dono
  name: string; // e.g. "3º Ano A"
  year: number;
  institutionId: string;
}

// Hierarchy
export interface Topic { id: string; name: string; unitId: string; createdAt?: string; authorId?: string; }
export interface Unit { id: string; name: string; chapterId: string; topics: Topic[]; createdAt?: string; authorId?: string; }
export interface Chapter { id: string; name: string; disciplineId: string; units: Unit[]; createdAt?: string; authorId?: string; }
export interface Discipline { id: string; name: string; chapters: Chapter[]; createdAt?: string; authorId?: string; }

// Questions
export enum QuestionType {
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  TRUE_FALSE = 'TRUE_FALSE',
  SHORT_ANSWER = 'SHORT_ANSWER',
  NUMERIC = 'NUMERIC', // Nova opção
  ASSOCIATION = 'ASSOCIATION' // Column A vs B
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

// NOVO: Quality Control
export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Question {
  id: string;
  authorId?: string; // ID do usuário que criou a questão
  institutionId?: string; // NOVO: ID da escola (para visibilidade INSTITUTION)
  visibility?: 'PRIVATE' | 'INSTITUTION' | 'PUBLIC'; // NOVO: Nível de compartilhamento
  
  // Moderation Fields
  reviewStatus?: ReviewStatus; // Default: APPROVED for private/inst, PENDING for public
  rejectionReason?: string;
  
  enunciado: string; // The question text
  type: QuestionType;
  disciplineId: string;
  chapterId: string;
  unitId: string;
  topicId: string;
  options?: QuestionOption[]; // For MC and TF
  pairs?: AssociationPair[]; // For Association
  imageUrl?: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  createdAt: string;
}

// Exam Configuration Scope
export interface ExamContentScope {
  id: string; // Unique ID for the scope entry
  disciplineId: string;
  disciplineName: string;
  chapterId?: string;
  chapterName?: string;
  unitId?: string;
  unitName?: string;
  topicId?: string;
  topicName?: string;
  questionCount: number; // Quantidade de questões desejadas deste tópico
}

// Online Exam Configuration
export interface PublicExamConfig {
  isPublished: boolean;
  startDate: string; // ISO String
  endDate: string; // ISO String
  timeLimitMinutes: number; // 0 = sem limite
  allowedAttempts: number; // 1 = padrão
  randomizeQuestions: boolean; // Se true, embaralha questões e alternativas
  requireIdentifier: boolean; // Se true, pede matricula/email além do nome
  showFeedback: boolean; // Se true, mostra nota ao final
}

// Student Attempt
export interface ExamAttempt {
  id: string;
  examId: string;
  studentName: string;
  studentIdentifier?: string; // Email ou Matrícula
  startedAt: string;
  submittedAt?: string;
  answers: Record<string, string>; // questionId -> optionId ou text
  score: number; // Calculado automaticamente
  totalQuestions: number;
  status: 'IN_PROGRESS' | 'COMPLETED';
}

// Exam
export interface Exam {
  id: string;
  authorId?: string; // ID do usuário que criou a prova
  title: string;
  headerText: string; // Subtítulo ou cabeçalho textual
  institutionId?: string;
  classId?: string; // Vínculo com a Turma
  
  // Configurações de Layout e Instruções
  columns: 1 | 2;
  instructions: string; // HTML rich text
  
  // Conteúdo
  contentScopes: ExamContentScope[]; // O que cai na prova
  questions: Question[]; // As questões selecionadas
  
  createdAt: string;
  showAnswerKey: boolean;
  
  // Configuração Online
  publicConfig?: PublicExamConfig;
}

// Plans
export type PlanHighlightType = 'NONE' | 'POPULAR' | 'BEST_VALUE' | 'CHEAPEST';

export interface Plan {
  id: string;
  name: string; // Ex: Basic, Premium
  description: string;
  price: number;
  interval: 'monthly' | 'yearly' | 'lifetime';
  isPopular: boolean; // Mantido para legado, mas a UI usará highlightType
  highlightType?: PlanHighlightType; // NOVO: Tipo de destaque visual
  features: string[]; // Lista de strings para exibir com checkmarks
  
  // Limites Técnicos (Para controle do SaaS)
  limits: {
    maxUsers: number; // NOVO: Quantidade de professores permitidos (1 = apenas o dono)
    maxQuestions: number; // -1 para ilimitado
    maxClasses: number;
    maxAiGenerations: number;
    allowPdfImport: boolean;
    allowWhiteLabel: boolean; // Remover logo do sistema
  };
}
