

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Exam, Institution, SchoolClass, Discipline, Question, ExamContentScope, QuestionType, PublicExamConfig, UserRole, CurricularComponent } from '../types';
import { FirebaseService } from '../services/firebaseService';
// Fix: Added Card to imports from UI
import { Button, Modal, Select, Input, Badge, RichTextEditor, Card } from '../components/UI';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';

const ExamsPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [exams, setExams] = useState<Exam[]>([]);
    const [institutions, setInstitutions] = useState<Institution[]>([]);
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [hierarchy, setHierarchy] = useState<CurricularComponent[]>([]);
    const [allQuestions, setAllQuestions] = useState<Question[]>([]);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Partial<Exam>>({});
    const [currentStep, setCurrentStep] = useState(1);
    const [saving, setSaving] = useState(false);

    const [selectedComp, setSelectedComp] = useState('');
    const [selectedDisc, setSelectedDisc] = useState('');
    const [selectedChap, setSelectedChap] = useState('');
    const [questionsCount, setQuestionsCount] = useState(1);
    const [tempScopes, setTempScopes] = useState<ExamContentScope[]>([]);

    useEffect(() => { if (user) load(); }, [user]);

    const load = async () => {
        const [e, i, c, h, q] = await Promise.all([
            FirebaseService.getExams(user),
            FirebaseService.getInstitutions(user),
            FirebaseService.getClasses(user),
            FirebaseService.getHierarchy(),
            FirebaseService.getQuestions(user)
        ]);
        setExams(e); setInstitutions(i); setClasses(c); setHierarchy(h); setAllQuestions(q);
    };

    const handleAddScope = () => {
        const comp = hierarchy.find(cc => cc.id === selectedComp);
        const disc = comp?.disciplines.find(d => d.id === selectedDisc);
        const chap = disc?.chapters.find(c => c.id === selectedChap);
        
        setTempScopes([...tempScopes, {
            id: Date.now().toString(),
            componentId: selectedComp,
            componentName: comp?.name || '',
            disciplineId: selectedDisc || undefined,
            disciplineName: disc?.name,
            chapterId: selectedChap || undefined,
            chapterName: chap?.name,
            questionCount: questionsCount
        }]);
    };

    const handleAutoGenerate = () => {
        const finalQuestions: Question[] = [];
        tempScopes.forEach(scope => {
            const scopeQs = allQuestions.filter(q => q.componentId === scope.componentId && (!scope.disciplineId || q.disciplineId === scope.disciplineId));
            const selected = scopeQs.sort(() => 0.5 - Math.random()).slice(0, scope.questionCount);
            finalQuestions.push(...selected);
        });
        setEditing({ ...editing, questions: finalQuestions });
    };

    const renderStepContent = () => {
        switch(currentStep) {
            case 1: return (
                <div className="space-y-4">
                    <Input label="Título da Prova" value={editing.title || ''} onChange={e => setEditing({...editing, title: e.target.value})} />
                    <Select label="Instituição" value={editing.institutionId || ''} onChange={e => setEditing({...editing, institutionId: e.target.value})}>
                        <option value="">Selecione...</option>
                        {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </Select>
                </div>
            );
            case 2: return (
                <div className="space-y-6">
                    <div className="bg-slate-50 p-6 rounded-xl border space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <Select label="Componente Curricular" value={selectedComp} onChange={e => { setSelectedComp(e.target.value); setSelectedDisc(''); }}>
                                <option value="">Selecione...</option>
                                {hierarchy.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
                            </Select>
                            <Select label="Disciplina" value={selectedDisc} onChange={e => { setSelectedDisc(e.target.value); setSelectedChap(''); }} disabled={!selectedComp}>
                                <option value="">Todas as disciplinas</option>
                                {hierarchy.find(cc => cc.id === selectedComp)?.disciplines.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <Select label="Capítulo" value={selectedChap} onChange={e => setSelectedChap(e.target.value)} disabled={!selectedDisc}>
                                <option value="">Todos os capítulos</option>
                                {hierarchy.find(cc => cc.id === selectedComp)?.disciplines.find(d => d.id === selectedDisc)?.chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </Select>
                            <Input label="Qtd. Questões" type="number" value={questionsCount} onChange={e => setQuestionsCount(Number(e.target.value))} />
                        </div>
                        <Button onClick={handleAddScope} disabled={!selectedComp} className="w-full">Adicionar ao Escopo</Button>
                    </div>
                    <div className="space-y-2">
                        {tempScopes.map(s => (
                            <div key={s.id} className="p-3 bg-white border rounded-lg flex justify-between items-center shadow-sm">
                                <div>
                                    <span className="text-xs font-black text-slate-400 uppercase">{s.componentName}</span>
                                    <p className="font-bold text-slate-800">{s.disciplineName || 'Geral'} {s.chapterName ? `> ${s.chapterName}` : ''}</p>
                                </div>
                                <Badge color="blue">{s.questionCount} qts</Badge>
                            </div>
                        ))}
                    </div>
                </div>
            );
            case 3: return (
                <div className="text-center py-10">
                    <Button onClick={() => { handleAutoGenerate(); setCurrentStep(4); }}>Gerar Seleção Automática</Button>
                </div>
            );
            case 4: return (
                <div className="space-y-4">
                    <h3 className="font-bold text-slate-800">Resumo da Prova ({editing.questions?.length || 0} questões)</h3>
                    <div className="max-h-96 overflow-y-auto border rounded p-4 space-y-4">
                        {editing.questions?.map((q, i) => (
                            <div key={q.id} className="text-sm border-b pb-2" dangerouslySetInnerHTML={{__html: `${i+1}. ${q.enunciado}`}} />
                        ))}
                    </div>
                </div>
            );
            default: return null;
        }
    };

    return (
        <div className="p-8 h-full bg-slate-50 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-6">
                <div><h2 className="text-3xl font-display font-bold text-slate-800">Minhas Provas</h2></div>
                <Button onClick={() => { setEditing({ columns: 1 }); setTempScopes([]); setCurrentStep(1); setIsModalOpen(true); }}><Icons.Plus /> Nova Prova</Button>
            </div>
            
            <div className="grid gap-4">
                {exams.map(exam => (
                    <Card key={exam.id} className="p-4 flex justify-between items-center hover:shadow-md transition-shadow">
                        <div>
                            <h4 className="font-bold text-slate-800 text-lg">{exam.title}</h4>
                            <p className="text-xs text-slate-400">{new Date(exam.createdAt).toLocaleDateString()} • {exam.questions?.length} questões</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => navigate('/exam-results', { state: { examId: exam.id } })} className="p-2 text-slate-400 hover:text-brand-blue"><Icons.Eye /></button>
                            <button onClick={() => FirebaseService.deleteExam(exam.id).then(load)} className="p-2 text-slate-400 hover:text-red-500"><Icons.Trash /></button>
                        </div>
                    </Card>
                ))}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Assistente de Prova" maxWidth="max-w-4xl" footer={<div className="flex justify-between w-full">{currentStep > 1 && <Button variant="ghost" onClick={() => setCurrentStep(currentStep - 1)}>Voltar</Button>}<div className="flex gap-2 ml-auto">{currentStep < 4 ? <Button onClick={() => setCurrentStep(currentStep + 1)}>Próximo</Button> : <Button onClick={() => FirebaseService.saveExam({...editing, contentScopes: tempScopes}).then(() => { setIsModalOpen(false); load(); })}>Salvar Prova</Button>}</div></div>}>
                {renderStepContent()}
            </Modal>
        </div>
    );
};

export default ExamsPage;
