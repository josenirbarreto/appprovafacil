
import React, { useState, useEffect, useRef, useContext, createContext } from 'react';
import { HashRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { User, UserRole, Question, Exam, Discipline, QuestionType, Institution, SchoolClass, ExamContentScope } from './types';
import { FirebaseService } from './services/firebaseService';
import { Button, Card, Badge, Input, Select, Modal, RichTextEditor } from './components/UI';
import { GeminiService } from './services/geminiService';
import { auth } from './firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';

// --- ICONS ---
const Icons = {
  Dashboard: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
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

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await FirebaseService.login(email, password);
        } catch (err: any) {
            setError('Erro ao fazer login. Verifique as credenciais.');
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

// --- CHART COMPONENTS (Pure CSS/SVG) ---

const SimpleBarChart = ({ data }: { data: { label: string, value: number, color?: string }[] }) => {
    const max = Math.max(...data.map(d => d.value), 1);
    return (
        <div className="flex items-end justify-between h-40 gap-2 w-full pt-6">
            {data.map((d, i) => (
                <div key={i} className="flex flex-col items-center flex-1 group relative">
                     <div className="absolute -top-6 text-xs font-bold text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity bg-white px-2 py-1 rounded shadow-sm border border-slate-100 z-10">{d.value}</div>
                    <div 
                        className={`w-full max-w-[40px] rounded-t-lg transition-all duration-500 ease-out hover:brightness-110 ${d.color || 'bg-brand-blue'}`}
                        style={{ height: `${(d.value / max) * 100}%` }}
                    ></div>
                    <div className="text-xs text-slate-400 mt-2 truncate max-w-full font-medium">{d.label}</div>
                </div>
            ))}
        </div>
    );
};

const SimpleDonutChart = ({ data }: { data: { label: string, value: number, color: string }[] }) => {
    const total = data.reduce((acc, curr) => acc + curr.value, 0);
    let accumulated = 0;
    
    // Create Conic Gradient
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

                // 1. Difficulty Stats
                const diffCounts = { Easy: 0, Medium: 0, Hard: 0 };
                questions.forEach(q => { if(diffCounts[q.difficulty] !== undefined) diffCounts[q.difficulty]++ });
                
                // 2. Exams by Month (Last 6 Months)
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

                // 3. Questions by Type
                const typeCounts: Record<string, number> = {};
                questions.forEach(q => { typeCounts[q.type] = (typeCounts[q.type] || 0) + 1 });
                const typeData = Object.entries(typeCounts).map(([key, val]) => ({
                    label: QuestionTypeLabels[key as QuestionType] || key,
                    value: val,
                    color: '#64748b' // slate-500
                })).sort((a,b) => b.value - a.value);

                // 4. Top Disciplines
                const discCounts: Record<string, number> = {};
                questions.forEach(q => { discCounts[q.disciplineId] = (discCounts[q.disciplineId] || 0) + 1 });
                const topDisc = Object.entries(discCounts)
                    .map(([id, val]) => ({ label: disciplines.find(d => d.id === id)?.name || 'Desconhecida', value: val }))
                    .sort((a,b) => b.value - a.value)
                    .slice(0, 5);

                // 5. Recent Exams
                const recent = [...exams].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);

                setStats({
                    exams: exams.length,
                    questions: questions.length,
                    classes: classes.length,
                    institutions: institutions.length,
                    questionsByDifficulty: [
                        { label: 'Fácil', value: diffCounts.Easy, color: '#22c55e' }, // green-500
                        { label: 'Médio', value: diffCounts.Medium, color: '#eab308' }, // yellow-500
                        { label: 'Difícil', value: diffCounts.Hard, color: '#ef4444' } // red-500
                    ],
                    examsByMonth: last6Months.map(m => ({ label: m.label, value: m.value, color: '#3A72EC' })),
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
                <div className="text-right hidden md:block">
                    <div className="text-sm font-bold text-brand-blue">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                </div>
            </div>

            {/* KPI CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between group hover:shadow-md transition-shadow">
                    <div>
                        <p className="text-sm text-slate-500 font-medium mb-1">Total de Provas</p>
                        <h3 className="text-3xl font-bold text-slate-800">{stats.exams}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-blue-50 text-brand-blue flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Icons.Exams />
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between group hover:shadow-md transition-shadow">
                    <div>
                        <p className="text-sm text-slate-500 font-medium mb-1">Banco de Questões</p>
                        <h3 className="text-3xl font-bold text-slate-800">{stats.questions}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-orange-50 text-brand-orange flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Icons.Questions />
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between group hover:shadow-md transition-shadow">
                    <div>
                        <p className="text-sm text-slate-500 font-medium mb-1">Turmas Ativas</p>
                        <h3 className="text-3xl font-bold text-slate-800">{stats.classes}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Icons.UsersGroup />
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between group hover:shadow-md transition-shadow">
                    <div>
                        <p className="text-sm text-slate-500 font-medium mb-1">Instituições</p>
                        <h3 className="text-3xl font-bold text-slate-800">{stats.institutions}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Icons.Building />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* CHART: EXAMS OVER TIME */}
                <Card title="Provas Criadas (6 Meses)" className="lg:col-span-2">
                    <SimpleBarChart data={stats.examsByMonth} />
                </Card>

                {/* CHART: QUESTIONS BY DIFFICULTY */}
                <Card title="Dificuldade das Questões">
                    <div className="h-40 flex items-center justify-center">
                        <SimpleDonutChart data={stats.questionsByDifficulty} />
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* LIST: RECENT EXAMS */}
                <Card title="Provas Recentes" className="lg:col-span-2">
                    {stats.recentExams.length === 0 ? (
                        <p className="text-slate-400 italic text-sm">Nenhuma prova criada recentemente.</p>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {stats.recentExams.map(exam => (
                                <div key={exam.id} className="py-3 flex items-center justify-between hover:bg-slate-50 rounded px-2 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded bg-blue-50 text-brand-blue flex items-center justify-center font-bold text-xs shrink-0">
                                            DOC
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 text-sm line-clamp-1">{exam.title}</h4>
                                            <p className="text-xs text-slate-500">{new Date(exam.createdAt).toLocaleDateString()} • {exam.questions?.length || 0} questões</p>
                                        </div>
                                    </div>
                                    <Badge color="blue">Concluída</Badge>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                {/* CHART: QUESTIONS BY TYPE */}
                <Card title="Questões por Tipo">
                   <div className="h-full flex flex-col justify-center">
                       <HorizontalBarChart data={stats.questionsByType.slice(0, 5)} />
                   </div>
                </Card>
            </div>
            
             {/* TOP DISCIPLINES */}
             <div className="mt-6">
                <Card title="Top Disciplinas">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                        {stats.topDisciplines.map((d, i) => (
                            <div key={i} className="bg-slate-50 rounded-lg p-4 border border-slate-100 text-center">
                                <div className="text-2xl font-bold text-brand-blue mb-1">{d.value}</div>
                                <div className="text-xs font-bold text-slate-600 uppercase tracking-wide truncate" title={d.label}>{d.label}</div>
                            </div>
                        ))}
                        {stats.topDisciplines.length === 0 && <p className="text-slate-400 text-sm col-span-5 text-center py-4">Nenhuma disciplina com questões cadastradas.</p>}
                    </div>
                </Card>
             </div>
        </div>
    );
};

const InstitutionPage = () => {
    const [list, setList] = useState<Institution[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Partial<Institution>>({});

    useEffect(() => { load(); }, []);
    const load = async () => setList(await FirebaseService.getInstitutions());

    const handleSave = async () => {
        if (!editing.name) return;
        if (editing.id) await FirebaseService.updateInstitution(editing as Institution);
        else await FirebaseService.addInstitution(editing as Institution);
        setIsModalOpen(false);
        load();
    };

    const handleDelete = async (id: string) => {
        if(confirm('Excluir instituição?')) {
            await FirebaseService.deleteInstitution(id);
            load();
        }
    }

    return (
        <div className="p-8 space-y-6">
            <div className="flex justify-between">
                <h2 className="text-2xl font-bold">Instituições</h2>
                <Button onClick={() => { setEditing({}); setIsModalOpen(true); }}><Icons.Plus /> Nova</Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {list.map(i => (
                    <Card key={i.id} className="flex flex-col justify-between">
                        <div className="flex items-center gap-3 mb-3">
                             {i.logoUrl ? <img src={i.logoUrl} className="w-12 h-12 object-contain" /> : <div className="w-12 h-12 bg-slate-100 flex items-center justify-center rounded"><Icons.Building /></div>}
                             <div><h3 className="font-bold">{i.name}</h3><p className="text-xs text-slate-500">{i.address}</p></div>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <Button variant="ghost" onClick={() => { setEditing(i); setIsModalOpen(true); }}><Icons.Edit /></Button>
                            <Button variant="ghost" className="text-red-500" onClick={() => handleDelete(i.id)}><Icons.Trash /></Button>
                        </div>
                    </Card>
                ))}
            </div>
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Instituição" footer={<Button onClick={handleSave}>Salvar</Button>}>
                <div className="space-y-3">
                    <Input label="Nome" value={editing.name || ''} onChange={e => setEditing({...editing, name: e.target.value})} />
                    <Input label="Logo URL" value={editing.logoUrl || ''} onChange={e => setEditing({...editing, logoUrl: e.target.value})} />
                    <Input label="Endereço" value={editing.address || ''} onChange={e => setEditing({...editing, address: e.target.value})} />
                </div>
            </Modal>
        </div>
    );
};

const ClassesPage = () => {
    const [list, setList] = useState<SchoolClass[]>([]);
    const [insts, setInsts] = useState<Institution[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Partial<SchoolClass>>({});

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

    return (
        <div className="p-8 space-y-6">
            <div className="flex justify-between">
                <h2 className="text-2xl font-bold">Turmas</h2>
                <Button onClick={() => { setEditing({}); setIsModalOpen(true); }}><Icons.Plus /> Nova</Button>
            </div>
            <div className="bg-white rounded-lg shadow border">
                {list.map(c => {
                    const instName = insts.find(i => i.id === c.institutionId)?.name;
                    return (
                        <div key={c.id} className="p-4 border-b last:border-0 flex justify-between items-center">
                            <div><h3 className="font-bold">{c.name}</h3><p className="text-sm text-slate-500">{instName} • {c.year}</p></div>
                            <div className="flex gap-2">
                                <Button variant="ghost" onClick={() => { setEditing(c); setIsModalOpen(true); }}><Icons.Edit /></Button>
                                <Button variant="ghost" className="text-red-500" onClick={async () => { if(confirm('Excluir?')) { await FirebaseService.deleteClass(c.id); load(); }}}><Icons.Trash /></Button>
                            </div>
                        </div>
                    )
                })}
            </div>
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Turma" footer={<Button onClick={handleSave}>Salvar</Button>}>
                <div className="space-y-3">
                    <Input label="Nome" value={editing.name || ''} onChange={e => setEditing({...editing, name: e.target.value})} />
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

const HierarchyPage = () => {
    const [hierarchy, setHierarchy] = useState<Discipline[]>([]);
    const [newDisc, setNewDisc] = useState('');

    useEffect(() => { load(); }, []);
    const load = async () => setHierarchy(await FirebaseService.getHierarchy());

    const addDisc = async () => {
        if(newDisc) {
            await FirebaseService.addDiscipline(newDisc);
            setNewDisc('');
            load();
        }
    }

    return (
        <div className="p-8 space-y-6">
             <h2 className="text-2xl font-bold">Conteúdos (Disciplinas)</h2>
             <div className="flex gap-2">
                 <Input value={newDisc} onChange={e => setNewDisc(e.target.value)} placeholder="Nova Disciplina" />
                 <Button onClick={addDisc}>Adicionar</Button>
             </div>
             <div className="space-y-4">
                 {hierarchy.map(d => (
                     <div key={d.id} className="bg-white p-4 rounded shadow border">
                         <h3 className="font-bold">{d.name}</h3>
                         <p className="text-sm text-slate-500">{d.chapters?.length || 0} capítulos</p>
                     </div>
                 ))}
             </div>
        </div>
    )
};

const QuestionsPage = () => {
    const [questions, setQuestions] = useState<Question[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [newQ, setNewQ] = useState<Partial<Question>>({ type: QuestionType.MULTIPLE_CHOICE, difficulty: 'Medium' });
    const [isGenerating, setIsGenerating] = useState(false);
    
    // Generator State
    const [genTopic, setGenTopic] = useState('');
    
    useEffect(() => { load(); }, []);
    const load = async () => setQuestions(await FirebaseService.getQuestions());

    const handleSave = async () => {
        if (!newQ.enunciado) return;
        await FirebaseService.addQuestion({
            ...newQ,
            createdAt: new Date().toISOString(),
            id: '',
            disciplineId: 'd1', chapterId: 'c1', unitId: 'u1', topicId: 't1' 
        } as Question);
        setShowModal(false);
        load();
    }

    const handleGenerate = async () => {
        setIsGenerating(true);
        const generated = await GeminiService.generateQuestion(genTopic, newQ.type || QuestionType.MULTIPLE_CHOICE, newQ.difficulty || 'Medium');
        if (generated) {
            setNewQ(prev => ({ ...prev, ...generated }));
        }
        setIsGenerating(false);
    }

    return (
        <div className="p-8 space-y-6">
            <div className="flex justify-between">
                <h2 className="text-2xl font-bold">Banco de Questões</h2>
                <Button onClick={() => { setNewQ({ type: QuestionType.MULTIPLE_CHOICE, difficulty: 'Medium' }); setShowModal(true); }}><Icons.Plus /> Nova Questão</Button>
            </div>
            <div className="bg-white rounded-lg shadow overflow-hidden">
                {questions.map(q => (
                    <div key={q.id} className="p-4 border-b hover:bg-slate-50">
                        <div className="flex justify-between mb-2">
                            <div className="flex gap-2">
                                <Badge>{QuestionTypeLabels[q.type]}</Badge>
                                <Badge color={q.difficulty === 'Hard' ? 'red' : 'green'}>{q.difficulty}</Badge>
                            </div>
                        </div>
                        <div dangerouslySetInnerHTML={{__html: q.enunciado}} />
                    </div>
                ))}
            </div>
            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nova Questão" footer={<Button onClick={handleSave}>Salvar</Button>}>
                 <div className="space-y-4">
                     <div className="bg-blue-50 p-4 rounded border border-blue-100 mb-4">
                         <h4 className="font-bold text-blue-800 text-sm mb-2">Gerar com IA</h4>
                         <div className="flex gap-2">
                             <Input placeholder="Tópico (ex: Equação 2º Grau)" value={genTopic} onChange={e => setGenTopic(e.target.value)} />
                             <Button onClick={handleGenerate} disabled={isGenerating || !genTopic} variant="secondary">
                                 {isGenerating ? 'Gerando...' : 'Gerar'}
                             </Button>
                         </div>
                     </div>
                     <Select label="Tipo" value={newQ.type} onChange={e => setNewQ({...newQ, type: e.target.value as QuestionType})}>
                         {Object.entries(QuestionTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                     </Select>
                     <RichTextEditor label="Enunciado" value={newQ.enunciado || ''} onChange={val => setNewQ({...newQ, enunciado: val})} />
                 </div>
            </Modal>
        </div>
    )
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
        classId: '',
        columns: 1,
        instructions: '<ul><li>Leia atentamente as questões.</li><li>Use caneta azul ou preta.</li></ul>',
        contentScopes: [],
        questions: [],
        showAnswerKey: false
    });

    // Dados auxiliares
    const [institutions, setInstitutions] = useState<Institution[]>([]);
    const [classes, setClasses] = useState<SchoolClass[]>([]);
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

    // Estado para Accordion (Visualização Hierárquica na Lista)
    const [expandedInsts, setExpandedInsts] = useState<Record<string, boolean>>({});

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        const data = await FirebaseService.getExams();
        const insts = await FirebaseService.getInstitutions();
        const cls = await FirebaseService.getClasses();
        const hier = await FirebaseService.getHierarchy();
        const qs = await FirebaseService.getQuestions();
        setExams(data);
        setInstitutions(insts);
        setClasses(cls);
        setHierarchy(hier);
        setAllQuestions(qs);
    };

    const toggleAccordion = (instId: string) => {
        setExpandedInsts(prev => ({ ...prev, [instId]: !prev[instId] }));
    };

    // --- LÓGICA DO WIZARD ---

    const handleOpenWizard = () => {
        setStep(1);
        setDraftExam({
            title: '',
            headerText: '',
            institutionId: institutions.length > 0 ? institutions[0].id : '',
            classId: '',
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

    useEffect(() => {
        if (step === 3 && draftExam.contentScopes) {
            const relevant = allQuestions.filter(q => {
                return draftExam.contentScopes?.some(scope => {
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
            const pool = allQuestions.filter(q => {
                if (q.disciplineId !== scope.disciplineId) return false;
                if (scope.chapterId && q.chapterId !== scope.chapterId) return false;
                if (scope.unitId && q.unitId !== scope.unitId) return false;
                if (scope.topicId && q.topicId !== scope.topicId) return false;
                return true;
            });
            const shuffled = [...pool].sort(() => 0.5 - Math.random());
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

    // --- RENDER STEPS ---
    const renderStep1 = () => {
        // Filtrar turmas pela instituição selecionada
        const availableClasses = classes.filter(c => c.institutionId === draftExam.institutionId);

        return (
            <div className="space-y-4 animate-fade-in h-full overflow-y-auto custom-scrollbar p-1">
                <Input label="Título da Prova *" value={draftExam.title} onChange={e => setDraftExam({...draftExam, title: e.target.value})} placeholder="Ex: Avaliação Bimestral 3º Ano" autoFocus />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select 
                        label="Instituição" 
                        value={draftExam.institutionId} 
                        onChange={e => setDraftExam({...draftExam, institutionId: e.target.value, classId: ''})} 
                    >
                        {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </Select>
                    
                    <Select 
                        label="Turma" 
                        value={draftExam.classId || ''} 
                        onChange={e => setDraftExam({...draftExam, classId: e.target.value})}
                        disabled={!draftExam.institutionId}
                    >
                        <option value="">Selecione...</option>
                        {availableClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </Select>
                </div>

                <Input label="Cabeçalho / Subtítulo" value={draftExam.headerText} onChange={e => setDraftExam({...draftExam, headerText: e.target.value})} placeholder="Ex: Professor Carlos - Matemática" />
                
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <label className="text-sm font-semibold text-slate-700 block mb-2">Layout da Prova</label>
                    <div className="flex gap-4">
                        <label className={`flex-1 border p-3 rounded cursor-pointer transition-all flex items-center justify-center gap-2 ${draftExam.columns === 1 ? 'bg-blue-50 border-brand-blue text-brand-blue ring-1 ring-brand-blue' : 'bg-white hover:bg-slate-50'}`}>
                            <input type="radio" name="cols" className="hidden" checked={draftExam.columns === 1} onChange={() => setDraftExam({...draftExam, columns: 1})} />
                            <div className="w-4 h-6 border-2 border-current rounded-sm"></div><span>1 Coluna</span>
                        </label>
                        <label className={`flex-1 border p-3 rounded cursor-pointer transition-all flex items-center justify-center gap-2 ${draftExam.columns === 2 ? 'bg-blue-50 border-brand-blue text-brand-blue ring-1 ring-brand-blue' : 'bg-white hover:bg-slate-50'}`}>
                            <input type="radio" name="cols" className="hidden" checked={draftExam.columns === 2} onChange={() => setDraftExam({...draftExam, columns: 2})} />
                            <div className="flex gap-0.5"><div className="w-2 h-6 border-2 border-current rounded-sm"></div><div className="w-2 h-6 border-2 border-current rounded-sm"></div></div><span>2 Colunas</span>
                        </label>
                    </div>
                </div>
                <RichTextEditor label="Instruções da Prova" value={draftExam.instructions || ''} onChange={(html) => setDraftExam({...draftExam, instructions: html})} />
            </div>
        );
    };

    const renderStep2 = () => {
        const selectedD = hierarchy.find(d => d.id === selDisc);
        const selectedC = selectedD?.chapters.find(c => c.id === selChap);
        const selectedU = selectedC?.units.find(u => u.id === selUnit);
        return (
            <div className="space-y-6 animate-fade-in h-full overflow-y-auto custom-scrollbar p-1">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-blue-800 shrink-0"><p>Adicione os tópicos que cairão na prova e defina a quantidade de questões para cada um.</p></div>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end bg-slate-50 p-4 rounded-xl border border-slate-200 shrink-0">
                    <div className="md:col-span-3"><Select label="Disciplina" value={selDisc} onChange={e => { setSelDisc(e.target.value); setSelChap(''); setSelUnit(''); setSelTopic(''); }}><option value="">Selecione...</option>{hierarchy.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></div>
                    <div className="md:col-span-2"><Select label="Capítulo" value={selChap} onChange={e => { setSelChap(e.target.value); setSelUnit(''); setSelTopic(''); }} disabled={!selDisc}><option value="">Todos</option>{selectedD?.chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div>
                    <div className="md:col-span-2"><Select label="Unidade" value={selUnit} onChange={e => { setSelUnit(e.target.value); setSelTopic(''); }} disabled={!selChap}><option value="">Todas</option>{selectedC?.units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></div>
                    <div className="md:col-span-3"><Select label="Tópico" value={selTopic} onChange={e => setSelTopic(e.target.value)} disabled={!selUnit}><option value="">Todos</option>{selectedU?.topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></div>
                    <div className="md:col-span-1"><Input label="Qtd." type="number" min="1" value={selCount} onChange={e => setSelCount(parseInt(e.target.value))} /></div>
                    <div className="md:col-span-1"><Button onClick={handleAddContentScope} disabled={!selDisc} className="w-full mb-[1px]">+</Button></div>
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
                                        <div className="flex items-center gap-2 mb-1"><Badge color={scope.questionCount > available ? 'red' : 'blue'}>{scope.questionCount} / {available} disp.</Badge><span className="font-bold text-brand-blue">{scope.disciplineName}</span></div>
                                        <div className="text-slate-500 text-xs">{scope.chapterName && <span> &gt; {scope.chapterName}</span>}{scope.unitName && <span> &gt; {scope.unitName}</span>}{scope.topicName && <span> &gt; {scope.topicName}</span>}<span className="ml-2 text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-semibold">{scope.topicName ? 'Tópico Específico' : scope.unitName ? 'Toda a Unidade' : scope.chapterName ? 'Todo o Capítulo' : 'Toda a Disciplina'}</span></div>
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
        const totalRequested = draftExam.contentScopes?.reduce((acc, scope) => acc + scope.questionCount, 0) || 0;
        return (
            <div className="space-y-4 animate-fade-in h-full flex flex-col min-h-0">
                <div className="flex justify-center gap-4 mb-4 shrink-0">
                    <button onClick={() => setGenMode('manual')} className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${genMode === 'manual' ? 'bg-brand-blue text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Seleção Manual</button>
                    <button onClick={() => setGenMode('auto')} className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${genMode === 'auto' ? 'bg-brand-blue text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Gerar Automaticamente</button>
                </div>
                {genMode === 'manual' ? (
                    <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                        <div className="flex justify-between items-center mb-2 px-1 shrink-0">
                           <span className="text-sm text-slate-500">Selecione as questões que deseja incluir. <span className="text-brand-blue font-semibold ml-1">Selecionadas no topo.</span></span>
                           {draftExam.questions && draftExam.questions.length > 0 && (<button onClick={() => setDraftExam(prev => ({...prev, questions: []}))} className="text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1 rounded transition-colors">Desmarcar Todas</button>)}
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar border rounded-lg bg-white divide-y divide-slate-100">
                            {filteredQuestions.length === 0 ? (<div className="p-8 text-center text-slate-400">Nenhuma questão encontrada para os conteúdos selecionados.</div>) : (
                                [...filteredQuestions].sort((a, b) => {
                                    const isA = (draftExam.questions?.some(sel => sel.id === a.id) || false) ? 1 : 0;
                                    const isB = (draftExam.questions?.some(sel => sel.id === b.id) || false) ? 1 : 0;
                                    return isB - isA;
                                }).map(q => {
                                    const isSelected = draftExam.questions?.some(sel => sel.id === q.id);
                                    return (
                                        <div key={q.id} onClick={() => toggleQuestionSelection(q)} className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors flex gap-3 ${isSelected ? 'bg-blue-50/70' : ''}`}>
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-1 transition-colors ${isSelected ? 'bg-brand-blue border-brand-blue text-white' : 'border-slate-300 bg-white'}`}>{isSelected && <Icons.Check />}</div>
                                            <div className="flex-1"><div className="flex gap-2 text-xs mb-1"><Badge color="blue">{QuestionTypeLabels[q.type]}</Badge><Badge color={q.difficulty === 'Hard' ? 'red' : q.difficulty === 'Medium' ? 'yellow' : 'green'}>{q.difficulty}</Badge></div><div className="text-sm text-slate-800 line-clamp-3 rich-text-content" dangerouslySetInnerHTML={{__html: q.enunciado}} /></div>
                                            <button onClick={(e) => { e.stopPropagation(); setViewingQuestion(q); }} className="self-center p-2 text-slate-400 hover:text-brand-blue hover:bg-blue-50 rounded-full transition-colors flex-shrink-0" title="Visualizar questão completa"><Icons.Eye /></button>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                        <div className="mt-2 text-right font-bold text-brand-dark shrink-0">{draftExam.questions?.length} questões selecionadas</div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
                        <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 text-center mb-4 shrink-0"><Icons.Sparkles /><h3 className="text-lg font-bold text-blue-800 mt-2">Geração Automática de Prova</h3><p className="text-sm text-blue-600 mt-1 mb-4">Com base nos conteúdos selecionados no Passo 2, o sistema irá selecionar aleatoriamente <strong className="font-bold text-blue-900"> {totalRequested} questões</strong> do banco de dados.</p><Button onClick={handleAutoGenerate} className="mx-auto">{draftExam.questions?.length ? 'Regerar Questões' : 'Gerar Questões Agora'}</Button></div>
                        {draftExam.questions && draftExam.questions.length > 0 && (
                            <div className="flex-1 flex flex-col animate-fade-in min-h-0">
                                <h4 className="font-bold text-slate-700 mb-2 shrink-0">Resultado da Geração ({draftExam.questions.length} questões):</h4>
                                <div className="border rounded-lg bg-white divide-y divide-slate-100">
                                    {draftExam.questions.map((q, idx) => (
                                        <div key={q.id} className="p-4 flex gap-3 relative group hover:bg-slate-50 transition-colors"><span className="font-bold text-slate-400 w-6 text-right shrink-0">{idx + 1}.</span><div className="flex-1"><div className="flex gap-2 text-xs mb-1"><Badge color="blue">{QuestionTypeLabels[q.type]}</Badge><Badge color={q.difficulty === 'Hard' ? 'red' : q.difficulty === 'Medium' ? 'yellow' : 'green'}>{q.difficulty}</Badge></div><div className="text-sm text-slate-800 rich-text-content" dangerouslySetInnerHTML={{__html: q.enunciado}} /></div><div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all bg-white/80 backdrop-blur-sm rounded p-1"><button onClick={() => setViewingQuestion(q)} className="p-1.5 text-slate-400 hover:text-brand-blue hover:bg-blue-50 rounded" title="Visualizar"><Icons.Eye /></button><button onClick={() => toggleQuestionSelection(q)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded" title="Remover questão"><Icons.Trash /></button></div></div>
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
        const selectedClass = classes.find(c => c.id === draftExam.classId);

        return (
            <div className="h-full flex flex-col animate-fade-in print:block print:h-auto print:overflow-visible">
                <div className="bg-brand-blue text-white p-3 rounded-t-lg flex justify-between items-center shrink-0 print:hidden">
                    <span className="font-bold text-sm">Visualização de Impressão</span>
                    <Button variant="secondary" onClick={handlePrint} className="text-xs h-8"><Icons.Printer /> Imprimir</Button>
                </div>
                <div className="flex-1 overflow-y-auto bg-slate-200 p-4 md:p-8 custom-scrollbar print:block print:overflow-visible print:h-auto print:bg-white print:p-0 print:m-0">
                    <div id="printable-section" className="bg-white mx-auto max-w-[210mm] min-h-[297mm] print:min-h-0 p-[15mm] shadow-lg print:shadow-none print:w-full print:max-w-none print:p-0 text-black box-border">
                        <div className="border-b-2 border-black pb-4 mb-6 flex gap-4 items-center">
                            {inst?.logoUrl && <img src={inst.logoUrl} alt="Logo" className="h-16 w-auto object-contain" />}
                            <div className="flex-1"><h1 className="text-xl font-bold uppercase text-center">{inst?.name || 'Nome da Instituição'}</h1><h2 className="text-lg font-semibold text-center mt-1">{draftExam.title}</h2><p className="text-center text-sm mt-1">{draftExam.headerText}</p></div>
                        </div>
                        <div className="grid grid-cols-12 gap-4 mb-6 text-sm font-medium">
                            <div className="col-span-8 flex items-end gap-2"><span className="mb-1">Nome:</span><div className="flex-1 border-b border-black"></div></div>
                            <div className="col-span-4 flex items-end gap-2"><span className="mb-1">Data:</span><div className="flex-1 border-b border-black"></div></div>
                            <div className="col-span-4 flex items-end gap-2"><span className="mb-1">Turma:</span><div className="flex-1 border-b border-black">{selectedClass?.name || ''}</div></div>
                            <div className="col-span-4 flex items-end gap-2"><span className="mb-1">Matrícula:</span><div className="flex-1 border-b border-black"></div></div>
                            <div className="col-span-4 flex items-end gap-2"><span className="mb-1">Nota:</span><div className="flex-1 border-b border-black"></div></div>
                        </div>
                        {draftExam.instructions && (<div className="mb-6 p-4 border border-black rounded text-sm bg-slate-50 print:bg-transparent"><strong className="block mb-1 uppercase text-xs">Instruções:</strong><div className="rich-text-content" dangerouslySetInnerHTML={{ __html: draftExam.instructions }} /></div>)}
                        <div className={`${draftExam.columns === 2 ? 'columns-2 gap-8 [column-rule:1px_solid_#000]' : ''}`}>
                            {draftExam.questions?.map((q, idx) => (
                                <div key={q.id} className="mb-6 break-inside-avoid">
                                    <div className="flex gap-2 mb-1"><span className="font-bold text-lg">{idx + 1}.</span><div className="rich-text-content text-sm text-justify" dangerouslySetInnerHTML={{ __html: q.enunciado }} /></div>
                                    {q.type === QuestionType.MULTIPLE_CHOICE && (<div className="ml-6 space-y-1 mt-2">{q.options?.map((opt, optIdx) => (<div key={optIdx} className="flex gap-2 text-sm items-start"><span className="font-bold">({String.fromCharCode(97 + optIdx)})</span><span>{opt.text}</span></div>))}</div>)}
                                    {q.type === QuestionType.TRUE_FALSE && (<div className="ml-6 mt-2 text-sm">( &nbsp; ) Verdadeiro &nbsp;&nbsp;&nbsp; ( &nbsp; ) Falso</div>)}
                                    {(q.type === QuestionType.SHORT_ANSWER || q.type === QuestionType.NUMERIC) && (<div className="mt-8 border-b border-black border-dotted w-full"></div>)}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar space-y-6 print:block print:overflow-visible print:h-auto">
            <div className="flex justify-between items-center print:hidden">
                <h2 className="text-3xl font-display font-bold text-brand-dark">Minhas Provas</h2>
                <Button onClick={handleOpenWizard}><Icons.Plus /> Nova Prova</Button>
            </div>

            <div className="print:hidden">
                {exams.length === 0 ? (
                    <div className="text-center py-20 text-slate-400 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                        <div className="mb-3"><Icons.Exams /></div>
                        <p>Nenhuma prova criada ainda.</p>
                        <p className="text-sm">Clique em "Nova Prova" para começar.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {institutions
                            .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
                            .map(inst => {
                                const instExams = exams.filter(e => e.institutionId === inst.id);
                                const years = Array.from(new Set(instExams.map(e => new Date(e.createdAt).getFullYear())))
                                    .sort((a, b) => Number(b) - Number(a));
                                
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
                                                    <span className="text-xs font-normal text-slate-500">{instExams.length} provas cadastradas</span>
                                                </div>
                                            </h3>
                                            <div className={`transform transition-transform duration-200 text-slate-400 ${isExpanded ? 'rotate-180' : ''}`}>
                                                <Icons.ChevronDown />
                                            </div>
                                        </div>
                                        
                                        {isExpanded && (
                                            <div className="px-6 pb-6 border-t border-slate-100 animate-fade-in pt-4">
                                                {instExams.length > 0 ? (
                                                    <div className="space-y-8">
                                                        {years.map(year => {
                                                            const examsInYear = instExams.filter(e => new Date(e.createdAt).getFullYear() === year);
                                                            const examsByClass: Record<string, Exam[]> = {};
                                                            examsInYear.forEach(e => {
                                                                const cId = e.classId || 'uncategorized';
                                                                if (!examsByClass[cId]) examsByClass[cId] = [];
                                                                examsByClass[cId].push(e);
                                                            });

                                                            const sortedClassIds = Object.keys(examsByClass).sort((a, b) => {
                                                                if (a === 'uncategorized') return 1;
                                                                if (b === 'uncategorized') return -1;
                                                                const classA = classes.find(c => c.id === a);
                                                                const classB = classes.find(c => c.id === b);
                                                                return (classA?.name || '').localeCompare(classB?.name || '');
                                                            });

                                                            return (
                                                                <div key={year}>
                                                                    <div className="flex items-center gap-2 mb-4">
                                                                        <Badge color="blue">{year.toString()}</Badge>
                                                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ano Letivo</span>
                                                                    </div>
                                                                    
                                                                    <div className="space-y-6 pl-2 border-l-2 border-slate-100 ml-2">
                                                                        {sortedClassIds.map(cId => {
                                                                            const classObj = classes.find(c => c.id === cId);
                                                                            const groupExams = examsByClass[cId];
                                                                            const groupName = classObj ? classObj.name : 'Sem Turma Vinculada';

                                                                            return (
                                                                                <div key={cId}>
                                                                                    <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                                                                                        <span className="w-2 h-2 rounded-full bg-brand-orange"></span>
                                                                                        {groupName}
                                                                                    </h4>
                                                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                                                        {groupExams.map(exam => (
                                                                                            <Card key={exam.id} className="hover:shadow-md transition-shadow group flex flex-col h-full border border-slate-200 bg-white">
                                                                                                <div className="flex items-start justify-between mb-4">
                                                                                                    <div className="p-3 bg-blue-50 text-brand-blue rounded-lg"><Icons.Exams /></div>
                                                                                                    <Badge color="blue">{new Date(exam.createdAt).toLocaleDateString()}</Badge>
                                                                                                </div>
                                                                                                <h3 className="font-bold text-lg text-brand-dark mb-2 line-clamp-2" title={exam.title}>{exam.title}</h3>
                                                                                                <p className="text-sm text-slate-500 mb-4">{exam.questions?.length || 0} questões</p>
                                                                                                <div className="mt-auto pt-4 border-t border-slate-100 flex justify-end gap-2">
                                                                                                    <Button variant="ghost" className="text-sm" onClick={() => handleEditExam(exam)}>Editar</Button>
                                                                                                    <Button variant="ghost" className="text-sm text-red-500" onClick={() => handleDeleteExam(exam.id)}><Icons.Trash /></Button>
                                                                                                </div>
                                                                                            </Card>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-slate-400 italic">Nenhuma prova cadastrada nesta instituição.</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                    </div>
                )}
            </div>

            <Modal 
                isOpen={showModal} 
                onClose={() => setShowModal(false)} 
                title={step === 4 ? 'Visualizar e Imprimir' : 'Gerador de Provas'} 
                maxWidth={step === 4 ? 'max-w-5xl' : 'max-w-4xl'}
                footer={
                    <div className="flex justify-between w-full print:hidden">
                        <Button variant="ghost" onClick={() => { if(step > 1) setStep(step - 1); else setShowModal(false); }}>
                            {step === 1 ? 'Cancelar' : 'Voltar'}
                        </Button>
                        <div className="flex gap-2">
                            {step < 4 ? (
                                <Button onClick={() => setStep(step + 1)}>Próximo <Icons.ArrowRight /></Button>
                            ) : (
                                <Button onClick={handleFinish} variant="secondary"><Icons.Check /> Salvar e Fechar</Button>
                            )}
                        </div>
                    </div>
                }
            >
                <div className="h-[60vh] flex flex-col">
                    <div className="flex items-center justify-between mb-6 px-8 shrink-0 print:hidden">
                        {[1, 2, 3, 4].map(s => (
                            <div key={s} className={`flex items-center gap-2 ${step >= s ? 'text-brand-blue' : 'text-slate-300'}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 ${step >= s ? 'border-brand-blue bg-blue-50' : 'border-slate-200'}`}>
                                    {s}
                                </div>
                                <span className={`text-sm font-medium hidden md:block ${step === s ? 'text-slate-800' : ''}`}>
                                    {s === 1 ? 'Configuração' : s === 2 ? 'Conteúdo' : s === 3 ? 'Questões' : 'Impressão'}
                                </span>
                                {s < 4 && <div className="w-12 h-0.5 bg-slate-100 mx-2 hidden md:block"></div>}
                            </div>
                        ))}
                    </div>

                    <div className="flex-1 min-h-0 relative">
                        {step === 1 && renderStep1()}
                        {step === 2 && renderStep2()}
                        {step === 3 && renderStep3()}
                        {step === 4 && renderStep4()}
                    </div>
                </div>
            </Modal>
        </div>
    );
};

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

  const handleLogout = async () => {
    await FirebaseService.logout();
    setUser(null);
  };

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
                     <div className="w-10 h-10 bg-brand-orange text-white rounded-full flex items-center justify-center font-bold">
                         {user.name.charAt(0)}
                     </div>
                     <div className="flex-1 min-w-0">
                         <p className="text-sm font-bold text-white truncate">{user.name}</p>
                         <p className="text-xs text-slate-400 truncate">{user.role === 'ADMIN' ? 'Administrador' : 'Professor'}</p>
                     </div>
                 </div>
                 <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 w-full hover:bg-white/5 p-2 rounded transition-colors">
                     <Icons.Logout /> Sair
                 </button>
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
