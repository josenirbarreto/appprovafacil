
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
  authorId?: string;
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

export interface Question {
  id: string;
  authorId?: string; // ID do usuário que criou a questão
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
