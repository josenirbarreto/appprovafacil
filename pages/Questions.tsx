
import React, { useState, useEffect, useMemo } from 'react';
import { Question, Discipline, QuestionType, UserRole, CurricularComponent, Chapter, Unit, Topic } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { GeminiService } from '../services/geminiService';
import { PdfService } from '../services/pdfService';
import { Button, Modal, Select, Input, Badge, RichTextEditor, Card } from '../components/UI';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';

const QuestionTypeLabels: Record<QuestionType, string> = {
  [QuestionType.MULTIPLE_CHOICE]: 'Múltipla Escolha',
  [QuestionType.TRUE_FALSE]: 'Verdadeiro/Falso',
  [QuestionType.SHORT_ANSWER]: 'Dissertativa',
  [QuestionType.NUMERIC]: 'Numérica',
  [QuestionType.ASSOCIATION]: 'Associação'
};

const DifficultyLabels: Record<string, string> = {
    'Easy': 'Fácil',
    'Medium': 'Média',
    'Hard': 'Difícil'
};

const QuestionsPage = () => {
    const { user } = useAuth();
    const [allQuestions, setAllQuestions] = useState<Question[]>([]);
    const [hierarchy, setHierarchy] = useState<CurricularComponent[]>([]);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Partial<Question>>({});
    const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const [importStep, setImportStep] = useState<string | null>(null);
    const [isBatchPreviewOpen, setIsBatchPreviewOpen] = useState(false);
    const [batchQuestions, setBatchQuestions] = useState<Partial<Question>[]>([]);
    const [batchSaving, setBatchSaving] = useState(false);
    const [isAiLoading, setIsAiLoading] = useState(false);

    // Filtros
    const [selComp, setSelComp] = useState('');
    const [selDisc, setSelDisc] = useState('');
    const [searchText, setSearchText] = useState('');
    const [visFilter, setVisFilter] = useState<'ALL' | 'MINE'>('ALL');

    useEffect(() => { if (user) load(); }, [user]);
    
    const load = async () => {
        setLoading(true);
        try {
            const [qs, hs] = await Promise.all([FirebaseService.getQuestions(user), FirebaseService.getHierarchy()]);
            setAllQuestions(Array.isArray(qs) ? qs : []);
            setHierarchy(Array.isArray(hs) ? hs : []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const availableComponents = useMemo(() => {
        if (!hierarchy) return [];
        if (user?.role === UserRole.ADMIN) return hierarchy;
        const subjects = Array.isArray(user?.subjects) ? user.subjects : [];
        const grants = Array.isArray(user?.accessGrants) ? user.accessGrants : [];
        const authorized = [...subjects, ...grants];
        return hierarchy.filter(cc => authorized.includes(cc.id));
    }, [hierarchy, user]);

    const filterComp = useMemo(() => hierarchy.find(cc => cc.id === selComp), [hierarchy, selComp]);
    const activeComp = useMemo(() => hierarchy.find(cc => cc.id === editing.componentId), [hierarchy, editing.componentId]);

    const filteredQuestions = useMemo(() => {
        return allQuestions.filter(q => {
            if (selComp && q.componentId !== selComp) return false;
            if (selDisc && q.disciplineId !== selDisc) return false;
            if (searchText) {
                const term = searchText.toLowerCase();
                if (!q.enunciado.toLowerCase().includes(term)) return false;
            }
            if (visFilter === 'MINE') return q.authorId === user?.id;
            return true;
        });
    }, [allQuestions, selComp, selDisc, searchText, visFilter, user?.id]);

    const handleSave = async () => {
        if(!editing.enunciado || !editing.componentId) { 
            alert('Preencha a Área e o Enunciado.'); 
            return; 
        }
        try {
            const q: any = { 
                ...editing, 
                authorId: editing.authorId || user?.id, 
                institutionId: user?.institutionId, 
                createdAt: editing.createdAt || new Date().toISOString(), 
                reviewStatus: editing.reviewStatus || 'PENDING' 
            };
            if (q.id) await FirebaseService.updateQuestion(q);
            else await FirebaseService.addQuestion(q);
            setIsModalOpen(false); load();
        } catch (e) { alert("Erro ao salvar."); }
    };

    const handlePdfImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImportStep("Extraindo texto...");
        try {
            const text = await PdfService.extractText(file);
            setImportStep("IA estruturando enunciados acadêmicos...");
            const parsed = await GeminiService.parseQuestionsFromText(text);
            if (Array.isArray(parsed) && parsed.length > 0) {
                setBatchQuestions(parsed.map(q => ({
                    ...q,
                    componentId: selComp || '',
                    disciplineId: selDisc || '',
                    difficulty: 'Medium' as const
                })));
                setIsBatchPreviewOpen(true);
            } else alert("Nenhuma questão estruturada encontrada.");
        } catch (error) { alert("Erro no processamento."); } finally { setImportStep(null); e.target.value = ''; }
    };

    const handleRepeatHierarchy = () => {
        if (batchQuestions.length < 2) return;
        const first = batchQuestions[0];
        setBatchQuestions(prev => prev.map((q, idx) => idx === 0 ? q : {
            ...q,
            componentId: first.componentId,
            disciplineId: first.disciplineId,
            chapterId: first.chapterId,
            unitId: first.unitId,
            topicId: first.topicId
        }));
    };

    const handleSaveBatch = async () => {
        const valid = batchQuestions.filter(q => q.enunciado && q.componentId);
        if (valid.length === 0) return alert("Área e Enunciado são obrigatórios.");
        setBatchSaving(true);
        try {
            for (const q of valid) {
                await FirebaseService.addQuestion({ ...q, authorId: user?.id, institutionId: user?.institutionId, createdAt: new Date().toISOString(), reviewStatus: 'PENDING', visibility: 'PUBLIC' } as Question);
            }
            setIsBatchPreviewOpen(false); load();
        } catch (error) { alert("Erro ao salvar lote."); } finally { setBatchSaving(false); }
    };

    const handleAiGenerate = async () => {
        if (!editing.componentId) return alert("Selecione uma área.");
        setIsAiLoading(true);
        try {
            const generated = await GeminiService.generateQuestion("Geral", editing.type || QuestionType.MULTIPLE_CHOICE, editing.difficulty || 'Medium');
            if (generated) setEditing(prev => ({ ...prev, enunciado: generated.enunciado, options: generated.options }));
        } catch (e) { alert("Erro na IA."); } finally { setIsAiLoading(false); }
    };

    const updateBatchQuestion = (idx: number, data: Partial<Question>) => {
        const updated = [...batchQuestions];
        updated[idx] = { ...updated[idx], ...data };
        setBatchQuestions(updated);
    };

    const selectedQuestion = allQuestions.find(q => q.id === selectedQuestionId);

    // INTERFACE DE GABARITO (FIXED State Sync)
    const GabaritoUI = ({ q, onChange, questionIndex = 0 }: { q: Partial<Question>, onChange: (data: Partial<Question>) => void, questionIndex?: number }) => {
        if (q.type === QuestionType.MULTIPLE_CHOICE || q.type === QuestionType.TRUE_FALSE) {
            const radioGroupName = `correct_group_${q.id || 'new'}_${questionIndex}`;
            
            return (
                <div className="space-y-4">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="font-black text-slate-700 uppercase text-[10px] tracking-widest">Alternativas & Gabarito</h4>
                        {q.type === QuestionType.MULTIPLE_CHOICE && (
                            <Button variant="outline" className="text-[10px] h-7 px-3" onClick={() => {
                                const newOpt = { id: Date.now().toString(), text: '', isCorrect: false };
                                onChange({ options: [...(q.options || []), newOpt] });
                            }}>+ Nova Opção</Button>
                        )}
                    </div>
                    <div className="space-y-3">
                        {q.options?.map((opt, idx) => (
                            <div key={idx} className="flex gap-3 items-center group">
                                <div className="flex flex-col items-center">
                                    <input 
                                        type="radio" 
                                        name={radioGroupName}
                                        checked={opt.isCorrect} 
                                        onChange={() => {
                                            // FIX: Cria cópia imutável e atualiza o marcador 'isCorrect'
                                            const newOptions = (q.options || []).map((o, i) => ({ 
                                                ...o, 
                                                isCorrect: i === idx 
                                            }));
                                            onChange({ options: newOptions });
                                        }} 
                                        className="w-5 h-5 text-brand-blue cursor-pointer focus:ring-brand-blue" 
                                    />
                                    <span className="text-[8px] font-black text-slate-400 mt-1 uppercase">Correta</span>
                                </div>
                                <input 
                                    value={opt.text} 
                                    onChange={e => {
                                        const os = [...(q.options || [])];
                                        os[idx] = { ...os[idx], text: e.target.value };
                                        onChange({ options: os });
                                    }} 
                                    className={`flex-1 bg-white border-2 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none transition-all ${opt.isCorrect ? 'border-brand-blue bg-blue-50/30' : 'border-slate-100 focus:border-brand-blue'}`} 
                                    placeholder={`Texto da Opção ${String.fromCharCode(65+idx)}...`} 
                                />
                                {q.type === QuestionType.MULTIPLE_CHOICE && (
                                    <button onClick={() => onChange({ options: q.options?.filter((_, i) => i !== idx) })} className="text-slate-300 hover:text-red-500 transition-colors"><Icons.Trash /></button>
                                )}
                            </div>
                        ))}
                    </div>
                    {q.options?.length === 0 && <p className="text-center text-slate-400 text-xs italic py-4">Nenhuma opção definida.</p>}
                </div>
            );
        }

        if (q.type === QuestionType.NUMERIC) {
            return (
                <div className="bg-blue-50 p-6 rounded-2xl border-2 border-blue-100">
                    <label className="block text-[10px] font-black text-blue-800 uppercase mb-2 tracking-widest">Gabarito Numérico</label>
                    <Input type="number" step="any" placeholder="Valor correto" value={q.options?.[0]?.text || ''} onChange={e => onChange({ options: [{ id: 'num', text: e.target.value, isCorrect: true }] })} className="font-black text-2xl h-14" />
                </div>
            );
        }

        if (q.type === QuestionType.ASSOCIATION) {
            return (
                <div className="space-y-4">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="font-black text-slate-700 uppercase text-[10px] tracking-widest">Pares de Correspondência</h4>
                        <Button variant="outline" className="text-[10px] h-7 px-3" onClick={() => onChange({ pairs: [...(q.pairs || []), { id: Date.now().toString(), left: '', right: '' }] })}>+ Novo Par</Button>
                    </div>
                    {q.pairs?.map((p, idx) => (
                        <div key={idx} className="grid grid-cols-2 gap-4 items-center bg-white p-3 rounded-2xl border-2 border-slate-100 relative">
                            <Input placeholder="Termo A" value={p.left} onChange={e => { const ps = [...(q.pairs || [])]; ps[idx].left = e.target.value; onChange({ pairs: ps }); }} className="text-xs" />
                            <Input placeholder="Respondente B" value={p.right} onChange={e => { const ps = [...(q.pairs || [])]; ps[idx].right = e.target.value; onChange({ pairs: ps }); }} className="text-xs" />
                            <button onClick={() => onChange({ pairs: q.pairs?.filter((_, i) => i !== idx) })} className="absolute -right-2 -top-2 bg-red-500 text-white rounded-full p-1 shadow-lg"><Icons.X className="w-3 h-3" /></button>
                        </div>
                    ))}
                </div>
            );
        }

        if (q.type === QuestionType.SHORT_ANSWER) {
            return (
                <div className="bg-slate-50 p-6 rounded-2xl border-2 border-slate-200">
                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Critérios de Avaliação</label>
                    <textarea 
                        value={q.options?.[0]?.text || ''} 
                        onChange={e => onChange({ options: [{ id: 'sa', text: e.target.value, isCorrect: true }] })} 
                        className="w-full h-32 p-4 rounded-xl border-2 border-slate-200 text-sm font-medium outline-none focus:border-brand-blue bg-white" 
                        placeholder="Quais termos ou conceitos o aluno deve citar?" 
                    />
                </div>
            );
        }

        return null;
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-hidden relative">
            {importStep && (
                <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-md flex items-center justify-center">
                    <div className="bg-white p-12 rounded-[40px] shadow-2xl flex flex-col items-center max-w-sm text-center animate-scale-in">
                        <div className="w-20 h-20 border-8 border-slate-100 border-t-brand-blue rounded-full animate-spin mb-6"></div>
                        <h3 className="text-2xl font-black text-slate-800 mb-2">Processando PDF</h3>
                        <p className="text-slate-500 font-medium">{importStep}</p>
                    </div>
                </div>
            )}

            {/* HEADER */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm z-10">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-2xl font-black font-display text-slate-800 flex items-center gap-2"><Icons.Questions className="text-brand-blue" /> Banco de Questões</h2>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">{filteredQuestions.length} questões encontradas</p>
                    </div>
                    <div className="flex gap-2">
                        <div className="relative">
                            <Button variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 text-xs font-black h-11 px-6 shadow-sm">
                                <Icons.Download className="w-4 h-4" /> Importar PDF
                            </Button>
                            <input type="file" accept=".pdf" onChange={handlePdfImport} className="absolute inset-0 opacity-0 cursor-pointer" />
                        </div>
                        <Button onClick={() => { setEditing({ type: QuestionType.MULTIPLE_CHOICE, difficulty: 'Medium', visibility: 'PUBLIC', options: [], pairs: [] }); setIsModalOpen(true); }} className="shadow-lg h-11 px-6 text-sm">
                            <Icons.Plus /> Nova Questão
                        </Button>
                    </div>
                </div>

                <div className="flex items-end gap-2 overflow-x-auto pb-2 custom-scrollbar">
                    <Select value={selComp} onChange={e => { setSelComp(e.target.value); setSelDisc(''); }} className="min-w-[140px] text-[10px] font-bold h-10">
                        <option value="">Área (Tudo)</option>
                        {availableComponents.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
                    </Select>
                    <Select value={selDisc} onChange={e => setSelDisc(e.target.value)} className="min-w-[140px] text-[10px] font-bold h-10" disabled={!selComp}>
                        <option value="">Disciplina</option>
                        {filterComp?.disciplines?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </Select>
                    <div className="relative min-w-[300px] flex-1">
                        <input type="text" className="w-full pl-10 pr-4 py-2 text-sm border-2 border-slate-200 rounded-xl outline-none focus:border-brand-blue bg-white h-10 font-medium" placeholder="Buscar no enunciado..." value={searchText} onChange={e => setSearchText(e.target.value)} />
                        <div className="absolute left-3.5 top-3 text-slate-400"><Icons.Search className="w-4 h-4" /></div>
                    </div>
                    <Select value={visFilter} onChange={e => setVisFilter(e.target.value as any)} className="w-32 text-[10px] font-bold h-10">
                        <option value="ALL">Global</option>
                        <option value="MINE">Minhas</option>
                    </Select>
                </div>
            </div>

            {/* CONTEÚDO */}
            <div className="flex flex-1 overflow-hidden">
                <div className="w-1/3 min-w-[350px] border-r border-slate-200 bg-white overflow-y-auto custom-scrollbar">
                    {loading ? <div className="p-10 text-center animate-pulse font-black text-slate-300 uppercase text-[11px]">Sincronizando Banco...</div> : (
                        <div className="divide-y divide-slate-100">
                            {filteredQuestions.map(q => (
                                <div key={q.id} onClick={() => setSelectedQuestionId(q.id)} className={`p-6 cursor-pointer hover:bg-slate-50 transition-all border-l-4 ${selectedQuestionId === q.id ? 'bg-blue-50 border-brand-blue' : 'border-transparent'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <Badge color={q.difficulty === 'Hard' ? 'red' : q.difficulty === 'Medium' ? 'orange' : 'green'}>{DifficultyLabels[q.difficulty]}</Badge>
                                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-tight">{QuestionTypeLabels[q.type]}</span>
                                    </div>
                                    <div className="text-sm text-slate-700 line-clamp-2 font-medium rich-text-content mb-2" dangerouslySetInnerHTML={{__html: q.enunciado}} />
                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{hierarchy.find(cc => cc.id === q.componentId)?.name || 'N/A'}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex-1 bg-slate-50 p-10 overflow-y-auto custom-scrollbar">
                    {selectedQuestion ? (
                        <Card className="max-w-4xl mx-auto shadow-2xl border-none p-10">
                            <div className="flex justify-between items-start mb-8 border-b border-slate-100 pb-8">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Localização Pedagógica</p>
                                    <h3 className="text-sm font-black text-slate-800">{FirebaseService.getFullHierarchyString(selectedQuestion, hierarchy)}</h3>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" className="text-xs h-9 font-black" onClick={() => { setEditing(selectedQuestion); setIsModalOpen(true); }}><Icons.Edit /> Editar</Button>
                                    {selectedQuestion.authorId === user?.id && <Button variant="danger" className="text-xs h-9 font-black" onClick={() => { if(confirm('Remover esta questão?')) FirebaseService.deleteQuestion(selectedQuestion.id).then(load); }}><Icons.Trash /></Button>}
                                </div>
                            </div>
                            <div className="prose prose-slate max-w-none mb-12 rich-text-content font-medium text-slate-700 leading-relaxed text-lg" dangerouslySetInnerHTML={{__html: selectedQuestion.enunciado}} />
                            
                            <div className="space-y-4">
                                {selectedQuestion.type === QuestionType.ASSOCIATION ? (
                                    selectedQuestion.pairs?.map((p, i) => (
                                        <div key={i} className="flex gap-3 text-sm font-bold">
                                            <div className="bg-slate-100 p-4 rounded-2xl flex-1 border-2 border-slate-200">{p.left}</div>
                                            <div className="flex items-center text-slate-300"><Icons.ArrowRight /></div>
                                            <div className="bg-blue-50 p-4 border-2 border-blue-200 rounded-2xl flex-1 text-blue-900 shadow-sm">{p.right}</div>
                                        </div>
                                    ))
                                ) : (
                                    selectedQuestion.options?.map((opt, i) => (
                                        <div key={opt.id} className={`p-5 rounded-3xl border-2 flex items-center gap-5 transition-all ${opt.isCorrect ? 'bg-green-50 border-green-300 shadow-md shadow-green-100' : 'bg-white border-slate-100 opacity-80'}`}>
                                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-lg ${opt.isCorrect ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-400'}`}>{String.fromCharCode(65+i)}</div>
                                            <span className={`flex-1 font-bold text-base ${opt.isCorrect ? 'text-green-900' : 'text-slate-700'}`}>{opt.text}</span>
                                            {opt.isCorrect && <div className="bg-green-500 text-white rounded-full p-1"><Icons.Check /></div>}
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300">
                            <div className="w-24 h-24 bg-white rounded-[40px] shadow-xl flex items-center justify-center mb-6"><Icons.Questions className="w-10 h-10" /></div>
                            <p className="text-xl font-black text-slate-400">Banco de Questões</p>
                            <p className="text-sm">Selecione um item para revisar os detalhes.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL LOTE PDF */}
            <Modal isOpen={isBatchPreviewOpen} onClose={() => !batchSaving && setIsBatchPreviewOpen(false)} title="Importação em Lote" maxWidth="max-w-7xl" footer={
                <div className="flex justify-between w-full items-center p-2">
                    <Button onClick={handleRepeatHierarchy} variant="outline" className="text-xs font-black border-slate-300 px-6 h-12 shadow-sm">
                        <Icons.Refresh className="w-4 h-4" /> REPETIR ÁREA DA 1ª PARA TODAS
                    </Button>
                    <Button onClick={handleSaveBatch} disabled={batchSaving} className="px-12 bg-emerald-600 hover:bg-emerald-700 font-black h-12 shadow-2xl text-base">
                        {batchSaving ? 'Salvando...' : `Salvar ${batchQuestions.length} Questões`}
                    </Button>
                </div>
            }>
                <div className="space-y-12 pb-20">
                    {batchQuestions.map((bq, idx) => {
                        const bComp = hierarchy.find(cc => cc.id === bq.componentId);
                        return (
                            <div key={idx} className="p-8 border-2 border-slate-200 rounded-[40px] bg-white shadow-lg relative">
                                <button onClick={() => setBatchQuestions(prev => prev.filter((_, i) => i !== idx))} className="absolute -top-3 -right-3 w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center shadow-xl hover:bg-red-600"><Icons.Trash /></button>
                                <div className="flex justify-between items-center mb-8">
                                    <Badge color="blue">QUESTÃO {idx + 1}</Badge>
                                    <div className="flex gap-3">
                                        <Select value={bq.type} onChange={e => updateBatchQuestion(idx, { type: e.target.value as any, options: [] })} className="w-44 text-[11px] h-10 font-black">
                                            {Object.entries(QuestionTypeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                        </Select>
                                        <Select value={bq.difficulty} onChange={e => updateBatchQuestion(idx, { difficulty: e.target.value as any })} className="w-36 text-[11px] h-10 font-black">
                                            <option value="Easy">Fácil</option><option value="Medium">Média</option><option value="Hard">Difícil</option>
                                        </Select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3 mb-8">
                                    <Select value={bq.componentId || ''} onChange={e => updateBatchQuestion(idx, { componentId: e.target.value, disciplineId: '' })} className={`text-[10px] font-black h-10 ${!bq.componentId ? 'border-red-400 bg-red-50' : ''}`}><option value="">Área...</option>{availableComponents.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}</Select>
                                    <Select value={bq.disciplineId || ''} onChange={e => updateBatchQuestion(idx, { disciplineId: e.target.value })} disabled={!bq.componentId} className="text-[10px] font-black h-10"><option value="">Disciplina...</option>{bComp?.disciplines?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
                                </div>
                                <div className="mb-8">
                                    <RichTextEditor label="Enunciado (Comando da Pergunta)" value={bq.enunciado || ''} onChange={html => updateBatchQuestion(idx, { enunciado: html })} />
                                </div>
                                <div className="bg-slate-50 p-8 rounded-[32px] border-2 border-slate-100">
                                    <GabaritoUI q={bq} questionIndex={idx} onChange={data => updateBatchQuestion(idx, data)} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Modal>

            {/* MODAL INDIVIDUAL */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing.id ? "Alterar Questão" : "Criar Nova Questão"} maxWidth="max-w-5xl" footer={<Button onClick={handleSave} className="px-12 h-14 text-lg shadow-2xl font-black rounded-2xl">SALVAR NO BANCO</Button>}>
                <div className="space-y-8 py-2">
                    <div className="flex flex-wrap gap-4 items-center justify-between bg-slate-900 p-6 rounded-[32px] shadow-2xl">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white"><Icons.Sparkles className="w-6 h-6" /></div>
                            <div><h4 className="text-white text-base font-black uppercase tracking-tight">Criador Assistido</h4><p className="text-slate-400 text-xs">A IA escreve o enunciado e as opções para você</p></div>
                        </div>
                        <Button onClick={handleAiGenerate} disabled={isAiLoading || !editing.componentId} className="bg-white hover:bg-slate-100 text-slate-900 font-black text-xs px-10 h-12 border-none">GERAR COM IA</Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Select label="Área" value={editing.componentId || ''} onChange={e => setEditing({...editing, componentId: e.target.value, disciplineId: ''})}>
                            <option value="">Selecione...</option>
                            {availableComponents.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
                        </Select>
                        <Select label="Disciplina" value={editing.disciplineId || ''} onChange={e => setEditing({...editing, disciplineId: e.target.value})} disabled={!editing.componentId}>
                            <option value="">Selecione...</option>
                            {hierarchy.find(cc => cc.id === editing.componentId)?.disciplines?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-8">
                        <Select label="Tipo de Questão" value={editing.type} onChange={e => setEditing({...editing, type: e.target.value as any, options: [], pairs: []})}>
                            {Object.entries(QuestionTypeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </Select>
                        <Select label="Dificuldade Estimada" value={editing.difficulty} onChange={e => setEditing({...editing, difficulty: e.target.value as any})}>
                            <option value="Easy">Fácil</option><option value="Medium">Média</option><option value="Hard">Difícil</option>
                        </Select>
                    </div>

                    <RichTextEditor label="Enunciado" value={editing.enunciado || ''} onChange={html => setEditing({...editing, enunciado: html})} />
                    
                    <div className="bg-slate-50 p-8 rounded-[32px] border-2 border-slate-100">
                        <GabaritoUI q={editing} onChange={data => setEditing({...editing, ...data})} />
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default QuestionsPage;
