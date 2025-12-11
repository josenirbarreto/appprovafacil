
import React, { useState, useEffect, useContext, createContext } from 'react';
import { HashRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { User, UserRole, Question, Exam, Discipline, QuestionType, Institution, SchoolClass, ExamContentScope } from './types';
import { FirebaseService } from './services/firebaseService';
import { Button, Card, Badge, Input, Select, Modal, RichTextEditor, Icons as UIIcons } from './components/UI';
import { GeminiService } from './services/geminiService';
import { auth } from './firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';

// --- ICONS (Complementary to UI Icons) ---
const Icons = {
  ...UIIcons,
  Dashboard: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
  Questions: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Exams: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  Logout: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
  Sparkles: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>,
  BookOpen: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
  ArrowLeft: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
  ArrowRight: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>,
  Search: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  Eye: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
  Check: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
  Printer: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
};

const QuestionTypeLabels: Record<QuestionType, string> = {
  [QuestionType.MULTIPLE_CHOICE]: 'Múltipla Escolha',
  [QuestionType.TRUE_FALSE]: 'Verdadeiro/Falso',
  [QuestionType.SHORT_ANSWER]: 'Dissertativa',
  [QuestionType.NUMERIC]: 'Numérica',
  [QuestionType.ASSOCIATION]: 'Associação'
};

const AuthContext = createContext<{ user: User | null; loading: boolean }>({ user: null, loading: true });
const useAuth = () => useContext(AuthContext);

// --- LOGIN COMPONENT ---
const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await FirebaseService.login(email, password);
        } catch (err: any) {
            setError('Erro ao fazer login. Verifique suas credenciais.');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-brand-blue">Prova Fácil</h1>
                    <p className="text-slate-500">Faça login para continuar</p>
                </div>
                {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}
                <form onSubmit={handleLogin} className="space-y-4">
                    <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                    <Input label="Senha" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                    <Button type="submit" className="w-full justify-center">Entrar</Button>
                </form>
            </div>
        </div>
    );
};

// --- CHART COMPONENTS ---
const SimpleBarChart = ({ data }: { data: { label: string, value: number, color?: string }[] }) => {
    const max = Math.max(...data.map(d => d.value), 1);
    return (
        <div className="flex items-end justify-between h-40 gap-2 w-full pt-6 border-b border-slate-100 pb-2">
            {data.map((d, i) => (
                <div key={i} className="flex flex-col items-center flex-1 group relative h-full justify-end">
                     {/* Tooltip */}
                     <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                        <div className="bg-slate-800 text-white text-xs font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap">
                            {d.value} provas
                        </div>
                        <div className="w-2 h-2 bg-slate-800 rotate-45 mx-auto -mt-1"></div>
                     </div>
                    <div 
                        className="w-full max-w-[40px] rounded-t-md transition-all duration-300 group-hover:opacity-80 relative"
                        style={{ 
                            height: d.value > 0 ? `${(d.value / max) * 100}%` : '4px',
                            backgroundColor: d.color || '#3A72EC',
                            opacity: d.value === 0 ? 0.3 : 1
                        }}
                    >
                    </div>
                    <div className="text-xs text-slate-500 mt-2 truncate max-w-full font-medium">{d.label}</div>
                </div>
            ))}
        </div>
    );
};

const SimpleDonutChart = ({ data }: { data: { label: string, value: number, color: string }[] }) => {
    const total = data.reduce((acc, curr) => acc + curr.value, 0);
    let accumulated = 0;
    const gradient = data.map(d => {
        const start = (accumulated / total) * 100;
        accumulated += d.value;
        const end = (accumulated / total) * 100;
        return `${d.color} ${start}% ${end}%`;
    }).join(', ');

    return (
        <div className="flex items-center gap-6">
            <div className="relative w-32 h-32 rounded-full shrink-0" style={{ background: total > 0 ? `conic-gradient(${gradient})` : '#e2e8f0' }}>
                <div className="absolute inset-4 bg-white rounded-full flex items-center justify-center flex-col">
                    <span className="text-xl font-bold text-slate-800">{total}</span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wide">Total</span>
                </div>
            </div>
            <div className="flex flex-col gap-2 w-full">
                {data.map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></span>
                            <span className="text-slate-600">{d.label}</span>
                        </div>
                        <span className="font-bold text-slate-800">{d.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const HorizontalBarChart = ({ data }: { data: { label: string, value: number, color?: string }[] }) => {
    const max = Math.max(...data.map(d => d.value), 1);
    return (
        <div className="space-y-3 w-full">
            {data.map((d, i) => (
                <div key={i} className="w-full">
                    <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-slate-600">{d.label}</span>
                        <span className="font-bold text-slate-800">{d.value}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div 
                            className={`h-full rounded-full ${d.color || 'bg-brand-blue'}`} 
                            style={{ width: `${(d.value / max) * 100}%` }}
                        ></div>
                    </div>
                </div>
            ))}
        </div>
    );
};

// --- DASHBOARD PAGE ---
const Dashboard = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        exams: 0,
        questions: 0,
        classes: 0,
        institutions: 0,
        questionsByDifficulty: [] as { label: string, value: number, color: string }[],
        examsByMonth: [] as { label: string, value: number, color: string }[],
        questionsByType: [] as { label: string, value: number, color: string }[],
        topDisciplines: [] as { label: string, value: number }[],
        recentExams: [] as Exam[]
    });

    useEffect(() => {
        const loadDashboardData = async () => {
            try {
                const [exams, questions, classes, institutions, disciplines] = await Promise.all([
                    FirebaseService.getExams(),
                    FirebaseService.getQuestions(),
                    FirebaseService.getClasses(),
                    FirebaseService.getInstitutions(),
                    FirebaseService.getHierarchy()
                ]);

                const diffCounts = { Easy: 0, Medium: 0, Hard: 0 };
                questions.forEach(q => { if(diffCounts[q.difficulty] !== undefined) diffCounts[q.difficulty]++ });
                
                const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
                const today = new Date();
                const last6Months = Array.from({length: 6}, (_, i) => {
                    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
                    return { monthIdx: d.getMonth(), year: d.getFullYear(), label: monthNames[d.getMonth()], value: 0 };
                }).reverse();
                
                exams.forEach(e => {
                    const d = new Date(e.createdAt);
                    const bucket = last6Months.find(m => m.monthIdx === d.getMonth() && m.year === d.getFullYear());
                    if (bucket) bucket.value++;
                });

                const barColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

                const typeCounts: Record<string, number> = {};
                questions.forEach(q => { typeCounts[q.type] = (typeCounts[q.type] || 0) + 1 });
                const typeData = Object.entries(typeCounts).map(([key, val]) => ({
                    label: QuestionTypeLabels[key as QuestionType] || key,
                    value: val,
                    color: '#64748b'
                })).sort((a,b) => b.value - a.value);

                const discCounts: Record<string, number> = {};
                questions.forEach(q => { discCounts[q.disciplineId] = (discCounts[q.disciplineId] || 0) + 1 });
                const topDisc = Object.entries(discCounts)
                    .map(([id, val]) => ({ label: disciplines.find(d => d.id === id)?.name || 'Desconhecida', value: val }))
                    .sort((a,b) => b.value - a.value)
                    .slice(0, 5);

                const recent = [...exams].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);

                setStats({
                    exams: exams.length,
                    questions: questions.length,
                    classes: classes.length,
                    institutions: institutions.length,
                    questionsByDifficulty: [
                        { label: 'Fácil', value: diffCounts.Easy, color: '#22c55e' },
                        { label: 'Médio', value: diffCounts.Medium, color: '#eab308' },
                        { label: 'Difícil', value: diffCounts.Hard, color: '#ef4444' }
                    ],
                    examsByMonth: last6Months.map((m, i) => ({ 
                        label: m.label, 
                        value: m.value, 
                        color: barColors[i % barColors.length] 
                    })),
                    questionsByType: typeData,
                    topDisciplines: topDisc,
                    recentExams: recent
                });
                setLoading(false);
            } catch (e) {
                console.error("Erro ao carregar dashboard", e);
                setLoading(false);
            }
        };
        loadDashboardData();
    }, []);

    if (loading) return (
        <div className="flex h-full items-center justify-center p-8">
            <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-brand-blue border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-400 animate-pulse">Carregando estatísticas...</p>
            </div>
        </div>
    );

    return (
        <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar h-full">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h2 className="text-3xl font-display font-bold text-slate-800">Olá, {user?.name.split(' ')[0]}</h2>
                    <p className="text-slate-500 mt-1">Aqui está o resumo da sua plataforma hoje.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between group hover:shadow-md transition-shadow">
                    <div>
                        <p className="text-sm text-slate-500 font-medium mb-1">Total de Provas</p>
                        <h3 className="text-3xl font-bold text-slate-800">{stats.exams}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-blue-50 text-brand-blue flex items-center justify-center group-hover:scale-110 transition-transform"><Icons.Exams /></div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between group hover:shadow-md transition-shadow">
                    <div>
                        <p className="text-sm text-slate-500 font-medium mb-1">Banco de Questões</p>
                        <h3 className="text-3xl font-bold text-slate-800">{stats.questions}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-orange-50 text-brand-orange flex items-center justify-center group-hover:scale-110 transition-transform"><Icons.Questions /></div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between group hover:shadow-md transition-shadow">
                    <div>
                        <p className="text-sm text-slate-500 font-medium mb-1">Turmas Ativas</p>
                        <h3 className="text-3xl font-bold text-slate-800">{stats.classes}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center group-hover:scale-110 transition-transform"><Icons.UsersGroup /></div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between group hover:shadow-md transition-shadow">
                    <div>
                        <p className="text-sm text-slate-500 font-medium mb-1">Instituições</p>
                        <h3 className="text-3xl font-bold text-slate-800">{stats.institutions}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform"><Icons.Building /></div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <Card title="Provas Criadas (6 Meses)" className="lg:col-span-2">
                    <SimpleBarChart data={stats.examsByMonth} />
                </Card>
                <Card title="Dificuldade das Questões">
                    <div className="h-40 flex items-center justify-center">
                        <SimpleDonutChart data={stats.questionsByDifficulty} />
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card title="Provas Recentes" className="lg:col-span-2">
                    {stats.recentExams.length === 0 ? <p className="text-slate-400 italic text-sm">Nenhuma prova criada recentemente.</p> : (
                        <div className="divide-y divide-slate-100">
                            {stats.recentExams.map(exam => (
                                <div key={exam.id} className="py-3 flex items-center justify-between hover:bg-slate-50 rounded px-2 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded bg-blue-50 text-brand-blue flex items-center justify-center font-bold text-xs shrink-0">DOC</div>
                                        <div><h4 className="font-bold text-slate-800 text-sm line-clamp-1">{exam.title}</h4><p className="text-xs text-slate-500">{new Date(exam.createdAt).toLocaleDateString()} • {exam.questions?.length || 0} questões</p></div>
                                    </div>
                                    <Badge color="blue">Concluída</Badge>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
                <Card title="Questões por Tipo">
                   <div className="h-full flex flex-col justify-center">
                       <HorizontalBarChart data={stats.questionsByType.slice(0, 5)} />
                   </div>
                </Card>
            </div>
            
             <div className="mt-6">
                <Card title="Top Disciplinas">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                        {stats.topDisciplines.map((d, i) => (
                            <div key={i} className="bg-slate-50 rounded-lg p-4 border border-slate-100 text-center">
                                <div className="text-2xl font-bold text-brand-blue mb-1">{d.value}</div>
                                <div className="text-xs font-bold text-slate-600 uppercase tracking-wide truncate" title={d.label}>{d.label}</div>
                            </div>
                        ))}
                    </div>
                </Card>
             </div>
        </div>
    );
};

// --- INSTITUTION PAGE ---
const InstitutionPage = () => {
    const [list, setList] = useState<Institution[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Partial<Institution>>({});
    useEffect(() => { load(); }, []);
    const load = async () => setList(await FirebaseService.getInstitutions());
    const handleSave = async () => {
        if (!editing.name) return;
        if (editing.id) await FirebaseService.updateInstitution(editing as Institution); else await FirebaseService.addInstitution(editing as Institution);
        setIsModalOpen(false); load();
    };
    const handleDelete = async (id: string) => { if(confirm('Excluir?')) { await FirebaseService.deleteInstitution(id); load(); } }

    return (
        <div className="p-8 space-y-6">
            <div className="flex justify-between"><h2 className="text-2xl font-bold">Instituições</h2><Button onClick={() => { setEditing({}); setIsModalOpen(true); }}><Icons.Plus /> Nova</Button></div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {list.map(i => (
                    <Card key={i.id} className="flex flex-col justify-between">
                        <div className="flex items-center gap-3 mb-3">
                             {i.logoUrl ? <img src={i.logoUrl} className="w-12 h-12 object-contain" /> : <div className="w-12 h-12 bg-slate-100 flex items-center justify-center rounded"><Icons.Building /></div>}
                             <div><h3 className="font-bold">{i.name}</h3><p className="text-xs text-slate-500">{i.address}</p></div>
                        </div>
                        <div className="flex justify-end gap-2 mt-4"><Button variant="ghost" onClick={() => { setEditing(i); setIsModalOpen(true); }}><Icons.Edit /></Button><Button variant="ghost" className="text-red-500" onClick={() => handleDelete(i.id)}><Icons.Trash /></Button></div>
                    </Card>
                ))}
            </div>
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Instituição" footer={<Button onClick={handleSave}>Salvar</Button>}>
                <div className="space-y-3"><Input label="Nome" value={editing.name || ''} onChange={e => setEditing({...editing, name: e.target.value})} /><Input label="Logo URL" value={editing.logoUrl || ''} onChange={e => setEditing({...editing, logoUrl: e.target.value})} /><Input label="Endereço" value={editing.address || ''} onChange={e => setEditing({...editing, address: e.target.value})} /></div>
            </Modal>
        </div>
    );
};

// --- CLASSES PAGE (ACCORDION) ---
const ClassesPage = () => {
    const [list, setList] = useState<SchoolClass[]>([]);
    const [insts, setInsts] = useState<Institution[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Partial<SchoolClass>>({});
    const [expandedInsts, setExpandedInsts] = useState<Record<string, boolean>>({});

    useEffect(() => { load(); }, []);
    const load = async () => {
        setList(await FirebaseService.getClasses());
        setInsts(await FirebaseService.getInstitutions());
    };
    
    const handleSave = async () => {
        if (!editing.name || !editing.institutionId) return;
        if (editing.id) await FirebaseService.updateClass(editing as SchoolClass);
        else await FirebaseService.addClass(editing as SchoolClass);
        setIsModalOpen(false);
        load();
    }

    const handleDelete = async (id: string) => { if(confirm('Excluir turma?')) { await FirebaseService.deleteClass(id); load(); } }
    const toggleAccordion = (instId: string) => { setExpandedInsts(prev => ({ ...prev, [instId]: !prev[instId] })); };

    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar space-y-6">
            <div className="flex justify-between items-center"><h2 className="text-3xl font-display font-bold text-brand-dark">Turmas</h2><Button onClick={() => { setEditing({}); setIsModalOpen(true); }}><Icons.Plus /> Nova Turma</Button></div>
            {list.length === 0 ? <div className="text-center py-20 text-slate-400 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200"><div className="mb-3 flex justify-center"><Icons.UsersGroup /></div><p>Nenhuma turma cadastrada.</p></div> : (
                <div className="space-y-6">
                    {insts.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).map(inst => {
                            const instClasses = list.filter(c => c.institutionId === inst.id);
                            const years = Array.from(new Set(instClasses.map(c => c.year))).sort((a, b) => Number(b) - Number(a));
                            const isExpanded = expandedInsts[inst.id] !== false;
                            return (
                                <div key={inst.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                                    <div onClick={() => toggleAccordion(inst.id)} className="p-6 cursor-pointer hover:bg-slate-50 transition-colors flex justify-between items-center select-none">
                                        <h3 className="font-bold text-lg flex items-center gap-3">
                                            {inst.logoUrl ? <img src={inst.logoUrl} alt={inst.name} className="w-10 h-10 object-contain rounded border border-slate-200 bg-white" /> : <div className="p-2 bg-slate-100 rounded text-slate-500"><Icons.Building /></div>}
                                            <div className="flex flex-col"><span>{inst.name}</span><span className="text-xs font-normal text-slate-500">{instClasses.length} turmas cadastradas</span></div>
                                        </h3>
                                        <div className={`transform transition-transform duration-200 text-slate-400 ${isExpanded ? 'rotate-180' : ''}`}><Icons.ChevronDown /></div>
                                    </div>
                                    {isExpanded && (
                                        <div className="px-6 pb-6 border-t border-slate-100 animate-fade-in pt-4">
                                            {instClasses.length > 0 ? (
                                                <div className="space-y-8">
                                                    {years.map(year => {
                                                        const classesInYear = instClasses.filter(c => c.year === year);
                                                        return (
                                                            <div key={year}>
                                                                <div className="flex items-center gap-2 mb-4"><Badge color="blue">{year.toString()}</Badge><span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ano Letivo</span></div>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pl-2 border-l-2 border-slate-100 ml-2">
                                                                    {classesInYear.map(c => (
                                                                        <Card key={c.id} className="hover:shadow-md transition-shadow group flex flex-col border border-slate-200 bg-white p-0">
                                                                            <div className="p-5">
                                                                                <div className="flex justify-between items-start mb-3">
                                                                                    <div className="p-2 bg-green-50 text-green-600 rounded-lg"><Icons.UsersGroup /></div>
                                                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                        <button onClick={() => { setEditing(c); setIsModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-brand-blue hover:bg-blue-50 rounded transition-colors"><Icons.Edit /></button>
                                                                                        <button onClick={() => handleDelete(c.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"><Icons.Trash /></button>
                                                                                    </div>
                                                                                </div>
                                                                                <h3 className="font-bold text-lg text-slate-800">{c.name}</h3>
                                                                                <p className="text-xs text-slate-500 mt-1">{inst.name}</p>
                                                                            </div>
                                                                        </Card>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            ) : <p className="text-sm text-slate-400 italic">Nenhuma turma cadastrada.</p>}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                </div>
            )}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Turma" footer={<Button onClick={handleSave}>Salvar</Button>}>
                <div className="space-y-3">
                    <Input label="Nome" value={editing.name || ''} onChange={e => setEditing({...editing, name: e.target.value})} placeholder="Ex: 3º Ano A" />
                    <Input label="Ano" type="number" value={editing.year || new Date().getFullYear()} onChange={e => setEditing({...editing, year: parseInt(e.target.value)})} />
                    <Select label="Instituição" value={editing.institutionId || ''} onChange={e => setEditing({...editing, institutionId: e.target.value})}>
                        <option value="">Selecione...</option>
                        {insts.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </Select>
                </div>
            </Modal>
        </div>
    )
};

// --- HIERARCHY PAGE ---
const HierarchyPage = () => {
    const [hierarchy, setHierarchy] = useState<Discipline[]>([]);
    const [newDisc, setNewDisc] = useState('');
    useEffect(() => { load(); }, []);
    const load = async () => setHierarchy(await FirebaseService.getHierarchy());
    const addDisc = async () => { if(newDisc) { await FirebaseService.addDiscipline(newDisc); setNewDisc(''); load(); } }
    return (
        <div className="p-8 space-y-6">
             <h2 className="text-2xl font-bold">Conteúdos (Disciplinas)</h2>
             <div className="flex gap-2"><Input value={newDisc} onChange={e => setNewDisc(e.target.value)} placeholder="Nova Disciplina" /><Button onClick={addDisc}>Adicionar</Button></div>
             <div className="space-y-4">{hierarchy.map(d => (<div key={d.id} className="bg-white p-4 rounded shadow border"><h3 className="font-bold">{d.name}</h3><p className="text-sm text-slate-500">{d.chapters?.length || 0} capítulos</p></div>))}</div>
        </div>
    )
};

// --- QUESTIONS PAGE ---
const QuestionsPage = () => {
    const [questions, setQuestions] = useState<Question[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [newQ, setNewQ] = useState<Partial<Question>>({ type: QuestionType.MULTIPLE_CHOICE, difficulty: 'Medium' });
    const [isGenerating, setIsGenerating] = useState(false);
    const [genTopic, setGenTopic] = useState('');
    useEffect(() => { load(); }, []);
    const load = async () => setQuestions(await FirebaseService.getQuestions());
    const handleSave = async () => {
        if (!newQ.enunciado) return;
        await FirebaseService.addQuestion({ ...newQ, createdAt: new Date().toISOString(), id: '', disciplineId: 'd1', chapterId: 'c1', unitId: 'u1', topicId: 't1' } as Question);
        setShowModal(false); load();
    }
    const handleGenerate = async () => {
        setIsGenerating(true);
        const generated = await GeminiService.generateQuestion(genTopic, newQ.type || QuestionType.MULTIPLE_CHOICE, newQ.difficulty || 'Medium');
        if (generated) setNewQ(prev => ({ ...prev, ...generated }));
        setIsGenerating(false);
    }
    return (
        <div className="p-8 space-y-6">
            <div className="flex justify-between"><h2 className="text-2xl font-bold">Banco de Questões</h2><Button onClick={() => { setNewQ({ type: QuestionType.MULTIPLE_CHOICE, difficulty: 'Medium' }); setShowModal(true); }}><Icons.Plus /> Nova Questão</Button></div>
            <div className="bg-white rounded-lg shadow overflow-hidden">
                {questions.map(q => (
                    <div key={q.id} className="p-4 border-b hover:bg-slate-50">
                        <div className="flex justify-between mb-2"><div className="flex gap-2"><Badge>{QuestionTypeLabels[q.type]}</Badge><Badge color={q.difficulty === 'Hard' ? 'red' : 'green'}>{q.difficulty}</Badge></div></div>
                        <div dangerouslySetInnerHTML={{__html: q.enunciado}} />
                    </div>
                ))}
            </div>
            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nova Questão" footer={<Button onClick={handleSave}>Salvar</Button>}>
                 <div className="space-y-4">
                     <div className="bg-blue-50 p-4 rounded border border-blue-100 mb-4"><h4 className="font-bold text-blue-800 text-sm mb-2">Gerar com IA</h4><div className="flex gap-2"><Input placeholder="Tópico (ex: Equação 2º Grau)" value={genTopic} onChange={e => setGenTopic(e.target.value)} /><Button onClick={handleGenerate} disabled={isGenerating || !genTopic} variant="secondary">{isGenerating ? 'Gerando...' : 'Gerar'}</Button></div></div>
                     <Select label="Tipo" value={newQ.type} onChange={e => setNewQ({...newQ, type: e.target.value as QuestionType})}>{Object.entries(QuestionTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
                     <RichTextEditor label="Enunciado" value={newQ.enunciado || ''} onChange={val => setNewQ({...newQ, enunciado: val})} />
                 </div>
            </Modal>
        </div>
    )
};

// --- EXAMS PAGE ---
const ExamsPage = () => {
    const [exams, setExams] = useState<Exam[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [step, setStep] = useState<number>(1);
    const [draftExam, setDraftExam] = useState<Partial<Exam>>({ title: '', headerText: '', institutionId: '', classId: '', columns: 1, instructions: '<ul><li>Leia atentamente as questões.</li><li>Use caneta azul ou preta.</li></ul>', contentScopes: [], questions: [], showAnswerKey: false });
    const [institutions, setInstitutions] = useState<Institution[]>([]);
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [hierarchy, setHierarchy] = useState<Discipline[]>([]);
    const [allQuestions, setAllQuestions] = useState<Question[]>([]);
    const [selDisc, setSelDisc] = useState('');
    const [selChap, setSelChap] = useState('');
    const [selUnit, setSelUnit] = useState('');
    const [selTopic, setSelTopic] = useState('');
    const [selCount, setSelCount] = useState(1);
    const [genMode, setGenMode] = useState<'manual'|'auto'>('manual');
    const [filteredQuestions, setFilteredQuestions] = useState<Question[]>([]);
    const [expandedInsts, setExpandedInsts] = useState<Record<string, boolean>>({});

    useEffect(() => { loadData(); }, []);
    const loadData = async () => {
        const [d1, d2, d3, d4, d5] = await Promise.all([FirebaseService.getExams(), FirebaseService.getInstitutions(), FirebaseService.getClasses(), FirebaseService.getHierarchy(), FirebaseService.getQuestions()]);
        setExams(d1); setInstitutions(d2); setClasses(d3); setHierarchy(d4); setAllQuestions(d5);
    };

    const toggleAccordion = (instId: string) => setExpandedInsts(prev => ({ ...prev, [instId]: !prev[instId] }));
    const handleOpenWizard = () => { setStep(1); setDraftExam({ title: '', headerText: '', institutionId: institutions.length > 0 ? institutions[0].id : '', classId: '', columns: 1, instructions: '<ul><li>Leia atentamente as questões.</li><li>Use caneta azul ou preta.</li></ul>', contentScopes: [], questions: [], showAnswerKey: false }); setShowModal(true); };
    const handleAddContentScope = () => { if (!selDisc) return; const d = hierarchy.find(x => x.id === selDisc); const c = d?.chapters.find(x => x.id === selChap); const u = c?.units.find(x => x.id === selUnit); const t = u?.topics.find(x => x.id === selTopic); setDraftExam(prev => ({ ...prev, contentScopes: [...(prev.contentScopes || []), { id: Date.now().toString(), disciplineId: selDisc, disciplineName: d?.name || '', chapterId: selChap, chapterName: c?.name, unitId: selUnit, unitName: u?.name, topicId: selTopic, topicName: t?.name, questionCount: selCount }] })); };
    const handleAutoGenerate = () => { let newSelectedQuestions: Question[] = []; draftExam.contentScopes?.forEach(scope => { const pool = allQuestions.filter(q => { if (q.disciplineId !== scope.disciplineId) return false; if (scope.chapterId && q.chapterId !== scope.chapterId) return false; if (scope.unitId && q.unitId !== scope.unitId) return false; if (scope.topicId && q.topicId !== scope.topicId) return false; return true; }); const shuffled = [...pool].sort(() => 0.5 - Math.random()); newSelectedQuestions = [...newSelectedQuestions, ...shuffled.slice(0, scope.questionCount)]; }); setDraftExam(prev => ({ ...prev, questions: newSelectedQuestions })); };
    const handleFinish = async () => { if (!draftExam.title || !draftExam.questions?.length) return alert("Preencha título e selecione questões."); await FirebaseService.saveExam({ ...draftExam, id: draftExam.id || '', createdAt: draftExam.createdAt || new Date().toISOString() } as Exam); setShowModal(false); loadData(); };

    useEffect(() => {
        if (step === 3 && draftExam.contentScopes) {
            setFilteredQuestions(allQuestions.filter(q => draftExam.contentScopes?.some(scope => { if (q.disciplineId !== scope.disciplineId) return false; if (scope.chapterId && q.chapterId !== scope.chapterId) return false; if (scope.unitId && q.unitId !== scope.unitId) return false; if (scope.topicId && q.topicId !== scope.topicId) return false; return true; })));
        }
    }, [step, draftExam.contentScopes, allQuestions]);

    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar space-y-6 print:block print:overflow-visible print:h-auto">
            <div className="flex justify-between items-center print:hidden"><h2 className="text-3xl font-display font-bold text-brand-dark">Minhas Provas</h2><Button onClick={handleOpenWizard}><Icons.Plus /> Nova Prova</Button></div>
            <div className="print:hidden">
                {exams.length === 0 ? <div className="text-center py-20 text-slate-400 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200"><Icons.Exams /><p>Nenhuma prova criada.</p></div> : (
                    <div className="space-y-6">
                        {institutions.map(inst => {
                                const instExams = exams.filter(e => e.institutionId === inst.id);
                                const isExpanded = expandedInsts[inst.id] !== false;
                                return (
                                    <div key={inst.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                                        <div onClick={() => toggleAccordion(inst.id)} className="p-6 cursor-pointer hover:bg-slate-50 transition-colors flex justify-between items-center select-none"><h3 className="font-bold text-lg flex items-center gap-3">{inst.logoUrl ? <img src={inst.logoUrl} className="w-10 h-10 object-contain rounded border border-slate-200 bg-white" /> : <div className="p-2 bg-slate-100 rounded text-slate-500"><Icons.Building /></div>}<span>{inst.name}</span></h3><Icons.ChevronDown /></div>
                                        {isExpanded && <div className="px-6 pb-6 border-t border-slate-100 animate-fade-in pt-4"><div className="grid grid-cols-1 md:grid-cols-3 gap-6">{instExams.map(exam => (<Card key={exam.id} title={exam.title} className="hover:shadow-md"><p className="text-sm text-slate-500 mb-4">{exam.questions?.length || 0} questões</p><div className="flex justify-end gap-2"><Button variant="ghost" className="text-sm" onClick={() => { setDraftExam(exam); setStep(1); setShowModal(true); }}>Editar</Button><Button variant="ghost" className="text-sm text-red-500" onClick={async () => { if(confirm('Excluir?')) { await FirebaseService.deleteExam(exam.id); loadData(); } }}><Icons.Trash /></Button></div></Card>))}</div></div>}
                                    </div>
                                )
                        })}
                    </div>
                )}
            </div>
            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Gerador de Provas" maxWidth={step === 4 ? 'max-w-5xl' : 'max-w-4xl'} footer={<div className="flex justify-between w-full print:hidden"><Button variant="ghost" onClick={() => step > 1 ? setStep(step - 1) : setShowModal(false)}>{step === 1 ? 'Cancelar' : 'Voltar'}</Button><div className="flex gap-2">{step < 4 ? <Button onClick={() => setStep(step + 1)}>Próximo <Icons.ArrowRight /></Button> : <Button onClick={handleFinish} variant="secondary"><Icons.Check /> Salvar</Button>}</div></div>}>
                <div className="h-[60vh] flex flex-col">
                    <div className="flex-1 min-h-0 relative overflow-y-auto custom-scrollbar p-1">
                        {step === 1 && (
                            <div className="space-y-4">
                                <Input label="Título" value={draftExam.title} onChange={e => setDraftExam({...draftExam, title: e.target.value})} />
                                <div className="grid grid-cols-2 gap-4"><Select label="Instituição" value={draftExam.institutionId} onChange={e => setDraftExam({...draftExam, institutionId: e.target.value})}>{institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</Select><Select label="Turma" value={draftExam.classId} onChange={e => setDraftExam({...draftExam, classId: e.target.value})}>{classes.filter(c => c.institutionId === draftExam.institutionId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div>
                                <Input label="Cabeçalho" value={draftExam.headerText} onChange={e => setDraftExam({...draftExam, headerText: e.target.value})} />
                                <RichTextEditor label="Instruções" value={draftExam.instructions || ''} onChange={(html) => setDraftExam({...draftExam, instructions: html})} />
                            </div>
                        )}
                        {step === 2 && (
                             <div className="space-y-6">
                                <div className="grid grid-cols-12 gap-2 items-end bg-slate-50 p-4 rounded"><div className="col-span-3"><Select value={selDisc} onChange={e => { setSelDisc(e.target.value); setSelChap(''); }}><option value="">Disciplina</option>{hierarchy.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></div><div className="col-span-3"><Select value={selChap} onChange={e => setSelChap(e.target.value)}><option value="">Capítulo</option>{hierarchy.find(d => d.id === selDisc)?.chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div><div className="col-span-2"><Input type="number" value={selCount} onChange={e => setSelCount(parseInt(e.target.value))} /></div><div className="col-span-2"><Button onClick={handleAddContentScope}>+</Button></div></div>
                                {draftExam.contentScopes?.map(scope => <div key={scope.id} className="flex justify-between bg-white p-3 border rounded"><span>{scope.disciplineName} ({scope.questionCount}q)</span></div>)}
                             </div>
                        )}
                        {step === 3 && (
                            <div className="space-y-4">
                                <div className="flex justify-center gap-4"><Button onClick={() => setGenMode('manual')} variant={genMode === 'manual' ? 'primary' : 'ghost'}>Manual</Button><Button onClick={() => setGenMode('auto')} variant={genMode === 'auto' ? 'primary' : 'ghost'}>Auto</Button></div>
                                {genMode === 'manual' ? (
                                    <div className="border rounded bg-white divide-y">{filteredQuestions.map(q => <div key={q.id} onClick={() => setDraftExam(prev => { const exists = prev.questions?.find(x => x.id === q.id); return { ...prev, questions: exists ? prev.questions?.filter(x => x.id !== q.id) : [...(prev.questions || []), q] }; })} className={`p-4 cursor-pointer ${draftExam.questions?.some(x => x.id === q.id) ? 'bg-blue-50' : ''}`} dangerouslySetInnerHTML={{__html: q.enunciado}} />)}</div>
                                ) : (
                                    <div className="text-center p-8"><Button onClick={handleAutoGenerate}>Gerar Agora</Button><div className="mt-4">{draftExam.questions?.length} questões geradas</div></div>
                                )}
                            </div>
                        )}
                        {step === 4 && (
                            <div className="bg-white p-8 shadow-lg print:shadow-none">
                                <h1 className="text-center font-bold text-xl uppercase">{institutions.find(i => i.id === draftExam.institutionId)?.name}</h1>
                                <h2 className="text-center font-bold text-lg">{draftExam.title}</h2>
                                <div className="mt-8 space-y-6">{draftExam.questions?.map((q, i) => <div key={q.id}><span className="font-bold">{i+1}. </span><span dangerouslySetInnerHTML={{__html: q.enunciado}} /></div>)}</div>
                            </div>
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    );
};

// --- APP & ROUTING ---
const NavLink = ({ to, icon, label }: { to: string, icon: React.ReactNode, label: string }) => {
    const location = useLocation();
    const active = location.pathname === to;
    return (
        <Link to={to} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${active ? 'bg-brand-blue text-white font-semibold shadow-lg' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}>
            <span className={`${active ? 'text-white' : 'text-slate-500 group-hover:text-brand-orange'}`}>{icon}</span>
            {label}
        </Link>
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

  const handleLogout = async () => { await FirebaseService.logout(); setUser(null); };

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50 text-brand-blue">Carregando...</div>;
  if (!user) return <Login />;

  return (
    <AuthContext.Provider value={{ user, loading }}>
      <HashRouter>
        <div className="flex h-screen bg-slate-100 font-sans text-slate-900 overflow-hidden">
          <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 print:hidden transition-all duration-300">
             <div className="p-6 border-b border-slate-800 flex items-center gap-2">
                 <div className="w-8 h-8 bg-brand-blue rounded-lg flex items-center justify-center text-white font-bold text-xl">P</div>
                 <h1 className="font-display font-bold text-xl text-white">Prova Fácil</h1>
             </div>
             <nav className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
                 <NavLink to="/" icon={<Icons.Dashboard />} label="Dashboard" />
                 <div className="pt-4 pb-1 pl-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Gestão</div>
                 <NavLink to="/institutions" icon={<Icons.Building />} label="Instituições" />
                 <NavLink to="/classes" icon={<Icons.UsersGroup />} label="Turmas" />
                 <NavLink to="/hierarchy" icon={<Icons.BookOpen />} label="Conteúdos" />
                 <div className="pt-4 pb-1 pl-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Avaliações</div>
                 <NavLink to="/questions" icon={<Icons.Questions />} label="Banco de Questões" />
                 <NavLink to="/exams" icon={<Icons.Exams />} label="Provas" />
             </nav>
             <div className="p-4 border-t border-slate-800 bg-slate-900/50">
                 <div className="flex items-center gap-3 mb-3">
                     <div className="w-10 h-10 bg-brand-orange text-white rounded-full flex items-center justify-center font-bold">{user.name.charAt(0)}</div>
                     <div className="flex-1 min-w-0"><p className="text-sm font-bold text-white truncate">{user.name}</p></div>
                 </div>
                 <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 w-full hover:bg-white/5 p-2 rounded transition-colors"><Icons.Logout /> Sair</button>
             </div>
          </aside>
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
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
