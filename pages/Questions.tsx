
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

// --- COMPONENTE DE GABARITO ---
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
                        }}>+ Adicionar Opção</Button>
                    )}
                </div>
                <div className="space-y-3">
                    {q.options?.map((opt, idx) => (
                        <div key={opt.id} className="flex gap-3 items-center group">
                            <div className="flex flex-col items-center">
                                <input 
                                    type="radio" 
                                    name={radioGroupName}
                                    checked={opt.isCorrect} 
                                    onChange={() => {
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
                                placeholder={`Opção ${String.fromCharCode(65+idx)}...`} 
                            />
                            {q.type === QuestionType.MULTIPLE_CHOICE && (
                                <button onClick={() => onChange({ options: q.options?.filter((_, i) => i !== idx) })} className="text-slate-300 hover:text-red-500 transition-colors"><Icons.Trash /></button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (q.type === QuestionType.NUMERIC) {
        return (
            <div className="bg-blue-50 p-6 rounded-2xl border-2 border-blue-100">
                <label className="block text-[10px] font-black text-blue-800 uppercase mb-2 tracking-widest">Resultado Esperado</label>
                <Input 
                    type="number" 
                    step="any" 
                    placeholder="Digite o valor numérico" 
                    value={q.options?.[0]?.text || ''} 
                    onChange={e => onChange({ options: [{ id: 'num', text: e.target.value, isCorrect: true }] })} 
                    className="font-black text-2xl h-14" 
                />
            </div>
        );
    }

    if (q.type === QuestionType.ASSOCIATION) {
        return (
            <div className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                    <h4 className="font-black text-slate-700 uppercase text-[10px] tracking-widest">Correlação de Pares</h4>
                    <Button variant="outline" className="text-[10px] h-7 px-3" onClick={() => onChange({ pairs: [...(q.pairs || []), { id: Date.now().toString(), left: '', right: '' }] })}>+ Novo Par</Button>
                </div>
                {q.pairs?.map((p, idx) => (
                    <div key={p.id} className="grid grid-cols-2 gap-4 items-center bg-white p-3 rounded-2xl border-2 border-slate-100 relative">
                        <Input placeholder="Coluna A" value={p.left} onChange={e => { const ps = [...(q.pairs || [])]; ps[idx].left = e.target.value; onChange({ pairs: ps }); }} className="text-xs" />
                        <Input placeholder="Coluna B" value={p.right} onChange={e => { const ps = [...(q.pairs || [])]; ps[idx].right = e.target.value; onChange({ pairs: ps }); }} className="text-xs" />
                        <button onClick={() => onChange({ pairs: q.pairs?.filter((_, i) => i !== idx) })} className="absolute -right-2 -top-2 bg-red-500 text-white rounded-full p-1 shadow-lg"><Icons.X className="w-3 h-3" /></button>
                    </div>
                ))}
            </div>
        );
    }

    if (q.type === QuestionType.SHORT_ANSWER) {
        return (
            <div className="bg-slate-50 p-6 rounded-2xl border-2 border-slate-200">
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Critérios do Gabarito</label>
                <textarea 
                    value={q.options?.[0]?.text || ''} 
                    onChange={e => onChange({ options: [{ id: 'sa', text: e.target.value, isCorrect: true }] })} 
                    className="w-full h-32 p-4 rounded-xl border-2 border-slate-200 text-sm font-medium outline-none focus:border-brand-blue bg-white" 
                    placeholder="Quais conceitos o aluno deve citar para pontuar?" 
                />
            </div>
        );
    }

    return null;
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
    const [selChap, setSelChap] = useState('');
    const [selUnit, setSelUnit] = useState('');
    const [selTopic, setSelTopic] = useState('');
    
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

    // Helpers para Filtragem Hierárquica
    const filterComp = useMemo(() => hierarchy.find(cc => cc.id === selComp), [hierarchy, selComp]);
    const filterDisc = useMemo(() => filterComp?.disciplines?.find(d => d.id === selDisc), [filterComp, selDisc]);
    const filterChap = useMemo(() => filterDisc?.chapters?.find(c => c.id === selChap), [filterDisc, selChap]);
    const filterUnit = useMemo(() => filterChap?.units?.find(u => u.id === selUnit), [filterChap, selUnit]);

    // Helpers para Hierarquia Dinâmica no Modal
    const activeComp = useMemo(() => hierarchy.find(cc => cc.id === editing.componentId), [hierarchy, editing.componentId]);
    const activeDisc = useMemo(() => activeComp?.disciplines?.find(d => d.id === editing.disciplineId), [activeComp, editing.disciplineId]);
    const activeChap = useMemo(() => activeDisc?.chapters?.find(c => c.id === editing.chapterId), [activeDisc, editing.chapterId]);
    const activeUnit = useMemo(() => activeChap?.units?.find(u => u.id === editing.unitId), [activeChap, editing.unitId]);

    const filteredQuestions = useMemo(() => {
        return allQuestions.filter(q => {
            if (selComp && q.componentId !== selComp) return false;
            if (selDisc && q.disciplineId !== selDisc) return false;
            if (selChap && q.chapterId !== selChap) return false;
            if (selUnit && q.unitId !== selUnit) return false;
            if (selTopic && q.topicId !== selTopic) return false;
            if (searchText) {
                const term = searchText.toLowerCase();
                if (!q.enunciado.toLowerCase().includes(term)) return false;
            }
            if (visFilter === 'MINE') return q.authorId === user?.id;
            return true;
        });
    }, [allQuestions, selComp, selDisc, selChap, selUnit, selTopic, searchText, visFilter, user?.id]);

    const handleSave = async () => {
        if(!editing.enunciado || !editing.componentId) { 
            alert('Preencha pelo menos a Área e o Enunciado da questão.'); 
            return; 
        }
        try {
            const q: any = { 
                ...editing, 
                authorId: editing.authorId || user?.id, 
                institutionId: user?.institutionId, 
                createdAt: editing.createdAt || new Date().toISOString()
            };
            if (q.id) await FirebaseService.updateQuestion(q);
            else await FirebaseService.addQuestion({ ...q, reviewStatus: q.visibility === 'PUBLIC' ? 'PENDING' : 'APPROVED' });
            setIsModalOpen(false); load();
        } catch (e) { alert("Erro ao salvar a questão."); }
    };

    const handlePdfImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImportStep("Analisando PDF...");
        try {
            const text = await PdfService.extractText(file);
            setImportStep("Estruturando conteúdos...");
            const parsed = await GeminiService.parseQuestionsFromText(text);
            if (Array.isArray(parsed) && parsed.length > 0) {
                setBatchQuestions(parsed.map(q => ({
                    ...q,
                    componentId: selComp || '',
                    disciplineId: selDisc || '',
                    chapterId: selChap || '',
                    unitId: selUnit || '',
                    topicId: selTopic || '',
                    difficulty: 'Medium' as const
                })));
                setIsBatchPreviewOpen(true);
            } else alert("Nenhuma questão reconhecida.");
        } catch (error) { alert("Erro no PDF."); } finally { setImportStep(null); e.target.value = ''; }
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
        if (valid.length === 0) return alert("Complete a área e o enunciado.");
        setBatchSaving(true);
        try {
            for (const q of valid) {
                await FirebaseService.addQuestion({ ...q, authorId: user?.id, institutionId: user?.institutionId, createdAt: new Date().toISOString(), reviewStatus: 'PENDING', visibility: 'PUBLIC' } as Question);
            }
            setIsBatchPreviewOpen(false); load();
        } catch (error) { alert("Erro no salvamento."); } finally { setBatchSaving(false); }
    };

    const updateBatchQuestion = (idx: number, data: Partial<Question>) => {
        const updated = [...batchQuestions];
        updated[idx] = { ...updated[idx], ...data };
        setBatchQuestions(updated);
    };

    const selectedQuestion = allQuestions.find(q => q.id === selectedQuestionId);

    const getReviewStatusBadge = (status?: string) => {
        const base = "px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider border ";
        switch (status) {
            case 'APPROVED': return <span className={`${base} bg-green-500 text-white border-green-600`}>Aprovada</span>;
            case 'REJECTED': return <span className={`${base} bg-red-500 text-white border-red-600`}>Reprovada</span>;
            default: return <span className={`${base} bg-amber-500 text-white border-amber-600`}>Pendente</span>;
        }
    };

    const getQuestionTypeBadge = (type: QuestionType) => {
        const base = "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-tight text-white ";
        switch (type) {
            case QuestionType.MULTIPLE_CHOICE: return <span className={`${base} bg-blue-700`}>Obj: Múltipla</span>;
            case QuestionType.TRUE_FALSE: return <span className={`${base} bg-emerald-700`}>Obj: V/F</span>;
            case QuestionType.SHORT_ANSWER: return <span className={`${base} bg-purple-700`}>Discursiva</span>;
            case QuestionType.NUMERIC: return <span className={`${base} bg-orange-700`}>Numérica</span>;
            case QuestionType.ASSOCIATION: return <span className={`${base} bg-cyan-700`}>Associação</span>;
            default: return <span className={`${base} bg-slate-700`}>Outro</span>;
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-hidden relative">
            {importStep && (
                <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-md flex items-center justify-center">
                    <div className="bg-white p-12 rounded-[40px] shadow-2xl flex flex-col items-center max-w-sm text-center animate-scale-in">
                        <div className="w-20 h-20 border-8 border-slate-100 border-t-brand-blue rounded-full animate-spin mb-6"></div>
                        <h3 className="text-2xl font-black text-slate-800 mb-2">Processamento</h3>
                        <p className="text-slate-500 font-medium">{importStep}</p>
                    </div>
                </div>
            )}

            {/* HEADER DA PÁGINA COM FILTROS DE 5 NÍVEIS */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm z-10">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-2xl font-black font-display text-slate-800 flex items-center gap-2">Banco de Questões</h2>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Acervo Pedagógico Centralizado</p>
                    </div>
                    <div className="flex gap-2">
                        <div className="relative">
                            <Button variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 text-xs font-black h-11 px-6 shadow-sm">
                                <Icons.Download className="w-4 h-4" /> Importar PDF
                            </Button>
                            <input type="file" accept=".pdf" onChange={handlePdfImport} className="absolute inset-0 opacity-0 cursor-pointer" />
                        </div>
                        <Button onClick={() => { setEditing({ type: QuestionType.MULTIPLE_CHOICE, difficulty: 'Medium', visibility: 'PUBLIC', options: [], pairs: [], componentId: '', disciplineId: '', chapterId: '', unitId: '', topicId: '' }); setIsModalOpen(true); }} className="shadow-lg h-11 px-6 text-sm">
                            <Icons.Plus /> Nova Questão
                        </Button>
                    </div>
                </div>

                {/* FILTROS HIERÁRQUICOS */}
                <div className="grid grid-cols-5 gap-2 mb-3">
                    <Select value={selComp} onChange={e => { setSelComp(e.target.value); setSelDisc(''); setSelChap(''); setSelUnit(''); setSelTopic(''); }} className="text-[9px] font-bold h-9">
                        <option value="">1. Área</option>
                        {availableComponents.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
                    </Select>
                    <Select value={selDisc} onChange={e => { setSelDisc(e.target.value); setSelChap(''); setSelUnit(''); setSelTopic(''); }} className="text-[9px] font-bold h-9" disabled={!selComp}>
                        <option value="">2. Disciplina</option>
                        {filterComp?.disciplines?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </Select>
                    <Select value={selChap} onChange={e => { setSelChap(e.target.value); setSelUnit(''); setSelTopic(''); }} className="text-[9px] font-bold h-9" disabled={!selDisc}>
                        <option value="">3. Capítulo</option>
                        {filterDisc?.chapters?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </Select>
                    <Select value={selUnit} onChange={e => { setSelUnit(e.target.value); setSelTopic(''); }} className="text-[9px] font-bold h-9" disabled={!selChap}>
                        <option value="">4. Unidade</option>
                        {filterChap?.units?.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </Select>
                    <Select value={selTopic} onChange={e => setSelTopic(e.target.value)} className="text-[9px] font-bold h-9" disabled={!selUnit}>
                        <option value="">5. Tópico</option>
                        {filterUnit?.topics?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </Select>
                </div>
                
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <input type="text" className="w-full pl-10 pr-4 py-2 text-sm border-2 border-slate-200 rounded-xl outline-none focus:border-brand-blue bg-white h-10 font-medium" placeholder="Buscar enunciado..." value={searchText} onChange={e => setSearchText(e.target.value)} />
                        <div className="absolute left-3.5 top-3 text-slate-400"><Icons.Search className="w-4 h-4" /></div>
                    </div>
                    <Select value={visFilter} onChange={e => setVisFilter(e.target.value as any)} className="w-40 text-[10px] font-bold h-10">
                        <option value="ALL">Todo o Acervo</option>
                        <option value="MINE">Minhas Questões</option>
                    </Select>
                </div>
            </div>

            {/* LISTAGEM E PREVIEW */}
            <div className="flex flex-1 overflow-hidden">
                <div className="w-1/3 min-w-[350px] border-r border-slate-200 bg-white flex flex-col">
                    <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0 shadow-sm z-10">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Barra de Seleção</span>
                        <span className="bg-brand-blue text-white px-4 py-1.5 rounded-full text-[11px] font-black shadow-lg shadow-blue-200">
                            QUESTÕES: {filteredQuestions.length} de {allQuestions.length}
                        </span>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {loading ? <div className="p-10 text-center animate-pulse font-black text-slate-300 uppercase text-[11px]">Sincronizando...</div> : (
                            <div className="divide-y divide-slate-100">
                                {filteredQuestions.map(q => (
                                    <div key={q.id} onClick={() => setSelectedQuestionId(q.id)} className={`p-4 cursor-pointer hover:bg-slate-50 transition-all border-l-4 ${selectedQuestionId === q.id ? 'border-brand-blue bg-blue-50' : 'border-transparent'}`}>
                                        <div className="flex justify-between items-start mb-2 gap-2">
                                            <div className="flex flex-wrap gap-1">
                                                {getQuestionTypeBadge(q.type)}
                                                <Badge color={q.difficulty === 'Hard' ? 'red' : q.difficulty === 'Medium' ? 'orange' : 'green'}>{DifficultyLabels[q.difficulty]}</Badge>
                                            </div>
                                            {getReviewStatusBadge(q.reviewStatus)}
                                        </div>
                                        <div className="text-sm text-slate-700 line-clamp-2 font-medium rich-text-content mb-2" dangerouslySetInnerHTML={{__html: q.enunciado}} />
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">{FirebaseService.getFullHierarchyString(q, hierarchy)}</div>
                                    </div>
                                ))}
                                {filteredQuestions.length === 0 && <div className="p-10 text-center text-slate-400 italic text-sm">Nenhuma questão encontrada.</div>}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex-1 bg-slate-50 p-10 overflow-y-auto custom-scrollbar">
                    {selectedQuestion ? (
                        <Card className="max-w-4xl mx-auto shadow-2xl border-none p-10 rounded-[32px]">
                            {/* ALERTA DE REPROVAÇÃO */}
                            {selectedQuestion.reviewStatus === 'REJECTED' && selectedQuestion.authorId === user?.id && (
                                <div className="mb-8 p-6 bg-red-50 border-2 border-red-200 rounded-[30px] animate-scale-in">
                                    <div className="flex items-center gap-3 text-red-700 font-black mb-3 uppercase text-xs tracking-widest">
                                        <Icons.Shield className="w-5 h-5" /> ⚠️ QUESTÃO REPROVADA PELO MODERADOR
                                    </div>
                                    <p className="text-sm text-red-900 font-bold mb-4 bg-white/50 p-4 rounded-2xl border border-red-100">
                                        Motivo: <span className="font-medium italic">"{selectedQuestion.reviewComment || 'O moderador não forneceu um motivo detalhado.'}"</span>
                                    </p>
                                    <p className="text-xs text-red-600 font-medium leading-relaxed">
                                        A questão foi alterada para <b>Privada</b>. Para torná-la pública novamente, clique em <b>Editar</b>, realize as correções necessárias e salve. Ela será enviada para uma nova rodada de moderação.
                                    </p>
                                </div>
                            )}

                            <div className="flex justify-between items-start mb-8 border-b border-slate-100 pb-8">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Nível Pedagógico (5 Níveis)</p>
                                    <h3 className="text-sm font-black text-slate-800 leading-relaxed">{FirebaseService.getFullHierarchyString(selectedQuestion, hierarchy)}</h3>
                                    <div className="mt-4 flex gap-2">
                                        {getReviewStatusBadge(selectedQuestion.reviewStatus)}
                                        {selectedQuestion.visibility === 'PUBLIC' && <Badge color="blue">Público (Global)</Badge>}
                                        <Badge color="slate">Criado em {new Date(selectedQuestion.createdAt).toLocaleDateString()}</Badge>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" className="text-xs h-9 font-black" onClick={() => { setEditing(selectedQuestion); setIsModalOpen(true); }}><Icons.Edit /> Editar</Button>
                                    {selectedQuestion.authorId === user?.id && <Button variant="danger" className="text-xs h-9 font-black" onClick={() => { if(confirm('Excluir?')) FirebaseService.deleteQuestion(selectedQuestion.id).then(load); }}><Icons.Trash /></Button>}
                                </div>
                            </div>
                            <div className="prose prose-slate max-w-none mb-12 rich-text-content font-medium text-slate-700 leading-relaxed text-lg" dangerouslySetInnerHTML={{__html: selectedQuestion.enunciado}} />
                            
                            {/* Visualização de Resposta correta */}
                            <div className="space-y-4">
                                {selectedQuestion.type === QuestionType.MULTIPLE_CHOICE || selectedQuestion.type === QuestionType.TRUE_FALSE ? (
                                    selectedQuestion.options?.map((opt, i) => (
                                        <div key={opt.id} className={`p-5 rounded-3xl border-2 flex items-center gap-5 transition-all ${opt.isCorrect ? 'bg-green-50 border-green-300 shadow-md shadow-green-100' : 'bg-white border-slate-100 opacity-80'}`}>
                                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-lg ${opt.isCorrect ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-400'}`}>{String.fromCharCode(65+i)}</div>
                                            <span className={`flex-1 font-bold text-base ${opt.isCorrect ? 'text-green-900' : 'text-slate-700'}`}>{opt.text}</span>
                                            {opt.isCorrect && <div className="bg-green-500 text-white rounded-full p-1"><Icons.Check /></div>}
                                        </div>
                                    ))
                                ) : selectedQuestion.type === QuestionType.SHORT_ANSWER || selectedQuestion.type === QuestionType.NUMERIC ? (
                                    <div className="bg-blue-50 border-2 border-blue-100 p-8 rounded-[40px]">
                                        <p className="text-[10px] font-black text-blue-400 uppercase mb-2 tracking-widest">Gabarito / Critérios</p>
                                        <div className="text-blue-900 font-bold text-lg whitespace-pre-wrap">{selectedQuestion.options?.[0]?.text || '(Sem critérios definidos)'}</div>
                                    </div>
                                ) : null}
                            </div>
                        </Card>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300">
                            <Icons.Questions className="w-10 h-10 mb-4" />
                            <p className="text-xl font-black uppercase tracking-widest">Visualização</p>
                            <p className="text-sm">Selecione uma questão para ver os detalhes.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL IMPORTAÇÃO EM LOTE */}
            <Modal isOpen={isBatchPreviewOpen} onClose={() => !batchSaving && setIsBatchPreviewOpen(false)} title="Importação em Lote" maxWidth="max-w-7xl" footer={
                <div className="flex justify-between w-full items-center p-2">
                    <Button onClick={handleRepeatHierarchy} variant="outline" className="text-xs font-black border-slate-300 px-6 h-12 shadow-sm">
                        <Icons.Refresh className="w-4 h-4" /> REPETIR HIERARQUIA DA 1ª PARA TODAS
                    </Button>
                    <Button onClick={handleSaveBatch} disabled={batchSaving} className="px-12 bg-emerald-600 hover:bg-emerald-700 font-black h-12 shadow-2xl text-base">
                        {batchSaving ? 'Salvando...' : `Salvar ${batchQuestions.length} Questões`}
                    </Button>
                </div>
            }>
                <div className="space-y-12 pb-20">
                    {batchQuestions.map((bq, idx) => {
                        const bComp = hierarchy.find(cc => cc.id === bq.componentId);
                        const bDisc = bComp?.disciplines?.find(d => d.id === bq.disciplineId);
                        const bChap = bDisc?.chapters?.find(c => c.id === bq.chapterId);
                        const bUnit = bChap?.units?.find(u => u.id === bq.unitId);

                        return (
                            <div key={idx} className="p-8 border-2 border-slate-200 rounded-[40px] bg-white shadow-lg relative">
                                <button onClick={() => setBatchQuestions(prev => prev.filter((_, i) => i !== idx))} className="absolute -top-3 -right-3 w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center shadow-xl hover:bg-red-600 transition-transform hover:scale-110"><Icons.Trash /></button>
                                <div className="flex justify-between items-center mb-8">
                                    <div className="flex items-center gap-4">
                                        <Badge color="blue">QUESTÃO {idx + 1}</Badge>
                                        <div className="flex gap-1">{getQuestionTypeBadge(bq.type as any)}</div>
                                    </div>
                                    <div className="flex gap-3">
                                        <Select value={bq.type} onChange={e => updateBatchQuestion(idx, { type: e.target.value as any, options: [] })} className="w-44 text-[11px] h-10 font-black">
                                            {Object.entries(QuestionTypeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                        </Select>
                                        <Select value={bq.difficulty} onChange={e => updateBatchQuestion(idx, { difficulty: e.target.value as any })} className="w-36 text-[11px] h-10 font-black">
                                            <option value="Easy">Fácil</option><option value="Medium">Média</option><option value="Hard">Difícil</option>
                                        </Select>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-5 gap-2 mb-8">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-500 uppercase px-1">1. Área</label>
                                        <Select value={bq.componentId || ''} onChange={e => updateBatchQuestion(idx, { componentId: e.target.value, disciplineId: '', chapterId: '', unitId: '', topicId: '' })} className="text-[10px] font-black h-9"><option value="">Selecione...</option>{availableComponents.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}</Select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-500 uppercase px-1">2. Disciplina</label>
                                        <Select value={bq.disciplineId || ''} onChange={e => updateBatchQuestion(idx, { disciplineId: e.target.value, chapterId: '', unitId: '', topicId: '' })} disabled={!bq.componentId} className="text-[10px] font-black h-9"><option value="">Selecione...</option>{bComp?.disciplines?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-500 uppercase px-1">3. Capítulo</label>
                                        <Select value={bq.chapterId || ''} onChange={e => updateBatchQuestion(idx, { chapterId: e.target.value, unitId: '', topicId: '' })} disabled={!bq.disciplineId} className="text-[10px] font-black h-9"><option value="">Selecione...</option>{bDisc?.chapters?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-500 uppercase px-1">4. Unidade</label>
                                        <Select value={bq.unitId || ''} onChange={e => updateBatchQuestion(idx, { unitId: e.target.value, topicId: '' })} disabled={!bq.chapterId} className="text-[10px] font-black h-9"><option value="">Selecione...</option>{bChap?.units?.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</Select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-500 uppercase px-1">5. Tópico</label>
                                        <Select value={bq.topicId || ''} onChange={e => updateBatchQuestion(idx, { topicId: e.target.value })} disabled={!bq.unitId} className="text-[10px] font-black h-9"><option value="">Selecione...</option>{bUnit?.topics?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
                                    </div>
                                </div>

                                <div className="mb-8">
                                    <RichTextEditor label="Enunciado" value={bq.enunciado || ''} onChange={html => updateBatchQuestion(idx, { enunciado: html })} />
                                </div>
                                <div className="bg-slate-50 p-8 rounded-[32px] border-2 border-slate-100">
                                    <GabaritoUI q={bq} questionIndex={idx} onChange={data => updateBatchQuestion(idx, data)} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Modal>

            {/* MODAL EDIÇÃO/CRIAÇÃO INDIVIDUAL */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing.id ? "Modificar Questão" : "Cadastrar Nova Questão"} maxWidth="max-w-6xl" footer={<Button onClick={handleSave} className="px-12 h-14 text-lg shadow-2xl font-black rounded-2xl">SALVAR NO BANCO DE DADOS</Button>}>
                <div className="space-y-8 py-2">
                    <div className="grid grid-cols-5 gap-3">
                        <Select label="1. Área" value={editing.componentId || ''} onChange={e => setEditing({...editing, componentId: e.target.value, disciplineId: '', chapterId: '', unitId: '', topicId: ''})}>
                            <option value="">Selecione...</option>
                            {availableComponents.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
                        </Select>
                        <Select label="2. Disciplina" value={editing.disciplineId || ''} onChange={e => setEditing({...editing, disciplineId: e.target.value, chapterId: '', unitId: '', topicId: ''})} disabled={!editing.componentId}>
                            <option value="">Selecione...</option>
                            {activeComp?.disciplines?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </Select>
                        <Select label="3. Capítulo" value={editing.chapterId || ''} onChange={e => setEditing({...editing, chapterId: e.target.value, unitId: '', topicId: ''})} disabled={!editing.disciplineId}>
                            <option value="">Selecione...</option>
                            {activeDisc?.chapters?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </Select>
                        <Select label="4. Unidade" value={editing.unitId || ''} onChange={e => setEditing({...editing, unitId: e.target.value, topicId: ''})} disabled={!editing.chapterId}>
                            <option value="">Selecione...</option>
                            {activeChap?.units?.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </Select>
                        <Select label="5. Tópico" value={editing.topicId || ''} onChange={e => setEditing({...editing, topicId: e.target.value})} disabled={!editing.unitId}>
                            <option value="">Selecione...</option>
                            {activeUnit?.topics?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t pt-8">
                        <Select label="Tipo de Questão" value={editing.type} onChange={e => setEditing({...editing, type: e.target.value as any, options: [], pairs: []})}>
                            {Object.entries(QuestionTypeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </Select>
                        <Select label="Nível de Dificuldade" value={editing.difficulty} onChange={e => setEditing({...editing, difficulty: e.target.value as any})}>
                            <option value="Easy">Fácil</option><option value="Medium">Média</option><option value="Hard">Difícil</option>
                        </Select>
                    </div>

                    <RichTextEditor label="Enunciado Acadêmico" value={editing.enunciado || ''} onChange={html => setEditing({...editing, enunciado: html})} />
                    
                    <div className="bg-slate-50 p-8 rounded-[32px] border-2 border-slate-100">
                        <GabaritoUI q={editing} onChange={data => setEditing({...editing, ...data})} />
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default QuestionsPage;
