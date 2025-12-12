import React, { useState, useEffect, useContext, createContext, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { User, UserRole, Question, Exam, Discipline, QuestionType, Institution, SchoolClass, ExamContentScope } from './types';
import { FirebaseService } from './services/firebaseService';
import { Button, Card, Badge, Input, Select, Modal, RichTextEditor, Icons as UIIcons } from './components/UI';
import { GeminiService } from './services/geminiService';
import { PdfService } from './services/pdfService';
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
  Printer: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>,
  User: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  Camera: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  Filter: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>,
  Refresh: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
  FileText: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  Magic: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
};

const QuestionTypeLabels: Record<QuestionType, string> = {
  [QuestionType.MULTIPLE_CHOICE]: 'Múltipla Escolha',
  [QuestionType.TRUE_FALSE]: 'Verdadeiro/Falso',
  [QuestionType.SHORT_ANSWER]: 'Dissertativa',
  [QuestionType.NUMERIC]: 'Numérica',
  [QuestionType.ASSOCIATION]: 'Associação'
};

const AuthContext = createContext<{ user: User | null; loading: boolean; refreshUser: () => Promise<void> }>({ user: null, loading: true, refreshUser: async () => {} });
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
            setError('Erro ao fazer login. Verifique as Regras no Firebase e suas credenciais.');
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

// --- HIERARCHY PAGE ---
const HierarchyPage = () => {
    const [hierarchy, setHierarchy] = useState<Discipline[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedDisciplines, setExpandedDisciplines] = useState<Record<string, boolean>>({});
    const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});
    
    useEffect(() => { load(); }, []);
    const load = async () => { setHierarchy(await FirebaseService.getHierarchy()); setLoading(false); };

    const addD = async (name: string) => { await FirebaseService.addDiscipline(name); load(); }
    const addC = async (dId: string, name: string) => { await FirebaseService.addChapter(dId, name); load(); }
    const addU = async (dId: string, cId: string, name: string) => { await FirebaseService.addUnit(dId, cId, name); load(); }
    const addT = async (dId: string, cId: string, uId: string, name: string) => { await FirebaseService.addTopic(dId, cId, uId, name); load(); }

    const handleDelete = async (type: any, ids: any) => {
        if(confirm('Tem certeza? Isso apagará todos os itens filhos.')) {
            await FirebaseService.deleteItem(type, ids);
            load();
        }
    }
    
    const promptAdd = (type: string, callback: (name: string) => void) => {
        const name = prompt(`Nome do novo ${type}:`);
        if(name) callback(name);
    }

    const toggleDiscipline = (id: string) => {
        setExpandedDisciplines(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const toggleChapter = (id: string) => {
        setExpandedChapters(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const colorPalette = [
        { header: 'bg-blue-600', body: 'bg-blue-50', chapter: 'bg-blue-300', unit: 'bg-blue-200', text: 'text-blue-900', border: 'border-blue-200' },
        { header: 'bg-emerald-600', body: 'bg-emerald-50', chapter: 'bg-emerald-300', unit: 'bg-emerald-200', text: 'text-emerald-900', border: 'border-emerald-200' },
        { header: 'bg-purple-600', body: 'bg-purple-50', chapter: 'bg-purple-300', unit: 'bg-purple-200', text: 'text-purple-900', border: 'border-purple-200' },
        { header: 'bg-amber-600', body: 'bg-amber-50', chapter: 'bg-amber-300', unit: 'bg-amber-200', text: 'text-amber-900', border: 'border-amber-200' },
        { header: 'bg-rose-600', body: 'bg-rose-50', chapter: 'bg-rose-300', unit: 'bg-rose-200', text: 'text-rose-900', border: 'border-rose-200' },
        { header: 'bg-cyan-600', body: 'bg-cyan-50', chapter: 'bg-cyan-300', unit: 'bg-cyan-200', text: 'text-cyan-900', border: 'border-cyan-200' },
        { header: 'bg-indigo-600', body: 'bg-indigo-50', chapter: 'bg-indigo-300', unit: 'bg-indigo-200', text: 'text-indigo-900', border: 'border-indigo-200' },
    ];

    if(loading) return <div className="p-8 flex items-center justify-center text-slate-500">Carregando estrutura...</div>;

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 bg-slate-50">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-3xl font-display font-bold text-slate-800">Conteúdos</h2>
                    <p className="text-slate-500 text-sm mt-1">Gerencie a estrutura hierárquica das disciplinas, Capítulos, Unidades e tópicos.</p>
                </div>
                <Button onClick={() => promptAdd('Disciplina', addD)}><Icons.Plus /> Nova Disciplina</Button>
            </div>

            <div className="grid gap-6">
                {hierarchy.length === 0 && (
                    <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-slate-200 text-slate-400">
                        <div className="mb-2"><Icons.BookOpen /></div>
                        <p>Nenhuma disciplina cadastrada.</p>
                    </div>
                )}

                {hierarchy.map((d, index) => {
                    const isExpanded = expandedDisciplines[d.id] === true;
                    const colors = colorPalette[index % colorPalette.length];

                    return (
                        <div key={d.id} className={`bg-white border ${colors.border} rounded-xl shadow-sm overflow-hidden transition-all duration-200`}>
                            <div className={`${colors.header} text-white p-4 flex justify-between items-center select-none cursor-pointer hover:opacity-90 transition-opacity`} onClick={() => toggleDiscipline(d.id)}>
                                <div className="flex items-center gap-3">
                                    <div className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}><Icons.ChevronDown /></div>
                                    <h3 className="text-lg font-bold tracking-wide">{d.name}</h3>
                                </div>
                                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                    <Button variant="ghost" className="text-white/80 hover:text-white hover:bg-white/20 text-xs py-1 px-2 h-auto" onClick={() => promptAdd('Capítulo', (n) => addC(d.id, n))}>
                                        + Capítulo
                                    </Button>
                                    <button onClick={() => handleDelete('discipline', { dId: d.id })} className="text-white/70 hover:text-white p-1.5 rounded hover:bg-white/20 transition-colors">
                                        <Icons.Trash />
                                    </button>
                                </div>
                            </div>

                            {isExpanded && (
                                <div className={`p-4 ${colors.body} space-y-4 animate-fade-in`}>
                                    {d.chapters.length === 0 ? (
                                        <p className="text-slate-500 text-sm italic text-center py-4">Nenhum capítulo cadastrado nesta disciplina.</p>
                                    ) : (
                                        d.chapters.map(c => {
                                            const isChapExpanded = expandedChapters[c.id] === true;
                                            return (
                                                <div key={c.id} className={`${colors.chapter} border border-white/20 rounded-lg shadow-sm`}>
                                                    <div className="p-3 flex justify-between items-center border-b border-black/5 cursor-pointer hover:bg-black/5 transition-colors" onClick={() => toggleChapter(c.id)}>
                                                        <div className="flex items-center gap-2">
                                                            <div className={`transform transition-transform duration-200 text-slate-700 ${isChapExpanded ? 'rotate-180' : ''}`}><Icons.ChevronDown /></div>
                                                            <span className="font-semibold text-slate-800">{c.name}</span>
                                                        </div>
                                                        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                                            <Button variant="ghost" className="text-xs h-7 px-2 bg-white/50 hover:bg-white" onClick={() => promptAdd('Unidade', (n) => addU(d.id, c.id, n))}>+ Unidade</Button>
                                                            <button onClick={() => handleDelete('chapter', { dId: d.id, cId: c.id })} className="text-slate-600 hover:text-red-600 p-1"><Icons.Trash /></button>
                                                        </div>
                                                    </div>

                                                    {isChapExpanded && (
                                                        <div className="p-4 space-y-3">
                                                            {c.units.length === 0 ? <p className="text-xs text-slate-600 italic ml-6">Nenhuma unidade.</p> : (
                                                                c.units.map(u => (
                                                                    <div key={u.id} className={`p-3 rounded-lg border ${colors.border} ${colors.unit}`}>
                                                                        <div className="flex justify-between items-center mb-2">
                                                                            <span className={`text-sm font-bold ${colors.text}`}>{u.name}</span>
                                                                            <div className="flex gap-1">
                                                                                <button onClick={() => promptAdd('Tópico', (n) => addT(d.id, c.id, u.id, n))} className="text-slate-600 hover:text-brand-blue text-xs font-medium hover:underline px-2 py-1">+ Tópico</button>
                                                                                <button onClick={() => handleDelete('unit', { dId: d.id, cId: c.id, uId: u.id })} className="text-slate-400 hover:text-red-500 p-1"><Icons.Trash /></button>
                                                                            </div>
                                                                        </div>
                                                                        
                                                                        <div className="flex flex-wrap gap-2">
                                                                            {u.topics.length === 0 && <span className="text-xs text-slate-400 italic">Sem tópicos</span>}
                                                                            {u.topics.map(t => (
                                                                                <div key={t.id} className="group flex items-center gap-2 bg-white border border-slate-200 px-3 py-1 rounded-full text-xs font-medium hover:border-slate-300 transition-colors shadow-sm text-slate-700">
                                                                                    {t.name}
                                                                                    <button onClick={() => handleDelete('topic', { dId: d.id, cId: c.id, uId: u.id, tId: t.id })} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                        <span className="sr-only">Excluir</span>
                                                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                                                    </button>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// --- DASHBOARD COMPONENT ---
const Dashboard = () => {
    const [stats, setStats] = useState({ exams: 0, questions: 0, classes: 0 });
    
    useEffect(() => {
        const loadStats = async () => {
             const [e, q, c] = await Promise.all([
                 FirebaseService.getExams(),
                 FirebaseService.getQuestions(),
                 FirebaseService.getClasses()
             ]);
             setStats({ exams: e.length, questions: q.length, classes: c.length });
        };
        loadStats();
    }, []);

    return (
        <div className="p-8 overflow-y-auto custom-scrollbar h-full bg-slate-50">
            <h2 className="text-3xl font-display font-bold text-slate-800 mb-2">Bem-vindo(a)</h2>
            <p className="text-slate-500 mb-8">Aqui está um resumo da sua atividade.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                 <Card className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-full bg-blue-100 text-brand-blue flex items-center justify-center"><Icons.Exams /></div>
                     <div>
                         <p className="text-2xl font-bold text-slate-800">{stats.exams}</p>
                         <p className="text-sm text-slate-500">Provas Criadas</p>
                     </div>
                 </Card>
                 <Card className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center"><Icons.Questions /></div>
                     <div>
                         <p className="text-2xl font-bold text-slate-800">{stats.questions}</p>
                         <p className="text-sm text-slate-500">Questões no Banco</p>
                     </div>
                 </Card>
                 <Card className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center"><Icons.UsersGroup /></div>
                     <div>
                         <p className="text-2xl font-bold text-slate-800">{stats.classes}</p>
                         <p className="text-sm text-slate-500">Turmas Ativas</p>
                     </div>
                 </Card>
            </div>
            
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card title="Exemplo de Métricas" className="h-80 flex flex-col justify-center">
                    <SimpleBarChart data={[
                        { label: 'Jan', value: 12 },
                        { label: 'Fev', value: 19 },
                        { label: 'Mar', value: 3 },
                        { label: 'Abr', value: 5 },
                        { label: 'Mai', value: 2 },
                        { label: 'Jun', value: 3 },
                    ]} />
                </Card>
                <Card title="Distribuição" className="h-80 flex items-center justify-center">
                     <SimpleDonutChart data={[
                         { label: 'Aprovados', value: 45, color: '#4ade80' },
                         { label: 'Recuperação', value: 30, color: '#facc15' },
                         { label: 'Reprovados', value: 25, color: '#f87171' }
                     ]} />
                </Card>
             </div>
        </div>
    );
};

// --- QUESTIONS PAGE ---
const QuestionsPage = () => {
    const [allQuestions, setAllQuestions] = useState<Question[]>([]);
    const [hierarchy, setHierarchy] = useState<Discipline[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Partial<Question>>({});
    const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
    const [selDisc, setSelDisc] = useState('');
    const [selChap, setSelChap] = useState('');
    const [selUnit, setSelUnit] = useState('');
    const [selTopic, setSelTopic] = useState('');
    const [searchText, setSearchText] = useState('');
    const [generating, setGenerating] = useState(false);
    const [pdfProcessing, setPdfProcessing] = useState(false);

    useEffect(() => { load(); }, []);
    
    const load = async () => {
        const [qs, hs] = await Promise.all([FirebaseService.getQuestions(), FirebaseService.getHierarchy()]);
        setAllQuestions(qs);
        setHierarchy(hs);
    };

    const filteredQuestions = allQuestions.filter(q => {
        if (selDisc && q.disciplineId !== selDisc) return false;
        if (selChap && q.chapterId !== selChap) return false;
        if (selUnit && q.unitId !== selUnit) return false;
        if (selTopic && q.topicId !== selTopic) return false;
        if (searchText) return q.enunciado.toLowerCase().includes(searchText.toLowerCase());
        return true;
    });

    const selectedQuestion = allQuestions.find(q => q.id === selectedQuestionId);

    const handleSave = async () => {
        if(!editing.enunciado || !editing.disciplineId) { alert('Preencha os campos obrigatórios'); return; }
        const q: Question = {
            id: editing.id || '',
            enunciado: editing.enunciado,
            type: editing.type || QuestionType.MULTIPLE_CHOICE,
            difficulty: editing.difficulty || 'Medium',
            disciplineId: editing.disciplineId,
            chapterId: editing.chapterId || '',
            unitId: editing.unitId || '',
            topicId: editing.topicId || '',
            options: editing.options || [],
            createdAt: editing.createdAt || new Date().toISOString()
        };

        if (editing.id) await FirebaseService.updateQuestion(q);
        else await FirebaseService.addQuestion(q);
        
        setIsModalOpen(false);
        await load();
    };

    const handleDelete = async (id: string) => {
        if(confirm('Excluir questão?')) { 
            await FirebaseService.deleteQuestion(id); 
            await load();
            if (selectedQuestionId === id) setSelectedQuestionId(null);
        }
    };

    const handleGenerateAI = async () => {
        const topicName = prompt("Sobre qual tópico deseja gerar a questão?");
        if(!topicName) return;
        setGenerating(true);
        const newQ = await GeminiService.generateQuestion(topicName, QuestionType.MULTIPLE_CHOICE, 'Medium');
        if(newQ) {
            setEditing({ ...newQ, disciplineId: selDisc || '', chapterId: selChap || '', unitId: selUnit || '', topicId: selTopic || '' });
            setIsModalOpen(true);
        } else {
            alert('Falha ao gerar questão.');
        }
        setGenerating(false);
    };

    const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if(!file) return;
        setPdfProcessing(true);
        try {
            const text = await PdfService.extractText(file);
            const extractedQuestions = await GeminiService.parseQuestionsFromText(text);
            if(extractedQuestions.length > 0) {
                 alert(`${extractedQuestions.length} questões identificadas! Salvando a primeira como rascunho.`);
                 setEditing({ ...extractedQuestions[0], disciplineId: selDisc || '', chapterId: selChap || '', unitId: selUnit || '', topicId: selTopic || '' });
                 setIsModalOpen(true);
            } else alert('Nenhuma questão identificada.');
        } catch(err) { console.error(err); alert('Erro ao processar PDF.'); }
        setPdfProcessing(false);
    };

    const stripHtml = (html: string) => {
        const tmp = document.createElement("DIV");
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || "";
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col gap-4 shadow-sm z-10">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold font-display text-slate-800 flex items-center gap-2"><Icons.Questions /> Banco de Questões</h2>
                    <div className="flex gap-2">
                        <div className="relative overflow-hidden group">
                            <Button variant="secondary" disabled={pdfProcessing} className="text-sm">{pdfProcessing ? 'Lendo...' : 'Importar PDF'}</Button>
                            <input type="file" accept=".pdf" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handlePdfUpload} />
                        </div>
                        <Button variant="outline" onClick={handleGenerateAI} disabled={generating} className="text-sm"><Icons.Sparkles /> IA Gerar</Button>
                        <Button onClick={() => { setEditing({ type: QuestionType.MULTIPLE_CHOICE, options: Array(4).fill({text:'', isCorrect:false}), disciplineId: selDisc, chapterId: selChap, unitId: selUnit, topicId: selTopic }); setIsModalOpen(true); }} className="text-sm"><Icons.Plus /> Nova Manual</Button>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-2 text-slate-500 mr-2"><Icons.Filter /> <span className="text-xs font-bold uppercase tracking-wide">Filtros</span></div>
                    <div className="w-40"><select className="w-full text-sm border-slate-300 rounded p-1.5 bg-white outline-none" value={selDisc} onChange={e => { setSelDisc(e.target.value); setSelChap(''); setSelUnit(''); setSelTopic(''); }}><option value="">Todas Disciplinas</option>{hierarchy.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                    <div className="w-40"><select className="w-full text-sm border-slate-300 rounded p-1.5 bg-white outline-none" value={selChap} onChange={e => { setSelChap(e.target.value); setSelUnit(''); setSelTopic(''); }} disabled={!selDisc}><option value="">Todos Capítulos</option>{hierarchy.find(d => d.id === selDisc)?.chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                    <div className="w-40"><select className="w-full text-sm border-slate-300 rounded p-1.5 bg-white outline-none" value={selUnit} onChange={e => { setSelUnit(e.target.value); setSelTopic(''); }} disabled={!selChap}><option value="">Todas Unidades</option>{hierarchy.find(d => d.id === selDisc)?.chapters.find(c => c.id === selChap)?.units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
                    <div className="w-40"><select className="w-full text-sm border-slate-300 rounded p-1.5 bg-white outline-none" value={selTopic} onChange={e => setSelTopic(e.target.value)} disabled={!selUnit}><option value="">Todos Tópicos</option>{hierarchy.find(d => d.id === selDisc)?.chapters.find(c => c.id === selChap)?.units.find(u => u.id === selUnit)?.topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                    <div className="flex-1 min-w-[200px] relative"><input type="text" className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-300 rounded outline-none" placeholder="Buscar..." value={searchText} onChange={e => setSearchText(e.target.value)} /><div className="absolute left-2.5 top-2 text-slate-400"><Icons.Search /></div></div>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                <div className="w-1/3 min-w-[300px] max-w-[450px] border-r border-slate-200 bg-white overflow-y-auto custom-scrollbar flex flex-col">
                    {filteredQuestions.length === 0 ? <div className="p-8 text-center text-slate-400">Nenhuma questão encontrada.</div> : (
                        <div className="divide-y divide-slate-100">
                            {filteredQuestions.map(q => (
                                <div key={q.id} onClick={() => setSelectedQuestionId(q.id)} className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors relative group ${selectedQuestionId === q.id ? 'bg-blue-50 border-l-4 border-brand-blue' : 'border-l-4 border-transparent'}`}>
                                    <div className="flex gap-2 mb-2"><span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase bg-slate-100 text-slate-600">{QuestionTypeLabels[q.type].split(' ')[0]}</span></div>
                                    <p className="text-sm text-slate-800 line-clamp-2 font-medium mb-1">{stripHtml(q.enunciado) || "(Sem texto)"}</p>
                                    <div className="text-xs text-slate-400 truncate">{hierarchy.find(d => d.id === q.disciplineId)?.name || 'Sem disciplina'}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex-1 bg-slate-50/50 overflow-y-auto custom-scrollbar p-6 md:p-10 flex flex-col">
                    {selectedQuestion ? (
                        <div className="max-w-3xl mx-auto w-full animate-fade-in bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-start">
                                <div><h3 className="text-lg font-bold text-brand-dark">Detalhes</h3><p className="text-xs text-slate-500">{FirebaseService.getFullHierarchyString(selectedQuestion, hierarchy)}</p></div>
                                <div className="flex gap-2"><Button variant="ghost" onClick={() => { setEditing(selectedQuestion); setIsModalOpen(true); }} className="h-8 text-xs"><Icons.Edit /> Editar</Button><Button variant="ghost" onClick={() => handleDelete(selectedQuestion.id)} className="h-8 text-xs text-red-500 hover:bg-red-50"><Icons.Trash /> Excluir</Button></div>
                            </div>
                            <div className="p-8">
                                <div className="prose prose-slate max-w-none mb-8" dangerouslySetInnerHTML={{__html: selectedQuestion.enunciado}} />
                                {selectedQuestion.type === QuestionType.MULTIPLE_CHOICE && <div className="space-y-2">{selectedQuestion.options?.map((opt, idx) => (<div key={idx} className={`p-3 rounded-lg border flex gap-3 items-center ${opt.isCorrect ? 'bg-green-50 border-green-200' : 'bg-white border-slate-100'}`}><div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border ${opt.isCorrect ? 'bg-green-500 border-green-500 text-white' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>{String.fromCharCode(65 + idx)}</div><span className="flex-1 text-sm">{opt.text}</span>{opt.isCorrect && <Icons.Check />}</div>))}</div>}
                            </div>
                        </div>
                    ) : <div className="flex-1 flex flex-col items-center justify-center text-slate-300"><div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4"><Icons.Eye /></div><p className="text-lg font-medium">Selecione uma questão</p></div>}
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Editar Questão" maxWidth="max-w-4xl" footer={<Button onClick={handleSave}>Salvar Questão</Button>}>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <Select label="Disciplina" value={editing.disciplineId || ''} onChange={e => setEditing({...editing, disciplineId: e.target.value})}><option value="">Selecione...</option>{hierarchy.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
                    <Select label="Capítulo" value={editing.chapterId || ''} onChange={e => setEditing({...editing, chapterId: e.target.value})} disabled={!editing.disciplineId}><option value="">Selecione...</option>{hierarchy.find(d => d.id === editing.disciplineId)?.chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
                    <Select label="Unidade" value={editing.unitId || ''} onChange={e => setEditing({...editing, unitId: e.target.value})} disabled={!editing.chapterId}><option value="">Selecione...</option>{hierarchy.find(d => d.id === editing.disciplineId)?.chapters.find(c => c.id === editing.chapterId)?.units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</Select>
                    <Select label="Tópico" value={editing.topicId || ''} onChange={e => setEditing({...editing, topicId: e.target.value})} disabled={!editing.unitId}><option value="">Selecione...</option>{hierarchy.find(d => d.id === editing.disciplineId)?.chapters.find(c => c.id === editing.chapterId)?.units.find(u => u.id === editing.unitId)?.topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
                    <Select label="Dificuldade" value={editing.difficulty || 'Medium'} onChange={e => setEditing({...editing, difficulty: e.target.value as any})}><option value="Easy">Fácil</option><option value="Medium">Médio</option><option value="Hard">Difícil</option></Select>
                    <Select label="Tipo" value={editing.type || QuestionType.MULTIPLE_CHOICE} onChange={e => setEditing({...editing, type: e.target.value as any})}>{Object.entries(QuestionTypeLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</Select>
                </div>
                <div className="space-y-4">
                    <RichTextEditor label="Enunciado" value={editing.enunciado || ''} onChange={html => setEditing({...editing, enunciado: html})} />
                    {editing.type === QuestionType.MULTIPLE_CHOICE && (<div className="space-y-2"><label className="text-sm font-semibold">Alternativas</label>{editing.options?.map((opt, idx) => (<div key={idx} className="flex gap-2 items-center"><input type="radio" name="correct" checked={opt.isCorrect} onChange={() => { const newOpts = editing.options?.map((o, i) => ({ ...o, isCorrect: i === idx })) || []; setEditing({ ...editing, options: newOpts }); }} /><Input value={opt.text} onChange={e => { const newOpts = [...(editing.options || [])]; newOpts[idx] = { ...newOpts[idx], text: e.target.value }; setEditing({ ...editing, options: newOpts }); }} placeholder={`Opção ${idx + 1}`} /><button onClick={() => { const newOpts = [...(editing.options || [])]; newOpts.splice(idx, 1); setEditing({ ...editing, options: newOpts }); }} className="text-red-400 hover:text-red-600 p-1"><Icons.Trash /></button></div>))}<Button variant="ghost" onClick={() => setEditing({ ...editing, options: [...(editing.options || []), { id: Date.now().toString(), text: '', isCorrect: false }] })}>+ Adicionar Opção</Button></div>)}
                </div>
            </Modal>
        </div>
    );
};

// --- CLASSES PAGE ---
const ClassesPage = () => {
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [institutions, setInstitutions] = useState<Institution[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Partial<SchoolClass>>({});
    const [expandedInstitutions, setExpandedInstitutions] = useState<Record<string, boolean>>({});
    const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>({});

    useEffect(() => { load(); }, []);
    const load = async () => {
        const [cls, insts] = await Promise.all([FirebaseService.getClasses(), FirebaseService.getInstitutions()]);
        setClasses(cls);
        setInstitutions(insts.sort((a,b) => a.name.localeCompare(b.name)));
    };

    const handleSave = async () => {
        if(!editing.name || !editing.institutionId) return alert('Campos obrigatórios');
        const clsData = { ...editing, year: Number(editing.year) || new Date().getFullYear() } as SchoolClass;
        if (editing.id) await FirebaseService.updateClass(clsData); else await FirebaseService.addClass(clsData);
        setIsModalOpen(false);
        load();
    };

    const handleDelete = async (id: string) => { if(confirm('Excluir turma?')) { await FirebaseService.deleteClass(id); load(); } };
    const toggleInstitution = (id: string) => setExpandedInstitutions(prev => ({ ...prev, [id]: !prev[id] }));
    const toggleYear = (id: string) => setExpandedYears(prev => ({ ...prev, [id]: !prev[id] }));

    return (
        <div className="p-8 h-full flex flex-col bg-slate-50 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-6"><div><h2 className="text-3xl font-display font-bold text-slate-800">Turmas</h2><p className="text-slate-500 mt-1">Gerencie suas turmas por Instituição e Ano Letivo.</p></div><Button onClick={() => { setEditing({ year: new Date().getFullYear() }); setIsModalOpen(true); }}><Icons.Plus /> Nova Turma</Button></div>
            <div className="space-y-4">
                {institutions.length === 0 && <div className="text-center py-10 text-slate-400">Nenhuma instituição cadastrada.</div>}
                {institutions.map(inst => {
                    const instClasses = classes.filter(c => c.institutionId === inst.id);
                    const years = Array.from(new Set(instClasses.map(c => c.year))).sort((a, b) => Number(b) - Number(a));
                    const isExpandedInst = expandedInstitutions[inst.id];
                    return (
                        <div key={inst.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 select-none" onClick={() => toggleInstitution(inst.id)}><div className="flex items-center gap-4"><div className={`transform transition-transform text-slate-400 ${isExpandedInst ? 'rotate-180' : ''}`}><Icons.ChevronDown /></div><div className="flex items-center gap-3">{inst.logoUrl ? <img src={inst.logoUrl} className="w-8 h-8 object-contain rounded border p-0.5" /> : <div className="w-8 h-8 bg-slate-100 rounded flex items-center justify-center text-slate-400"><Icons.Building /></div>}<span className="font-bold text-lg text-slate-800">{inst.name}</span></div></div><Badge color="blue">{instClasses.length} turmas</Badge></div>
                            {isExpandedInst && (<div className="bg-slate-50 p-4 border-t border-slate-200 space-y-3 animate-fade-in">{years.length === 0 && <div className="text-slate-400 italic text-sm ml-10">Nenhuma turma.</div>}{years.map(year => { const yearId = `${inst.id}-${year}`; const isExpandedYear = expandedYears[yearId]; const yearClasses = instClasses.filter(c => c.year === year); return (<div key={yearId} className="bg-white border border-slate-200 rounded-lg overflow-hidden"><div className="p-3 flex justify-between items-center cursor-pointer hover:bg-slate-50 select-none pl-6" onClick={() => toggleYear(yearId)}><div className="flex items-center gap-3"><div className={`transform transition-transform text-slate-400 ${isExpandedYear ? 'rotate-180' : ''}`}><Icons.ChevronDown /></div><span className="font-semibold text-slate-700">Ano Letivo {year}</span></div><span className="text-xs text-slate-400 mr-2">{yearClasses.length} turmas</span></div>{isExpandedYear && (<div className="border-t border-slate-100 animate-fade-in"><table className="w-full text-left"><tbody className="divide-y divide-slate-50">{yearClasses.map(c => (<tr key={c.id} className="hover:bg-blue-50/50 transition-colors group"><td className="p-3 pl-12 text-sm text-slate-700 font-medium">{c.name}</td><td className="p-3 text-right"><div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => { setEditing(c); setIsModalOpen(true); }} className="text-slate-400 hover:text-brand-blue p-1"><Icons.Edit /></button><button onClick={() => handleDelete(c.id)} className="text-slate-400 hover:text-red-500 p-1"><Icons.Trash /></button></div></td></tr>))}</tbody></table></div>)}</div>); })}</div>)}
                        </div>
                    );
                })}
            </div>
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing.id ? 'Editar Turma' : 'Nova Turma'} footer={<Button onClick={handleSave}>Salvar</Button>}>
                <div className="space-y-4"><Select label="Instituição" value={editing.institutionId || ''} onChange={e => setEditing({...editing, institutionId: e.target.value})}><option value="">Selecione...</option>{institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</Select><Input label="Ano Letivo" type="number" value={editing.year || ''} onChange={e => setEditing({...editing, year: Number(e.target.value)})} /><Input label="Nome da Turma" value={editing.name || ''} onChange={e => setEditing({...editing, name: e.target.value})} placeholder="Ex: 3º Ano A" /></div>
            </Modal>
        </div>
    );
};

// --- INSTITUTION PAGE ---
const InstitutionPage = () => {
    const [institutions, setInstitutions] = useState<Institution[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Partial<Institution>>({});

    useEffect(() => { load(); }, []);
    const load = async () => { setInstitutions(await FirebaseService.getInstitutions()); };

    const handleSave = async () => {
        if (!editing.name) return alert('Nome obrigatório');
        if (editing.id) await FirebaseService.updateInstitution(editing as Institution); else await FirebaseService.addInstitution(editing as Institution);
        setIsModalOpen(false); load();
    };

    const handleDelete = async (id: string) => { if(confirm('Excluir instituição?')) { await FirebaseService.deleteInstitution(id); load(); } };
    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => { setEditing({...editing, logoUrl: reader.result as string}); }; reader.readAsDataURL(file); } };

    return (
        <div className="p-8 h-full flex flex-col"><div className="flex justify-between items-center mb-6"><h2 className="text-3xl font-display font-bold text-slate-800">Instituições</h2><Button onClick={() => { setEditing({}); setIsModalOpen(true); }}><Icons.Plus /> Nova Instituição</Button></div><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto">{institutions.map(inst => (<Card key={inst.id} className="relative group"><div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2"><button onClick={() => { setEditing(inst); setIsModalOpen(true); }} className="p-1 bg-white rounded shadow hover:text-brand-blue"><Icons.Edit /></button><button onClick={() => handleDelete(inst.id)} className="p-1 bg-white rounded shadow hover:text-red-500"><Icons.Trash /></button></div><div className="flex flex-col items-center text-center">{inst.logoUrl ? <img src={inst.logoUrl} alt={inst.name} className="h-20 w-auto object-contain mb-4" /> : <div className="h-20 w-20 bg-slate-100 rounded-full flex items-center justify-center mb-4"><Icons.Building /></div>}<h3 className="font-bold text-lg">{inst.name}</h3><p className="text-sm text-slate-500">{inst.email}</p><p className="text-sm text-slate-500">{inst.phone}</p></div></Card>))}</div><Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing.id ? 'Editar Instituição' : 'Nova Instituição'} footer={<Button onClick={handleSave}>Salvar</Button>}><div className="space-y-4"><div className="flex items-center gap-4">{editing.logoUrl && <img src={editing.logoUrl} className="h-16 w-16 object-contain border" />}<Input type="file" accept="image/*" onChange={handleLogoUpload} className="border-0" /></div><Input label="Nome" value={editing.name || ''} onChange={e => setEditing({...editing, name: e.target.value})} /><Input label="Endereço" value={editing.address || ''} onChange={e => setEditing({...editing, address: e.target.value})} /><div className="grid grid-cols-2 gap-4"><Input label="Email" value={editing.email || ''} onChange={e => setEditing({...editing, email: e.target.value})} /><Input label="Telefone" value={editing.phone || ''} onChange={e => setEditing({...editing, phone: e.target.value})} /></div><Input label="Website" value={editing.website || ''} onChange={e => setEditing({...editing, website: e.target.value})} /></div></Modal></div>
    );
};

// --- PROFILE PAGE ---
const ProfilePage = () => {
    const { user, refreshUser } = useAuth();
    const [name, setName] = useState(user?.name || '');
    const [photoUrl, setPhotoUrl] = useState(user?.photoUrl || '');
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState('');

    const handleSave = async () => {
        if (!user) return; setLoading(true); try { await FirebaseService.updateUser(user.id, { name, photoUrl }); await refreshUser(); setMsg('Perfil atualizado com sucesso!'); } catch (error) { console.error(error); setMsg('Erro ao atualizar perfil.'); } setLoading(false);
    };
    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => { setPhotoUrl(reader.result as string); }; reader.readAsDataURL(file); } };

    return (
        <div className="p-8 max-w-2xl mx-auto"><h2 className="text-3xl font-display font-bold text-slate-800 mb-6">Meu Perfil</h2><Card className="space-y-6"><div className="flex items-center gap-6"><div className="relative group">{photoUrl ? <img src={photoUrl} alt="Profile" className="w-24 h-24 rounded-full object-cover border-2 border-slate-200" /> : <div className="w-24 h-24 bg-brand-orange text-white rounded-full flex items-center justify-center text-3xl font-bold">{name.charAt(0)}</div>}<label className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity text-white text-xs font-bold">Alterar<input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} /></label></div><div><h3 className="text-xl font-bold">{user?.name}</h3><p className="text-slate-500">{user?.email}</p><Badge>{user?.role === 'TEACHER' ? 'Professor' : user?.role}</Badge></div></div><div className="space-y-4"><Input label="Nome Completo" value={name} onChange={e => setName(e.target.value)} /><div className="grid grid-cols-2 gap-4"><Input label="Plano" value={user?.plan || 'Free'} disabled /><Input label="Vencimento" value={user?.subscriptionEnd ? new Date(user.subscriptionEnd).toLocaleDateString() : '-'} disabled /></div></div><div className="flex justify-between items-center pt-4 border-t border-slate-100"><span className={`text-sm ${msg.includes('sucesso') ? 'text-green-600' : 'text-red-600'}`}>{msg}</span><Button onClick={handleSave} disabled={loading}>{loading ? 'Salvando...' : 'Salvar Alterações'}</Button></div></Card></div>
    );
};

// --- EXAMS PAGE (WIZARD 4 STEPS) ---
const ExamsPage = () => {
    // Data Sources
    const [exams, setExams] = useState<Exam[]>([]);
    const [institutions, setInstitutions] = useState<Institution[]>([]);
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [hierarchy, setHierarchy] = useState<Discipline[]>([]);
    const [allQuestions, setAllQuestions] = useState<Question[]>([]);

    // Modal & Wizard State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Partial<Exam>>({});
    const [currentStep, setCurrentStep] = useState(1);
    
    // Step 2: Content Scope State
    const [selectedDisc, setSelectedDisc] = useState('');
    const [selectedChap, setSelectedChap] = useState('');
    const [selectedUnit, setSelectedUnit] = useState('');
    const [selectedTopic, setSelectedTopic] = useState('');
    const [questionsCount, setQuestionsCount] = useState(1);
    const [tempScopes, setTempScopes] = useState<ExamContentScope[]>([]);

    // Step 3: Generation State
    const [generationMode, setGenerationMode] = useState<'MANUAL' | 'AUTO'>('AUTO');
    const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);
    const [availableQuestions, setAvailableQuestions] = useState<Question[]>([]); // For manual selection

    // Visualizar Question State
    const [viewingQuestion, setViewingQuestion] = useState<Question | null>(null);

    // Accordion States for Main List
    const [expandedInstitutions, setExpandedInstitutions] = useState<Record<string, boolean>>({});
    const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>({});
    const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>({});

    useEffect(() => { load(); }, []);
    
    const load = async () => {
        const [e, i, c, h, q] = await Promise.all([
            FirebaseService.getExams(),
            FirebaseService.getInstitutions(),
            FirebaseService.getClasses(),
            FirebaseService.getHierarchy(),
            FirebaseService.getQuestions()
        ]);
        setExams(e);
        setInstitutions(i.sort((a,b) => a.name.localeCompare(b.name)));
        setClasses(c);
        setHierarchy(h);
        setAllQuestions(q);
    };

    // Helper: Reset Wizard
    const handleOpenModal = (exam?: Exam) => {
        if (exam) {
            setEditing(exam);
            setTempScopes(exam.contentScopes || []);
            setGeneratedQuestions(exam.questions || []);
            setGenerationMode('MANUAL'); // Editing usually implies manual adjustment
        } else {
            setEditing({ columns: 1, showAnswerKey: false });
            setTempScopes([]);
            setGeneratedQuestions([]);
            setGenerationMode('AUTO');
        }
        setCurrentStep(1);
        setIsModalOpen(true);
    };

    // Helper: Add Scope to List
    const handleAddScope = () => {
        if (!selectedDisc) return;
        
        const d = hierarchy.find(x => x.id === selectedDisc);
        const c = d?.chapters.find(x => x.id === selectedChap);
        const u = c?.units.find(x => x.id === selectedUnit);
        const t = u?.topics.find(x => x.id === selectedTopic);

        const newScope: ExamContentScope = {
            id: Date.now().toString(),
            disciplineId: selectedDisc,
            disciplineName: d?.name || '',
            chapterId: selectedChap,
            chapterName: c?.name,
            unitId: selectedUnit,
            unitName: u?.name,
            topicId: selectedTopic,
            topicName: t?.name,
            questionCount: questionsCount
        };

        setTempScopes([...tempScopes, newScope]);
        // Reset selectors
        setSelectedTopic('');
        setQuestionsCount(1);
    };

    const handleRemoveScope = (id: string) => {
        setTempScopes(tempScopes.filter(s => s.id !== id));
    };

    // Helper: Prepare Questions for Step 3
    const prepareGeneration = () => {
        // Filter questions that match ANY of the scopes
        const matchingQuestions = allQuestions.filter(q => {
            return tempScopes.some(scope => {
                // Hierarchical matching: strict on what was selected
                const matchDisc = q.disciplineId === scope.disciplineId;
                const matchChap = !scope.chapterId || q.chapterId === scope.chapterId;
                const matchUnit = !scope.unitId || q.unitId === scope.unitId;
                const matchTopic = !scope.topicId || q.topicId === scope.topicId;
                return matchDisc && matchChap && matchUnit && matchTopic;
            });
        });
        setAvailableQuestions(matchingQuestions);
    };

    // Helper: Auto Generate
    const handleAutoGenerate = () => {
        let finalQuestions: Question[] = [];
        
        tempScopes.forEach(scope => {
            // Find questions for this specific scope
            const scopeQs = allQuestions.filter(q => {
                const matchDisc = q.disciplineId === scope.disciplineId;
                const matchChap = !scope.chapterId || q.chapterId === scope.chapterId;
                const matchUnit = !scope.unitId || q.unitId === scope.unitId;
                const matchTopic = !scope.topicId || q.topicId === scope.topicId;
                return matchDisc && matchChap && matchUnit && matchTopic;
            });

            // Shuffle and slice
            const shuffled = [...scopeQs].sort(() => 0.5 - Math.random());
            const selected = shuffled.slice(0, scope.questionCount);
            finalQuestions = [...finalQuestions, ...selected];
        });

        // Dedup just in case
        finalQuestions = Array.from(new Set(finalQuestions.map(q => q.id)))
            .map(id => finalQuestions.find(q => q.id === id)!);

        setGeneratedQuestions(finalQuestions);
    };

    // Helper: Save
    const handleSave = async () => {
        if(!editing.title) return alert('Título obrigatório');
        
        const examData: Exam = {
            id: editing.id || '',
            title: editing.title,
            headerText: editing.headerText || '',
            institutionId: editing.institutionId || '',
            classId: editing.classId || '',
            columns: editing.columns || 1,
            instructions: editing.instructions || '',
            contentScopes: tempScopes,
            questions: generatedQuestions,
            showAnswerKey: editing.showAnswerKey || false,
            createdAt: editing.createdAt || new Date().toISOString()
        };

        await FirebaseService.saveExam(examData);
        setIsModalOpen(false);
        load();
    };

    const handleDelete = async (id: string) => {
        if(confirm('Excluir prova?')) {
            await FirebaseService.deleteExam(id);
            load();
        }
    };

    const toggleInstitution = (id: string) => setExpandedInstitutions(prev => ({ ...prev, [id]: !prev[id] }));
    const toggleYear = (id: string) => setExpandedYears(prev => ({ ...prev, [id]: !prev[id] }));
    const toggleClass = (id: string) => setExpandedClasses(prev => ({ ...prev, [id]: !prev[id] }));

    // --- WIZARD RENDERERS ---
    const renderStepContent = () => {
        switch(currentStep) {
            case 1: // CONFIGURAÇÃO
                return (
                    <div className="space-y-4 animate-fade-in">
                        <Input label="Título da Prova" value={editing.title || ''} onChange={e => setEditing({...editing, title: e.target.value})} placeholder="Ex: Avaliação de História - 1º Bimestre" autoFocus />
                        <div className="grid grid-cols-2 gap-4">
                             <Select label="Instituição" value={editing.institutionId || ''} onChange={e => setEditing({...editing, institutionId: e.target.value, classId: ''})}>
                                <option value="">Selecione...</option>
                                {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                             </Select>
                             <Select label="Turma" value={editing.classId || ''} onChange={e => setEditing({...editing, classId: e.target.value})} disabled={!editing.institutionId}>
                                <option value="">Selecione...</option>
                                {classes.filter(c => c.institutionId === editing.institutionId).map(c => <option key={c.id} value={c.id}>{c.name} ({c.year})</option>)}
                             </Select>
                        </div>
                        <Input label="Cabeçalho (Subtítulo)" value={editing.headerText || ''} onChange={e => setEditing({...editing, headerText: e.target.value})} placeholder="Ex: Prof. Silva - Valor: 10,0" />
                        
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Layout de Colunas</label>
                                <div className="flex gap-4">
                                    <label className={`flex-1 border rounded-lg p-3 cursor-pointer transition-all ${editing.columns === 1 ? 'border-brand-blue bg-blue-50 ring-1 ring-brand-blue' : 'border-slate-200 hover:border-slate-300'}`}>
                                        <input type="radio" className="hidden" checked={editing.columns === 1} onChange={() => setEditing({...editing, columns: 1})} />
                                        <div className="text-center font-bold text-slate-700 mb-1">1 Coluna</div>
                                        <div className="w-full h-12 bg-slate-200 rounded"></div>
                                    </label>
                                    <label className={`flex-1 border rounded-lg p-3 cursor-pointer transition-all ${editing.columns === 2 ? 'border-brand-blue bg-blue-50 ring-1 ring-brand-blue' : 'border-slate-200 hover:border-slate-300'}`}>
                                        <input type="radio" className="hidden" checked={editing.columns === 2} onChange={() => setEditing({...editing, columns: 2})} />
                                        <div className="text-center font-bold text-slate-700 mb-1">2 Colunas</div>
                                        <div className="flex gap-1 h-12">
                                            <div className="w-1/2 bg-slate-200 rounded"></div>
                                            <div className="w-1/2 bg-slate-200 rounded"></div>
                                        </div>
                                    </label>
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Opções</label>
                                <div className="border border-slate-200 rounded-lg p-3 flex items-center justify-between">
                                    <span className="text-sm text-slate-600">Gabarito no final?</span>
                                    <input type="checkbox" className="w-5 h-5 text-brand-blue rounded" checked={editing.showAnswerKey || false} onChange={e => setEditing({...editing, showAnswerKey: e.target.checked})} />
                                </div>
                            </div>
                        </div>
                        <RichTextEditor label="Instruções" value={editing.instructions || ''} onChange={html => setEditing({...editing, instructions: html})} />
                    </div>
                );
            case 2: // CONTEÚDO
                // Filtrar questões baseadas na seleção ATUAL dos dropdowns para visualização
                const previewQuestions = allQuestions.filter(q => {
                    if (selectedDisc && q.disciplineId !== selectedDisc) return false;
                    if (selectedChap && q.chapterId !== selectedChap) return false;
                    if (selectedUnit && q.unitId !== selectedUnit) return false;
                    if (selectedTopic && q.topicId !== selectedTopic) return false;
                    // Se nada selecionado, não mostrar nada ou mostrar tudo? Vamos mostrar nada para não poluir
                    if (!selectedDisc) return false;
                    return true;
                });

                return (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <h4 className="text-sm font-bold text-slate-700 mb-3 uppercase">Adicionar Escopo</h4>
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <Select label="Disciplina" value={selectedDisc} onChange={e => { setSelectedDisc(e.target.value); setSelectedChap(''); setSelectedUnit(''); setSelectedTopic(''); }}>
                                    <option value="">Selecione...</option>
                                    {hierarchy.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </Select>
                                <Select label="Capítulo" value={selectedChap} onChange={e => { setSelectedChap(e.target.value); setSelectedUnit(''); setSelectedTopic(''); }} disabled={!selectedDisc}>
                                    <option value="">Todos</option>
                                    {hierarchy.find(d => d.id === selectedDisc)?.chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </Select>
                                <Select label="Unidade" value={selectedUnit} onChange={e => { setSelectedUnit(e.target.value); setSelectedTopic(''); }} disabled={!selectedChap}>
                                    <option value="">Todas</option>
                                    {hierarchy.find(d => d.id === selectedDisc)?.chapters.find(c => c.id === selectedChap)?.units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </Select>
                                <Select label="Tópico" value={selectedTopic} onChange={e => setSelectedTopic(e.target.value)} disabled={!selectedUnit}>
                                    <option value="">Todos</option>
                                    {hierarchy.find(d => d.id === selectedDisc)?.chapters.find(c => c.id === selectedChap)?.units.find(u => u.id === selectedUnit)?.topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </Select>
                            </div>
                            <div className="flex items-end gap-3">
                                <Input label="Qtd. Questões" type="number" min="1" value={questionsCount} onChange={e => setQuestionsCount(parseInt(e.target.value))} className="w-32" />
                                <Button onClick={handleAddScope} disabled={!selectedDisc}>+ Adicionar Conteúdo</Button>
                            </div>
                        </div>

                        {/* Pré-visualização de Questões Filtradas */}
                        {selectedDisc && (
                            <div>
                                <h4 className="text-sm font-bold text-slate-700 mb-2">Questões Disponíveis ({previewQuestions.length})</h4>
                                <div className="max-h-48 overflow-y-auto custom-scrollbar border border-slate-200 rounded-lg bg-white p-2 space-y-2">
                                    {previewQuestions.map(q => (
                                        <div key={q.id} className="p-2 border border-slate-100 rounded flex justify-between items-center text-sm">
                                            <div className="truncate flex-1 pr-2">
                                                <div dangerouslySetInnerHTML={{__html: q.enunciado}} className="line-clamp-1 text-slate-600" />
                                            </div>
                                            <button onClick={() => setViewingQuestion(q)} className="text-brand-blue hover:underline text-xs flex items-center gap-1">
                                                <Icons.Eye /> Visualizar
                                            </button>
                                        </div>
                                    ))}
                                    {previewQuestions.length === 0 && <p className="text-xs text-slate-400 text-center py-2">Nenhuma questão encontrada com estes filtros.</p>}
                                </div>
                            </div>
                        )}

                        <div>
                            <h4 className="text-sm font-bold text-slate-700 mb-2">Conteúdos Selecionados</h4>
                            {tempScopes.length === 0 ? (
                                <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">
                                    Nenhum conteúdo adicionado.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {tempScopes.map(scope => (
                                        <div key={scope.id} className="flex justify-between items-center bg-white p-3 rounded border border-slate-200 shadow-sm">
                                            <div>
                                                <div className="font-bold text-sm text-slate-800">
                                                    {scope.disciplineName} 
                                                    {scope.chapterName && ` > ${scope.chapterName}`}
                                                    {scope.unitName && ` > ${scope.unitName}`}
                                                    {scope.topicName && ` > ${scope.topicName}`}
                                                </div>
                                                <div className="text-xs text-slate-500">{scope.questionCount} questões solicitadas</div>
                                            </div>
                                            <button onClick={() => handleRemoveScope(scope.id)} className="text-red-400 hover:text-red-600"><Icons.Trash /></button>
                                        </div>
                                    ))}
                                    <div className="text-right text-sm font-bold text-brand-blue">
                                        Total estimado: {tempScopes.reduce((acc, curr) => acc + curr.questionCount, 0)} questões
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            case 3: // GERAÇÃO
                // Sort available questions so selected ones appear first in manual mode
                const sortedAvailable = [...availableQuestions].sort((a, b) => {
                    const aSel = generatedQuestions.some(g => g.id === a.id);
                    const bSel = generatedQuestions.some(g => g.id === b.id);
                    if (aSel && !bSel) return -1;
                    if (!aSel && bSel) return 1;
                    return 0;
                });

                return (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex justify-center gap-4 mb-6">
                            <button 
                                onClick={() => setGenerationMode('AUTO')}
                                className={`px-6 py-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all w-40 ${generationMode === 'AUTO' ? 'border-brand-blue bg-blue-50 text-brand-blue' : 'border-slate-200 hover:border-slate-300 text-slate-500'}`}
                            >
                                <Icons.Magic />
                                <span className="font-bold text-sm">Automático</span>
                            </button>
                            <button 
                                onClick={() => setGenerationMode('MANUAL')}
                                className={`px-6 py-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all w-40 ${generationMode === 'MANUAL' ? 'border-brand-blue bg-blue-50 text-brand-blue' : 'border-slate-200 hover:border-slate-300 text-slate-500'}`}
                            >
                                <Icons.Check />
                                <span className="font-bold text-sm">Manual</span>
                            </button>
                        </div>

                        {generationMode === 'AUTO' && (
                            <div className="text-center py-2">
                                <p className="text-slate-600 mb-4">O sistema selecionará aleatoriamente as questões baseadas nos escopos definidos.</p>
                                <Button onClick={handleAutoGenerate} className="mx-auto mb-6">
                                    <Icons.Refresh /> Gerar Prova Agora
                                </Button>
                                {generatedQuestions.length > 0 && (
                                    <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 text-left max-h-96 overflow-y-auto custom-scrollbar">
                                        <div className="p-3 bg-slate-50 font-bold text-sm text-slate-700 sticky top-0">Questões Geradas ({generatedQuestions.length})</div>
                                        {generatedQuestions.map(q => (
                                            <div key={q.id} className="p-3 flex justify-between items-start hover:bg-slate-50">
                                                <div className="flex-1 pr-4">
                                                    <div className="flex gap-2 mb-1">
                                                        <Badge color="blue">{QuestionTypeLabels[q.type].split(' ')[0]}</Badge>
                                                    </div>
                                                    <div dangerouslySetInnerHTML={{__html: q.enunciado}} className="text-sm text-slate-800 line-clamp-2" />
                                                </div>
                                                <div className="flex gap-2 shrink-0">
                                                    <button onClick={() => setViewingQuestion(q)} className="text-brand-blue hover:underline text-xs p-1" title="Visualizar"><Icons.Eye /></button>
                                                    <button onClick={() => setGeneratedQuestions(prev => prev.filter(x => x.id !== q.id))} className="text-red-500 hover:text-red-700 text-xs p-1" title="Remover"><Icons.Trash /></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {generationMode === 'MANUAL' && (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h4 className="font-bold text-slate-700">Selecione as Questões</h4>
                                    <span className="text-sm text-slate-500">{generatedQuestions.length} selecionadas</span>
                                </div>
                                <div className="h-96 overflow-y-auto custom-scrollbar border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white">
                                    {sortedAvailable.length === 0 ? (
                                        <div className="p-8 text-center text-slate-400">Nenhuma questão encontrada para os filtros.</div>
                                    ) : (
                                        sortedAvailable.map(q => {
                                            const isSelected = generatedQuestions.some(gq => gq.id === q.id);
                                            return (
                                                <div key={q.id} className={`p-3 flex gap-3 hover:bg-slate-50 cursor-pointer ${isSelected ? 'bg-blue-50' : ''}`} onClick={() => {
                                                    if(isSelected) setGeneratedQuestions(prev => prev.filter(x => x.id !== q.id));
                                                    else setGeneratedQuestions(prev => [...prev, q]);
                                                }}>
                                                    <div className="pt-1">
                                                        <input type="checkbox" checked={isSelected} readOnly />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex gap-2 mb-1">
                                                            <Badge color={isSelected ? 'blue' : 'yellow'}>{QuestionTypeLabels[q.type].split(' ')[0]}</Badge>
                                                        </div>
                                                        <div className="text-sm text-slate-800 line-clamp-2 font-medium" dangerouslySetInnerHTML={{__html: q.enunciado}} />
                                                        <div className="text-xs text-slate-400 mt-1">{FirebaseService.getFullHierarchyString(q, hierarchy)}</div>
                                                    </div>
                                                    <div onClick={e => e.stopPropagation()}>
                                                        <button onClick={() => setViewingQuestion(q)} className="p-2 text-slate-400 hover:text-brand-blue hover:bg-white rounded"><Icons.Eye /></button>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                );
            case 4: // VISUALIZAÇÃO
                return (
                    <div className="flex flex-col h-full animate-fade-in relative">
                        {/* A4 PAPER PREVIEW */}
                        <div className="bg-white shadow-lg mx-auto p-[10mm] w-full max-w-[210mm] min-h-[297mm] print:shadow-none print:w-full print:max-w-none print:p-0 text-black">
                            {/* Header (Repeated logic for print) */}
                            <div className="border-b-2 border-black pb-4 mb-6 flex gap-4 items-center">
                                {institutions.find(i => i.id === editing.institutionId)?.logoUrl && (
                                    <img src={institutions.find(i => i.id === editing.institutionId)?.logoUrl} className="h-16 w-16 object-contain" />
                                )}
                                <div className="flex-1">
                                    <h1 className="text-xl font-bold uppercase">{institutions.find(i => i.id === editing.institutionId)?.name || 'Nome da Instituição'}</h1>
                                    <h2 className="text-lg font-bold">{editing.title}</h2>
                                    <p className="text-sm">{editing.headerText}</p>
                                    <div className="flex justify-between text-sm mt-2 pt-2 border-t border-gray-300">
                                        <span>Aluno(a): _______________________________________________________</span>
                                        <span>Turma: {classes.find(c => c.id === editing.classId)?.name}</span>
                                        <span>Data: ____/____/____</span>
                                    </div>
                                </div>
                            </div>

                            {/* Instructions */}
                            {editing.instructions && (
                                <div className="mb-6 text-sm border border-black p-2 bg-gray-50 print:bg-transparent">
                                    <strong>Instruções:</strong>
                                    <div dangerouslySetInnerHTML={{__html: editing.instructions}} />
                                </div>
                            )}

                            {/* Questions Grid */}
                            <div className={`${editing.columns === 2 ? 'columns-2 gap-8' : ''}`}>
                                {generatedQuestions.map((q, idx) => (
                                    <div key={q.id} className="mb-6 break-inside-avoid">
                                        <div className="flex gap-2">
                                            <span className="font-bold">{idx + 1}.</span>
                                            <div className="flex-1">
                                                <div dangerouslySetInnerHTML={{__html: q.enunciado}} className="text-sm mb-2" />
                                                
                                                {q.type === QuestionType.MULTIPLE_CHOICE && (
                                                    <div className="space-y-1 ml-1">
                                                        {q.options?.map((opt, i) => (
                                                            <div key={i} className="flex gap-2 text-sm items-start">
                                                                <span className="font-bold text-xs border border-black rounded-full w-5 h-5 flex items-center justify-center shrink-0">{String.fromCharCode(65+i)}</span>
                                                                <span>{opt.text}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {q.type === QuestionType.TRUE_FALSE && (
                                                    <div className="space-y-1 ml-1 text-sm">
                                                        <div className="flex gap-2"><span>( ) Verdadeiro</span></div>
                                                        <div className="flex gap-2"><span>( ) Falso</span></div>
                                                    </div>
                                                )}
                                                {(q.type === QuestionType.SHORT_ANSWER || q.type === QuestionType.NUMERIC) && (
                                                    <div className="mt-8 border-b border-black w-full"></div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Answer Key (Optional - Page Break Logic) */}
                            {editing.showAnswerKey && (
                                <div className="break-before-page pt-10 print:pt-0">
                                    {/* Header Repeated for Answer Key Page */}
                                    <div className="border-b-2 border-black pb-4 mb-6 flex gap-4 items-center">
                                        <div className="flex-1">
                                            <h1 className="text-xl font-bold uppercase">{institutions.find(i => i.id === editing.institutionId)?.name} - GABARITO</h1>
                                            <h2 className="text-lg font-bold">{editing.title}</h2>
                                            <div className="flex justify-between text-sm mt-2 pt-2 border-t border-gray-300">
                                                <span>Turma: {classes.find(c => c.id === editing.classId)?.name}</span>
                                                <span>Professor: {useAuth().user?.name}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-5 gap-4 text-sm">
                                        {generatedQuestions.map((q, idx) => (
                                            <div key={q.id} className="border p-2 rounded">
                                                <span className="font-bold mr-2">{idx+1}.</span> 
                                                {q.type === QuestionType.MULTIPLE_CHOICE ? (
                                                    <span className="font-bold text-brand-blue">{String.fromCharCode(65 + (q.options?.findIndex(o => o.isCorrect) || 0))}</span>
                                                ) : q.type === QuestionType.TRUE_FALSE ? (
                                                    <span>{q.options?.find(o => o.isCorrect)?.text}</span>
                                                ) : (
                                                    <span className="italic text-gray-500">Dissertativa/Numérica</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            default: return null;
        }
    };

    const renderFooter = () => (
        <div className="flex justify-between w-full print:hidden">
            {currentStep > 1 ? (
                <Button variant="ghost" onClick={() => setCurrentStep(s => s - 1)}>Voltar</Button>
            ) : <div />}
            
            <div className="flex gap-2">
                {currentStep === 4 && (
                    <Button variant="outline" onClick={() => window.print()}><Icons.Printer /> Imprimir</Button>
                )}
                <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                {currentStep < 4 ? (
                    <Button onClick={() => {
                        if (currentStep === 2) prepareGeneration();
                        setCurrentStep(s => s + 1);
                    }}>Próximo</Button>
                ) : (
                    <Button onClick={handleSave} variant="primary">Salvar Prova</Button>
                )}
            </div>
        </div>
    );

    return (
        <div className="p-8 h-full flex flex-col bg-slate-50 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-3xl font-display font-bold text-slate-800">Provas</h2>
                    <p className="text-slate-500 mt-1">Gerencie suas provas organizadas por Instituição, Ano e Turma.</p>
                </div>
                <Button onClick={() => handleOpenModal()}><Icons.Plus /> Nova Prova</Button>
            </div>

            <div className="space-y-4">
                {institutions.length === 0 && <div className="text-center py-10 text-slate-400">Nenhuma instituição cadastrada.</div>}
                
                {institutions.map(inst => {
                    const instExams = exams.filter(e => e.institutionId === inst.id);
                    const instClasses = classes.filter(c => c.institutionId === inst.id);
                    const years = Array.from(new Set(instClasses.map(c => c.year))).sort((a, b) => Number(b) - Number(a));
                    const isExpandedInst = expandedInstitutions[inst.id];

                    return (
                        <div key={inst.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors select-none" onClick={() => toggleInstitution(inst.id)}>
                                <div className="flex items-center gap-4">
                                    <div className={`transform transition-transform text-slate-400 ${isExpandedInst ? 'rotate-180' : ''}`}><Icons.ChevronDown /></div>
                                    <div className="flex items-center gap-3">
                                        {inst.logoUrl ? <img src={inst.logoUrl} className="w-8 h-8 object-contain rounded bg-white border border-slate-100 p-0.5" /> : <div className="w-8 h-8 bg-slate-100 rounded flex items-center justify-center text-slate-400"><Icons.Building /></div>}
                                        <span className="font-bold text-lg text-slate-800">{inst.name}</span>
                                    </div>
                                </div>
                                <Badge color="blue">{instExams.length} provas</Badge>
                            </div>

                            {isExpandedInst && (
                                <div className="bg-slate-50 p-4 border-t border-slate-200 space-y-3 animate-fade-in">
                                    {years.map(year => {
                                        const yearId = `${inst.id}-${year}`;
                                        const isExpandedYear = expandedYears[yearId];
                                        const yearClasses = instClasses.filter(c => c.year === year);
                                        const yearExamsCount = exams.filter(e => yearClasses.some(c => c.id === e.classId)).length;

                                        return (
                                            <div key={yearId} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                                                <div className="p-3 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors select-none pl-6" onClick={() => toggleYear(yearId)}>
                                                    <div className="flex items-center gap-3">
                                                        <div className={`transform transition-transform text-slate-400 ${isExpandedYear ? 'rotate-180' : ''}`}><Icons.ChevronDown /></div>
                                                        <span className="font-semibold text-slate-700">Ano Letivo {year}</span>
                                                    </div>
                                                    <span className="text-xs text-slate-400 mr-2">{yearExamsCount} provas</span>
                                                </div>

                                                {isExpandedYear && (
                                                    <div className="bg-slate-100/50 p-3 space-y-2 border-t border-slate-100 animate-fade-in">
                                                        {yearClasses.map(cls => {
                                                            const clsExams = exams.filter(e => e.classId === cls.id);
                                                            const isExpandedClass = expandedClasses[cls.id];
                                                            return (
                                                                <div key={cls.id} className="bg-white border border-slate-200 rounded overflow-hidden">
                                                                     <div className="p-3 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors select-none pl-9" onClick={() => toggleClass(cls.id)}>
                                                                        <div className="flex items-center gap-3">
                                                                             <div className={`transform transition-transform text-slate-400 ${isExpandedClass ? 'rotate-180' : ''}`}><Icons.ChevronDown /></div>
                                                                            <span className="text-sm font-bold text-slate-800">{cls.name}</span>
                                                                        </div>
                                                                        <span className="text-xs text-slate-400">{clsExams.length} provas</span>
                                                                    </div>
                                                                    {isExpandedClass && (
                                                                        <div className="border-t border-slate-100 animate-fade-in divide-y divide-slate-50">
                                                                            {clsExams.map(exam => (
                                                                                <div key={exam.id} className="p-3 pl-12 flex justify-between items-center hover:bg-blue-50/30 transition-colors group">
                                                                                    <div className="flex items-center gap-3">
                                                                                        <div className="bg-blue-100 text-brand-blue p-2 rounded text-xs font-bold"><Icons.FileText /></div>
                                                                                        <div>
                                                                                            <h4 className="font-bold text-slate-700 text-sm">{exam.title}</h4>
                                                                                            <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                                                                                <span>{new Date(exam.createdAt).toLocaleDateString()}</span>
                                                                                                <span>•</span>
                                                                                                <span>{exam.questions?.length || 0} questões</span>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                        <button onClick={() => handleOpenModal(exam)} className="p-1.5 text-slate-400 hover:text-brand-blue hover:bg-white rounded border border-transparent hover:border-slate-200 transition-all"><Icons.Edit /></button>
                                                                                        <button onClick={() => handleDelete(exam.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-white rounded border border-transparent hover:border-red-100 transition-all"><Icons.Trash /></button>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Assistente de Prova" maxWidth="max-w-5xl" footer={renderFooter()}>
                <div className="flex items-center justify-between mb-8 px-4 relative print:hidden">
                    <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -z-10 transform -translate-y-1/2"></div>
                    {['Configuração', 'Conteúdo', 'Geração', 'Visualização'].map((label, idx) => {
                        const step = idx + 1;
                        return (
                            <div key={step} className={`flex flex-col items-center gap-2 ${currentStep >= step ? 'text-brand-blue' : 'text-slate-300'}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${currentStep >= step ? 'bg-brand-blue text-white shadow-lg shadow-blue-500/30' : 'bg-slate-100 text-slate-400'}`}>{step}</div>
                                <span className="text-[10px] font-bold uppercase tracking-wider bg-white px-2">{label}</span>
                            </div>
                        );
                    })}
                </div>
                {renderStepContent()}
            </Modal>

            {/* Modal de Visualização Rápida de Questão dentro do Wizard */}
            {viewingQuestion && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden">
                        <div className="bg-slate-50 p-4 border-b flex justify-between items-center">
                            <h3 className="font-bold text-slate-800">Visualizar Questão</h3>
                            <button onClick={() => setViewingQuestion(null)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-[70vh]">
                            <div className="prose prose-slate max-w-none" dangerouslySetInnerHTML={{__html: viewingQuestion.enunciado}} />
                            {viewingQuestion.type === QuestionType.MULTIPLE_CHOICE && (
                                <div className="mt-4 space-y-2">
                                    {viewingQuestion.options?.map((opt, i) => (
                                        <div key={i} className={`p-2 border rounded flex gap-2 ${opt.isCorrect ? 'bg-green-50 border-green-200' : 'bg-white'}`}>
                                            <span className="font-bold">{String.fromCharCode(65+i)}.</span>
                                            <span>{opt.text}</span>
                                            {opt.isCorrect && <Icons.Check />}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t bg-slate-50 text-right">
                            <Button onClick={() => setViewingQuestion(null)}>Fechar</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const App = () => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const refreshUser = async () => {
        const u = await FirebaseService.getCurrentUserData();
        setUser(u);
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
            if (authUser) {
                await refreshUser();
            } else {
                setUser(null);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    if (loading) return <div className="h-screen w-screen flex items-center justify-center bg-slate-100 text-slate-400">Carregando...</div>;

    return (
        <AuthContext.Provider value={{ user, loading, refreshUser }}>
            <HashRouter>
                <Routes>
                    <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
                    <Route path="/*" element={user ? <Layout /> : <Navigate to="/login" />} />
                </Routes>
            </HashRouter>
        </AuthContext.Provider>
    );
};

const Layout = () => {
    const { user } = useAuth();
    const location = useLocation();
    
    // Helper to keep code clean since we are manually grouping now
    const NavItem = ({ path, label, icon: Icon }: any) => {
        const isActive = location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
        return (
            <Link key={path} to={path} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${isActive ? 'bg-brand-blue text-white font-semibold shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                <div className={`${isActive ? 'text-white' : 'text-slate-500 group-hover:text-white'}`}><Icon /></div>
                <span>{label}</span>
            </Link>
        );
    };

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-slate-50">
            {/* Sidebar Dark Mode */}
            <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 transition-all duration-300 print:hidden z-20">
                <div className="p-6 border-b border-slate-800 flex items-center gap-3">
                    <div className="w-8 h-8 bg-brand-blue rounded-lg flex items-center justify-center text-white font-bold text-xl">P</div>
                    <span className="font-display font-bold text-xl text-white tracking-tight">Prova Fácil</span>
                </div>
                
                <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar-dark">
                    <NavItem path="/" label="Dashboard" icon={Icons.Dashboard} />

                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 mt-6 px-3">Gestão</div>
                    <NavItem path="/institutions" label="Instituições" icon={Icons.Building} />
                    <NavItem path="/classes" label="Turmas" icon={Icons.UsersGroup} />
                    <NavItem path="/hierarchy" label="Conteúdos" icon={Icons.BookOpen} />

                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 mt-6 px-3">Avaliação</div>
                    <NavItem path="/questions" label="Questões" icon={Icons.Questions} />
                    <NavItem path="/exams" label="Provas" icon={Icons.Exams} />
                </nav>

                <div className="p-4 border-t border-slate-800">
                    <Link to="/profile" className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800 transition-colors mb-2 group">
                        {user?.photoUrl ? <img src={user.photoUrl} className="w-8 h-8 rounded-full object-cover border border-slate-600" /> : <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold">{user?.name?.charAt(0)}</div>}
                        <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-bold text-slate-200 truncate group-hover:text-white">{user?.name}</p>
                            <p className="text-xs text-slate-500 truncate">{user?.role === 'TEACHER' ? 'Professor' : user?.role}</p>
                        </div>
                    </Link>
                    <button onClick={() => FirebaseService.logout()} className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-slate-800 rounded-lg transition-colors">
                        <Icons.Logout /> Sair
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-full overflow-hidden relative w-full">
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/hierarchy" element={<HierarchyPage />} />
                    <Route path="/questions" element={<QuestionsPage />} />
                    <Route path="/exams" element={<ExamsPage />} />
                    <Route path="/classes" element={<ClassesPage />} />
                    <Route path="/institutions" element={<InstitutionPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                </Routes>
            </main>
        </div>
    );
};

export default App;