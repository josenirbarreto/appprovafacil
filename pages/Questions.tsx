
import React, { useState, useEffect, useMemo } from 'react';
import { Question, Discipline, QuestionType, UserRole } from '../types';
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

// Helper para cores dinâmicas de tags
const getTagColor = (tag: string): "blue" | "green" | "red" | "yellow" | "purple" | "orange" => {
    const colors: any[] = ["blue", "green", "purple", "orange", "yellow", "red"];
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
        hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

const QuestionsPage = () => {
    const { user } = useAuth();
    const [allQuestions, setAllQuestions] = useState<Question[]>([]);
    const [hierarchy, setHierarchy] = useState<Discipline[]>([]);
    
    // --- ESTADOS GERAIS ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Partial<Question>>({});
    const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
    const [generating, setGenerating] = useState(false);
    const [isCloneMode, setIsCloneMode] = useState(false);
    const [tagInput, setTagInput] = useState('');

    // --- FILTROS ---
    const [selDisc, setSelDisc] = useState('');
    const [selChap, setSelChap] = useState('');
    const [selUnit, setSelUnit] = useState('');
    const [selTopic, setSelTopic] = useState('');
    const [searchText, setSearchText] = useState('');
    const [visFilter, setVisFilter] = useState<'ALL' | 'MINE' | 'SCHOOL' | 'GLOBAL'>('ALL');
    const [selTag, setSelTag] = useState('');

    // --- ESTADOS - MODAL IA (GERAÇÃO) ---
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [aiParams, setAiParams] = useState({
        disciplineId: '', chapterId: '', unitId: '', topicId: '',
        type: QuestionType.MULTIPLE_CHOICE, difficulty: 'Medium' as 'Easy' | 'Medium' | 'Hard', instruction: ''
    });

    // --- ESTADOS - MODAL IMPORTAÇÃO PDF ---
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importStep, setImportStep] = useState<'CONFIG' | 'REVIEW'>('CONFIG');
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importContext, setImportContext] = useState({ 
        disciplineId: '', chapterId: '', unitId: '', topicId: '', 
        visibility: 'PUBLIC' as 'PUBLIC' | 'PRIVATE' | 'INSTITUTION' 
    });
    const [extractedQuestions, setExtractedQuestions] = useState<Partial<Question>[]>([]);
    const [selectedImportIds, setSelectedImportIds] = useState<Set<string>>(new Set());
    const [importLoading, setImportLoading] = useState(false);
    const [expandedImportId, setExpandedImportId] = useState<string | null>(null);

    useEffect(() => { 
        if (user) load(); 
    }, [user]);
    
    const load = async () => {
        const [qs, hs] = await Promise.all([FirebaseService.getQuestions(user), FirebaseService.getHierarchy(user)]);
        setAllQuestions(qs);
        setHierarchy(hs);
    };

    // Extrai todas as tags únicas para o filtro
    const availableTags = useMemo(() => {
        const tags = new Set<string>();
        allQuestions.forEach(q => q.tags?.forEach(t => tags.add(t)));
        return Array.from(tags).sort();
    }, [allQuestions]);

    const filteredQuestions = allQuestions.filter(q => {
        if (selDisc && q.disciplineId !== selDisc) return false;
        if (selChap && q.chapterId !== selChap) return false;
        if (selUnit && q.unitId !== selUnit) return false;
        if (selTopic && q.topicId !== selTopic) return false;
        if (selTag && (!q.tags || !q.tags.includes(selTag))) return false;
        if (searchText) {
            const term = searchText.toLowerCase();
            return q.enunciado.toLowerCase().includes(term) || q.tags?.some(t => t.toLowerCase().includes(term));
        }
        
        if (visFilter === 'MINE') return q.authorId === user?.id;
        if (visFilter === 'SCHOOL') return q.visibility === 'INSTITUTION' || (user?.institutionId && q.institutionId === user.institutionId);
        if (visFilter === 'GLOBAL') {
             if (q.visibility !== 'PUBLIC') return false;
             if (user?.role === UserRole.ADMIN || q.authorId === user?.id) return true;
             return user?.accessGrants?.includes(q.disciplineId) || false;
        }

        return true;
    });

    const selectedQuestion = allQuestions.find(q => q.id === selectedQuestionId);

    // --- CRUD ---

    const openEditModal = (q: Question) => {
        const isOwner = q.authorId === user?.id;
        const isAdmin = user?.role === UserRole.ADMIN;
        
        if (isOwner || isAdmin) {
            setIsCloneMode(false);
            setEditing({ ...q, tags: q.tags || [] });
        } else {
            setIsCloneMode(true);
            const { id, authorId, createdAt, ...rest } = q;
            setEditing({ ...rest, visibility: 'PRIVATE', tags: q.tags || [] });
        }
        setIsModalOpen(true);
    };

    const openNewModal = () => {
        setIsCloneMode(false);
        setEditing({ 
            type: QuestionType.MULTIPLE_CHOICE, 
            options: Array(4).fill({text:'', isCorrect:false}), 
            disciplineId: selDisc, 
            chapterId: selChap, 
            unitId: selUnit, 
            topicId: selTopic, 
            visibility: 'PUBLIC',
            tags: []
        }); 
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if(!editing.enunciado || !editing.disciplineId) { alert('Preencha os campos obrigatórios (Enunciado e Disciplina)'); return; }
        
        const q: Question = {
            id: (isCloneMode ? '' : editing.id) || '',
            authorId: user?.id, 
            institutionId: user?.institutionId,
            visibility: editing.visibility || 'PUBLIC',
            enunciado: editing.enunciado,
            type: editing.type || QuestionType.MULTIPLE_CHOICE,
            difficulty: editing.difficulty || 'Medium',
            disciplineId: editing.disciplineId,
            chapterId: editing.chapterId || '',
            unitId: editing.unitId || '',
            topicId: editing.topicId || '',
            options: editing.options || [],
            pairs: editing.pairs || [],
            tags: editing.tags || [],
            createdAt: isCloneMode ? new Date().toISOString() : (editing.createdAt || new Date().toISOString())
        };

        if (q.id) await FirebaseService.updateQuestion(q);
        else await FirebaseService.addQuestion(q);
        
        setIsModalOpen(false);
        setIsCloneMode(false);
        await load();
    };

    const handleDelete = async (id: string) => {
        if(confirm('Excluir questão?')) { 
            await FirebaseService.deleteQuestion(id); 
            await load();
            if (selectedQuestionId === id) setSelectedQuestionId(null);
        }
    };

    const addTag = () => {
        const tag = tagInput.trim();
        if (!tag) return;
        const currentTags = editing.tags || [];
        if (!currentTags.includes(tag)) {
            setEditing({ ...editing, tags: [...currentTags, tag] });
        }
        setTagInput('');
    };

    const removeTag = (tag: string) => {
        setEditing({ ...editing, tags: (editing.tags || []).filter(t => t !== tag) });
    };

    const getVisibilityBadge = (q: Question) => {
        if (q.visibility === 'PUBLIC') {
            if (q.reviewStatus === 'PENDING') return <Badge color="yellow">Em Análise</Badge>;
            if (q.reviewStatus === 'REJECTED') return <Badge color="red">Rejeitada</Badge>;
            return <Badge color="green">Global (Aprovada)</Badge>;
        }
        if (q.visibility === 'INSTITUTION') return <Badge color="orange">Escola</Badge>;
        return <Badge color="blue">Privada</Badge>;
    };

    // --- FUNÇÕES DE IMPORTAÇÃO DE PDF ---
    const openImportModal = () => { 
        setImportContext({ 
            disciplineId: selDisc, 
            chapterId: selChap, 
            unitId: selUnit, 
            topicId: selTopic, 
            visibility: 'PUBLIC' 
        }); 
        setImportFile(null); 
        setExtractedQuestions([]); 
        setImportStep('CONFIG'); 
        setIsImportModalOpen(true); 
    };

    const handleAnalyzePdf = async () => {
        if (!importFile) return alert("Selecione um arquivo PDF.");
        if (!importContext.disciplineId) return alert("Selecione a disciplina destino.");
        
        setImportLoading(true);
        try {
            const text = await PdfService.extractText(importFile);
            const rawQuestions = await GeminiService.parseQuestionsFromText(text);
            const processed = rawQuestions.map((q, i) => ({
                ...q,
                id: `temp-${Date.now()}-${i}`,
                ...importContext,
                visibility: importContext.visibility 
            }));
            setExtractedQuestions(processed);
            setSelectedImportIds(new Set(processed.map(q => q.id!)));
            setImportStep('REVIEW');
        } catch (error) {
            console.error(error);
            alert("Erro ao processar PDF.");
        } finally {
            setImportLoading(false);
        }
    };

    const updateExtractedQuestion = (id: string, newEnunciado: string) => {
        setExtractedQuestions(prev => prev.map(q => q.id === id ? { ...q, enunciado: newEnunciado } : q));
    };

    const updateExtractedQuestionOption = (qId: string, optIdx: number, field: 'text' | 'isCorrect', value: any) => {
        setExtractedQuestions(prev => prev.map(q => {
            if (q.id !== qId) return q;
            const newOptions = [...(q.options || [])];
            if (field === 'isCorrect') newOptions.forEach((o, i) => o.isCorrect = i === optIdx);
            else newOptions[optIdx] = { ...newOptions[optIdx], [field]: value };
            return { ...q, options: newOptions };
        }));
    };

    const addExtractedQuestionOption = (qId: string) => {
        setExtractedQuestions(prev => prev.map(q => {
            if (q.id !== qId) return q;
            return { ...q, options: [...(q.options || []), { id: Date.now().toString(), text: '', isCorrect: false }] };
        }));
    };

    const removeExtractedQuestionOption = (qId: string, optIdx: number) => {
        setExtractedQuestions(prev => prev.map(q => {
            if (q.id !== qId) return q;
            const newOptions = [...(q.options || [])];
            newOptions.splice(optIdx, 1);
            return { ...q, options: newOptions };
        }));
    };

    const toggleImportSelection = (id: string) => {
        const newSet = new Set(selectedImportIds);
        if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
        setSelectedImportIds(newSet);
    };

    const finalizeImport = async () => {
        const toImport = extractedQuestions.filter(q => selectedImportIds.has(q.id!));
        if (toImport.length === 0) return;
        setImportLoading(true);
        try {
            for (const q of toImport) {
                const { id, ...data } = q;
                await FirebaseService.addQuestion({ ...data, authorId: user?.id, createdAt: new Date().toISOString() } as Question);
            }
            alert(`${toImport.length} questões importadas!`);
            setIsImportModalOpen(false);
            load();
        } catch (e) {
            console.error(e);
            alert("Erro ao salvar questões.");
        } finally {
            setImportLoading(false);
        }
    };

    // --- FUNÇÕES DE GERAÇÃO POR IA ---
    const openAiModal = () => { 
        setAiParams({ disciplineId: selDisc, chapterId: selChap, unitId: selUnit, topicId: selTopic, type: QuestionType.MULTIPLE_CHOICE, difficulty: 'Medium', instruction: '' }); 
        setIsAiModalOpen(true); 
    };

    const confirmAiGeneration = async () => {
        if (!aiParams.disciplineId) return alert("Selecione a disciplina.");
        setGenerating(true);
        try {
            const disc = hierarchy.find(d => d.id === aiParams.disciplineId);
            const chap = disc?.chapters.find(c => c.id === aiParams.chapterId);
            const unit = chap?.units.find(u => u.id === aiParams.unitId);
            const topic = unit?.topics.find(t => t.id === aiParams.topicId);
            let fullTopic = disc?.name || '';
            if (chap) fullTopic += ` > ${chap.name}`;
            if (unit) fullTopic += ` > ${unit.name}`;
            if (topic) fullTopic += ` > ${topic.name}`;
            if (aiParams.instruction) fullTopic += `. Instrução extra: ${aiParams.instruction}`;
            const newQ = await GeminiService.generateQuestion(fullTopic, aiParams.type, aiParams.difficulty);
            if(newQ) { 
                setIsCloneMode(false); 
                setEditing({ ...newQ, ...aiParams, difficulty: aiParams.difficulty as 'Easy' | 'Medium' | 'Hard', visibility: 'PUBLIC', tags: [] }); 
                setIsAiModalOpen(false); 
                setIsModalOpen(true);
            } else alert("Não foi possível gerar.");
        } catch (e) {
            console.error(e);
            alert("Erro na geração IA.");
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* HEADER & FILTERS */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col gap-4 shadow-sm z-10">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold font-display text-slate-800 flex items-center gap-2"><Icons.Questions /> Banco de Questões</h2>
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={openImportModal} className="text-sm"><Icons.FileText /> Importar PDF</Button>
                        <Button variant="outline" onClick={openAiModal} disabled={generating} className="text-sm"><Icons.Sparkles /> IA Gerar</Button>
                        <Button onClick={openNewModal} className="text-sm"><Icons.Plus /> Nova Questão</Button>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="w-32">
                        <select className="w-full text-sm font-bold border-brand-blue/30 text-brand-blue rounded p-1.5 bg-blue-50 outline-none" value={visFilter} onChange={e => setVisFilter(e.target.value as any)}>
                            <option value="ALL">Todas Origens</option>
                            <option value="MINE">Minhas</option>
                            <option value="SCHOOL">Escola</option>
                            <option value="GLOBAL">Banco Global</option>
                        </select>
                    </div>
                    <div className="w-40"><select className="w-full text-sm border-slate-300 rounded p-1.5 bg-white outline-none" value={selDisc} onChange={e => { setSelDisc(e.target.value); setSelChap(''); setSelUnit(''); setSelTopic(''); }}><option value="">Todas Disciplinas</option>{hierarchy.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                    <div className="w-40"><select className="w-full text-sm border-slate-300 rounded p-1.5 bg-white outline-none" value={selTag} onChange={e => setSelTag(e.target.value)}><option value="">Todas Etiquetas</option>{availableTags.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                    <div className="flex-1 min-w-[200px] relative"><input type="text" className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-300 rounded outline-none bg-white text-slate-800" placeholder="Buscar no enunciado ou etiquetas..." value={searchText} onChange={e => setSearchText(e.target.value)} /><div className="absolute left-2.5 top-2.5 text-slate-400"><Icons.Search /></div></div>
                </div>
            </div>

            {/* MAIN CONTENT SPLIT */}
            <div className="flex flex-1 overflow-hidden">
                <div className="w-1/3 min-w-[300px] max-w-[450px] border-r border-slate-200 bg-white overflow-y-auto custom-scrollbar flex flex-col">
                    <div className="p-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center sticky top-0 z-10 shadow-sm">
                        <span className="text-xs font-bold text-slate-500 uppercase">Lista de Questões</span>
                        <span className="text-xs font-medium text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                            {filteredQuestions.length} de {allQuestions.length}
                        </span>
                    </div>
                    {filteredQuestions.length === 0 ? <div className="p-8 text-center text-slate-400">Nenhuma questão encontrada.</div> : (
                        <div className="divide-y divide-slate-100">
                            {filteredQuestions.map(q => (
                                <div key={q.id} onClick={() => setSelectedQuestionId(q.id)} className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors relative group ${selectedQuestionId === q.id ? 'bg-blue-50 border-l-4 border-brand-blue' : 'border-l-4 border-transparent'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase bg-slate-100 text-slate-600">{QuestionTypeLabels[q.type].split(' ')[0]}</span>
                                        {getVisibilityBadge(q)}
                                    </div>
                                    <div className="text-sm text-slate-800 line-clamp-2 font-medium mb-2" dangerouslySetInnerHTML={{__html: q.enunciado || "(Sem texto)"}} />
                                    
                                    {/* Visualização de Tags na Lista */}
                                    {q.tags && q.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mb-2">
                                            {q.tags.map(t => (
                                                <span key={t} className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md border bg-white border-${getTagColor(t)}-200 text-${getTagColor(t)}-600`}>
                                                    {t}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    <div className="text-xs text-slate-400 truncate flex justify-between">
                                        <span>{hierarchy.find(d => d.id === q.disciplineId)?.name || 'Sem disciplina'}</span>
                                        {q.authorId !== user?.id && <span className="italic text-slate-300">Compartilhada</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex-1 bg-slate-50/50 overflow-y-auto custom-scrollbar p-6 md:p-10 block">
                    {selectedQuestion ? (
                        <div className="max-w-3xl mx-auto w-full animate-fade-in bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-lg font-bold text-brand-dark">Detalhes</h3>
                                        {selectedQuestion.reviewStatus === 'REJECTED' && (
                                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded border border-red-200 font-bold">
                                                Motivo: {selectedQuestion.rejectionReason}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500">{FirebaseService.getFullHierarchyString(selectedQuestion, hierarchy)}</p>
                                    
                                    {/* Tags no Painel de Detalhes */}
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {selectedQuestion.tags?.map(t => (
                                            <span key={t} onClick={() => setSelTag(t)} className={`cursor-pointer text-[10px] font-bold px-2 py-0.5 rounded-full bg-${getTagColor(t)}-100 text-${getTagColor(t)}-800 border border-${getTagColor(t)}-200 hover:brightness-95`}>
                                                {t}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="ghost" onClick={() => openEditModal(selectedQuestion)} className="h-8 text-xs">
                                        <Icons.Edit /> {selectedQuestion.authorId === user?.id || user?.role === UserRole.ADMIN ? 'Editar' : 'Clonar e Editar'}
                                    </Button>
                                    {(selectedQuestion.authorId === user?.id || user?.role === UserRole.ADMIN) && (
                                        <Button variant="ghost" onClick={() => handleDelete(selectedQuestion.id)} className="h-8 text-xs text-red-500 hover:bg-red-50">
                                            <Icons.Trash /> Excluir
                                        </Button>
                                    )}
                                </div>
                            </div>
                            <div className="p-8">
                                <div className="prose prose-slate max-w-none mb-8" dangerouslySetInnerHTML={{__html: selectedQuestion.enunciado}} />
                                {selectedQuestion.type === QuestionType.MULTIPLE_CHOICE && <div className="space-y-2">{selectedQuestion.options?.map((opt, idx) => (<div key={idx} className={`p-3 rounded-lg border flex gap-3 items-center ${opt.isCorrect ? 'bg-green-50 border-green-200' : 'bg-white border-slate-100'}`}><div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border ${opt.isCorrect ? 'bg-green-500 border-green-500 text-white' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>{String.fromCharCode(65 + idx)}</div><span className="flex-1 text-sm">{opt.text}</span>{opt.isCorrect && <Icons.Check />}</div>))}</div>}
                            </div>
                        </div>
                    ) : <div className="h-full flex flex-col items-center justify-center text-slate-300"><div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4"><Icons.Eye /></div><p className="text-lg font-medium">Selecione uma questão</p></div>}
                </div>
            </div>

            {/* MODAL DE EDIÇÃO */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={isCloneMode ? "Clonar e Editar Questão" : "Editar Questão"} maxWidth="max-w-4xl" footer={<Button onClick={handleSave}>{isCloneMode ? 'Salvar Cópia' : 'Salvar Questão'}</Button>}>
                {isCloneMode && <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4 text-sm text-yellow-800"><strong>Modo Clonagem:</strong> Alterações salvas em nova cópia privada.</div>}
                
                <div className="grid grid-cols-2 gap-6 mb-6">
                    <div className="space-y-4">
                        <Select label="Disciplina" value={editing.disciplineId || ''} onChange={e => setEditing({...editing, disciplineId: e.target.value})}><option value="">Selecione...</option>{hierarchy.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
                        <div className="grid grid-cols-2 gap-4">
                            <Select label="Dificuldade" value={editing.difficulty || 'Medium'} onChange={e => setEditing({...editing, difficulty: e.target.value as any})}><option value="Easy">Fácil</option><option value="Medium">Médio</option><option value="Hard">Difícil</option></Select>
                            <Select label="Visibilidade" value={editing.visibility || 'PUBLIC'} onChange={e => setEditing({...editing, visibility: e.target.value as any})}><option value="PUBLIC">🌍 Banco Global</option><option value="INSTITUTION">🏫 Minha Escola</option><option value="PRIVATE">🔒 Somente Eu</option></Select>
                        </div>
                        
                        {/* Gestão de Etiquetas no Modal */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <label className="text-sm font-bold text-slate-700 mb-2 block flex items-center gap-2">
                                <Icons.Filter /> Etiquetas de Organização
                            </label>
                            <div className="flex gap-2 mb-3">
                                <input 
                                    type="text" 
                                    className="flex-1 text-sm border border-slate-300 rounded px-3 py-1.5 outline-none focus:ring-2 focus:ring-brand-blue" 
                                    placeholder="Nova etiqueta (ex: Simulado 1)..." 
                                    value={tagInput}
                                    onChange={e => setTagInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                                />
                                <button type="button" onClick={addTag} className="bg-slate-200 hover:bg-slate-300 text-slate-600 px-3 rounded font-bold text-xs">ADD</button>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {editing.tags?.length === 0 && <p className="text-[10px] text-slate-400 italic">Nenhuma etiqueta atribuída.</p>}
                                {editing.tags?.map(t => (
                                    <span key={t} className={`flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded bg-${getTagColor(t)}-100 text-${getTagColor(t)}-800 border border-${getTagColor(t)}-200`}>
                                        {t}
                                        <button onClick={() => removeTag(t)} className="hover:text-red-500"><Icons.X /></button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <Select label="Capítulo" value={editing.chapterId || ''} onChange={e => setEditing({...editing, chapterId: e.target.value})} disabled={!editing.disciplineId}><option value="">Selecione...</option>{hierarchy.find(d => d.id === editing.disciplineId)?.chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
                        <Select label="Tipo" value={editing.type || QuestionType.MULTIPLE_CHOICE} onChange={e => setEditing({...editing, type: e.target.value as any})}>{Object.entries(QuestionTypeLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</Select>
                    </div>
                </div>

                <div className="space-y-4">
                    <RichTextEditor label="Enunciado" value={editing.enunciado || ''} onChange={html => setEditing({...editing, enunciado: html})} />
                    {editing.type === QuestionType.MULTIPLE_CHOICE && (<div className="space-y-2"><label className="text-sm font-semibold">Alternativas</label>{editing.options?.map((opt, idx) => (<div key={idx} className="flex gap-2 items-center"><input type="radio" name="correct" checked={opt.isCorrect} onChange={() => { const newOpts = editing.options?.map((o, i) => ({ ...o, isCorrect: i === idx })) || []; setEditing({ ...editing, options: newOpts }); }} /><Input value={opt.text} onChange={e => { const newOpts = [...(editing.options || [])]; newOpts[idx] = { ...newOpts[idx], text: e.target.value }; setEditing({ ...editing, options: newOpts }); }} placeholder={`Opção ${idx + 1}`} /><button onClick={() => { const newOpts = [...(editing.options || [])]; newOpts.splice(idx, 1); setEditing({ ...editing, options: newOpts }); }} className="text-red-400 hover:text-red-600 p-1"><Icons.Trash /></button></div>))}<Button variant="ghost" onClick={() => setEditing({ ...editing, options: [...(editing.options || []), { id: Date.now().toString(), text: '', isCorrect: false }] })}>+ Adicionar Opção</Button></div>)}
                </div>
            </Modal>
            
            {/* MODAL IA */}
            <Modal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} title="Gerar com IA" footer={<Button onClick={confirmAiGeneration} disabled={generating}>{generating ? 'Gerando...' : 'Gerar'}</Button>}>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Select label="Disciplina" value={aiParams.disciplineId} onChange={e => setAiParams({...aiParams, disciplineId: e.target.value})}><option value="">Selecione...</option>{hierarchy.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
                        <Select label="Tipo" value={aiParams.type} onChange={e => setAiParams({...aiParams, type: e.target.value as any})}>{Object.entries(QuestionTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
                    </div>
                    <Input label="Instrução Extra" value={aiParams.instruction} onChange={e => setAiParams({...aiParams, instruction: e.target.value})} placeholder="Ex: Nível vestibular..." />
                </div>
            </Modal>

            {/* MODAL IMPORTAÇÃO */}
            <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} title="Importar PDF" maxWidth="max-w-4xl" footer={importStep === 'REVIEW' ? <Button onClick={finalizeImport} disabled={importLoading}>Importar Selecionadas</Button> : <Button onClick={handleAnalyzePdf} disabled={!importFile || importLoading}>Analisar PDF</Button>}>
                {importStep === 'CONFIG' ? (
                    <div className="space-y-6">
                        <div className="bg-blue-50 border-2 border-dashed border-blue-200 p-10 rounded-xl text-center relative cursor-pointer hover:bg-blue-100 transition-colors">
                            <Icons.FileText />
                            <p className="mt-2 font-bold text-blue-900">{importFile ? importFile.name : 'Clique para selecionar PDF'}</p>
                            <input type="file" accept=".pdf" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => setImportFile(e.target.files?.[0] || null)} />
                        </div>
                        <Select label="Disciplina Destino" value={importContext.disciplineId} onChange={e => setImportContext({...importContext, disciplineId: e.target.value})}><option value="">Selecione...</option>{hierarchy.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
                    </div>
                ) : (
                    <div className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar">
                        {extractedQuestions.map((q, idx) => (
                            <div key={q.id} className="border p-4 rounded-lg flex gap-4">
                                <input type="checkbox" checked={selectedImportIds.has(q.id!)} onChange={() => toggleImportSelection(q.id!)} />
                                <div className="flex-1"><RichTextEditor value={q.enunciado || ''} onChange={html => updateExtractedQuestion(q.id!, html)} /></div>
                            </div>
                        ))}
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default QuestionsPage;
