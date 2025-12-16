
import React, { useState, useEffect } from 'react';
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

    // --- FILTROS ---
    const [selDisc, setSelDisc] = useState('');
    const [selChap, setSelChap] = useState('');
    const [selUnit, setSelUnit] = useState('');
    const [selTopic, setSelTopic] = useState('');
    const [searchText, setSearchText] = useState('');
    const [visFilter, setVisFilter] = useState<'ALL' | 'MINE' | 'SCHOOL' | 'GLOBAL'>('ALL');

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
    // Adicionado visibility ao contexto de importação
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
        const [qs, hs] = await Promise.all([FirebaseService.getQuestions(user), FirebaseService.getHierarchy()]);
        setAllQuestions(qs);
        setHierarchy(hs);
    };

    const filteredQuestions = allQuestions.filter(q => {
        if (selDisc && q.disciplineId !== selDisc) return false;
        if (selChap && q.chapterId !== selChap) return false;
        if (selUnit && q.unitId !== selUnit) return false;
        if (selTopic && q.topicId !== selTopic) return false;
        if (searchText) return q.enunciado.toLowerCase().includes(searchText.toLowerCase());
        
        // Filtro de Visibilidade Visual
        if (visFilter === 'MINE') return q.authorId === user?.id;
        if (visFilter === 'SCHOOL') return q.visibility === 'INSTITUTION' || (user?.institutionId && q.institutionId === user.institutionId);
        
        // GLOBAL: Mostra apenas o que é PUBLICO E (É meu OU Sou Admin OU Tenho Grant da Disciplina)
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
            setEditing(q);
        } else {
            // Força Clonagem se não for dono
            setIsCloneMode(true);
            const { id, authorId, createdAt, ...rest } = q;
            // Ao clonar, assume PRIVADO para o novo dono
            setEditing({ ...rest, visibility: 'PRIVATE' });
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
            visibility: 'PUBLIC' 
        }); 
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if(!editing.enunciado || !editing.disciplineId) { alert('Preencha os campos obrigatórios (Enunciado e Disciplina)'); return; }
        
        const q: Question = {
            id: (isCloneMode ? '' : editing.id) || '', // Se for clone, limpa ID para criar novo
            authorId: user?.id, 
            institutionId: user?.institutionId, // Garante vinculo institucional atual
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

    const getVisibilityBadge = (q: Question) => {
        if (q.visibility === 'PUBLIC') return <Badge color="green">Global</Badge>;
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
            // Chama o Gemini para parsear o texto e estruturar as questões
            const rawQuestions = await GeminiService.parseQuestionsFromText(text);
            
            // Adiciona contexto e IDs temporários
            const processed = rawQuestions.map((q, i) => ({
                ...q,
                id: `temp-${Date.now()}-${i}`,
                ...importContext,
                // Força visibility selecionada
                visibility: importContext.visibility 
            }));
            
            setExtractedQuestions(processed);
            setSelectedImportIds(new Set(processed.map(q => q.id!))); // Seleciona todas por padrão
            setImportStep('REVIEW');
        } catch (error) {
            console.error(error);
            alert("Erro ao processar PDF.");
        } finally {
            setImportLoading(false);
        }
    };

    const updateExtractedQuestion = (id: string, newEnunciado: string) => {
        setExtractedQuestions(prev => prev.map(q => 
            q.id === id ? { ...q, enunciado: newEnunciado } : q
        ));
    };

    // --- FUNÇÕES DE EDIÇÃO DE ALTERNATIVAS (IMPORTAÇÃO) ---
    const updateExtractedQuestionOption = (qId: string, optIdx: number, field: 'text' | 'isCorrect', value: any) => {
        setExtractedQuestions(prev => prev.map(q => {
            if (q.id !== qId) return q;
            const newOptions = [...(q.options || [])];
            
            if (field === 'isCorrect') {
                // Comportamento de Radio Button: Desmarca os outros
                newOptions.forEach((o, i) => o.isCorrect = i === optIdx);
            } else {
                newOptions[optIdx] = { ...newOptions[optIdx], [field]: value };
            }
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
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedImportIds(newSet);
    };

    const finalizeImport = async () => {
        const toImport = extractedQuestions.filter(q => selectedImportIds.has(q.id!));
        if (toImport.length === 0) return;
        
        setImportLoading(true);
        try {
            for (const q of toImport) {
                // Remove ID temporário e salva
                const { id, ...data } = q;
                await FirebaseService.addQuestion({
                    ...data,
                    authorId: user?.id,
                    createdAt: new Date().toISOString()
                } as Question);
            }
            alert(`${toImport.length} questões importadas com sucesso!`);
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

            // Constrói o contexto hierárquico completo para o prompt
            let fullTopic = disc?.name || '';
            if (chap) fullTopic += ` > ${chap.name}`;
            if (unit) fullTopic += ` > ${unit.name}`;
            if (topic) fullTopic += ` > ${topic.name}`;
            
            if (aiParams.instruction) fullTopic += `. Instrução extra: ${aiParams.instruction}`;
            
            const newQ = await GeminiService.generateQuestion(fullTopic, aiParams.type, aiParams.difficulty);
            
            if(newQ) { 
                setIsCloneMode(false); 
                setEditing({
                    ...newQ, 
                    ...aiParams,
                    difficulty: aiParams.difficulty as 'Easy' | 'Medium' | 'Hard',
                    visibility: 'PUBLIC' // FORÇA VISIBILIDADE PÚBLICA PARA IA
                }); 
                setIsAiModalOpen(false); 
                setIsModalOpen(true); // Abre o modal de edição para revisar a questão gerada
            } else {
                alert("Não foi possível gerar a questão. Tente novamente.");
            }
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
                {/* Filtros visuais */}
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
                    <div className="w-40"><select className="w-full text-sm border-slate-300 rounded p-1.5 bg-white outline-none" value={selChap} onChange={e => { setSelChap(e.target.value); setSelUnit(''); setSelTopic(''); }} disabled={!selDisc}><option value="">Todos Capítulos</option>{hierarchy.find(d => d.id === selDisc)?.chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                    <div className="flex-1 min-w-[200px] relative"><input type="text" className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-300 rounded outline-none" placeholder="Buscar..." value={searchText} onChange={e => setSearchText(e.target.value)} /><div className="absolute left-2.5 top-2 text-slate-400"><Icons.Search /></div></div>
                </div>
            </div>

            {/* MAIN CONTENT SPLIT */}
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
                                    <div className="text-sm text-slate-800 line-clamp-2 font-medium mb-1" dangerouslySetInnerHTML={{__html: q.enunciado || "(Sem texto)"}} />
                                    <div className="text-xs text-slate-400 truncate flex justify-between">
                                        <span>{hierarchy.find(d => d.id === q.disciplineId)?.name || 'Sem disciplina'}</span>
                                        {q.authorId !== user?.id && <span className="italic text-slate-300">Compartilhada</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                {/* PAINEL DIREITO: Removido 'flex-col' para corrigir rolagem em telas pequenas ou conteúdo longo */}
                <div className="flex-1 bg-slate-50/50 overflow-y-auto custom-scrollbar p-6 md:p-10 block">
                    {selectedQuestion ? (
                        <div className="max-w-3xl mx-auto w-full animate-fade-in bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-start">
                                <div><h3 className="text-lg font-bold text-brand-dark">Detalhes</h3><p className="text-xs text-slate-500">{FirebaseService.getFullHierarchyString(selectedQuestion, hierarchy)}</p></div>
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
                {isCloneMode && (
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4 text-sm text-yellow-800">
                        <strong>Modo de Clonagem:</strong> Esta questão pertence a outro autor. Suas alterações serão salvas em uma nova cópia privada.
                    </div>
                )}
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <Select label="Disciplina" value={editing.disciplineId || ''} onChange={e => setEditing({...editing, disciplineId: e.target.value})}><option value="">Selecione...</option>{hierarchy.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
                    <Select label="Capítulo" value={editing.chapterId || ''} onChange={e => setEditing({...editing, chapterId: e.target.value})} disabled={!editing.disciplineId}><option value="">Selecione...</option>{hierarchy.find(d => d.id === editing.disciplineId)?.chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
                    
                    <div className="col-span-2 grid grid-cols-3 gap-4">
                        <Select label="Dificuldade" value={editing.difficulty || 'Medium'} onChange={e => setEditing({...editing, difficulty: e.target.value as any})}><option value="Easy">Fácil</option><option value="Medium">Médio</option><option value="Hard">Difícil</option></Select>
                        <Select label="Tipo" value={editing.type || QuestionType.MULTIPLE_CHOICE} onChange={e => setEditing({...editing, type: e.target.value as any})}>{Object.entries(QuestionTypeLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</Select>
                        
                        {/* Seletor de Visibilidade (DEFAULT: PUBLICO) */}
                        <Select label="Visibilidade" value={editing.visibility || 'PUBLIC'} onChange={e => setEditing({...editing, visibility: e.target.value as any})}>
                            <option value="PUBLIC">🌍 Banco Global (Pública)</option>
                            <option value="INSTITUTION">🏫 Minha Escola (Institucional)</option>
                            <option value="PRIVATE">🔒 Somente Eu (Privada)</option>
                        </Select>
                    </div>
                </div>
                <div className="space-y-4">
                    <RichTextEditor label="Enunciado" value={editing.enunciado || ''} onChange={html => setEditing({...editing, enunciado: html})} />
                    
                    {/* Campos de Opções */}
                    {editing.type === QuestionType.MULTIPLE_CHOICE && (<div className="space-y-2"><label className="text-sm font-semibold">Alternativas</label>{editing.options?.map((opt, idx) => (<div key={idx} className="flex gap-2 items-center"><input type="radio" name="correct" checked={opt.isCorrect} onChange={() => { const newOpts = editing.options?.map((o, i) => ({ ...o, isCorrect: i === idx })) || []; setEditing({ ...editing, options: newOpts }); }} /><Input value={opt.text} onChange={e => { const newOpts = [...(editing.options || [])]; newOpts[idx] = { ...newOpts[idx], text: e.target.value }; setEditing({ ...editing, options: newOpts }); }} placeholder={`Opção ${idx + 1}`} /><button onClick={() => { const newOpts = [...(editing.options || [])]; newOpts.splice(idx, 1); setEditing({ ...editing, options: newOpts }); }} className="text-red-400 hover:text-red-600 p-1"><Icons.Trash /></button></div>))}<Button variant="ghost" onClick={() => setEditing({ ...editing, options: [...(editing.options || []), { id: Date.now().toString(), text: '', isCorrect: false }] })}>+ Adicionar Opção</Button></div>)}
                </div>
            </Modal>
            
            {/* MODAL DE IA (GERAÇÃO) */}
            <Modal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} title="Gerar Questão com IA" footer={<Button onClick={confirmAiGeneration} disabled={generating}>{generating ? 'Gerando...' : 'Gerar Questão'}</Button>}>
                <div className="space-y-4">
                    <div className="bg-purple-50 p-4 rounded-lg text-purple-900 text-sm border border-purple-200">
                        A Inteligência Artificial criará uma questão única baseada nos detalhes selecionados.
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <Select label="Disciplina" value={aiParams.disciplineId} onChange={e => setAiParams({...aiParams, disciplineId: e.target.value, chapterId: '', unitId: '', topicId: ''})}>
                            <option value="">Selecione...</option>
                            {hierarchy.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </Select>
                        <Select label="Capítulo" value={aiParams.chapterId} onChange={e => setAiParams({...aiParams, chapterId: e.target.value, unitId: '', topicId: ''})} disabled={!aiParams.disciplineId}>
                            <option value="">Selecione...</option>
                            {hierarchy.find(d => d.id === aiParams.disciplineId)?.chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </Select>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <Select label="Unidade" value={aiParams.unitId} onChange={e => setAiParams({...aiParams, unitId: e.target.value, topicId: ''})} disabled={!aiParams.chapterId}>
                            <option value="">Selecione...</option>
                            {hierarchy.find(d => d.id === aiParams.disciplineId)?.chapters.find(c => c.id === aiParams.chapterId)?.units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </Select>
                        <Select label="Tópico" value={aiParams.topicId} onChange={e => setAiParams({...aiParams, topicId: e.target.value})} disabled={!aiParams.unitId}>
                            <option value="">Selecione...</option>
                            {hierarchy.find(d => d.id === aiParams.disciplineId)?.chapters.find(c => c.id === aiParams.chapterId)?.units.find(u => u.id === aiParams.unitId)?.topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Select label="Tipo" value={aiParams.type} onChange={e => setAiParams({...aiParams, type: e.target.value as any})}>
                            {Object.entries(QuestionTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </Select>
                        <Select label="Dificuldade" value={aiParams.difficulty} onChange={e => setAiParams({...aiParams, difficulty: e.target.value as any})}>
                            <option value="Easy">Fácil</option>
                            <option value="Medium">Médio</option>
                            <option value="Hard">Difícil</option>
                        </Select>
                    </div>
                    <Input label="Instrução Extra (Opcional)" value={aiParams.instruction} onChange={e => setAiParams({...aiParams, instruction: e.target.value})} placeholder="Ex: Citar 2 eventos históricos..." />
                </div>
            </Modal>

            {/* MODAL DE IMPORTAÇÃO PDF */}
            <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} title="Importar Prova (PDF)" maxWidth="max-w-4xl" footer={importStep === 'REVIEW' ? <Button onClick={finalizeImport} disabled={importLoading}>{importLoading ? 'Salvando...' : `Importar ${selectedImportIds.size} Questões`}</Button> : <Button onClick={handleAnalyzePdf} disabled={!importFile || importLoading}>{importLoading ? 'Analisando...' : 'Analisar PDF'}</Button>}>
                {importStep === 'CONFIG' ? (
                    <div className="space-y-6">
                        <div className="bg-blue-50 border border-blue-200 p-6 rounded-xl flex flex-col items-center justify-center text-center dashed-border cursor-pointer hover:bg-blue-100 transition-colors relative">
                            <Icons.FileText />
                            <p className="mt-2 font-bold text-blue-900">Clique para selecionar o arquivo PDF</p>
                            <p className="text-xs text-blue-600">Máximo 10MB</p>
                            <input type="file" accept="application/pdf" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => setImportFile(e.target.files?.[0] || null)} />
                        </div>
                        {importFile && <p className="text-center font-bold text-green-600">Arquivo selecionado: {importFile.name}</p>}
                        
                        <div className="border-t border-slate-200 pt-4">
                            <h4 className="font-bold text-slate-700 mb-3">Destino das Questões</h4>
                            
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <Select label="Disciplina" value={importContext.disciplineId} onChange={e => setImportContext({...importContext, disciplineId: e.target.value, chapterId: '', unitId: '', topicId: ''})}><option value="">Selecione...</option>{hierarchy.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
                                <Select label="Capítulo" value={importContext.chapterId} onChange={e => setImportContext({...importContext, chapterId: e.target.value, unitId: '', topicId: ''})} disabled={!importContext.disciplineId}><option value="">Selecione...</option>{hierarchy.find(d => d.id === importContext.disciplineId)?.chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <Select label="Unidade" value={importContext.unitId} onChange={e => setImportContext({...importContext, unitId: e.target.value, topicId: ''})} disabled={!importContext.chapterId}><option value="">Selecione...</option>{hierarchy.find(d => d.id === importContext.disciplineId)?.chapters.find(c => c.id === importContext.chapterId)?.units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</Select>
                                <Select label="Tópico" value={importContext.topicId} onChange={e => setImportContext({...importContext, topicId: e.target.value})} disabled={!importContext.unitId}><option value="">Selecione...</option>{hierarchy.find(d => d.id === importContext.disciplineId)?.chapters.find(c => c.id === importContext.chapterId)?.units.find(u => u.id === importContext.unitId)?.topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
                            </div>

                            <Select label="Visibilidade Padrão" value={importContext.visibility} onChange={e => setImportContext({...importContext, visibility: e.target.value as any})}>
                                <option value="PUBLIC">🌍 Banco Global (Pública)</option>
                                <option value="INSTITUTION">🏫 Minha Escola (Institucional)</option>
                                <option value="PRIVATE">🔒 Somente Eu (Privada)</option>
                            </Select>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center mb-2">
                            <p className="text-sm text-slate-500">Foram encontradas {extractedQuestions.length} questões.</p>
                            <div className="flex gap-2">
                                <button onClick={() => setSelectedImportIds(new Set(extractedQuestions.map(q => q.id!)))} className="text-xs text-brand-blue hover:underline">Marcar Todas</button>
                                <button onClick={() => setSelectedImportIds(new Set())} className="text-xs text-slate-500 hover:underline">Desmarcar Todas</button>
                            </div>
                        </div>
                        <div className="max-h-96 overflow-y-auto custom-scrollbar space-y-3">
                            {extractedQuestions.map((q, idx) => {
                                const isExpanded = expandedImportId === q.id;
                                return (
                                    <div key={q.id} className={`border rounded-lg p-3 transition-colors ${selectedImportIds.has(q.id!) ? 'border-brand-blue bg-blue-50' : 'border-slate-200 bg-white'}`}>
                                        <div className="flex gap-3 items-start cursor-pointer" onClick={() => toggleImportSelection(q.id!)}>
                                            <input type="checkbox" checked={selectedImportIds.has(q.id!)} readOnly className="mt-1" />
                                            <div className="flex-1">
                                                <div className="flex justify-between">
                                                    <span className="font-bold text-slate-700 text-sm">Questão {idx + 1}</span>
                                                    <Badge>{QuestionTypeLabels[q.type!]}</Badge>
                                                </div>
                                                {!isExpanded && <div className="text-sm text-slate-600 mt-1 line-clamp-2" dangerouslySetInnerHTML={{__html: q.enunciado || ''}} />}
                                            </div>
                                            <button onClick={(e) => { e.stopPropagation(); setExpandedImportId(isExpanded ? null : q.id!); }} className="text-slate-400 hover:text-slate-600"><Icons.ChevronDown /></button>
                                        </div>
                                        
                                        {isExpanded && (
                                            <div className="mt-3 pt-3 border-t border-blue-200 animate-fade-in" onClick={e => e.stopPropagation()}>
                                                <label className="text-xs font-bold text-slate-500 mb-1 block">Enunciado (Editável)</label>
                                                <div className="mb-4">
                                                    <RichTextEditor 
                                                        value={q.enunciado || ''} 
                                                        onChange={(html) => updateExtractedQuestion(q.id!, html)} 
                                                    />
                                                </div>
                                                
                                                <div className="pl-2">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <p className="text-xs font-bold text-slate-500">Alternativas e Gabarito</p>
                                                        <span className="text-[10px] text-slate-400">Marque a caixa para definir a correta</span>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {q.options?.map((opt, i) => (
                                                            <div key={i} className="flex gap-2 items-center group">
                                                                <input 
                                                                    type="radio" 
                                                                    name={`correct-${q.id}`} 
                                                                    checked={opt.isCorrect} 
                                                                    onChange={() => updateExtractedQuestionOption(q.id!, i, 'isCorrect', true)}
                                                                    className="cursor-pointer w-4 h-4 text-brand-blue focus:ring-brand-blue"
                                                                    title="Marcar como correta"
                                                                />
                                                                <span className="text-sm font-bold w-6 text-slate-500">{String.fromCharCode(65+i)})</span>
                                                                <input 
                                                                    type="text"
                                                                    value={opt.text} 
                                                                    onChange={(e) => updateExtractedQuestionOption(q.id!, i, 'text', e.target.value)}
                                                                    className="flex-1 border border-slate-300 bg-white text-slate-900 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none transition-all"
                                                                    placeholder={`Alternativa ${String.fromCharCode(65+i)}`}
                                                                />
                                                                <button 
                                                                    onClick={() => removeExtractedQuestionOption(q.id!, i)}
                                                                    className="text-slate-300 hover:text-red-500 p-1"
                                                                    title="Remover alternativa"
                                                                >
                                                                    <Icons.Trash />
                                                                </button>
                                                            </div>
                                                        ))}
                                                        <Button variant="ghost" onClick={() => addExtractedQuestionOption(q.id!)} className="text-xs h-8 mt-2">
                                                            <Icons.Plus /> Adicionar Alternativa
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default QuestionsPage;
