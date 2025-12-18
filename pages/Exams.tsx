
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

const ExamsPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

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
    const [saving, setSaving] = useState(false);
    
    // Publishing Modal states
    const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
    const [publishingExam, setPublishingExam] = useState<Exam | null>(null);
    const [publishConfig, setPublishConfig] = useState<PublicExamConfig>({
        isPublished: false,
        startDate: '',
        endDate: '',
        timeLimitMinutes: 0,
        allowedAttempts: 1,
        randomizeQuestions: true,
        requireIdentifier: false,
        showFeedback: true
    });

    // Step 2 State
    const [selectedDisc, setSelectedDisc] = useState('');
    const [selectedChap, setSelectedChap] = useState('');
    const [selectedUnit, setSelectedUnit] = useState('');
    const [selectedTopic, setSelectedTopic] = useState('');
    const [questionsCount, setQuestionsCount] = useState(1);
    const [tempScopes, setTempScopes] = useState<ExamContentScope[]>([]);

    // Step 3 State
    const [generationMode, setGenerationMode] = useState<'MANUAL' | 'AUTO'>('AUTO');
    const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);
    const [manualSelectedIds, setManualSelectedIds] = useState<Set<string>>(new Set());
    const [viewingQuestion, setViewingQuestion] = useState<Question | null>(null);

    // Step 4 Printing State
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

    // Accordion States
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

    const availableForManual = useMemo(() => {
        if (tempScopes.length === 0) return [];
        const base = allQuestions.filter(q => {
            return tempScopes.some(scope => {
                const matchDisc = q.disciplineId === scope.disciplineId;
                const matchChap = !scope.chapterId || q.chapterId === scope.chapterId;
                const matchUnit = !scope.unitId || q.unitId === scope.unitId;
                const matchTopic = !scope.topicId || q.topicId === scope.topicId;
                return matchDisc && matchChap && matchUnit && matchTopic;
            });
        });

        return [...base].sort((a, b) => {
            const aSel = manualSelectedIds.has(a.id) ? 1 : 0;
            const bSel = manualSelectedIds.has(b.id) ? 1 : 0;
            return bSel - aSel;
        });
    }, [allQuestions, tempScopes, manualSelectedIds]);

    const shuffleArray = <T extends unknown>(array: T[]): T[] => {
        const newArr = [...array];
        for (let i = newArr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
        }
        return newArr;
    };

    const generateVersions = () => {
        const baseQuestions = generationMode === 'AUTO' 
            ? generatedQuestions 
            : allQuestions.filter(q => manualSelectedIds.has(q.id));

        const versions: Record<string, Question[]> = {};
        versions['ORIGINAL'] = [...baseQuestions];
        ['A', 'B', 'C', 'D'].forEach(ver => {
            let shuffledQs = shuffleArray(baseQuestions).map(q => {
                let newQ = JSON.parse(JSON.stringify(q));
                if (newQ.type === QuestionType.MULTIPLE_CHOICE && newQ.options) {
                    newQ.options = shuffleArray(newQ.options);
                }
                return newQ;
            });
            versions[ver] = shuffledQs;
        });
        setExamVersions(versions);
        setActiveVersion('ORIGINAL');
    };

    const handleOpenModal = (exam?: Exam) => {
        if (exam) {
            setEditing(exam);
            setTempScopes(exam.contentScopes || []);
            setGeneratedQuestions(exam.questions || []);
            setManualSelectedIds(new Set(exam.questions.map(q => q.id)));
            setGenerationMode('MANUAL');
        } else {
            setEditing({ columns: 1, showAnswerKey: false, institutionId: user?.institutionId || '' });
            setTempScopes([]);
            setGeneratedQuestions([]);
            setManualSelectedIds(new Set());
            setGenerationMode('AUTO');
        }
        setCurrentStep(1);
        setViewMode('EXAM');
        setIsModalOpen(true);
    };

    const openPublishModal = (exam: Exam) => {
        setPublishingExam(exam);
        const now = new Date();
        const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        
        if (exam.publicConfig) {
            setPublishConfig(exam.publicConfig);
        } else {
            setPublishConfig({
                isPublished: true,
                startDate: now.toISOString().slice(0, 16),
                endDate: nextWeek.toISOString().slice(0, 16),
                timeLimitMinutes: 60,
                allowedAttempts: 1,
                randomizeQuestions: true,
                requireIdentifier: false,
                showFeedback: true
            });
        }
        setIsPublishModalOpen(true);
    };

    const handleSavePublish = async () => {
        if (!publishingExam) return;
        setSaving(true);
        try {
            await FirebaseService.saveExam({
                ...publishingExam,
                publicConfig: publishConfig
            });
            setIsPublishModalOpen(false);
            load();
        } catch (e) {
            console.error(e);
            alert("Erro ao publicar prova.");
        } finally {
            setSaving(false);
        }
    };

    const handleAddScope = () => {
        if (!selectedDisc) return;
        const disc = hierarchy.find(d => d.id === selectedDisc);
        const chap = disc?.chapters.find(c => c.id === selectedChap);
        const unit = chap?.units.find(u => u.id === selectedUnit);
        const topic = unit?.topics.find(t => t.id === selectedTopic);

        const newScope: ExamContentScope = {
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
        };
        setTempScopes([...tempScopes, newScope]);
        setQuestionsCount(1);
    };

    const handleAutoGenerate = () => {
        let finalQuestions: Question[] = [];
        tempScopes.forEach(scope => {
            const scopeQs = allQuestions.filter(q => {
                const matchDisc = q.disciplineId === scope.disciplineId;
                const matchChap = !scope.chapterId || q.chapterId === scope.chapterId;
                const matchUnit = !scope.unitId || q.unitId === scope.unitId;
                const matchTopic = !scope.topicId || q.topicId === scope.topicId;
                return matchDisc && matchChap && matchUnit && matchTopic;
            });
            const shuffled = [...scopeQs].sort(() => 0.5 - Math.random());
            finalQuestions = [...finalQuestions, ...shuffled.slice(0, scope.questionCount)];
        });
        const uniqueQuestions = Array.from(new Set(finalQuestions.map(q => q.id)))
            .map(id => finalQuestions.find(q => q.id === id)!);
        setGeneratedQuestions(uniqueQuestions);
    };

    const toggleManualQuestion = (id: string) => {
        const next = new Set(manualSelectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setManualSelectedIds(next);
    };

    const handleSave = async () => {
        if(!editing.title) return alert('Título obrigatório');
        setSaving(true);
        const finalQs = generationMode === 'AUTO' 
            ? generatedQuestions 
            : allQuestions.filter(q => manualSelectedIds.has(q.id));

        try {
            await FirebaseService.saveExam({
                ...editing,
                questions: finalQs,
                contentScopes: tempScopes,
                createdAt: editing.createdAt || new Date().toISOString()
            } as Exam);
            setIsModalOpen(false);
            load();
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (id: string) => {
        if (confirm('Excluir prova?')) FirebaseService.deleteExam(id).then(load);
    };

    const toggleInstitution = (id: string) => setExpandedInstitutions(prev => ({ ...prev, [id]: !prev[id] }));
    const toggleYear = (id: string) => setExpandedYears(prev => ({ ...prev, [id]: !prev[id] }));
    const toggleClass = (id: string) => setExpandedClasses(prev => ({ ...prev, [id]: !prev[id] }));

    const renderHeader = () => {
        const inst = institutions.find(i => i.id === editing.institutionId);
        const cls = classes.find(c => c.id === editing.classId);
        return (
            <div className="border-b-2 border-black pb-4 mb-8">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold uppercase leading-tight">{inst?.name || 'Instituição'}</h1>
                        <h2 className="text-xl font-bold mt-1">{editing.title}</h2>
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
            case 1:
                return (
                    <div className="space-y-6 animate-fade-in">
                        <Input label="Título da Prova" value={editing.title || ''} onChange={e => setEditing({...editing, title: e.target.value})} placeholder="Ex: Avaliação de História" />
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
                        
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="text-sm font-bold text-slate-700 mb-3 block">Estilo do Layout</label>
                                <div className="flex gap-4">
                                    <button 
                                        onClick={() => setEditing({...editing, columns: 1})}
                                        className={`flex-1 p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${editing.columns === 1 ? 'border-brand-blue bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                                    >
                                        <div className="w-12 h-16 bg-white border border-slate-300 rounded shadow-sm p-2 flex flex-col gap-1.5">
                                            <div className="h-1 w-full bg-slate-200"></div>
                                            <div className="h-1 w-full bg-slate-200"></div>
                                            <div className="h-1 w-full bg-slate-200"></div>
                                            <div className="h-1 w-full bg-slate-200"></div>
                                        </div>
                                        <span className={`text-xs font-bold ${editing.columns === 1 ? 'text-brand-blue' : 'text-slate-500'}`}>Padrão (1 Col)</span>
                                    </button>
                                    <button 
                                        onClick={() => setEditing({...editing, columns: 2})}
                                        className={`flex-1 p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${editing.columns === 2 ? 'border-brand-blue bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                                    >
                                        <div className="w-12 h-16 bg-white border border-slate-300 rounded shadow-sm p-2 flex gap-1">
                                            <div className="flex flex-col gap-1 w-1/2">
                                                <div className="h-1 w-full bg-slate-200"></div>
                                                <div className="h-1 w-full bg-slate-200"></div>
                                                <div className="h-1 w-full bg-slate-200"></div>
                                            </div>
                                            <div className="w-px bg-slate-100 h-full"></div>
                                            <div className="flex flex-col gap-1 w-1/2">
                                                <div className="h-1 w-full bg-slate-200"></div>
                                                <div className="h-1 w-full bg-slate-200"></div>
                                                <div className="h-1 w-full bg-slate-200"></div>
                                            </div>
                                        </div>
                                        <span className={`text-xs font-bold ${editing.columns === 2 ? 'text-brand-blue' : 'text-slate-500'}`}>Economia (2 Col)</span>
                                    </button>
                                </div>
                            </div>
                            <div className="flex flex-col justify-center">
                                <label className="flex items-center gap-3 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                                    <input type="checkbox" checked={editing.showAnswerKey || false} onChange={e => setEditing({...editing, showAnswerKey: e.target.checked})} className="w-5 h-5 text-brand-blue rounded focus:ring-brand-blue" />
                                    <div>
                                        <span className="block text-sm font-bold text-slate-700">Imprimir Gabarito</span>
                                        <span className="block text-xs text-slate-500">Gera uma página extra com as respostas.</span>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <Input label="Cabeçalho (Subtítulo)" value={editing.headerText || ''} onChange={e => setEditing({...editing, headerText: e.target.value})} placeholder="Ex: Professor João Silva" />
                        <RichTextEditor label="Instruções" value={editing.instructions || ''} onChange={html => setEditing({...editing, instructions: html})} />
                    </div>
                );
            case 2:
                const discObj = hierarchy.find(d => d.id === selectedDisc);
                const chapObj = discObj?.chapters.find(c => c.id === selectedChap);
                const unitObj = chapObj?.units.find(u => u.id === selectedUnit);
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                            <h4 className="text-sm font-bold text-slate-700 mb-4 uppercase">Definir Conteúdo</h4>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <Select label="Disciplina" value={selectedDisc} onChange={e => { setSelectedDisc(e.target.value); setSelectedChap(''); setSelectedUnit(''); setSelectedTopic(''); }}>
                                    <option value="">Selecione...</option>
                                    {hierarchy.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </Select>
                                <Select label="Capítulo" value={selectedChap} onChange={e => { setSelectedChap(e.target.value); setSelectedUnit(''); setSelectedTopic(''); }} disabled={!selectedDisc}>
                                    <option value="">Todos os Capítulos</option>
                                    {discObj?.chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <Select label="Unidade" value={selectedUnit} onChange={e => { setSelectedUnit(e.target.value); setSelectedTopic(''); }} disabled={!selectedChap}>
                                    <option value="">Todas as Unidades</option>
                                    {chapObj?.units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </Select>
                                <Select label="Tópico" value={selectedTopic} onChange={e => setSelectedTopic(e.target.value)} disabled={!selectedUnit}>
                                    <option value="">Todos os Tópicos</option>
                                    {unitObj?.topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </Select>
                            </div>
                            <div className="flex gap-4 items-end mt-4">
                                <Input label="Qtd. de Questões" type="number" min="1" value={questionsCount} onChange={e => setQuestionsCount(parseInt(e.target.value))} className="w-40" />
                                <Button onClick={handleAddScope} disabled={!selectedDisc} className="flex-1">+ Adicionar Escopo</Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            {tempScopes.map(scope => (
                                <div key={scope.id} className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex-1">
                                        <div className="font-bold text-slate-800">{scope.disciplineName} {scope.chapterName && `/ ${scope.chapterName}`}</div>
                                        <div className="text-xs text-slate-500">{scope.unitName && `Unidade: ${scope.unitName}`} {scope.topicName && `• Tópico: ${scope.topicName}`}</div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <Badge color="blue">{scope.questionCount} qts</Badge>
                                        <button onClick={() => setTempScopes(tempScopes.filter(s => s.id !== scope.id))} className="text-red-400 hover:text-red-600 transition-colors"><Icons.Trash /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 3:
                return (
                    <div className="space-y-6 animate-fade-in text-center">
                        <div className="flex justify-center gap-4 mb-6">
                            <button onClick={() => setGenerationMode('AUTO')} className={`px-6 py-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all w-40 ${generationMode === 'AUTO' ? 'border-brand-blue bg-blue-50 text-brand-blue shadow-md' : 'border-slate-200 hover:border-slate-300 text-slate-500'}`}><Icons.Magic /><span className="font-bold text-sm">Automático</span></button>
                            <button onClick={() => setGenerationMode('MANUAL')} className={`px-6 py-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all w-40 ${generationMode === 'MANUAL' ? 'border-brand-blue bg-blue-50 text-brand-blue shadow-md' : 'border-slate-200 hover:border-slate-300 text-slate-500'}`}><Icons.List /><span className="font-bold text-sm">Seleção Manual</span></button>
                        </div>
                        {generationMode === 'AUTO' ? (
                            <div>
                                <Button onClick={handleAutoGenerate} className="mx-auto mb-6"><Icons.Refresh /> Gerar Nova Seleção</Button>
                                <div className="text-left space-y-3 max-h-96 overflow-y-auto custom-scrollbar pr-2">
                                    {generatedQuestions.map((q, i) => (
                                        <div key={q.id} className="p-4 bg-white border border-slate-200 rounded-xl text-sm shadow-sm flex gap-3 group">
                                            <strong className="text-brand-blue shrink-0">{i+1}.</strong> 
                                            <div className="flex-1">
                                                <div className="inline line-clamp-2" dangerouslySetInnerHTML={{__html: q.enunciado}} />
                                            </div>
                                            <button onClick={() => setViewingQuestion(q)} className="p-2 text-slate-400 hover:text-brand-blue transition-colors opacity-0 group-hover:opacity-100" title="Visualizar Questão"><Icons.Eye /></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="text-left space-y-4">
                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between items-center">
                                    <span className="text-sm font-medium text-slate-600">Questões compatíveis: <strong>{availableForManual.length}</strong></span>
                                    <Badge color="blue">{manualSelectedIds.size} selecionadas</Badge>
                                </div>
                                <div className="grid gap-3 max-h-[450px] overflow-y-auto custom-scrollbar pr-2">
                                    {availableForManual.map((q) => (
                                        <div key={q.id} className={`p-4 rounded-xl border transition-all flex gap-4 ${manualSelectedIds.has(q.id) ? 'border-brand-blue bg-blue-50 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                                            <input type="checkbox" checked={manualSelectedIds.has(q.id)} onChange={() => toggleManualQuestion(q.id)} className="w-5 h-5 text-brand-blue rounded focus:ring-brand-blue mt-1 shrink-0 cursor-pointer" />
                                            <div className="flex-1 cursor-pointer" onClick={() => toggleManualQuestion(q.id)}>
                                                <div className="text-sm font-medium text-slate-800 line-clamp-2 mb-2" dangerouslySetInnerHTML={{__html: q.enunciado}} />
                                                <div className="flex gap-2">
                                                    <Badge color="blue">{DifficultyLabels[q.difficulty] || q.difficulty}</Badge>
                                                    <Badge color="purple">{QuestionTypeLabels[q.type] || q.type}</Badge>
                                                </div>
                                            </div>
                                            <button onClick={() => setViewingQuestion(q)} className="p-2 text-slate-400 hover:text-brand-blue transition-colors self-start" title="Visualizar Questão"><Icons.Eye /></button>
                                        </div>
                                    ))}
                                    {availableForManual.length === 0 && <p className="text-center py-10 text-slate-400 italic">Defina o escopo no Passo 2 para ver as questões.</p>}
                                </div>
                            </div>
                        )}
                    </div>
                );
            case 4:
                const questionsToShow = examVersions[activeVersion] || (generationMode === 'AUTO' ? generatedQuestions : allQuestions.filter(q => manualSelectedIds.has(q.id)));
                return (
                    <div className="flex h-[70vh] animate-fade-in relative bg-slate-100 rounded-xl overflow-hidden border border-slate-200 print:h-auto print:block print:border-none print:bg-white">
                        {/* PAINEL DE CONTROLE LATERAL */}
                        <div className="w-80 bg-white border-r border-slate-200 flex flex-col h-full print:hidden">
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                                <div>
                                    <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Icons.Printer /> Impressão</h4>
                                    <div className="flex bg-slate-100 p-1 rounded-lg mb-6">
                                        <button onClick={() => setViewMode('EXAM')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'EXAM' ? 'bg-white shadow text-brand-blue' : 'text-slate-500'}`}>Prova</button>
                                        <button onClick={() => setViewMode('ANSWER_SHEET')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'ANSWER_SHEET' ? 'bg-white shadow text-brand-blue' : 'text-slate-500'}`}>Cartão-Resposta</button>
                                    </div>

                                    {viewMode === 'EXAM' ? (
                                        <div className="space-y-6 animate-fade-in">
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-wider">Tamanho da Fonte</label>
                                                <div className="flex bg-slate-100 p-1 rounded-lg">
                                                    {[{id:'text-xs',l:'P'},{id:'text-sm',l:'M'},{id:'text-base',l:'G'}].map(s => (
                                                        <button key={s.id} onClick={() => setPrintSettings({...printSettings, fontSize: s.id})} className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${printSettings.fontSize === s.id ? 'bg-white shadow text-brand-blue' : 'text-slate-500'}`}>{s.l}</button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div>
                                                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block tracking-wider">Versão Anti-Cola</label>
                                                <div className="grid grid-cols-5 gap-2">
                                                    {['ORIGINAL','A','B','C','D'].map(v => (
                                                        <button key={v} onClick={() => setActiveVersion(v as any)} className={`py-1.5 rounded text-[10px] font-bold border transition-all ${activeVersion === v ? 'bg-brand-blue text-white border-brand-blue' : 'bg-white text-slate-600 border-slate-200'}`}>{v}</button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="space-y-3 pt-4 border-t border-slate-100">
                                                {[
                                                    {id:'showName', l:'Nome do Aluno'},
                                                    {id:'showDate', l:'Campo Data'},
                                                    {id:'showClass', l:'Campo Turma'},
                                                    {id:'showScore', l:'Campo Nota'}
                                                ].map(t => (
                                                    <label key={t.id} className="flex items-center justify-between cursor-pointer group">
                                                        <span className="text-xs text-slate-600 font-medium group-hover:text-slate-900 transition-colors">{t.l}</span>
                                                        <input type="checkbox" checked={(printSettings as any)[t.id]} onChange={e => setPrintSettings({...printSettings, [t.id]: e.target.checked})} className="w-4 h-4 text-brand-blue rounded border-slate-300 focus:ring-brand-blue" />
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-6 animate-fade-in">
                                            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
                                                <h5 className="text-blue-800 font-bold text-sm mb-3 flex items-center gap-2">
                                                    <Icons.Sparkles /> Guia do Scanner
                                                </h5>
                                                <div className="space-y-4">
                                                    <div className="flex gap-3">
                                                        <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                                                        <p className="text-xs text-blue-700 leading-tight">Imprima este cartão em folha A4 branca sem margens cortadas.</p>
                                                    </div>
                                                    <div className="flex gap-3">
                                                        <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                                                        <p className="text-xs text-blue-700 leading-tight">Instrua os alunos a pintarem <strong>completamente</strong> a bolha com caneta preta ou azul.</p>
                                                    </div>
                                                    <div className="flex gap-3">
                                                        <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
                                                        <p className="text-xs text-blue-700 leading-tight">Acesse <strong>Resultados</strong> nesta prova e use a câmera para correção instantânea.</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 italic text-[10px] text-slate-500 leading-tight">
                                                O tamanho da fonte é fixo para garantir que os marcadores de leitura (quadrados pretos) fiquem na posição correta para a IA.
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="p-4 border-t border-slate-200 bg-slate-50">
                                <Button onClick={() => window.print()} className="w-full justify-center py-3 shadow-lg shadow-blue-500/20"><Icons.Printer /> Imprimir Agora</Button>
                            </div>
                        </div>

                        {/* ÁREA DE VISUALIZAÇÃO A4 */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-10 bg-slate-200/50 print:p-0 print:bg-white print:overflow-visible">
                            <div className={`bg-white shadow-2xl mx-auto p-[20mm] w-full max-w-[210mm] min-h-[297mm] text-black print:shadow-none print:w-full print:p-0 ${viewMode === 'EXAM' ? printSettings.fontSize : 'text-sm'}`}>
                                {viewMode === 'EXAM' ? (
                                    <>
                                        {renderHeader()}
                                        <div className={`space-y-8 ${editing.columns === 2 ? 'columns-2 gap-10' : ''}`} style={editing.columns === 2 ? { columnRule: '1px solid #000' } : {}}>
                                            {questionsToShow.map((q, i) => (
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
                                            ))}
                                        </div>
                                        {editing.showAnswerKey && (
                                            <div className="mt-12 pt-8 border-t border-black print:break-before-page">
                                                {/* Header Repetido para o Gabarito */}
                                                <div className="flex justify-between items-center mb-6">
                                                    <div>
                                                        <h3 className="font-bold text-lg uppercase">Gabarito Oficial</h3>
                                                        <p className="text-sm font-medium">{editing.title}</p>
                                                    </div>
                                                    <Badge color="green">CHAVE DE RESPOSTAS</Badge>
                                                </div>
                                                <div className="grid grid-cols-5 gap-6 border-t border-slate-100 pt-4">
                                                    {questionsToShow.map((q, i) => {
                                                        const correctIdx = q.options?.findIndex(o => o.isCorrect) ?? -1;
                                                        return (
                                                            <div key={i} className="flex flex-col border border-slate-200 p-2 rounded text-center">
                                                                <span className="text-[10px] font-bold text-slate-500 uppercase">Questão {i+1}</span>
                                                                <span className="text-xl font-black text-brand-blue">{correctIdx >= 0 ? String.fromCharCode(65+correctIdx) : '-'}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="relative flex flex-col h-[297mm] p-6 border-[3mm] border-transparent print:p-6 overflow-hidden">
                                        <div className="absolute top-0 left-0 w-6 h-6 bg-black"></div>
                                        <div className="absolute top-0 right-0 w-6 h-6 bg-black"></div>
                                        <div className="absolute bottom-0 left-0 w-6 h-6 bg-black"></div>
                                        <div className="absolute bottom-0 right-0 w-6 h-6 bg-black"></div>

                                        <div className="text-center mb-6 pt-2">
                                            <h1 className="font-bold text-2xl uppercase tracking-[4px] border-b-2 border-black pb-2 mb-4">Cartão-Resposta</h1>
                                            <div className="flex justify-between items-end px-2 gap-6">
                                                <div className="flex-1 text-left space-y-3">
                                                    <div><span className="text-[9px] font-bold uppercase">Aluno(a):</span><div className="border-b border-black h-6 w-full"></div></div>
                                                    <div className="flex gap-6">
                                                        <div className="flex-1"><span className="text-[9px] font-bold uppercase">Turma:</span><div className="border-b border-black h-6 w-full"></div></div>
                                                        <div className="w-32"><span className="text-[9px] font-bold uppercase">Data:</span><div className="border-b border-black h-6 w-full"></div></div>
                                                    </div>
                                                </div>
                                                <div className="border-2 border-black p-1.5 bg-white flex flex-col items-center shrink-0 shadow-sm">
                                                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=PF-EXAM-${editing.id || 'new'}`} alt="QR" className="w-16 h-16 block" />
                                                    <span className="text-[8px] font-mono mt-1 font-black">ID: {editing.id?.slice(0,8).toUpperCase() || 'PF-SYS'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex-1 px-2 py-1 mt-2">
                                            <div className="columns-3 gap-6 print:columns-3" style={{ columnRule: '1px dashed #ccc' }}>
                                                {questionsToShow.map((q, idx) => (
                                                    <div key={q.id} className="flex items-center gap-2 mb-3 break-inside-avoid">
                                                        <span className="font-bold text-sm w-5 text-right">{idx + 1}.</span>
                                                        <div className="flex gap-1.5">
                                                            {['A', 'B', 'C', 'D', 'E'].map(opt => (
                                                                <div key={opt} className="w-6 h-6 rounded-full border border-black flex items-center justify-center text-[9px] font-black text-black/20">
                                                                    {opt}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="text-center text-[8px] text-slate-500 font-mono uppercase tracking-[2px] mt-auto pt-2 border-t border-slate-100">
                                            Compatível com Scanner Prova Fácil • Correção Digital Habilitada
                                        </div>
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
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-3xl font-display font-bold text-slate-800 tracking-tight">Provas</h2>
                    <p className="text-slate-500 mt-1">Gerencie suas avaliações organizadas por instituição, ano e turma.</p>
                </div>
                <Button onClick={() => handleOpenModal()} className="shadow-lg shadow-blue-500/20"><Icons.Plus /> Nova Prova</Button>
            </div>

            <div className="space-y-3">
                {institutions.map(inst => {
                    const instClasses = classes.filter(c => c.institutionId === inst.id);
                    const years = Array.from(new Set(instClasses.map(c => c.year))).sort((a: number, b: number) => b - a);
                    const isExpandedInst = expandedInstitutions[inst.id];
                    return (
                        <div key={inst.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors select-none" onClick={() => toggleInstitution(inst.id)}>
                                <div className="flex items-center gap-4">
                                    <div className={`transform transition-transform duration-200 text-slate-400 ${isExpandedInst ? 'rotate-0' : '-rotate-90'}`}><Icons.ChevronDown /></div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 border border-slate-100 rounded-lg p-1 bg-white shadow-sm flex items-center justify-center overflow-hidden">
                                            {inst.logoUrl ? <img src={inst.logoUrl} className="max-w-full max-h-full object-contain" /> : <Icons.Building />}
                                        </div>
                                        <span className="font-bold text-xl text-slate-800 font-display">{inst.name}</span>
                                    </div>
                                </div>
                                <Badge color="blue">{exams.filter(e => e.institutionId === inst.id).length} provas</Badge>
                            </div>
                            {isExpandedInst && (
                                <div className="p-4 pt-0 space-y-3 animate-fade-in border-t border-slate-50">
                                    {years.map(year => {
                                        const yearId = `${inst.id}-${year}`;
                                        const isExpandedYear = expandedYears[yearId];
                                        const yearClasses = instClasses.filter(c => c.year === year);
                                        return (
                                            <div key={yearId} className="bg-white border border-slate-200 rounded-xl overflow-hidden mt-3">
                                                <div className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors select-none" onClick={() => toggleYear(yearId)}>
                                                    <div className="flex items-center gap-4">
                                                        <div className={`transform transition-transform duration-200 text-slate-400 ${isExpandedYear ? 'rotate-0' : '-rotate-90'}`}><Icons.ChevronDown /></div>
                                                        <span className="font-bold text-lg text-slate-700">Ano Letivo {year}</span>
                                                    </div>
                                                </div>
                                                {isExpandedYear && (
                                                    <div className="p-4 pt-0 space-y-3">
                                                        {yearClasses.map(cls => {
                                                            const clsExams = exams.filter(e => e.classId === cls.id);
                                                            const isExpandedCls = expandedClasses[cls.id];
                                                            return (
                                                                <div key={cls.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                                                                    <div className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors select-none" onClick={() => toggleClass(cls.id)}>
                                                                        <div className="flex items-center gap-4">
                                                                            <div className={`transform transition-transform duration-200 text-slate-400 ${isExpandedCls ? 'rotate-0' : '-rotate-90'}`}><Icons.ChevronDown /></div>
                                                                            <span className="font-bold text-slate-800">{cls.name}</span>
                                                                        </div>
                                                                    </div>
                                                                    {isExpandedCls && (
                                                                        <div className="divide-y divide-slate-100 animate-fade-in border-t border-slate-100 bg-slate-50/20">
                                                                            {clsExams.map(exam => (
                                                                                <div key={exam.id} className="p-4 flex justify-between items-center hover:bg-white transition-colors group">
                                                                                    <div className="flex items-center gap-4">
                                                                                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-sm ${exam.publicConfig?.isPublished ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-brand-blue'}`}>
                                                                                            {exam.publicConfig?.isPublished ? <Icons.Sparkles /> : <Icons.FileText />}
                                                                                        </div>
                                                                                        <div>
                                                                                            <div className="flex items-center gap-2">
                                                                                                <h4 className="font-bold text-slate-800 text-lg">{exam.title}</h4>
                                                                                                {exam.publicConfig?.isPublished && <Badge color="green">ONLINE</Badge>}
                                                                                            </div>
                                                                                            <div className="flex items-center gap-2 text-slate-400 text-sm font-medium mt-0.5">
                                                                                                <span>{new Date(exam.createdAt).toLocaleDateString()}</span>
                                                                                                <span className="text-slate-300">•</span>
                                                                                                <span>{exam.questions?.length || 0} questões</span>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-3">
                                                                                        <button onClick={() => navigate('/exam-results', { state: { examId: exam.id } })} className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 font-bold text-sm hover:bg-slate-50 transition-all shadow-sm">Ver Resultados</button>
                                                                                        <div className="flex gap-1">
                                                                                            <button onClick={() => openPublishModal(exam)} className="p-2 text-slate-400 hover:text-brand-blue hover:bg-blue-50 rounded-lg transition-colors" title="Configurar Prova Online"><Icons.Share /></button>
                                                                                            <button onClick={() => handleOpenModal(exam)} className="p-2 text-slate-400 hover:text-brand-blue hover:bg-blue-50 rounded-lg transition-colors"><Icons.Edit /></button>
                                                                                            <button onClick={() => handleDelete(exam.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Icons.Trash /></button>
                                                                                        </div>
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

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Assistente de Prova" maxWidth="max-w-6xl" footer={
                <div className="flex justify-between w-full">
                    {currentStep > 1 && <Button variant="ghost" onClick={() => setCurrentStep(s => s - 1)}>Voltar</Button>}
                    <div className="flex gap-2 ml-auto">
                        <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        {currentStep < 4 ? 
                            <Button onClick={() => { 
                                if (currentStep === 2 && generationMode === 'AUTO') handleAutoGenerate(); 
                                setCurrentStep(s => s + 1); 
                            }}>Próximo</Button> : 
                            <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar Prova'}</Button>
                        }
                    </div>
                </div>
            }>
                <div className="flex items-center justify-between mb-8 px-4 relative print:hidden">
                    <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -z-10 transform -translate-y-1/2"></div>
                    {['Configuração', 'Conteúdo', 'Geração', 'Impressão'].map((label, idx) => (
                        <div key={idx} className={`flex flex-col items-center gap-2 ${currentStep >= idx + 1 ? 'text-brand-blue' : 'text-slate-300'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${currentStep >= idx + 1 ? 'bg-brand-blue text-white shadow-lg shadow-blue-500/30' : 'bg-slate-100 text-slate-400'}`}>{idx + 1}</div>
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-white px-2">{label}</span>
                        </div>
                    ))}
                </div>
                {renderStepContent()}
            </Modal>

            <Modal
                isOpen={isPublishModalOpen}
                onClose={() => setIsPublishModalOpen(false)}
                title="Configurações da Prova Online"
                maxWidth="max-w-2xl"
                footer={<Button onClick={handleSavePublish} disabled={saving}>{saving ? 'Publicando...' : 'Salvar Configurações'}</Button>}
            >
                <div className="space-y-6">
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Icons.Share />
                            <h4 className="font-bold text-blue-800">Prova Online: {publishingExam?.title}</h4>
                        </div>
                        <p className="text-sm text-blue-700">Configure como os alunos poderão acessar e realizar esta prova pela internet.</p>
                    </div>

                    <div className="flex items-center justify-between border p-4 rounded-lg bg-slate-50">
                        <div>
                            <h4 className="font-bold text-slate-800">Status de Publicação</h4>
                            <p className="text-xs text-slate-500">Se ativo, a prova poderá ser acessada via link público.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold ${publishConfig.isPublished ? 'text-green-600' : 'text-slate-400'}`}>
                                {publishConfig.isPublished ? 'PUBLICADO' : 'OCULTO'}
                            </span>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={publishConfig.isPublished} onChange={e => setPublishConfig({ ...publishConfig, isPublished: e.target.checked })} />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Data/Hora de Início" type="datetime-local" value={publishConfig.startDate} onChange={e => setPublishConfig({...publishConfig, startDate: e.target.value})} />
                        <Input label="Data/Hora de Fim" type="datetime-local" value={publishConfig.endDate} onChange={e => setPublishConfig({...publishConfig, endDate: e.target.value})} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Tempo Limite (Minutos, 0 = Sem limite)" type="number" value={publishConfig.timeLimitMinutes} onChange={e => setPublishConfig({...publishConfig, timeLimitMinutes: Number(e.target.value)})} />
                        <Input label="Máximo de Tentativas" type="number" min="1" value={publishConfig.allowedAttempts} onChange={e => setPublishConfig({...publishConfig, allowedAttempts: Number(e.target.value)})} />
                    </div>

                    <div className="space-y-3 bg-slate-50 p-4 rounded-xl">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" checked={publishConfig.randomizeQuestions} onChange={e => setPublishConfig({...publishConfig, randomizeQuestions: e.target.checked})} className="w-4 h-4 text-brand-blue rounded border-slate-300" />
                            <span className="text-sm font-semibold text-slate-700">Embaralhar Questões e Alternativas (Anti-cola)</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" checked={publishConfig.requireIdentifier} onChange={e => setPublishConfig({...publishConfig, requireIdentifier: e.target.checked})} className="w-4 h-4 text-brand-blue rounded border-slate-300" />
                            <span className="text-sm font-semibold text-slate-700">Exigir Matrícula/ID único do aluno</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" checked={publishConfig.showFeedback} onChange={e => setPublishConfig({...publishConfig, showFeedback: e.target.checked})} className="w-4 h-4 text-brand-blue rounded border-slate-300" />
                            <span className="text-sm font-semibold text-slate-700">Mostrar Nota Preliminar ao finalizar</span>
                        </label>
                    </div>

                    {publishConfig.isPublished && publishingExam?.id && (
                        <div className="p-4 bg-white border border-brand-blue/20 rounded-xl shadow-sm">
                            <h5 className="text-xs font-bold text-brand-blue uppercase mb-2">Link da Prova Online</h5>
                            <div className="flex gap-2">
                                <div className="flex-1 bg-slate-50 px-3 py-2 rounded border border-slate-200 text-xs font-mono text-slate-600 truncate">
                                    {`${window.location.origin}/#/p/${publishingExam.id}`}
                                </div>
                                <Button variant="outline" className="text-xs h-8" onClick={() => {
                                    navigator.clipboard.writeText(`${window.location.origin}/#/p/${publishingExam.id}`);
                                    alert("Link copiado!");
                                }}>Copiar Link</Button>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>

            {viewingQuestion && (
                <Modal isOpen={true} onClose={() => setViewingQuestion(null)} title="Visualizar Questão" maxWidth="max-w-3xl" footer={<Button onClick={() => setViewingQuestion(null)}>Fechar</Button>}>
                    <div className="space-y-6">
                        <div className="prose prose-slate max-w-none p-6 bg-slate-50 rounded-xl border border-slate-200" dangerouslySetInnerHTML={{__html: viewingQuestion.enunciado}} />
                        <div className="space-y-3">
                            {viewingQuestion.options?.map((opt, i) => (
                                <div key={i} className={`p-4 rounded-lg border flex gap-3 items-center ${opt.isCorrect ? 'bg-green-50 border-green-200' : 'bg-white border-slate-100'}`}>
                                    <span className="font-bold text-slate-400">{String.fromCharCode(65+i)})</span>
                                    <span className="flex-1">{opt.text}</span>
                                    {opt.isCorrect && <Badge color="green">Correta</Badge>}
                                </div>
                            ))}
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default ExamsPage;
