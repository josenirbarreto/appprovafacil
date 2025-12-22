
import React, { useState, useEffect, useMemo } from 'react';
import { Question, QuestionType, ReviewStatus, CurricularComponent, User } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { GeminiService } from '../services/geminiService';
import { Button, Card, Badge, Modal, Input } from '../components/UI';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

const ModerationPage = () => {
    const { user } = useAuth();
    const [pendingQuestions, setPendingQuestions] = useState<Question[]>([]);
    const [hierarchy, setHierarchy] = useState<CurricularComponent[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
    const [similarityCheck, setSimilarityCheck] = useState<{ loading: boolean, result: any }>({ loading: false, result: null });
    const [rejectReason, setRejectReason] = useState('');
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);

    useEffect(() => {
        if (user?.role === 'ADMIN') {
            loadInitialData();
        }
    }, [user]);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const [qData, hData, uData] = await Promise.all([
                FirebaseService.getPendingQuestions(),
                FirebaseService.getHierarchy() as Promise<CurricularComponent[]>,
                FirebaseService.getUsers(user)
            ]);
            setPendingQuestions(qData);
            setHierarchy(hData);
            setAllUsers(uData);
            if (qData.length > 0) handleSelect(qData[0]);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const loadPending = async () => {
        try {
            const data = await FirebaseService.getPendingQuestions();
            setPendingQuestions(data);
            if (data.length > 0) {
                const stillExists = data.find(q => q.id === selectedQuestion?.id);
                if (!stillExists) handleSelect(data[0]);
            } else {
                setSelectedQuestion(null);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleSelect = async (q: Question) => {
        setSelectedQuestion(q);
        setSimilarityCheck({ loading: true, result: null });
        
        try {
            const allQuestions = await FirebaseService.getQuestions({ ...user, role: 'ADMIN' } as any);
            const candidates = allQuestions
                .filter(x => x.disciplineId === q.disciplineId && x.reviewStatus === 'APPROVED' && x.id !== q.id)
                .slice(0, 30);

            const result = await GeminiService.checkSimilarity(q.enunciado, candidates);
            setSimilarityCheck({ loading: false, result });
        } catch (e) {
            setSimilarityCheck({ loading: false, result: { error: true } });
        }
    };

    const handleApprove = async () => {
        if (!selectedQuestion || isActionLoading) return;
        setIsActionLoading(true);
        try {
            await FirebaseService.approveQuestion(selectedQuestion.id);
            setPendingQuestions(prev => prev.filter(q => q.id !== selectedQuestion.id));
            await loadPending();
        } catch (e) {
            alert("Erro ao aprovar questão. Tente novamente.");
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleReject = async () => {
        if (!selectedQuestion || !rejectReason.trim() || isActionLoading) return;
        setIsActionLoading(true);
        try {
            await FirebaseService.rejectQuestion(selectedQuestion.id, rejectReason);
            setIsRejectModalOpen(false);
            setRejectReason('');
            setPendingQuestions(prev => prev.filter(q => q.id !== selectedQuestion.id));
            await loadPending();
        } catch (e) {
            alert("Erro ao rejeitar questão.");
        } finally {
            setIsActionLoading(false);
        }
    };

    if (user?.role !== 'ADMIN') return <Navigate to="/" />;

    return (
        <div className="flex h-full bg-slate-50 overflow-hidden">
            {/* Sidebar List */}
            <div className="w-1/3 min-w-[350px] border-r border-slate-200 bg-white flex flex-col">
                <div className="p-6 border-b border-slate-100 bg-slate-50">
                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <Icons.Shield className="text-brand-blue" /> Moderação
                    </h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                        {pendingQuestions.length} questões pendentes
                    </p>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="p-10 text-center animate-pulse font-black text-slate-300 uppercase text-xs">Sincronizando fila...</div>
                    ) : pendingQuestions.length === 0 ? (
                        <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-4">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center"><Icons.Check className="text-emerald-500 w-8 h-8" /></div>
                            <p className="font-bold italic">Tudo limpo! Nenhuma questão aguardando revisão.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {pendingQuestions.map(q => (
                                <div 
                                    key={q.id} 
                                    onClick={() => handleSelect(q)}
                                    className={`p-5 cursor-pointer hover:bg-slate-50 transition-all border-l-4 ${selectedQuestion?.id === q.id ? 'border-brand-blue bg-blue-50/50' : 'border-transparent'}`}
                                >
                                    <div className="flex justify-between mb-2">
                                        <Badge color="yellow">REVISÃO NECESSÁRIA</Badge>
                                        <span className="text-[10px] font-bold text-slate-400">{new Date(q.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <div className="text-sm text-slate-700 line-clamp-2 font-medium rich-text-content" dangerouslySetInnerHTML={{__html: q.enunciado}} />
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mt-2 truncate">
                                        {FirebaseService.getFullHierarchyString(q, hierarchy)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Main Detail Area */}
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-100/30 relative">
                {selectedQuestion ? (
                    <>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 pb-32">
                            {/* Similarity Alert */}
                            {similarityCheck.loading ? (
                                <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-2xl flex items-center gap-3 animate-pulse">
                                    <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                                    <span className="text-blue-800 text-xs font-black uppercase tracking-widest">IA Analisando duplicidade no banco...</span>
                                </div>
                            ) : (
                                similarityCheck.result?.isDuplicate && (
                                    <div className="mb-6 p-5 bg-red-50 border-2 border-red-200 rounded-2xl animate-scale-in">
                                        <div className="flex items-center gap-2 text-red-700 font-black mb-1 text-sm uppercase tracking-tight">
                                            <Icons.Shield /> ALERTA DE DUPLICIDADE ({similarityCheck.result.score}%)
                                        </div>
                                        <p className="text-sm text-red-600 mb-3 font-medium">{similarityCheck.result.reason}</p>
                                        <div className="text-[10px] bg-white/50 p-2 rounded-lg border border-red-100 text-slate-600 font-mono">
                                            <span className="font-bold">Match ID:</span> {similarityCheck.result.matchId}
                                        </div>
                                    </div>
                                )
                            )}

                            {/* Question Content */}
                            <Card className="shadow-xl border-none p-8 rounded-[32px]">
                                <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-6">
                                    <div className="flex-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Nível Pedagógico (5 Níveis)</p>
                                        <h3 className="text-sm font-black text-slate-800 leading-relaxed mb-4">
                                            {FirebaseService.getFullHierarchyString(selectedQuestion, hierarchy)}
                                        </h3>
                                        <div className="flex gap-2">
                                            <span className="bg-slate-800 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight">{selectedQuestion.type}</span>
                                            <Badge color={selectedQuestion.difficulty === 'Hard' ? 'red' : 'orange'}>{selectedQuestion.difficulty}</Badge>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Autor da Questão</p>
                                        <p className="text-[9px] font-bold text-slate-400 font-mono truncate max-w-[150px] uppercase">ID: {selectedQuestion.authorId}</p>
                                        <p className="text-sm font-black text-slate-800 leading-tight mt-0.5">
                                            {allUsers.find(u => u.id === selectedQuestion.authorId)?.name || 'Carregando...'}
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="prose prose-slate max-w-none p-6 bg-slate-50 rounded-2xl border-2 border-slate-100 mb-8 rich-text-content font-medium text-lg leading-relaxed text-slate-700" dangerouslySetInnerHTML={{__html: selectedQuestion.enunciado}} />
                                
                                <div className="space-y-3">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Gabarito Enviado</p>
                                    {selectedQuestion.options?.map((opt, i) => (
                                        <div key={opt.id} className={`p-4 rounded-2xl border-2 flex items-center gap-4 transition-all ${opt.isCorrect ? 'bg-green-50 border-green-300 shadow-md shadow-green-100' : 'bg-white border-slate-100 opacity-60'}`}>
                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm ${opt.isCorrect ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-400'}`}>{String.fromCharCode(65+i)}</div>
                                            <span className={`flex-1 font-bold ${opt.isCorrect ? 'text-green-900' : 'text-slate-700'}`}>{opt.text}</span>
                                            {opt.isCorrect && <div className="bg-green-500 text-white rounded-full p-1"><Icons.Check className="w-3 h-3" /></div>}
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        </div>

                        {/* Action Bar */}
                        <div className="absolute bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-md border-t border-slate-200 shadow-2xl flex justify-between items-center z-10">
                            <Button 
                                variant="ghost" 
                                onClick={() => setIsRejectModalOpen(true)} 
                                disabled={isActionLoading}
                                className="text-red-500 hover:bg-red-50 hover:text-red-700 font-black uppercase text-xs"
                            >
                                <Icons.X /> Rejeitar Conteúdo
                            </Button>
                            <div className="flex gap-4">
                                <Button 
                                    variant="outline" 
                                    onClick={() => handleSelect(selectedQuestion)}
                                    disabled={isActionLoading}
                                    className="font-black uppercase text-xs border-slate-300"
                                >
                                    <Icons.Refresh /> Re-analisar IA
                                </Button>
                                <Button 
                                    onClick={handleApprove} 
                                    disabled={isActionLoading}
                                    className="bg-green-600 hover:bg-green-700 text-white shadow-xl shadow-green-100 h-14 px-10 rounded-2xl font-black text-base"
                                >
                                    {isActionLoading ? 'Processando...' : <><Icons.Check /> Aprovar & Publicar Globalmente</>}
                                </Button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-300 p-8">
                        <div className="w-32 h-32 bg-slate-200/50 rounded-[40px] flex items-center justify-center mb-6">
                            <Icons.Shield className="w-16 h-16 text-slate-300" />
                        </div>
                        <p className="text-2xl font-black uppercase tracking-widest text-slate-400">Fila de Revisão</p>
                        <p className="text-sm font-medium mt-2">Selecione uma questão lateral para auditar o conteúdo.</p>
                    </div>
                )}
            </div>

            {/* Modal de Rejeição */}
            <Modal isOpen={isRejectModalOpen} onClose={() => !isActionLoading && setIsRejectModalOpen(false)} title="Reprovar Questão" footer={<Button onClick={handleReject} variant="danger" disabled={isActionLoading}>{isActionLoading ? 'Aguarde...' : 'Confirmar Reprovação'}</Button>}>
                <div className="space-y-4">
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-xs text-red-800 font-medium">
                        A questão será devolvida ao autor como "Privada" e o motivo abaixo será exibido para ele.
                    </div>
                    <Input label="Motivo da Reprovação" value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Ex: Contém erros gramaticais graves ou é duplicada." autoFocus />
                    <div className="flex flex-wrap gap-2">
                        {['Duplicidade', 'Erro Gramatical', 'Incorreta', 'Incompleta', 'Imprópria'].map(reason => (
                            <button key={reason} onClick={() => setRejectReason(reason)} className="text-[10px] font-black uppercase bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors">{reason}</button>
                        ))}
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default ModerationPage;
