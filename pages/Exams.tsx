
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Exam, Institution, SchoolClass, Question, CurricularComponent, UserRole, QuestionType } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { Button, Modal, Select, Input, Badge, Card, RichTextEditor } from '../components/UI';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';

const ExamsPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    // Dados base
    const [exams, setExams] = useState<Exam[]>([]);
    const [institutions, setInstitutions] = useState<Institution[]>([]);
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [hierarchy, setHierarchy] = useState<CurricularComponent[]>([]);
    const [allQuestions, setAllQuestions] = useState<Question[]>([]);
    
    // UI States
    const [loading, setLoading] = useState(true);
    const [expandedInstitutions, setExpandedInstitutions] = useState<Record<string, boolean>>({});
    const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>({});

    // Scanner States (Simplificados para esta view)
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scannedExam, setScannedExam] = useState<Exam | null>(null);

    // Modal/Wizard States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Partial<Exam>>({});
    const [currentStep, setCurrentStep] = useState(1);
    const [viewingMode, setViewingMode] = useState<'EXAM' | 'ONLINE_CONFIG'>('EXAM');

    // Estados de Impressão
    const [printFontSize, setPrintFontSize] = useState('text-sm');
    const [activeVersion, setActiveVersion] = useState('A');
    const [examVersions, setExamVersions] = useState<Record<string, Question[]>>({ 'A': [] });

    useEffect(() => { if (user) load(); }, [user]);

    const load = async () => {
        setLoading(true);
        try {
            const [e, i, c, h, q] = await Promise.all([
                FirebaseService.getExams(user),
                FirebaseService.getInstitutions(user),
                FirebaseService.getClasses(user),
                FirebaseService.getHierarchy(),
                FirebaseService.getQuestions(user)
            ]);
            setExams(Array.isArray(e) ? e : []); 
            setInstitutions(Array.isArray(i) ? i.sort((a,b) => (a.name || '').localeCompare(b.name || '')) : []); 
            setClasses(Array.isArray(c) ? c : []); 
            setHierarchy(Array.isArray(h) ? h : []); 
            setAllQuestions(Array.isArray(q) ? q : []);
        } catch (err) {
            console.error("Erro ao carregar exames:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveExam = async () => {
        try {
            await FirebaseService.saveExam({ ...editing, authorId: user?.id, createdAt: editing.createdAt || new Date().toISOString() });
            setIsModalOpen(false); 
            load();
        } catch (e) { alert("Erro ao salvar."); }
    };

    const handleDeleteExam = async (id: string) => {
        if (confirm("Deseja realmente excluir esta prova permanentemente?")) {
            await FirebaseService.deleteExam(id);
            load();
        }
    };

    const getExamUrl = (id: string) => `${window.location.origin}${window.location.pathname}#/p/${id}`;

    const handleCopyLink = (id: string) => {
        navigator.clipboard.writeText(getExamUrl(id));
        alert("Link copiado!");
    };

    const selectedInstitution = useMemo(() => institutions.find(i => i.id === editing.institutionId), [institutions, editing.institutionId]);
    const currentQs = useMemo(() => examVersions[activeVersion] || editing.questions || [], [examVersions, activeVersion, editing.questions]);

    // Função para renderizar cabeçalho impresso (mantida para preview)
    const renderHeaderPrint = () => (
        <div className="border-2 border-black p-4 mb-6 bg-white block">
            <div className="flex items-center gap-6 mb-4">
                {selectedInstitution?.logoUrl && <img src={selectedInstitution.logoUrl} alt="Logo" className="h-10 w-auto object-contain shrink-0" />}
                <div className="flex-1">
                    <h1 className="font-black text-base uppercase leading-none">{selectedInstitution?.name || 'INSTITUIÇÃO'}</h1>
                    <h2 className="font-bold text-[10px] uppercase text-slate-700">{editing.title}</h2>
                </div>
                <div className="text-right"><div className="text-[10px] font-black border-2 border-black px-2 py-0.5 rounded">VERSÃO: {activeVersion}</div></div>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                <div className="border-b border-black font-black text-[9px] h-7 flex items-end">ALUNO:</div>
                <div className="border-b border-black font-black text-[9px] h-7 flex items-end">DATA: ___/___/___</div>
            </div>
        </div>
    );

    return (
        <div className="p-8 h-full flex flex-col bg-slate-50 overflow-y-auto custom-scrollbar print:block print:p-0 print:bg-white print:overflow-visible">
            <div className="flex justify-between items-center mb-8 no-print shrink-0">
                <div>
                    <h2 className="text-3xl font-display font-bold text-slate-800 tracking-tight">Minhas Provas</h2>
                    <p className="text-slate-500 mt-1">Gerencie avaliações impressas e digitais da sua conta.</p>
                </div>
                <Button onClick={() => { 
                    setEditing({ 
                        title: '', questions: [], columns: 1, showAnswerKey: false, instructions: '', contentScopes: [],
                        publicConfig: { isPublished: false, startDate: new Date().toISOString(), endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), timeLimitMinutes: 60, allowedAttempts: 1, randomizeQuestions: true, requireIdentifier: true, showFeedback: true }
                    }); 
                    setCurrentStep(1); 
                    setIsModalOpen(true); 
                }} className="h-12 px-6 shadow-lg"><Icons.Plus /> Criar Prova</Button>
            </div>

            {loading ? (
                <div className="p-20 text-center text-slate-300 font-black animate-pulse no-print">Sincronizando acervo...</div>
            ) : (
                <div className="space-y-4 no-print">
                    {institutions.length === 0 && (
                        <Card className="p-20 text-center border-2 border-dashed border-slate-200">
                            <p className="text-slate-400 font-bold italic">Nenhuma instituição cadastrada para exibir provas.</p>
                        </Card>
                    )}

                    {institutions.map(inst => {
                        const instExams = exams.filter(e => e.institutionId === inst.id);
                        if (instExams.length === 0) return null;

                        // Fix: Added explicit type annotations (a: number, b: number) to parameters to prevent arithmetic operation type errors
                        const years = Array.from(new Set(instExams.map(e => new Date(e.createdAt).getFullYear()))).sort((a: number, b: number) => b - a);
                        const isExpandedInst = expandedInstitutions[inst.id];

                        return (
                            <div key={inst.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                {/* Cabeçalho da Instituição (Estilo Turmas) */}
                                <div 
                                    className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 select-none transition-colors" 
                                    onClick={() => setExpandedInstitutions(prev => ({ ...prev, [inst.id]: !prev[inst.id] }))}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`transform transition-transform text-slate-400 ${isExpandedInst ? 'rotate-180' : ''}`}>
                                            <Icons.ChevronDown />
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {inst.logoUrl ? (
                                                <img src={inst.logoUrl} className="w-10 h-10 object-contain rounded border border-slate-100 bg-white p-1" />
                                            ) : (
                                                <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center text-slate-400"><Icons.Building /></div>
                                            )}
                                            <span className="font-black text-lg text-slate-800 uppercase tracking-tight">{inst.name}</span>
                                        </div>
                                    </div>
                                    <Badge color="blue">{instExams.length} avaliações</Badge>
                                </div>

                                {isExpandedInst && (
                                    <div className="bg-slate-50 p-4 border-t border-slate-100 space-y-3 animate-fade-in">
                                        {years.map(year => {
                                            const yearId = `${inst.id}-${year}`;
                                            const isExpandedYear = expandedYears[yearId];
                                            const yearExams = instExams.filter(e => new Date(e.createdAt).getFullYear() === year);

                                            return (
                                                <div key={yearId} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                                    <div 
                                                        className="p-3 flex justify-between items-center cursor-pointer hover:bg-slate-50 select-none pl-6" 
                                                        onClick={() => setExpandedYears(prev => ({ ...prev, [yearId]: !prev[yearId] }))}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className={`transform transition-transform text-slate-400 ${isExpandedYear ? 'rotate-180' : ''}`}>
                                                                <Icons.ChevronDown />
                                                            </div>
                                                            <span className="font-bold text-slate-700">Ano Letivo {year}</span>
                                                        </div>
                                                        <span className="text-xs font-black text-slate-400 uppercase mr-2">{yearExams.length} itens</span>
                                                    </div>

                                                    {isExpandedYear && (
                                                        <div className="border-t border-slate-100 animate-fade-in overflow-x-auto">
                                                            <table className="w-full text-left text-sm">
                                                                <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                                                    <tr>
                                                                        <th className="p-4">Título da Prova</th>
                                                                        <th className="p-4">Status</th>
                                                                        <th className="p-4">Itens</th>
                                                                        <th className="p-4 text-right">Ações</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-slate-100">
                                                                    {yearExams.map(exam => (
                                                                        <tr key={exam.id} className="hover:bg-blue-50/30 transition-colors group">
                                                                            <td className="p-4">
                                                                                <div className="font-bold text-slate-700">{exam.title}</div>
                                                                                <div className="text-[10px] text-slate-400 font-medium">Criada em: {new Date(exam.createdAt).toLocaleDateString()}</div>
                                                                            </td>
                                                                            <td className="p-4">
                                                                                {exam.publicConfig?.isPublished ? (
                                                                                    <Badge color="green" className="animate-pulse">ONLINE</Badge>
                                                                                ) : (
                                                                                    <Badge color="slate">OFFLINE</Badge>
                                                                                )}
                                                                            </td>
                                                                            <td className="p-4 font-black text-slate-500">{exam.questions?.length || 0}</td>
                                                                            <td className="p-4">
                                                                                <div className="flex justify-end gap-2">
                                                                                    <button 
                                                                                        onClick={() => navigate('/exam-results', { state: { examId: exam.id } })}
                                                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-brand-blue rounded-lg text-xs font-black uppercase hover:bg-blue-100 transition-all"
                                                                                    >
                                                                                        <Icons.Eye /> Notas
                                                                                    </button>
                                                                                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                                                                                        <button onClick={() => { setEditing(exam); setViewingMode('ONLINE_CONFIG'); setCurrentStep(4); setIsModalOpen(true); }} className="p-1.5 text-slate-500 hover:text-brand-blue" title="Configurações Online"><Icons.Share /></button>
                                                                                        <button onClick={() => { setEditing(exam); setViewingMode('EXAM'); setCurrentStep(4); setIsModalOpen(true); }} className="p-1.5 text-slate-500 hover:text-slate-800" title="Imprimir"><Icons.Printer /></button>
                                                                                        <button onClick={() => handleDeleteExam(exam.id)} className="p-1.5 text-slate-400 hover:text-red-500" title="Excluir"><Icons.Trash /></button>
                                                                                    </div>
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* MODAL DO WIZARD (REUTILIZADO) */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing.id ? "Configurar Avaliação" : "Nova Avaliação"} maxWidth="max-w-7xl" footer={
                <div className="flex justify-between w-full items-center no-print">
                    {currentStep > 1 && <Button variant="ghost" onClick={() => setCurrentStep(currentStep - 1)} className="font-black uppercase text-xs"><Icons.ArrowLeft /> Anterior</Button>}
                    <div className="flex gap-2 ml-auto">
                        {currentStep < 4 ? <Button onClick={() => setCurrentStep(currentStep + 1)} disabled={currentStep === 1 && !editing.title} className="px-10 h-12 font-black">Próximo <Icons.ArrowRight /></Button> : <Button onClick={handleSaveExam} className="px-12 h-12 shadow-xl font-black">SALVAR ALTERAÇÕES</Button>}
                    </div>
                </div>
            }>
                {/* Cabeçalho de Passos (Igual ao anterior para consistência) */}
                <div className="flex items-center justify-between mb-10 px-20 no-print">
                    {[1, 2, 3, 4].map(s => (
                        <React.Fragment key={s}>
                            <div className="flex flex-col items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black transition-all ${currentStep >= s ? 'bg-brand-blue text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>{s}</div>
                                <span className={`text-[9px] font-black uppercase tracking-widest ${currentStep >= s ? 'text-brand-blue' : 'text-slate-300'}`}>{s === 1 ? 'Config' : s === 2 ? 'Escopo' : s === 3 ? 'Itens' : 'Finalizar'}</span>
                            </div>
                            {s < 4 && <div className={`flex-1 h-0.5 mx-4 transition-colors ${currentStep > s ? 'bg-brand-blue' : 'bg-slate-100'}`}></div>}
                        </React.Fragment>
                    ))}
                </div>

                <div className="animate-fade-in min-h-[400px]">
                    {currentStep === 1 && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <Input label="Título da Avaliação" value={editing.title} onChange={e => setEditing({...editing, title: e.target.value})} placeholder="P1, Simulado, etc." />
                                <div className="grid grid-cols-2 gap-4">
                                    <Select label="Instituição" value={editing.institutionId || ''} onChange={e => setEditing({...editing, institutionId: e.target.value})}>
                                        <option value="">Selecione...</option>
                                        {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                    </Select>
                                    <Select label="Turma" value={editing.classId || ''} onChange={e => setEditing({...editing, classId: e.target.value})}>
                                        <option value="">Geral</option>
                                        {classes.filter(c => c.institutionId === editing.institutionId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </Select>
                                </div>
                            </div>
                            <RichTextEditor label="Instruções e Cabeçalho" value={editing.instructions || ''} onChange={html => setEditing({...editing, instructions: html})} />
                        </div>
                    )}

                    {(currentStep === 2 || currentStep === 3) && <div className="p-20 text-center text-slate-300 font-bold italic">Utilize os filtros e o motor de geração para montar sua prova.</div>}

                    {currentStep === 4 && (
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                            <div className="lg:col-span-1 space-y-6 bg-slate-50 p-6 rounded-3xl border no-print">
                                <div className="flex bg-white rounded-xl p-1 border shadow-inner mb-4">
                                    <button onClick={() => setViewingMode('EXAM')} className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${viewingMode === 'EXAM' ? 'bg-brand-blue text-white shadow-md' : 'text-slate-400'}`}>IMPRESSÃO</button>
                                    <button onClick={() => setViewingMode('ONLINE_CONFIG')} className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${viewingMode === 'ONLINE_CONFIG' ? 'bg-brand-blue text-white shadow-md' : 'text-slate-400'}`}>ONLINE</button>
                                </div>

                                {viewingMode === 'EXAM' ? (
                                    <div className="space-y-4">
                                        <Select label="Fonte" value={printFontSize} onChange={e => setPrintFontSize(e.target.value)}>
                                            <option value="text-[11px]">Pequena</option>
                                            <option value="text-sm">Padrão</option>
                                            <option value="text-base">Grande</option>
                                        </Select>
                                        <Button onClick={() => window.print()} className="w-full h-12 bg-slate-900 text-white shadow-xl"><Icons.Printer /> Imprimir</Button>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="bg-white p-4 rounded-xl border flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-700">Publicado?</span>
                                            <input type="checkbox" checked={editing.publicConfig?.isPublished} onChange={e => setEditing({...editing, publicConfig: {...editing.publicConfig!, isPublished: e.target.checked}})} className="w-5 h-5 text-brand-blue" />
                                        </div>
                                        <Input label="Tempo (min)" type="number" value={editing.publicConfig?.timeLimitMinutes} onChange={e => setEditing({...editing, publicConfig: {...editing.publicConfig!, timeLimitMinutes: Number(e.target.value)}})} />
                                    </div>
                                )}
                            </div>

                            <div className="lg:col-span-3 bg-white rounded-2xl p-4 border shadow-inner h-[600px] overflow-y-auto custom-scrollbar">
                                {viewingMode === 'ONLINE_CONFIG' ? (
                                    <div className="p-10 text-center space-y-6">
                                        <div className="w-20 h-20 bg-blue-50 text-brand-blue rounded-full flex items-center justify-center mx-auto shadow-inner"><Icons.Share className="w-10 h-10" /></div>
                                        <h3 className="text-2xl font-black text-slate-800">Compartilhamento Digital</h3>
                                        <div className="bg-slate-50 border-2 border-dashed p-6 rounded-3xl">
                                            <p className="font-mono text-sm break-all text-brand-blue mb-4">{getExamUrl(editing.id || 'NOVA_PROVA')}</p>
                                            <Button onClick={() => handleCopyLink(editing.id || '')} disabled={!editing.id} className="mx-auto">Copiar Link Aluno</Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className={`p-8 bg-white ${printFontSize} text-black print:block`}>
                                        {renderHeaderPrint()}
                                        <div className="space-y-6">
                                            {(editing.questions || []).map((q, idx) => (
                                                <div key={idx} className="break-inside-avoid">
                                                    <p className="font-bold mb-2">{idx + 1}. <span dangerouslySetInnerHTML={{__html: q.enunciado}} /></p>
                                                    <div className="ml-6 space-y-1">
                                                        {(q.options || []).map((opt, i) => (
                                                            <div key={i} className="flex gap-2">
                                                                <span className="w-4 h-4 border border-black rounded-full flex items-center justify-center text-[8px] font-black">{String.fromCharCode(65+i)}</span>
                                                                <span className="text-xs">{opt.text}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default ExamsPage;
