
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Exam, Institution, SchoolClass, Question, CurricularComponent, UserRole, QuestionType, ExamContentScope } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { Button, Modal, Select, Input, Badge, Card, RichTextEditor } from '../components/UI';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';

const ExamsPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    // Dados base
    const [exams, setExams] = useState<Exam[]>([]);
    const [institutions, setInstitutions] = useState<Institution[]>([]);
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [hierarchy, setHierarchy] = useState<CurricularComponent[]>([]);
    const [allQuestions, setAllQuestions] = useState<Question[]>([]);
    
    // UI States
    const [loading, setLoading] = useState(true);
    const [expandedInstitutions, setExpandedInstitutions] = useState<Record<string, boolean>>({});
    const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>({});

    // Modal/Wizard States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Partial<Exam>>({ questions: [], contentScopes: [] });
    const [currentStep, setCurrentStep] = useState(1);
    const [viewingMode, setViewingMode] = useState<'EXAM' | 'ONLINE_CONFIG'>('EXAM');
    const [generationMode, setGenerationMode] = useState<'AUTO' | 'MANUAL'>('AUTO');

    // Estados para o seletor de escopo no Passo 2
    const [selCc, setSelCc] = useState('');
    const [selD, setSelD] = useState('');
    const [selC, setSelC] = useState('');
    const [selU, setSelU] = useState('');
    const [selT, setSelT] = useState('');
    const [selQty, setSelQty] = useState(1);

    // Estados de Impressão e Anti-Cola
    const [printFontSize, setPrintFontSize] = useState('text-sm');
    const [activeVersion, setActiveVersion] = useState('A');

    useEffect(() => { if (user) load(); }, [user]);

    const load = async () => {
        setLoading(true);
        try {
            const [e, i, c, h, q] = await Promise.all([
                FirebaseService.getExams(user),
                FirebaseService.getInstitutions(user),
                FirebaseService.getClasses(user),
                FirebaseService.getHierarchy(),
                FirebaseService.getQuestions(user)
            ]);
            setExams(Array.isArray(e) ? e : []); 
            setInstitutions(Array.isArray(i) ? i.sort((a,b) => (a.name || '').localeCompare(b.name || '')) : []); 
            setClasses(Array.isArray(c) ? c : []); 
            setHierarchy(Array.isArray(h) ? h : []); 
            setAllQuestions(Array.isArray(q) ? q : []);
        } catch (err) {
            console.error("Erro ao carregar dados:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveExam = async () => {
        try {
            const payload = { 
                ...editing, 
                authorId: user?.id, 
                createdAt: editing.createdAt || new Date().toISOString(),
                questions: Array.isArray(editing.questions) ? editing.questions : [],
                contentScopes: Array.isArray(editing.contentScopes) ? editing.contentScopes : []
            };
            await FirebaseService.saveExam(payload);
            setIsModalOpen(false); 
            load();
        } catch (e) { 
            alert("Erro ao salvar avaliação."); 
        }
    };

    const handleDeleteExam = async (id: string) => {
        if (confirm("Deseja realmente excluir esta prova permanentemente?")) {
            await FirebaseService.deleteExam(id);
            load();
        }
    };

    // --- MOTOR ANTI-COLA: EMBARALHAMENTO DETERMINÍSTICO POR VERSÃO ---
    const questionsByVersion = useMemo(() => {
        const baseQs = Array.isArray(editing.questions) ? [...editing.questions] : [];
        if (activeVersion === 'A' || baseQs.length === 0) return baseQs;
        
        // Seed determinístico baseado na letra da versão (A=65, B=66, C=67...)
        const seedValue = activeVersion.charCodeAt(0);
        const seededRandom = (s: number) => {
            const x = Math.sin(s) * 10000;
            return x - Math.floor(x);
        };

        let currentSeed = seedValue;
        const shuffle = (arr: any[]) => {
            const newArr = [...arr];
            for (let i = newArr.length - 1; i > 0; i--) {
                const j = Math.floor(seededRandom(currentSeed++) * (i + 1));
                [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
            }
            return newArr;
        };

        // Embaralha a ordem das questões E a ordem das alternativas de cada questão
        return shuffle(baseQs).map(q => ({
            ...q,
            options: Array.isArray(q.options) ? shuffle(q.options) : q.options
        }));
    }, [editing.questions, activeVersion]);

    const handleAddScope = () => {
        if (!selCc) return alert("Selecione pelo menos a área de conhecimento.");
        
        const comp = hierarchy.find(h => h.id === selCc);
        const disc = comp?.disciplines.find(d => d.id === selD);
        const chap = disc?.chapters.find(c => c.id === selC);
        const unit = chap?.units.find(u => u.id === selU);
        const topic = unit?.topics.find(t => t.id === selT);

        const newScope: ExamContentScope = {
            id: `scope-${Date.now()}`,
            componentId: selCc,
            componentName: comp?.name || '',
            disciplineId: selD,
            disciplineName: disc?.name,
            chapterId: selC,
            chapterName: chap?.name,
            unitId: selU,
            unitName: unit?.name,
            topicId: selT,
            topicName: topic?.name,
            questionCount: selQty
        };

        setEditing(prev => ({
            ...prev,
            contentScopes: [...(Array.isArray(prev.contentScopes) ? prev.contentScopes : []), newScope]
        }));

        setSelC(''); setSelU(''); setSelT(''); setSelQty(1);
    };

    const handleRemoveScope = (scopeId: string) => {
        setEditing(prev => ({
            ...prev,
            contentScopes: (Array.isArray(prev.contentScopes) ? prev.contentScopes : []).filter(s => s.id !== scopeId)
        }));
    };

    const handleGenerateAuto = () => {
        const scopes = Array.isArray(editing.contentScopes) ? editing.contentScopes : [];
        if (scopes.length === 0) return alert("Defina o escopo no Passo 2 primeiro.");

        let selectedIds = new Set<string>();
        let finalQuestions: Question[] = [];

        scopes.forEach(scope => {
            let matches = allQuestions.filter(q => {
                if (q.componentId !== scope.componentId) return false;
                if (scope.disciplineId && q.disciplineId !== scope.disciplineId) return false;
                if (scope.chapterId && q.chapterId !== scope.chapterId) return false;
                if (scope.unitId && q.unitId !== scope.unitId) return false;
                if (scope.topicId && q.topicId !== scope.topicId) return false;
                return !selectedIds.has(q.id);
            });

            matches.sort(() => Math.random() - 0.5);
            const taken = matches.slice(0, scope.questionCount);
            taken.forEach(t => {
                selectedIds.add(t.id);
                finalQuestions.push(t);
            });
        });

        setEditing(prev => ({ ...prev, questions: finalQuestions }));
        alert(`${finalQuestions.length} questões vinculadas.`);
    };

    const toggleQuestionManual = (q: Question) => {
        const current = Array.isArray(editing.questions) ? editing.questions : [];
        const exists = current.find(x => x.id === q.id);
        if (exists) {
            setEditing({ ...editing, questions: current.filter(x => x.id !== q.id) });
        } else {
            setEditing({ ...editing, questions: [...current, q] });
        }
    };

    const getExamUrl = (id: string) => {
        const base = window.location.href.split('#')[0];
        return `${base}#/p/${id}`;
    };

    const handleCopyLink = (id: string) => {
        if (!id || id === 'NOVA') return;
        const url = getExamUrl(id);
        navigator.clipboard.writeText(url).then(() => {
            alert("Link da prova online copiado!");
        });
    };

    const selectedInstitution = useMemo(() => institutions.find(i => i.id === editing.institutionId), [institutions, editing.institutionId]);
    const authorizedComponents = useMemo(() => {
        if (!user || user.role === UserRole.ADMIN || user.role === UserRole.MANAGER) return hierarchy;
        const subjects = Array.isArray(user.subjects) ? user.subjects : [];
        const grants = Array.isArray(user.accessGrants) ? user.accessGrants : [];
        const authorized = [...subjects, ...grants];
        return hierarchy.filter(cc => authorized.includes(cc.id));
    }, [hierarchy, user]);

    const activeComp = useMemo(() => hierarchy.find(h => h.id === selCc), [hierarchy, selCc]);
    const activeDisc = useMemo(() => activeComp?.disciplines.find(d => d.id === selD), [activeComp, selD]);
    const activeChap = useMemo(() => activeDisc?.chapters.find(c => c.id === selC), [activeDisc, selC]);
    const activeUnit = useMemo(() => activeChap?.units.find(u => u.id === selU), [activeChap, selU]);

    // --- CORREÇÃO: Prevenir erro TypeError em scopes.some ---
    const manualPool = useMemo(() => {
        const scopes = Array.isArray(editing.contentScopes) ? editing.contentScopes : [];
        if (scopes.length === 0) return [];
        return allQuestions.filter(q => 
            scopes.some(s => 
                q.componentId === s.componentId && 
                (!s.disciplineId || q.disciplineId === s.disciplineId)
            )
        );
    }, [allQuestions, editing.contentScopes]);

    const renderHeaderPrint = () => (
        <div className="border-2 border-black p-4 mb-6 bg-white block text-black">
            <div className="flex items-center gap-6 mb-4">
                {selectedInstitution?.logoUrl && <img src={selectedInstitution.logoUrl} alt="Logo" className="h-10 w-auto object-contain shrink-0" />}
                <div className="flex-1">
                    <h1 className="font-black text-base uppercase leading-none">{selectedInstitution?.name || 'INSTITUIÇÃO'}</h1>
                    <h2 className="font-bold text-[10px] uppercase text-slate-700">{editing.title}</h2>
                </div>
                <div className="text-right"><div className="text-[10px] font-black border-2 border-black px-2 py-0.5 rounded">VERSÃO: {activeVersion}</div></div>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                <div className="border-b border-black font-black text-[9px] h-7 flex items-end">ALUNO:</div>
                <div className="border-b border-black font-black text-[9px] h-7 flex items-end">DATA: ___/___/___</div>
            </div>
        </div>
    );

    return (
        <div className="p-8 h-full flex flex-col bg-slate-50 overflow-y-auto custom-scrollbar print:block print:p-0 print:bg-white print:overflow-visible">
            <div className="flex justify-between items-center mb-8 no-print shrink-0">
                <div>
                    <h2 className="text-3xl font-display font-bold text-slate-800 tracking-tight">Minhas Provas</h2>
                    <p className="text-slate-500 mt-1">Gere avaliações personalizadas em minutos.</p>
                </div>
                <Button onClick={() => { 
                    setEditing({ 
                        title: '', questions: [], columns: 1, showAnswerKey: false, instructions: '', contentScopes: [],
                        publicConfig: { isPublished: false, startDate: new Date().toISOString(), endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), timeLimitMinutes: 60, allowedAttempts: 1, randomizeQuestions: true, requireIdentifier: true, showFeedback: true }
                    }); 
                    setCurrentStep(1); 
                    setIsModalOpen(true); 
                }} className="h-12 px-6 shadow-lg"><Icons.Plus /> Criar Prova</Button>
            </div>

            {loading ? (
                <div className="p-20 text-center text-slate-300 font-black animate-pulse no-print">Sincronizando...</div>
            ) : (
                <div className="space-y-4 no-print">
                    {institutions.map(inst => {
                        const instExams = exams.filter(e => e.institutionId === inst.id);
                        if (instExams.length === 0) return null;
                        const years = Array.from(new Set(instExams.map(e => new Date(e.createdAt).getFullYear()))).sort((a: number, b: number) => b - a);
                        const isExpandedInst = expandedInstitutions[inst.id];
                        return (
                            <div key={inst.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setExpandedInstitutions(prev => ({ ...prev, [inst.id]: !prev[inst.id] }))}>
                                    <div className="flex items-center gap-4">
                                        <div className={`transform transition-transform text-slate-400 ${isExpandedInst ? 'rotate-180' : ''}`}><Icons.ChevronDown /></div>
                                        <div className="flex items-center gap-3">
                                            {inst.logoUrl ? <img src={inst.logoUrl} className="w-10 h-10 object-contain rounded border bg-white p-0.5" /> : <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center text-slate-400"><Icons.Building /></div>}
                                            <span className="font-black text-lg text-slate-800 uppercase tracking-tight">{inst.name}</span>
                                        </div>
                                    </div>
                                    <Badge color="blue">{instExams.length} provas</Badge>
                                </div>
                                {isExpandedInst && (
                                    <div className="bg-slate-50 p-4 border-t border-slate-100 space-y-3 animate-fade-in">
                                        {years.map(year => {
                                            const yearId = `${inst.id}-${year}`;
                                            const isExpandedYear = expandedYears[yearId];
                                            const yearExams = instExams.filter(e => new Date(e.createdAt).getFullYear() === year);
                                            return (
                                                <div key={yearId} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                                    <div className="p-3 flex justify-between items-center cursor-pointer hover:bg-slate-50 pl-6" onClick={() => setExpandedYears(prev => ({ ...prev, [yearId]: !prev[yearId] }))}>
                                                        <div className="flex items-center gap-3">
                                                            <div className={`transform transition-transform text-slate-400 ${isExpandedYear ? 'rotate-180' : ''}`}><Icons.ChevronDown /></div>
                                                            <span className="font-bold text-slate-700">Ano Letivo {year}</span>
                                                        </div>
                                                        <span className="text-xs font-black text-slate-400 uppercase mr-2">{yearExams.length} itens</span>
                                                    </div>
                                                    {isExpandedYear && (
                                                        <div className="border-t border-slate-100 animate-fade-in overflow-x-auto">
                                                            <table className="w-full text-left text-sm">
                                                                <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100">
                                                                    <tr><th className="p-4">Título</th><th className="p-4">Questões</th><th className="p-4">Status</th><th className="p-4 text-right">Ações</th></tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-slate-50">
                                                                    {yearExams.map(exam => (
                                                                        <tr key={exam.id} className="hover:bg-blue-50/30 transition-colors group">
                                                                            <td className="p-4 font-bold text-slate-700">{exam.title}</td>
                                                                            <td className="p-4 font-black text-brand-blue">{Array.isArray(exam.questions) ? exam.questions.length : 0}</td>
                                                                            <td className="p-4">{exam.publicConfig?.isPublished ? <Badge color="green">ONLINE</Badge> : <Badge color="slate">OFFLINE</Badge>}</td>
                                                                            <td className="p-4 text-right">
                                                                                <div className="flex justify-end gap-1">
                                                                                    <button onClick={() => navigate('/exam-results', { state: { examId: exam.id } })} className="p-2 text-brand-blue hover:bg-blue-100 rounded-lg transition-colors" title="Resultados"><Icons.Eye /></button>
                                                                                    <button onClick={() => { setEditing(exam); setCurrentStep(1); setIsModalOpen(true); }} className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg transition-colors" title="Editar"><Icons.Edit /></button>
                                                                                    <button onClick={() => { setEditing(exam); setCurrentStep(4); setViewingMode('ONLINE_CONFIG'); setIsModalOpen(true); }} className="p-2 text-emerald-500 hover:bg-emerald-100 rounded-lg transition-colors" title="Compartilhar Link"><Icons.Share /></button>
                                                                                    <button onClick={() => { setEditing(exam); setViewingMode('EXAM'); setCurrentStep(4); setIsModalOpen(true); }} className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg transition-colors" title="Imprimir"><Icons.Printer /></button>
                                                                                    <button onClick={() => handleDeleteExam(exam.id)} className="p-2 text-slate-400 hover:text-red-500 rounded-lg transition-colors" title="Excluir"><Icons.Trash /></button>
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
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

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing.id ? "Configurar Prova" : "Nova Prova"} maxWidth="max-w-7xl" footer={
                <div className="flex justify-between w-full items-center no-print">
                    {currentStep > 1 && <Button variant="ghost" onClick={() => setCurrentStep(currentStep - 1)} className="font-black uppercase text-xs"><Icons.ArrowLeft /> Anterior</Button>}
                    <div className="flex gap-2 ml-auto">
                        {currentStep < 4 ? <Button onClick={() => setCurrentStep(currentStep + 1)} disabled={currentStep === 1 && !editing.title} className="px-10 h-12 font-black">Próximo <Icons.ArrowRight /></Button> : <Button onClick={handleSaveExam} className="px-12 h-12 shadow-xl font-black">SALVAR AVALIAÇÃO</Button>}
                    </div>
                </div>
            }>
                <div className="flex items-center justify-between mb-10 px-20 no-print">
                    {[1, 2, 3, 4].map(s => (
                        <React.Fragment key={s}>
                            <div className="flex flex-col items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black transition-all ${currentStep >= s ? 'bg-brand-blue text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>{s}</div>
                                <span className={`text-[9px] font-black uppercase tracking-widest ${currentStep >= s ? 'text-brand-blue' : 'text-slate-300'}`}>{s === 1 ? 'Config' : s === 2 ? 'Escopo' : s === 3 ? 'Itens' : 'Finalizar'}</span>
                            </div>
                            {s < 4 && <div className={`flex-1 h-0.5 mx-4 transition-colors ${currentStep > s ? 'bg-brand-blue' : 'bg-slate-100'}`}></div>}
                        </React.Fragment>
                    ))}
                </div>

                <div className="animate-fade-in min-h-[400px]">
                    {currentStep === 1 && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <Input label="Título da Avaliação" value={editing.title} onChange={e => setEditing({...editing, title: e.target.value})} placeholder="P1, Simulado Bimestral..." />
                                    <div className="grid grid-cols-2 gap-4">
                                        <Select label="Instituição" value={editing.institutionId || ''} onChange={e => setEditing({...editing, institutionId: e.target.value})}>
                                            <option value="">Selecione...</option>
                                            {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                        </Select>
                                        <Select label="Turma" value={editing.classId || ''} onChange={e => setEditing({...editing, classId: e.target.value})}>
                                            <option value="">Geral</option>
                                            {classes.filter(c => c.institutionId === editing.institutionId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </Select>
                                    </div>
                                </div>
                                <div className="bg-slate-50 p-6 rounded-[32px] border-2 border-slate-100 space-y-6">
                                    <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest">Layout da Prova Impressa</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div onClick={() => setEditing({...editing, columns: 1})} className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${editing.columns === 1 ? 'border-brand-blue bg-white shadow-md' : 'border-slate-200 opacity-60'}`}>
                                            <div className="h-10 w-full bg-slate-200 rounded mb-2 flex flex-col gap-1 p-2"><div className="h-1 w-full bg-slate-300 rounded"></div><div className="h-1 w-full bg-slate-300 rounded"></div></div>
                                            <p className="text-center font-bold text-xs">1 Coluna</p>
                                        </div>
                                        <div onClick={() => setEditing({...editing, columns: 2})} className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${editing.columns === 2 ? 'border-brand-blue bg-white shadow-md' : 'border-slate-200 opacity-60'}`}>
                                            <div className="h-10 w-full bg-slate-200 rounded mb-2 flex gap-1 p-2"><div className="w-1/2 h-full bg-slate-300 rounded"></div><div className="w-1/2 h-full bg-slate-300 rounded"></div></div>
                                            <p className="text-center font-bold text-xs">2 Colunas</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between bg-white p-4 rounded-2xl border">
                                        <span className="text-sm font-bold text-slate-700">Incluir Cartão Resposta?</span>
                                        <input type="checkbox" checked={editing.showAnswerKey} onChange={e => setEditing({...editing, showAnswerKey: e.target.checked})} className="w-5 h-5 text-brand-blue" />
                                    </div>
                                </div>
                            </div>
                            <RichTextEditor label="Instruções de Cabeçalho" value={editing.instructions || ''} onChange={html => setEditing({...editing, instructions: html})} />
                        </div>
                    )}

                    {currentStep === 2 && (
                        <div className="space-y-6">
                            <div className="bg-slate-50 p-6 rounded-[32px] border-2 border-slate-100">
                                <h4 className="text-xs font-black uppercase text-slate-400 mb-4 tracking-widest">Adicionar Conteúdo ao Escopo</h4>
                                <div className="grid grid-cols-6 gap-2 items-end">
                                    <Select label="1. Área" value={selCc} onChange={e => { setSelCc(e.target.value); setSelD(''); setSelC(''); setSelU(''); setSelT(''); }} className="text-[10px] font-bold">
                                        <option value="">Selecionar...</option>
                                        {authorizedComponents.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
                                    </Select>
                                    <Select label="2. Disciplina" value={selD} onChange={e => { setSelD(e.target.value); setSelC(''); setSelU(''); setSelT(''); }} disabled={!selCc} className="text-[10px] font-bold">
                                        <option value="">Geral</option>
                                        {activeComp?.disciplines.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </Select>
                                    <Select label="3. Capítulo" value={selC} onChange={e => { setSelC(e.target.value); setSelU(''); setSelT(''); }} disabled={!selD} className="text-[10px] font-bold">
                                        <option value="">Geral</option>
                                        {activeDisc?.chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </Select>
                                    <Select label="4. Unidade" value={selU} onChange={e => { setSelU(e.target.value); setSelT(''); }} disabled={!selC} className="text-[10px] font-bold">
                                        <option value="">Geral</option>
                                        {activeChap?.units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </Select>
                                    <Select label="5. Tópico" value={selT} onChange={e => setSelT(e.target.value)} disabled={!selU} className="text-[10px] font-bold">
                                        <option value="">Geral</option>
                                        {activeUnit?.topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </Select>
                                    <div className="flex gap-2">
                                        <Input label="Qtd" type="number" min="1" value={selQty} onChange={e => setSelQty(Number(e.target.value))} className="text-[10px] h-9 w-16" />
                                        <Button onClick={handleAddScope} className="h-9 px-4 font-black text-[10px] shadow-lg">ADICIONAR</Button>
                                    </div>
                                </div>
                            </div>
                            <Card title="Estrutura da Prova">
                                <table className="w-full text-left">
                                    <thead className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b">
                                        <tr><th className="p-2">Caminho Pedagógico</th><th className="p-2 text-center">Questões</th><th className="p-2 text-right">Ação</th></tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {(Array.isArray(editing.contentScopes) ? editing.contentScopes : []).map((scope) => (
                                            <tr key={scope.id}>
                                                <td className="p-2 py-3 text-sm">
                                                    <span className="font-bold text-slate-700">{scope.componentName}</span>
                                                    <span className="text-slate-400 ml-2">› {scope.disciplineName || 'Geral'}</span>
                                                    {scope.topicName && <span className="text-brand-blue font-black ml-2">› {scope.topicName}</span>}
                                                </td>
                                                <td className="p-2 text-center font-black">{scope.questionCount}</td>
                                                <td className="p-2 text-right"><button onClick={() => handleRemoveScope(scope.id)} className="text-slate-300 hover:text-red-500"><Icons.Trash /></button></td>
                                            </tr>
                                        ))}
                                        {(!Array.isArray(editing.contentScopes) || editing.contentScopes.length === 0) && <tr><td colSpan={3} className="p-10 text-center text-slate-300 italic">Adicione temas para prosseguir.</td></tr>}
                                    </tbody>
                                </table>
                            </Card>
                        </div>
                    )}

                    {currentStep === 3 && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex bg-slate-100 p-1 rounded-2xl w-fit mx-auto mb-4 border">
                                <button onClick={() => setGenerationMode('AUTO')} className={`px-8 py-2 rounded-xl text-xs font-black uppercase transition-all ${generationMode === 'AUTO' ? 'bg-brand-blue text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}>Automática</button>
                                <button onClick={() => setGenerationMode('MANUAL')} className={`px-8 py-2 rounded-xl text-xs font-black uppercase transition-all ${generationMode === 'MANUAL' ? 'bg-brand-blue text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}>Manual</button>
                            </div>
                            {generationMode === 'AUTO' ? (
                                <div className="text-center py-20 bg-white border-2 border-dashed rounded-[40px] space-y-6">
                                    <div className="w-20 h-20 bg-blue-50 text-brand-blue rounded-full flex items-center justify-center mx-auto shadow-inner"><Icons.Sparkles className="w-10 h-10" /></div>
                                    <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Vincular Questões do Banco</h3>
                                    <p className="text-slate-500 text-sm max-w-md mx-auto">O motor selecionará aleatoriamente {Array.isArray(editing.contentScopes) ? editing.contentScopes.reduce((a,b) => a+b.questionCount, 0) : 0} questões baseadas no escopo.</p>
                                    <Button onClick={handleGenerateAuto} className="h-16 px-12 text-lg font-black shadow-2xl rounded-2xl">GERAR AGORA</Button>
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selecionadas: {Array.isArray(editing.questions) ? editing.questions.length : 0}</div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-6 h-[500px]">
                                    <div className="flex flex-col gap-4 border p-4 rounded-3xl bg-slate-50 overflow-hidden">
                                        <h4 className="text-xs font-black uppercase text-slate-400 px-2 tracking-widest">Banco Disponível</h4>
                                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                                            {manualPool.map(q => {
                                                const isSelected = !!(Array.isArray(editing.questions) ? editing.questions.find(x => x.id === q.id) : false);
                                                return (
                                                    <div key={q.id} className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${isSelected ? 'border-brand-blue bg-white opacity-50' : 'border-white bg-white hover:border-slate-200'}`} onClick={() => !isSelected && toggleQuestionManual(q)}>
                                                        <div className="text-xs font-bold text-slate-700 line-clamp-2" dangerouslySetInnerHTML={{__html: q.enunciado}} />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-4 border p-4 rounded-3xl bg-slate-800 overflow-hidden">
                                        <h4 className="text-xs font-black uppercase text-white/40 px-2 tracking-widest">Itens na Prova ({Array.isArray(editing.questions) ? editing.questions.length : 0})</h4>
                                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                                            {(Array.isArray(editing.questions) ? editing.questions : []).map((q, idx) => (
                                                <div key={q.id} className="p-3 bg-white/10 rounded-xl flex gap-3 text-white border border-white/10">
                                                    <span className="w-5 h-5 rounded bg-white/20 flex items-center justify-center font-black text-[10px]">{idx+1}</span>
                                                    <div className="flex-1 text-xs font-medium line-clamp-2" dangerouslySetInnerHTML={{__html: q.enunciado}} />
                                                    <button onClick={() => toggleQuestionManual(q)} className="text-white/40 hover:text-red-400"><Icons.X /></button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {currentStep === 4 && (
                        <div className="grid grid-cols-4 gap-8">
                            <div className="col-span-1 space-y-6 bg-slate-50 p-6 rounded-3xl border no-print h-fit">
                                <div className="flex bg-white rounded-xl p-1 border shadow-inner">
                                    <button onClick={() => setViewingMode('EXAM')} className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${viewingMode === 'EXAM' ? 'bg-brand-blue text-white shadow-md' : 'text-slate-400'}`}>IMPRESSÃO</button>
                                    <button onClick={() => setViewingMode('ONLINE_CONFIG')} className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${viewingMode === 'ONLINE_CONFIG' ? 'bg-brand-blue text-white shadow-md' : 'text-slate-400'}`}>ONLINE</button>
                                </div>
                                {viewingMode === 'EXAM' ? (
                                    <div className="space-y-4">
                                        <Select label="Fonte" value={printFontSize} onChange={e => setPrintFontSize(e.target.value)}>
                                            <option value="text-[11px]">Pequena</option>
                                            <option value="text-sm">Padrão</option>
                                            <option value="text-base">Grande</option>
                                        </Select>
                                        
                                        <div className="p-4 bg-white rounded-2xl border space-y-3">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Anti-Cola (Versões)</label>
                                            <div className="flex gap-2">
                                                {['A', 'B', 'C', 'D'].map(v => (
                                                    <button key={v} onClick={() => setActiveVersion(v)} className={`flex-1 h-10 rounded-xl font-black transition-all ${activeVersion === v ? 'bg-brand-blue text-white shadow-lg' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>{v}</button>
                                                ))}
                                            </div>
                                            <p className="text-[9px] text-slate-500 leading-tight italic">Trocar a versão reordena questões e alternativas em tempo real abaixo.</p>
                                        </div>

                                        <Button onClick={() => window.print()} className="w-full h-12 bg-slate-900 text-white shadow-xl"><Icons.Printer /> Imprimir Tudo</Button>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="bg-white p-4 rounded-xl border flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-700">Publicar Online?</span>
                                            <input type="checkbox" checked={editing.publicConfig?.isPublished} onChange={e => setEditing({...editing, publicConfig: {...editing.publicConfig!, isPublished: e.target.checked}})} className="w-5 h-5 text-brand-blue" />
                                        </div>
                                        <Input label="Tempo (minutos)" type="number" value={editing.publicConfig?.timeLimitMinutes} onChange={e => setEditing({...editing, publicConfig: {...editing.publicConfig!, timeLimitMinutes: Number(e.target.value)}})} />
                                        <div className="p-4 bg-white border rounded-xl">
                                            <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Link da Prova</p>
                                            <button onClick={() => handleCopyLink(editing.id || '')} className="text-brand-blue text-xs font-bold break-all text-left hover:underline">{getExamUrl(editing.id || 'NOVA')}</button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="col-span-3 bg-white rounded-2xl border shadow-inner h-[600px] overflow-y-auto custom-scrollbar overflow-x-hidden p-8">
                                <div id="exam-print-container" className={`${printFontSize} text-black w-full`}>
                                    
                                    {/* PÁGINA 1: CONTEÚDO DA PROVA */}
                                    <div className="print:page-break-after">
                                        {renderHeaderPrint()}
                                        {editing.instructions && <div className="mb-6 rich-text-content border-b pb-4 text-black text-[11px]" dangerouslySetInnerHTML={{__html: editing.instructions}} />}
                                        
                                        <div className={editing.columns === 2 ? 'preview-columns-2 print-columns-2' : 'space-y-6'}>
                                            {questionsByVersion.map((q, idx) => (
                                                <div key={`${activeVersion}-${q.id}`} className="break-inside-avoid text-black mb-6">
                                                    <div className="font-bold mb-2 flex gap-2">
                                                        <span>{idx + 1}.</span>
                                                        <div className="rich-text-content flex-1" dangerouslySetInnerHTML={{__html: q.enunciado}} />
                                                    </div>
                                                    <div className="ml-6 space-y-1">
                                                        {(Array.isArray(q.options) ? q.options : []).map((opt, i) => (
                                                            <div key={`${activeVersion}-${opt.id}-${i}`} className="flex gap-2 items-center">
                                                                <span className="w-4 h-4 border border-black rounded-full flex items-center justify-center text-[8px] font-black shrink-0">{String.fromCharCode(65+i)}</span>
                                                                <span className="text-[11px] leading-tight">{opt.text}</span>
                                                            </div>
                                                        ))}
                                                        {q.type === QuestionType.SHORT_ANSWER && <div className="h-20 border-b border-dashed border-slate-400 w-full mt-2"></div>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* PÁGINA 2: CARTÃO DE RESPOSTAS */}
                                    {editing.showAnswerKey && (
                                        <div className="print:break-before-page mt-12 pt-8 border-t-2 border-black relative min-h-[900px] bg-white">
                                            {/* Âncoras de Visão Computacional nos 4 cantos para correção via App */}
                                            <div className="vision-anchor anchor-tl absolute top-0 left-0"></div>
                                            <div className="vision-anchor anchor-tr absolute top-0 right-0"></div>
                                            <div className="vision-anchor anchor-bl absolute bottom-0 left-0"></div>
                                            <div className="vision-anchor anchor-br absolute bottom-0 right-0"></div>

                                            <h3 className="font-black uppercase text-center text-lg mb-8 border-b-2 border-black pb-2">CARTÃO DE RESPOSTAS - VERSÃO {activeVersion}</h3>
                                            
                                            <div className="max-w-xl mx-auto border-2 border-black p-8">
                                                <p className="text-[10px] font-black uppercase mb-6 text-center tracking-widest border-b pb-2">Use caneta azul ou preta. Preencha completamente o círculo.</p>
                                                <div className="space-y-4">
                                                    {questionsByVersion.map((q, idx) => {
                                                        const isObjective = q.type === QuestionType.MULTIPLE_CHOICE || q.type === QuestionType.TRUE_FALSE;
                                                        return (
                                                            <div key={`${activeVersion}-card-${q.id}-${idx}`} className="flex items-center gap-6 border-b border-slate-100 pb-2">
                                                                <span className="text-sm font-black w-6">{idx+1}</span>
                                                                {isObjective ? (
                                                                    <div className="flex gap-4">
                                                                        {[0,1,2,3,4].map(i => (
                                                                            <div key={i} className="w-8 h-8 border-2 border-black rounded-full flex items-center justify-center text-[10px] font-black">
                                                                                {String.fromCharCode(65+i)}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex-1 bg-slate-50 border border-slate-200 rounded px-4 py-1 text-[10px] font-black uppercase text-slate-500 italic tracking-widest">
                                                                        Item Dissertativo (Não preencher)
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <div className="mt-12 pt-4 border-t-2 border-black flex justify-between items-end">
                                                    <div>
                                                        <p className="text-[9px] font-black uppercase">Autenticidade</p>
                                                        <p className="font-mono text-[10px] font-bold">{editing.id?.slice(0,18).toUpperCase() || 'OFFLINE'}-{activeVersion}</p>
                                                    </div>
                                                    <div className="w-20 h-20 border-2 border-black flex items-center justify-center text-[7px] font-black uppercase text-center p-1">QR CODE IDENTIFICADOR</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* PÁGINA 3: GABARITO DO PROFESSOR */}
                                    {editing.showAnswerKey && (
                                        <div className="print:break-before-page mt-12 pt-8 border-t-4 border-black bg-slate-50 p-10 min-h-[500px]">
                                            <h3 className="font-black uppercase text-center text-xl mb-10 border-b-2 border-black pb-3 text-slate-900">GABARITO OFICIAL - VERSÃO {activeVersion}</h3>
                                            <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                                                {questionsByVersion.map((q, idx) => {
                                                    const isObjective = q.type === QuestionType.MULTIPLE_CHOICE || q.type === QuestionType.TRUE_FALSE;
                                                    const correctIdx = q.options?.findIndex(o => o.isCorrect);
                                                    return (
                                                        <div key={`${activeVersion}-gab-${q.id}-${idx}`} className="flex items-center justify-between border-b-2 border-slate-200 pb-3">
                                                            <div className="flex items-center gap-4">
                                                                <span className="font-black text-slate-400 text-lg">{idx+1}.</span>
                                                                <span className="text-sm font-bold text-slate-800">
                                                                    {isObjective 
                                                                        ? `Alternativa ${correctIdx !== -1 ? String.fromCharCode(65 + (correctIdx ?? 0)) : '?'}` 
                                                                        : 'Dissertativa (Corrigir Manualmente)'}
                                                                </span>
                                                            </div>
                                                            {isObjective && correctIdx !== -1 && (
                                                                <div className="w-8 h-8 bg-brand-blue text-white rounded-lg flex items-center justify-center text-xs font-black shadow-md">
                                                                    {String.fromCharCode(65 + (correctIdx ?? 0))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <div className="mt-20 p-8 border-4 border-dashed border-slate-300 rounded-[40px] text-center bg-white">
                                                <Icons.Shield className="mx-auto mb-2 text-slate-300 w-8 h-8" />
                                                <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Documento Restrito ao Corpo Docente</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default ExamsPage;
