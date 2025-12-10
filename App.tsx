
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { HashRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { User, UserRole, Question, Exam, Discipline, QuestionType, Institution, SchoolClass, Chapter, Unit, ExamContentScope } from './types';
import { FirebaseService } from './services/firebaseService';
import { Button, Card, Badge, Input, Select, Modal, RichTextEditor } from './components/UI';
import { GeminiService } from './services/geminiService';
import { PdfService } from './services/pdfService';
import { auth } from './firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';

// Ícones SVG
const Icons = {
  Dashboard: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
  Questions: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Exams: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  Users: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  Logout: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
  Sparkles: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>,
  Trash: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  Building: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  BookOpen: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
  UsersGroup: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
  Plus: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>,
  Upload: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>,
  Edit: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>,
  ArrowLeft: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
  ArrowRight: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>,
  Search: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  Eye: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
  ChevronDown: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>,
  Pdf: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
  Check: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
  Printer: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
};

// Traduções dos Tipos de Questão
const QuestionTypeLabels: Record<QuestionType, string> = {
    [QuestionType.MULTIPLE_CHOICE]: 'Múltipla Escolha',
    [QuestionType.TRUE_FALSE]: 'Verdadeiro / Falso',
    [QuestionType.SHORT_ANSWER]: 'Resposta Curta',
    [QuestionType.NUMERIC]: 'Numérica',
    [QuestionType.ASSOCIATION]: 'Associação'
};

const AuthContext = React.createContext<{ user: User | null; loading: boolean }>({ user: null, loading: true });

// --- PÁGINAS ---

// 1. LOGIN (Mantido igual)
const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ email: '', password: '', name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
      setError('');
      setLoading(true);
      try {
          if (isLogin) {
              await FirebaseService.login(formData.email, formData.password);
          } else {
              await FirebaseService.register(formData.email, formData.password, formData.name, UserRole.TEACHER);
          }
      } catch (err: any) {
          let msg = 'Erro na autenticação.';
          if (err.code === 'auth/email-already-in-use') {
              msg = 'Este e-mail já está cadastrado. Tente fazer login.';
          } else if (err.code === 'auth/invalid-email') {
              msg = 'O e-mail informado é inválido.';
          } else if (err.code === 'auth/weak-password') {
              msg = 'A senha deve ter pelo menos 6 caracteres.';
          } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
              msg = 'E-mail ou senha incorretos.';
          } else if (err.message) {
              msg = err.message;
          }
          setError(msg);
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-display font-bold text-brand-blue mb-2">Prova Fácil</h1>
          <p className="text-slate-500">Plataforma de Gestão de Avaliações</p>
        </div>
        
        {error && <div className="bg-red-50 text-red-600 p-3 rounded text-sm text-center">{error}</div>}

        <div className="space-y-4">
            {!isLogin && (
                <Input label="Nome Completo" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            )}
            <Input label="E-mail" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            <Input label="Senha" type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
            
            <Button onClick={handleSubmit} className="w-full justify-center py-3" disabled={loading}>
                {loading ? 'Processando...' : (isLogin ? 'Entrar' : 'Cadastrar')}
            </Button>
        </div>

        <div className="text-center text-sm">
            <button onClick={() => setIsLogin(!isLogin)} className="text-brand-blue hover:underline">
                {isLogin ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Fazer Login'}
            </button>
        </div>
      </div>
    </div>
  );
};

// 2. DASHBOARD (Mantido igual)
const Dashboard = () => {
  const { user } = React.useContext(AuthContext);
  const [stats, setStats] = useState({ users: 0, questions: 0, exams: 0 });

  useEffect(() => {
    const loadStats = async () => {
        const u = user?.role === UserRole.ADMIN ? await FirebaseService.getUsers() : [];
        const q = await FirebaseService.getQuestions();
        const e = await FirebaseService.getExams();
        setStats({ users: u.length, questions: q.length, exams: e.length });
    };
    loadStats();
  }, [user]);

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar space-y-6">
      <h2 className="text-3xl font-display font-bold text-brand-dark">Olá, {user?.name}</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-l-4 border-l-brand-blue">
            <div className="flex justify-between items-center">
                <div>
                    <p className="text-slate-500 font-medium">Questões Cadastradas</p>
                    <p className="text-3xl font-bold text-brand-dark mt-1">{stats.questions}</p>
                </div>
                <div className="bg-blue-50 p-3 rounded-full text-brand-blue"><Icons.Questions /></div>
            </div>
        </Card>
        <Card className="border-l-4 border-l-brand-orange">
             <div className="flex justify-between items-center">
                <div>
                    <p className="text-slate-500 font-medium">Provas Geradas</p>
                    <p className="text-3xl font-bold text-brand-dark mt-1">{stats.exams}</p>
                </div>
                <div className="bg-orange-50 p-3 rounded-full text-brand-orange"><Icons.Exams /></div>
            </div>
        </Card>
        {user?.role === UserRole.ADMIN && (
             <Card className="border-l-4 border-l-purple-500">
                <div className="flex justify-between items-center">
                   <div>
                       <p className="text-slate-500 font-medium">Usuários Ativos</p>
                       <p className="text-3xl font-bold text-brand-dark mt-1">{stats.users}</p>
                   </div>
                   <div className="bg-purple-50 p-3 rounded-full text-purple-600"><Icons.Users /></div>
               </div>
           </Card>
        )}
      </div>
    </div>
  );
};

// ... (Rest of components kept same for brevity, jumping to ExamsPage Render Step 4 update) ...

// ... (Existing InstitutionPage, ClassesPage, HierarchyPage, QuestionsPage components) ...

const InstitutionPage = () => {
    const [institutions, setInstitutions] = useState<Institution[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [currentInst, setCurrentInst] = useState<Partial<Institution>>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        const data = await FirebaseService.getInstitutions();
        setInstitutions(data);
    };

    const handleCreateNew = () => {
        setCurrentInst({ name: '', logoUrl: '', address: '', phone: '', email: '', website: '' });
        setShowModal(true);
    };

    const handleEdit = (inst: Institution) => {
        setCurrentInst({ ...inst });
        setShowModal(true);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Tem certeza?')) {
            await FirebaseService.deleteInstitution(id);
            loadData();
        }
    };

    const handleSave = async () => {
        if (!currentInst.name) return alert('Nome obrigatório');
        setLoading(true);
        if (currentInst.id) {
            await FirebaseService.updateInstitution(currentInst as Institution);
        } else {
            await FirebaseService.addInstitution(currentInst as Institution);
        }
        setLoading(false);
        setShowModal(false);
        loadData();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => setCurrentInst({ ...currentInst, logoUrl: e.target?.result as string });
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-display font-bold text-brand-dark">Minhas Instituições</h2>
                <Button onClick={handleCreateNew}><Icons.Plus /> Nova Instituição</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {institutions.map(inst => (
                    <Card key={inst.id} className="flex flex-col h-full hover:shadow-md transition-shadow group">
                        <div className="h-32 bg-slate-50 flex items-center justify-center border-b border-slate-100 overflow-hidden relative">
                            {inst.logoUrl ? <img src={inst.logoUrl} alt={inst.name} className="h-full w-full object-contain p-2" /> : <Icons.Building />}
                        </div>
                        <div className="p-5 flex-1 flex flex-col">
                            <h3 className="font-bold text-lg mb-1">{inst.name}</h3>
                            <div className="mt-auto flex justify-end gap-2 pt-3 border-t">
                                <Button variant="ghost" onClick={() => handleEdit(inst)}><Icons.Edit /></Button>
                                <Button variant="ghost" onClick={() => handleDelete(inst.id)} className="text-red-400"><Icons.Trash /></Button>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={currentInst.id ? 'Editar' : 'Nova'} footer={<Button onClick={handleSave} disabled={loading}>Salvar</Button>}>
                 <div className="space-y-4">
                     <div className="flex flex-col items-center gap-2">
                        {currentInst.logoUrl && <img src={currentInst.logoUrl} className="h-20" />}
                        <input type="file" accept="image/*" onChange={handleFileChange} />
                     </div>
                     <Input label="Nome *" value={currentInst.name || ''} onChange={e => setCurrentInst({...currentInst, name: e.target.value})} />
                     <Input label="Endereço" value={currentInst.address || ''} onChange={e => setCurrentInst({...currentInst, address: e.target.value})} />
                 </div>
            </Modal>
        </div>
    );
};

const ClassesPage = () => {
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [institutions, setInstitutions] = useState<Institution[]>([]); 
    const [showModal, setShowModal] = useState(false);
    const [currentClass, setCurrentClass] = useState<Partial<SchoolClass>>({ year: new Date().getFullYear(), institutionId: '' });
    const [expandedInsts, setExpandedInsts] = useState<Record<string, boolean>>({});

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        const cls = await FirebaseService.getClasses();
        const insts = await FirebaseService.getInstitutions();
        setClasses(cls);
        setInstitutions(insts);
    };

    const handleSave = async () => {
        if (!currentClass.name || !currentClass.institutionId) return alert('Dados incompletos');
        if (currentClass.id) await FirebaseService.updateClass(currentClass as SchoolClass);
        else await FirebaseService.addClass(currentClass as SchoolClass);
        setShowModal(false);
        loadData();
    };

    const handleDelete = async (id: string) => {
        if(confirm('Excluir turma?')) { await FirebaseService.deleteClass(id); loadData(); }
    }

    const toggleAccordion = (instId: string) => {
        setExpandedInsts(prev => ({ ...prev, [instId]: !prev[instId] }));
    };

    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-display font-bold text-brand-dark">Turmas</h2>
                <Button onClick={() => { setCurrentClass({year: new Date().getFullYear(), institutionId: institutions[0]?.id || ''}); setShowModal(true); }}><Icons.Plus /> Nova Turma</Button>
            </div>
            {institutions
                .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
                .map(inst => {
                const instClasses = classes.filter(c => c.institutionId === inst.id);
                const years = Array.from(new Set(instClasses.map(c => c.year))).sort((a: number, b: number) => b - a);
                const isExpanded = expandedInsts[inst.id] !== false;

                return (
                    <div key={inst.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                        <div 
                            onClick={() => toggleAccordion(inst.id)}
                            className="p-6 cursor-pointer hover:bg-slate-50 transition-colors flex justify-between items-center select-none"
                        >
                            <h3 className="font-bold text-lg flex items-center gap-3">
                                {inst.logoUrl ? (
                                    <img src={inst.logoUrl} alt={inst.name} className="w-10 h-10 object-contain rounded border border-slate-200 bg-white" />
                                ) : (
                                    <div className="p-2 bg-slate-100 rounded text-slate-500"><Icons.Building /></div>
                                )}
                                <div className="flex flex-col">
                                    <span>{inst.name}</span>
                                    <span className="text-xs font-normal text-slate-500">{instClasses.length} turmas cadastradas</span>
                                </div>
                            </h3>
                            <div className={`transform transition-transform duration-200 text-slate-400 ${isExpanded ? 'rotate-180' : ''}`}>
                                <Icons.ChevronDown />
                            </div>
                        </div>
                        
                        {isExpanded && (
                            <div className="px-6 pb-6 border-t border-slate-100 animate-fade-in pt-4">
                                {instClasses.length > 0 ? (
                                    <div className="space-y-6">
                                        {years.map(year => (
                                            <div key={year}>
                                                <div className="flex items-center gap-2 mb-3">
                                                    <Badge color="blue">{year.toString()}</Badge>
                                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ano Letivo</span>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    {instClasses
                                                        .filter(c => c.year === year)
                                                        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
                                                        .map(c => (
                                                            <div key={c.id} className="border p-4 rounded flex justify-between items-center bg-slate-50/50 hover:bg-slate-50 transition-colors">
                                                                <div><p className="font-bold">{c.name}</p></div>
                                                                <div className="flex gap-1">
                                                                    <Button variant="ghost" onClick={() => {setCurrentClass(c); setShowModal(true)}}><Icons.Edit /></Button>
                                                                    <Button variant="ghost" onClick={() => handleDelete(c.id)} className="text-red-500"><Icons.Trash /></Button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-400 italic">Nenhuma turma cadastrada nesta instituição.</p>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
             <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Turma" footer={<Button onClick={handleSave}>Salvar</Button>}>
                <div className="space-y-4">
                    <Input label="Nome" value={currentClass.name || ''} onChange={e => setCurrentClass({...currentClass, name: e.target.value})} placeholder="Ex: 3º Ano A" />
                    <Input label="Ano" type="number" value={currentClass.year} onChange={e => setCurrentClass({...currentClass, year: parseInt(e.target.value)})} />
                    <Select label="Instituição" value={currentClass.institutionId} onChange={e => setCurrentClass({...currentClass, institutionId: e.target.value})}>
                        {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </Select>
                </div>
            </Modal>
        </div>
    );
};

// --- NOVOS COMPONENTES STEP ---

const StepCard: React.FC<{
    stepNumber: number;
    title: string;
    singularName: string;
    inputValue: string;
    setInputValue: (v: string) => void;
    onAdd: () => void;
    children: React.ReactNode;
    disabled?: boolean;
    placeholder?: string;
    parentName?: string;
}> = ({ stepNumber, title, singularName, inputValue, setInputValue, onAdd, children, disabled, placeholder, parentName }) => {
    return (
        <div className={`flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ${disabled ? 'opacity-50 pointer-events-none bg-slate-50' : ''}`}>
            <div className="p-3 border-b bg-slate-50 shrink-0">
                <div className="flex items-center gap-2 mb-1">
                    <div className="bg-brand-blue text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                        {stepNumber}
                    </div>
                    <h3 className="font-bold text-slate-800 text-sm">{title}</h3>
                </div>
                {parentName ? (
                     <div className="text-xs text-slate-500 truncate px-1" title={parentName}>Em: <strong className="text-slate-700">{parentName}</strong></div>
                ) : <div className="h-4"></div>}
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar min-h-0 relative">
                {disabled ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 text-center p-4 text-sm">
                        <div className="mb-2 opacity-50"><Icons.ArrowLeft /></div>
                        <p>{placeholder}</p>
                    </div>
                ) : (
                    children
                )}
            </div>

            <div className="p-2 border-t bg-slate-50 flex gap-2 shrink-0">
                <input 
                    className="flex-1 border border-slate-300 rounded px-2 py-1.5 text-sm outline-none focus:border-brand-blue transition-colors disabled:bg-slate-100" 
                    placeholder={`Novo(a) ${singularName}...`}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && onAdd()}
                    disabled={disabled}
                />
                <button 
                    onClick={onAdd} 
                    disabled={disabled || !inputValue.trim()} 
                    className="bg-brand-blue text-white rounded px-3 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <Icons.Plus />
                </button>
            </div>
        </div>
    );
};

const StepItem: React.FC<{
    label: string;
    active: boolean;
    onClick: () => void;
    onDelete: () => void;
    onEdit: () => void;
}> = ({ label, active, onClick, onDelete, onEdit }) => (
    <div 
        onClick={onClick}
        className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer text-sm transition-all border ${active ? 'bg-blue-50 text-brand-blue font-bold border-blue-200 shadow-sm' : 'hover:bg-slate-50 text-slate-700 border-transparent hover:border-slate-200'}`}
    >
        <span className="truncate flex-1 mr-2" title={label}>{label}</span>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-inherit">
            <button 
                onClick={(e) => { e.stopPropagation(); onEdit(); }} 
                className="p-1 hover:bg-white rounded text-slate-400 hover:text-brand-blue transition-colors"
                title="Editar"
            >
                <Icons.Edit />
            </button>
            <button 
                onClick={(e) => { e.stopPropagation(); onDelete(); }} 
                className="p-1 hover:bg-white rounded text-slate-400 hover:text-red-500 transition-colors"
                title="Excluir"
            >
                <Icons.Trash />
            </button>
        </div>
    </div>
);

const HierarchyPage = () => {
    const [hierarchy, setHierarchy] = useState<Discipline[]>([]);
    const [selDisc, setSelDisc] = useState<Discipline | null>(null);
    const [selChap, setSelChap] = useState<Chapter | null>(null);
    const [selUnit, setSelUnit] = useState<Unit | null>(null);
    const [inputD, setInputD] = useState('');
    const [inputC, setInputC] = useState('');
    const [inputU, setInputU] = useState('');
    const [inputT, setInputT] = useState('');
    const [editingItem, setEditingItem] = useState<{ type: 'discipline'|'chapter'|'unit'|'topic', id: string, name: string } | null>(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        const data = await FirebaseService.getHierarchy();
        setHierarchy(data);
        if (selDisc) {
            const d = data.find(x => x.id === selDisc.id);
            setSelDisc(d || null);
            if (d && selChap) {
                const c = d.chapters.find(x => x.id === selChap.id);
                setSelChap(c || null);
                if (c && selUnit) {
                    const u = c.units.find(x => x.id === selUnit.id);
                    setSelUnit(u || null);
                } else setSelUnit(null);
            } else setSelChap(null);
        }
    };

    const handleAdd = async (level: string) => {
        if (level === 'D' && inputD) { await FirebaseService.addDiscipline(inputD); setInputD(''); }
        if (level === 'C' && selDisc && inputC) { await FirebaseService.addChapter(selDisc.id, inputC); setInputC(''); }
        if (level === 'U' && selDisc && selChap && inputU) { await FirebaseService.addUnit(selDisc.id, selChap.id, inputU); setInputU(''); }
        if (level === 'T' && selDisc && selChap && selUnit && inputT) { await FirebaseService.addTopic(selDisc.id, selChap.id, selUnit.id, inputT); setInputT(''); }
        loadData();
    };

    const handleDelete = async (type: 'discipline'|'chapter'|'unit'|'topic', id: string) => {
        if (!confirm('Tem certeza que deseja excluir? Todos os itens dentro deste serão apagados.')) return;
        const ids: any = {};
        if (type === 'discipline') ids.dId = id;
        if (type === 'chapter') ids.cId = id;
        if (type === 'unit') ids.uId = id;
        if (type === 'topic') ids.tId = id;
        try {
            await FirebaseService.deleteItem(type, ids);
            if (type === 'discipline' && selDisc?.id === id) setSelDisc(null);
            if (type === 'chapter' && selChap?.id === id) setSelChap(null);
            if (type === 'unit' && selUnit?.id === id) setSelUnit(null);
            await loadData();
        } catch (error: any) { console.error("Delete error:", error); alert(`Erro ao excluir: ${error.message || 'Tente novamente.'}`); }
    };

    const handleUpdateName = async () => {
        if (editingItem && editingItem.name.trim()) {
            await FirebaseService.updateHierarchyItem(editingItem.type, editingItem.id, editingItem.name);
            setEditingItem(null);
            loadData();
        }
    };

    return (
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="flex justify-between items-end shrink-0">
                <div>
                    <h2 className="text-3xl font-display font-bold text-brand-dark">Conteúdos</h2>
                    <p className="text-slate-500">Organize sua estrutura curricular.</p>
                </div>
                <div className="text-sm text-slate-400 hidden md:flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-lg">
                    <span>💡 Use o campo azul no rodapé de cada coluna para adicionar novos itens.</span>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1 min-h-0">
                <StepCard stepNumber={1} title="Disciplinas" singularName="Disciplina" inputValue={inputD} setInputValue={setInputD} onAdd={() => handleAdd('D')}>
                    {hierarchy.map(d => (
                        <StepItem key={d.id} label={d.name} active={selDisc?.id === d.id} onClick={() => { setSelDisc(d); setSelChap(null); setSelUnit(null); }} onDelete={() => handleDelete('discipline', d.id)} onEdit={() => setEditingItem({ type: 'discipline', id: d.id, name: d.name })} />
                    ))}
                </StepCard>
                <StepCard stepNumber={2} title="Capítulos" singularName="Capítulo" disabled={!selDisc} placeholder="Selecione uma Disciplina para ver os Capítulos" parentName={selDisc?.name} inputValue={inputC} setInputValue={setInputC} onAdd={() => handleAdd('C')}>
                    {selDisc?.chapters.map(c => (
                        <StepItem key={c.id} label={c.name} active={selChap?.id === c.id} onClick={() => { setSelChap(c); setSelUnit(null); }} onDelete={() => handleDelete('chapter', c.id)} onEdit={() => setEditingItem({ type: 'chapter', id: c.id, name: c.name })} />
                    ))}
                </StepCard>
                <StepCard stepNumber={3} title="Unidades" singularName="Unidade" disabled={!selChap} placeholder="Selecione uma Capítulo para ver as Unidades" parentName={selChap?.name} inputValue={inputU} setInputValue={setInputU} onAdd={() => handleAdd('U')}>
                    {selChap?.units.map(u => (
                        <StepItem key={u.id} label={u.name} active={selUnit?.id === u.id} onClick={() => setSelUnit(u)} onDelete={() => handleDelete('unit', u.id)} onEdit={() => setEditingItem({ type: 'unit', id: u.id, name: u.name })} />
                    ))}
                </StepCard>
                <StepCard stepNumber={4} title="Tópicos" singularName="Tópico" disabled={!selUnit} placeholder="Selecione uma Unidade para ver os Tópicos" parentName={selUnit?.name} inputValue={inputT} setInputValue={setInputT} onAdd={() => handleAdd('T')}>
                    {selUnit?.topics.map(t => (
                        <StepItem key={t.id} label={t.name} active={false} onClick={() => {}} onDelete={() => handleDelete('topic', t.id)} onEdit={() => setEditingItem({ type: 'topic', id: t.id, name: t.name })} />
                    ))}
                </StepCard>
            </div>

            <Modal isOpen={!!editingItem} onClose={() => setEditingItem(null)} title="Editar Nome" footer={<Button onClick={handleUpdateName}>Salvar</Button>} maxWidth="max-w-sm">
                <div className="pt-2">
                    <Input value={editingItem?.name || ''} onChange={e => setEditingItem(prev => prev ? ({...prev, name: e.target.value}) : null)} autoFocus />
                </div>
            </Modal>
        </div>
    );
};

const QuestionsPage = () => {
    const [questions, setQuestions] = useState<Question[]>([]);
    const [hierarchy, setHierarchy] = useState<Discipline[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [currentQ, setCurrentQ] = useState<Partial<Question>>({});
    const [loading, setLoading] = useState(false);

    // AI Generation State
    const [genTopic, setGenTopic] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    // PDF Import State
    const [showPdfModal, setShowPdfModal] = useState(false);
    const [importing, setImporting] = useState(false);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        const qs = await FirebaseService.getQuestions();
        const hier = await FirebaseService.getHierarchy();
        setQuestions(qs);
        setHierarchy(hier);
    };

    const handleSave = async () => {
        if (!currentQ.enunciado || !currentQ.disciplineId) return alert('Preencha os campos obrigatórios');
        
        // Validation for MC
        if (currentQ.type === QuestionType.MULTIPLE_CHOICE) {
             if (!currentQ.options || currentQ.options.length < 2) return alert('Adicione pelo menos 2 alternativas.');
             if (!currentQ.options.some(o => o.isCorrect)) return alert('Marque a alternativa correta.');
        }

        setLoading(true);
        const qToSave = {
            ...currentQ,
            createdAt: currentQ.createdAt || new Date().toISOString()
        } as Question;

        if (currentQ.id) await FirebaseService.updateQuestion(qToSave);
        else await FirebaseService.addQuestion(qToSave);

        setLoading(false);
        setShowModal(false);
        loadData();
    };

    const handleDelete = async (id: string) => {
        if(confirm('Excluir questão?')) {
            await FirebaseService.deleteQuestion(id);
            loadData();
        }
    };

    const handleNew = () => {
        setCurrentQ({
            type: QuestionType.MULTIPLE_CHOICE,
            difficulty: 'Medium',
            options: [
                { id: '1', text: '', isCorrect: false },
                { id: '2', text: '', isCorrect: false },
                { id: '3', text: '', isCorrect: false },
                { id: '4', text: '', isCorrect: false }
            ],
            disciplineId: '', chapterId: '', unitId: '', topicId: ''
        });
        setShowModal(true);
    };

    const handleEdit = (q: Question) => {
        setCurrentQ(JSON.parse(JSON.stringify(q)));
        setShowModal(true);
    };

    const handleGenerateAI = async () => {
        if (!genTopic) return alert('Digite um tópico para gerar a questão.');
        setIsGenerating(true);
        const generated = await GeminiService.generateQuestion(genTopic, currentQ.type || QuestionType.MULTIPLE_CHOICE, currentQ.difficulty || 'Medium');
        setIsGenerating(false);
        
        if (generated) {
            setCurrentQ(prev => ({
                ...prev,
                enunciado: generated.enunciado,
                options: generated.options
            }));
        } else {
            alert('Falha ao gerar questão. Tente novamente.');
        }
    };

    const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        try {
            const text = await PdfService.extractText(file);
            const parsed = await GeminiService.parseQuestionsFromText(text);
            
            if(parsed.length > 0) {
                if(confirm(`${parsed.length} questões encontradas. Deseja importar todas?`)) {
                    for(const q of parsed) {
                         const qToAdd = {
                             ...q,
                             id: '', // Dummy ID
                             createdAt: new Date().toISOString(),
                             disciplineId: hierarchy[0]?.id || '', // Fallback
                             chapterId: '', unitId: '', topicId: '',
                             difficulty: q.difficulty || 'Medium'
                         } as Question;
                         await FirebaseService.addQuestion(qToAdd);
                    }
                    loadData();
                    setShowPdfModal(false);
                    alert('Importação concluída!');
                }
            } else {
                alert('Nenhuma questão identificada no PDF.');
            }

        } catch (error) {
            console.error(error);
            alert('Erro ao processar PDF.');
        }
        setImporting(false);
    };

    // Helper to render hierarchy selectors in Modal
    const renderHierarchySelectors = () => {
        const d = hierarchy.find(x => x.id === currentQ.disciplineId);
        const c = d?.chapters.find(x => x.id === currentQ.chapterId);
        const u = c?.units.find(x => x.id === currentQ.unitId);

        return (
            <div className="grid grid-cols-2 gap-4">
                <Select label="Disciplina" value={currentQ.disciplineId || ''} onChange={e => setCurrentQ({...currentQ, disciplineId: e.target.value, chapterId: '', unitId: '', topicId: ''})}>
                    <option value="">Selecione...</option>
                    {hierarchy.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </Select>
                <Select label="Capítulo" value={currentQ.chapterId || ''} onChange={e => setCurrentQ({...currentQ, chapterId: e.target.value, unitId: '', topicId: ''})} disabled={!currentQ.disciplineId}>
                    <option value="">Selecione...</option>
                    {d?.chapters.map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
                </Select>
                <Select label="Unidade" value={currentQ.unitId || ''} onChange={e => setCurrentQ({...currentQ, unitId: e.target.value, topicId: ''})} disabled={!currentQ.chapterId}>
                    <option value="">Selecione...</option>
                    {c?.units.map(un => <option key={un.id} value={un.id}>{un.name}</option>)}
                </Select>
                <Select label="Tópico" value={currentQ.topicId || ''} onChange={e => setCurrentQ({...currentQ, topicId: e.target.value})} disabled={!currentQ.unitId}>
                    <option value="">Selecione...</option>
                    {u?.topics.map(tp => <option key={tp.id} value={tp.id}>{tp.name}</option>)}
                </Select>
            </div>
        );
    };

    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar space-y-6">
            <div className="flex justify-between items-center">
                 <h2 className="text-3xl font-display font-bold text-brand-dark">Banco de Questões</h2>
                 <div className="flex gap-2">
                     <Button variant="secondary" onClick={() => setShowPdfModal(true)}><Icons.Pdf /> Importar PDF</Button>
                     <Button onClick={handleNew}><Icons.Plus /> Nova Questão</Button>
                 </div>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 gap-4">
                {questions.length === 0 ? (
                    <div className="text-center py-20 text-slate-400 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                        <Icons.Questions />
                        <p className="mt-2">Nenhuma questão cadastrada.</p>
                    </div>
                ) : (
                    questions.map(q => (
                        <div key={q.id} className="bg-white p-4 rounded-lg border hover:shadow-md transition-shadow flex gap-4 group">
                            <div className="flex-1">
                                 <div className="flex gap-2 mb-2 text-xs">
                                     <Badge color="blue">{QuestionTypeLabels[q.type]}</Badge>
                                     <Badge color={q.difficulty === 'Hard' ? 'red' : q.difficulty === 'Medium' ? 'yellow' : 'green'}>{q.difficulty}</Badge>
                                     <span className="text-slate-400 font-medium ml-2">{FirebaseService.getFullHierarchyString(q, hierarchy)}</span>
                                 </div>
                                 <div className="text-slate-800 rich-text-content line-clamp-2" dangerouslySetInnerHTML={{__html: q.enunciado}} />
                            </div>
                            <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity justify-center">
                                <Button variant="ghost" onClick={() => handleEdit(q)}><Icons.Edit /></Button>
                                <Button variant="ghost" onClick={() => handleDelete(q.id)} className="text-red-500"><Icons.Trash /></Button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal Edit/Create */}
            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Questão" maxWidth="max-w-4xl" footer={<Button onClick={handleSave} disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</Button>}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
                    {/* Left: Configuration */}
                    <div className="md:col-span-1 space-y-4 border-r pr-4 overflow-y-auto custom-scrollbar">
                        <h4 className="font-bold text-slate-700">Classificação</h4>
                        {renderHierarchySelectors()}
                        
                        <div className="border-t pt-4"></div>
                        <h4 className="font-bold text-slate-700">Detalhes</h4>
                        <Select label="Tipo" value={currentQ.type} onChange={e => setCurrentQ({...currentQ, type: e.target.value as QuestionType})}>
                             {Object.entries(QuestionTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </Select>
                        <Select label="Dificuldade" value={currentQ.difficulty} onChange={e => setCurrentQ({...currentQ, difficulty: e.target.value as any})}>
                            <option value="Easy">Fácil</option>
                            <option value="Medium">Média</option>
                            <option value="Hard">Difícil</option>
                        </Select>

                        <div className="bg-blue-50 p-4 rounded-lg mt-6 border border-blue-100">
                             <h4 className="font-bold text-blue-800 text-sm mb-2 flex items-center gap-2"><Icons.Sparkles /> IA Gemini</h4>
                             <p className="text-xs text-blue-600 mb-3">Gere o enunciado e alternativas automaticamente.</p>
                             <Input placeholder="Tópico (ex: Revolução Francesa)" value={genTopic} onChange={e => setGenTopic(e.target.value)} className="mb-2 text-sm" />
                             <Button onClick={handleGenerateAI} disabled={isGenerating} className="w-full text-xs" variant="secondary">
                                 {isGenerating ? 'Gerando...' : 'Gerar Questão'}
                             </Button>
                        </div>
                    </div>

                    {/* Right: Content */}
                    <div className="md:col-span-2 space-y-4 overflow-y-auto custom-scrollbar">
                        <RichTextEditor label="Enunciado da Questão" value={currentQ.enunciado || ''} onChange={(html) => setCurrentQ({...currentQ, enunciado: html})} />
                        
                        {currentQ.type === QuestionType.MULTIPLE_CHOICE && (
                            <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <h4 className="font-bold text-slate-700">Alternativas</h4>
                                {currentQ.options?.map((opt, idx) => (
                                    <div key={idx} className="flex gap-2 items-center">
                                        <input 
                                            type="radio" 
                                            name="correctOpt" 
                                            checked={opt.isCorrect} 
                                            onChange={() => {
                                                const newOpts = currentQ.options?.map((o, i) => ({ ...o, isCorrect: i === idx }));
                                                setCurrentQ({...currentQ, options: newOpts});
                                            }}
                                            className="w-4 h-4 text-brand-blue"
                                        />
                                        <Input 
                                            value={opt.text} 
                                            onChange={e => {
                                                const newOpts = [...(currentQ.options || [])];
                                                newOpts[idx].text = e.target.value;
                                                setCurrentQ({...currentQ, options: newOpts});
                                            }}
                                            placeholder={`Alternativa ${String.fromCharCode(65+idx)}`}
                                        />
                                        <button onClick={() => {
                                            const newOpts = currentQ.options?.filter((_, i) => i !== idx);
                                            setCurrentQ({...currentQ, options: newOpts});
                                        }} className="text-red-400 hover:text-red-600"><Icons.Trash /></button>
                                    </div>
                                ))}
                                <Button variant="ghost" onClick={() => setCurrentQ({...currentQ, options: [...(currentQ.options || []), {id: Date.now().toString(), text: '', isCorrect: false}]})} className="text-xs">+ Adicionar Alternativa</Button>
                            </div>
                        )}
                        
                        {currentQ.type === QuestionType.TRUE_FALSE && (
                            <div className="p-4 bg-slate-50 rounded text-sm text-slate-600">
                                O aluno deverá marcar Verdadeiro ou Falso. (Configure o gabarito se necessário).
                            </div>
                        )}
                    </div>
                </div>
            </Modal>

            {/* Modal PDF Import */}
            <Modal isOpen={showPdfModal} onClose={() => setShowPdfModal(false)} title="Importar de PDF" maxWidth="max-w-md">
                <div className="space-y-4 text-center p-6">
                    <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Icons.Pdf />
                    </div>
                    <p className="text-slate-600">Selecione um arquivo PDF contendo provas ou listas de exercícios. A IA tentará identificar e extrair as questões automaticamente.</p>
                    
                    <label className="block">
                        <span className="sr-only">Escolher arquivo</span>
                        <input type="file" accept=".pdf" onChange={handlePdfUpload} className="block w-full text-sm text-slate-500
                          file:mr-4 file:py-2 file:px-4
                          file:rounded-full file:border-0
                          file:text-sm file:font-semibold
                          file:bg-brand-blue file:text-white
                          hover:file:bg-blue-700
                        "/>
                    </label>

                    {importing && <p className="text-brand-blue font-bold animate-pulse">Processando arquivo e analisando com IA...</p>}
                </div>
            </Modal>
        </div>
    );
};

// PAGE: EXAMS (Gerenciador de Provas)
const ExamsPage = () => {
    const [exams, setExams] = useState<Exam[]>([]);
    const [showModal, setShowModal] = useState(false);
    
    // --- ESTADO DO WIZARD DE CRIAÇÃO ---
    const [step, setStep] = useState(1);
    const [draftExam, setDraftExam] = useState<Partial<Exam>>({
        title: '',
        headerText: '',
        institutionId: '',
        columns: 1,
        instructions: '<ul><li>Leia atentamente as questões.</li><li>Use caneta azul ou preta.</li></ul>',
        contentScopes: [],
        questions: [],
        showAnswerKey: false
    });

    // Dados auxiliares para o wizard
    const [institutions, setInstitutions] = useState<Institution[]>([]);
    const [hierarchy, setHierarchy] = useState<Discipline[]>([]);
    const [allQuestions, setAllQuestions] = useState<Question[]>([]);
    
    // Filtros do Passo 2 (Conteúdo)
    const [selDisc, setSelDisc] = useState('');
    const [selChap, setSelChap] = useState('');
    const [selUnit, setSelUnit] = useState('');
    const [selTopic, setSelTopic] = useState('');
    const [selCount, setSelCount] = useState(1);

    // Filtros do Passo 3 (Questões)
    const [genMode, setGenMode] = useState<'manual'|'auto'>('manual');
    const [filteredQuestions, setFilteredQuestions] = useState<Question[]>([]);
    const [viewingQuestion, setViewingQuestion] = useState<Question | null>(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        const data = await FirebaseService.getExams();
        const insts = await FirebaseService.getInstitutions();
        const hier = await FirebaseService.getHierarchy();
        const qs = await FirebaseService.getQuestions();
        setExams(data);
        setInstitutions(insts);
        setHierarchy(hier);
        setAllQuestions(qs);
    };

    // --- LÓGICA DO WIZARD ---

    const handleOpenWizard = () => {
        setStep(1);
        setDraftExam({
            title: '',
            headerText: '',
            institutionId: institutions.length > 0 ? institutions[0].id : '',
            columns: 1,
            instructions: '<ul><li>Leia atentamente as questões.</li><li>Use caneta azul ou preta.</li></ul>',
            contentScopes: [],
            questions: [],
            showAnswerKey: false
        });
        setSelDisc(''); setSelChap(''); setSelUnit(''); setSelTopic(''); setSelCount(1);
        setShowModal(true);
    };

    const handleEditExam = (exam: Exam) => {
        setDraftExam({ ...exam });
        setStep(1);
        setShowModal(true);
    };

    const handleDeleteExam = async (id: string) => {
        if (confirm('Tem certeza que deseja excluir esta prova permanentemente?')) {
            await FirebaseService.deleteExam(id);
            loadData();
        }
    };

    const handleAddContentScope = () => {
        if (!selDisc) return;
        const d = hierarchy.find(x => x.id === selDisc);
        const c = d?.chapters.find(x => x.id === selChap);
        const u = c?.units.find(x => x.id === selUnit);
        const t = u?.topics.find(x => x.id === selTopic);

        const newScope: ExamContentScope = {
            id: Date.now().toString(),
            disciplineId: selDisc,
            disciplineName: d?.name || '',
            chapterId: selChap,
            chapterName: c?.name,
            unitId: selUnit,
            unitName: u?.name,
            topicId: selTopic,
            topicName: t?.name,
            questionCount: selCount
        };

        setDraftExam(prev => ({ ...prev, contentScopes: [...(prev.contentScopes || []), newScope] }));
    };

    const handleRemoveScope = (id: string) => {
        setDraftExam(prev => ({ ...prev, contentScopes: prev.contentScopes?.filter(s => s.id !== id) }));
    };

    // Filter questions whenever step 3 opens or scopes change
    useEffect(() => {
        if (step === 3 && draftExam.contentScopes) {
            // Filtra questões que batem com ALGUM dos escopos definidos
            const relevant = allQuestions.filter(q => {
                return draftExam.contentScopes?.some(scope => {
                    // Check hierarchy match (more specific matches override less specific)
                    if (q.disciplineId !== scope.disciplineId) return false;
                    if (scope.chapterId && q.chapterId !== scope.chapterId) return false;
                    if (scope.unitId && q.unitId !== scope.unitId) return false;
                    if (scope.topicId && q.topicId !== scope.topicId) return false;
                    return true;
                });
            });
            setFilteredQuestions(relevant);
        }
    }, [step, draftExam.contentScopes, allQuestions]);

    const handleAutoGenerate = () => {
        let newSelectedQuestions: Question[] = [];
        
        draftExam.contentScopes?.forEach(scope => {
            // 1. Filtrar
            const pool = allQuestions.filter(q => {
                if (q.disciplineId !== scope.disciplineId) return false;
                if (scope.chapterId && q.chapterId !== scope.chapterId) return false;
                if (scope.unitId && q.unitId !== scope.unitId) return false;
                if (scope.topicId && q.topicId !== scope.topicId) return false;
                return true;
            });

            // 2. Embaralhar (Shuffle)
            const shuffled = [...pool].sort(() => 0.5 - Math.random());

            // 3. Selecionar Qtd
            const selected = shuffled.slice(0, scope.questionCount);
            newSelectedQuestions = [...newSelectedQuestions, ...selected];
        });

        setDraftExam(prev => ({ ...prev, questions: newSelectedQuestions }));
    };

    const toggleQuestionSelection = (q: Question) => {
        setDraftExam(prev => {
            const exists = prev.questions?.find(x => x.id === q.id);
            let newQs = prev.questions || [];
            if (exists) {
                newQs = newQs.filter(x => x.id !== q.id);
            } else {
                newQs = [...newQs, q];
            }
            return { ...prev, questions: newQs };
        });
    };

    const handleFinish = async () => {
        if (!draftExam.title) return alert("Dê um título para a prova.");
        if (!draftExam.questions || draftExam.questions.length === 0) return alert("Selecione ao menos uma questão.");
        
        // Sanitização profunda para remover valores undefined que quebram o Firestore
        const cleanData = JSON.parse(JSON.stringify({
            ...draftExam,
            id: draftExam.id || '',
            createdAt: draftExam.createdAt || new Date().toISOString()
        }));

        try {
            await FirebaseService.saveExam(cleanData as Exam);
            setShowModal(false);
            loadData();
        } catch (error: any) {
            console.error("Erro ao salvar:", error);
            alert(`Erro ao salvar prova: ${error.message || 'Verifique os dados e tente novamente.'}`);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    // --- RENDER WIZARD STEPS ---

    const renderStep1 = () => (
        <div className="space-y-4 animate-fade-in h-full overflow-y-auto custom-scrollbar p-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Título da Prova *" value={draftExam.title} onChange={e => setDraftExam({...draftExam, title: e.target.value})} placeholder="Ex: Avaliação Bimestral 3º Ano" autoFocus />
                <Select label="Instituição" value={draftExam.institutionId} onChange={e => setDraftExam({...draftExam, institutionId: e.target.value})}>
                    {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </Select>
            </div>
            <Input label="Cabeçalho / Subtítulo" value={draftExam.headerText} onChange={e => setDraftExam({...draftExam, headerText: e.target.value})} placeholder="Ex: Professor Carlos - Matemática" />
            
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <label className="text-sm font-semibold text-slate-700 block mb-2">Layout da Prova</label>
                <div className="flex gap-4">
                    <label className={`flex-1 border p-3 rounded cursor-pointer transition-all flex items-center justify-center gap-2 ${draftExam.columns === 1 ? 'bg-blue-50 border-brand-blue text-brand-blue ring-1 ring-brand-blue' : 'bg-white hover:bg-slate-50'}`}>
                        <input type="radio" name="cols" className="hidden" checked={draftExam.columns === 1} onChange={() => setDraftExam({...draftExam, columns: 1})} />
                        <div className="w-4 h-6 border-2 border-current rounded-sm"></div>
                        <span>1 Coluna</span>
                    </label>
                    <label className={`flex-1 border p-3 rounded cursor-pointer transition-all flex items-center justify-center gap-2 ${draftExam.columns === 2 ? 'bg-blue-50 border-brand-blue text-brand-blue ring-1 ring-brand-blue' : 'bg-white hover:bg-slate-50'}`}>
                        <input type="radio" name="cols" className="hidden" checked={draftExam.columns === 2} onChange={() => setDraftExam({...draftExam, columns: 2})} />
                        <div className="flex gap-0.5">
                            <div className="w-2 h-6 border-2 border-current rounded-sm"></div>
                            <div className="w-2 h-6 border-2 border-current rounded-sm"></div>
                        </div>
                        <span>2 Colunas</span>
                    </label>
                </div>
            </div>

            <RichTextEditor label="Instruções da Prova" value={draftExam.instructions || ''} onChange={(html) => setDraftExam({...draftExam, instructions: html})} />
        </div>
    );

    const renderStep2 = () => {
        const selectedD = hierarchy.find(d => d.id === selDisc);
        const selectedC = selectedD?.chapters.find(c => c.id === selChap);
        const selectedU = selectedC?.units.find(u => u.id === selUnit);

        return (
            <div className="space-y-6 animate-fade-in h-full overflow-y-auto custom-scrollbar p-1">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-blue-800 shrink-0">
                    <p>Adicione os tópicos que cairão na prova e defina a quantidade de questões para cada um.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end bg-slate-50 p-4 rounded-xl border border-slate-200 shrink-0">
                    <div className="md:col-span-3">
                        <Select label="Disciplina" value={selDisc} onChange={e => { setSelDisc(e.target.value); setSelChap(''); setSelUnit(''); setSelTopic(''); }}>
                            <option value="">Selecione...</option>
                            {hierarchy.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </Select>
                    </div>
                    <div className="md:col-span-2">
                        <Select label="Capítulo" value={selChap} onChange={e => { setSelChap(e.target.value); setSelUnit(''); setSelTopic(''); }} disabled={!selDisc}>
                            <option value="">Todos</option>
                            {selectedD?.chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </Select>
                    </div>
                    <div className="md:col-span-2">
                        <Select label="Unidade" value={selUnit} onChange={e => { setSelUnit(e.target.value); setSelTopic(''); }} disabled={!selChap}>
                            <option value="">Todas</option>
                            {selectedC?.units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </Select>
                    </div>
                    <div className="md:col-span-3">
                        <Select label="Tópico" value={selTopic} onChange={e => setSelTopic(e.target.value)} disabled={!selUnit}>
                            <option value="">Todos</option>
                            {selectedU?.topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </Select>
                    </div>
                    <div className="md:col-span-1">
                        <Input label="Qtd." type="number" min="1" value={selCount} onChange={e => setSelCount(parseInt(e.target.value))} />
                    </div>
                    <div className="md:col-span-1">
                        <Button onClick={handleAddContentScope} disabled={!selDisc} className="w-full mb-[1px]">+</Button>
                    </div>
                </div>

                <div>
                    <h4 className="font-bold text-slate-700 mb-2">Conteúdos Selecionados ({draftExam.contentScopes?.length})</h4>
                    <div className="space-y-2">
                        {draftExam.contentScopes?.length === 0 && <p className="text-slate-400 italic text-sm">Nenhum conteúdo adicionado.</p>}
                        {draftExam.contentScopes?.map(scope => {
                            const available = allQuestions.filter(q => {
                                if (q.disciplineId !== scope.disciplineId) return false;
                                if (scope.chapterId && q.chapterId !== scope.chapterId) return false;
                                if (scope.unitId && q.unitId !== scope.unitId) return false;
                                if (scope.topicId && q.topicId !== scope.topicId) return false;
                                return true;
                            }).length;

                            return (
                                <div key={scope.id} className="flex justify-between items-center bg-white p-3 rounded border border-slate-200 shadow-sm">
                                    <div className="text-sm flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge color={scope.questionCount > available ? 'red' : 'blue'}>
                                                {scope.questionCount} / {available} disp.
                                            </Badge>
                                            <span className="font-bold text-brand-blue">{scope.disciplineName}</span>
                                        </div>
                                        <div className="text-slate-500 text-xs">
                                            {scope.chapterName && <span> &gt; {scope.chapterName}</span>}
                                            {scope.unitName && <span> &gt; {scope.unitName}</span>}
                                            {scope.topicName && <span> &gt; {scope.topicName}</span>}
                                            <span className="ml-2 text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-semibold">
                                                {scope.topicName ? 'Tópico Específico' : scope.unitName ? 'Toda a Unidade' : scope.chapterName ? 'Todo o Capítulo' : 'Toda a Disciplina'}
                                            </span>
                                        </div>
                                    </div>
                                    <button onClick={() => handleRemoveScope(scope.id)} className="text-red-400 hover:text-red-600 p-1"><Icons.Trash /></button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    const renderStep3 = () => {
        // Calcula o total de questões solicitadas
        const totalRequested = draftExam.contentScopes?.reduce((acc, scope) => acc + scope.questionCount, 0) || 0;
        
        return (
            <div className="space-y-4 animate-fade-in h-full flex flex-col min-h-0">
                <div className="flex justify-center gap-4 mb-4 shrink-0">
                    <button 
                        onClick={() => setGenMode('manual')}
                        className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${genMode === 'manual' ? 'bg-brand-blue text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                        Seleção Manual
                    </button>
                    <button 
                        onClick={() => setGenMode('auto')}
                        className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${genMode === 'auto' ? 'bg-brand-blue text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                        Gerar Automaticamente
                    </button>
                </div>

                {genMode === 'manual' ? (
                    <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                        <div className="flex justify-between items-center mb-2 px-1 shrink-0">
                           <span className="text-sm text-slate-500">
                               Selecione as questões que deseja incluir. 
                               <span className="text-brand-blue font-semibold ml-1">Selecionadas no topo.</span>
                           </span>
                           {draftExam.questions && draftExam.questions.length > 0 && (
                               <button 
                                   onClick={() => setDraftExam(prev => ({...prev, questions: []}))}
                                   className="text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1 rounded transition-colors"
                               >
                                   Desmarcar Todas
                               </button>
                           )}
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar border rounded-lg bg-white divide-y divide-slate-100">
                            {filteredQuestions.length === 0 ? (
                                <div className="p-8 text-center text-slate-400">Nenhuma questão encontrada para os conteúdos selecionados.</div>
                            ) : (
                                // SORTING LOGIC: Selected First
                                [...filteredQuestions].sort((a, b) => {
                                    const isA = draftExam.questions?.some(sel => sel.id === a.id) ? 1 : 0;
                                    const isB = draftExam.questions?.some(sel => sel.id === b.id) ? 1 : 0;
                                    return isB - isA;
                                }).map(q => {
                                    const isSelected = draftExam.questions?.some(sel => sel.id === q.id);
                                    return (
                                        <div key={q.id} onClick={() => toggleQuestionSelection(q)} className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors flex gap-3 ${isSelected ? 'bg-blue-50/70' : ''}`}>
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-1 transition-colors ${isSelected ? 'bg-brand-blue border-brand-blue text-white' : 'border-slate-300 bg-white'}`}>
                                                {isSelected && <Icons.Check />}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex gap-2 text-xs mb-1">
                                                    <Badge color="blue">{QuestionTypeLabels[q.type]}</Badge>
                                                    <Badge color={q.difficulty === 'Hard' ? 'red' : q.difficulty === 'Medium' ? 'yellow' : 'green'}>{q.difficulty}</Badge>
                                                </div>
                                                <div className="text-sm text-slate-800 line-clamp-3 rich-text-content" dangerouslySetInnerHTML={{__html: q.enunciado}} />
                                            </div>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setViewingQuestion(q); }}
                                                className="self-center p-2 text-slate-400 hover:text-brand-blue hover:bg-blue-50 rounded-full transition-colors flex-shrink-0"
                                                title="Visualizar questão completa"
                                            >
                                                <Icons.Eye />
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                        <div className="mt-2 text-right font-bold text-brand-dark shrink-0">
                            {draftExam.questions?.length} questões selecionadas
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
                        <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 text-center mb-4 shrink-0">
                            <Icons.Sparkles />
                            <h3 className="text-lg font-bold text-blue-800 mt-2">Geração Automática de Prova</h3>
                            <p className="text-sm text-blue-600 mt-1 mb-4">
                                Com base nos conteúdos selecionados no Passo 2, o sistema irá selecionar aleatoriamente 
                                <strong className="font-bold text-blue-900"> {totalRequested} questões</strong> do banco de dados.
                            </p>
                            <Button onClick={handleAutoGenerate} className="mx-auto">
                                {draftExam.questions?.length ? 'Regerar Questões' : 'Gerar Questões Agora'}
                            </Button>
                        </div>

                        {draftExam.questions && draftExam.questions.length > 0 && (
                            <div className="flex-1 flex flex-col animate-fade-in min-h-0">
                                <h4 className="font-bold text-slate-700 mb-2 shrink-0">Resultado da Geração ({draftExam.questions.length} questões):</h4>
                                <div className="border rounded-lg bg-white divide-y divide-slate-100">
                                    {draftExam.questions.map((q, idx) => (
                                        <div key={q.id} className="p-4 flex gap-3 relative group hover:bg-slate-50 transition-colors">
                                            <span className="font-bold text-slate-400 w-6 text-right shrink-0">{idx + 1}.</span>
                                            <div className="flex-1">
                                                <div className="flex gap-2 text-xs mb-1">
                                                    <Badge color="blue">{QuestionTypeLabels[q.type]}</Badge>
                                                    <Badge color={q.difficulty === 'Hard' ? 'red' : q.difficulty === 'Medium' ? 'yellow' : 'green'}>{q.difficulty}</Badge>
                                                </div>
                                                <div className="text-sm text-slate-800 rich-text-content" dangerouslySetInnerHTML={{__html: q.enunciado}} />
                                            </div>
                                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all bg-white/80 backdrop-blur-sm rounded p-1">
                                                <button 
                                                    onClick={() => setViewingQuestion(q)}
                                                    className="p-1.5 text-slate-400 hover:text-brand-blue hover:bg-blue-50 rounded"
                                                    title="Visualizar"
                                                >
                                                    <Icons.Eye />
                                                </button>
                                                <button 
                                                    onClick={() => toggleQuestionSelection(q)}
                                                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded"
                                                    title="Remover questão"
                                                >
                                                    <Icons.Trash />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const renderStep4 = () => {
        const inst = institutions.find(i => i.id === draftExam.institutionId);
        
        return (
            <div className="h-full flex flex-col animate-fade-in print:block print:h-auto print:overflow-visible">
                <div className="bg-slate-800 text-white p-3 rounded-t-lg flex justify-between items-center shrink-0 no-print">
                    <span className="font-bold text-sm">Visualização de Impressão</span>
                    <Button variant="secondary" onClick={handlePrint} className="text-xs h-8"><Icons.Printer /> Imprimir</Button>
                </div>
                
                <div className="flex-1 overflow-y-auto bg-slate-200 p-4 md:p-8 custom-scrollbar print:block print:overflow-visible print:h-auto print:bg-white print:p-0 print:m-0">
                    {/* FOLHA DA PROVA (A4 simulated) */}
                    <div id="printable-section" className="bg-white mx-auto max-w-[210mm] min-h-[297mm] p-[15mm] shadow-lg print:shadow-none print:w-full print:max-w-none print:p-0 text-black box-border">
                        
                        {/* CABEÇALHO */}
                        <div className="border-b-2 border-black pb-4 mb-6 flex gap-4 items-center">
                            {inst?.logoUrl && <img src={inst.logoUrl} alt="Logo" className="h-16 w-auto object-contain" />}
                            <div className="flex-1">
                                <h1 className="text-xl font-bold uppercase text-center">{inst?.name || 'Nome da Instituição'}</h1>
                                <h2 className="text-lg font-semibold text-center mt-1">{draftExam.title}</h2>
                                <p className="text-center text-sm mt-1">{draftExam.headerText}</p>
                            </div>
                        </div>

                        {/* CAMPOS DE IDENTIFICAÇÃO (Atualizado para 3 colunas na segunda linha) */}
                        <div className="grid grid-cols-12 gap-4 mb-6 text-sm font-medium">
                            <div className="col-span-8 flex items-end gap-2">
                                <span className="mb-1">Nome:</span>
                                <div className="flex-1 border-b border-black"></div>
                            </div>
                            <div className="col-span-4 flex items-end gap-2">
                                <span className="mb-1">Data:</span>
                                <div className="flex-1 border-b border-black"></div>
                            </div>
                            {/* Segunda Linha: 3 Colunas */}
                            <div className="col-span-4 flex items-end gap-2">
                                <span className="mb-1">Turma:</span>
                                <div className="flex-1 border-b border-black"></div>
                            </div>
                            <div className="col-span-4 flex items-end gap-2">
                                <span className="mb-1">Matrícula:</span>
                                <div className="flex-1 border-b border-black"></div>
                            </div>
                            <div className="col-span-4 flex items-end gap-2">
                                <span className="mb-1">Nota:</span>
                                <div className="flex-1 border-b border-black"></div>
                            </div>
                        </div>

                        {/* INSTRUÇÕES */}
                        {draftExam.instructions && (
                            <div className="mb-6 p-4 border border-black rounded text-sm bg-slate-50 print:bg-transparent">
                                <strong className="block mb-1 uppercase text-xs">Instruções:</strong>
                                <div className="rich-text-content" dangerouslySetInnerHTML={{ __html: draftExam.instructions }} />
                            </div>
                        )}

                        {/* QUESTÕES */}
                        <div className={`${draftExam.columns === 2 ? 'columns-2 gap-8 [column-rule:1px_solid_#000]' : ''}`}>
                            {draftExam.questions?.map((q, idx) => (
                                <div key={q.id} className="mb-6 break-inside-avoid">
                                    <div className="flex gap-2 mb-1">
                                        <span className="font-bold text-lg">{idx + 1}.</span>
                                        <div className="rich-text-content text-sm text-justify" dangerouslySetInnerHTML={{ __html: q.enunciado }} />
                                    </div>
                                    
                                    {/* Opções */}
                                    {q.type === QuestionType.MULTIPLE_CHOICE && (
                                        <div className="ml-6 space-y-1 mt-2">
                                            {q.options?.map((opt, optIdx) => (
                                                <div key={optIdx} className="flex gap-2 text-sm items-start">
                                                    <span className="font-bold">({String.fromCharCode(97 + optIdx)})</span>
                                                    <span>{opt.text}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {q.type === QuestionType.TRUE_FALSE && (
                                        <div className="ml-6 mt-2 text-sm">
                                            ( &nbsp; ) Verdadeiro &nbsp;&nbsp;&nbsp; ( &nbsp; ) Falso
                                        </div>
                                    )}
                                    {(q.type === QuestionType.SHORT_ANSWER || q.type === QuestionType.NUMERIC) && (
                                        <div className="mt-8 border-b border-black border-dotted w-full"></div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-display font-bold text-brand-dark">Minhas Provas</h2>
                <Button onClick={handleOpenWizard}><Icons.Plus /> Nova Prova</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {exams.length === 0 ? (
                    <div className="col-span-3 text-center py-20 text-slate-400 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                        <div className="mb-3"><Icons.Exams /></div>
                        <p>Nenhuma prova criada ainda.</p>
                        <p className="text-sm">Clique em "Nova Prova" para começar.</p>
                    </div>
                ) : (
                    exams.map(exam => (
                        <Card key={exam.id} className="hover:shadow-md transition-shadow group flex flex-col h-full">
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-3 bg-orange-100 text-brand-orange rounded-lg"><Icons.Exams /></div>
                                <Badge color="blue">{new Date(exam.createdAt).toLocaleDateString()}</Badge>
                            </div>
                            <h3 className="font-bold text-lg text-brand-dark mb-2">{exam.title}</h3>
                            <p className="text-sm text-slate-500 mb-4">{exam.questions?.length || 0} questões</p>
                            <div className="mt-auto pt-4 border-t border-slate-100 flex justify-end gap-2">
                                <Button variant="ghost" className="text-sm" onClick={() => handleEditExam(exam)}>Editar</Button>
                                <Button variant="ghost" className="text-sm text-red-500" onClick={() => handleDeleteExam(exam.id)}><Icons.Trash /></Button>
                            </div>
                        </Card>
                    ))
                )}
            </div>

            {/* WIZARD MODAL */}
            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nova Prova" maxWidth="max-w-6xl" footer={
                <div className="flex justify-between w-full">
                    <Button variant="ghost" onClick={() => step === 1 ? setShowModal(false) : setStep(s => s - 1)}>
                        {step === 1 ? 'Cancelar' : 'Voltar'}
                    </Button>
                    <div className="flex gap-2">
                        {step < 4 ? (
                            <Button onClick={() => setStep(s => s + 1)}>Próximo <Icons.ArrowRight /></Button>
                        ) : (
                            <Button onClick={handleFinish} variant="primary">Finalizar e Salvar <Icons.Check /></Button>
                        )}
                    </div>
                </div>
            }>
                <div className="flex flex-col h-[70vh]">
                    {/* Stepper Header */}
                    <div className="flex justify-between items-center mb-8 px-4 relative shrink-0">
                        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 -z-10 transform -translate-y-1/2"></div>
                        {[
                            { n: 1, l: 'Dados' },
                            { n: 2, l: 'Conteúdo' },
                            { n: 3, l: 'Questões' },
                            { n: 4, l: 'Visualizar' }
                        ].map((s) => (
                            <div key={s.n} className={`flex flex-col items-center gap-2 bg-white px-2 ${step >= s.n ? 'text-brand-blue' : 'text-slate-400'}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all ${step === s.n ? 'bg-brand-blue text-white scale-110 shadow-lg' : step > s.n ? 'bg-blue-100 text-brand-blue border-2 border-brand-blue' : 'bg-slate-100 border-2 border-slate-200'}`}>
                                    {step > s.n ? <Icons.Check /> : s.n}
                                </div>
                                <span className="text-xs font-bold uppercase tracking-wider">{s.l}</span>
                            </div>
                        ))}
                    </div>

                    {/* Step Content */}
                    <div className="flex-1 overflow-hidden flex flex-col bg-white">
                        {step === 1 && renderStep1()}
                        {step === 2 && renderStep2()}
                        {step === 3 && renderStep3()}
                        {step === 4 && renderStep4()}
                    </div>
                </div>
            </Modal>

            {/* Modal de Visualização de Questão */}
            <Modal isOpen={!!viewingQuestion} onClose={() => setViewingQuestion(null)} title="Detalhes da Questão" maxWidth="max-w-2xl">
                 {viewingQuestion && (
                     <div className="space-y-4">
                         <div className="flex gap-2">
                             <Badge>{QuestionTypeLabels[viewingQuestion.type]}</Badge>
                             <Badge color={viewingQuestion.difficulty === 'Hard' ? 'red' : viewingQuestion.difficulty === 'Medium' ? 'yellow' : 'green'}>{viewingQuestion.difficulty}</Badge>
                         </div>
                         <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                             <div className="rich-text-content text-lg" dangerouslySetInnerHTML={{__html: viewingQuestion.enunciado}} />
                         </div>
                         
                         {viewingQuestion.type === QuestionType.MULTIPLE_CHOICE && (
                             <div className="space-y-2 mt-4">
                                 <h4 className="font-bold text-slate-700">Alternativas:</h4>
                                 {viewingQuestion.options?.map((opt, idx) => (
                                     <div key={idx} className={`p-3 rounded border flex gap-3 ${opt.isCorrect ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'}`}>
                                         <span className="font-bold">({String.fromCharCode(97 + idx)})</span>
                                         <span>{opt.text}</span>
                                         {opt.isCorrect && <span className="ml-auto text-green-600 text-xs font-bold bg-green-100 px-2 py-0.5 rounded-full h-fit">Correta</span>}
                                     </div>
                                 ))}
                             </div>
                         )}
                     </div>
                 )}
            </Modal>
        </div>
    );
};

const App = () => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (u) => {
            if (u) {
                const userData = await FirebaseService.getCurrentUserData();
                setUser(userData);
            } else {
                setUser(null);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50 text-brand-blue font-bold animate-pulse">Carregando Prova Fácil...</div>;

    if (!user) return <Login />;

    const NavItem = ({ to, icon: Icon, label }: any) => {
        const location = useLocation();
        const active = location.pathname === to;
        return (
            <Link to={to} className={`flex items-center gap-3 px-6 py-3 transition-colors ${active ? 'bg-slate-800 text-white border-r-4 border-brand-blue' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                <Icon />
                <span className="font-medium">{label}</span>
            </Link>
        );
    };

    return (
        <AuthContext.Provider value={{ user, loading }}>
            <HashRouter>
                <div className="flex h-screen bg-slate-100 font-sans text-slate-900 overflow-hidden">
                    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0">
                        <div className="p-6">
                            <h1 className="text-2xl font-display font-bold text-white tracking-tight">Prova Fácil</h1>
                            <p className="text-xs text-slate-500">Gestão Inteligente de Avaliações</p>
                        </div>
                        <nav className="flex-1 py-4 space-y-1 overflow-y-auto custom-scrollbar">
                            <NavItem to="/" icon={Icons.Dashboard} label="Dashboard" />
                            <NavItem to="/institutions" icon={Icons.Building} label="Instituições" />
                            <NavItem to="/classes" icon={Icons.UsersGroup} label="Turmas" />
                            <NavItem to="/hierarchy" icon={Icons.BookOpen} label="Conteúdos" />
                            <NavItem to="/questions" icon={Icons.Questions} label="Questões" />
                            <NavItem to="/exams" icon={Icons.Exams} label="Provas" />
                        </nav>
                        <div className="p-4 border-t border-slate-800">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-brand-blue text-white flex items-center justify-center font-bold">
                                    {user.name.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-white truncate">{user.name}</p>
                                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                                </div>
                            </div>
                            <Button variant="ghost" className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-slate-800" onClick={() => FirebaseService.logout()}>
                                <Icons.Logout /> Sair
                            </Button>
                        </div>
                    </aside>
                    <main className="flex-1 flex flex-col min-w-0 relative">
                        <Routes>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/institutions" element={<InstitutionPage />} />
                            <Route path="/classes" element={<ClassesPage />} />
                            <Route path="/hierarchy" element={<HierarchyPage />} />
                            <Route path="/questions" element={<QuestionsPage />} />
                            <Route path="/exams" element={<ExamsPage />} />
                            <Route path="*" element={<Navigate to="/" />} />
                        </Routes>
                    </main>
                </div>
            </HashRouter>
        </AuthContext.Provider>
    );
};

export default App;
