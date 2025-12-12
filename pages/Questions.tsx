import React, { useState, useEffect } from 'react';
import { Question, Discipline, QuestionType } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { GeminiService } from '../services/geminiService';
import { PdfService } from '../services/pdfService';
import { Button, Modal, Select, Input, Badge, RichTextEditor } from '../components/UI';
import { Icons } from '../components/Icons';

const QuestionTypeLabels: Record<QuestionType, string> = {
  [QuestionType.MULTIPLE_CHOICE]: 'Múltipla Escolha',
  [QuestionType.TRUE_FALSE]: 'Verdadeiro/Falso',
  [QuestionType.SHORT_ANSWER]: 'Dissertativa',
  [QuestionType.NUMERIC]: 'Numérica',
  [QuestionType.ASSOCIATION]: 'Associação'
};

const QuestionsPage = () => {
    const [allQuestions, setAllQuestions] = useState<Question[]>([]);
    const [hierarchy, setHierarchy] = useState<Discipline[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Partial<Question>>({});
    const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
    const [selDisc, setSelDisc] = useState('');
    const [selChap, setSelChap] = useState('');
    const [selUnit, setSelUnit] = useState('');
    const [selTopic, setSelTopic] = useState('');
    const [searchText, setSearchText] = useState('');
    const [generating, setGenerating] = useState(false);
    const [pdfProcessing, setPdfProcessing] = useState(false);

    useEffect(() => { load(); }, []);
    
    const load = async () => {
        const [qs, hs] = await Promise.all([FirebaseService.getQuestions(), FirebaseService.getHierarchy()]);
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

    const handleSave = async () => {
        if(!editing.enunciado || !editing.disciplineId) { alert('Preencha os campos obrigatórios'); return; }
        const q: Question = {
            id: editing.id || '',
            enunciado: editing.enunciado,
            type: editing.type || QuestionType.MULTIPLE_CHOICE,
            difficulty: editing.difficulty || 'Medium',
            disciplineId: editing.disciplineId,
            chapterId: editing.chapterId || '',
            unitId: editing.unitId || '',
            topicId: editing.topicId || '',
            options: editing.options || [],
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

    const handleGenerateAI = async () => {
        const topicName = prompt("Sobre qual tópico deseja gerar a questão?");
        if(!topicName) return;
        setGenerating(true);
        const newQ = await GeminiService.generateQuestion(topicName, QuestionType.MULTIPLE_CHOICE, 'Medium');
        if(newQ) {
            setEditing({ ...newQ, disciplineId: selDisc || '', chapterId: selChap || '', unitId: selUnit || '', topicId: selTopic || '' });
            setIsModalOpen(true);
        } else {
            alert('Falha ao gerar questão.');
        }
        setGenerating(false);
    };

    const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if(!file) return;
        setPdfProcessing(true);
        try {
            const text = await PdfService.extractText(file);
            const extractedQuestions = await GeminiService.parseQuestionsFromText(text);
            if(extractedQuestions.length > 0) {
                 alert(`${extractedQuestions.length} questões identificadas! Salvando a primeira como rascunho.`);
                 setEditing({ ...extractedQuestions[0], disciplineId: selDisc || '', chapterId: selChap || '', unitId: selUnit || '', topicId: selTopic || '' });
                 setIsModalOpen(true);
            } else alert('Nenhuma questão identificada.');
        } catch(err) { console.error(err); alert('Erro ao processar PDF.'); }
        setPdfProcessing(false);
    };

    const stripHtml = (html: string) => {
        const tmp = document.createElement("DIV");
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || "";
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col gap-4 shadow-sm z-10">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold font-display text-slate-800 flex items-center gap-2"><Icons.Questions /> Banco de Questões</h2>
                    <div className="flex gap-2">
                        <div className="relative overflow-hidden group">
                            <Button variant="secondary" disabled={pdfProcessing} className="text-sm">{pdfProcessing ? 'Lendo...' : 'Importar PDF'}</Button>
                            <input type="file" accept=".pdf" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handlePdfUpload} />
                        </div>
                        <Button variant="outline" onClick={handleGenerateAI} disabled={generating} className="text-sm"><Icons.Sparkles /> IA Gerar</Button>
                        <Button onClick={() => { setEditing({ type: QuestionType.MULTIPLE_CHOICE, options: Array(4).fill({text:'', isCorrect:false}), disciplineId: selDisc, chapterId: selChap, unitId: selUnit, topicId: selTopic }); setIsModalOpen(true); }} className="text-sm"><Icons.Plus /> + Nova Questão</Button>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-2 text-slate-500 mr-2"><Icons.Filter /> <span className="text-xs font-bold uppercase tracking-wide">Filtros</span></div>
                    <div className="w-40"><select className="w-full text-sm border-slate-300 rounded p-1.5 bg-white outline-none" value={selDisc} onChange={e => { setSelDisc(e.target.value); setSelChap(''); setSelUnit(''); setSelTopic(''); }}><option value="">Todas Disciplinas</option>{hierarchy.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                    <div className="w-40"><select className="w-full text-sm border-slate-300 rounded p-1.5 bg-white outline-none" value={selChap} onChange={e => { setSelChap(e.target.value); setSelUnit(''); setSelTopic(''); }} disabled={!selDisc}><option value="">Todos Capítulos</option>{hierarchy.find(d => d.id === selDisc)?.chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                    <div className="w-40"><select className="w-full text-sm border-slate-300 rounded p-1.5 bg-white outline-none" value={selUnit} onChange={e => { setSelUnit(e.target.value); setSelTopic(''); }} disabled={!selChap}><option value="">Todas Unidades</option>{hierarchy.find(d => d.id === selDisc)?.chapters.find(c => c.id === selChap)?.units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
                    <div className="w-40"><select className="w-full text-sm border-slate-300 rounded p-1.5 bg-white outline-none" value={selTopic} onChange={e => setSelTopic(e.target.value)} disabled={!selUnit}><option value="">Todos Tópicos</option>{hierarchy.find(d => d.id === selDisc)?.chapters.find(c => c.id === selChap)?.units.find(u => u.id === selUnit)?.topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                    <div className="flex-1 min-w-[200px] relative"><input type="text" className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-300 rounded outline-none" placeholder="Buscar..." value={searchText} onChange={e => setSearchText(e.target.value)} /><div className="absolute left-2.5 top-2 text-slate-400"><Icons.Search /></div></div>
                </div>
            </div>

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
                            </div>
                        </div>
                    ) : <div className="flex-1 flex flex-col items-center justify-center text-slate-300"><div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4"><Icons.Eye /></div><p className="text-lg font-medium">Selecione uma questão</p></div>}
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Editar Questão" maxWidth="max-w-4xl" footer={<Button onClick={handleSave}>Salvar Questão</Button>}>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <Select label="Disciplina" value={editing.disciplineId || ''} onChange={e => setEditing({...editing, disciplineId: e.target.value})}><option value="">Selecione...</option>{hierarchy.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
                    <Select label="Capítulo" value={editing.chapterId || ''} onChange={e => setEditing({...editing, chapterId: e.target.value})} disabled={!editing.disciplineId}><option value="">Selecione...</option>{hierarchy.find(d => d.id === editing.disciplineId)?.chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
                    <Select label="Unidade" value={editing.unitId || ''} onChange={e => setEditing({...editing, unitId: e.target.value})} disabled={!editing.chapterId}><option value="">Selecione...</option>{hierarchy.find(d => d.id === editing.disciplineId)?.chapters.find(c => c.id === editing.chapterId)?.units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</Select>
                    <Select label="Tópico" value={editing.topicId || ''} onChange={e => setEditing({...editing, topicId: e.target.value})} disabled={!editing.unitId}><option value="">Selecione...</option>{hierarchy.find(d => d.id === editing.disciplineId)?.chapters.find(c => c.id === editing.chapterId)?.units.find(u => u.id === editing.unitId)?.topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
                    <Select label="Dificuldade" value={editing.difficulty || 'Medium'} onChange={e => setEditing({...editing, difficulty: e.target.value as any})}><option value="Easy">Fácil</option><option value="Medium">Médio</option><option value="Hard">Difícil</option></Select>
                    <Select label="Tipo" value={editing.type || QuestionType.MULTIPLE_CHOICE} onChange={e => setEditing({...editing, type: e.target.value as any})}>{Object.entries(QuestionTypeLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</Select>
                </div>
                <div className="space-y-4">
                    <RichTextEditor label="Enunciado" value={editing.enunciado || ''} onChange={html => setEditing({...editing, enunciado: html})} />
                    {editing.type === QuestionType.MULTIPLE_CHOICE && (<div className="space-y-2"><label className="text-sm font-semibold">Alternativas</label>{editing.options?.map((opt, idx) => (<div key={idx} className="flex gap-2 items-center"><input type="radio" name="correct" checked={opt.isCorrect} onChange={() => { const newOpts = editing.options?.map((o, i) => ({ ...o, isCorrect: i === idx })) || []; setEditing({ ...editing, options: newOpts }); }} /><Input value={opt.text} onChange={e => { const newOpts = [...(editing.options || [])]; newOpts[idx] = { ...newOpts[idx], text: e.target.value }; setEditing({ ...editing, options: newOpts }); }} placeholder={`Opção ${idx + 1}`} /><button onClick={() => { const newOpts = [...(editing.options || [])]; newOpts.splice(idx, 1); setEditing({ ...editing, options: newOpts }); }} className="text-red-400 hover:text-red-600 p-1"><Icons.Trash /></button></div>))}<Button variant="ghost" onClick={() => setEditing({ ...editing, options: [...(editing.options || []), { id: Date.now().toString(), text: '', isCorrect: false }] })}>+ Adicionar Opção</Button></div>)}
                </div>
            </Modal>
        </div>
    );
};

export default QuestionsPage;
