
import React, { useState, useEffect } from 'react';
import { Question, Discipline, QuestionType } from '../types';
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

    // --- FILTROS ---
    const [selDisc, setSelDisc] = useState('');
    const [selChap, setSelChap] = useState('');
    const [selUnit, setSelUnit] = useState('');
    const [selTopic, setSelTopic] = useState('');
    const [searchText, setSearchText] = useState('');

    // --- ESTADOS - MODAL IA (GERAÇÃO) ---
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [aiParams, setAiParams] = useState({
        disciplineId: '', chapterId: '', unitId: '', topicId: '',
        type: QuestionType.MULTIPLE_CHOICE, difficulty: 'Medium', instruction: ''
    });

    // --- ESTADOS - MODAL IMPORTAÇÃO PDF ---
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importStep, setImportStep] = useState<'CONFIG' | 'REVIEW'>('CONFIG');
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importContext, setImportContext] = useState({ disciplineId: '', chapterId: '', unitId: '', topicId: '' });
    const [extractedQuestions, setExtractedQuestions] = useState<Partial<Question>[]>([]);
    const [selectedImportIds, setSelectedImportIds] = useState<Set<string>>(new Set());
    const [importLoading, setImportLoading] = useState(false);
    // Para edição rápida dentro da importação
    const [expandedImportId, setExpandedImportId] = useState<string | null>(null);

    useEffect(() => { 
        if (user) load(); 
    }, [user]);
    
    const load = async () => {
        // Agora passamos o USER para o serviço filtrar os dados
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
        return true;
    });

    const selectedQuestion = allQuestions.find(q => q.id === selectedQuestionId);

    // --- CRUD ---

    const handleSave = async () => {
        if(!editing.enunciado || !editing.disciplineId) { alert('Preencha os campos obrigatórios (Enunciado e Disciplina)'); return; }
        const q: Question = {
            id: editing.id || '',
            authorId: user?.id, // Atribui authorId
            enunciado: editing.enunciado,
            type: editing.type || QuestionType.MULTIPLE_CHOICE,
            difficulty: editing.difficulty || 'Medium',
            disciplineId: editing.disciplineId,
            chapterId: editing.chapterId || '',
            unitId: editing.unitId || '',
            topicId: editing.topicId || '',
            options: editing.options || [],
            pairs: editing.pairs || [],
            createdAt: editing.createdAt || new Date().toISOString()
        };

        if (editing.id) await FirebaseService.updateQuestion(q);
        else await FirebaseService.addQuestion(q);
        
        setIsModalOpen(false);
        await load();
    };

    const handleDelete = async (id: string) => {
        if(confirm('Excluir questão?')) { 
            await FirebaseService.deleteQuestion(id); 
            await load();
            if (selectedQuestionId === id) setSelectedQuestionId(null);
        }
    };

    // --- LÓGICA DE IMPORTAÇÃO DE PDF ---

    const openImportModal = () => {
        setImportContext({ disciplineId: selDisc, chapterId: selChap, unitId: selUnit, topicId: selTopic });
        setImportFile(null);
        setExtractedQuestions([]);
        setImportStep('CONFIG');
        setIsImportModalOpen(true);
    };

    const handleAnalyzePdf = async () => {
        if (!importFile) return alert("Selecione um arquivo PDF.");
        if (!importContext.disciplineId) return alert("Selecione a Disciplina.");

        setImportLoading(true);
        try {
            const text = await PdfService.extractText(importFile);
            const rawQuestions = await GeminiService.parseQuestionsFromText(text);
            
            if (rawQuestions.length === 0) {
                alert("Não foi possível identificar questões neste PDF.");
                setImportLoading(false);
                return;
            }

            const processedQuestions = rawQuestions.map((q, idx) => ({
                ...q,
                id: `temp-${Date.now()}-${idx}`,
                disciplineId: importContext.disciplineId,
                chapterId: importContext.chapterId,
                unitId: importContext.unitId,
                topicId: importContext.topicId,
                createdAt: new Date().toISOString()
            }));

            setExtractedQuestions(processedQuestions);
            setSelectedImportIds(new Set(processedQuestions.map(q => q.id!)));
            setImportStep('REVIEW');

        } catch (error) {
            console.error(error);
            alert("Erro ao processar o arquivo.");
        } finally {
            setImportLoading(false);
        }
    };

    const toggleImportSelection = (id: string) => {
        const newSet = new Set(selectedImportIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedImportIds(newSet);
    };

    const updateExtractedQuestion = (id: string, field: string, value: any) => {
        setExtractedQuestions(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q));
    };

    const updateExtractedOption = (qId: string, optIdx: number, text: string) => {
        setExtractedQuestions(prev => prev.map(q => {
            if (q.id !== qId) return q;
            const newOpts = [...(q.options || [])];
            if (newOpts[optIdx]) newOpts[optIdx] = { ...newOpts[optIdx], text };
            return { ...q, options: newOpts };
        }));
    };

    const finalizeImport = async () => {
        const toSave = extractedQuestions.filter(q => selectedImportIds.has(q.id!));
        if (toSave.length === 0) return;

        setImportLoading(true);
        try {
            for (const q of toSave) {
                const { id, ...cleanQ } = q;
                const finalQ: Question = {
                    id: '',
                    authorId: user?.id,
                    enunciado: cleanQ.enunciado || 'Questão sem texto',
                    type: cleanQ.type || QuestionType.MULTIPLE_CHOICE,
                    difficulty: cleanQ.difficulty || 'Medium',
                    disciplineId: cleanQ.disciplineId || '',
                    chapterId: cleanQ.chapterId || '',
                    unitId: cleanQ.unitId || '',
                    topicId: cleanQ.topicId || '',
                    options: cleanQ.options || [],
                    pairs: cleanQ.pairs || [],
                    createdAt: new Date().toISOString()
                };
                await FirebaseService.addQuestion(finalQ);
            }
            alert(`${toSave.length} questões importadas com sucesso!`);
            setIsImportModalOpen(false);
            load();
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar questões.");
        } finally {
            setImportLoading(false);
        }
    };


    // --- LÓGICA DE GERAÇÃO AI (Botão IA Gerar) ---
    const openAiModal = () => {
        setAiParams({
            disciplineId: selDisc, chapterId: selChap, unitId: selUnit, topicId: selTopic,
            type: QuestionType.MULTIPLE_CHOICE, difficulty: 'Medium', instruction: ''
        });
        setIsAiModalOpen(true);
    };

    const confirmAiGeneration = async () => {
        if (!aiParams.disciplineId) { alert("Selecione pelo menos uma Disciplina."); return; }
        setGenerating(true);
        let contextName = '';
        const disc = hierarchy.find(d => d.id === aiParams.disciplineId);
        const chap = disc?.chapters.find(c => c.id === aiParams.chapterId);
        const unit = chap?.units.find(u => u.id === aiParams.unitId);
        const topic = unit?.topics.find(t => t.id === aiParams.topicId);
        if (topic) contextName = topic.name; else if (unit) contextName = unit.name; else if (chap) contextName = chap.name; else if (disc) contextName = disc.name;
        const finalPrompt = aiParams.instruction ? `${contextName}. Detalhes: ${aiParams.instruction}` : contextName;
        const newQ = await GeminiService.generateQuestion(finalPrompt, aiParams.type, aiParams.difficulty);
        if(newQ) {
            setIsAiModalOpen(false);
            setEditing({ ...newQ, disciplineId: aiParams.disciplineId, chapterId: aiParams.chapterId, unitId: aiParams.unitId, topicId: aiParams.topicId });
            setIsModalOpen(true);
        } else {
            alert('Falha ao gerar questão.');
        }
        setGenerating(false);
    };

    const stripHtml = (html: string) => {
        const tmp = document.createElement("DIV");
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || "";
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
                        <Button onClick={() => { setEditing({ type: QuestionType.MULTIPLE_CHOICE, options: Array(4).fill({text:'', isCorrect:false}), disciplineId: selDisc, chapterId: selChap, unitId: selUnit, topicId: selTopic }); setIsModalOpen(true); }} className="text-sm"><Icons.Plus /> Nova Questão</Button>
                    </div>
                </div>
                {/* Filtros visuais */}
                <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-2 text-slate-500 mr-2"><Icons.Filter /> <span className="text-xs font-bold uppercase tracking-wide">Filtros</span></div>
                    <div className="w-40"><select className="w-full text-sm border-slate-300 rounded p-1.5 bg-white outline-none" value={selDisc} onChange={e => { setSelDisc(e.target.value); setSelChap(''); setSelUnit(''); setSelTopic(''); }}><option value="">Todas Disciplinas</option>{hierarchy.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                    <div className="w-40"><select className="w-full text-sm border-slate-300 rounded p-1.5 bg-white outline-none" value={selChap} onChange={e => { setSelChap(e.target.value); setSelUnit(''); setSelTopic(''); }} disabled={!selDisc}><option value="">Todos Capítulos</option>{hierarchy.find(d => d.id === selDisc)?.chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                    <div className="w-40"><select className="w-full text-sm border-slate-300 rounded p-1.5 bg-white outline-none" value={selUnit} onChange={e => { setSelUnit(e.target.value); setSelTopic(''); }} disabled={!selChap}><option value="">Todas Unidades</option>{hierarchy.find(d => d.id === selDisc)?.chapters.find(c => c.id === selChap)?.units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
                    <div className="w-40"><select className="w-full text-sm border-slate-300 rounded p-1.5 bg-white outline-none" value={selTopic} onChange={e => setSelTopic(e.target.value)} disabled={!selUnit}><option value="">Todos Tópicos</option>{hierarchy.find(d => d.id === selDisc)?.chapters.find(c => c.id === selChap)?.units.find(u => u.id === selUnit)?.topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
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
                                    <div className="flex gap-2 mb-2"><span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase bg-slate-100 text-slate-600">{QuestionTypeLabels[q.type].split(' ')[0]}</span></div>
                                    <p className="text-sm text-slate-800 line-clamp-2 font-medium mb-1">{stripHtml(q.enunciado) || "(Sem texto)"}</p>
                                    <div className="text-xs text-slate-400 truncate">{hierarchy.find(d => d.id === q.disciplineId)?.name || 'Sem disciplina'}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex-1 bg-slate-50/50 overflow-y-auto custom-scrollbar p-6 md:p-10 flex flex-col">
                    {selectedQuestion ? (
                        <div className="max-w-3xl mx-auto w-full animate-fade-in bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-start">
                                <div><h3 className="text-lg font-bold text-brand-dark">Detalhes</h3><p className="text-xs text-slate-500">{FirebaseService.getFullHierarchyString(selectedQuestion, hierarchy)}</p></div>
                                <div className="flex gap-2"><Button variant="ghost" onClick={() => { setEditing(selectedQuestion); setIsModalOpen(true); }} className="h-8 text-xs"><Icons.Edit /> Editar</Button><Button variant="ghost" onClick={() => handleDelete(selectedQuestion.id)} className="h-8 text-xs text-red-500 hover:bg-red-50"><Icons.Trash /> Excluir</Button></div>
                            </div>
                            <div className="p-8">
                                <div className="prose prose-slate max-w-none mb-8" dangerouslySetInnerHTML={{__html: selectedQuestion.enunciado}} />
                                {selectedQuestion.type === QuestionType.MULTIPLE_CHOICE && <div className="space-y-2">{selectedQuestion.options?.map((opt, idx) => (<div key={idx} className={`p-3 rounded-lg border flex gap-3 items-center ${opt.isCorrect ? 'bg-green-50 border-green-200' : 'bg-white border-slate-100'}`}><div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border ${opt.isCorrect ? 'bg-green-500 border-green-500 text-white' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>{String.fromCharCode(65 + idx)}</div><span className="flex-1 text-sm">{opt.text}</span>{opt.isCorrect && <Icons.Check />}</div>))}</div>}
                                {selectedQuestion.type === QuestionType.TRUE_FALSE && <div className="space-y-2">{selectedQuestion.options?.map((opt, idx) => (<div key={idx} className={`p-3 rounded-lg border flex gap-3 items-center ${opt.isCorrect ? 'bg-green-50 border-green-200' : 'bg-white border-slate-100'}`}><div className={`w-4 h-4 rounded-full border ${opt.isCorrect ? 'bg-green-500 border-green-500' : 'border-slate-300'}`}></div><span className="flex-1 text-sm font-medium">{opt.text}</span>{opt.isCorrect && <Badge color="green">Correto</Badge>}</div>))}</div>}
                                {(selectedQuestion.type === QuestionType.SHORT_ANSWER || selectedQuestion.type === QuestionType.NUMERIC) && <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg"><span className="text-xs font-bold text-slate-500 uppercase block mb-1">Gabarito</span><p className="text-slate-800 font-medium">{selectedQuestion.options?.[0]?.text}</p></div>}
                                {selectedQuestion.type === QuestionType.ASSOCIATION && <div className="space-y-2">{selectedQuestion.pairs?.map((p, idx) => (<div key={idx} className="flex items-center gap-4 p-3 bg-slate-50 border rounded-lg"><span className="flex-1 text-right font-medium">{p.itemA}</span><span className="text-slate-400">↔</span><span className="flex-1 font-medium">{p.itemB}</span></div>))}</div>}
                            </div>
                        </div>
                    ) : <div className="flex-1 flex flex-col items-center justify-center text-slate-300"><div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4"><Icons.Eye /></div><p className="text-lg font-medium">Selecione uma questão</p></div>}
                </div>
            </div>

            {/* --- MODAIS --- */}
            {/* ... Modais existentes mantidos idênticos ... */}
            <Modal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} title="Gerar com Inteligência Artificial" footer={<Button onClick={confirmAiGeneration} disabled={generating}>{generating ? 'Gerando...' : 'Gerar Questão'}</Button>}>
                <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 mb-4">
                        Selecione o tópico da matéria e o tipo de questão. A IA criará uma questão única para você revisar.
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
                        <Select label="Tipo de Questão" value={aiParams.type} onChange={e => setAiParams({...aiParams, type: e.target.value as QuestionType})}>
                            {Object.entries(QuestionTypeLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                        </Select>
                        <Select label="Dificuldade" value={aiParams.difficulty} onChange={e => setAiParams({...aiParams, difficulty: e.target.value})}>
                            <option value="Easy">Fácil</option>
                            <option value="Medium">Médio</option>
                            <option value="Hard">Difícil</option>
                        </Select>
                    </div>
                    <div>
                        <Input 
                            label="Detalhes Adicionais (Opcional)" 
                            value={aiParams.instruction} 
                            onChange={e => setAiParams({...aiParams, instruction: e.target.value})} 
                            placeholder="Ex: Focar em fotossíntese; usar contexto histórico; etc." 
                        />
                    </div>
                </div>
            </Modal>

            {/* MODAL IMPORTAR PDF (Mantido mas encurtado para brevidade do XML, lógica igual ao anterior) */}
            <Modal 
                isOpen={isImportModalOpen} 
                onClose={() => setIsImportModalOpen(false)} 
                title={importStep === 'CONFIG' ? "Importar de PDF" : "Revisar Importação"} 
                maxWidth="max-w-5xl"
                footer={
                    importStep === 'CONFIG' 
                    ? <Button onClick={handleAnalyzePdf} disabled={importLoading || !importFile}>{importLoading ? 'Lendo Arquivo...' : 'Ler Arquivo'}</Button>
                    : <Button onClick={finalizeImport} disabled={importLoading || selectedImportIds.size === 0}>{importLoading ? 'Salvando...' : `Importar (${selectedImportIds.size}) Questões`}</Button>
                }
            >
                {/* ... (Conteúdo do modal de importação inalterado, apenas encapsulado) ... */}
                {importStep === 'CONFIG' && (
                    <div className="space-y-6">
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-sm text-orange-800">
                            Defina a qual tópico as questões deste PDF pertencem. Todas as questões extraídas serão vinculadas a esta estrutura.
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <Select label="Disciplina *" value={importContext.disciplineId} onChange={e => setImportContext({...importContext, disciplineId: e.target.value, chapterId: '', unitId: '', topicId: ''})}>
                                <option value="">Selecione...</option>
                                {hierarchy.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </Select>
                            <Select label="Capítulo" value={importContext.chapterId} onChange={e => setImportContext({...importContext, chapterId: e.target.value, unitId: '', topicId: ''})} disabled={!importContext.disciplineId}>
                                <option value="">Selecione...</option>
                                {hierarchy.find(d => d.id === importContext.disciplineId)?.chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </Select>
                            <Select label="Unidade" value={importContext.unitId} onChange={e => setImportContext({...importContext, unitId: e.target.value, topicId: ''})} disabled={!importContext.chapterId}>
                                <option value="">Selecione...</option>
                                {hierarchy.find(d => d.id === importContext.disciplineId)?.chapters.find(c => c.id === importContext.chapterId)?.units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </Select>
                            <Select label="Tópico" value={importContext.topicId} onChange={e => setImportContext({...importContext, topicId: e.target.value})} disabled={!importContext.unitId}>
                                <option value="">Selecione...</option>
                                {hierarchy.find(d => d.id === importContext.disciplineId)?.chapters.find(c => c.id === importContext.chapterId)?.units.find(u => u.id === importContext.unitId)?.topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </Select>
                        </div>
                        <div className="border-t border-slate-200 pt-4">
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Arquivo PDF</label>
                            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors relative cursor-pointer">
                                <input type="file" accept=".pdf" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => setImportFile(e.target.files?.[0] || null)} />
                                <div className="text-brand-blue mb-2"><Icons.FileText /></div>
                                {importFile ? (
                                    <div className="text-center">
                                        <p className="font-bold text-slate-800">{importFile.name}</p>
                                        <p className="text-xs text-slate-500">{(importFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                    </div>
                                ) : (
                                    <div className="text-center">
                                        <p className="text-slate-600 font-medium">Clique ou arraste o PDF aqui</p>
                                        <p className="text-xs text-slate-400 mt-1">Otimizado para provas formatadas</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                {importStep === 'REVIEW' && (
                     <div className="h-full flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <p className="text-slate-600 text-sm">Identificamos <strong>{extractedQuestions.length}</strong> questões. Selecione quais deseja importar.</p>
                            <div className="flex gap-2 text-xs">
                                <button onClick={() => setSelectedImportIds(new Set(extractedQuestions.map(q => q.id!)))} className="text-brand-blue hover:underline">Marcar Todas</button>
                                <span className="text-slate-300">|</span>
                                <button onClick={() => setSelectedImportIds(new Set())} className="text-slate-500 hover:underline">Desmarcar Todas</button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 p-1">
                            {extractedQuestions.map((q, idx) => {
                                const isSelected = selectedImportIds.has(q.id!);
                                const isExpanded = expandedImportId === q.id;
                                return (
                                    <div key={q.id} className={`border rounded-lg transition-all ${isSelected ? 'border-brand-blue bg-blue-50/30' : 'border-slate-200 bg-white opacity-70'}`}>
                                        <div className="p-3 flex gap-3">
                                            <div className="pt-1">
                                                <input type="checkbox" checked={isSelected} onChange={() => toggleImportSelection(q.id!)} className="w-4 h-4 rounded text-brand-blue focus:ring-brand-blue" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start mb-1">
                                                    <Badge color="blue">{QuestionTypeLabels[q.type as QuestionType]?.split(' ')[0]}</Badge>
                                                    <button onClick={() => setExpandedImportId(isExpanded ? null : q.id!)} className="text-xs font-bold text-brand-blue hover:underline bg-white px-2 py-0.5 rounded border border-blue-100">{isExpanded ? 'Recolher' : 'Editar / Detalhes'}</button>
                                                </div>
                                                {!isExpanded && <div className="text-sm text-slate-800 line-clamp-2" dangerouslySetInnerHTML={{__html: q.enunciado || ''}} />}
                                                {isExpanded && (
                                                    <div className="mt-2 space-y-4 animate-fade-in bg-slate-50 p-4 rounded-lg border border-slate-200">
                                                        <div><RichTextEditor label="Enunciado" value={q.enunciado || ''} onChange={(html) => updateExtractedQuestion(q.id!, 'enunciado', html)} /></div>
                                                        {q.type === QuestionType.MULTIPLE_CHOICE && (
                                                            <div className="space-y-2">
                                                                <label className="text-xs font-bold text-slate-500 uppercase">Alternativas</label>
                                                                {q.options?.map((opt, i) => (
                                                                    <div key={i} className="flex gap-2 items-center">
                                                                        <span className={`text-xs font-bold w-4 flex items-center justify-center ${opt.isCorrect ? 'text-green-600' : 'text-slate-400'}`}>{String.fromCharCode(65+i)}</span>
                                                                        <input type="text" value={opt.text} onChange={(e) => updateExtractedOption(q.id!, i, e.target.value)} className={`flex-1 text-sm border rounded p-2 outline-none transition-colors text-slate-800 ${opt.isCorrect ? 'border-green-300 bg-green-50 font-medium' : 'border-slate-300 bg-white'}`} />
                                                                        <input type="radio" name={`correct-${q.id}`} checked={opt.isCorrect} onChange={() => { const newOpts = q.options?.map((o, idxOpt) => ({ ...o, isCorrect: idxOpt === i })); updateExtractedQuestion(q.id!, 'options', newOpts); }} className="w-4 h-4 text-brand-blue" />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </Modal>

            {/* MODAL DE EDIÇÃO MANUAL (Mesmo anterior, inalterado) */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Editar Questão" maxWidth="max-w-4xl" footer={<Button onClick={handleSave}>Salvar Questão</Button>}>
                {/* ... (Conteúdo do modal de edição) ... */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <Select label="Disciplina" value={editing.disciplineId || ''} onChange={e => setEditing({...editing, disciplineId: e.target.value})}><option value="">Selecione...</option>{hierarchy.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
                    <Select label="Capítulo" value={editing.chapterId || ''} onChange={e => setEditing({...editing, chapterId: e.target.value})} disabled={!editing.disciplineId}><option value="">Selecione...</option>{hierarchy.find(d => d.id === editing.disciplineId)?.chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
                    <Select label="Unidade" value={editing.unitId || ''} onChange={e => setEditing({...editing, unitId: e.target.value})} disabled={!editing.chapterId}><option value="">Selecione...</option>{hierarchy.find(d => d.id === editing.disciplineId)?.chapters.find(c => c.id === editing.chapterId)?.units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</Select>
                    <Select label="Tópico" value={editing.topicId || ''} onChange={e => setEditing({...editing, topicId: e.target.value})} disabled={!editing.unitId}><option value="">Selecione...</option>{hierarchy.find(d => d.id === editing.disciplineId)?.chapters.find(c => c.id === editing.chapterId)?.units.find(u => u.id === editing.unitId)?.topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
                    <Select label="Dificuldade" value={editing.difficulty || 'Medium'} onChange={e => setEditing({...editing, difficulty: e.target.value as any})}><option value="Easy">Fácil</option><option value="Medium">Médio</option><option value="Hard">Difícil</option></Select>
                    <Select label="Tipo" value={editing.type || QuestionType.MULTIPLE_CHOICE} onChange={e => {
                        const newType = e.target.value as QuestionType;
                        let updates: any = { type: newType };
                        if (newType === QuestionType.TRUE_FALSE) {
                            updates.options = [{ id: 'tf1', text: 'Verdadeiro', isCorrect: true }, { id: 'tf2', text: 'Falso', isCorrect: false }];
                        } else if (newType === QuestionType.MULTIPLE_CHOICE) {
                             if(!editing.options || editing.options.length === 0) updates.options = Array(4).fill({ text: '', isCorrect: false });
                        } else if (newType === QuestionType.ASSOCIATION) {
                             if(!editing.pairs || editing.pairs.length === 0) updates.pairs = [{ id: Date.now().toString(), itemA: '', itemB: '' }];
                        } else {
                            if(!editing.options || editing.options.length === 0) updates.options = [{ id: 'sa1', text: '', isCorrect: true }];
                        }
                        setEditing({...editing, ...updates});
                    }}>{Object.entries(QuestionTypeLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</Select>
                </div>
                <div className="space-y-4">
                    <RichTextEditor label="Enunciado" value={editing.enunciado || ''} onChange={html => setEditing({...editing, enunciado: html})} />
                    
                    {/* MULTIPLE CHOICE */}
                    {editing.type === QuestionType.MULTIPLE_CHOICE && (<div className="space-y-2"><label className="text-sm font-semibold">Alternativas</label>{editing.options?.map((opt, idx) => (<div key={idx} className="flex gap-2 items-center"><input type="radio" name="correct" checked={opt.isCorrect} onChange={() => { const newOpts = editing.options?.map((o, i) => ({ ...o, isCorrect: i === idx })) || []; setEditing({ ...editing, options: newOpts }); }} /><Input value={opt.text} onChange={e => { const newOpts = [...(editing.options || [])]; newOpts[idx] = { ...newOpts[idx], text: e.target.value }; setEditing({ ...editing, options: newOpts }); }} placeholder={`Opção ${idx + 1}`} /><button onClick={() => { const newOpts = [...(editing.options || [])]; newOpts.splice(idx, 1); setEditing({ ...editing, options: newOpts }); }} className="text-red-400 hover:text-red-600 p-1"><Icons.Trash /></button></div>))}<Button variant="ghost" onClick={() => setEditing({ ...editing, options: [...(editing.options || []), { id: Date.now().toString(), text: '', isCorrect: false }] })}>+ Adicionar Opção</Button></div>)}
                    
                    {/* TRUE/FALSE */}
                    {editing.type === QuestionType.TRUE_FALSE && (<div className="space-y-2"><label className="text-sm font-semibold">Gabarito</label><div className="flex gap-4 p-2 border rounded bg-slate-50"><label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="tf_correct" checked={editing.options?.[0]?.isCorrect} onChange={() => setEditing({...editing, options: [{id: 'tf1', text: 'Verdadeiro', isCorrect: true}, {id: 'tf2', text: 'Falso', isCorrect: false}]})} /><span>Verdadeiro</span></label><label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="tf_correct" checked={editing.options?.[1]?.isCorrect} onChange={() => setEditing({...editing, options: [{id: 'tf1', text: 'Verdadeiro', isCorrect: false}, {id: 'tf2', text: 'Falso', isCorrect: true}]})} /><span>Falso</span></label></div></div>)}
                    
                    {/* SHORT ANSWER & NUMERIC */}
                    {(editing.type === QuestionType.SHORT_ANSWER || editing.type === QuestionType.NUMERIC) && (<div className="space-y-2"><Input label={editing.type === QuestionType.NUMERIC ? "Resposta Numérica" : "Resposta Esperada"} type={editing.type === QuestionType.NUMERIC ? "number" : "text"} value={editing.options?.[0]?.text || ''} onChange={e => setEditing({...editing, options: [{ id: 'sa1', text: e.target.value, isCorrect: true }]})} placeholder="Digite o gabarito..." /></div>)}
                    
                    {/* ASSOCIATION */}
                    {editing.type === QuestionType.ASSOCIATION && (<div className="space-y-2"><label className="text-sm font-semibold">Pares de Associação</label>{editing.pairs?.map((pair, idx) => (<div key={idx} className="flex gap-2 items-center"><div className="flex-1"><Input placeholder="Coluna A" value={pair.itemA} onChange={e => { const newPairs = [...(editing.pairs || [])]; newPairs[idx] = { ...newPairs[idx], itemA: e.target.value }; setEditing({...editing, pairs: newPairs}); }} /></div><div className="flex items-center text-slate-400">↔</div><div className="flex-1"><Input placeholder="Coluna B" value={pair.itemB} onChange={e => { const newPairs = [...(editing.pairs || [])]; newPairs[idx] = { ...newPairs[idx], itemB: e.target.value }; setEditing({...editing, pairs: newPairs}); }} /></div><button onClick={() => { const newPairs = [...(editing.pairs || [])]; newPairs.splice(idx, 1); setEditing({...editing, pairs: newPairs}); }} className="text-red-400 hover:text-red-600 p-1"><Icons.Trash /></button></div>))}<Button variant="ghost" onClick={() => setEditing({ ...editing, pairs: [...(editing.pairs || []), { id: Date.now().toString(), itemA: '', itemB: '' }] })}>+ Adicionar Par</Button></div>)}
                </div>
            </Modal>
        </div>
    );
};

export default QuestionsPage;
