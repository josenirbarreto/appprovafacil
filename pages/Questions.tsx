
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

    const [isImportLoading, setIsImportLoading] = useState(false);
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

    const filterComp = useMemo(() => hierarchy.find(cc => cc.id === selComp), [hierarchy, selComp]);
    const filterDisc = useMemo(() => filterComp?.disciplines?.find(d => d.id === selDisc), [filterComp, selDisc]);
    const filterChap = useMemo(() => filterDisc?.chapters?.find(c => c.id === selChap), [filterDisc, selChap]);
    const filterUnit = useMemo(() => filterChap?.units?.find(u => u.id === selUnit), [filterChap, selUnit]);

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
        // Tópico e Unidade não são mais obrigatórios para salvar
        if(!editing.enunciado || !editing.componentId) { 
            alert('Preencha os campos obrigatórios: Área e Enunciado.'); 
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
        setIsImportLoading(true);
        try {
            const text = await PdfService.extractText(file);
            const parsed = await GeminiService.parseQuestionsFromText(text);
            if (Array.isArray(parsed) && parsed.length > 0) {
                const enriched: Partial<Question>[] = parsed.map(q => ({
                    ...q,
                    componentId: selComp || '',
                    disciplineId: selDisc || '',
                    chapterId: selChap || '',
                    unitId: selUnit || '',
                    topicId: selTopic || '',
                    difficulty: 'Medium' as const
                }));
                setBatchQuestions(enriched);
                setIsBatchPreviewOpen(true);
            } else alert("Nenhuma questão encontrada.");
        } catch (error) { alert("Erro ao ler PDF."); } finally { setIsImportLoading(false); e.target.value = ''; }
    };

    const handleSaveBatch = async () => {
        // Agora permite salvar se tiver Enunciado e Área (componentId)
        const validQuestions = batchQuestions.filter(q => q.enunciado && q.componentId);
        
        if (validQuestions.length === 0) {
            return alert("Nenhuma das questões listadas possui Área e Enunciado definidos.");
        }

        if (validQuestions.length < batchQuestions.length) {
            if (!confirm(`Apenas ${validQuestions.length} de ${batchQuestions.length} questões possuem os dados mínimos (Área e Enunciado) e serão salvas. Deseja continuar?`)) return;
        }
        
        setBatchSaving(true);
        try {
            for (const qData of validQuestions) {
                await FirebaseService.addQuestion({
                    ...qData,
                    authorId: user?.id,
                    institutionId: user?.institutionId,
                    createdAt: new Date().toISOString(),
                    reviewStatus: 'PENDING',
                    visibility: 'PUBLIC'
                } as Question);
            }
            alert(`${validQuestions.length} questões salvas com sucesso!`);
            setIsBatchPreviewOpen(false); load();
        } catch (error) { alert("Erro ao salvar lote."); } finally { setBatchSaving(false); }
    };

    const handleAiGenerate = async () => {
        if (!editing.topicId) return alert("Selecione um tópico primeiro.");
        const topic = activeUnit?.topics.find(t => t.id === editing.topicId);
        if (!topic) return;
        setIsAiLoading(true);
        try {
            const generated = await GeminiService.generateQuestion(topic.name, editing.type || QuestionType.MULTIPLE_CHOICE, editing.difficulty || 'Medium');
            if (generated) setEditing(prev => ({ ...prev, enunciado: generated.enunciado, options: generated.options }));
        } catch (e) { alert("Erro na IA."); } finally { setIsAiLoading(false); }
    };

    const updateBatchQuestion = (idx: number, data: Partial<Question>) => {
        const updated = [...batchQuestions];
        updated[idx] = { ...updated[idx], ...data };
        setBatchQuestions(updated);
    };

    const selectedQuestion = allQuestions.find(q => q.id === selectedQuestionId);

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
            {/* HEADER */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm z-10">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-2xl font-black font-display text-slate-800 flex items-center gap-2">
                            <Icons.Questions className="text-brand-blue" /> Banco de Questões
                        </h2>
                        <div className="flex items-center gap-2 mt-1">
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{filteredQuestions.length} filtradas de {allQuestions.length} totais</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <div className="relative">
                            <Button disabled={isImportLoading} variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 text-xs font-black h-10 px-4">
                                {isImportLoading ? 'Lendo...' : <><Icons.Download className="w-4 h-4" /> Importar PDF</>}
                            </Button>
                            <input type="file" accept=".pdf" onChange={handlePdfImport} className="absolute inset-0 opacity-0 cursor-pointer" />
                        </div>
                        <Button onClick={() => { setEditing({ type: QuestionType.MULTIPLE_CHOICE, difficulty: 'Medium', visibility: 'PUBLIC', options: [] }); setIsModalOpen(true); }} className="shadow-lg shadow-blue-100 h-10">
                            <Icons.Plus /> Nova Questão
                        </Button>
                    </div>
                </div>

                {/* FILTROS LADO A LADO */}
                <div className="flex items-end gap-2 overflow-x-auto pb-2 custom-scrollbar">
                    <Select value={selComp} onChange={e => { setSelComp(e.target.value); setSelDisc(''); setSelChap(''); setSelUnit(''); setSelTopic(''); }} className="min-w-[140px] text-[10px] font-bold h-9">
                        <option value="">Área (Tudo)</option>
                        {availableComponents.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
                    </Select>
                    <Select value={selDisc} onChange={e => { setSelDisc(e.target.value); setSelChap(''); setSelUnit(''); setSelTopic(''); }} className="min-w-[140px] text-[10px] font-bold h-9" disabled={!selComp}>
                        <option value="">Disciplina</option>
                        {filterComp?.disciplines?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </Select>
                    <Select value={selChap} onChange={e => { setSelChap(e.target.value); setSelUnit(''); setSelTopic(''); }} className="min-w-[140px] text-[10px] font-bold h-9" disabled={!selDisc}>
                        <option value="">Capítulo</option>
                        {filterDisc?.chapters?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </Select>
                    <Select value={selUnit} onChange={e => { setSelUnit(e.target.value); setSelTopic(''); }} className="min-w-[140px] text-[10px] font-bold h-9" disabled={!selChap}>
                        <option value="">Unidade</option>
                        {filterChap?.units?.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </Select>
                    <Select value={selTopic} onChange={e => setSelTopic(e.target.value)} className="min-w-[140px] text-[10px] font-bold h-9" disabled={!selUnit}>
                        <option value="">Tópico</option>
                        {filterUnit?.topics?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </Select>
                    <div className="relative min-w-[200px] flex-1">
                        <input type="text" className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-brand-blue bg-white h-9 font-medium" placeholder="Buscar no texto..." value={searchText} onChange={e => setSearchText(e.target.value)} />
                        <div className="absolute left-3 top-2.5 text-slate-400"><Icons.Search className="w-4 h-4" /></div>
                    </div>
                    <Select value={visFilter} onChange={e => setVisFilter(e.target.value as any)} className="w-28 text-[10px] font-bold h-9">
                        <option value="ALL">Global</option>
                        <option value="MINE">Minhas</option>
                    </Select>
                    {(selComp || searchText) && <button onClick={() => { setSelComp(''); setSelDisc(''); setSelChap(''); setSelUnit(''); setSelTopic(''); setSearchText(''); }} className="text-red-500 hover:text-red-700 h-9 px-2 text-[10px] font-black uppercase">Limpar</button>}
                </div>
            </div>

            {/* CONTEÚDO */}
            <div className="flex flex-1 overflow-hidden">
                <div className="w-1/3 min-w-[350px] border-r border-slate-200 bg-white overflow-y-auto custom-scrollbar">
                    {loading ? <div className="p-10 text-center animate-pulse font-bold text-slate-400 uppercase tracking-widest text-[10px]">Sincronizando...</div> : (
                        <div className="divide-y divide-slate-100">
                            {filteredQuestions.map(q => (
                                <div key={q.id} onClick={() => setSelectedQuestionId(q.id)} className={`p-5 cursor-pointer hover:bg-slate-50 transition-all border-l-4 ${selectedQuestionId === q.id ? 'bg-blue-50 border-brand-blue' : 'border-transparent'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <Badge color={q.difficulty === 'Hard' ? 'red' : q.difficulty === 'Medium' ? 'orange' : 'green'}>{DifficultyLabels[q.difficulty] || q.difficulty}</Badge>
                                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">{QuestionTypeLabels[q.type]}</span>
                                    </div>
                                    <div className="text-sm text-slate-700 line-clamp-2 font-medium mb-2 rich-text-content" dangerouslySetInnerHTML={{__html: q.enunciado}} />
                                    <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                        <span>{hierarchy.find(cc => cc.id === q.componentId)?.name || 'N/A'}</span>
                                        {q.authorId === user?.id && <span className="text-brand-blue font-black border border-brand-blue/30 px-1 rounded">MINHA</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex-1 bg-slate-50 p-10 overflow-y-auto custom-scrollbar">
                    {selectedQuestion ? (
                        <Card className="max-w-4xl mx-auto shadow-xl border-none">
                            <div className="flex justify-between items-start mb-8 border-b border-slate-100 pb-6">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Localização Pedagógica</p>
                                    <h3 className="text-sm font-bold text-slate-800">{FirebaseService.getFullHierarchyString(selectedQuestion, hierarchy)}</h3>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" className="text-xs h-9" onClick={() => { setEditing(selectedQuestion); setIsModalOpen(true); }}><Icons.Edit /> Editar</Button>
                                    {selectedQuestion.authorId === user?.id && <Button variant="danger" className="text-xs h-9" onClick={() => { if(confirm('Excluir?')) FirebaseService.deleteQuestion(selectedQuestion.id).then(load); }}><Icons.Trash /></Button>}
                                </div>
                            </div>
                            <div className="prose prose-slate max-w-none mb-10 rich-text-content font-medium text-slate-700 leading-relaxed" dangerouslySetInnerHTML={{__html: selectedQuestion.enunciado}} />
                            {selectedQuestion.options && selectedQuestion.options.length > 0 && selectedQuestion.type !== QuestionType.SHORT_ANSWER && (
                                <div className="space-y-3">
                                    {selectedQuestion.options.map((opt, i) => (
                                        <div key={opt.id} className={`p-4 rounded-2xl border-2 flex items-center gap-4 ${opt.isCorrect ? 'bg-green-50 border-green-200' : 'bg-white border-slate-100'}`}>
                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm ${opt.isCorrect ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-400'}`}>{String.fromCharCode(65+i)}</div>
                                            <span className={`flex-1 font-bold ${opt.isCorrect ? 'text-green-900' : 'text-slate-700'}`}>{opt.text}</span>
                                            {opt.isCorrect && <Icons.Check className="text-green-500" />}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300">
                            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4"><Icons.Questions /></div>
                            <p className="text-lg font-bold">Selecione uma questão para visualizar.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL DE PREVIEW DA IMPORTAÇÃO EM LOTE */}
            <Modal isOpen={isBatchPreviewOpen} onClose={() => !batchSaving && setIsBatchPreviewOpen(false)} title="Revisar Lote do PDF" maxWidth="max-w-7xl" footer={
                <Button onClick={handleSaveBatch} disabled={batchSaving} className="px-10 bg-emerald-600 hover:bg-emerald-700 font-bold h-12 shadow-xl shadow-emerald-100">
                    {batchSaving ? 'Salvando Lote...' : `Salvar Questões Validadas`}
                </Button>
            }>
                <div className="space-y-8 pb-10">
                    <div className="bg-amber-50 border-l-4 border-amber-400 p-4 text-xs text-amber-800 rounded-r-xl">
                        <p className="font-black uppercase tracking-tighter mb-1">Ação Requerida:</p>
                        <p>Defina a hierarquia individual para cada questão abaixo e edite o texto se necessário. Unidades e Tópicos não deverão ser obrigatórios.</p>
                    </div>
                    
                    <div className="space-y-12">
                        {batchQuestions.map((bq, idx) => {
                            const bComp = hierarchy.find(cc => cc.id === bq.componentId);
                            const bDisc = bComp?.disciplines.find(d => d.id === bq.disciplineId);
                            const bChap = bDisc?.chapters.find(c => c.id === bq.chapterId);
                            const bUnit = bChap?.units.find(u => u.id === bq.unitId);

                            return (
                                <div key={idx} className="p-6 border-2 border-slate-200 rounded-3xl bg-white shadow-sm hover:border-brand-blue/50 transition-all relative group">
                                    <button onClick={() => setBatchQuestions(prev => prev.filter((_, i) => i !== idx))} className="absolute -top-3 -right-3 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors z-10">
                                        <Icons.Trash className="w-4 h-4" />
                                    </button>

                                    <div className="flex justify-between items-center mb-6">
                                        <Badge color="blue">QUESTÃO {idx + 1}</Badge>
                                        <div className="flex gap-2">
                                            <Select value={bq.type} onChange={e => updateBatchQuestion(idx, { type: e.target.value as any })} className="w-40 text-[10px] h-8 font-black">
                                                {Object.entries(QuestionTypeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                            </Select>
                                            <Select value={bq.difficulty} onChange={e => updateBatchQuestion(idx, { difficulty: e.target.value as any })} className="w-32 text-[10px] h-8 font-black">
                                                <option value="Easy">Fácil</option>
                                                <option value="Medium">Média</option>
                                                <option value="Hard">Difícil</option>
                                            </Select>
                                        </div>
                                    </div>

                                    {/* HIERARQUIA INDIVIDUAL */}
                                    <div className="grid grid-cols-5 gap-2 mb-6">
                                        <Select value={bq.componentId || ''} onChange={e => updateBatchQuestion(idx, { componentId: e.target.value, disciplineId: '', chapterId: '', unitId: '', topicId: '' })} className="text-[10px] font-bold h-8">
                                            <option value="">Área...</option>
                                            {availableComponents.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
                                        </Select>
                                        <Select value={bq.disciplineId || ''} onChange={e => updateBatchQuestion(idx, { disciplineId: e.target.value, chapterId: '', unitId: '', topicId: '' })} disabled={!bq.componentId} className="text-[10px] font-bold h-8">
                                            <option value="">Disciplina...</option>
                                            {bComp?.disciplines?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                        </Select>
                                        <Select value={bq.chapterId || ''} onChange={e => updateBatchQuestion(idx, { chapterId: e.target.value, unitId: '', topicId: '' })} disabled={!bq.disciplineId} className="text-[10px] font-bold h-8">
                                            <option value="">Capítulo...</option>
                                            {bDisc?.chapters?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </Select>
                                        <Select value={bq.unitId || ''} onChange={e => updateBatchQuestion(idx, { unitId: e.target.value, topicId: '' })} disabled={!bq.chapterId} className="text-[10px] font-bold h-8">
                                            <option value="">Unidade...</option>
                                            {bChap?.units?.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                        </Select>
                                        <Select value={bq.topicId || ''} onChange={e => updateBatchQuestion(idx, { topicId: e.target.value })} disabled={!bq.unitId} className="text-[10px] font-bold h-8 border-brand-blue ring-1 ring-brand-blue/20">
                                            <option value="">Tópico</option>
                                            {bUnit?.topics?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        </Select>
                                    </div>

                                    {/* EDITOR ENUNCIADO NO LOTE COM RICHTEXT */}
                                    <div className="mb-6">
                                        <RichTextEditor label="Enunciado" value={bq.enunciado || ''} onChange={html => updateBatchQuestion(idx, { enunciado: html })} />
                                    </div>

                                    {/* ALTERNATIVAS EDITÁVEIS (Ocultas se dissertativa) */}
                                    {bq.type !== QuestionType.SHORT_ANSWER && (
                                        <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl">
                                            {bq.options?.map((opt, oidx) => (
                                                <div key={oidx} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 focus-within:ring-2 focus-within:ring-brand-blue transition-all">
                                                    <input type="radio" checked={opt.isCorrect} onChange={() => updateBatchQuestion(idx, { options: bq.options?.map((o, i) => ({ ...o, isCorrect: i === oidx })) })} className="w-4 h-4 text-emerald-500 focus:ring-emerald-400" />
                                                    <input value={opt.text} onChange={e => { const os = [...(bq.options || [])]; os[oidx].text = e.target.value; updateBatchQuestion(idx, { options: os }); }} className="flex-1 text-xs font-bold outline-none border-none bg-transparent text-slate-700" placeholder={`Opção ${String.fromCharCode(65+oidx)}`} />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </Modal>

            {/* MODAL INDIVIDUAL */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing.id ? "Editar Questão" : "Criar Nova Questão"} maxWidth="max-w-6xl" footer={<Button onClick={handleSave} className="px-10 h-12 text-base shadow-xl shadow-blue-100 font-bold">Salvar Questão</Button>}>
                <div className="space-y-8 py-2">
                    <div className="flex flex-wrap gap-4 items-center justify-between bg-slate-900 p-4 rounded-2xl shadow-inner">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white"><Icons.Sparkles /></div>
                            <div><h4 className="text-white text-sm font-black uppercase tracking-tight">Criador Assistido</h4><p className="text-slate-400 text-[10px]">Gerado pelo Gemini com base no tópico selecionado</p></div>
                        </div>
                        <Button onClick={handleAiGenerate} disabled={isAiLoading || !editing.topicId} className="bg-gradient-to-r from-purple-600 to-indigo-600 border-none text-white font-black text-xs px-8 py-3">{isAiLoading ? 'Escrevendo...' : <><Icons.Sparkles className="w-4 h-4" /> Gerar com IA</>}</Button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <Select label="Área" value={editing.componentId || ''} onChange={e => setEditing({...editing, componentId: e.target.value, disciplineId: '', chapterId: '', unitId: '', topicId: ''})}>
                            <option value="">Selecione...</option>
                            {availableComponents.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
                        </Select>
                        <Select label="Disciplina" value={editing.disciplineId || ''} onChange={e => setEditing({...editing, disciplineId: e.target.value, chapterId: '', unitId: '', topicId: ''})} disabled={!editing.componentId}>
                            <option value="">Selecione...</option>
                            {activeComp?.disciplines?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </Select>
                        <Select label="Capítulo" value={editing.chapterId || ''} onChange={e => setEditing({...editing, chapterId: e.target.value, unitId: '', topicId: ''})} disabled={!editing.disciplineId}>
                            <option value="">Selecione...</option>
                            {activeDisc?.chapters?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </Select>
                        <Select label="Unidade" value={editing.unitId || ''} onChange={e => setEditing({...editing, unitId: e.target.value, topicId: ''})} disabled={!editing.chapterId}>
                            <option value="">Selecione...</option>
                            {activeChap?.units?.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </Select>
                        <Select label="Tópico" value={editing.topicId || ''} onChange={e => setEditing({...editing, topicId: e.target.value})} disabled={!editing.unitId}>
                            <option value="">Selecione...</option>
                            {activeUnit?.topics?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </Select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-6">
                        <Select label="Tipo" value={editing.type} onChange={e => setEditing({...editing, type: e.target.value as any})}>
                            {Object.entries(QuestionTypeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </Select>
                        <Select label="Dificuldade" value={editing.difficulty} onChange={e => setEditing({...editing, difficulty: e.target.value as any})}>
                            <option value="Easy">Fácil</option>
                            <option value="Medium">Média</option>
                            <option value="Hard">Difícil</option>
                        </Select>
                    </div>

                    <RichTextEditor label="Enunciado" value={editing.enunciado || ''} onChange={html => setEditing({...editing, enunciado: html})} />
                    
                    {/* ALTERNATIVAS INDIVIDUAIS (Ocultas se dissertativa) */}
                    {editing.type !== QuestionType.SHORT_ANSWER && (
                        <div className="space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                            <div className="flex justify-between items-center mb-2"><h4 className="font-black text-slate-700 uppercase text-xs tracking-widest">Alternativas</h4><Button variant="outline" className="text-[10px] h-7 px-3 font-bold" onClick={() => setEditing({...editing, options: [...(editing.options || []), { id: Date.now().toString(), text: '', isCorrect: false }]})}>+ Nova Opção</Button></div>
                            <div className="space-y-3">
                                {Array.isArray(editing.options) && editing.options.map((opt, idx) => (
                                    <div key={idx} className="flex gap-3 items-center group">
                                        <div className="flex flex-col items-center">
                                            <input type="radio" name="correct_option" className="w-5 h-5 text-green-500 cursor-pointer" checked={opt.isCorrect} onChange={() => setEditing({...editing, options: editing.options?.map((o, i) => ({...o, isCorrect: i === idx}))})} />
                                            <span className="text-[8px] font-black text-slate-400 mt-1 uppercase">Gabarito</span>
                                        </div>
                                        <div className="flex-1 bg-white p-1 rounded-xl border border-slate-300 shadow-sm focus-within:ring-2 focus-within:ring-brand-blue">
                                            <input className="w-full bg-transparent border-none outline-none px-3 py-2 text-sm font-bold text-slate-700" value={opt.text} placeholder={`Alternativa ${String.fromCharCode(65+idx)}...`} onChange={e => { const o = [...(editing.options || [])]; o[idx].text = e.target.value; setEditing({...editing, options: o}); }} />
                                        </div>
                                        <button onClick={() => setEditing({...editing, options: editing.options?.filter((_, i) => i !== idx)})} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Icons.Trash /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default QuestionsPage;
