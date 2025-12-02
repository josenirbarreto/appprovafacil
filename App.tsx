
import React, { useState, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { User, UserRole, Question, Exam, Discipline, QuestionType, Institution, SchoolClass, Chapter, Unit } from './types';
import { FirebaseService } from './services/firebaseService';
import { Button, Card, Badge, Input, Select, Modal } from './components/UI';
import { GeminiService } from './services/geminiService';
import { auth } from './firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';

// Ícones SVG
const Icons = {
  Dashboard: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
  Questions: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Exams: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  Users: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  Logout: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
  Sparkles: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>,
  Trash: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  Building: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  BookOpen: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
  UsersGroup: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
  Plus: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
  Upload: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>,
  Edit: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>,
  ArrowLeft: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
  ArrowRight: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>,
  Search: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
};

const AuthContext = React.createContext<{ user: User | null; loading: boolean }>({ user: null, loading: true });

// --- PÁGINAS ---

// 1. LOGIN
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

// 2. DASHBOARD
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

// GESTÃO DE INSTITUIÇÕES
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

    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-display font-bold text-brand-dark">Turmas</h2>
                <Button onClick={() => { setCurrentClass({year: new Date().getFullYear(), institutionId: institutions[0]?.id || ''}); setShowModal(true); }}><Icons.Plus /> Nova Turma</Button>
            </div>
            {institutions.map(inst => {
                const instClasses = classes.filter(c => c.institutionId === inst.id);
                return (
                    <div key={inst.id} className="bg-white rounded-xl shadow-sm border p-6">
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Icons.Building /> {inst.name}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {instClasses.map(c => (
                                <div key={c.id} className="border p-4 rounded flex justify-between items-center">
                                    <div><p className="font-bold">{c.name}</p><p className="text-xs">{c.year}</p></div>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" onClick={() => {setCurrentClass(c); setShowModal(true)}}><Icons.Edit /></Button>
                                        <Button variant="ghost" onClick={() => handleDelete(c.id)} className="text-red-500"><Icons.Trash /></Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
             <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Turma" footer={<Button onClick={handleSave}>Salvar</Button>}>
                <div className="space-y-4">
                    <Input label="Nome" value={currentClass.name || ''} onChange={e => setCurrentClass({...currentClass, name: e.target.value})} />
                    <Input label="Ano" type="number" value={currentClass.year} onChange={e => setCurrentClass({...currentClass, year: parseInt(e.target.value)})} />
                    <Select label="Instituição" value={currentClass.institutionId} onChange={e => setCurrentClass({...currentClass, institutionId: e.target.value})}>
                        {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </Select>
                </div>
            </Modal>
        </div>
    );
};

// --- NOVOS COMPONENTES VISUAIS PARA HIERARQUIA (STEP CARDS) ---
const StepItem = ({ label, active, onClick, onDelete, onEdit }: any) => (
    <div 
        onClick={onClick} 
        className={`group p-3 rounded-lg border cursor-pointer flex justify-between items-center transition-all ${
            active 
            ? 'bg-blue-50 border-brand-blue ring-1 ring-brand-blue shadow-sm' 
            : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200'
        }`}
    >
        <div className="flex items-center gap-2 overflow-hidden">
            {active && <div className="w-1.5 h-1.5 rounded-full bg-brand-blue flex-shrink-0" />}
            <span className={`truncate text-sm font-medium ${active ? 'text-brand-blue' : 'text-slate-600'}`}>{label}</span>
        </div>
        <div className="flex opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
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
                    <label className="text-xs font-bold text-brand-blue mb-1 block pl-1">{addLabel}</label>
                    <div className="flex gap-2">
                        <input 
                            ref={inputRef}
                            className="flex-1 border border-blue-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none bg-white placeholder-slate-400 shadow-sm text-slate-900"
                            placeholder="Digite o nome..."
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && onAdd()}
                        />
                        <button 
                            type="button"
                            onClick={onAdd}
                            disabled={!inputValue.trim()}
                            className="bg-brand-blue text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
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
    
    // Selection State
    const [selDisc, setSelDisc] = useState<Discipline | null>(null);
    const [selChap, setSelChap] = useState<Chapter | null>(null);
    const [selUnit, setSelUnit] = useState<Unit | null>(null);

    // Inputs for Adding
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
        } catch (error: any) {
            console.error("Delete error:", error);
            alert(`Erro ao excluir: ${error.message || 'Tente novamente.'}`);
        }
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
            
            {/* O Grid precisa ser flex-1 e ter min-h-0 para respeitar o limite do pai e forçar scroll interno nos cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1 min-h-0">
                
                {/* PASSO 1: DISCIPLINA */}
                <StepCard 
                    stepNumber={1} 
                    title="Disciplinas" 
                    singularName="Disciplina"
                    inputValue={inputD} 
                    setInputValue={setInputD} 
                    onAdd={() => handleAdd('D')}
                >
                    {hierarchy.map(d => (
                        <StepItem 
                            key={d.id} 
                            label={d.name} 
                            active={selDisc?.id === d.id} 
                            onClick={() => { setSelDisc(d); setSelChap(null); setSelUnit(null); }} 
                            onDelete={() => handleDelete('discipline', d.id)}
                            onEdit={() => setEditingItem({ type: 'discipline', id: d.id, name: d.name })}
                        />
                    ))}
                </StepCard>

                {/* PASSO 2: CAPÍTULO */}
                <StepCard 
                    stepNumber={2} 
                    title="Capítulos" 
                    singularName="Capítulo"
                    disabled={!selDisc} 
                    placeholder="Selecione uma Disciplina para ver os Capítulos"
                    parentName={selDisc?.name}
                    inputValue={inputC} 
                    setInputValue={setInputC} 
                    onAdd={() => handleAdd('C')}
                >
                    {selDisc?.chapters.map(c => (
                        <StepItem 
                            key={c.id} 
                            label={c.name} 
                            active={selChap?.id === c.id} 
                            onClick={() => { setSelChap(c); setSelUnit(null); }} 
                            onDelete={() => handleDelete('chapter', c.id)}
                            onEdit={() => setEditingItem({ type: 'chapter', id: c.id, name: c.name })}
                        />
                    ))}
                </StepCard>

                {/* PASSO 3: UNIDADE */}
                <StepCard 
                    stepNumber={3} 
                    title="Unidades" 
                    singularName="Unidade"
                    disabled={!selChap} 
                    placeholder="Selecione um Capítulo para ver as Unidades"
                    parentName={selChap?.name}
                    inputValue={inputU} 
                    setInputValue={setInputU} 
                    onAdd={() => handleAdd('U')}
                >
                    {selChap?.units.map(u => (
                        <StepItem 
                            key={u.id} 
                            label={u.name} 
                            active={selUnit?.id === u.id} 
                            onClick={() => setSelUnit(u)} 
                            onDelete={() => handleDelete('unit', u.id)}
                            onEdit={() => setEditingItem({ type: 'unit', id: u.id, name: u.name })}
                        />
                    ))}
                </StepCard>

                {/* PASSO 4: TÓPICO */}
                <StepCard 
                    stepNumber={4} 
                    title="Tópicos" 
                    singularName="Tópico"
                    disabled={!selUnit} 
                    placeholder="Selecione uma Unidade para ver os Tópicos"
                    parentName={selUnit?.name}
                    inputValue={inputT} 
                    setInputValue={setInputT} 
                    onAdd={() => handleAdd('T')}
                >
                    {selUnit?.topics.map(t => (
                        <StepItem 
                            key={t.id} 
                            label={t.name} 
                            active={false} 
                            onClick={() => {}} 
                            onDelete={() => handleDelete('topic', t.id)}
                            onEdit={() => setEditingItem({ type: 'topic', id: t.id, name: t.name })}
                        />
                    ))}
                </StepCard>
            </div>

            <Modal 
                isOpen={!!editingItem} 
                onClose={() => setEditingItem(null)} 
                title="Editar Nome" 
                footer={<Button onClick={handleUpdateName}>Salvar</Button>}
                maxWidth="max-w-sm"
            >
                <div className="pt-2">
                    <Input 
                        value={editingItem?.name || ''} 
                        onChange={e => setEditingItem(prev => prev ? ({...prev, name: e.target.value}) : null)}
                        autoFocus
                    />
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
    const [newQ, setNewQ] = useState<Partial<Question>>({ type: QuestionType.MULTIPLE_CHOICE, options: [] });
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => { load(); }, []);
    const load = async () => {
        setQuestions(await FirebaseService.getQuestions());
        setHierarchy(await FirebaseService.getHierarchy());
    };

    const handleSave = async () => {
        await FirebaseService.addQuestion({
            ...newQ, 
            id: '', 
            createdAt: new Date().toISOString(),
            chapterId: 'c1', unitId: 'u1', topicId: 't1', 
            difficulty: 'Medium'
        } as Question);
        setShowModal(false);
        load();
    }

    const handleGenerateAI = async () => {
        const topic = prompt("Tópico:");
        if(!topic) return;
        setIsGenerating(true);
        const res = await GeminiService.generateQuestion(topic, newQ.type || QuestionType.MULTIPLE_CHOICE, 'Medium');
        if(res) setNewQ({...newQ, ...res});
        setIsGenerating(false);
    }

    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar space-y-6">
            <div className="flex justify-between"><h2 className="text-3xl font-bold">Questões</h2><Button onClick={() => setShowModal(true)}>Nova</Button></div>
            <div className="grid gap-4">
                {questions.map(q => (
                    <div key={q.id} className="bg-white p-4 border rounded shadow-sm">
                        <div className="flex justify-between text-xs text-slate-500 mb-2"><Badge>{q.type}</Badge> {FirebaseService.getFullHierarchyString(q, hierarchy)}</div>
                        <p className="font-medium">{q.enunciado}</p>
                    </div>
                ))}
            </div>
            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Questão" footer={<Button onClick={handleSave}>Salvar</Button>}>
                <div className="space-y-4">
                     <Select label="Disciplina" value={newQ.disciplineId} onChange={e => setNewQ({...newQ, disciplineId: e.target.value})}>
                        <option value="">Selecione</option>
                        {hierarchy.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                     </Select>
                     <div className="flex justify-end"><Button variant="secondary" onClick={handleGenerateAI} disabled={isGenerating}>IA Generator</Button></div>
                     <Input label="Enunciado" value={newQ.enunciado || ''} onChange={e => setNewQ({...newQ, enunciado: e.target.value})} />
                </div>
            </Modal>
        </div>
    );
};

// EXAM GENERATOR
const ExamGenerator = () => {
    const [step, setStep] = useState(1);
    const [questions, setQuestions] = useState<Question[]>([]);
    useEffect(() => { FirebaseService.getQuestions().then(setQuestions); }, []);
    
    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
            {step === 1 && (
                <Card title="Gerar Prova">
                    <div className="text-center py-10">
                        <p className="mb-4">Funcionalidade conectada ao banco de questões real.</p>
                        <Button onClick={() => window.print()}>Simular Impressão</Button>
                    </div>
                </Card>
            )}
        </div>
    );
};

// ADMIN USERS
const AdminUsers = () => {
    const [users, setUsers] = useState<User[]>([]);
    useEffect(() => { FirebaseService.getUsers().then(setUsers); }, []);
    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
            <Card title="Usuários">
                {users.map(u => <div key={u.id} className="p-2 border-b">{u.name} ({u.email}) - {u.role}</div>)}
            </Card>
        </div>
    );
};

const Layout = ({ children }: { children?: React.ReactNode }) => {
    const { user } = React.useContext(AuthContext);

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <aside className="w-64 bg-brand-dark text-white hidden md:flex flex-col flex-shrink-0 z-10 no-print">
                <div className="p-6 border-b border-slate-700">
                    <h1 className="text-2xl font-display font-bold text-brand-blue">Prova Fácil</h1>
                    <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider">{user?.role}</p>
                </div>
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
                    <Link to="/" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white"><Icons.Dashboard /> Dashboard</Link>
                    <Link to="/questions" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white"><Icons.Questions /> Questões</Link>
                    <Link to="/exams" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white"><Icons.Exams /> Provas</Link>
                    {user?.role === UserRole.TEACHER && (
                        <>
                            <div className="pt-4 px-4 text-xs font-bold text-slate-500 uppercase">Cadastros</div>
                            <Link to="/institution" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white"><Icons.Building /> Instituição</Link>
                            <Link to="/classes" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white"><Icons.UsersGroup /> Turmas</Link>
                            <Link to="/subjects" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white"><Icons.BookOpen /> Conteúdos</Link>
                        </>
                    )}
                    {user?.role === UserRole.ADMIN && <Link to="/users" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white"><Icons.Users /> Usuários</Link>}
                </nav>
                <div className="p-4 bg-slate-900 shrink-0">
                    <button onClick={() => FirebaseService.logout()} className="flex items-center gap-3 text-slate-400 hover:text-white w-full"><Icons.Logout /> Sair</button>
                </div>
            </aside>
            {/* Main Area: Simple Flex Container. Pages handle scroll via flex-1 overflow-y-auto */}
            <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-slate-50 relative">
                {children}
            </main>
        </div>
    );
};

const App = () => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                const userData = await FirebaseService.getCurrentUserData();
                setUser(userData);
            } else {
                setUser(null);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    if (loading) return <div className="h-screen flex items-center justify-center">Carregando Prova Fácil...</div>;

    return (
        <AuthContext.Provider value={{ user, loading }}>
            <HashRouter>
                <Routes>
                    {!user ? (
                        <Route path="*" element={<Login />} />
                    ) : (
                        <Route path="*" element={
                            <Layout>
                                <Routes>
                                    <Route path="/" element={<Dashboard />} />
                                    <Route path="/questions" element={<QuestionBank />} />
                                    <Route path="/exams" element={<ExamGenerator />} />
                                    <Route path="/institution" element={<InstitutionPage />} />
                                    <Route path="/classes" element={<ClassesPage />} />
                                    <Route path="/subjects" element={<HierarchyPage />} />
                                    <Route path="/users" element={user.role === UserRole.ADMIN ? <AdminUsers /> : <Navigate to="/" />} />
                                </Routes>
                            </Layout>
                        } />
                    )}
                </Routes>
            </HashRouter>
        </AuthContext.Provider>
    );
};

export default App;
