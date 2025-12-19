
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Exam, Institution, SchoolClass, Discipline, Question, ExamContentScope, QuestionType, PublicExamConfig } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { Button, Modal, Select, Input, Badge, RichTextEditor } from '../components/UI';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';

const QuestionTypeLabels: Record<string, string> = {
    [QuestionType.MULTIPLE_CHOICE]: 'Múltipla Escolha',
    [QuestionType.TRUE_FALSE]: 'Verdadeiro/Falso',
    [QuestionType.SHORT_ANSWER]: 'Dissertativa',
    [QuestionType.NUMERIC]: 'Numérica',
    [QuestionType.ASSOCIATION]: 'Associação'
};

const DifficultyLabels: Record<string, string> = {
    'Easy': 'Fácil',
    'Medium': 'Médio',
    'Hard': 'Difícil'
};

const getTagColor = (tag: string): "blue" | "green" | "red" | "yellow" | "purple" | "orange" => {
    const colors: any[] = ["blue", "green", "purple", "orange", "yellow", "red"];
    let hash = 0;
    for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
};

/**
 * Função utilitária para clonagem profunda segura de objetos de questão, 
 * evitando erros de circularidade com proxies ou objetos internos do Firebase.
 */
const safeCloneQuestion = (q: Question): Question => {
    return {
        ...q,
        options: q.options ? q.options.map(o => ({ ...o })) : undefined,
        pairs: q.pairs ? q.pairs.map(p => ({ ...p })) : undefined,
        tags: q.tags ? [...q.tags] : undefined
    };
};

const ExamsPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [exams, setExams] = useState<Exam[]>([]);
    const [institutions, setInstitutions] = useState<Institution[]>([]);
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [hierarchy, setHierarchy] = useState<Discipline[]>([]);
    const [allQuestions, setAllQuestions] = useState<Question[]>([]);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Partial<Exam>>({});
    const [currentStep, setCurrentStep] = useState(1);
    const [saving, setSaving] = useState(false);
    const [tagInput, setTagInput] = useState('');
    const [selTag, setSelTag] = useState('');

    const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
    const [publishingExam, setPublishingExam] = useState<Exam | null>(null);
    const [publishConfig, setPublishConfig] = useState<PublicExamConfig>({
        isPublished: false, startDate: '', endDate: '', timeLimitMinutes: 0, allowedAttempts: 1, randomizeQuestions: true, requireIdentifier: false, showFeedback: true
    });

    const [selectedDisc, setSelectedDisc] = useState('');
    const [selectedChap, setSelectedChap] = useState('');
    const [selectedUnit, setSelectedUnit] = useState('');
    const [selectedTopic, setSelectedTopic] = useState('');
    const [questionsCount, setQuestionsCount] = useState(1);
    const [tempScopes, setTempScopes] = useState<ExamContentScope[]>([]);

    const [generationMode, setGenerationMode] = useState<'MANUAL' | 'AUTO'>('AUTO');
    const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);
    const [manualSelectedIds, setManualSelectedIds] = useState<Set<string>>(new Set());
    const [viewingQuestion, setViewingQuestion] = useState<Question | null>(null);

    const [activeVersion, setActiveVersion] = useState<'ORIGINAL' | 'A' | 'B' | 'C' | 'D'>('ORIGINAL');
    const [viewMode, setViewMode] = useState<'EXAM' | 'ANSWER_SHEET'>('EXAM');
    const [examVersions, setExamVersions] = useState<Record<string, Question[]>>({});
    const [printSettings, setPrintSettings] = useState({ fontSize: 'text-sm', showName: true, showDate: true, showClass: true, showScore: true });

    const [expandedInstitutions, setExpandedInstitutions] = useState<Record<string, boolean>>({});
    const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>({});
    const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>({});

    useEffect(() => { if (user) load(); }, [user]);
    
    useEffect(() => {
        if (currentStep === 4 && (generatedQuestions.length > 0 || manualSelectedIds.size > 0)) {
            generateVersions();
        }
    }, [currentStep]);

    const load = async () => {
        const [e, i, c, h, q] = await Promise.all([
            FirebaseService.getExams(user),
            FirebaseService.getInstitutions(user),
            FirebaseService.getClasses(user),
            FirebaseService.getHierarchy(user),
            FirebaseService.getQuestions(user)
        ]);
        setExams(e);
        setInstitutions(i.sort((a,b) => a.name.localeCompare(b.name)));
        setClasses(c);
        setHierarchy(h);
        setAllQuestions(q);
    };

    const availableTags = useMemo(() => {
        const tags = new Set<string>();
        exams.forEach(ex => ex.tags?.forEach(t => tags.add(t)));
        return Array.from(tags).sort();
    }, [exams]);

    const availableForManual = useMemo(() => {
        if (tempScopes.length === 0) return [];
        return allQuestions.filter(q => {
            return tempScopes.some(scope => {
                return q.disciplineId === scope.disciplineId &&
                       (!scope.chapterId || q.chapterId === scope.chapterId) &&
                       (!scope.unitId || q.unitId === scope.unitId) &&
                       (!scope.topicId || q.topicId === scope.topicId);
            });
        }).sort((a, b) => (manualSelectedIds.has(b.id) ? 1 : 0) - (manualSelectedIds.has(a.id) ? 1 : 0));
    }, [allQuestions, tempScopes, manualSelectedIds]);

    const shuffleArray = <T,>(array: T[]): T[] => {
        const newArr = [...array];
        for (let i = newArr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
        }
        return newArr;
    };

    const generateVersions = () => {
        const sourceArray = (generationMode === 'AUTO' ? generatedQuestions : allQuestions.filter(q => manualSelectedIds.has(q.id))) as Question[];
        const baseQuestions = sourceArray.map(q => safeCloneQuestion(q));

        const versions: Record<string, Question[]> = {};
        versions['ORIGINAL'] = [...baseQuestions];
        ['A', 'B', 'C', 'D'].forEach(ver => {
            versions[ver] = shuffleArray(baseQuestions).map(q => {
                const newQ = safeCloneQuestion(q);
                if (newQ.type === QuestionType.MULTIPLE_CHOICE && newQ.options) {
                    newQ.options = shuffleArray(newQ.options);
                }
                return newQ;
            });
        });
        setExamVersions(versions);
        setActiveVersion('ORIGINAL');
    };

    const toggleInstitution = (id: string) => setExpandedInstitutions(prev => ({ ...prev, [id]: !prev[id] }));
    const toggleYear = (id: string) => setExpandedYears(prev => ({ ...prev, [id]: !prev[id] }));
    const handleDelete = async (id: string) => { if(confirm('Excluir prova?')) { await FirebaseService.deleteExam(id); load(); } };

    const handleOpenModal = (exam?: Exam, startAtStep: number = 1) => {
        if (exam) {
            setEditing({ ...exam, tags: exam.tags || [] });
            setTempScopes(exam.contentScopes || []);
            setGeneratedQuestions(exam.questions || []);
            setManualSelectedIds(new Set(exam.questions.map(q => q.id)));
            setGenerationMode('MANUAL');
        } else {
            setEditing({ columns: 1, showAnswerKey: false, institutionId: user?.institutionId || '', tags: [] });
            setTempScopes([]); setGeneratedQuestions([]); setManualSelectedIds(new Set()); setGenerationMode('AUTO');
        }
        setCurrentStep(startAtStep); setIsModalOpen(true);
    };

    const openPublishModal = (exam: Exam) => {
        setPublishingExam(exam);
        const now = new Date(); const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        if (exam.publicConfig) setPublishConfig(exam.publicConfig);
        else setPublishConfig({ isPublished: true, startDate: now.toISOString().slice(0, 16), endDate: nextWeek.toISOString().slice(0, 16), timeLimitMinutes: 60, allowedAttempts: 1, randomizeQuestions: true, requireIdentifier: false, showFeedback: true });
        setIsPublishModalOpen(true);
    };

    const handleSavePublish = async () => {
        if (!publishingExam) return; setSaving(true);
        try { await FirebaseService.saveExam({ ...publishingExam, publicConfig: publishConfig }); setIsPublishModalOpen(false); load(); } finally { setSaving(false); }
    };

    const handleAddScope = () => {
        if (!selectedDisc) return;
        const disc = hierarchy.find(d => d.id === selectedDisc);
        const chap = disc?.chapters.find(c => c.id === selectedChap);
        const unit = chap?.units.find(u => u.id === selectedUnit);
        const topic = unit?.topics.find(t => t.id === selectedTopic);
        setTempScopes([...tempScopes, { id: Date.now().toString(), disciplineId: selectedDisc, disciplineName: disc?.name || '', chapterId: selectedChap || undefined, chapterName: chap?.name, unitId: selectedUnit || undefined, unitName: unit?.name, topicId: selectedTopic || undefined, topicName: topic?.name, questionCount: questionsCount }]);
    };

    const handleAutoGenerate = () => {
        const finalQuestions: Question[] = [];
        tempScopes.forEach(scope => {
            const scopeQs = allQuestions.filter(q => {
                return q.disciplineId === scope.disciplineId && (!scope.chapterId || q.chapterId === scope.chapterId) && (!scope.unitId || q.unitId === scope.unitId) && (!scope.topicId || q.topicId === scope.topicId);
            });
            const selected = shuffleArray<Question>(scopeQs).slice(0, scope.questionCount);
            finalQuestions.push(...selected);
        });
        
        // Fix: Explicitly handle deduplication logic to prevent unknown[] or {}[] type issues
        const seenIds = new Set<string>();
        const uniqueQuestions: Question[] = [];
        for (const q of finalQuestions) {
            if (!seenIds.has(q.id)) {
                seenIds.add(q.id);
                uniqueQuestions.push(q);
            }
        }
            
        setGeneratedQuestions(uniqueQuestions);
    };

    const handleSave = async () => {
        if(!editing.title) return alert('Título obrigatório'); setSaving(true);
        const finalQs = generationMode === 'AUTO' ? generatedQuestions : allQuestions.filter(q => manualSelectedIds.has(q.id));
        try { await FirebaseService.saveExam({ ...editing, questions: finalQs, contentScopes: tempScopes, createdAt: editing.createdAt || new Date().toISOString() } as Exam); setIsModalOpen(false); load(); } finally { setSaving(false); }
    };

    const renderHeader = () => {
        const inst = institutions.find(i => i.id === editing.institutionId);
        const cls = classes.find(c => c.id === editing.classId);
        return (
            <div className="border-b-2 border-black pb-4 mb-8">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-6">
                        {inst?.logoUrl && <img src={inst.logoUrl} alt="Logo" className="w-20 h-20 object-contain" />}
                        <div><h1 className="text-2xl font-bold uppercase leading-tight">{inst?.name || 'Instituição'}</h1><h2 className="text-xl font-bold mt-1">{editing.title}</h2></div>
                    </div>
                    {activeVersion !== 'ORIGINAL' && <Badge color="blue">MODELO {activeVersion}</Badge>}
                </div>
                <div className="mt-6 border-t border-gray-400 pt-4 flex flex-wrap gap-x-8 gap-y-3 text-[0.9em]">
                    {printSettings.showName && <span className="w-full">Aluno(a): ____________________________________________________________________</span>}
                    {printSettings.showClass && <span>Turma: {cls?.name || '________'}</span>}
                    {printSettings.showDate && <span>Data: ____/____/____</span>}
                    {printSettings.showScore && <span className="font-bold">Nota: ________</span>}
                </div>
            </div>
        );
    };

    const renderStepContent = () => {
        switch(currentStep) {
            case 1: return (
                <div className="space-y-6 animate-fade-in"><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="space-y-6"><Input label="Título da Prova" value={editing.title || ''} onChange={e => setEditing({...editing, title: e.target.value})} /><div className="grid grid-cols-2 gap-4"><Select label="Instituição" value={editing.institutionId || ''} onChange={e => setEditing({...editing, institutionId: e.target.value, classId: ''})}><option value="">Selecione...</option>{institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</Select><Select label="Turma" value={editing.classId || ''} onChange={e => setEditing({...editing, classId: e.target.value})} disabled={!editing.institutionId}><option value="">Selecione...</option>{classes.filter(c => c.institutionId === editing.institutionId).map(c => <option key={c.id} value={c.id}>{c.name} ({c.year})</option>)}</Select></div><Input label="Cabeçalho (Subtítulo)" value={editing.headerText || ''} onChange={e => setEditing({...editing, headerText: e.target.value})} /></div><div className="bg-slate-50 p-5 rounded-2xl border border-slate-200"><label className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><Icons.Filter /> Etiquetas</label><div className="flex gap-2 mb-4"><input type="text" className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), setEditing({...editing, tags: [...(editing.tags || []), tagInput.trim()]}), setTagInput(''))}/><Button onClick={() => {setEditing({...editing, tags: [...(editing.tags || []), tagInput.trim()]}); setTagInput('');}} variant="secondary" className="px-3">ADD</Button></div><div className="flex flex-wrap gap-2">{editing.tags?.map(t => (<span key={t} className={`flex items-center gap-2 text-xs font-black px-3 py-1.5 rounded-full bg-${getTagColor(t)}-100 text-${getTagColor(t)}-800 border border-${getTagColor(t)}-200 shadow-sm`}>{t}<button onClick={() => setEditing({...editing, tags: (editing.tags || []).filter(tg => tg !== t)})}><Icons.X /></button></span>))}</div></div></div><div className="grid grid-cols-2 gap-6"><div><label className="text-sm font-bold text-slate-700 mb-3 block">Layout</label><div className="flex gap-4"><button onClick={() => setEditing({...editing, columns: 1})} className={`flex-1 p-3 rounded-xl border-2 transition-all ${editing.columns === 1 ? 'border-brand-blue bg-blue-50' : 'border-slate-200'}`}><span className="text-xs font-bold">Padrão (1 Col)</span></button><button onClick={() => setEditing({...editing, columns: 2})} className={`flex-1 p-3 rounded-xl border-2 transition-all ${editing.columns === 2 ? 'border-brand-blue bg-blue-50' : 'border-slate-200'}`}><span className="text-xs font-bold">Economia (2 Col)</span></button></div></div><div className="flex flex-col justify-center"><label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer"><input type="checkbox" checked={editing.showAnswerKey || false} onChange={e => setEditing({...editing, showAnswerKey: e.target.checked})} className="w-5 h-5 text-brand-blue rounded" /><span className="text-sm font-bold text-slate-700">Imprimir Gabarito</span></label></div></div><RichTextEditor label="Instruções" value={editing.instructions || ''} onChange={html => setEditing({...editing, instructions: html})} /></div>
            );
            case 2: return (
                <div className="space-y-6 animate-fade-in"><div className="bg-slate-50 p-6 rounded-xl border border-slate-200"><h4 className="text-sm font-bold text-slate-700 mb-4 uppercase">Conteúdo</h4><div className="grid grid-cols-2 gap-4 mb-4"><Select label="Disciplina" value={selectedDisc} onChange={e => { setSelectedDisc(e.target.value); setSelectedChap(''); setSelectedUnit(''); setSelectedTopic(''); }}><option value="">Selecione...</option>{hierarchy.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</Select><Select label="Capítulo" value={selectedChap} onChange={e => { setSelectedChap(e.target.value); setSelectedUnit(''); setSelectedTopic(''); }} disabled={!selectedDisc}><option value="">Todos</option>{hierarchy.find(d => d.id === selectedDisc)?.chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div><div className="flex gap-4 items-end mt-4"><Input label="Qtd. Questões" type="number" min="1" value={questionsCount} onChange={e => setQuestionsCount(parseInt(e.target.value))} className="w-40" /><Button onClick={handleAddScope} disabled={!selectedDisc} className="flex-1">+ Adicionar Escopo</Button></div></div><div className="space-y-2">{tempScopes.map(scope => (<div key={scope.id} className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm"><div className="flex-1"><div className="font-bold text-slate-800">{scope.disciplineName} {scope.chapterName && `/ ${scope.chapterName}`}</div></div><div className="flex items-center gap-4"><Badge color="blue">{scope.questionCount} qts</Badge><button onClick={() => setTempScopes(tempScopes.filter(s => s.id !== scope.id))} className="text-red-400 hover:text-red-600"><Icons.Trash /></button></div></div>))}</div></div>
            );
            case 3: return (
                <div className="space-y-6 animate-fade-in text-center"><div className="flex justify-center gap-4 mb-6"><button onClick={() => setGenerationMode('AUTO')} className={`px-6 py-4 rounded-xl border-2 w-40 ${generationMode === 'AUTO' ? 'border-brand-blue bg-blue-50 text-brand-blue' : 'border-slate-200 text-slate-500'}`}><Icons.Magic /><span className="font-bold text-sm">Auto</span></button><button onClick={() => setGenerationMode('MANUAL')} className={`px-6 py-4 rounded-xl border-2 w-40 ${generationMode === 'MANUAL' ? 'border-brand-blue bg-blue-50 text-brand-blue' : 'border-slate-200 text-slate-500'}`}><Icons.List /><span className="font-bold text-sm">Manual</span></button></div>{generationMode === 'AUTO' ? (<div><Button onClick={handleAutoGenerate} className="mx-auto mb-6">Gerar Seleção</Button><div className="text-left space-y-3 max-h-96 overflow-y-auto custom-scrollbar pr-2">{generatedQuestions.map((q, i) => (<div key={q.id} className="p-4 bg-white border border-slate-200 rounded-xl text-sm shadow-sm flex gap-3 group"><strong className="text-brand-blue shrink-0">{i+1}.</strong><div className="flex-1" dangerouslySetInnerHTML={{__html: q.enunciado}} /><button onClick={() => setViewingQuestion(q)} className="p-2 text-slate-400 hover:text-brand-blue transition-colors opacity-0 group-hover:opacity-100"><Icons.Eye /></button></div>))}</div></div>) : (<div className="text-left space-y-4"><div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between items-center"><span className="text-sm font-medium">Compatíveis: {availableForManual.length}</span><Badge color="blue">{manualSelectedIds.size} selecionadas</Badge></div><div className="grid gap-3 max-h-[450px] overflow-y-auto custom-scrollbar pr-2">{availableForManual.map((q) => (<div key={q.id} className={`p-4 rounded-xl border transition-all flex gap-4 ${manualSelectedIds.has(q.id) ? 'border-brand-blue bg-blue-50 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'}`}><input type="checkbox" checked={manualSelectedIds.has(q.id)} onChange={() => { const n = new Set(manualSelectedIds); if(n.has(q.id)) n.delete(q.id); else n.add(q.id); setManualSelectedIds(n); }} className="w-5 h-5 mt-1 shrink-0" /><div className="flex-1 cursor-pointer"><div className="text-sm font-medium text-slate-800 line-clamp-2 mb-2" dangerouslySetInnerHTML={{__html: q.enunciado}} /><div className="flex gap-2"><Badge color="blue">{DifficultyLabels[q.difficulty]}</Badge></div></div><button onClick={() => setViewingQuestion(q)} className="p-2 text-slate-400 hover:text-brand-blue self-start"><Icons.Eye /></button></div>))}</div></div>)}</div>
            );
            case 4: 
                const qs = examVersions[activeVersion] || (generationMode === 'AUTO' ? generatedQuestions : allQuestions.filter(q => manualSelectedIds.has(q.id)));
                return (
                <div className="flex h-[70vh] animate-fade-in bg-slate-100 rounded-xl overflow-hidden border border-slate-200 print:h-auto print:block print:border-none print:bg-white"><div className="w-80 bg-white border-r border-slate-200 flex flex-col h-full print:hidden"><div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6"><div><h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Icons.Printer /> Impressão</h4><div className="flex bg-slate-100 p-1 rounded-lg mb-6"><button onClick={() => setViewMode('EXAM')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'EXAM' ? 'bg-white shadow text-brand-blue' : 'text-slate-500'}`}>Prova</button><button onClick={() => setViewMode('ANSWER_SHEET')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'ANSWER_SHEET' ? 'bg-white shadow text-brand-blue' : 'text-slate-500'}`}>Gabarito</button></div>{viewMode === 'EXAM' ? (<div className="space-y-6 animate-fade-in"><div><label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-wider">Versão Anti-Cola</label><div className="grid grid-cols-5 gap-2">{['ORIGINAL','A','B','C','D'].map(v => (<button key={v} onClick={() => setActiveVersion(v as any)} className={`py-1.5 rounded text-[10px] font-bold border transition-all ${activeVersion === v ? 'bg-brand-blue text-white border-brand-blue' : 'bg-white text-slate-600 border-slate-200'}`}>{v}</button>))}</div></div></div>) : null}</div></div><div className="p-4 border-t border-slate-200 bg-slate-50"><Button onClick={() => window.print()} className="w-full justify-center shadow-lg"><Icons.Printer /> Impressão</Button></div></div><div className="flex-1 overflow-y-auto custom-scrollbar p-10 bg-slate-200/50 print:p-0 print:bg-white print:overflow-visible"><div className={`bg-white shadow-2xl mx-auto p-[20mm] w-full max-w-[210mm] min-h-[297mm] text-black print:shadow-none print:w-full print:p-0 ${printSettings.fontSize}`}>{viewMode === 'EXAM' ? (<>{renderHeader()}<div className={`space-y-8 ${editing.columns === 2 ? 'columns-2 gap-10' : ''}`}>{qs.map((q, i) => (
                    <div key={q.id} className="break-inside-avoid mb-6">
                        <div className="flex gap-2">
                            <strong className="shrink-0">{i + 1}.</strong>
                            <div className="inline rich-text-content" dangerouslySetInnerHTML={{__html: q.enunciado}} />
                        </div>
                        {q.type === QuestionType.MULTIPLE_CHOICE && (
                            <div className="mt-3 ml-6 space-y-2">
                                {q.options?.map((opt, idx) => (
                                    <div key={idx} className="flex gap-3">
                                        <span className="font-bold border border-black rounded-full w-5 h-5 flex items-center justify-center text-[10px] shrink-0">{String.fromCharCode(65+idx)}</span>
                                        <span>{opt.text}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}</div>{editing.showAnswerKey && (<div className="mt-12 pt-8 border-t border-black print:break-before-page"><h3 className="font-bold text-lg uppercase mb-4">Gabarito</h3><div className="grid grid-cols-5 gap-6">{qs.map((q, i) => { const c = q.options?.findIndex(o => o.isCorrect) ?? -1; return (<div key={i} className="flex flex-col border border-slate-200 p-2 rounded text-center"><span className="text-[10px] font-bold">Q{i+1}</span><span className="text-xl font-black text-brand-blue">{c >= 0 ? String.fromCharCode(65+c) : '-'}</span></div>); })}</div></div>)}</>) : (<div className="p-8"><h1>Cartão Resposta {editing.title}</h1></div>)}</div></div></div>
                );
            default: return null;
        }
    };

    return (
        <div className="p-8 h-full flex flex-col bg-slate-50 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-6"><div><h2 className="text-3xl font-display font-bold text-slate-800">Minhas Provas</h2><p className="text-slate-500 mt-1">Gerencie suas avaliações.</p></div><div className="flex gap-3"><Select value={selTag} onChange={e => setSelTag(e.target.value)} className="w-48 text-sm"><option value="">Todas Etiquetas</option>{availableTags.map(t => <option key={t} value={t}>{t}</option>)}</Select><Button onClick={() => handleOpenModal()} className="shadow-lg"><Icons.Plus /> Nova Prova</Button></div></div>
            <div className="space-y-3">
                {institutions.map(inst => {
                    const instExams = exams.filter(e => e.institutionId === inst.id && (!selTag || e.tags?.includes(selTag)));
                    if (instExams.length === 0 && selTag) return null;
                    const isExpandedInst = expandedInstitutions[inst.id];
                    return (
                        <div key={inst.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 select-none" onClick={() => toggleInstitution(inst.id)}><div className="flex items-center gap-4"><div className={`transform transition-transform text-slate-400 ${isExpandedInst ? 'rotate-0' : '-rotate-90'}`}><Icons.ChevronDown /></div><div className="flex items-center gap-3"><div className="w-10 h-10 border border-slate-100 rounded-lg p-1 flex items-center justify-center overflow-hidden">{inst.logoUrl ? <img src={inst.logoUrl} className="max-w-full max-h-full" /> : <Icons.Building />}</div><span className="font-bold text-xl text-slate-800 font-display">{inst.name}</span></div></div><Badge color="blue">{instExams.length} provas</Badge></div>
                            {isExpandedInst && (<div className="p-4 pt-0 divide-y divide-slate-100 border-t border-slate-50">{instExams.map(exam => (<div key={exam.id} className="p-4 flex justify-between items-center hover:bg-white transition-colors group"><div className="flex items-center gap-4"><div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-sm ${exam.publicConfig?.isPublished ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-brand-blue'}`}>{exam.publicConfig?.isPublished ? <Icons.Sparkles /> : <Icons.FileText />}</div><div><div className="flex items-center gap-2"><h4 className="font-bold text-slate-800 text-lg">{exam.title}</h4>{exam.publicConfig?.isPublished && <Badge color="green">ONLINE</Badge>}</div><div className="flex items-center gap-2 mt-1"><span className="text-slate-400 text-xs">{new Date(exam.createdAt).toLocaleDateString()} • {exam.questions?.length || 0} qts</span>{exam.tags?.map(t => (<span key={t} className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border bg-white border-${getTagColor(t)}-200 text-${getTagColor(t)}-700`}>{t}</span>))}</div></div></div><div className="flex items-center gap-3"><button onClick={() => navigate('/exam-results', { state: { examId: exam.id } })} className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 font-bold text-sm shadow-sm">Resultados</button><div className="flex gap-1"><button onClick={() => handleOpenModal(exam, 4)} className="p-2 text-slate-400 hover:text-brand-blue hover:bg-blue-50 rounded-lg transition-colors"><Icons.Printer /></button><button onClick={() => handleOpenModal(exam)} className="p-2 text-slate-400 hover:text-brand-blue hover:bg-blue-50 rounded-lg transition-colors"><Icons.Edit /></button><button onClick={() => handleDelete(exam.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Icons.Trash /></button></div></div></div>))}</div>)}
                        </div>
                    );
                })}
            </div>
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Assistente de Prova" maxWidth="max-w-6xl" footer={<div className="flex justify-between w-full">{currentStep > 1 && <Button variant="ghost" onClick={() => setCurrentStep(s => s - 1)}>Voltar</Button>}<div className="flex gap-2 ml-auto"><Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>{currentStep < 4 ? <Button onClick={() => { if (currentStep === 2 && generationMode === 'AUTO') handleAutoGenerate(); setCurrentStep(s => s + 1); }}>Próximo</Button> : <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar Prova'}</Button>}</div></div>}>{renderStepContent()}</Modal>
            <Modal isOpen={isPublishModalOpen} onClose={() => setIsPublishModalOpen(false)} title="Publicar Prova" maxWidth="max-w-2xl" footer={<Button onClick={handleSavePublish} disabled={saving}>Salvar</Button>}><div className="space-y-6"><Input label="Início" type="datetime-local" value={publishConfig.startDate} onChange={e => setPublishConfig({...publishConfig, startDate: e.target.value})} /><Input label="Fim" type="datetime-local" value={publishConfig.endDate} onChange={e => setPublishConfig({...publishConfig, endDate: e.target.value})} /></div></Modal>
            {viewingQuestion && (
                <Modal isOpen={!!viewingQuestion} onClose={() => setViewingQuestion(null)} title="Visualizar Questão" maxWidth="max-w-3xl">
                    <div className="prose prose-slate max-w-none mb-6" dangerouslySetInnerHTML={{__html: viewingQuestion.enunciado}} />
                    {viewingQuestion.type === QuestionType.MULTIPLE_CHOICE && (
                        <div className="space-y-2">
                            {viewingQuestion.options?.map((opt, i) => (
                                <div key={i} className={`p-3 rounded-lg border flex gap-3 ${opt.isCorrect ? 'bg-green-50 border-green-200' : 'bg-white'}`}>
                                    <span className="font-bold">{String.fromCharCode(65+i)}</span>
                                    <span>{opt.text}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </Modal>
            )}
        </div>
    );
};

export default ExamsPage;
