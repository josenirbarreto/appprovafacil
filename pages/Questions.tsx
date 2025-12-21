
import React, { useState, useEffect, useMemo } from 'react';
import { Question, Discipline, QuestionType, UserRole } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { GeminiService } from '../services/geminiService';
import { PdfService } from '../services/pdfService';
import { Button, Modal, Select, Input, Badge, RichTextEditor } from '../components/UI';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';

const QuestionTypeLabels: Record<QuestionType, string> = {
  [QuestionType.MULTIPLE_CHOICE]: 'Múltipla Escolha',
  [QuestionType.TRUE_FALSE]: 'Verdadeiro/Falso',
  [QuestionType.SHORT_ANSWER]: 'Dissertativa',
  [QuestionType.NUMERIC]: 'Numérica',
  [QuestionType.ASSOCIATION]: 'Associação'
};

const getTagColor = (tag: string): "blue" | "green" | "red" | "yellow" | "purple" | "orange" => {
    const colors: any[] = ["blue", "green", "purple", "orange", "yellow", "red"];
    let hash = 0;
    for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
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

    useEffect(() => { if (user) load(); }, [user]);
    
    const load = async () => {
        const [qs, hs] = await Promise.all([FirebaseService.getQuestions(user), FirebaseService.getHierarchy(user)]);
        setAllQuestions(qs);
        setHierarchy(hs);
    };

    const availableTags = useMemo(() => {
        const tags = new Set<string>();
        allQuestions.forEach(q => q.tags?.forEach(t => tags.add(t)));
        return Array.from(tags).sort();
    }, [allQuestions]);

    const filteredQuestions = useMemo(() => {
        return allQuestions.filter(q => {
            if (selDisc && q.disciplineId !== selDisc) return false;
            if (selChap && q.chapterId !== selChap) return false;
            if (selUnit && q.unitId !== selUnit) return false;
            if (selTopic && q.topicId !== selTopic) return false;
            if (selTag && (!q.tags || !q.tags.includes(selTag))) return false;
            
            if (searchText) {
                const term = searchText.toLowerCase();
                if (!(q.enunciado.toLowerCase().includes(term) || q.tags?.some(t => t.toLowerCase().includes(term)))) return false;
            }
            
            if (visFilter === 'MINE') return q.authorId === user?.id;
            if (visFilter === 'SCHOOL') return q.isInstitutional === true || q.visibility === 'INSTITUTION' || (user?.institutionId && q.institutionId === user.institutionId);
            if (visFilter === 'GLOBAL') return q.visibility === 'PUBLIC' && q.reviewStatus === 'APPROVED' && q.authorId !== user?.id && !q.isInstitutional;

            // visFilter === 'ALL'
            return true;
        });
    }, [allQuestions, selDisc, selChap, selUnit, selTopic, selTag, searchText, visFilter, user?.id, user?.institutionId]);

    const selectedQuestion = allQuestions.find(q => q.id === selectedQuestionId);

    const openEditModal = (q: Question) => {
        const isOwner = q.authorId === user?.id;
        const isAdmin = user?.role === UserRole.ADMIN;
        if (isOwner || isAdmin) {
            setIsCloneMode(false);
            setEditing({ ...q, tags: q.tags || [] });
        } else {
            setIsCloneMode(true);
            const { id, authorId, createdAt, isInstitutional, institutionalApprovedById, ...rest } = q;
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
        if(!editing.enunciado || !editing.disciplineId) { alert('Campos obrigatórios: Enunciado e Disciplina'); return; }
        
        const q: any = {
            ...editing,
            id: (isCloneMode ? '' : editing.id) || '',
            authorId: isCloneMode ? user?.id : (editing.authorId || user?.id),
            institutionId: user?.institutionId,
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

    const handleSealInstitutional = async (q: Question) => {
        if (user?.role !== UserRole.MANAGER) return;
        const isSealing = !q.isInstitutional;
        const confirmMsg = isSealing 
            ? "Aprovar esta questão como oficial da instituição? Ela terá visibilidade prioritária para seus professores."
            : "Remover o selo oficial da instituição desta questão?";
        
        if (confirm(confirmMsg)) {
            if (isSealing) await FirebaseService.approveInstitutionalQuestion(q.id, user.id);
            else await FirebaseService.removeInstitutionalSeal(q.id);
            await load();
        }
    };

    const addTag = () => {
        const tag = tagInput.trim();
        if (!tag || (editing.tags || []).includes(tag)) return;
        setEditing({ ...editing, tags: [...(editing.tags || []), tag] });
        setTagInput('');
    };

    const removeTag = (tag: string) => {
        setEditing({ ...editing, tags: (editing.tags || []).filter(t => t !== tag) });
    };

    const getVisibilityBadge = (q: Question) => {
        if (q.isInstitutional) return <Badge color="green"><div className="flex items-center gap-1"><Icons.Shield /> OFICIAL ESCOLA</div></Badge>;
        if (q.visibility === 'PUBLIC') {
            if (q.reviewStatus === 'PENDING') return <Badge color="yellow">Em Análise (Global)</Badge>;
            if (q.reviewStatus === 'REJECTED') return <Badge color="red">Rejeitada</Badge>;
            return <Badge color="purple">Global (Aprovada)</Badge>;
        }
        if (q.visibility === 'INSTITUTION') return <Badge color="orange">Exclusiva Escola</Badge>;
        return <Badge color="blue">Privada</Badge>;
    };

    const openImportModal = () => { 
        setImportContext({ disciplineId: selDisc, chapterId: selChap, unitId: selUnit, topicId: selTopic, visibility: 'PUBLIC' }); 
        setImportFile(null); setExtractedQuestions([]); setImportStep('CONFIG'); setIsImportModalOpen(true); 
    };

    const handleAnalyzePdf = async () => {
        if (!importFile || !importContext.disciplineId) return alert("Selecione arquivo e disciplina destino.");
        setImportLoading(true);
        try {
            const text = await PdfService.extractText(importFile);
            const rawQuestions = await GeminiService.parseQuestionsFromText(text);
            const processed = rawQuestions.map((q, i) => ({ ...q, id: `temp-${Date.now()}-${i}`, ...importContext, visibility: importContext.visibility }));
            setExtractedQuestions(processed);
            setSelectedImportIds(new Set(processed.map(q => q.id!)));
            setImportStep('REVIEW');
        } catch (error) { alert("Erro ao processar PDF."); } finally { setImportLoading(false); }
    };

    const finalizeImport = async () => {
        const toImport = extractedQuestions.filter(q => selectedImportIds.has(q.id!));
        if (toImport.length === 0) return;
        setImportLoading(true);
        try {
            for (const q of toImport) { const { id, ...data } = q; await FirebaseService.addQuestion({ ...data, authorId: user?.id, createdAt: new Date().toISOString() } as Question); }
            alert(`${toImport.length} questões importadas!`);
            setIsImportModalOpen(false); load();
        } catch (e) { alert("Erro ao salvar."); } finally { setImportLoading(false); }
    };

    const openAiModal = () => { 
        setAiParams({ 
            disciplineId: selDisc, 
            chapterId: selChap, 
            unitId: selUnit, 
            topicId: selTopic, 
            type: QuestionType.MULTIPLE_CHOICE, 
            difficulty: 'Medium', 
            instruction: '' 
        }); 
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
                setEditing({ 
                    ...newQ, 
                    disciplineId: aiParams.disciplineId,
                    chapterId: aiParams.chapterId,
                    unitId: aiParams.unitId,
                    topicId: aiParams.topicId,
                    type: aiParams.type,
                    difficulty: aiParams.difficulty as any, 
                    visibility: 'PUBLIC', 
                    tags: [] 
                }); 
                setIsAiModalOpen(false); 
                setIsModalOpen(true);
            } else alert("Erro ao gerar.");
        } catch (e) { alert("Erro na geração."); } finally { setGenerating(false); }
    };

    const activeDiscipline = hierarchy.find(d => d.id === editing.disciplineId);
    const activeChapter = activeDiscipline?.chapters.find(c => c.id === editing.chapterId);
    const activeUnit = activeChapter?.units.find(u => u.id === editing.unitId);

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col gap-4 shadow-sm z-10">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold font-display text-slate-800 flex items-center gap-2"><Icons.Questions /> Banco de Questões</h2>
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={openImportModal} className="text-sm"><Icons.FileText /> Importar PDF</Button>
                        <Button variant="outline" onClick={openAiModal} disabled={generating} className="text-sm font-black border-2"><Icons.Sparkles /> IA Gerar</Button>
                        <Button onClick={openNewModal} className="text-sm"><Icons.Plus /> Nova Questão</Button>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="w-40">
                        <select className="w-full text-sm font-bold border-brand-blue/30 text-brand-blue rounded p-1.5 bg-blue-50 outline-none" value={visFilter} onChange={e => setVisFilter(e.target.value as any)}>
                            <option value="ALL">Todas Origens</option>
                            <option value="MINE">Minhas Questões</option>
                            <option value="SCHOOL">Banco da Escola (Oficiais)</option>
                            <option value="GLOBAL">Banco Global (Público)</option>
                        </select>
                    </div>
                    <div className="w-40"><select className="w-full text-sm border-slate-300 rounded p-1.5 bg-white outline-none" value={selDisc} onChange={e => { setSelDisc(e.target.value); setSelChap(''); setSelUnit(''); setSelTopic(''); }}><option value="">Todas Disciplinas</option>{hierarchy.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                    <div className="flex-1 min-w-[200px] relative"><input type="text" className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-300 rounded outline-none bg-white text-slate-800" placeholder="Buscar no enunciado ou etiquetas..." value={searchText} onChange={e => setSearchText(e.target.value)} /><div className="absolute left-2.5 top-2.5 text-slate-400"><Icons.Search /></div></div>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                <div className="w-1/3 min-w-[300px] max-w-[450px] border-r border-slate-200 bg-white overflow-y-auto custom-scrollbar flex flex-col">
                    {filteredQuestions.length === 0 ? <div className="p-8 text-center text-slate-400">Nenhuma questão encontrada.</div> : (
                        <div className="divide-y divide-slate-100">
                            {filteredQuestions.map(q => (
                                <div key={q.id} onClick={() => setSelectedQuestionId(q.id)} className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors relative group ${selectedQuestionId === q.id ? 'bg-blue-50 border-l-4 border-brand-blue' : 'border-l-4 border-transparent'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase bg-slate-100 text-slate-600">{QuestionTypeLabels[q.type].split(' ')[0]}</span>
                                        {getVisibilityBadge(q)}
                                    </div>
                                    <div className="text-sm text-slate-800 line-clamp-2 font-medium mb-2" dangerouslySetInnerHTML={{__html: q.enunciado || "(Sem texto)"}} />
                                    {q.tags && q.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mb-2">
                                            {q.tags.map(t => <span key={t} className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md border bg-white border-${getTagColor(t)}-200 text-${getTagColor(t)}-600`}>{t}</span>)}
                                        </div>
                                    )}
                                    <div className="text-xs text-slate-400 truncate flex justify-between">
                                        <span>{hierarchy.find(d => d.id === q.disciplineId)?.name || 'Sem disciplina'}</span>
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
                                        <h3 className="text-lg font-bold text-brand-dark">Visualização</h3>
                                        {selectedQuestion.isInstitutional && <Badge color="green">Banco da Escola</Badge>}
                                    </div>
                                    <p className="text-xs text-slate-500">{FirebaseService.getFullHierarchyString(selectedQuestion, hierarchy)}</p>
                                </div>
                                <div className="flex gap-2">
                                    {user?.role === UserRole.MANAGER && selectedQuestion.institutionId === user.institutionId && (
                                        <Button variant={selectedQuestion.isInstitutional ? 'outline' : 'secondary'} onClick={() => handleSealInstitutional(selectedQuestion)} className="h-8 text-xs">
                                            {selectedQuestion.isInstitutional ? 'Remover Selo Escola' : 'Selo Oficial Escola'}
                                        </Button>
                                    )}
                                    <Button variant="ghost" onClick={() => openEditModal(selectedQuestion)} className="h-8 text-xs">
                                        <Icons.Edit /> {selectedQuestion.authorId === user?.id || user?.role === UserRole.ADMIN ? 'Editar' : 'Clonar e Editar'}
                                    </Button>
                                    {(selectedQuestion.authorId === user?.id || user?.role === UserRole.ADMIN) && (
                                        <Button variant="ghost" onClick={() => handleDelete(selectedQuestion.id)} className="h-8 text-xs text-red-500 hover:bg-red-50"><Icons.Trash /> Excluir</Button>
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

            <Modal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                title={isCloneMode ? "Clonar Questão" : (editing.id ? "Editar Questão" : "Nova Questão")} 
                maxWidth="max-w-5xl" 
                footer={<Button onClick={handleSave}>{isCloneMode ? 'Salvar Cópia' : 'Salvar'}</Button>}
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    {/* Coluna 1: Classificação */}
                    <div className="space-y-6">
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                            <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest border-b pb-2">1. Localização Curricular</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <Select label="Disciplina" value={editing.disciplineId || ''} onChange={e => setEditing({...editing, disciplineId: e.target.value, chapterId: '', unitId: '', topicId: ''})}><option value="">Selecione...</option>{hierarchy.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
                                <Select label="Capítulo" value={editing.chapterId || ''} onChange={e => setEditing({...editing, chapterId: e.target.value, unitId: '', topicId: ''})} disabled={!editing.disciplineId}><option value="">Selecione...</option>{activeDiscipline?.chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
                                <Select label="Unidade" value={editing.unitId || ''} onChange={e => setEditing({...editing, unitId: e.target.value, topicId: ''})} disabled={!editing.chapterId}><option value="">Selecione...</option>{activeChapter?.units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</Select>
                                <Select label="Tópico" value={editing.topicId || ''} onChange={e => setEditing({...editing, topicId: e.target.value})} disabled={!editing.unitId}><option value="">Selecione...</option>{activeUnit?.topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
                            </div>
                        </div>

                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                            <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest border-b pb-2">2. Propriedades</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <Select label="Dificuldade" value={editing.difficulty || 'Medium'} onChange={e => setEditing({...editing, difficulty: e.target.value as any})}><option value="Easy">Fácil</option><option value="Medium">Médio</option><option value="Hard">Difícil</option></Select>
                                <Select label="Visibilidade" value={editing.visibility || 'PUBLIC'} onChange={e => setEditing({...editing, visibility: e.target.value as any})}><option value="PUBLIC">🌍 Banco Global</option><option value="INSTITUTION">🏫 Minha Escola</option><option value="PRIVATE">🔒 Somente Eu</option></Select>
                            </div>
                        </div>
                    </div>

                    {/* Coluna 2: Metadata */}
                    <div className="space-y-6">
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4 h-full">
                            <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest border-b pb-2">3. Etiquetas e Tipo</h4>
                            <Select label="Tipo da Questão" value={editing.type || QuestionType.MULTIPLE_CHOICE} onChange={e => setEditing({...editing, type: e.target.value as any})}>{Object.entries(QuestionTypeLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</Select>
                            
                            <div className="pt-2">
                                <label className="text-sm font-bold text-slate-700 mb-2 block">Etiquetas de Organização</label>
                                <div className="flex gap-2 mb-3"><input type="text" className="flex-1 text-sm border border-slate-300 rounded px-3 py-1.5 outline-none focus:ring-2 focus:ring-brand-blue bg-white" placeholder="Ex: Vestibular 2024..." value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}/><button type="button" onClick={addTag} className="bg-brand-blue text-white px-4 rounded font-bold text-xs">ADD</button></div>
                                <div className="flex flex-wrap gap-1.5">{editing.tags?.map(t => (<span key={t} className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded bg-${getTagColor(t)}-100 text-${getTagColor(t)}-800 border border-${getTagColor(t)}-200 shadow-sm`}>{t}<button onClick={() => removeTag(t)} className="hover:text-red-500 ml-1"><Icons.X /></button></span>))}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-8 mt-8 pt-8 border-t border-slate-100">
                    <RichTextEditor label="Enunciado da Questão" value={editing.enunciado || ''} onChange={html => setEditing({...editing, enunciado: html})} />
                    
                    {editing.type === QuestionType.MULTIPLE_CHOICE && (
                        <div className="space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                            <label className="text-sm font-black uppercase text-slate-400 tracking-widest">Alternativas</label>
                            {editing.options?.map((opt, idx) => (
                                <div key={idx} className="flex gap-4 items-center animate-fade-in">
                                    <div className="flex flex-col items-center">
                                        <span className="text-[10px] font-black mb-1">{String.fromCharCode(65+idx)}</span>
                                        <input type="radio" name="correct" checked={opt.isCorrect} onChange={() => { const newOpts = editing.options?.map((o, i) => ({ ...o, isCorrect: i === idx })) || []; setEditing({ ...editing, options: newOpts }); }} className="w-5 h-5 text-brand-blue" />
                                    </div>
                                    <Input className="flex-1" value={opt.text} onChange={e => { const newOpts = [...(editing.options || [])]; newOpts[idx] = { ...newOpts[idx], text: e.target.value }; setEditing({ ...editing, options: newOpts }); }} placeholder={`Texto da alternativa ${idx + 1}...`} />
                                    <button onClick={() => { const newOpts = [...(editing.options || [])]; newOpts.splice(idx, 1); setEditing({ ...editing, options: newOpts }); }} className="text-slate-300 hover:text-red-500 p-2 mt-4"><Icons.Trash /></button>
                                </div>
                            ))}
                            <Button variant="ghost" className="w-full border-2 border-dashed border-slate-300 text-slate-500 mt-2" onClick={() => setEditing({ ...editing, options: [...(editing.options || []), { id: Date.now().toString(), text: '', isCorrect: false }] })}>
                                <Icons.Plus /> Adicionar Opção
                            </Button>
                        </div>
                    )}
                </div>
            </Modal>

            {/* MODAL IA GERAR */}
            <Modal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} title="Assistente de Geração por IA" maxWidth="max-w-3xl" footer={<Button onClick={confirmAiGeneration} disabled={generating || !aiParams.disciplineId}>{generating ? <><span className="animate-spin mr-2">◌</span> Gerando Questão...</> : 'Confirmar e Gerar'}</Button>}>
                <div className="space-y-6">
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-4 text-sm text-blue-800 flex items-start gap-3">
                        <Icons.Sparkles />
                        <p>Preencha os detalhes abaixo para que a IA crie uma questão pedagógica de alta qualidade baseada no seu currículo.</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest border-b pb-1">1. Localização Curricular</h4>
                            <Select label="Disciplina" value={aiParams.disciplineId} onChange={e => setAiParams({...aiParams, disciplineId: e.target.value, chapterId: '', unitId: '', topicId: ''})}>
                                <option value="">Selecione a disciplina...</option>
                                {hierarchy.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </Select>
                            
                            <Select label="Capítulo" value={aiParams.chapterId} onChange={e => setAiParams({...aiParams, chapterId: e.target.value, unitId: '', topicId: ''})} disabled={!aiParams.disciplineId}>
                                <option value="">Todos os capítulos</option>
                                {hierarchy.find(d => d.id === aiParams.disciplineId)?.chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </Select>

                            <Select label="Unidade" value={aiParams.unitId} onChange={e => setAiParams({...aiParams, unitId: e.target.value, topicId: ''})} disabled={!aiParams.chapterId}>
                                <option value="">Todas as unidades</option>
                                {hierarchy.find(d => d.id === aiParams.disciplineId)?.chapters.find(c => c.id === aiParams.chapterId)?.units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </Select>

                            <Select label="Tópico" value={aiParams.topicId} onChange={e => setAiParams({...aiParams, topicId: e.target.value})} disabled={!aiParams.unitId}>
                                <option value="">Todos os tópicos</option>
                                {hierarchy.find(d => d.id === aiParams.disciplineId)?.chapters.find(c => c.id === aiParams.chapterId)?.units.find(u => u.id === aiParams.unitId)?.topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </Select>
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest border-b pb-1">2. Configurações</h4>
                            <Select label="Tipo de Questão" value={aiParams.type} onChange={e => setAiParams({...aiParams, type: e.target.value as any})}>
                                {Object.entries(QuestionTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </Select>
                            
                            <Select label="Dificuldade Sugerida" value={aiParams.difficulty} onChange={e => setAiParams({...aiParams, difficulty: e.target.value as any})}>
                                <option value="Easy">Fácil</option>
                                <option value="Medium">Média</option>
                                <option value="Hard">Difícil / Desafio</option>
                            </Select>

                            <div className="pt-2">
                                <label className="text-sm font-semibold text-slate-700 mb-1 block">Contexto Extra (Opcional)</label>
                                <textarea 
                                    className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-brand-blue outline-none min-h-[100px] bg-white text-slate-800"
                                    placeholder="Ex: Focar em interpretação de gráficos..."
                                    value={aiParams.instruction}
                                    onChange={e => setAiParams({...aiParams, instruction: e.target.value})}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} title="Importar PDF" maxWidth="max-w-4xl" footer={importStep === 'REVIEW' ? <Button onClick={finalizeImport} disabled={importLoading}>Importar</Button> : <Button onClick={handleAnalyzePdf} disabled={!importFile || importLoading}>Analisar</Button>}>{importStep === 'CONFIG' ? (<div className="space-y-6"><div className="bg-blue-50 border-2 border-dashed border-blue-200 p-10 rounded-xl text-center cursor-pointer relative hover:bg-blue-100 transition-colors"><Icons.FileText /><p className="mt-2 font-bold text-blue-900">{importFile ? importFile.name : 'Selecionar PDF'}</p><input type="file" accept=".pdf" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => setImportFile(e.target.files?.[0] || null)} /></div><Select label="Disciplina Destino" value={importContext.disciplineId} onChange={e => setImportContext({...importContext, disciplineId: e.target.value})}><option value="">Selecione...</option>{hierarchy.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></div>) : (<div className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar">{extractedQuestions.map(q => (<div key={q.id} className="border p-4 rounded-lg flex gap-4"><input type="checkbox" checked={selectedImportIds.has(q.id!)} onChange={() => { const s = new Set(selectedImportIds); if(s.has(q.id!)) s.delete(q.id!); else s.add(q.id!); setSelectedImportIds(s); }} /><div className="flex-1" dangerouslySetInnerHTML={{__html: q.enunciado || ""}} /></div>))}</div>)}</Modal>
        </div>
    );
};

export default QuestionsPage;