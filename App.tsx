
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { HashRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { User, UserRole, Question, Exam, Discipline, QuestionType, Institution, SchoolClass, Chapter, Unit } from './types';
import { FirebaseService } from './services/firebaseService';
import { Button, Card, Badge, Input, Select, Modal, RichTextEditor } from './components/UI';
import { GeminiService } from './services/geminiService';
import { PdfService } from './services/pdfService';
import { auth } from './firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';

// Ícones SVG
const Icons = {
  Dashboard: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
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
  Check: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
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

// GESTÃO DE INSTITUIÇÕES (Mantido igual)
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

// GESTÃO DE TURMAS
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

// --- COMPONENTES DE HIERARQUIA ---
const StepItem = ({ label, active, onClick, onDelete, onEdit }: any) => (
    <div 
        onClick={onClick} 
        className={`group p-3 rounded-lg border cursor-pointer flex justify-between items-center transition-all ${
            active 
            ? 'bg-blue-50 border-brand-blue ring-1 ring-brand-blue shadow-sm' 
            : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200'
        }`}
    >
        <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
            {active && <div className="w-1.5 h-1.5 rounded-full bg-brand-blue flex-shrink-0" />}
            <div className="flex-1 min-w-0 truncate text-sm font-medium" title={label}>
                 <span className={`${active ? 'text-brand-blue' : 'text-slate-600'}`}>{label}</span>
            </div>
        </div>
        <div className="flex opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity ml-2 shrink-0">
            <button 
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(); }} 
                className="p-1.5 text-slate-400 hover:text-brand-blue hover:bg-blue-100 rounded"
                title="Editar"
            >
                <Icons.Edit />
            </button>
            <button 
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }} 
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                title="Excluir"
            >
                <Icons.Trash />
            </button>
        </div>
    </div>
);

const StepCard = ({ 
    stepNumber, 
    title, 
    disabled, 
    children, 
    inputValue, 
    setInputValue, 
    onAdd, 
    placeholder,
    singularName,
    parentName
}: any) => {
    const [searchTerm, setSearchTerm] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    
    const filteredChildren = React.Children.toArray(children).filter((child: any) => 
        child.props.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const addLabel = parentName 
        ? `Novo ${singularName} em "${parentName}"` 
        : `Nova ${singularName}`;

    return (
        <div className={`flex flex-col h-[500px] md:h-full rounded-xl border transition-all duration-300 overflow-hidden ${disabled ? 'opacity-50 grayscale bg-slate-100 border-slate-200' : 'bg-white border-slate-200 shadow-lg'}`}>
            <div className={`p-4 border-b ${disabled ? 'border-slate-200' : 'border-slate-100 bg-slate-50'} flex flex-col gap-3 shrink-0`}>
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <span className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${disabled ? 'bg-slate-300 text-slate-500' : 'bg-brand-blue text-white shadow-md'}`}>
                            {stepNumber}
                        </span>
                        <h3 className={`font-display font-bold ${disabled ? 'text-slate-400' : 'text-slate-800'}`}>{title}</h3>
                    </div>
                    {!disabled && (
                        <button 
                            type="button"
                            onClick={() => inputRef.current?.focus()}
                            className="text-xs bg-brand-blue/10 text-brand-blue font-semibold px-2 py-1 rounded hover:bg-brand-blue hover:text-white transition-colors flex items-center gap-1"
                        >
                            <Icons.Plus /> Novo
                        </button>
                    )}
                </div>
                
                {!disabled && (
                    <div className="relative">
                         <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                             <Icons.Search />
                         </div>
                         <input 
                            type="text" 
                            placeholder={`Buscar ${singularName}...`}
                            className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-brand-blue outline-none bg-white text-slate-900"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                         />
                    </div>
                )}
            </div>
            
            <div className="flex-1 p-3 overflow-y-auto custom-scrollbar space-y-1 relative min-h-0 bg-white">
                {disabled ? (
                     <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-4">
                        <Icons.ArrowLeft />
                        <p className="mt-2 text-sm">{placeholder || "Complete o passo anterior"}</p>
                     </div>
                ) : (
                    filteredChildren.length > 0 ? filteredChildren : (
                        <div className="text-center text-slate-400 py-10 text-sm">
                            {searchTerm ? 'Nenhum item encontrado.' : 'Nenhum item cadastrado.'}
                        </div>
                    )
                )}
            </div>

            {!disabled && (
                <div className="p-3 border-t border-blue-200 bg-blue-50/90 rounded-b-xl shrink-0 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] mt-auto">
                    <label className="text-xs font-bold text-brand-blue mb-1 block pl-1 truncate" title={addLabel}>{addLabel}</label>
                    <div className="flex items-center gap-2">
                        <input 
                            ref={inputRef}
                            className="flex-1 min-w-0 border border-blue-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none bg-white placeholder-slate-400 shadow-sm text-slate-900"
                            placeholder="Digite o nome..."
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && onAdd()}
                        />
                        <button 
                            type="button"
                            onClick={onAdd}
                            disabled={!inputValue.trim()}
                            className="w-10 h-10 shrink-0 flex items-center justify-center bg-brand-blue text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                        >
                            <Icons.Plus />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

// PÁGINA DE HIERARQUIA
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
        <div className="flex flex-col h-full p-6 space-y-4">
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

// QUESTION BANK
const QuestionBank = () => {
    const [questions, setQuestions] = useState<Question[]>([]);
    const [hierarchy, setHierarchy] = useState<Discipline[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [viewingQuestion, setViewingQuestion] = useState<Question | null>(null);
    const [newQ, setNewQ] = useState<Partial<Question>>({ type: QuestionType.MULTIPLE_CHOICE, options: [] });
    const [isGenerating, setIsGenerating] = useState(false);
    
    // Tabela Avançada
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

    // Importação de PDF
    const [showPdfModal, setShowPdfModal] = useState(false);
    const [pdfContext, setPdfContext] = useState({ disciplineId: '', chapterId: '', unitId: '', topicId: '' });
    const [isProcessingPdf, setIsProcessingPdf] = useState(false);
    const [extractedQuestions, setExtractedQuestions] = useState<Partial<Question>[]>([]);
    const pdfInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { load(); }, []);
    const load = async () => {
        setQuestions(await FirebaseService.getQuestions());
        setHierarchy(await FirebaseService.getHierarchy());
    };

    // Helper functions for names
    const getDiscName = (id: string) => hierarchy.find(d => d.id === id)?.name || '-';
    const getChapName = (dId: string, cId: string) => hierarchy.find(d => d.id === dId)?.chapters.find(c => c.id === cId)?.name || '-';
    const getUnitName = (dId: string, cId: string, uId: string) => hierarchy.find(d => d.id === dId)?.chapters.find(c => c.id === cId)?.units.find(u => u.id === uId)?.name || '-';
    const getTopicName = (dId: string, cId: string, uId: string, tId: string) => hierarchy.find(d => d.id === dId)?.chapters.find(c => c.id === cId)?.units.find(u => u.id === uId)?.topics.find(t => t.id === tId)?.name || '-';
    const stripHtml = (html: string) => { const tmp = document.createElement("DIV"); tmp.innerHTML = html || ''; return tmp.textContent || tmp.innerText || ""; };

    // 1. Process Data
    const processedQuestions = useMemo(() => {
        return questions.map(q => ({
            ...q,
            plainEnunciado: stripHtml(q.enunciado),
            disciplineName: getDiscName(q.disciplineId),
            chapterName: getChapName(q.disciplineId, q.chapterId),
            unitName: getUnitName(q.disciplineId, q.chapterId, q.unitId),
            topicName: getTopicName(q.disciplineId, q.chapterId, q.unitId, q.topicId),
            typeName: QuestionTypeLabels[q.type]
        }));
    }, [questions, hierarchy]);

    // 2. Filter & Sort
    const filteredAndSortedQuestions = useMemo(() => {
        let result = processedQuestions;
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            result = result.filter(q => 
                q.plainEnunciado.toLowerCase().includes(lowerTerm) ||
                q.disciplineName.toLowerCase().includes(lowerTerm) ||
                q.chapterName.toLowerCase().includes(lowerTerm) ||
                q.unitName.toLowerCase().includes(lowerTerm) ||
                q.topicName.toLowerCase().includes(lowerTerm) ||
                q.typeName.toLowerCase().includes(lowerTerm)
            );
        }
        if (sortConfig) {
            result.sort((a: any, b: any) => {
                if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
                if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return result;
    }, [processedQuestions, searchTerm, sortConfig]);

    // 3. Pagination
    const totalItems = filteredAndSortedQuestions.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const paginatedQuestions = filteredAndSortedQuestions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    useEffect(() => { setCurrentPage(1); }, [searchTerm, itemsPerPage]);

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };
    const getSortIcon = (key: string) => {
        if (sortConfig?.key !== key) return <span className="text-slate-300 ml-1">⇅</span>;
        return sortConfig.direction === 'asc' ? <span className="ml-1 text-brand-blue">▲</span> : <span className="ml-1 text-brand-blue">▼</span>;
    };

    const PaginationControls = () => (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50 p-4 border-t border-slate-200 text-sm">
            <div className="flex items-center gap-2">
                <span className="text-slate-600">Mostrar</span>
                <select value={itemsPerPage} onChange={e => setItemsPerPage(Number(e.target.value))} className="border border-slate-300 rounded px-2 py-1 bg-white focus:outline-none focus:border-brand-blue">
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                </select>
                <span className="text-slate-600">por página</span>
            </div>
            <div className="flex items-center gap-4">
                <span className="text-slate-600">{totalItems === 0 ? '0' : (currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, totalItems)} de {totalItems}</span>
                <div className="flex gap-1">
                    <Button variant="outline" className="px-2 py-1 h-8" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>{'<'}</Button>
                    <span className="flex items-center px-3 font-medium bg-white border rounded">{currentPage} / {totalPages || 1}</span>
                    <Button variant="outline" className="px-2 py-1 h-8" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0}>{'>'}</Button>
                </div>
            </div>
        </div>
    );

    const handleSave = async () => {
        if (!newQ.disciplineId || !newQ.chapterId) { alert('Disciplina e Capítulo são obrigatórios.'); return; }
        const qData = { ...newQ, createdAt: newQ.createdAt || new Date().toISOString(), difficulty: newQ.difficulty || 'Medium', options: newQ.options || [], pairs: newQ.pairs || [] } as Question;
        if (newQ.id) await FirebaseService.updateQuestion(qData);
        else await FirebaseService.addQuestion(qData);
        setShowModal(false);
        load();
    }
    const handleDelete = async (id: string) => { if (confirm('Tem certeza que deseja excluir esta questão?')) { await FirebaseService.deleteQuestion(id); load(); } };
    const handleEdit = (q: Question) => { setNewQ({ ...q }); setShowModal(true); };
    
    // Tratamento de erro específico para chave de API
    const handleGenerateAI = async () => {
        if (!newQ.disciplineId || !newQ.chapterId) { alert('Selecione Disciplina e Capítulo para dar contexto à IA.'); return; }
        setIsGenerating(true);
        try {
            const contextString = getContextString();
            const res = await GeminiService.generateQuestion(contextString, newQ.type || QuestionType.MULTIPLE_CHOICE, 'Medium');
            if(res) setNewQ(prev => ({...prev, ...res}));
        } catch (error: any) {
            console.error(error);
            if (error.message && error.message.includes('API key')) {
                alert("⚠️ CONFIGURAÇÃO AUSENTE:\n\nA chave de API do Gemini (API_KEY) não foi encontrada.\n\n-> Se estiver no Vercel: Vá em Settings > Environment Variables e adicione a chave 'API_KEY'.\n-> Se estiver local: Crie um arquivo .env na raiz com 'API_KEY=sua_chave'.");
            } else {
                alert("Erro ao gerar questão. Tente novamente.");
            }
        } finally {
            setIsGenerating(false);
        }
    }
    const handleAddOption = () => { setNewQ(prev => ({ ...prev, options: [...(prev.options || []), { id: Date.now().toString(), text: '', isCorrect: false }] })); };
    const handleOptionChange = (idx: number, text: string) => { const newOpts = [...(newQ.options || [])]; newOpts[idx].text = text; setNewQ({ ...newQ, options: newOpts }); };
    const handleSetCorrect = (idx: number) => { const newOpts = (newQ.options || []).map((o, i) => ({ ...o, isCorrect: i === idx })); setNewQ({ ...newQ, options: newOpts }); };
    const handleRemoveOption = (idx: number) => { const newOpts = [...(newQ.options || [])]; newOpts.splice(idx, 1); setNewQ({ ...newQ, options: newOpts }); };
    const handleAnswerChange = (text: string) => { setNewQ(prev => ({ ...prev, options: [{ id: 'ans', text: text, isCorrect: true }] })); };
    
    const getContextString = () => {
        const disc = hierarchy.find(d => d.id === newQ.disciplineId);
        const chap = disc?.chapters.find(c => c.id === newQ.chapterId);
        const unit = chap?.units.find(u => u.id === newQ.unitId);
        const topic = unit?.topics.find(t => t.id === newQ.topicId);
        let ctx = disc?.name || '';
        if (chap) ctx += ` > ${chap.name}`;
        if (unit) ctx += ` > ${unit.name}`;
        if (topic) ctx += ` > ${topic.name}`;
        return ctx;
    }
    const selectedDiscipline = hierarchy.find(d => d.id === newQ.disciplineId);
    const selectedChapter = selectedDiscipline?.chapters.find(c => c.id === newQ.chapterId);
    const selectedUnit = selectedChapter?.units.find(u => u.id === newQ.unitId);

    // --- PDF IMPORT LOGIC ---
    const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!pdfContext.disciplineId || !pdfContext.chapterId) { alert("Selecione Disciplina e Capítulo antes de enviar o arquivo."); return; }

        setIsProcessingPdf(true);
        try {
            // 1. Extract Text
            const text = await PdfService.extractText(file);
            // 2. Parse with AI
            const parsedQuestions = await GeminiService.parseQuestionsFromText(text);
            
            if (!parsedQuestions || parsedQuestions.length === 0) {
                alert("A IA não conseguiu identificar nenhuma questão no arquivo. Verifique se o PDF contém texto selecionável.");
            } else {
                setExtractedQuestions(parsedQuestions);
            }
        } catch (error: any) {
            console.error(error);
            if (error.message && error.message.includes('API key')) {
                alert("⚠️ CONFIGURAÇÃO AUSENTE:\n\nA chave de API do Gemini (API_KEY) não foi encontrada.\n\n-> Se estiver no Vercel: Vá em Settings > Environment Variables e adicione a chave 'API_KEY'.\n-> Se estiver local: Crie um arquivo .env na raiz com 'API_KEY=sua_chave'.");
            } else {
                alert(`Erro ao processar PDF: ${error.message || "Verifique se o arquivo é válido."}`);
            }
        } finally {
            setIsProcessingPdf(false);
            if (pdfInputRef.current) pdfInputRef.current.value = '';
        }
    };

    const handleSaveImport = async () => {
        if(extractedQuestions.length === 0) return;
        setIsProcessingPdf(true);
        try {
            for (const q of extractedQuestions) {
                const finalQ = {
                    ...q,
                    disciplineId: pdfContext.disciplineId,
                    chapterId: pdfContext.chapterId,
                    unitId: pdfContext.unitId,
                    topicId: pdfContext.topicId,
                    createdAt: new Date().toISOString()
                } as Question;
                await FirebaseService.addQuestion(finalQ);
            }
            alert(`${extractedQuestions.length} questões importadas com sucesso!`);
            setShowPdfModal(false);
            setExtractedQuestions([]);
            load();
        } catch(e) {
            alert("Erro ao salvar questões.");
        } finally {
            setIsProcessingPdf(false);
        }
    };

    const removeExtractedQuestion = (idx: number) => {
        setExtractedQuestions(prev => prev.filter((_, i) => i !== idx));
    };

    const updateExtractedQuestion = (idx: number, updates: Partial<Question>) => {
        setExtractedQuestions(prev => {
            const newState = [...prev];
            newState[idx] = { ...newState[idx], ...updates };
            return newState;
        });
    };

    const handleExtractedOptionChange = (qIdx: number, optIdx: number, text: string) => {
        setExtractedQuestions(prev => {
            const newState = [...prev];
            if(newState[qIdx].options) {
                newState[qIdx].options![optIdx].text = text;
            }
            return newState;
        });
    };

    const handleExtractedCorrectOption = (qIdx: number, optIdx: number) => {
        setExtractedQuestions(prev => {
             const newState = [...prev];
             if(newState[qIdx].options) {
                 newState[qIdx].options = newState[qIdx].options!.map((o, i) => ({...o, isCorrect: i === optIdx}));
             }
             return newState;
        });
    };

    const removeExtractedOption = (qIdx: number, optIdx: number) => {
         setExtractedQuestions(prev => {
            const newState = [...prev];
            if(newState[qIdx].options) {
                newState[qIdx].options!.splice(optIdx, 1);
            }
            return newState;
         });
    };
    
    const addExtractedOption = (qIdx: number) => {
        setExtractedQuestions(prev => {
            const newState = [...prev];
            if (!newState[qIdx].options) newState[qIdx].options = [];
            newState[qIdx].options!.push({ id: Date.now().toString(), text: '', isCorrect: false });
            return newState;
        });
    };

    const pdfSelectedDiscipline = hierarchy.find(d => d.id === pdfContext.disciplineId);
    const pdfSelectedChapter = pdfSelectedDiscipline?.chapters.find(c => c.id === pdfContext.chapterId);
    const pdfSelectedUnit = pdfSelectedChapter?.units.find(u => u.id === pdfContext.unitId);

    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-3xl font-display font-bold text-brand-dark">Banco de Questões</h2>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                         <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><Icons.Search /></div>
                         <input type="text" placeholder="Buscar questão..." className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-blue outline-none bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                    <Button variant="secondary" onClick={() => setShowPdfModal(true)} className="whitespace-nowrap"><Icons.Pdf /> Converter PDF</Button>
                    <Button onClick={() => { setNewQ({ type: QuestionType.MULTIPLE_CHOICE, options: [] }); setShowModal(true); }} className="whitespace-nowrap"><Icons.Plus /> Nova Questão</Button>
                </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                <PaginationControls />
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider select-none">
                                <th onClick={() => handleSort('plainEnunciado')} className="p-4 w-1/3 cursor-pointer hover:bg-slate-100 transition-colors">Enunciado {getSortIcon('plainEnunciado')}</th>
                                <th onClick={() => handleSort('typeName')} className="p-4 text-center cursor-pointer hover:bg-slate-100 transition-colors">Tipo {getSortIcon('typeName')}</th>
                                <th onClick={() => handleSort('disciplineName')} className="p-4 cursor-pointer hover:bg-slate-100 transition-colors">Disciplina {getSortIcon('disciplineName')}</th>
                                <th onClick={() => handleSort('chapterName')} className="p-4 cursor-pointer hover:bg-slate-100 transition-colors">Capítulo {getSortIcon('chapterName')}</th>
                                <th onClick={() => handleSort('unitName')} className="p-4 cursor-pointer hover:bg-slate-100 transition-colors">Unidade {getSortIcon('unitName')}</th>
                                <th onClick={() => handleSort('topicName')} className="p-4 cursor-pointer hover:bg-slate-100 transition-colors">Tópico {getSortIcon('topicName')}</th>
                                <th className="p-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {paginatedQuestions.length === 0 ? (
                                <tr><td colSpan={7} className="p-6 text-center text-slate-500">Nenhuma questão encontrada.</td></tr>
                            ) : (
                                paginatedQuestions.map(q => (
                                    <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4"><div className="line-clamp-2 text-slate-700 font-medium" title={q.plainEnunciado}>{q.plainEnunciado}</div></td>
                                        <td className="p-4 text-center"><Badge color="blue">{q.typeName}</Badge></td>
                                        <td className="p-4 text-slate-600">{q.disciplineName}</td>
                                        <td className="p-4 text-slate-600">{q.chapterName}</td>
                                        <td className="p-4 text-slate-500">{q.unitName}</td>
                                        <td className="p-4 text-slate-500">{q.topicName}</td>
                                        <td className="p-4"><div className="flex justify-end gap-1"><Button variant="ghost" onClick={() => setViewingQuestion(q)} title="Visualizar"><Icons.Eye /></Button><Button variant="ghost" onClick={() => handleEdit(q)} title="Editar"><Icons.Edit /></Button><Button variant="ghost" onClick={() => handleDelete(q.id)} className="text-red-500" title="Excluir"><Icons.Trash /></Button></div></td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <PaginationControls />
            </div>
            
            {/* MODAL NOVA QUESTÃO */}
            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={newQ.id ? "Editar Questão" : "Nova Questão"} footer={<Button onClick={handleSave} disabled={!newQ.disciplineId || !newQ.chapterId}>Salvar</Button>}>
                <div className="space-y-4">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Select label="Disciplina *" value={newQ.disciplineId || ''} onChange={e => setNewQ({...newQ, disciplineId: e.target.value, chapterId: '', unitId: '', topicId: ''})}>
                            <option value="">Selecione...</option>
                            {hierarchy.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </Select>
                        <Select label="Capítulo *" value={newQ.chapterId || ''} onChange={e => setNewQ({...newQ, chapterId: e.target.value, unitId: '', topicId: ''})} disabled={!newQ.disciplineId}>
                            <option value="">Selecione...</option>
                            {selectedDiscipline?.chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </Select>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Select label="Unidade (Opcional)" value={newQ.unitId || ''} onChange={e => setNewQ({...newQ, unitId: e.target.value, topicId: ''})} disabled={!newQ.chapterId}>
                            <option value="">Selecione...</option>
                            {selectedChapter?.units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </Select>
                        <Select label="Tópico (Opcional)" value={newQ.topicId || ''} onChange={e => setNewQ({...newQ, topicId: e.target.value})} disabled={!newQ.unitId}>
                            <option value="">Selecione...</option>
                            {selectedUnit?.topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </Select>
                     </div>
                     <div className="flex gap-4 items-end border-t pt-4">
                         <div className="flex-1">
                             <Select label="Tipo de Questão" value={newQ.type} onChange={e => setNewQ({...newQ, type: e.target.value as QuestionType, options: []})}>
                                 <option value={QuestionType.MULTIPLE_CHOICE}>Múltipla Escolha</option>
                                 <option value={QuestionType.TRUE_FALSE}>Verdadeiro / Falso</option>
                                 <option value={QuestionType.SHORT_ANSWER}>Resposta Curta</option>
                                 <option value={QuestionType.NUMERIC}>Numérica</option>
                                 <option value={QuestionType.ASSOCIATION}>Associação</option>
                             </Select>
                         </div>
                         <Button variant="secondary" onClick={handleGenerateAI} disabled={isGenerating || !newQ.disciplineId || !newQ.chapterId} className="shrink-0"><Icons.Sparkles /> {isGenerating ? 'Gerando...' : 'Gerar com IA'}</Button>
                     </div>
                     <RichTextEditor label="Enunciado da Questão" value={newQ.enunciado || ''} onChange={(html) => setNewQ({...newQ, enunciado: html})} />
                     <div className="bg-slate-50 p-4 rounded border border-slate-200 space-y-3">
                        <label className="text-xs font-bold text-slate-700 uppercase">Alternativas / Gabarito</label>
                        {newQ.type === QuestionType.MULTIPLE_CHOICE && (
                            <div className="space-y-2">
                                {(newQ.options || []).map((opt, idx) => (
                                    <div key={idx} className="flex gap-2 items-center">
                                        <input type="radio" name="correctOpt" checked={opt.isCorrect} onChange={() => handleSetCorrect(idx)} className="w-4 h-4 text-brand-blue" />
                                        <Input value={opt.text} onChange={e => handleOptionChange(idx, e.target.value)} placeholder={`Alternativa ${String.fromCharCode(65 + idx)}`} className="flex-1" />
                                        <button onClick={() => handleRemoveOption(idx)} className="text-red-400 hover:text-red-600 p-2"><Icons.Trash /></button>
                                    </div>
                                ))}
                                <Button variant="outline" onClick={handleAddOption} className="w-full text-xs py-2">+ Adicionar Alternativa</Button>
                            </div>
                        )}
                        {newQ.type === QuestionType.TRUE_FALSE && (
                            <div className="space-y-2">
                                <div className="flex gap-2 items-center p-2 bg-white border rounded">
                                    <input type="radio" name="tf" checked={newQ.options?.find(o => o.text === 'Verdadeiro')?.isCorrect} onChange={() => setNewQ({...newQ, options: [{text:'Verdadeiro', isCorrect:true, id:'t'}, {text:'Falso', isCorrect:false, id:'f'}]})} />
                                    <span>Verdadeiro</span>
                                </div>
                                <div className="flex gap-2 items-center p-2 bg-white border rounded">
                                    <input type="radio" name="tf" checked={newQ.options?.find(o => o.text === 'Falso')?.isCorrect} onChange={() => setNewQ({...newQ, options: [{text:'Verdadeiro', isCorrect:false, id:'t'}, {text:'Falso', isCorrect:true, id:'f'}]})} />
                                    <span>Falso</span>
                                </div>
                            </div>
                        )}
                        {(newQ.type === QuestionType.SHORT_ANSWER || newQ.type === QuestionType.NUMERIC) && (
                            <div>
                                <Input label="Resposta Correta (Gabarito)" value={newQ.options?.[0]?.text || ''} onChange={e => handleAnswerChange(e.target.value)} placeholder={newQ.type === QuestionType.NUMERIC ? "Ex: 42" : "Digite a resposta esperada..."} />
                            </div>
                        )}
                     </div>
                </div>
            </Modal>

            {/* MODAL IMPORTAR PDF */}
            <Modal isOpen={showPdfModal} onClose={() => setShowPdfModal(false)} title="Importar Questões de PDF" footer={
                <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setShowPdfModal(false)}>Cancelar</Button>
                    <Button onClick={handleSaveImport} disabled={extractedQuestions.length === 0 || isProcessingPdf}>Salvar {extractedQuestions.length} Questões</Button>
                </div>
            } maxWidth="max-w-4xl">
                <div className="space-y-6">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <h4 className="font-bold text-blue-800 mb-2 flex items-center gap-2"><Icons.Pdf /> Como funciona</h4>
                        <p className="text-sm text-blue-700">A IA irá ler o PDF e tentar identificar as questões automaticamente. Para melhores resultados, selecione a disciplina e o capítulo de destino.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Select label="Disciplina de Destino *" value={pdfContext.disciplineId} onChange={e => setPdfContext({...pdfContext, disciplineId: e.target.value, chapterId: '', unitId: '', topicId: ''})}>
                            <option value="">Selecione...</option>
                            {hierarchy.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </Select>
                        <Select label="Capítulo de Destino *" value={pdfContext.chapterId} onChange={e => setPdfContext({...pdfContext, chapterId: e.target.value, unitId: '', topicId: ''})} disabled={!pdfContext.disciplineId}>
                            <option value="">Selecione...</option>
                            {pdfSelectedDiscipline?.chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </Select>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Select label="Unidade (Opcional)" value={pdfContext.unitId} onChange={e => setPdfContext({...pdfContext, unitId: e.target.value, topicId: ''})} disabled={!pdfContext.chapterId}>
                            <option value="">Selecione...</option>
                            {pdfSelectedChapter?.units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </Select>
                        <Select label="Tópico (Opcional)" value={pdfContext.topicId} onChange={e => setPdfContext({...pdfContext, topicId: e.target.value})} disabled={!pdfContext.unitId}>
                            <option value="">Selecione...</option>
                            {pdfSelectedUnit?.topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </Select>
                    </div>

                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors">
                        <input type="file" accept="application/pdf" className="hidden" ref={pdfInputRef} onChange={handlePdfUpload} />
                        <div className="flex flex-col items-center gap-2">
                             {isProcessingPdf ? (
                                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue"></div>
                             ) : (
                                 <Button onClick={() => pdfInputRef.current?.click()} disabled={!pdfContext.chapterId}><Icons.Upload /> Selecionar Arquivo PDF</Button>
                             )}
                             <p className="text-xs text-slate-500 mt-2">{isProcessingPdf ? 'Lendo arquivo e processando com IA... isso pode levar alguns segundos.' : 'Selecione o arquivo para iniciar a conversão.'}</p>
                        </div>
                    </div>

                    {extractedQuestions.length > 0 && (
                        <div className="space-y-6">
                            <h4 className="font-bold text-brand-dark border-b pb-2 flex justify-between">
                                <span>Questões Encontradas ({extractedQuestions.length})</span>
                                <span className="text-xs font-normal text-slate-500">Revise e edite as questões antes de salvar.</span>
                            </h4>
                            {extractedQuestions.map((q, qIdx) => (
                                <div key={qIdx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative group space-y-4">
                                    <div className="flex justify-between items-start">
                                        <Badge>{QuestionTypeLabels[q.type!]}</Badge>
                                        <Button variant="ghost" onClick={() => removeExtractedQuestion(qIdx)} className="text-red-400 hover:text-red-600 hover:bg-red-50 text-xs px-2 py-1 flex gap-1 items-center">
                                            <Icons.Trash /> Descartar
                                        </Button>
                                    </div>
                                    
                                    {/* Editor de Enunciado */}
                                    <RichTextEditor 
                                        label="Enunciado" 
                                        value={q.enunciado || ''} 
                                        onChange={(html) => updateExtractedQuestion(qIdx, { enunciado: html })} 
                                    />

                                    {/* Editor de Alternativas / Gabarito */}
                                    <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-3">
                                        <label className="text-xs font-bold text-slate-700 uppercase">Alternativas / Gabarito</label>
                                        
                                        {q.type === QuestionType.MULTIPLE_CHOICE && (
                                            <div className="space-y-2">
                                                {(q.options || []).map((opt, optIdx) => (
                                                    <div key={optIdx} className="flex gap-2 items-center">
                                                        <input 
                                                            type="radio" 
                                                            name={`correct-${qIdx}`} 
                                                            checked={opt.isCorrect} 
                                                            onChange={() => handleExtractedCorrectOption(qIdx, optIdx)} 
                                                            className="w-4 h-4 text-brand-blue" 
                                                        />
                                                        <Input 
                                                            value={opt.text} 
                                                            onChange={e => handleExtractedOptionChange(qIdx, optIdx, e.target.value)} 
                                                            placeholder={`Alternativa ${String.fromCharCode(65 + optIdx)}`} 
                                                            className="flex-1" 
                                                        />
                                                        <button onClick={() => removeExtractedOption(qIdx, optIdx)} className="text-red-400 hover:text-red-600 p-2"><Icons.Trash /></button>
                                                    </div>
                                                ))}
                                                <Button variant="outline" onClick={() => addExtractedOption(qIdx)} className="w-full text-xs py-2">+ Adicionar Alternativa</Button>
                                            </div>
                                        )}

                                        {(q.type === QuestionType.SHORT_ANSWER || q.type === QuestionType.NUMERIC) && (
                                            <div>
                                                 <Input 
                                                    label="Resposta Correta" 
                                                    value={q.options?.[0]?.text || ''} 
                                                    onChange={e => {
                                                        const newOpts = [{ id: 'ans', text: e.target.value, isCorrect: true }];
                                                        updateExtractedQuestion(qIdx, { options: newOpts });
                                                    }} 
                                                    placeholder="Digite a resposta esperada..." 
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Modal>

            {/* MODAL DETALHES */}
            <Modal isOpen={!!viewingQuestion} onClose={() => setViewingQuestion(null)} title="Detalhes da Questão" footer={<Button onClick={() => setViewingQuestion(null)}>Fechar</Button>}>
                {viewingQuestion && (
                    <div className="space-y-6">
                        <div className="flex flex-wrap gap-2 text-xs">
                            <Badge>{QuestionTypeLabels[viewingQuestion.type]}</Badge>
                            <Badge color="yellow">{viewingQuestion.difficulty}</Badge>
                            <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">{FirebaseService.getFullHierarchyString(viewingQuestion, hierarchy)}</span>
                        </div>
                        <div className="prose prose-sm max-w-none bg-slate-50 p-4 rounded-lg border border-slate-100"><div dangerouslySetInnerHTML={{ __html: viewingQuestion.enunciado }} /></div>
                        {viewingQuestion.options && viewingQuestion.options.length > 0 && (
                            <div>
                                <h4 className="font-bold text-sm text-slate-700 mb-2">Alternativas / Gabarito</h4>
                                <ul className="space-y-2">
                                    {viewingQuestion.options.map((opt, idx) => (
                                        <li key={idx} className={`p-3 rounded border flex gap-3 items-start ${opt.isCorrect ? 'bg-green-50 border-green-200 text-green-800' : 'bg-white border-slate-100'}`}>
                                            <span className="font-bold shrink-0">{String.fromCharCode(65 + idx)})</span>
                                            <span>{opt.text}</span>
                                            {opt.isCorrect && <span className="ml-auto text-xs font-bold bg-green-200 text-green-800 px-2 py-0.5 rounded-full">Correta</span>}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
};

const NavLink = ({ to, icon, label }: { to: string, icon: React.ReactNode, label: string }) => {
    const location = useLocation();
    const active = location.pathname === to;
    return (
        <Link to={to} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors font-medium ${active ? 'bg-brand-blue text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
            {icon}
            <span>{label}</span>
        </Link>
    );
};

const App = () => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                const userData = await FirebaseService.getCurrentUserData();
                setUser(userData);
            } else {
                setUser(null);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50 text-slate-500">Carregando...</div>;

    if (!user) return <Login />;

    return (
        <AuthContext.Provider value={{ user, loading }}>
            <HashRouter>
                <div className="flex h-screen bg-slate-50 text-slate-900 font-sans">
                    {/* Sidebar */}
                    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col hidden md:flex">
                        <div className="p-6 border-b border-slate-800">
                            <h1 className="text-2xl font-display font-bold text-white flex items-center gap-2">
                                <Icons.BookOpen /> Prova Fácil
                            </h1>
                            <span className="text-xs text-slate-500 font-mono mt-1 block">TEACHER PANEL</span>
                        </div>
                        
                        <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
                            <NavLink to="/" icon={<Icons.Dashboard />} label="Dashboard" />
                            <div className="pt-4 pb-1 pl-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Gestão</div>
                            <NavLink to="/institutions" icon={<Icons.Building />} label="Instituições" />
                            <NavLink to="/classes" icon={<Icons.UsersGroup />} label="Turmas" />
                            <NavLink to="/hierarchy" icon={<Icons.BookOpen />} label="Conteúdos (BNCC)" />
                            
                            <div className="pt-4 pb-1 pl-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Avaliações</div>
                            <NavLink to="/questions" icon={<Icons.Questions />} label="Banco de Questões" />
                            <NavLink to="/exams" icon={<Icons.Exams />} label="Provas & Exames" />
                        </nav>

                        <div className="p-4 border-t border-slate-800">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-brand-orange text-white flex items-center justify-center font-bold shadow-sm">
                                    {user.name ? user.name.charAt(0) : 'U'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-white truncate">{user.name}</p>
                                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                                </div>
                            </div>
                            <Button variant="ghost" className="w-full justify-start text-red-400 hover:bg-slate-800 hover:text-red-300" onClick={() => FirebaseService.logout()}>
                                <Icons.Logout /> Sair
                            </Button>
                        </div>
                    </aside>

                    {/* Main Content */}
                    <main className="flex-1 flex flex-col overflow-hidden relative">
                        {/* Mobile Header */}
                        <div className="md:hidden h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 shrink-0 text-white">
                             <h1 className="font-bold flex items-center gap-2"><Icons.BookOpen /> Prova Fácil</h1>
                             <Button variant="ghost" onClick={() => FirebaseService.logout()} className="text-white hover:bg-slate-800"><Icons.Logout /></Button>
                        </div>

                        <Routes>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/institutions" element={<InstitutionPage />} />
                            <Route path="/classes" element={<ClassesPage />} />
                            <Route path="/hierarchy" element={<HierarchyPage />} />
                            <Route path="/questions" element={<QuestionBank />} />
                            <Route path="/exams" element={<div className="p-8 text-center text-slate-500">Módulo de Provas em Desenvolvimento...</div>} />
                            <Route path="*" element={<Navigate to="/" />} />
                        </Routes>
                    </main>
                </div>
            </HashRouter>
        </AuthContext.Provider>
    );
};

export default App;
