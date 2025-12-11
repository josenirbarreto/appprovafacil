
export enum UserRole {
  ADMIN = 'ADMIN',
  TEACHER = 'TEACHER'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'ACTIVE' | 'INACTIVE';
  plan: 'BASIC' | 'PREMIUM';
  subscriptionEnd: string;
}

// Institution & Classes
export interface Institution {
  id: string;
  name: string;
  logoUrl: string; // URL or Base64
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
}

export interface SchoolClass {
  id: string;
  name: string; // e.g. "3º Ano A"
  year: number;
  institutionId: string;
}

// Hierarchy
export interface Topic { id: string; name: string; unitId: string; }
export interface Unit { id: string; name: string; chapterId: string; topics: Topic[]; }
export interface Chapter { id: string; name: string; disciplineId: string; units: Unit[]; }
export interface Discipline { id: string; name: string; chapters: Chapter[]; }

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

// Exam
export interface Exam {
  id: string;
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
}
