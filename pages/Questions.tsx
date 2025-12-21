
import React, { useState, useEffect, useMemo } from 'react';
import { Question, Discipline, QuestionType, UserRole, CurricularComponent } from '../types';
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
    const [hierarchy, setHierarchy] = useState<CurricularComponent[]>([]);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Partial<Question>>({});
    const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
    const [generating, setGenerating] = useState(false);
    const [isCloneMode, setIsCloneMode] = useState(false);
    const [tagInput, setTagInput] = useState('');

    const [selComp, setSelComp] = useState('');
    const [selDisc, setSelDisc] = useState('');
    const [selChap, setSelChap] = useState('');
    const [searchText, setSearchText] = useState('');
    const [visFilter, setVisFilter] = useState<'ALL' | 'MINE' | 'SCHOOL' | 'GLOBAL'>('ALL');

    useEffect(() => { if (user) load(); }, [user]);
    
    const load = async () => {
        const [qs, hs] = await Promise.all([FirebaseService.getQuestions(user), FirebaseService.getHierarchy()]);
        setAllQuestions(qs);
        setHierarchy(hs);
    };

    const filteredQuestions = useMemo(() => {
        return allQuestions.filter(q => {
            if (selComp && q.componentId !== selComp) return false;
            if (selDisc && q.disciplineId !== selDisc) return false;
            if (selChap && q.chapterId !== selChap) return false;
            
            if (searchText) {
                const term = searchText.toLowerCase();
                if (!(q.enunciado.toLowerCase().includes(term) || q.tags?.some(t => t.toLowerCase().includes(term)))) return false;
            }
            
            if (visFilter === 'MINE') return q.authorId === user?.id;
            if (visFilter === 'SCHOOL') return q.isInstitutional === true || q.visibility === 'INSTITUTION';
            if (visFilter === 'GLOBAL') return q.visibility === 'PUBLIC' && q.reviewStatus === 'APPROVED' && q.authorId !== user?.id;

            return true;
        });
    }, [allQuestions, selComp, selDisc, selChap, searchText, visFilter, user?.id]);

    const availableComponents = useMemo(() => {
        if (user?.role === UserRole.ADMIN) return hierarchy;
        const authorized = [...(user?.subjects || []), ...(user?.accessGrants || [])];
        return hierarchy.filter(cc => authorized.includes(cc.id));
    }, [hierarchy, user]);

    const handleSave = async () => {
        if(!editing.enunciado || !editing.componentId) { alert('Campos obrigatórios: Enunciado e Componente'); return; }
        
        const q: any = {
            ...editing,
            id: isCloneMode ? '' : (editing.id || ''),
            authorId: user?.id,
            institutionId: user?.institutionId,
            createdAt: new Date().toISOString()
        };

        if (q.id) await FirebaseService.updateQuestion(q);
        else await FirebaseService.addQuestion(q);
        
        setIsModalOpen(false);
        load();
    };

    const selectedQuestion = allQuestions.find(q => q.id === selectedQuestionId);

    const activeComp = hierarchy.find(cc => cc.id === editing.componentId);
    const activeDisc = activeComp?.disciplines.find(d => d.id === editing.disciplineId);
    const activeChap = activeDisc?.chapters.find(c => c.id === editing.chapterId);
    const activeUnit = activeChap?.units.find(u => u.id === editing.unitId);

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col gap-4 shadow-sm z-10">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold font-display text-slate-800 flex items-center gap-2"><Icons.Questions /> Banco de Questões</h2>
                    <Button onClick={() => { setEditing({ type: QuestionType.MULTIPLE_CHOICE, visibility: 'PUBLIC', tags: [] }); setIsModalOpen(true); }} className="text-sm"><Icons.Plus /> Nova Questão</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Select value={selComp} onChange={e => { setSelComp(e.target.value); setSelDisc(''); }} className="w-48 text-sm">
                        <option value="">Área Curricular</option>
                        {availableComponents.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
                    </Select>
                    <Select value={selDisc} onChange={e => setSelDisc(e.target.value)} disabled={!selComp} className="w-48 text-sm">
                        <option value="">Disciplina</option>
                        {hierarchy.find(cc => cc.id === selComp)?.disciplines.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </Select>
                    <div className="flex-1 min-w-[200px] relative">
                        <input type="text" className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-300 rounded outline-none" placeholder="Buscar no enunciado..." value={searchText} onChange={e => setSearchText(e.target.value)} />
                        <div className="absolute left-2.5 top-2.5 text-slate-400"><Icons.Search /></div>
                    </div>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                <div className="w-1/3 min-w-[300px] border-r border-slate-200 bg-white overflow-y-auto custom-scrollbar">
                    {filteredQuestions.map(q => (
                        <div key={q.id} onClick={() => setSelectedQuestionId(q.id)} className={`p-4 cursor-pointer hover:bg-slate-50 border-l-4 transition-colors ${selectedQuestionId === q.id ? 'bg-blue-50 border-brand-blue' : 'border-transparent'}`}>
                            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">{QuestionTypeLabels[q.type]}</div>
                            <div className="text-sm text-slate-800 line-clamp-2" dangerouslySetInnerHTML={{__html: q.enunciado}} />
                            <div className="mt-2 flex justify-between items-center">
                                <span className="text-[10px] text-slate-400 font-bold">{hierarchy.find(cc => cc.id === q.componentId)?.name}</span>
                                {q.authorId === user?.id && <Badge color="blue">Mínha</Badge>}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex-1 bg-white p-8 overflow-y-auto custom-scrollbar">
                    {selectedQuestion ? (
                        <div className="max-w-3xl mx-auto">
                            <div className="flex justify-between mb-8 border-b pb-4">
                                <div>
                                    <h3 className="font-bold text-slate-500 uppercase text-xs tracking-widest mb-1">Localização</h3>
                                    <p className="text-sm font-bold text-slate-800">{FirebaseService.getFullHierarchyString(selectedQuestion, hierarchy)}</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="ghost" onClick={() => { setEditing(selectedQuestion); setIsModalOpen(true); }}><Icons.Edit /></Button>
                                    {selectedQuestion.authorId === user?.id && <Button variant="ghost" className="text-red-500" onClick={() => FirebaseService.deleteQuestion(selectedQuestion.id).then(load)}><Icons.Trash /></Button>}
                                </div>
                            </div>
                            <div className="prose prose-slate max-w-none rich-text-content" dangerouslySetInnerHTML={{__html: selectedQuestion.enunciado}} />
                            {selectedQuestion.options && (
                                <div className="mt-8 space-y-3">
                                    {selectedQuestion.options.map((opt, i) => (
                                        <div key={i} className={`p-4 rounded-xl border flex items-center gap-3 ${opt.isCorrect ? 'bg-green-50 border-green-200' : 'border-slate-100'}`}>
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${opt.isCorrect ? 'bg-green-500 text-white' : 'bg-slate-100'}`}>{String.fromCharCode(65+i)}</div>
                                            <span className="flex-1">{opt.text}</span>
                                            {opt.isCorrect && <Icons.Check />}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-300 italic">Selecione uma questão para visualizar</div>
                    )}
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Questão" maxWidth="max-w-5xl" footer={<Button onClick={handleSave}>Salvar</Button>}>
                <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 bg-slate-50 p-4 rounded-xl border">
                        <Select label="Componente" value={editing.componentId || ''} onChange={e => setEditing({...editing, componentId: e.target.value, disciplineId: '', chapterId: '', unitId: '', topicId: ''})}>
                            <option value="">Selecione...</option>
                            {availableComponents.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
                        </Select>
                        <Select label="Disciplina" value={editing.disciplineId || ''} onChange={e => setEditing({...editing, disciplineId: e.target.value, chapterId: '', unitId: '', topicId: ''})} disabled={!editing.componentId}>
                            <option value="">Selecione...</option>
                            {activeComp?.disciplines.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </Select>
                        <Select label="Capítulo" value={editing.chapterId || ''} onChange={e => setEditing({...editing, chapterId: e.target.value, unitId: '', topicId: ''})} disabled={!editing.disciplineId}>
                            <option value="">Selecione...</option>
                            {activeDisc?.chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </Select>
                        <Select label="Unidade" value={editing.unitId || ''} onChange={e => setEditing({...editing, unitId: e.target.value, topicId: ''})} disabled={!editing.chapterId}>
                            <option value="">Selecione...</option>
                            {activeChap?.units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </Select>
                        <Select label="Tópico" value={editing.topicId || ''} onChange={e => setEditing({...editing, topicId: e.target.value})} disabled={!editing.unitId}>
                            <option value="">Selecione...</option>
                            {activeUnit?.topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </Select>
                    </div>

                    <RichTextEditor label="Enunciado" value={editing.enunciado || ''} onChange={html => setEditing({...editing, enunciado: html})} />
                    
                    {editing.type === QuestionType.MULTIPLE_CHOICE && (
                        <div className="space-y-4">
                            <h4 className="font-bold text-slate-700">Alternativas</h4>
                            {editing.options?.map((opt, idx) => (
                                <div key={idx} className="flex gap-2 items-center">
                                    <input type="radio" checked={opt.isCorrect} onChange={() => setEditing({...editing, options: editing.options?.map((o, i) => ({...o, isCorrect: i === idx}))})} />
                                    <Input className="flex-1" value={opt.text} onChange={e => { const o = [...(editing.options || [])]; o[idx].text = e.target.value; setEditing({...editing, options: o}); }} />
                                    <button onClick={() => setEditing({...editing, options: editing.options?.filter((_, i) => i !== idx)})} className="text-red-400"><Icons.Trash /></button>
                                </div>
                            ))}
                            <Button variant="ghost" onClick={() => setEditing({...editing, options: [...(editing.options || []), { id: Date.now().toString(), text: '', isCorrect: false }]})}>+ Opção</Button>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default QuestionsPage;
