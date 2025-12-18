
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Exam, Institution, SchoolClass, Discipline, Question, ExamContentScope, QuestionType, PublicExamConfig } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { Button, Modal, Select, Input, Badge, RichTextEditor } from '../components/UI';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';

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
    
    // Step State
    const [selectedDisc, setSelectedDisc] = useState('');
    const [tempScopes, setTempScopes] = useState<ExamContentScope[]>([]);
    const [questionsCount, setQuestionsCount] = useState(1);
    const [generationMode, setGenerationMode] = useState<'MANUAL' | 'AUTO'>('AUTO');
    const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);
    
    // Publish Modal State
    const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
    const [publishConfig, setPublishConfig] = useState<Partial<PublicExamConfig>>({});
    const [selectedExamId, setSelectedExamId] = useState<string | null>(null);

    // Printing/Preview State
    const [activeVersion, setActiveVersion] = useState<'ORIGINAL' | 'A' | 'B' | 'C' | 'D'>('ORIGINAL');
    const [viewMode, setViewMode] = useState<'EXAM' | 'ANSWER_SHEET'>('EXAM');
    const [examVersions, setExamVersions] = useState<Record<string, Question[]>>({});

    // Accordion States
    const [expandedInstitutions, setExpandedInstitutions] = useState<Record<string, boolean>>({});
    const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>({});
    const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>({});

    useEffect(() => { if (user) load(); }, [user]);
    
    useEffect(() => {
        if (currentStep === 4 && generatedQuestions.length > 0) {
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

    const shuffleArray = <T extends unknown>(array: T[]): T[] => {
        const newArr = [...array];
        for (let i = newArr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
        }
        return newArr;
    };

    const generateVersions = () => {
        const versions: Record<string, Question[]> = {};
        versions['ORIGINAL'] = [...generatedQuestions];
        ['A', 'B', 'C', 'D'].forEach(ver => {
            let shuffledQs = shuffleArray(generatedQuestions).map(q => {
                let newQ: Question;
                try {
                    newQ = typeof structuredClone === 'function' ? structuredClone(q) : JSON.parse(JSON.stringify(q));
                } catch (e) {
                    newQ = { ...(q as any) };
                }
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
            setGenerationMode('MANUAL');
        } else {
            setEditing({ columns: 1, showAnswerKey: false, institutionId: user?.institutionId || '' });
            setTempScopes([]);
            setGeneratedQuestions([]);
            setGenerationMode('AUTO');
        }
        setCurrentStep(1);
        setViewMode('EXAM');
        setIsModalOpen(true);
    };

    const openPublishModal = (exam: Exam) => {
        setSelectedExamId(exam.id);
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 7);
        setPublishConfig(exam.publicConfig || {
            isPublished: true,
            startDate: new Date().toISOString().slice(0, 16),
            endDate: tomorrow.toISOString().slice(0, 16),
            timeLimitMinutes: 60,
            allowedAttempts: 1,
            randomizeQuestions: false,
            requireIdentifier: true,
            showFeedback: true
        });
        setIsPublishModalOpen(true);
    };

    const handleAutoGenerate = () => {
        let finalQuestions: Question[] = [];
        tempScopes.forEach(scope => {
            const scopeQs = allQuestions.filter(q => q.disciplineId === scope.disciplineId);
            const shuffled = [...scopeQs].sort(() => 0.5 - Math.random());
            finalQuestions = [...finalQuestions, ...shuffled.slice(0, scope.questionCount)];
        });
        setGeneratedQuestions(finalQuestions);
    };

    const handleSave = async () => {
        if(!editing.title) return alert('Título obrigatório');
        setSaving(true);
        try {
            await FirebaseService.saveExam({
                ...editing,
                questions: generatedQuestions,
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
        if (confirm('Excluir prova?')) {
            FirebaseService.deleteExam(id).then(load);
        }
    };

    const toggleInstitution = (id: string) => setExpandedInstitutions(prev => ({ ...prev, [id]: !prev[id] }));
    const toggleYear = (id: string) => setExpandedYears(prev => ({ ...prev, [id]: !prev[id] }));
    const toggleClass = (id: string) => setExpandedClasses(prev => ({ ...prev, [id]: !prev[id] }));

    const renderStepContent = () => {
        switch(currentStep) {
            case 1:
                return (
                    <div className="space-y-4 animate-fade-in">
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
                        <Input label="Cabeçalho (Subtítulo)" value={editing.headerText || ''} onChange={e => setEditing({...editing, headerText: e.target.value})} placeholder="Ex: Professor João Silva" />
                        <RichTextEditor label="Instruções" value={editing.instructions || ''} onChange={html => setEditing({...editing, instructions: html})} />
                    </div>
                );
            case 2:
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <h4 className="text-sm font-bold text-slate-700 mb-3 uppercase">Definir Conteúdo</h4>
                            <div className="flex gap-3 items-end">
                                <Select label="Disciplina" value={selectedDisc} onChange={e => setSelectedDisc(e.target.value)}>
                                    <option value="">Selecione...</option>
                                    {hierarchy.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </Select>
                                <Input label="Qtd. Questões" type="number" min="1" value={questionsCount} onChange={e => setQuestionsCount(parseInt(e.target.value))} className="w-32" />
                                <Button onClick={() => { if (!selectedDisc) return; setTempScopes([...tempScopes, { id: Date.now().toString(), disciplineId: selectedDisc, disciplineName: hierarchy.find(x => x.id === selectedDisc)?.name || '', questionCount: questionsCount }]); setQuestionsCount(1); }} disabled={!selectedDisc}>+ Adicionar</Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            {tempScopes.map(scope => (
                                <div key={scope.id} className="flex justify-between items-center bg-white p-3 rounded border border-slate-200 shadow-sm">
                                    <span className="font-bold text-sm">{scope.disciplineName} ({scope.questionCount} questões)</span>
                                    <button onClick={() => setTempScopes(tempScopes.filter(s => s.id !== scope.id))} className="text-red-400 hover:text-red-600"><Icons.Trash /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 3:
                return (
                    <div className="space-y-6 animate-fade-in text-center">
                        <div className="flex justify-center gap-4 mb-6">
                            <button onClick={() => setGenerationMode('AUTO')} className={`px-6 py-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all w-40 ${generationMode === 'AUTO' ? 'border-brand-blue bg-blue-50 text-brand-blue' : 'border-slate-200 hover:border-slate-300 text-slate-500'}`}><Icons.Magic /><span className="font-bold text-sm">Automático</span></button>
                            <button onClick={() => setGenerationMode('MANUAL')} className={`px-6 py-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all w-40 ${generationMode === 'MANUAL' ? 'border-brand-blue bg-blue-50 text-brand-blue' : 'border-slate-200 hover:border-slate-300 text-slate-500'}`}><Icons.Check /><span className="font-bold text-sm">Manual</span></button>
                        </div>
                        {generationMode === 'AUTO' && (
                            <div>
                                <Button onClick={handleAutoGenerate} className="mx-auto mb-6"><Icons.Refresh /> Gerar Prova Agora</Button>
                                <div className="text-left space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                                    {generatedQuestions.map((q, i) => (
                                        <div key={q.id} className="p-3 bg-white border rounded text-sm"><strong>{i+1}.</strong> <div className="inline" dangerouslySetInnerHTML={{__html: q.enunciado}} /></div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {generationMode === 'MANUAL' && <p className="text-slate-400">Selecione as questões desejadas no banco.</p>}
                    </div>
                );
            case 4:
                const questionsToShow = examVersions[activeVersion] || generatedQuestions;
                return (
                    <div className="flex h-full animate-fade-in relative bg-slate-100/50 rounded-xl overflow-hidden border border-slate-200 print:overflow-visible print:h-auto print:block print:border-none print:bg-white">
                        <div className="w-72 bg-white border-r border-slate-200 p-4 flex flex-col gap-6 print:hidden overflow-y-auto custom-scrollbar">
                            <div>
                                <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><Icons.Printer /> Impressão</h4>
                                <div className="flex bg-slate-100 p-1 rounded-lg mb-4">
                                    <button onClick={() => setViewMode('EXAM')} className={`flex-1 py-1.5 text-xs font-bold rounded-md ${viewMode === 'EXAM' ? 'bg-white shadow text-brand-blue' : 'text-slate-500'}`}>Prova</button>
                                    <button onClick={() => setViewMode('ANSWER_SHEET')} className={`flex-1 py-1.5 text-xs font-bold rounded-md ${viewMode === 'ANSWER_SHEET' ? 'bg-white shadow text-brand-blue' : 'text-slate-500'}`}>Cartão-Resposta</button>
                                </div>
                                {viewMode === 'EXAM' && (
                                    <>
                                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Versão Anti-Cola</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {['ORIGINAL', 'A', 'B', 'C', 'D'].map(v => (
                                                <button key={v} onClick={() => setActiveVersion(v as any)} className={`px-2 py-1.5 rounded text-xs font-bold border ${activeVersion === v ? 'bg-brand-blue text-white' : 'bg-white text-slate-600'}`}>{v}</button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                            <Button onClick={() => window.print()} className="w-full mt-auto justify-center shadow-lg shadow-blue-500/20"><Icons.Printer /> Imprimir</Button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-slate-200/50 print:p-0 print:bg-white print:overflow-visible print:h-auto">
                            <div className={`bg-white shadow-xl mx-auto p-[15mm] w-full max-w-[210mm] min-h-[297mm] text-black print:shadow-none print:w-full print:p-0 text-sm`}>
                                {viewMode === 'EXAM' ? (
                                    <>
                                        <div className="border-b-2 border-black pb-4 mb-6">
                                            <h1 className="text-xl font-bold uppercase">{institutions.find(i => i.id === editing.institutionId)?.name || 'Instituição'}</h1>
                                            <h2 className="text-lg font-bold">{editing.title}</h2>
                                            <div className="mt-4 border-t border-gray-300 pt-2 text-sm">
                                                Aluno: ________________________________________________ Turma: ________ Data: __/__/__
                                            </div>
                                        </div>
                                        <div className="space-y-6">
                                            {questionsToShow.map((q, i) => (
                                                <div key={q.id} className="break-inside-avoid">
                                                    <strong>{i + 1}. </strong><div className="inline" dangerouslySetInnerHTML={{__html: q.enunciado}} />
                                                    {q.type === QuestionType.MULTIPLE_CHOICE && (
                                                        <div className="mt-2 ml-4 space-y-1">
                                                            {q.options?.map((opt, idx) => (
                                                                <div key={idx} className="flex gap-2">
                                                                    <span className="font-bold border border-black rounded-full w-5 h-5 flex items-center justify-center text-[10px] shrink-0">{String.fromCharCode(65+idx)}</span>
                                                                    <span>{opt.text}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <div className="relative flex flex-col h-full p-4 border-[3mm] border-transparent">
                                        {/* Layout de Cartão-Resposta Refinado */}
                                        <div className="absolute top-0 left-0 w-8 h-8 bg-black"></div>
                                        <div className="absolute top-0 right-0 w-8 h-8 bg-black"></div>
                                        <div className="absolute bottom-0 left-0 w-8 h-8 bg-black"></div>
                                        <div className="absolute bottom-0 right-0 w-8 h-8 bg-black"></div>
                                        <div className="text-center mb-10 pt-4"><h1 className="font-bold text-2xl uppercase tracking-[4px] border-b-4 border-black pb-2 mb-4">Cartão-Resposta</h1><div className="flex justify-between px-4"><div className="flex-1 mr-8 text-left"><div className="mb-4"><span className="text-xs font-bold uppercase">Aluno(a):</span><div className="border-b-2 border-black h-8 w-full bg-slate-50"></div></div><div className="flex gap-8"><div className="flex-1"><span className="text-xs font-bold uppercase">Turma:</span><div className="border-b-2 border-black h-8 w-full"></div></div><div className="w-32"><span className="text-xs font-bold uppercase">Data:</span><div className="border-b-2 border-black h-8 w-full"></div></div></div></div><div className="border-4 border-black p-2 bg-white flex flex-col items-center shrink-0"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=PF-EXAM-${editing.id || 'new'}`} alt="QR Code" className="w-28 h-28 block" crossOrigin="anonymous"/><span className="text-[10px] font-mono mt-1 font-bold">ID: {editing.id?.slice(0,8).toUpperCase() || 'TEMP'}</span></div></div></div>
                                        <div className="flex-1"><div className="columns-2 gap-12 px-8" style={{ columnRule: '1px dashed #000' }}>{questionsToShow.map((q, idx) => (<div key={q.id} className="flex items-center gap-4 mb-5 break-inside-avoid"><span className="font-bold text-lg w-8 text-right">{idx + 1}.</span><div className="flex gap-3">{['A', 'B', 'C', 'D', 'E'].map(opt => (<div key={opt} className="w-8 h-8 rounded-full border-2 border-black flex items-center justify-center text-xs font-bold text-slate-300">{opt}</div>))}</div></div>))}</div></div>
                                        <div className="text-center text-xs text-slate-500 font-mono uppercase tracking-[2px] pt-8 border-t border-slate-200 mt-auto">Prova Fácil Scanner Compatible • Do not fold or stain</div>
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

            {/* LISTAGEM HIERÁRQUICA - ESTILO SCREENSHOT */}
            <div className="space-y-3">
                {institutions.length === 0 && <div className="text-center py-20 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">Nenhuma instituição cadastrada.</div>}
                
                {institutions.map(inst => {
                    const instClasses = classes.filter(c => c.institutionId === inst.id);
                    const years = Array.from(new Set(instClasses.map(c => c.year))).sort((a: number, b: number) => b - a);
                    const isExpandedInst = expandedInstitutions[inst.id];
                    const instExamsCount = exams.filter(e => e.institutionId === inst.id).length;

                    return (
                        <div key={inst.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            {/* NÍVEL 1: INSTITUIÇÃO */}
                            <div className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors select-none" onClick={() => toggleInstitution(inst.id)}>
                                <div className="flex items-center gap-4">
                                    <div className={`transform transition-transform duration-200 text-slate-400 ${isExpandedInst ? 'rotate-0' : '-rotate-90'}`}>
                                        <Icons.ChevronDown />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 border border-slate-100 rounded-lg p-1 bg-white shadow-sm flex items-center justify-center overflow-hidden">
                                            {inst.logoUrl ? <img src={inst.logoUrl} className="max-w-full max-h-full object-contain" /> : <Icons.Building />}
                                        </div>
                                        <span className="font-bold text-xl text-slate-800 font-display">{inst.name}</span>
                                    </div>
                                </div>
                                <Badge color="blue">{instExamsCount} provas</Badge>
                            </div>

                            {isExpandedInst && (
                                <div className="p-4 pt-0 space-y-3 animate-fade-in border-t border-slate-50">
                                    {years.map(year => {
                                        const yearId = `${inst.id}-${year}`;
                                        const isExpandedYear = expandedYears[yearId];
                                        const yearClasses = instClasses.filter(c => c.year === year);
                                        const yearExamsCount = exams.filter(e => yearClasses.some(c => c.id === e.classId)).length;

                                        return (
                                            <div key={yearId} className="bg-white border border-slate-200 rounded-xl overflow-hidden mt-3">
                                                {/* NÍVEL 2: ANO LETIVO */}
                                                <div className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors select-none" onClick={() => toggleYear(yearId)}>
                                                    <div className="flex items-center gap-4">
                                                        <div className={`transform transition-transform duration-200 text-slate-400 ${isExpandedYear ? 'rotate-0' : '-rotate-90'}`}>
                                                            <Icons.ChevronDown />
                                                        </div>
                                                        <span className="font-bold text-lg text-slate-700">Ano Letivo {year}</span>
                                                    </div>
                                                    <span className="text-sm text-slate-400 font-medium">{yearExamsCount} provas</span>
                                                </div>

                                                {isExpandedYear && (
                                                    <div className="p-4 pt-0 space-y-3">
                                                        {yearClasses.map(cls => {
                                                            const clsExams = exams.filter(e => e.classId === cls.id);
                                                            const isExpandedCls = expandedClasses[cls.id];

                                                            return (
                                                                <div key={cls.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                                                                    {/* NÍVEL 3: TURMA */}
                                                                    <div className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors select-none" onClick={() => toggleClass(cls.id)}>
                                                                        <div className="flex items-center gap-4">
                                                                            <div className={`transform transition-transform duration-200 text-slate-400 ${isExpandedCls ? 'rotate-0' : '-rotate-90'}`}>
                                                                                <Icons.ChevronDown />
                                                                            </div>
                                                                            <span className="font-bold text-slate-800">{cls.name}</span>
                                                                        </div>
                                                                        <span className="text-sm text-slate-400 font-medium">{clsExams.length} provas</span>
                                                                    </div>

                                                                    {isExpandedCls && (
                                                                        <div className="divide-y divide-slate-100 animate-fade-in border-t border-slate-100 bg-slate-50/20">
                                                                            {clsExams.length === 0 && <div className="p-8 text-center text-slate-400 italic text-sm">Nenhuma prova nesta turma.</div>}
                                                                            {clsExams.map(exam => (
                                                                                /* NÍVEL 4: PROVA - ITEM FINAL */
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
                                                                                        <button 
                                                                                            onClick={() => navigate('/exam-results', { state: { examId: exam.id } })}
                                                                                            className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 font-bold text-sm hover:bg-slate-50 hover:border-slate-400 transition-all shadow-sm"
                                                                                        >
                                                                                            Ver Resultados
                                                                                        </button>
                                                                                        
                                                                                        <div className="flex items-center gap-1">
                                                                                            <button onClick={() => openPublishModal(exam)} className="p-2 text-slate-400 hover:text-brand-blue hover:bg-blue-50 rounded-lg transition-colors" title="Configurar Publicação Online">
                                                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                                                                                            </button>
                                                                                            <button onClick={() => handleOpenModal(exam)} className="p-2 text-slate-400 hover:text-brand-blue hover:bg-blue-50 rounded-lg transition-colors" title="Editar Prova">
                                                                                                <Icons.Edit />
                                                                                            </button>
                                                                                            <button onClick={() => handleDelete(exam.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Excluir Prova">
                                                                                                <Icons.Trash />
                                                                                            </button>
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

            {/* MODAL PRINCIPAL DO WIZARD */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Assistente de Prova" maxWidth="max-w-5xl" footer={
                <div className="flex justify-between w-full">
                    {currentStep > 1 && <Button variant="ghost" onClick={() => setCurrentStep(s => s - 1)}>Voltar</Button>}
                    <div className="flex gap-2 ml-auto">
                        <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        {currentStep < 4 ? 
                            <Button onClick={() => { if (currentStep === 2) handleAutoGenerate(); setCurrentStep(s => s + 1); }}>Próximo</Button> : 
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

            {/* MODAL DE CONFIGURAÇÃO ONLINE */}
            <Modal isOpen={isPublishModalOpen} onClose={() => setIsPublishModalOpen(false)} title="Publicar Prova Online" footer={<Button onClick={async () => { const ex = exams.find(e => e.id === selectedExamId); if (ex) { await FirebaseService.saveExam({...ex, publicConfig: publishConfig as PublicExamConfig}); setIsPublishModalOpen(false); load(); } }}>Salvar Configuração</Button>}>
                <div className="space-y-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
                        Ao publicar, um link será gerado para que os alunos possam responder online.
                        {selectedExamId && exams.find(e => e.id === selectedExamId)?.publicConfig?.isPublished && (
                            <div className="mt-3 pt-3 border-t border-blue-200">
                                <p className="text-xs font-bold uppercase text-blue-500 mb-1">Link para Alunos</p>
                                <div className="flex gap-2">
                                    <input type="text" readOnly value={`${window.location.origin}/#/p/${selectedExamId}`} className="flex-1 text-xs border border-blue-300 rounded px-2 py-1.5 bg-white text-slate-600" />
                                    <Button variant="outline" className="h-8 text-xs" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/#/p/${selectedExamId}`); alert("Copiado!"); }}>Copiar</Button>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2 mb-4">
                        <input type="checkbox" id="pub" checked={publishConfig.isPublished || false} onChange={e => setPublishConfig({...publishConfig, isPublished: e.target.checked})} className="w-5 h-5 text-brand-blue rounded" />
                        <label htmlFor="pub" className="font-bold text-slate-800">Prova Ativa (Aceitando respostas)</label>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Início" type="datetime-local" value={publishConfig.startDate || ''} onChange={e => setPublishConfig({...publishConfig, startDate: e.target.value})} />
                        <Input label="Fim" type="datetime-local" value={publishConfig.endDate || ''} onChange={e => setPublishConfig({...publishConfig, endDate: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Tempo Limite (minutos)" type="number" value={publishConfig.timeLimitMinutes || 0} onChange={e => setPublishConfig({...publishConfig, timeLimitMinutes: parseInt(e.target.value)})} />
                        <Input label="Tentativas" type="number" min="1" value={publishConfig.allowedAttempts || 1} onChange={e => setPublishConfig({...publishConfig, allowedAttempts: parseInt(e.target.value)})} />
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default ExamsPage;
