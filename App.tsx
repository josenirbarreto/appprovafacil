
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
  Refresh: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
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

// --- HIERARCHY PAGE (IMPROVED DESIGN) ---
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

    // Paleta de cores para as disciplinas
    const colorPalette = [
        { header: 'bg-blue-600', body: 'bg-blue-50', border: 'border-blue-200' },
        { header: 'bg-emerald-600', body: 'bg-emerald-50', border: 'border-emerald-200' },
        { header: 'bg-purple-600', body: 'bg-purple-50', border: 'border-purple-200' },
        { header: 'bg-amber-600', body: 'bg-amber-50', border: 'border-amber-200' },
        { header: 'bg-rose-600', body: 'bg-rose-50', border: 'border-rose-200' },
        { header: 'bg-cyan-600', body: 'bg-cyan-50', border: 'border-cyan-200' },
        { header: 'bg-indigo-600', body: 'bg-indigo-50', border: 'border-indigo-200' },
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
                    const isExpanded = expandedDisciplines[d.id] === true; // Padrão fechado
                    const colors = colorPalette[index % colorPalette.length];

                    return (
                        <div key={d.id} className={`bg-white border ${colors.border} rounded-xl shadow-sm overflow-hidden transition-all duration-200`}>
                            {/* Discipline Header */}
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

                            {/* Chapters List */}
                            {isExpanded && (
                                <div className={`p-4 ${colors.body} space-y-4 animate-fade-in`}>
                                    {d.chapters.length === 0 ? (
                                        <p className="text-slate-500 text-sm italic text-center py-4">Nenhum capítulo cadastrado nesta disciplina.</p>
                                    ) : (
                                        d.chapters.map(c => {
                                            const isChapExpanded = expandedChapters[c.id] !== false;
                                            return (
                                                <div key={c.id} className="bg-white/80 border border-white/50 rounded-lg shadow-sm">
                                                    <div className="p-3 flex justify-between items-center border-b border-slate-100 cursor-pointer hover:bg-white/50 transition-colors" onClick={() => toggleChapter(c.id)}>
                                                        <div className="flex items-center gap-2">
                                                            <div className={`transform transition-transform duration-200 text-slate-400 ${isChapExpanded ? 'rotate-180' : ''}`}><Icons.ChevronDown /></div>
                                                            <span className="font-semibold text-slate-700">{c.name}</span>
                                                        </div>
                                                        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                                            <Button variant="ghost" className="text-xs h-7 px-2" onClick={() => promptAdd('Unidade', (n) => addU(d.id, c.id, n))}>+ Unidade</Button>
                                                            <button onClick={() => handleDelete('chapter', { dId: d.id, cId: c.id })} className="text-slate-400 hover:text-red-500 p-1"><Icons.Trash /></button>
                                                        </div>
                                                    </div>

                                                    {isChapExpanded && (
                                                        <div className="p-4 space-y-4">
                                                            {c.units.length === 0 ? <p className="text-xs text-slate-400 italic ml-6">Nenhuma unidade.</p> : c.units.map(u => (
                                                                <div key={u.id} className="ml-2 pl-4 border-l-2 border-slate-200">
                                                                    <div className="flex justify-between items-center mb-2">
                                                                        <span className="text-sm font-bold text-slate-600">{u.name}</span>
                                                                        <div className="flex gap-1">
                                                                            <button onClick={() => promptAdd('Tópico', (n) => addT(d.id, c.id, u.id, n))} className="text-brand-blue text-xs font-medium hover:underline px-2 py-1">+ Tópico</button>
                                                                            <button onClick={() => handleDelete('unit', { dId: d.id, cId: c.id, uId: u.id })} className="text-slate-300 hover:text-red-500 p-1"><Icons.Trash /></button>
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    {/* Topics as Tags */}
                                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                                        {u.topics.length === 0 && <span className="text-xs text-slate-300 italic">Sem tópicos</span>}
                                                                        {u.topics.map(t => (
                                                                            <div key={t.id} className="group flex items-center gap-2 bg-white border border-slate-200 px-3 py-1 rounded-full text-xs font-medium hover:border-brand-blue hover:text-brand-blue transition-colors shadow-sm">
                                                                                {t.name}
                                                                                <button onClick={() => handleDelete('topic', { dId: d.id, cId: c.id, uId: u.id, tId: t.id })} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                    <span className="sr-only">Excluir</span>
                                                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                                                </button>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ))}
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

// --- QUESTIONS PAGE ---
const QuestionsPage = () => {
    // Core State
    const [allQuestions, setAllQuestions] = useState<Question[]>([]);
    const [hierarchy, setHierarchy] = useState<Discipline[]>([]);
    
    // UI State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Partial<Question>>({});
    const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
    
    // Filters
    const [selDisc, setSelDisc] = useState('');
    const [selChap, setSelChap] = useState('');
    const [selUnit, setSelUnit] = useState('');
    const [selTopic, setSelTopic] = useState('');
    const [searchText, setSearchText] = useState('');

    // AI / PDF States
    const [generating, setGenerating] = useState(false);
    const [pdfProcessing, setPdfProcessing] = useState(false);

    useEffect(() => { load(); }, []);
    
    const load = async () => {
        const [qs, hs] = await Promise.all([FirebaseService.getQuestions(), FirebaseService.getHierarchy()]);
        setAllQuestions(qs);
        setHierarchy(hs);
    };

    // Filter Logic
    const filteredQuestions = allQuestions.filter(q => {
        if (selDisc && q.disciplineId !== selDisc) return false;
        if (selChap && q.chapterId !== selChap) return false;
        if (selUnit && q.unitId !== selUnit) return false;
        if (selTopic && q.topicId !== selTopic) return false;
        if (searchText) {
            const term = searchText.toLowerCase();
            return q.enunciado.toLowerCase().includes(term);
        }
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

        let saved: Question;
        if (editing.id) {
            await FirebaseService.updateQuestion(q);
            saved = q;
        } else {
            saved = await FirebaseService.addQuestion(q);
        }
        
        setIsModalOpen(false);
        await load();
        // Select the newly saved question
        setSelectedQuestionId(saved.id);
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
            // Pre-fill hierarchy based on current filters if available
            setEditing({ 
                ...newQ, 
                disciplineId: selDisc || '', 
                chapterId: selChap || '', 
                unitId: selUnit || '', 
                topicId: selTopic || '' 
            });
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
                 setEditing({
                     ...extractedQuestions[0],
                     disciplineId: selDisc || '', 
                     chapterId: selChap || '', 
                     unitId: selUnit || '', 
                     topicId: selTopic || '' 
                 });
                 setIsModalOpen(true);
            } else {
                alert('Nenhuma questão identificada no PDF.');
            }
        } catch(err) {
            console.error(err);
            alert('Erro ao processar PDF.');
        }
        setPdfProcessing(false);
    };

    // Helper to extract text from HTML for preview list
    const stripHtml = (html: string) => {
        const tmp = document.createElement("DIV");
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || "";
    }

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* --- TOP BAR: FILTERS --- */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col gap-4 shadow-sm z-10">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold font-display text-slate-800 flex items-center gap-2">
                        <Icons.Questions /> Banco de Questões
                    </h2>
                    <div className="flex gap-2">
                        <div className="relative overflow-hidden group">
                            <Button variant="secondary" disabled={pdfProcessing} className="text-sm">
                               {pdfProcessing ? 'Lendo...' : 'Importar PDF'}
                            </Button>
                            <input type="file" accept=".pdf" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handlePdfUpload} />
                        </div>
                        <Button variant="outline" onClick={handleGenerateAI} disabled={generating} className="text-sm">
                            <Icons.Sparkles /> IA Gerar
                        </Button>
                        <Button onClick={() => { 
                            setEditing({ 
                                type: QuestionType.MULTIPLE_CHOICE, 
                                options: Array(4).fill({text:'', isCorrect:false}),
                                disciplineId: selDisc,
                                chapterId: selChap,
                                unitId: selUnit,
                                topicId: selTopic
                            }); 
                            setIsModalOpen(true); 
                        }} className="text-sm">
                            <Icons.Plus /> Nova Manual
                        </Button>
                    </div>
                </div>

                {/* Filter Row */}
                <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-2 text-slate-500 mr-2">
                        <Icons.Filter /> <span className="text-xs font-bold uppercase tracking-wide">Filtros</span>
                    </div>
                    
                    <div className="w-40">
                        <select className="w-full text-sm border-slate-300 rounded p-1.5 bg-white text-slate-700 focus:border-brand-blue outline-none" value={selDisc} onChange={e => { setSelDisc(e.target.value); setSelChap(''); setSelUnit(''); setSelTopic(''); }}>
                            <option value="">Todas Disciplinas</option>
                            {hierarchy.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </div>

                    <div className="w-40">
                         <select className="w-full text-sm border-slate-300 rounded p-1.5 bg-white text-slate-700 focus:border-brand-blue outline-none" value={selChap} onChange={e => { setSelChap(e.target.value); setSelUnit(''); setSelTopic(''); }} disabled={!selDisc}>
                            <option value="">Todos Capítulos</option>
                            {hierarchy.find(d => d.id === selDisc)?.chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    <div className="w-40">
                        <select className="w-full text-sm border-slate-300 rounded p-1.5 bg-white text-slate-700 focus:border-brand-blue outline-none" value={selUnit} onChange={e => { setSelUnit(e.target.value); setSelTopic(''); }} disabled={!selChap}>
                            <option value="">Todas Unidades</option>
                            {hierarchy.find(d => d.id === selDisc)?.chapters.find(c => c.id === selChap)?.units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>

                     <div className="w-40">
                        <select className="w-full text-sm border-slate-300 rounded p-1.5 bg-white text-slate-700 focus:border-brand-blue outline-none" value={selTopic} onChange={e => setSelTopic(e.target.value)} disabled={!selUnit}>
                            <option value="">Todos Tópicos</option>
                            {hierarchy.find(d => d.id === selDisc)?.chapters.find(c => c.id === selChap)?.units.find(u => u.id === selUnit)?.topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>

                    <div className="flex-1 min-w-[200px] relative">
                        <input 
                            type="text" 
                            className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-brand-blue outline-none bg-white text-slate-700"
                            placeholder="Buscar no enunciado..."
                            value={searchText}
                            onChange={e => setSearchText(e.target.value)}
                        />
                        <div className="absolute left-2.5 top-2 text-slate-400"><Icons.Search /></div>
                    </div>
                    
                    <div className="text-xs text-slate-400 font-medium px-2">
                        {filteredQuestions.length} questões
                    </div>
                </div>
            </div>

            {/* --- MASTER-DETAIL LAYOUT --- */}
            <div className="flex flex-1 overflow-hidden">
                
                {/* --- LEFT PANEL: LIST (MASTER) --- */}
                <div className="w-1/3 min-w-[300px] max-w-[450px] border-r border-slate-200 bg-white overflow-y-auto custom-scrollbar flex flex-col">
                    {filteredQuestions.length === 0 ? (
                        <div className="p-8 text-center text-slate-400">
                            <p>Nenhuma questão encontrada.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {filteredQuestions.map(q => (
                                <div 
                                    key={q.id} 
                                    onClick={() => setSelectedQuestionId(q.id)}
                                    className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors relative group ${selectedQuestionId === q.id ? 'bg-blue-50 border-l-4 border-brand-blue' : 'border-l-4 border-transparent'}`}
                                >
                                    <div className="flex gap-2 mb-2">
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${q.difficulty === 'Easy' ? 'bg-green-100 text-green-700' : q.difficulty === 'Hard' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                            {q.difficulty === 'Easy' ? 'Fácil' : q.difficulty === 'Hard' ? 'Difícil' : 'Médio'}
                                        </span>
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">
                                            {QuestionTypeLabels[q.type].split(' ')[0]}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-800 line-clamp-2 font-medium mb-1">
                                        {stripHtml(q.enunciado) || "(Sem texto)"}
                                    </p>
                                    <div className="text-xs text-slate-400 truncate">
                                        {hierarchy.find(d => d.id === q.disciplineId)?.name || 'Sem disciplina'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* --- RIGHT PANEL: PREVIEW (DETAIL) --- */}
                <div className="flex-1 bg-slate-50/50 overflow-y-auto custom-scrollbar p-6 md:p-10 flex flex-col">
                    {selectedQuestion ? (
                        <div className="max-w-3xl mx-auto w-full animate-fade-in">
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                {/* Header */}
                                <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-lg font-bold text-brand-dark">Detalhes da Questão</h3>
                                        </div>
                                        <p className="text-xs text-slate-500 flex items-center gap-1">
                                            <Icons.BookOpen /> {FirebaseService.getFullHierarchyString(selectedQuestion, hierarchy)}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="ghost" onClick={() => { setEditing(selectedQuestion); setIsModalOpen(true); }} className="h-8 text-xs">
                                            <Icons.Edit /> Editar
                                        </Button>
                                        <Button variant="ghost" onClick={() => handleDelete(selectedQuestion.id)} className="h-8 text-xs text-red-500 hover:bg-red-50 hover:text-red-600">
                                            <Icons.Trash /> Excluir
                                        </Button>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="p-8">
                                    <div className="prose prose-slate max-w-none mb-8">
                                        <div dangerouslySetInnerHTML={{__html: selectedQuestion.enunciado}} />
                                    </div>

                                    {/* Options / Answer Key */}
                                    <div className="space-y-3">
                                        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Gabarito / Alternativas</h4>
                                        {selectedQuestion.type === QuestionType.MULTIPLE_CHOICE && (
                                            <div className="space-y-2">
                                                {selectedQuestion.options?.map((opt, idx) => (
                                                    <div key={idx} className={`p-3 rounded-lg border flex gap-3 items-center ${opt.isCorrect ? 'bg-green-50 border-green-200' : 'bg-white border-slate-100'}`}>
                                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border ${opt.isCorrect ? 'bg-green-500 border-green-500 text-white' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                                                            {String.fromCharCode(65 + idx)}
                                                        </div>
                                                        <span className={`flex-1 text-sm ${opt.isCorrect ? 'font-medium text-green-900' : 'text-slate-600'}`}>{opt.text}</span>
                                                        {opt.isCorrect && <Icons.Check />}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        
                                        {(selectedQuestion.type === QuestionType.TRUE_FALSE || selectedQuestion.type === QuestionType.SHORT_ANSWER || selectedQuestion.type === QuestionType.NUMERIC) && (
                                             <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700">
                                                 Consulte a edição para ver detalhes específicos deste tipo.
                                             </div>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Metadata Footer */}
                                <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 text-xs text-slate-400 flex justify-between">
                                    <span>ID: {selectedQuestion.id}</span>
                                    <span>Criado em: {new Date(selectedQuestion.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                <Icons.Eye />
                            </div>
                            <p className="text-lg font-medium">Selecione uma questão para visualizar</p>
                            <p className="text-sm">Use os filtros acima para refinar sua busca</p>
                        </div>
                    )}
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Editar Questão" maxWidth="max-w-4xl" footer={<Button onClick={handleSave}>Salvar Questão</Button>}>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <Select label="Disciplina" value={editing.disciplineId || ''} onChange={e => setEditing({...editing, disciplineId: e.target.value})}>
                        <option value="">Selecione...</option>
                        {hierarchy.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </Select>
                     <Select label="Capítulo" value={editing.chapterId || ''} onChange={e => setEditing({...editing, chapterId: e.target.value})} disabled={!editing.disciplineId}>
                        <option value="">Selecione...</option>
                        {hierarchy.find(d => d.id === editing.disciplineId)?.chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </Select>
                    <Select label="Unidade" value={editing.unitId || ''} onChange={e => setEditing({...editing, unitId: e.target.value})} disabled={!editing.chapterId}>
                        <option value="">Selecione...</option>
                        {hierarchy.find(d => d.id === editing.disciplineId)?.chapters.find(c => c.id === editing.chapterId)?.units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </Select>
                     <Select label="Tópico" value={editing.topicId || ''} onChange={e => setEditing({...editing, topicId: e.target.value})} disabled={!editing.unitId}>
                        <option value="">Selecione...</option>
                        {hierarchy.find(d => d.id === editing.disciplineId)?.chapters.find(c => c.id === editing.chapterId)?.units.find(u => u.id === editing.unitId)?.topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </Select>

                    <Select label="Dificuldade" value={editing.difficulty || 'Medium'} onChange={e => setEditing({...editing, difficulty: e.target.value as any})}>
                        <option value="Easy">Fácil</option><option value="Medium">Médio</option><option value="Hard">Difícil</option>
                    </Select>
                    <Select label="Tipo" value={editing.type || QuestionType.MULTIPLE_CHOICE} onChange={e => setEditing({...editing, type: e.target.value as any})}>
                        {Object.entries(QuestionTypeLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                    </Select>
                </div>
                
                <div className="space-y-4">
                    <RichTextEditor label="Enunciado" value={editing.enunciado || ''} onChange={html => setEditing({...editing, enunciado: html})} />
                    
                    {editing.type === QuestionType.MULTIPLE_CHOICE && (
                        <div className="space-y-2">
                            <label className="text-sm font-semibold">Alternativas</label>
                            {editing.options?.map((opt, idx) => (
                                <div key={idx} className="flex gap-2 items-center">
                                    <input type="radio" name="correct" checked={opt.isCorrect} onChange={() => {
                                        const newOpts = editing.options?.map((o, i) => ({ ...o, isCorrect: i === idx })) || [];
                                        setEditing({ ...editing, options: newOpts });
                                    }} />
                                    <Input value={opt.text} onChange={e => {
                                        const newOpts = [...(editing.options || [])];
                                        newOpts[idx] = { ...newOpts[idx], text: e.target.value };
                                        setEditing({ ...editing, options: newOpts });
                                    }} placeholder={`Opção ${idx + 1}`} />
                                    <button onClick={() => {
                                         const newOpts = [...(editing.options || [])];
                                         newOpts.splice(idx, 1);
                                         setEditing({ ...editing, options: newOpts });
                                    }} className="text-red-400 hover:text-red-600 p-1"><Icons.Trash /></button>
                                </div>
                            ))}
                            <Button variant="ghost" onClick={() => setEditing({ ...editing, options: [...(editing.options || []), { id: Date.now().toString(), text: '', isCorrect: false }] })}>+ Adicionar Opção</Button>
                        </div>
                    )}
                </div>
            </Modal>
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

// --- PROFILE PAGE ---
const ProfilePage = () => {
    const { user, refreshUser } = useAuth();
    const [name, setName] = useState('');
    const [photoUrl, setPhotoUrl] = useState('');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (user) {
            setName(user.name || '');
            setPhotoUrl(user.photoUrl || '');
        }
    }, [user]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) { // Limite de 2MB
            setMessage({ type: 'error', text: 'A imagem deve ter no máximo 2MB.' });
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target?.result as string;
            img.onload = () => {
                // Resize logic: Cria um canvas para redimensionar a imagem
                // Isso garante que a string Base64 não seja gigante
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 300; 
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    // Converte para JPEG com qualidade 0.7 para economizar espaço
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    setPhotoUrl(dataUrl);
                }
            };
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        setMessage(null);
        try {
            await FirebaseService.updateUser(user.id, { name, photoUrl });
            await refreshUser();
            setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
        } catch (error) {
            setMessage({ type: 'error', text: 'Erro ao atualizar perfil. Tente novamente.' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-6 md:p-8 max-w-2xl mx-auto space-y-6">
            <h2 className="text-3xl font-display font-bold text-slate-800">Meu Perfil</h2>
            
            {message && (
                <div className={`p-4 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {message.text}
                </div>
            )}

            <Card className="space-y-6">
                <div className="flex flex-col items-center gap-4 py-4">
                    <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        {photoUrl ? (
                            <img src={photoUrl} alt={name} className="w-32 h-32 rounded-full object-cover border-4 border-slate-100 shadow-sm transition-opacity group-hover:opacity-75" />
                        ) : (
                            <div className="w-32 h-32 rounded-full bg-brand-blue text-white flex items-center justify-center text-4xl font-bold shadow-sm transition-opacity group-hover:opacity-75">
                                {name.charAt(0)}
                            </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="bg-black/50 text-white p-2 rounded-full">
                                <Icons.Camera />
                            </div>
                        </div>
                    </div>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleFileChange} 
                    />
                    <div className="text-center">
                        <Button variant="ghost" onClick={() => fileInputRef.current?.click()}>Alterar Foto</Button>
                        <p className="text-slate-500 text-xs mt-1">Clique na foto para fazer upload (Máx 2MB)</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <Input label="Nome Completo" value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" />
                    <Input label="Email (Não editável)" value={user?.email || ''} disabled className="bg-slate-50 text-slate-500 cursor-not-allowed" />
                </div>

                <div className="pt-4 flex justify-end">
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? 'Salvando...' : 'Salvar Alterações'}
                    </Button>
                </div>
            </Card>
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

// --- EXAMS PAGE ---
const ExamsPage = () => {
    const [exams, setExams] = useState<Exam[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Partial<Exam>>({});
    const [step, setStep] = useState<number>(1);
    const [institutions, setInstitutions] = useState<Institution[]>([]);
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [hierarchy, setHierarchy] = useState<Discipline[]>([]);
    const [allQuestions, setAllQuestions] = useState<Question[]>([]);
    
    // Config state
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
    
    const handleOpenWizard = () => { 
        setStep(1); 
        setEditing({ 
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
        setIsModalOpen(true); 
    };

    const handleAddContentScope = () => { 
        if (!selDisc) return; 
        const d = hierarchy.find(x => x.id === selDisc); 
        const c = d?.chapters.find(x => x.id === selChap); 
        const u = c?.units.find(x => x.id === selUnit); 
        const t = u?.topics.find(x => x.id === selTopic); 
        setEditing(prev => ({ 
            ...prev, 
            contentScopes: [...(prev.contentScopes || []), { id: Date.now().toString(), disciplineId: selDisc, disciplineName: d?.name || '', chapterId: selChap, chapterName: c?.name, unitId: selUnit, unitName: u?.name, topicId: selTopic, topicName: t?.name, questionCount: selCount }] 
        })); 
    };

    const handleAutoGenerate = () => { 
        let newSelectedQuestions: Question[] = []; 
        editing.contentScopes?.forEach(scope => { 
            const pool = allQuestions.filter(q => { 
                if (q.disciplineId !== scope.disciplineId) return false; 
                if (scope.chapterId && q.chapterId !== scope.chapterId) return false; 
                if (scope.unitId && q.unitId !== scope.unitId) return false; 
                if (scope.topicId && q.topicId !== scope.topicId) return false; 
                return true; 
            }); 
            const shuffled = [...pool].sort(() => 0.5 - Math.random()); 
            newSelectedQuestions = [...newSelectedQuestions, ...shuffled.slice(0, scope.questionCount)]; 
        }); 
        setEditing(prev => ({ ...prev, questions: newSelectedQuestions })); 
    };

    const handleFinish = async () => { 
        if (!editing.title || !editing.questions?.length) return alert("Preencha título e selecione questões."); 
        await FirebaseService.saveExam({ ...editing, id: editing.id || '', createdAt: editing.createdAt || new Date().toISOString() } as Exam); 
        setIsModalOpen(false); 
        loadData(); 
    };

    useEffect(() => {
        if (step === 3 && editing.contentScopes) {
            setFilteredQuestions(allQuestions.filter(q => editing.contentScopes?.some(scope => { if (q.disciplineId !== scope.disciplineId) return false; if (scope.chapterId && q.chapterId !== scope.chapterId) return false; if (scope.unitId && q.unitId !== scope.unitId) return false; if (scope.topicId && q.topicId !== scope.topicId) return false; return true; })));
        }
    }, [step, editing.contentScopes, allQuestions]);

    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar space-y-6 print:block print:overflow-visible print:h-auto">
            <div className="flex justify-between items-center print:hidden"><h2 className="text-3xl font-display font-bold text-brand-dark">Minhas Provas</h2><Button onClick={handleOpenWizard}><Icons.Plus /> Nova Prova</Button></div>
            <div className="print:hidden">
                {exams.length === 0 ? <div className="text-center py-20 text-slate-400 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200"><div className="mb-3 flex justify-center"><Icons.Exams /></div><p>Nenhuma prova criada.</p></div> : (
                    <div className="space-y-6">
                        {institutions.map(inst => {
                                const instExams = exams.filter(e => e.institutionId === inst.id);
                                const isExpanded = expandedInsts[inst.id] !== false;
                                return (
                                    <div key={inst.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                                        <div onClick={() => toggleAccordion(inst.id)} className="p-6 cursor-pointer hover:bg-slate-50 transition-colors flex justify-between items-center select-none"><h3 className="font-bold text-lg flex items-center gap-3">{inst.logoUrl ? <img src={inst.logoUrl} className="w-10 h-10 object-contain rounded border border-slate-200 bg-white" /> : <div className="p-2 bg-slate-100 rounded text-slate-500"><Icons.Building /></div>}<span>{inst.name}</span></h3><Icons.ChevronDown /></div>
                                        {isExpanded && <div className="px-6 pb-6 border-t border-slate-100 animate-fade-in pt-4"><div className="grid grid-cols-1 md:grid-cols-3 gap-6">{instExams.map(exam => (<Card key={exam.id} title={exam.title} className="hover:shadow-md"><p className="text-sm text-slate-500 mb-4">{exam.questions?.length || 0} questões</p><div className="flex justify-end gap-2"><Button variant="ghost" className="text-sm" onClick={() => { setEditing(exam); setStep(1); setIsModalOpen(true); }}>Editar</Button><Button variant="ghost" className="text-sm text-red-500" onClick={async () => { if(confirm('Excluir?')) { await FirebaseService.deleteExam(exam.id); loadData(); } }}><Icons.Trash /></Button></div></Card>))}</div></div>}
                                    </div>
                                )
                        })}
                    </div>
                )}
            </div>
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Gerador de Provas" maxWidth={step === 4 ? 'max-w-5xl' : 'max-w-4xl'} footer={<div className="flex justify-between w-full print:hidden"><Button variant="ghost" onClick={() => step > 1 ? setStep(step - 1) : setIsModalOpen(false)}>{step === 1 ? 'Cancelar' : 'Voltar'}</Button><div className="flex gap-2">{step < 4 ? <Button onClick={() => setStep(step + 1)}>Próximo <Icons.ArrowRight /></Button> : <Button onClick={handleFinish} variant="secondary"><Icons.Check /> Salvar</Button>}</div></div>}>
                <div className="h-[60vh] flex flex-col">
                    <div className="flex-1 min-h-0 relative overflow-y-auto custom-scrollbar p-1">
                        {step === 1 && (
                            <div className="space-y-4">
                                <Input label="Título" value={editing.title} onChange={e => setEditing({...editing, title: e.target.value})} />
                                <div className="grid grid-cols-2 gap-4"><Select label="Instituição" value={editing.institutionId} onChange={e => setEditing({...editing, institutionId: e.target.value})}>{institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</Select><Select label="Turma" value={editing.classId} onChange={e => setEditing({...editing, classId: e.target.value})}>{classes.filter(c => c.institutionId === editing.institutionId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div>
                                <Input label="Cabeçalho" value={editing.headerText} onChange={e => setEditing({...editing, headerText: e.target.value})} />
                                <RichTextEditor label="Instruções" value={editing.instructions || ''} onChange={(html) => setEditing({...editing, instructions: html})} />
                            </div>
                        )}
                        {step === 2 && (
                             <div className="space-y-6">
                                <div className="grid grid-cols-12 gap-2 items-end bg-slate-50 p-4 rounded"><div className="col-span-3"><Select value={selDisc} onChange={e => { setSelDisc(e.target.value); setSelChap(''); }}><option value="">Disciplina</option>{hierarchy.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></div><div className="col-span-3"><Select value={selChap} onChange={e => setSelChap(e.target.value)}><option value="">Capítulo</option>{hierarchy.find(d => d.id === selDisc)?.chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div><div className="col-span-2"><Input type="number" value={selCount} onChange={e => setSelCount(parseInt(e.target.value))} /></div><div className="col-span-2"><Button onClick={handleAddContentScope}>+</Button></div></div>
                                {editing.contentScopes?.map(scope => <div key={scope.id} className="flex justify-between bg-white p-3 border rounded"><span>{scope.disciplineName} ({scope.questionCount}q)</span></div>)}
                             </div>
                        )}
                        {step === 3 && (
                            <div className="space-y-4">
                                <div className="flex justify-center gap-4"><Button onClick={() => setGenMode('manual')} variant={genMode === 'manual' ? 'primary' : 'ghost'}>Manual</Button><Button onClick={() => setGenMode('auto')} variant={genMode === 'auto' ? 'primary' : 'ghost'}>Auto</Button></div>
                                {genMode === 'manual' ? (
                                    <div className="border rounded bg-white divide-y">{filteredQuestions.map(q => <div key={q.id} onClick={() => setEditing(prev => { const exists = prev.questions?.find(x => x.id === q.id); return { ...prev, questions: exists ? prev.questions?.filter(x => x.id !== q.id) : [...(prev.questions || []), q] }; })} className={`p-4 cursor-pointer ${editing.questions?.some(x => x.id === q.id) ? 'bg-blue-50' : ''}`} dangerouslySetInnerHTML={{__html: q.enunciado}} />)}</div>
                                ) : (
                                    <div className="text-center p-8"><Button onClick={handleAutoGenerate}>Gerar Agora</Button><div className="mt-4">{editing.questions?.length} questões geradas</div></div>
                                )}
                            </div>
                        )}
                        {step === 4 && (
                            <div className="bg-white p-8 shadow-lg print:shadow-none">
                                <h1 className="text-center font-bold text-xl uppercase">{institutions.find(i => i.id === editing.institutionId)?.name}</h1>
                                <h2 className="text-center font-bold text-lg">{editing.title}</h2>
                                <div className="mt-8 space-y-6">{editing.questions?.map((q, i) => <div key={q.id}><span className="font-bold">{i+1}. </span><span dangerouslySetInnerHTML={{__html: q.enunciado}} /></div>)}</div>
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

  // Function to re-fetch user data (used after profile update)
  const refreshUser = async () => {
    if (auth.currentUser) {
       const userData = await FirebaseService.getCurrentUserData();
       setUser(userData);
    }
  };

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
    <AuthContext.Provider value={{ user, loading, refreshUser }}>
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
             <Link to="/profile" className="block hover:no-underline">
                <div className="p-4 border-t border-slate-800 bg-slate-900/50 hover:bg-slate-800/80 transition-colors cursor-pointer group">
                    <div className="flex items-center gap-3 mb-3">
                        {user.photoUrl ? (
                            <img src={user.photoUrl} alt={user.name} className="w-10 h-10 rounded-full object-cover border border-slate-600" />
                        ) : (
                            <div className="w-10 h-10 bg-brand-orange text-white rounded-full flex items-center justify-center font-bold">{user.name.charAt(0)}</div>
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate group-hover:text-brand-blue transition-colors">{user.name}</p>
                            <p className="text-xs text-slate-400 truncate">Ver Perfil</p>
                        </div>
                    </div>
                    <button onClick={(e) => { e.preventDefault(); handleLogout(); }} className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 w-full hover:bg-white/5 p-2 rounded transition-colors"><Icons.Logout /> Sair</button>
                </div>
             </Link>
          </aside>
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
             <Routes>
                 <Route path="/" element={<Dashboard />} />
                 <Route path="/profile" element={<ProfilePage />} />
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
