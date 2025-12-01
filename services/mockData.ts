
import { User, UserRole, Discipline, Question, QuestionType, Exam, Institution, SchoolClass } from '../types';

// --- DADOS INICIAIS (MOCK) ---

const MOCK_USERS: User[] = [
  { id: '1', name: 'Admin Master', email: 'admin@provafacil.com', role: UserRole.ADMIN, status: 'ACTIVE', plan: 'PREMIUM', subscriptionEnd: '2030-12-31' },
  { id: '2', name: 'Prof. Carlos Silva', email: 'carlos@escola.com', role: UserRole.TEACHER, status: 'ACTIVE', plan: 'PREMIUM', subscriptionEnd: '2025-06-15' },
];

// Agora é uma lista de instituições, pois um professor pode ter várias
let MOCK_INSTITUTIONS: Institution[] = [
  {
    id: 'inst1',
    name: 'Escola Modelo Futuro',
    logoUrl: 'https://via.placeholder.com/150x50?text=LOGO+ESCOLA',
    address: 'Rua da Educação, 123 - Centro, São Paulo - SP',
    phone: '(11) 99999-8888',
    email: 'contato@escolamodelo.com.br',
    website: 'www.escolamodelo.com.br'
  }
];

let MOCK_CLASSES: SchoolClass[] = [
  { id: 't1', name: '3º Ano A - Ensino Médio', year: 2024, institutionId: 'inst1' },
  { id: 't2', name: '9º Ano B - Fundamental', year: 2024, institutionId: 'inst1' }
];

let MOCK_HIERARCHY: Discipline[] = [
  {
    id: 'd1', name: 'Matemática', chapters: [
      {
        id: 'c1', name: 'Álgebra', disciplineId: 'd1', units: [
          {
            id: 'u1', name: 'Equações', chapterId: 'c1', topics: [
              { id: 't1', name: '1º Grau', unitId: 'u1' },
              { id: 't2', name: '2º Grau', unitId: 'u1' }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'd2', name: 'História', chapters: [
      {
        id: 'c2', name: 'Brasil Colônia', disciplineId: 'd2', units: [
          {
            id: 'u2', name: 'Ciclo do Ouro', chapterId: 'c2', topics: [
              { id: 't3', name: 'Inconfidência Mineira', unitId: 'u2' }
            ]
          }
        ]
      }
    ]
  }
];

const MOCK_QUESTIONS: Question[] = [
  {
    id: 'q1',
    enunciado: 'Qual é a raiz quadrada de 144?',
    type: QuestionType.MULTIPLE_CHOICE,
    disciplineId: 'd1', chapterId: 'c1', unitId: 'u1', topicId: 't1',
    difficulty: 'Easy',
    createdAt: '2024-01-01',
    options: [
      { id: 'o1', text: '10', isCorrect: false },
      { id: 'o2', text: '12', isCorrect: true },
      { id: 'o3', text: '14', isCorrect: false },
      { id: 'o4', text: '144', isCorrect: false },
    ]
  },
  {
    id: 'q2',
    enunciado: 'Tiradentes foi o líder da Inconfidência Mineira.',
    type: QuestionType.TRUE_FALSE,
    disciplineId: 'd2', chapterId: 'c2', unitId: 'u2', topicId: 't3',
    difficulty: 'Medium',
    createdAt: '2024-01-02',
    options: [
        { id: 'tf1', text: 'Verdadeiro', isCorrect: true },
        { id: 'tf2', text: 'Falso', isCorrect: false }
    ]
  }
];

const MOCK_EXAMS: Exam[] = [];

// --- FUNÇÕES DO SERVIÇO ---
export const MockService = {
  getUsers: async () => [...MOCK_USERS],
  
  // --- Instituições (CRUD Completo) ---
  
  // Listar todas
  getInstitutions: async () => [...MOCK_INSTITUTIONS],
  
  // Adicionar nova
  addInstitution: async (data: Institution) => {
    const newInst = { ...data, id: `inst-${Date.now()}` };
    MOCK_INSTITUTIONS.push(newInst);
    return newInst;
  },

  // Atualizar existente
  updateInstitution: async (data: Institution) => {
    const index = MOCK_INSTITUTIONS.findIndex(i => i.id === data.id);
    if (index !== -1) {
      MOCK_INSTITUTIONS[index] = data;
      return data;
    }
    return null;
  },

  // Remover
  deleteInstitution: async (id: string) => {
    MOCK_INSTITUTIONS = MOCK_INSTITUTIONS.filter(i => i.id !== id);
    // Também removeria as turmas associadas na vida real
    MOCK_CLASSES = MOCK_CLASSES.filter(c => c.institutionId !== id);
  },
  
  // --- Turmas ---
  getClasses: async () => [...MOCK_CLASSES],
  
  addClass: async (cls: SchoolClass) => {
    MOCK_CLASSES.push(cls);
    return cls;
  },

  updateClass: async (data: SchoolClass) => {
    const index = MOCK_CLASSES.findIndex(c => c.id === data.id);
    if (index !== -1) {
        MOCK_CLASSES[index] = data;
        return data;
    }
    return null;
  },

  deleteClass: async (id: string) => {
    const idx = MOCK_CLASSES.findIndex(c => c.id === id);
    if (idx > -1) MOCK_CLASSES.splice(idx, 1);
  },

  // --- Hierarquia (CRUD) ---
  getHierarchy: async () => JSON.parse(JSON.stringify(MOCK_HIERARCHY)), // Cópia profunda
  
  addDiscipline: async (name: string) => {
    const newD: Discipline = { id: `d-${Date.now()}`, name, chapters: [] };
    MOCK_HIERARCHY.push(newD);
    return newD;
  },
  
  addChapter: async (disciplineId: string, name: string) => {
    const disc = MOCK_HIERARCHY.find(d => d.id === disciplineId);
    if (disc) {
        disc.chapters.push({ id: `c-${Date.now()}`, name, disciplineId, units: [] });
    }
  },

  addUnit: async (disciplineId: string, chapterId: string, name: string) => {
    const disc = MOCK_HIERARCHY.find(d => d.id === disciplineId);
    const chap = disc?.chapters.find(c => c.id === chapterId);
    if (chap) {
        chap.units.push({ id: `u-${Date.now()}`, name, chapterId, topics: [] });
    }
  },

  addTopic: async (disciplineId: string, chapterId: string, unitId: string, name: string) => {
    const disc = MOCK_HIERARCHY.find(d => d.id === disciplineId);
    const chap = disc?.chapters.find(c => c.id === chapterId);
    const unit = chap?.units.find(u => u.id === unitId);
    if (unit) {
        unit.topics.push({ id: `t-${Date.now()}`, name, unitId });
    }
  },

  deleteItem: async (type: 'discipline'|'chapter'|'unit'|'topic', ids: {dId?: string, cId?: string, uId?: string, tId?: string}) => {
    if (type === 'discipline' && ids.dId) {
        MOCK_HIERARCHY = MOCK_HIERARCHY.filter(d => d.id !== ids.dId);
    } 
    else if (type === 'chapter' && ids.dId && ids.cId) {
        const d = MOCK_HIERARCHY.find(d => d.id === ids.dId);
        if (d) d.chapters = d.chapters.filter(c => c.id !== ids.cId);
    }
    else if (type === 'unit' && ids.dId && ids.cId && ids.uId) {
        const d = MOCK_HIERARCHY.find(d => d.id === ids.dId);
        const c = d?.chapters.find(c => c.id === ids.cId);
        if (c) c.units = c.units.filter(u => u.id !== ids.uId);
    }
    else if (type === 'topic' && ids.dId && ids.cId && ids.uId && ids.tId) {
        const d = MOCK_HIERARCHY.find(d => d.id === ids.dId);
        const c = d?.chapters.find(c => c.id === ids.cId);
        const u = c?.units.find(u => u.id === ids.uId);
        if (u) u.topics = u.topics.filter(t => t.id !== ids.tId);
    }
  },

  // --- Questões ---
  getQuestions: async () => [...MOCK_QUESTIONS],
  
  addQuestion: async (q: Question) => {
    MOCK_QUESTIONS.push(q);
    return q;
  },

  saveExam: async (exam: Exam) => {
    MOCK_EXAMS.push(exam);
    return exam;
  },

  getExams: async () => [...MOCK_EXAMS],

  // Auxiliar para string de hierarquia
  getFullHierarchyString: (q: Question) => {
    const disc = MOCK_HIERARCHY.find(d => d.id === q.disciplineId);
    const chap = disc?.chapters.find(c => c.id === q.chapterId);
    const unit = chap?.units.find(u => u.id === q.unitId);
    const topic = unit?.topics.find(t => t.id === q.topicId);
    return `${disc?.name} > ${chap?.name} > ${unit?.name} > ${topic?.name}`;
  }
};
