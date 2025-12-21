import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Exam, Institution, SchoolClass, Discipline, Question, ExamContentScope, QuestionType, PublicExamConfig } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { Button, Modal, Select, Input, Badge, RichTextEditor } from '../components/UI';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';

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
    
    const [printSettings, setPrintSettings] = useState({ 
        fontSize: 'text-sm', 
        showName: true, 
        showDate: true, 
        showClass: true, 
        showScore: true 
    });

    const [expandedInstitutions, setExpandedInstitutions] = useState<Record<string, boolean>>({});

    // Fix: Added missing availableTags memoization to extract all unique tags from exams list
    const availableTags = useMemo(() => {
        const tags = new Set<string>();
        exams.forEach(e => e.tags?.forEach(t => tags.add(t)));
        return Array.from(tags).sort();
    }, [exams]);

    useEffect(() => { if (user) load(); }, [user]);
    
    useEffect(() => {
        if (currentStep === 4) generateVersions();
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

    const finalQuestionsToSave = useMemo<Question[]>(() => {
        if (generationMode === 'AUTO') return generatedQuestions;
        return allQuestions.filter(q => manualSelectedIds.has(q.id));
    }, [generationMode, generatedQuestions, allQuestions, manualSelectedIds]);

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
        const sourceArray = finalQuestionsToSave;
        if (sourceArray.length === 0) return;
        const baseQuestions = sourceArray.map(q => safeCloneQuestion(q));
        const versions: Record<string, Question[]> = {};
        versions['ORIGINAL'] = [...baseQuestions];
        ['A', 'B', 'C', 'D'].forEach(ver => {
            // Fix: Explicitly typed shuffleArray and map parameter as Question to fix line 130 'unknown' type inference error
            versions[ver] = shuffleArray<Question>(baseQuestions).map((q: Question) => {
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
            setSelectedDisc(''); setSelectedChap(''); setSelectedUnit(''); setSelectedTopic('');
        }
        setCurrentStep(startAtStep); setIsModalOpen(true);
    };

    const handleAddScope = () => {
        if (!selectedDisc) return;
        const disc = hierarchy.find(d => d.id === selectedDisc);
        const chap = disc?.chapters.find(c => c.id === selectedChap);
        const unit = chap?.units.find(u => u.id === selectedUnit);
        const topic = unit?.topics.find(t => t.id === selectedTopic);
        
        setTempScopes([...tempScopes, { 
            id: Date.now().toString(), 
            disciplineId: selectedDisc, 
            disciplineName: disc?.name || '', 
            chapterId: selectedChap || undefined, 
            chapterName: chap?.name,
            unitId: selectedUnit || undefined,
            unitName: unit?.name,
            topicId: selectedTopic || undefined,
            topicName: topic?.name,
            questionCount: questionsCount 
        }]);
    };

    const handleAutoGenerate = () => {
        const finalQuestions: Question[] = [];
        tempScopes.forEach(scope => {
            const scopeQs = allQuestions.filter(q => {
                return q.disciplineId === scope.disciplineId && 
                       (!scope.chapterId || q.chapterId === scope.chapterId) && 
                       (!scope.unitId || q.unitId === scope.unitId) && 
                       (!scope.topicId || q.topicId === scope.topicId);
            });
            const selected = shuffleArray<Question>(scopeQs).slice(0, scope.questionCount);
            finalQuestions.push(...selected);
        });
        const seenIds = new Set<string>();
        const uniqueQuestions: Question[] = [];
        for (const q of finalQuestions) { if (!seenIds.has(q.id)) { seenIds.add(q.id); uniqueQuestions.push(q); } }
        setGeneratedQuestions(uniqueQuestions);
    };

    const handleSave = useCallback(async () => {
        if(!editing.title) return alert('Título obrigatório'); 
        setSaving(true);
        setTimeout(async () => {
            try { 
                await FirebaseService.saveExam({ ...editing, questions: finalQuestionsToSave, contentScopes: tempScopes, createdAt: editing.createdAt || new Date().toISOString() } as Exam); 
                setIsModalOpen(false); load(); 
            } finally { setSaving(false); }
        }, 30);
    }, [editing, finalQuestionsToSave, tempScopes, load]);

    // Fix: Added missing handleDelete function to support exam removal
    const handleDelete = async (id: string) => {
        if (confirm('Tem certeza que deseja excluir esta prova permanentemente?')) {
            await FirebaseService.deleteExam(id);
            load();
        }
    };

    // --- RENDER HELPERS ---

    const renderStepIndicator = () => {
        const steps = [
            { n: 1, label: 'Configuração', icon: <Icons.Settings /> },
            { n: 2, label: 'Conteúdo', icon: <Icons.BookOpen /> },
            { n: 3, label: 'Seleção', icon: <Icons.Filter /> },
            { n: 4, label: 'Revisão', icon: <Icons.Check /> }
        ];
        return (
            <div className="flex justify-between items-center mb-8 px-10 relative">
                <div className="absolute top-1/2 left-10 right-10 h-0.5 bg-slate-200 -translate-y-1/2 z-0"></div>
                {steps.map((s) => (
                    <div key={s.n} className="relative z-10 flex flex-col items-center gap-2">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all border-2 ${currentStep >= s.n ? 'bg-brand-blue border-brand-blue text-white shadow-lg scale-110' : 'bg-white border-slate-200 text-slate-400'}`}>
                            {currentStep > s.n ? <Icons.Check /> : s.n}
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-tighter ${currentStep >= s.n ? 'text-brand-blue' : 'text-slate-400'}`}>{s.label}</span>
                    </div>
                ))}
            </div>
        );
    };

    const renderHeaderPreview = () => {
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
                <div className="space-y-6 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <Input label="Título da Prova" value={editing.title || ''} onChange={e => setEditing({...editing, title: e.target.value})} placeholder="Ex: Avaliação Bimestral de Matemática" />
                            <div className="grid grid-cols-2 gap-4">
                                <Select label="Instituição" value={editing.institutionId || ''} onChange={e => setEditing({...editing, institutionId: e.target.value, classId: ''})}><option value="">Selecione...</option>{institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</Select>
                                <Select label="Turma" value={editing.classId || ''} onChange={e => setEditing({...editing, classId: e.target.value})} disabled={!editing.institutionId}><option value="">Selecione...</option>{classes.filter(c => c.institutionId === editing.institutionId).map(c => <option key={c.id} value={c.id}>{c.name} ({c.year})</option>)}</Select>
                            </div>
                            <Input label="Cabeçalho (Subtítulo)" value={editing.headerText || ''} onChange={e => setEditing({...editing, headerText: e.target.value})} placeholder="Ex: Conteúdo: Frações e Equações" />
                        </div>
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                            <label className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><Icons.Filter /> Organização & Etiquetas</label>
                            <div className="flex gap-2 mb-4">
                                <input type="text" className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-blue" value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="Adicionar etiqueta..." onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), setEditing({...editing, tags: [...(editing.tags || []), tagInput.trim()]}), setTagInput(''))}/>
                                <Button onClick={() => {setEditing({...editing, tags: [...(editing.tags || []), tagInput.trim()]}); setTagInput('');}} variant="secondary" className="px-4">ADD</Button>
                            </div>
                            <div className="flex flex-wrap gap-2">{editing.tags?.map(t => (<span key={t} className={`flex items-center gap-2 text-xs font-black px-3 py-1.5 rounded-full bg-${getTagColor(t)}-100 text-${getTagColor(t)}-800 border border-${getTagColor(t)}-200 shadow-sm`}>{t}<button onClick={() => setEditing({...editing, tags: (editing.tags || []).filter(tg => tg !== t)})}><Icons.X /></button></span>))}</div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-8">
                        <div>
                            <label className="text-sm font-bold text-slate-700 mb-4 block uppercase tracking-widest">Layout da Prova</label>
                            <div className="flex gap-6">
                                <button onClick={() => setEditing({...editing, columns: 1})} className={`flex-1 p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${editing.columns === 1 ? 'border-brand-blue bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 hover:border-slate-300'}`}>
                                    <div className="w-16 h-20 border-2 border-slate-400 rounded p-2 flex flex-col gap-1">
                                        <div className="w-full h-1 bg-slate-300"></div><div className="w-full h-1 bg-slate-300"></div><div className="w-full h-1 bg-slate-300"></div>
                                    </div>
                                    <span className="text-xs font-black uppercase">Uma Coluna</span>
                                </button>
                                <button onClick={() => setEditing({...editing, columns: 2})} className={`flex-1 p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${editing.columns === 2 ? 'border-brand-blue bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 hover:border-slate-300'}`}>
                                    <div className="w-16 h-20 border-2 border-slate-400 rounded p-2 flex gap-1">
                                        <div className="flex-1 flex flex-col gap-1"><div className="w-full h-1 bg-slate-300"></div><div className="w-full h-1 bg-slate-300"></div></div>
                                        <div className="flex-1 flex flex-col gap-1"><div className="w-full h-1 bg-slate-300"></div><div className="w-full h-1 bg-slate-300"></div></div>
                                    </div>
                                    <span className="text-xs font-black uppercase">Duas Colunas</span>
                                </button>
                            </div>
                        </div>
                        <div className="flex flex-col justify-center gap-4">
                            <label className="flex items-center gap-3 p-5 border-2 border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-50 transition-colors">
                                <input type="checkbox" checked={editing.showAnswerKey || false} onChange={e => setEditing({...editing, showAnswerKey: e.target.checked})} className="w-6 h-6 text-brand-blue rounded border-slate-300" />
                                <div><span className="text-sm font-black text-slate-700 uppercase">Imprimir Cartão-Resposta</span><p className="text-[10px] text-slate-400 font-bold">Gera uma folha extra para leitura automática via IA.</p></div>
                            </label>
                        </div>
                    </div>
                    <RichTextEditor label="Instruções Gerais (Exibidas no início da prova)" value={editing.instructions || ''} onChange={html => setEditing({...editing, instructions: html})} />
                </div>
            );
            case 2: 
                const d = hierarchy.find(x => x.id === selectedDisc);
                const c = d?.chapters.find(x => x.id === selectedChap);
                const u = c?.units.find(x => x.id === selectedUnit);
                return (
                <div className="space-y-6 animate-fade-in">
                    <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200">
                        <h4 className="text-sm font-black text-slate-700 mb-6 uppercase tracking-widest flex items-center gap-2"><Icons.BookOpen /> Definir Escopo de Conteúdo</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <Select label="Disciplina" value={selectedDisc} onChange={e => { setSelectedDisc(e.target.value); setSelectedChap(''); setSelectedUnit(''); setSelectedTopic(''); }}>
                                <option value="">Selecione...</option>
                                {hierarchy.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </Select>
                            <Select label="Capítulo" value={selectedChap} onChange={e => { setSelectedChap(e.target.value); setSelectedUnit(''); setSelectedTopic(''); }} disabled={!selectedDisc}>
                                <option value="">Todos os Capítulos</option>
                                {d?.chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </Select>
                            <Select label="Unidade" value={selectedUnit} onChange={e => { setSelectedUnit(e.target.value); setSelectedTopic(''); }} disabled={!selectedChap}>
                                <option value="">Todas as Unidades</option>
                                {c?.units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </Select>
                            <Select label="Tópico" value={selectedTopic} onChange={e => setSelectedTopic(e.target.value)} disabled={!selectedUnit}>
                                <option value="">Todos os Tópicos</option>
                                {u?.topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </Select>
                        </div>
                        <div className="flex gap-4 items-end mt-6 pt-6 border-t border-slate-200">
                            <Input label="Qtd. Questões" type="number" min="1" value={questionsCount} onChange={e => setQuestionsCount(parseInt(e.target.value))} className="w-40" />
                            <Button onClick={handleAddScope} disabled={!selectedDisc} className="flex-1 h-11 text-base shadow-md font-bold">+ Adicionar ao Planejamento</Button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {tempScopes.map(scope => (
                            <div key={scope.id} className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm group">
                                <div className="flex-1 overflow-hidden">
                                    <div className="font-black text-slate-800 truncate">{scope.disciplineName}</div>
                                    <div className="text-[10px] text-slate-400 font-bold uppercase truncate">
                                        {scope.chapterName || 'Geral'} {scope.unitName && ` > ${scope.unitName}`} {scope.topicName && ` > ${scope.topicName}`}
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <Badge color="blue">{scope.questionCount} qts</Badge>
                                    <button onClick={() => setTempScopes(tempScopes.filter(s => s.id !== scope.id))} className="text-slate-300 hover:text-red-500 transition-colors"><Icons.Trash /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
            case 3: return (
                <div className="space-y-10 animate-fade-in max-w-4xl mx-auto">
                    <div className="bg-white rounded-3xl border-4 border-slate-100 p-8 shadow-2xl">
                        <h4 className="text-center font-black text-slate-800 text-xl mb-8 uppercase tracking-widest">Como deseja selecionar as questões?</h4>
                        <div className="flex justify-center gap-8 mb-10">
                            <button onClick={() => setGenerationMode('AUTO')} className={`flex flex-col items-center gap-4 p-8 rounded-3xl border-4 transition-all w-64 ${generationMode === 'AUTO' ? 'border-brand-blue bg-blue-50 shadow-xl scale-105' : 'border-slate-100 grayscale opacity-60 hover:grayscale-0'}`}>
                                <div className="w-20 h-20 bg-brand-blue rounded-2xl flex items-center justify-center text-white text-4xl shadow-lg"><Icons.Magic /></div>
                                <div className="text-center">
                                    <span className="font-black text-lg block text-brand-blue">AUTOMÁTICO</span>
                                    <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase">A IA escolhe as melhores questões para você.</p>
                                </div>
                            </button>
                            <button onClick={() => setGenerationMode('MANUAL')} className={`flex flex-col items-center gap-4 p-8 rounded-3xl border-4 transition-all w-64 ${generationMode === 'MANUAL' ? 'border-brand-blue bg-blue-50 shadow-xl scale-105' : 'border-slate-100 grayscale opacity-60 hover:grayscale-0'}`}>
                                <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center text-white text-4xl shadow-lg"><Icons.List /></div>
                                <div className="text-center">
                                    <span className="font-black text-lg block text-slate-800">MANUAL</span>
                                    <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase">Você escolhe uma a uma do seu acervo.</p>
                                </div>
                            </button>
                        </div>

                        {generationMode === 'AUTO' ? (
                            <div className="animate-fade-in">
                                <Button onClick={handleAutoGenerate} className="mx-auto h-16 px-10 text-xl font-black shadow-xl shadow-blue-200 mb-8 border-4 border-white">GERAR SELEÇÃO INTELIGENTE</Button>
                                <div className="grid gap-3 max-h-80 overflow-y-auto custom-scrollbar pr-4">
                                    {generatedQuestions.map((q, i) => (
                                        <div key={q.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm shadow-sm flex gap-4 group">
                                            <strong className="text-brand-blue shrink-0 w-6 h-6 bg-white rounded-full flex items-center justify-center border border-slate-200 text-xs">{i+1}</strong>
                                            <div className="flex-1 line-clamp-1 font-medium text-slate-700" dangerouslySetInnerHTML={{__html: q.enunciado}} />
                                            <button onClick={() => setViewingQuestion(q)} className="text-slate-400 hover:text-brand-blue"><Icons.Eye /></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="animate-fade-in space-y-4">
                                <div className="bg-slate-800 text-white p-4 rounded-2xl flex justify-between items-center shadow-lg">
                                    <span className="text-sm font-black uppercase tracking-widest">Questões Compatíveis: {availableForManual.length}</span>
                                    <Badge color="blue">{manualSelectedIds.size} SELECIONADAS</Badge>
                                </div>
                                <div className="grid gap-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                                    {availableForManual.map((q) => (
                                        <div key={q.id} className={`p-4 rounded-2xl border-2 transition-all flex gap-4 ${manualSelectedIds.has(q.id) ? 'border-brand-blue bg-blue-50 shadow-inner' : 'bg-white border-slate-100 hover:border-slate-200'}`}>
                                            <input type="checkbox" checked={manualSelectedIds.has(q.id)} onChange={() => { const n = new Set(manualSelectedIds); if(n.has(q.id)) n.delete(q.id); else n.add(q.id); setManualSelectedIds(n); }} className="w-6 h-6 mt-1 shrink-0 rounded text-brand-blue" />
                                            <div className="flex-1 cursor-pointer" onClick={() => { const n = new Set(manualSelectedIds); if(n.has(q.id)) n.delete(q.id); else n.add(q.id); setManualSelectedIds(n); }}>
                                                <div className="text-sm font-bold text-slate-800 line-clamp-2 mb-2" dangerouslySetInnerHTML={{__html: q.enunciado}} />
                                                <div className="flex gap-2"><Badge color="blue">{DifficultyLabels[q.difficulty]}</Badge></div>
                                            </div>
                                            <button onClick={() => setViewingQuestion(q)} className="p-2 text-slate-300 hover:text-brand-blue self-start"><Icons.Eye /></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            );
            case 4: 
                const qs = examVersions[activeVersion] || finalQuestionsToSave;
                return (
                <div className="flex h-[75vh] animate-fade-in bg-slate-100 rounded-3xl overflow-hidden border border-slate-200 print:h-auto print:block print:border-none print:bg-white">
                    <div className="w-80 bg-white border-r border-slate-200 flex flex-col h-full print:hidden">
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                            <div>
                                <h4 className="font-black text-slate-800 mb-4 flex items-center gap-2 uppercase text-xs tracking-widest"><Icons.Printer /> Opções de Impressão</h4>
                                <div className="flex bg-slate-100 p-1 rounded-xl mb-6 shadow-inner">
                                    <button onClick={() => setViewMode('EXAM')} className={`flex-1 py-2 text-xs font-black rounded-lg transition-all uppercase tracking-tighter ${viewMode === 'EXAM' ? 'bg-white shadow text-brand-blue' : 'text-slate-500'}`}>Prova</button>
                                    <button onClick={() => setViewMode('ANSWER_SHEET')} className={`flex-1 py-2 text-xs font-black rounded-lg transition-all uppercase tracking-tighter ${viewMode === 'ANSWER_SHEET' ? 'bg-white shadow text-brand-blue' : 'text-slate-500'}`}>Cartão-Resposta</button>
                                </div>
                                
                                {viewMode === 'EXAM' ? (
                                    <div className="space-y-6 animate-fade-in">
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block tracking-widest">Modelos Anti-Cola (Embaralhados)</label>
                                            <div className="grid grid-cols-5 gap-2">
                                                {['ORIGINAL','A','B','C','D'].map(v => (<button key={v} onClick={() => setActiveVersion(v as any)} className={`py-2 rounded-lg text-[10px] font-black border-2 transition-all ${activeVersion === v ? 'bg-brand-blue text-white border-brand-blue shadow-lg' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'}`}>{v}</button>))}
                                            </div>
                                        </div>
                                        <div className="space-y-4 pt-4 border-t border-slate-100">
                                            <label className="text-[10px] font-black text-slate-400 uppercase block tracking-widest mb-2">Cabeçalho da Prova</label>
                                            {[
                                                { k: 'showName', l: 'Nome do Aluno' },
                                                { k: 'showClass', l: 'Turma' },
                                                { k: 'showDate', l: 'Data' },
                                                { k: 'showScore', l: 'Campo de Nota' }
                                            ].map(opt => (
                                                <label key={opt.k} className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                                                    <input type="checkbox" checked={(printSettings as any)[opt.k]} onChange={e => setPrintSettings({...printSettings, [opt.k]: e.target.checked})} className="rounded text-brand-blue" />
                                                    {opt.l}
                                                </label>
                                            ))}
                                        </div>
                                        <div className="pt-4 border-t border-slate-100">
                                            <label className="text-[10px] font-black text-slate-400 uppercase block tracking-widest mb-3">Tamanho da Fonte</label>
                                            <Select value={printSettings.fontSize} onChange={e => setPrintSettings({...printSettings, fontSize: e.target.value})}>
                                                <option value="text-[10pt]">Pequena (10pt)</option>
                                                <option value="text-[12pt]">Padrão (12pt)</option>
                                                <option value="text-[14pt]">Grande (14pt)</option>
                                                <option value="text-[16pt]">Extra Grande (16pt)</option>
                                            </Select>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-[10px] text-blue-700 font-bold leading-relaxed">
                                        <Icons.Magic /> O Cartão-Resposta gerado contém âncoras para que você possa escanear e corrigir automaticamente via App.
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-200 bg-slate-50"><Button onClick={() => window.print()} className="w-full justify-center shadow-xl h-12 font-black"><Icons.Printer /> IMPRIMIR AGORA</Button></div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-10 bg-slate-300/40 print:p-0 print:bg-white print:overflow-visible">
                        <div className={`bg-white shadow-2xl mx-auto p-[20mm] w-full max-w-[210mm] min-h-[297mm] text-black print:shadow-none print:w-full print:p-0 ${printSettings.fontSize}`}>
                            {viewMode === 'EXAM' ? (
                                <>
                                    {renderHeaderPreview()}
                                    {editing.instructions && <div className="mb-8 p-4 border border-gray-300 rounded text-sm italic rich-text-content" dangerouslySetInnerHTML={{__html: editing.instructions}} />}
                                    <div className={`space-y-8 ${editing.columns === 2 ? 'columns-2 gap-12' : ''}`}>
                                        {qs.map((q, i) => (
                                            <div key={q.id} className="break-inside-avoid mb-8">
                                                <div className="flex gap-3">
                                                    <strong className="shrink-0 font-bold">{i + 1}.</strong>
                                                    <div className="inline rich-text-content" dangerouslySetInnerHTML={{__html: q.enunciado}} />
                                                </div>
                                                {q.type === QuestionType.MULTIPLE_CHOICE && (
                                                    <div className="mt-4 ml-8 space-y-2">
                                                        {q.options?.map((opt, idx) => (
                                                            <div key={idx} className="flex gap-4">
                                                                <span className="font-bold border border-black rounded-full w-6 h-6 flex items-center justify-center text-[11px] shrink-0">{String.fromCharCode(65+idx)}</span>
                                                                <span className="flex-1">{opt.text}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {(q.type === QuestionType.SHORT_ANSWER) && <div className="mt-4 ml-8 border-b border-gray-300 h-24"></div>}
                                            </div>
                                        ))}
                                    </div>
                                    {editing.showAnswerKey && (
                                        <div className="mt-16 pt-12 border-t-2 border-dashed border-gray-300 print:break-before-page">
                                            <h3 className="font-black text-xl uppercase mb-6 text-center tracking-widest">Gabarito para o Professor</h3>
                                            <div className="grid grid-cols-5 gap-4">
                                                {qs.map((q, i) => { 
                                                    const c = q.options?.findIndex(o => o.isCorrect) ?? -1; 
                                                    return (<div key={i} className="flex flex-col border-2 border-slate-200 p-3 rounded-xl text-center"><span className="text-[10px] font-black text-slate-400 uppercase">Questão {i+1}</span><span className="text-2xl font-black text-brand-blue">{c >= 0 ? String.fromCharCode(65+c) : '---'}</span></div>); 
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="flex flex-col h-full">
                                    <div className="flex justify-between items-center border-b-4 border-black pb-4 mb-8">
                                        <div><h1 className="text-3xl font-black uppercase tracking-tighter">Cartão-Resposta</h1><p className="font-bold text-lg">{editing.title}</p></div>
                                        <div className="w-16 h-16 bg-black"></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-20 gap-y-6">
                                        {qs.map((q, i) => (
                                            <div key={i} className="flex items-center gap-4 py-2 border-b border-slate-100">
                                                <span className="font-black text-lg w-8">{String(i+1).padStart(2, '0')}</span>
                                                {q.type === QuestionType.MULTIPLE_CHOICE ? (
                                                    <div className="flex gap-3">
                                                        {['A','B','C','D','E'].map(L => (
                                                            <div key={L} className="flex flex-col items-center gap-1">
                                                                <span className="text-[8px] font-bold">{L}</span>
                                                                <div className="w-7 h-7 rounded-full border-2 border-black flex items-center justify-center"></div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="flex-1 bg-slate-100 rounded px-3 py-1 text-[10px] font-bold uppercase text-slate-500">[ DISSERTATIVA ]</div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-auto pt-10 border-t-2 border-slate-200 flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                                        <span>ID PROVA: {editing.id?.slice(0,8)}</span>
                                        <span>ÂNCORES PARA LEITURA ÓPTICA</span>
                                        <span>PF-SCANNER-V1</span>
                                    </div>
                                    {/* Âncoras visuais nos cantos para o Scanner */}
                                    <div className="fixed top-0 left-0 w-4 h-4 bg-black"></div><div className="fixed top-0 right-0 w-4 h-4 bg-black"></div><div className="fixed bottom-0 left-0 w-4 h-4 bg-black"></div><div className="fixed bottom-0 right-0 w-4 h-4 bg-black"></div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
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
                            <div className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 select-none" onClick={() => setExpandedInstitutions(prev => ({ ...prev, [inst.id]: !prev[inst.id] }))}><div className="flex items-center gap-4"><div className={`transform transition-transform text-slate-400 ${isExpandedInst ? 'rotate-0' : '-rotate-90'}`}><Icons.ChevronDown /></div><div className="flex items-center gap-3"><div className="w-10 h-10 border border-slate-100 rounded-lg p-1 flex items-center justify-center overflow-hidden">{inst.logoUrl ? <img src={inst.logoUrl} className="max-w-full max-h-full" /> : <Icons.Building />}</div><span className="font-bold text-xl text-slate-800 font-display">{inst.name}</span></div></div><Badge color="blue">{instExams.length} provas</Badge></div>
                            {isExpandedInst && (<div className="p-4 pt-0 divide-y divide-slate-100 border-t border-slate-50">{instExams.map(exam => (<div key={exam.id} className="p-4 flex justify-between items-center hover:bg-white transition-colors group"><div className="flex items-center gap-4"><div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-sm ${exam.publicConfig?.isPublished ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-brand-blue'}`}>{exam.publicConfig?.isPublished ? <Icons.Sparkles /> : <Icons.FileText />}</div><div><div className="flex items-center gap-2"><h4 className="font-bold text-slate-800 text-lg">{exam.title}</h4>{exam.publicConfig?.isPublished && <Badge color="green">ONLINE</Badge>}</div><div className="flex items-center gap-2 mt-1"><span className="text-slate-400 text-xs">{new Date(exam.createdAt).toLocaleDateString()} • {exam.questions?.length || 0} qts</span>{exam.tags?.map(t => (<span key={t} className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border bg-white border-${getTagColor(t)}-200 text-${getTagColor(t)}-700`}>{t}</span>))}</div></div></div><div className="flex items-center gap-3"><button onClick={() => navigate('/exam-results', { state: { examId: exam.id } })} className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 font-bold text-sm shadow-sm">Resultados</button><div className="flex gap-1"><button onClick={() => handleOpenModal(exam, 4)} className="p-2 text-slate-400 hover:text-brand-blue hover:bg-blue-50 rounded-lg transition-colors"><Icons.Printer /></button><button onClick={() => handleOpenModal(exam)} className="p-2 text-slate-400 hover:text-brand-blue hover:bg-blue-50 rounded-lg transition-colors"><Icons.Edit /></button><button onClick={() => handleDelete(exam.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Icons.Trash /></button></div></div></div>))}</div>)}
                        </div>
                    );
                })}
            </div>
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Assistente de Prova Inteligente" maxWidth="max-w-6xl" footer={<div className="flex justify-between w-full">{currentStep > 1 && <Button variant="ghost" onClick={() => setCurrentStep(s => s - 1)}>Voltar</Button>}<div className="flex gap-2 ml-auto"><Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>{currentStep < 4 ? <Button onClick={() => { if (currentStep === 2 && generationMode === 'AUTO') handleAutoGenerate(); setCurrentStep(s => s + 1); }}>Próximo</Button> : <Button onClick={handleSave} disabled={saving || finalQuestionsToSave.length === 0}>{saving ? 'Salvando...' : 'Finalizar & Salvar'}</Button>}</div></div>}>
                {renderStepIndicator()}
                {renderStepContent()}
            </Modal>
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