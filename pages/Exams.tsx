import React, { useState, useEffect } from 'react';
import { Exam, Institution, SchoolClass, Discipline, Question, ExamContentScope, QuestionType } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { Button, Modal, Select, Input, Card, Badge, RichTextEditor } from '../components/UI';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';

const QuestionTypeLabels: Record<QuestionType, string> = {
  [QuestionType.MULTIPLE_CHOICE]: 'Múltipla Escolha',
  [QuestionType.TRUE_FALSE]: 'Verdadeiro/Falso',
  [QuestionType.SHORT_ANSWER]: 'Dissertativa',
  [QuestionType.NUMERIC]: 'Numérica',
  [QuestionType.ASSOCIATION]: 'Associação'
};

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
    const [saving, setSaving] = useState(false);
    
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

    const { user } = useAuth();

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

    // Helper: Move Question
    const moveQuestion = (index: number, direction: 'up' | 'down') => {
        const newQuestions = [...generatedQuestions];
        if (direction === 'up' && index > 0) {
            [newQuestions[index], newQuestions[index - 1]] = [newQuestions[index - 1], newQuestions[index]];
        } else if (direction === 'down' && index < newQuestions.length - 1) {
            [newQuestions[index], newQuestions[index + 1]] = [newQuestions[index + 1], newQuestions[index]];
        }
        setGeneratedQuestions(newQuestions);
    };

    // Helper: Save
    const handleSave = async (e?: React.MouseEvent) => {
        if(e) e.preventDefault();
        
        if(!editing.title) return alert('Título da prova é obrigatório.');
        
        setSaving(true);
        try {
            // Ensure no undefined values are passed to Firestore
            const examData: Exam = {
                id: editing.id || '',
                title: editing.title || 'Sem título',
                headerText: editing.headerText || '',
                institutionId: editing.institutionId || '',
                classId: editing.classId || '',
                columns: editing.columns || 1,
                instructions: editing.instructions || '',
                contentScopes: tempScopes || [],
                questions: generatedQuestions || [],
                showAnswerKey: editing.showAnswerKey || false,
                createdAt: editing.createdAt || new Date().toISOString()
            };

            await FirebaseService.saveExam(examData);
            setIsModalOpen(false);
            await load();
        } catch (error) {
            console.error("Erro ao salvar prova:", error);
            alert('Erro ao salvar prova. Tente novamente.');
        } finally {
            setSaving(false);
        }
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
                                            <div className="w-1/2 bg-slate-200 rounded border-r border-dashed border-slate-400"></div>
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

                        {/* Conteúdos Selecionados - MOVEMOS PARA CIMA */}
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

                        {/* Pré-visualização de Questões Filtradas - MOVEMOS PARA BAIXO */}
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
                                        {generatedQuestions.map((q, index) => (
                                            <div key={q.id} className="p-3 flex justify-between items-start hover:bg-slate-50">
                                                <div className="flex-1 pr-4 flex gap-3">
                                                    <span className="font-bold text-slate-400 text-sm w-6 text-right pt-0.5">{index + 1}.</span>
                                                    <div>
                                                        <div className="flex gap-2 mb-1">
                                                            <Badge color="blue">{QuestionTypeLabels[q.type].split(' ')[0]}</Badge>
                                                        </div>
                                                        <div dangerouslySetInnerHTML={{__html: q.enunciado}} className="text-sm text-slate-800 line-clamp-2" />
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <div className="flex flex-col gap-1 mr-2">
                                                        <button onClick={() => moveQuestion(index, 'up')} disabled={index === 0} className="w-5 h-5 bg-slate-100 rounded hover:bg-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed">
                                                            <div className="transform rotate-180"><Icons.ChevronDown /></div>
                                                        </button>
                                                        <button onClick={() => moveQuestion(index, 'down')} disabled={index === generatedQuestions.length - 1} className="w-5 h-5 bg-slate-100 rounded hover:bg-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed">
                                                            <Icons.ChevronDown />
                                                        </button>
                                                    </div>
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
                            <div className="space-y-6">
                                {/* Nova Seção de Ordenação para Modo Manual */}
                                {generatedQuestions.length > 0 && (
                                    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                                        <div className="p-3 bg-blue-50 border-b border-blue-100 flex justify-between items-center">
                                            <h4 className="font-bold text-slate-700 text-sm">Organizar Questões Selecionadas</h4>
                                            <span className="text-xs text-blue-600 font-semibold">{generatedQuestions.length} questões</span>
                                        </div>
                                        <div className="max-h-60 overflow-y-auto custom-scrollbar divide-y divide-slate-100">
                                            {generatedQuestions.map((q, index) => (
                                                <div key={q.id} className="p-2 flex items-center justify-between hover:bg-slate-50">
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <span className="font-bold text-slate-400 text-sm w-6 text-right shrink-0">{index + 1}.</span>
                                                        <div className="truncate text-sm text-slate-700 max-w-[400px]" dangerouslySetInnerHTML={{__html: q.enunciado.replace(/<[^>]*>?/gm, '')}} />
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <button onClick={() => moveQuestion(index, 'up')} disabled={index === 0} className="p-1 hover:bg-slate-200 rounded text-slate-500 disabled:opacity-30">
                                                            <div className="transform rotate-180 w-4 h-4"><Icons.ChevronDown /></div>
                                                        </button>
                                                        <button onClick={() => moveQuestion(index, 'down')} disabled={index === generatedQuestions.length - 1} className="p-1 hover:bg-slate-200 rounded text-slate-500 disabled:opacity-30">
                                                            <div className="w-4 h-4"><Icons.ChevronDown /></div>
                                                        </button>
                                                        <button onClick={() => setGeneratedQuestions(prev => prev.filter(x => x.id !== q.id))} className="text-red-400 hover:text-red-600 p-1 ml-2"><Icons.Trash /></button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="font-bold text-slate-700">Banco de Questões (Seleção)</h4>
                                    </div>
                                    <div className="h-80 overflow-y-auto custom-scrollbar border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white">
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
                            </div>
                        )}
                    </div>
                );
            case 4: // VISUALIZAÇÃO
                return (
                    <div className="flex flex-col h-full animate-fade-in relative">
                        {/* A4 PAPER PREVIEW */}
                        <div className="bg-white shadow-lg mx-auto p-[10mm] w-full max-w-[210mm] min-h-[297mm] text-black print:shadow-none print:w-full print:max-w-none print:p-0">
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
                            <div 
                                className={`${editing.columns === 2 ? 'columns-2 gap-8' : ''}`}
                                style={editing.columns === 2 ? { columnRule: '1px solid #94a3b8' } : {}}
                            >
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
                                                <span>Professor: {user?.name}</span>
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
                    <Button onClick={handleSave} variant="primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar Prova'}</Button>
                )}
            </div>
        </div>
    );

    return (
        <div className="p-8 h-full flex flex-col bg-slate-50 overflow-y-auto custom-scrollbar print:p-0">
            <div className="flex justify-between items-center mb-6 print:hidden">
                <div>
                    <h2 className="text-3xl font-display font-bold text-slate-800">Provas</h2>
                    <p className="text-slate-500 mt-1">Gerencie suas provas organizadas por Instituição, Ano e Turma.</p>
                </div>
                <Button onClick={() => handleOpenModal()}><Icons.Plus /> Nova Prova</Button>
            </div>

            <div className="space-y-4 print:hidden">
                {institutions.length === 0 && <div className="text-center py-10 text-slate-400">Nenhuma instituição cadastrada.</div>}
                {institutions.map(inst => {
                    const instExams = exams.filter(e => e.institutionId === inst.id);
                    const instClasses = classes.filter(c => c.institutionId === inst.id);
                    const years = Array.from(new Set(instClasses.map(c => c.year))).sort((a, b) => Number(b) - Number(a));
                    const isExpandedInst = expandedInstitutions[inst.id];
                    return (
                        <div key={inst.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 select-none" onClick={() => toggleInstitution(inst.id)}><div className="flex items-center gap-4"><div className={`transform transition-transform text-slate-400 ${isExpandedInst ? 'rotate-180' : ''}`}><Icons.ChevronDown /></div><div className="flex items-center gap-3">{inst.logoUrl ? <img src={inst.logoUrl} className="w-8 h-8 object-contain rounded border p-0.5" /> : <div className="w-8 h-8 bg-slate-100 rounded flex items-center justify-center text-slate-400"><Icons.Building /></div>}<span className="font-bold text-lg text-slate-800">{inst.name}</span></div></div><Badge color="blue">{instExams.length} provas</Badge></div>
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
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in print:hidden">
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

export default ExamsPage;
