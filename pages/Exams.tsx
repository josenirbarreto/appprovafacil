
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Exam, Institution, SchoolClass, Question, ExamContentScope, CurricularComponent, UserRole, QuestionType } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { Button, Modal, Select, Input, Badge, Card, RichTextEditor } from '../components/UI';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';

const ExamsPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    // Dados
    const [exams, setExams] = useState<Exam[]>([]);
    const [institutions, setInstitutions] = useState<Institution[]>([]);
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [hierarchy, setHierarchy] = useState<CurricularComponent[]>([]);
    const [allQuestions, setAllQuestions] = useState<Question[]>([]);
    
    // UI States
    const [loading, setLoading] = useState(true);
    const [expandedInstitutions, setExpandedInstitutions] = useState<Record<string, boolean>>({});

    // Modal/Wizard States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Partial<Exam>>({ 
        questions: [], 
        title: '', 
        columns: 1, 
        showAnswerKey: false, 
        instructions: '' 
    });
    const [currentStep, setCurrentStep] = useState(1);
    const [selectionMode, setSelectionMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
    
    // Hierarquia do Passo 2
    const [selComp, setSelComp] = useState('');
    const [selDisc, setSelDisc] = useState('');
    const [selChap, setSelChap] = useState('');
    const [selUnit, setSelUnit] = useState('');
    const [selTopic, setSelTopic] = useState('');
    const [questionsCount, setQuestionsCount] = useState(1);
    const [tempScopes, setTempScopes] = useState<ExamContentScope[]>([]);

    // Estados de Impressão (Passo 4)
    const [printFontSize, setPrintFontSize] = useState('text-sm');
    const [headerFields, setHeaderFields] = useState({ nome: true, data: true, turma: true, nota: true, valor: true });
    const [activeVersion, setActiveVersion] = useState('A');
    const [examVersions, setExamVersions] = useState<Record<string, Question[]>>({});
    const [viewingMode, setViewingMode] = useState<'EXAM' | 'ANSWER_CARD'>('EXAM');

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
        } finally {
            setLoading(false);
        }
    };

    const authorizedHierarchy = useMemo(() => {
        const full = Array.isArray(hierarchy) ? hierarchy : [];
        if (!user || user.role === UserRole.ADMIN) return full;
        const subjects = Array.isArray(user.subjects) ? user.subjects : [];
        const accessGrants = Array.isArray(user.accessGrants) ? user.accessGrants : [];
        const authorizedIds = [...subjects, ...accessGrants];
        return full.filter(cc => authorizedIds.includes(cc.id));
    }, [hierarchy, user]);

    const availablePoolCount = useMemo(() => {
        if (!selComp) return 0;
        return allQuestions.filter(q => 
            q.componentId === selComp &&
            (!selDisc || q.disciplineId === selDisc) &&
            (!selChap || q.chapterId === selChap) &&
            (!selUnit || q.unitId === selUnit) &&
            (!selTopic || q.topicId === selTopic)
        ).length;
    }, [allQuestions, selComp, selDisc, selChap, selUnit, selTopic]);

    const selectedInstitution = useMemo(() => {
        return institutions.find(i => i.id === editing.institutionId);
    }, [institutions, editing.institutionId]);

    const handleAddScope = () => {
        const comp = hierarchy.find(cc => cc.id === selComp);
        const disc = comp?.disciplines?.find(d => d.id === selDisc);
        const chap = disc?.chapters?.find(c => c.id === selChap);
        const unit = chap?.units?.find(u => u.id === selUnit);
        const topic = unit?.topics?.find(t => t.id === selTopic);
        
        const currentScopes = Array.isArray(tempScopes) ? tempScopes : [];
        setTempScopes([...currentScopes, {
            id: Date.now().toString(),
            componentId: selComp,
            componentName: comp?.name || '',
            disciplineId: selDisc || undefined,
            disciplineName: disc?.name,
            chapterId: selChap || undefined,
            chapterName: chap?.name,
            unitId: selUnit || undefined,
            unitName: unit?.name,
            topicId: selTopic || undefined,
            topicName: topic?.name,
            questionCount: Math.min(questionsCount, availablePoolCount)
        }]);
    };

    const handleAutoGenerate = () => {
        let finalQuestions: Question[] = [];
        const activeScopes = Array.isArray(tempScopes) ? tempScopes : [];
        const poolSource = Array.isArray(allQuestions) ? allQuestions : [];

        activeScopes.forEach(scope => {
            const pool = poolSource.filter(q => 
                q.componentId === scope.componentId && 
                (!scope.disciplineId || q.disciplineId === scope.disciplineId) &&
                (!scope.chapterId || q.chapterId === scope.chapterId) &&
                (!scope.unitId || q.unitId === scope.unitId) &&
                (!scope.topicId || q.topicId === scope.topicId)
            );
            const shuffled = [...pool].sort(() => 0.5 - Math.random());
            finalQuestions.push(...shuffled.slice(0, scope.questionCount));
        });
        setEditing(prev => ({ ...prev, questions: finalQuestions }));
        generateVersions(1, finalQuestions);
    };

    const toggleQuestionSelection = (q: Question) => {
        const current = Array.isArray(editing.questions) ? editing.questions : [];
        const exists = current.find(x => x.id === q.id);
        const newList = exists ? current.filter(x => x.id !== q.id) : [...current, q];
        setEditing({ ...editing, questions: newList });
        generateVersions(1, newList);
    };

    const generateVersions = (count: number, baseQs?: Question[]) => {
        const source = baseQs || (Array.isArray(editing.questions) ? editing.questions : []);
        const versions: Record<string, Question[]> = {};
        
        for (let i = 0; i < count; i++) {
            const vLetter = String.fromCharCode(65 + i);
            const shuffledQs = [...source].sort(() => 0.5 - Math.random()).map(q => {
                if (q.type === QuestionType.MULTIPLE_CHOICE && Array.isArray(q.options)) {
                    return { ...q, options: [...q.options].sort(() => 0.5 - Math.random()) };
                }
                return q;
            });
            versions[vLetter] = shuffledQs;
        }
        setExamVersions(versions);
        setActiveVersion('A');
    };

    const handleSaveExam = async () => {
        try {
            const payload = {
                ...editing,
                authorId: user?.id,
                institutionId: editing.institutionId || user?.institutionId,
                contentScopes: Array.isArray(tempScopes) ? tempScopes : [],
                questions: Array.isArray(editing.questions) ? editing.questions : [],
                createdAt: editing.createdAt || new Date().toISOString()
            };
            await FirebaseService.saveExam(payload);
            setIsModalOpen(false);
            load();
        } catch (e) {
            alert("Erro ao salvar prova.");
        }
    };

    const renderHeaderPrint = (titleSuffix: string = '') => (
        <div className="border-2 border-black p-4 mb-4 break-inside-avoid bg-white block">
            <div className="flex items-center gap-4 mb-4 pb-4 border-b border-black/10">
                {selectedInstitution?.logoUrl && (
                    <img src={selectedInstitution.logoUrl} alt="Logo" className="h-10 w-auto object-contain shrink-0" />
                )}
                <div className="flex-1">
                    <h1 className="font-black text-base uppercase leading-tight">{selectedInstitution?.name || 'INSTITUIÇÃO DE ENSINO'}</h1>
                    <h2 className="font-bold text-xs uppercase text-slate-600">{editing.title || 'AVALIAÇÃO'} {titleSuffix}</h2>
                </div>
                <div className="text-right">
                    <div className="text-[10px] font-black border border-black px-2 py-0.5 rounded">VERSÃO: {activeVersion}</div>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-y-3 gap-x-8">
                {headerFields.nome && <div className="border-b border-black pb-0.5 font-bold text-xs">ALUNO:</div>}
                {headerFields.data && <div className="border-b border-black pb-0.5 font-bold text-xs">DATA: ____/____/____</div>}
                {headerFields.turma && <div className="border-b border-black pb-0.5 font-bold text-xs">TURMA:</div>}
                <div className="flex gap-4">
                    {headerFields.nota && <div className="flex-1 border-b border-black pb-0.5 font-bold text-xs">NOTA:</div>}
                    {headerFields.valor && <div className="flex-1 border-b border-black pb-0.5 font-bold text-xs">VALOR: 10,0</div>}
                </div>
            </div>
        </div>
    );

    const currentQs = examVersions[activeVersion] || (Array.isArray(editing.questions) ? editing.questions : []);

    const renderStepContent = () => {
        const activeScopes = Array.isArray(tempScopes) ? tempScopes : [];

        switch(currentStep) {
            case 1: return (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <Input label="Título da Avaliação" value={editing.title || ''} onChange={e => setEditing({...editing, title: e.target.value})} placeholder="Ex: P1 - Cálculo Diferencial" />
                            <div className="grid grid-cols-2 gap-4">
                                <Select label="Instituição" value={editing.institutionId || ''} onChange={e => setEditing({...editing, institutionId: e.target.value, classId: ''})}>
                                    <option value="">Selecione...</option>
                                    {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                </Select>
                                <Select label="Turma" value={editing.classId || ''} onChange={e => setEditing({...editing, classId: e.target.value})} disabled={!editing.institutionId}>
                                    <option value="">Geral</option>
                                    {classes.filter(c => c.institutionId === editing.institutionId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </Select>
                            </div>
                        </div>
                        <div className="bg-slate-50 p-6 rounded-3xl border-2 border-slate-100 space-y-4">
                            <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest">Estilo da Impressão</h4>
                            <div className="flex gap-4">
                                <button onClick={() => setEditing({...editing, columns: 1})} className={`flex-1 p-3 rounded-xl border-2 transition-all ${editing.columns === 1 ? 'border-brand-blue bg-white shadow-md' : 'border-transparent opacity-60'}`}>
                                    <div className="h-10 w-full bg-slate-200 rounded mb-2"></div>
                                    <span className="text-[10px] font-black uppercase">1 Coluna</span>
                                </button>
                                <button onClick={() => setEditing({...editing, columns: 2})} className={`flex-1 p-3 rounded-xl border-2 transition-all ${editing.columns === 2 ? 'border-brand-blue bg-white shadow-md' : 'border-transparent opacity-60'}`}>
                                    <div className="h-10 w-full flex gap-1"><div className="flex-1 bg-slate-200 rounded"></div><div className="flex-1 bg-slate-200 rounded"></div></div>
                                    <span className="text-[10px] font-black uppercase mt-2 block">2 Colunas</span>
                                </button>
                            </div>
                            <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-white rounded-xl transition-colors">
                                <input type="checkbox" checked={editing.showAnswerKey} onChange={e => setEditing({...editing, showAnswerKey: e.target.checked})} className="w-5 h-5 rounded text-brand-blue" />
                                <span className="text-sm font-bold text-slate-700">Imprimir Gabarito ao final</span>
                            </label>
                        </div>
                    </div>
                    <RichTextEditor label="Instruções para os Alunos" value={editing.instructions || ''} onChange={html => setEditing({...editing, instructions: html})} />
                </div>
            );
            case 2: return (
                <div className="space-y-6">
                    <div className="bg-blue-600 p-8 rounded-[40px] text-white shadow-xl shadow-blue-200">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-xs font-black uppercase opacity-60 tracking-widest">Mapeamento Curricular</h4>
                            {selComp && (
                                <Badge color="blue" className="bg-white/20 border-transparent text-white">
                                    {availablePoolCount} questões disponíveis
                                </Badge>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <Select label="1. Área" value={selComp} onChange={e => { setSelComp(e.target.value); setSelDisc(''); }} className="!bg-blue-700 !border-blue-500 !text-white">
                                <option value="">Selecione...</option>
                                {authorizedHierarchy.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
                            </Select>
                            <Select label="2. Disciplina" value={selDisc} onChange={e => { setSelDisc(e.target.value); setSelChap(''); }} disabled={!selComp} className="!bg-blue-700 !border-blue-500 !text-white">
                                <option value="">Todas</option>
                                {authorizedHierarchy.find(cc => cc.id === selComp)?.disciplines?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </Select>
                            <Select label="3. Capítulo" value={selChap} onChange={e => { setSelChap(e.target.value); setSelUnit(''); }} disabled={!selDisc} className="!bg-blue-700 !border-blue-500 !text-white">
                                <option value="">Todos</option>
                                {authorizedHierarchy.find(cc => cc.id === selComp)?.disciplines?.find(d => d.id === selDisc)?.chapters?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </Select>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                            <Select label="4. Unidade" value={selUnit} onChange={e => setSelUnit(e.target.value)} disabled={!selChap} className="!bg-blue-700 !border-blue-500 !text-white">
                                <option value="">Todas</option>
                                {authorizedHierarchy.find(cc => cc.id === selComp)?.disciplines?.find(d => d.id === selDisc)?.chapters?.find(c => c.id === selChap)?.units?.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </Select>
                            <Select label="5. Tópico" value={selTopic} onChange={e => setSelTopic(e.target.value)} disabled={!selUnit} className="!bg-blue-700 !border-blue-500 !text-white">
                                <option value="">Todos</option>
                                {authorizedHierarchy.find(cc => cc.id === selComp)?.disciplines?.find(d => d.id === selDisc)?.chapters?.find(c => c.id === selChap)?.units?.find(u => u.id === selUnit)?.topics?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </Select>
                            <Input label="Qtd" type="number" min="1" max={availablePoolCount} value={questionsCount} onChange={e => setQuestionsCount(Number(e.target.value))} className="!bg-blue-700 !border-blue-500 !text-white" />
                            <Button onClick={handleAddScope} disabled={!selComp || availablePoolCount === 0} className="h-11 bg-white !text-blue-600 hover:bg-blue-50">Adicionar Regra</Button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        {activeScopes.map(s => {
                            const poolSize = allQuestions.filter(q => 
                                q.componentId === s.componentId &&
                                (!s.disciplineId || q.disciplineId === s.disciplineId) &&
                                (!s.chapterId || q.chapterId === s.chapterId)
                            ).length;

                            return (
                                <div key={s.id} className="p-4 bg-white border-2 border-slate-100 rounded-2xl flex justify-between items-center shadow-sm">
                                    <div className="text-xs">
                                        <span className="font-black text-brand-blue uppercase">{s.componentName}</span>
                                        <p className="font-bold text-slate-700">{s.disciplineName || 'Geral'} {s.chapterName ? `> ${s.chapterName}` : ''}</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <Badge color="blue">{s.questionCount} na prova</Badge>
                                            <p className="text-[9px] font-black text-slate-400 mt-1 uppercase">De {poolSize} no banco</p>
                                        </div>
                                        <button onClick={() => setTempScopes(prev => prev.filter(x => x.id !== s.id))} className="text-slate-300 hover:text-red-500 transition-colors"><Icons.Trash /></button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
            case 3: return (
                <div className="space-y-6">
                    <div className="flex bg-slate-100 p-1 rounded-2xl w-fit mx-auto">
                        <button onClick={() => setSelectionMode('AUTO')} className={`px-8 py-2 rounded-xl text-sm font-black transition-all ${selectionMode === 'AUTO' ? 'bg-white text-brand-blue shadow-md' : 'text-slate-500'}`}>Sorteio Automático</button>
                        <button onClick={() => setSelectionMode('MANUAL')} className={`px-8 py-2 rounded-xl text-sm font-black transition-all ${selectionMode === 'MANUAL' ? 'bg-white text-brand-blue shadow-md' : 'text-slate-500'}`}>Seleção Manual</button>
                    </div>

                    {selectionMode === 'AUTO' ? (
                        <div className="text-center py-12 flex flex-col items-center justify-center w-full">
                            <div className="w-20 h-20 bg-blue-50 text-brand-blue rounded-full flex items-center justify-center mb-6"><Icons.Sparkles className="w-10 h-10" /></div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">Pronto para o Sorteio?</h3>
                            <p className="text-slate-500 mb-8 max-w-sm mx-auto">O sistema selecionará questões aleatórias baseadas no escopo definido.</p>
                            <Button onClick={handleAutoGenerate} className="h-14 px-10 text-lg shadow-xl shadow-blue-100 font-black">Sortear Agora</Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-6 max-h-[600px] overflow-y-auto custom-scrollbar pr-2 pb-10">
                            {currentQs.length > 0 && (
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-widest px-2">Itens na Prova ({currentQs.length})</h4>
                                    {currentQs.map((q, idx) => (
                                        <Card key={`sel-${q.id}`} className="p-6 border-2 border-brand-blue bg-blue-50/20 shadow-md relative">
                                            <div className="flex justify-between items-start mb-4">
                                                <Badge color="blue">Questão {idx + 1}</Badge>
                                                <button onClick={() => toggleQuestionSelection(q)} className="bg-red-500 text-white rounded-full p-1 shadow-lg hover:scale-110 transition-transform"><Icons.X className="w-4 h-4"/></button>
                                            </div>
                                            <div className="text-sm font-bold rich-text-content" dangerouslySetInnerHTML={{__html: q.enunciado}} />
                                        </Card>
                                    ))}
                                    <div className="h-px bg-slate-200 my-8"></div>
                                </div>
                            )}

                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Disponíveis no Banco</h4>
                            {allQuestions.filter(q => activeScopes.some(s => s.componentId === q.componentId) && !currentQs.some(x => x.id === q.id)).map(q => (
                                <Card key={q.id} className="p-6 cursor-pointer border-2 border-slate-100 hover:border-brand-blue transition-all" onClick={() => toggleQuestionSelection(q)}>
                                    <div className="flex justify-between items-start mb-4">
                                        <Badge color={q.difficulty === 'Hard' ? 'red' : 'blue'}>{DifficultyLabels[q.difficulty] || q.difficulty}</Badge>
                                        <div className="bg-slate-100 text-slate-400 rounded-full p-1"><Icons.Plus className="w-4 h-4"/></div>
                                    </div>
                                    <div className="text-sm font-medium rich-text-content line-clamp-3" dangerouslySetInnerHTML={{__html: q.enunciado}} />
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            );
            case 4: return (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1 space-y-6 bg-slate-50 p-8 rounded-[32px] border-2 border-slate-100 no-print">
                        <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest mb-4">Ajustes da Prova</h4>
                        
                        <div className="space-y-4">
                            <Select label="Tamanho da Fonte" value={printFontSize} onChange={e => setPrintFontSize(e.target.value)}>
                                <option value="text-[10px]">Econômica</option>
                                <option value="text-xs">Padrão Compacta</option>
                                <option value="text-sm">Leitura Confortável</option>
                                <option value="text-base">Grande</option>
                            </Select>

                            <div className="space-y-2">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Campos do Cabeçalho</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {Object.entries(headerFields).map(([key, val]) => (
                                        <label key={key} className="flex items-center gap-2 p-2 bg-white rounded-lg border cursor-pointer hover:bg-blue-50 transition-colors">
                                            <input type="checkbox" checked={val} onChange={e => setHeaderFields({...headerFields, [key]: e.target.checked})} className="rounded text-brand-blue" />
                                            <span className="text-[10px] font-bold uppercase">{key}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-6 border-t border-slate-200">
                                <h5 className="font-black text-brand-blue uppercase text-[10px] tracking-widest mb-4">Anti-Cola (Versões)</h5>
                                <div className="flex gap-2 mb-4">
                                    <button onClick={() => generateVersions(1)} className={`flex-1 py-2 rounded-lg text-[10px] font-black border-2 ${Object.keys(examVersions).length === 1 ? 'bg-brand-blue text-white border-brand-blue' : 'bg-white border-slate-200'}`}>ÚNICA</button>
                                    <button onClick={() => generateVersions(2)} className={`flex-1 py-2 rounded-lg text-[10px] font-black border-2 ${Object.keys(examVersions).length === 2 ? 'bg-brand-blue text-white border-brand-blue' : 'bg-white border-slate-200'}`}>A / B</button>
                                    <button onClick={() => generateVersions(3)} className={`flex-1 py-2 rounded-lg text-[10px] font-black border-2 ${Object.keys(examVersions).length === 3 ? 'bg-brand-blue text-white border-brand-blue' : 'bg-white border-slate-200'}`}>A / B / C</button>
                                </div>
                                {Object.keys(examVersions).length > 1 && (
                                    <div className="flex gap-2 justify-center p-2 bg-white rounded-xl border">
                                        {Object.keys(examVersions).map(v => (
                                            <button key={v} onClick={() => setActiveVersion(v)} className={`w-8 h-8 rounded-full font-black text-xs transition-all ${activeVersion === v ? 'bg-brand-blue text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>{v}</button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="pt-6 border-t border-slate-200">
                                <h5 className="font-black text-slate-800 uppercase text-[10px] tracking-widest mb-4">Modo de Visualização</h5>
                                <div className="flex bg-white rounded-xl p-1 border">
                                    <button onClick={() => setViewingMode('EXAM')} className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${viewingMode === 'EXAM' ? 'bg-brand-blue text-white' : 'text-slate-400'}`}>PROVA</button>
                                    <button onClick={() => setViewingMode('ANSWER_CARD')} className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${viewingMode === 'ANSWER_CARD' ? 'bg-brand-blue text-white' : 'text-slate-400'}`}>CARTÃO</button>
                                </div>
                            </div>

                            <Button onClick={() => window.print()} className="w-full h-14 bg-slate-900 text-white shadow-xl mt-4 no-print">
                                <Icons.Printer /> Imprimir {viewingMode === 'EXAM' ? 'Prova' : 'Cartão'}
                            </Button>
                        </div>
                    </div>

                    <div className="lg:col-span-2 bg-white rounded-2xl p-4 border border-slate-200 overflow-y-auto custom-scrollbar print:shadow-none print:border-none print:p-0 print:overflow-visible">
                        {/* 
                            O ID 'exam-print-container' agora é alvo principal do CSS de impressão.
                            Garante que o conteúdo interno seja tratado como bloco simples para o motor de colunas.
                        */}
                        <div id="exam-print-container" className={`${printFontSize} text-black bg-white w-full print:block print:static`}>
                            {viewingMode === 'EXAM' ? (
                                <div className="animate-fade-in bg-white w-full block">
                                    {renderHeaderPrint()}

                                    {editing.instructions && (
                                        <div className="mb-4 p-3 bg-white border-l-4 border-black italic rich-text-content break-inside-avoid" dangerouslySetInnerHTML={{__html: editing.instructions}} />
                                    )}

                                    {/* 
                                        Importante: A classe print-columns-2 força o container a ignorar
                                        paddings e outros layouts que interferem nas colunas A4.
                                    */}
                                    <div 
                                        className={`${editing.columns === 2 ? 'preview-columns-2 print-columns-2' : 'w-full block'}`}
                                    >
                                        {currentQs.map((q, idx) => (
                                            <div key={q.id || idx} className="break-inside-avoid bg-white block">
                                                <div className="flex gap-2">
                                                    <span className="font-bold">{idx + 1}.</span>
                                                    <div className="flex-1 rich-text-content" dangerouslySetInnerHTML={{__html: q.enunciado}} />
                                                </div>
                                                {Array.isArray(q.options) && q.options.length > 0 && (
                                                    <div className="mt-2 ml-6 space-y-1 block">
                                                        {q.options.map((opt, i) => (
                                                            <div key={i} className="flex gap-2 py-0.5">
                                                                <span className="w-5 h-5 border border-black rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">{String.fromCharCode(65+i)}</span>
                                                                <span className="text-sm">{opt.text}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {editing.showAnswerKey && (
                                        <div className="page-break mt-10 pt-10 border-t-2 border-dashed border-black bg-white w-full block">
                                            {renderHeaderPrint('(GABARITO)')}
                                            <div className="mt-6 bg-white block">
                                                <h3 className="font-black text-center text-lg mb-6 uppercase border-b-2 border-black pb-2">Folha de Respostas Oficiais</h3>
                                                <div className="grid grid-cols-2 gap-x-12 gap-y-4 print:block">
                                                    {currentQs.map((q, idx) => {
                                                        const correctOptIndex = q.options?.findIndex(o => o.isCorrect);
                                                        const correctLetter = correctOptIndex !== undefined && correctOptIndex !== -1 
                                                            ? String.fromCharCode(65 + correctOptIndex) 
                                                            : '---';

                                                        return (
                                                            <div key={`ans-${q.id || idx}`} className="flex justify-between items-center border-b border-black pb-1 break-inside-avoid mb-2">
                                                                <span className="font-bold text-sm">Questão {idx + 1}:</span>
                                                                <span className="font-black text-lg">
                                                                    {correctLetter}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="animate-fade-in bg-white w-full block">
                                    {renderHeaderPrint('(CARTÃO-RESPOSTA)')}
                                    <div className="mt-8 grid grid-cols-2 gap-x-10 gap-y-6 bg-white print:block">
                                        {currentQs.map((q, idx) => (
                                            <div key={`card-${idx}`} className="flex items-center gap-4 border-b border-black pb-3 break-inside-avoid bg-white mb-4">
                                                <span className="font-black text-slate-600 w-8">{idx + 1}</span>
                                                <div className="flex gap-2">
                                                    {['A', 'B', 'C', 'D', 'E'].map(letter => (
                                                        <div key={letter} className="answer-bubble bg-white">{letter}</div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-12 p-6 border-2 border-black border-dashed rounded-xl break-inside-avoid bg-white block">
                                        <p className="text-[10px] font-black uppercase mb-4 tracking-widest">Instruções para o Cartão</p>
                                        <ul className="text-[10px] space-y-1">
                                            <li>• Utilize apenas caneta azul ou preta.</li>
                                            <li>• Preencha completamente o círculo da alternativa escolhida.</li>
                                            <li>• Questões com mais de uma marcação ou rasuras serão anuladas.</li>
                                        </ul>
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

    const DifficultyLabels: Record<string, string> = {
        'Easy': 'Fácil',
        'Medium': 'Média',
        'Hard': 'Difícil'
    };

    return (
        <div className="p-8 h-full flex flex-col bg-slate-50 overflow-y-auto custom-scrollbar print:block print:p-0 print:bg-white print:overflow-visible">
            <div className="flex justify-between items-center mb-8 no-print">
                <div>
                    <h2 className="text-3xl font-display font-bold text-slate-800">Minhas Provas</h2>
                    <p className="text-slate-500 mt-1">Gerencie e imprima suas avaliações.</p>
                </div>
                <Button onClick={() => { setEditing({ title: '', questions: [], columns: 1, showAnswerKey: false, instructions: '' }); setTempScopes([]); setCurrentStep(1); setIsModalOpen(true); }} className="h-12 px-6 shadow-lg">
                    <Icons.Plus /> Nova Prova
                </Button>
            </div>

            {loading ? (
                <div className="p-20 text-center text-slate-300 font-black uppercase tracking-widest animate-pulse no-print">Sincronizando...</div>
            ) : (
                <div className="space-y-4 no-print">
                    {institutions.map(inst => {
                        const instExams = exams.filter(e => e.institutionId === inst.id);
                        if (instExams.length === 0) return null;
                        return (
                            <div key={inst.id} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden mb-6">
                                <div className="p-5 flex justify-between items-center cursor-pointer hover:bg-slate-50" onClick={() => setExpandedInstitutions(prev => ({ ...prev, [inst.id]: !prev[inst.id] }))}>
                                    <div className="flex items-center gap-3">
                                        <div className={`transform transition-transform text-slate-400 ${expandedInstitutions[inst.id] ? 'rotate-180' : ''}`}><Icons.ChevronDown /></div>
                                        <span className="font-black text-xl text-slate-800 uppercase">{inst.name}</span>
                                    </div>
                                    <Badge color="blue">{instExams.length} provas</Badge>
                                </div>
                                {expandedInstitutions[inst.id] && (
                                    <div className="bg-slate-50 p-5 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {instExams.map(exam => (
                                            <Card key={exam.id} className="p-5 hover:border-brand-blue transition-all border-2 border-slate-100 group">
                                                <h4 className="font-bold text-slate-800 text-lg mb-4">{exam.title}</h4>
                                                <div className="flex gap-2 pt-4 border-t opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button variant="outline" className="flex-1 h-9 !px-2 text-[10px] font-black uppercase" onClick={() => { 
                                                        setEditing(exam); 
                                                        setTempScopes(Array.isArray(exam.contentScopes) ? exam.contentScopes : []); 
                                                        setCurrentStep(4); 
                                                        setIsModalOpen(true); 
                                                    }}>Motor Impressão</Button>
                                                    <Button variant="ghost" className="h-9 w-9 !p-0 text-red-400" onClick={() => { if(confirm('Excluir?')) FirebaseService.deleteExam(exam.id).then(load); }}><Icons.Trash /></Button>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing.id ? "Editor de Prova" : "Gerador Inteligente"} maxWidth="max-w-7xl" footer={
                <div className="flex justify-between w-full items-center no-print">
                    {currentStep > 1 && <Button variant="ghost" onClick={() => setCurrentStep(currentStep - 1)} className="font-black uppercase text-xs"><Icons.ArrowLeft /> Voltar</Button>}
                    <div className="flex gap-2 ml-auto">
                        {currentStep < 4 ? <Button onClick={() => setCurrentStep(currentStep + 1)} disabled={currentStep === 1 && !editing.title} className="px-8 h-12">Próximo <Icons.ArrowRight /></Button> : <Button onClick={handleSaveExam} className="px-10 h-12 shadow-lg font-black">CONCLUIR E SALVAR</Button>}
                    </div>
                </div>
            }>
                <div className="flex items-center justify-between mb-10 px-20 no-print">
                    {[1, 2, 3, 4].map(s => (
                        <React.Fragment key={s}>
                            <div className="flex flex-col items-center gap-2">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black transition-all ${currentStep >= s ? 'bg-brand-blue text-white shadow-xl shadow-blue-200' : 'bg-slate-100 text-slate-400'}`}>{s}</div>
                                <span className={`text-[10px] font-black uppercase tracking-widest ${currentStep >= s ? 'text-brand-blue' : 'text-slate-400'}`}>
                                    {s === 1 ? 'Config' : s === 2 ? 'Escopo' : s === 3 ? 'Seleção' : 'Impressão'}
                                </span>
                            </div>
                            {s < 4 && <div className={`flex-1 h-1 mx-4 rounded-full ${currentStep > s ? 'bg-brand-blue' : 'bg-slate-100'}`}></div>}
                        </React.Fragment>
                    ))}
                </div>
                <div className="animate-fade-in min-h-[400px] no-print">{renderStepContent()}</div>
                {/* 
                    Repetimos o conteúdo de impressão fora do wizard apenas para o motor de impressão 
                    se o passo atual for o 4. Isso garante que o navegador tenha um alvo limpo.
                */}
                <div className="hidden print:block">{currentStep === 4 && renderStepContent()}</div>
            </Modal>
        </div>
    );
};

export default ExamsPage;
