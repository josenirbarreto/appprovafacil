
import React, { useState, useEffect } from 'react';
import { Question, QuestionType, ReviewStatus } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { GeminiService } from '../services/geminiService';
import { Button, Card, Badge, Modal, Input } from '../components/UI';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

const ModerationPage = () => {
    const { user } = useAuth();
    const [pendingQuestions, setPendingQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
    const [similarityCheck, setSimilarityCheck] = useState<{ loading: boolean, result: any }>({ loading: false, result: null });
    const [rejectReason, setRejectReason] = useState('');
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);

    useEffect(() => {
        if (user?.role === 'ADMIN') loadPending();
    }, [user]);

    const loadPending = async () => {
        setLoading(true);
        try {
            const data = await FirebaseService.getPendingQuestions();
            setPendingQuestions(data);
            if (data.length > 0) handleSelect(data[0]);
            else setSelectedQuestion(null);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = async (q: Question) => {
        setSelectedQuestion(q);
        setSimilarityCheck({ loading: true, result: null });
        
        // Busca sample de questões já aprovadas da MESMA disciplina para comparar
        // OBS: Em produção ideal, usaria busca vetorial. Aqui pegamos as ultimas 50 da mesma disciplina.
        try {
            const allQuestions = await FirebaseService.getQuestions({ ...user, role: 'ADMIN' } as any);
            const candidates = allQuestions
                .filter(x => x.disciplineId === q.disciplineId && x.reviewStatus === 'APPROVED' && x.id !== q.id)
                .slice(0, 50);

            const result = await GeminiService.checkSimilarity(q.enunciado, candidates);
            setSimilarityCheck({ loading: false, result });
        } catch (e) {
            console.error(e);
            setSimilarityCheck({ loading: false, result: { error: true } });
        }
    };

    const handleApprove = async () => {
        if (!selectedQuestion) return;
        if (confirm("Aprovar e publicar esta questão globalmente?")) {
            await FirebaseService.approveQuestion(selectedQuestion.id);
            loadPending();
        }
    };

    const handleReject = async () => {
        if (!selectedQuestion || !rejectReason.trim()) return alert("Informe o motivo.");
        await FirebaseService.rejectQuestion(selectedQuestion.id, rejectReason);
        setIsRejectModalOpen(false);
        setRejectReason('');
        loadPending();
    };

    if (user?.role !== 'ADMIN') return <Navigate to="/" />;

    if (loading) return <div className="p-8 text-center text-slate-500">Carregando fila de moderação...</div>;

    return (
        <div className="flex h-full bg-slate-50 overflow-hidden">
            {/* Sidebar List */}
            <div className="w-1/3 min-w-[300px] border-r border-slate-200 bg-white flex flex-col">
                <div className="p-4 border-b border-slate-100 bg-slate-50">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Icons.Shield /> Moderação ({pendingQuestions.length})
                    </h2>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {pendingQuestions.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 italic">Fila vazia! Tudo limpo.</div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {pendingQuestions.map(q => (
                                <div 
                                    key={q.id} 
                                    onClick={() => handleSelect(q)}
                                    className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors border-l-4 ${selectedQuestion?.id === q.id ? 'border-brand-blue bg-blue-50' : 'border-transparent'}`}
                                >
                                    <div className="flex justify-between mb-1">
                                        <Badge color="yellow">Pendente</Badge>
                                        <span className="text-xs text-slate-400">{new Date(q.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <div className="text-sm text-slate-800 line-clamp-2 font-medium" dangerouslySetInnerHTML={{__html: q.enunciado}} />
                                    <p className="text-xs text-slate-400 mt-1">ID: {q.id.slice(0,6)}...</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Main Detail Area */}
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 relative">
                {selectedQuestion ? (
                    <>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 pb-24">
                            {/* Similarity Alert */}
                            {similarityCheck.loading ? (
                                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3 animate-pulse">
                                    <Icons.Sparkles /> <span className="text-blue-800 text-sm font-bold">IA Analisando duplicidade...</span>
                                </div>
                            ) : (
                                similarityCheck.result?.isDuplicate && (
                                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                                        <div className="flex items-center gap-2 text-red-700 font-bold mb-1">
                                            <Icons.Shield /> ALERTA DE DUPLICIDADE ({similarityCheck.result.score}%)
                                        </div>
                                        <p className="text-sm text-red-600 mb-2">{similarityCheck.result.reason}</p>
                                        <div className="text-xs bg-white p-2 rounded border border-red-100 text-slate-600">
                                            <span className="font-bold">Match ID:</span> {similarityCheck.result.matchId}
                                        </div>
                                    </div>
                                )
                            )}

                            {/* Question Content */}
                            <Card className="mb-6">
                                <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-4">
                                    <div>
                                        <h3 className="font-bold text-slate-800">Conteúdo da Questão</h3>
                                        <div className="flex gap-2 mt-1">
                                            <Badge>{selectedQuestion.type}</Badge>
                                            <Badge color="purple">{selectedQuestion.difficulty}</Badge>
                                        </div>
                                    </div>
                                    <div className="text-right text-xs text-slate-500">
                                        <p>Autor ID: {selectedQuestion.authorId}</p>
                                        <p>Disciplina ID: {selectedQuestion.disciplineId}</p>
                                    </div>
                                </div>
                                
                                <div className="prose prose-slate max-w-none p-4 bg-slate-50 rounded-lg border border-slate-200" dangerouslySetInnerHTML={{__html: selectedQuestion.enunciado}} />
                                
                                <div className="mt-4 space-y-2">
                                    {selectedQuestion.options?.map((opt, i) => (
                                        <div key={i} className={`p-3 rounded border flex gap-3 ${opt.isCorrect ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'}`}>
                                            <span className="font-bold">{String.fromCharCode(65+i)}</span>
                                            <span>{opt.text}</span>
                                            {opt.isCorrect && <Icons.Check />}
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        </div>

                        {/* Action Bar */}
                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-lg flex justify-between items-center z-10">
                            <Button variant="ghost" onClick={() => setIsRejectModalOpen(true)} className="text-red-500 hover:bg-red-50 hover:text-red-700">
                                <Icons.X /> Rejeitar
                            </Button>
                            <div className="flex gap-3">
                                <Button variant="outline" onClick={() => handleSelect(selectedQuestion)}>
                                    <Icons.Refresh /> Re-analisar IA
                                </Button>
                                <Button onClick={handleApprove} className="bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-200">
                                    <Icons.Check /> Aprovar & Publicar
                                </Button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                        <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center mb-4"><Icons.Shield /></div>
                        <p className="text-xl font-bold">Moderação de Qualidade</p>
                        <p>Selecione uma questão para revisar.</p>
                    </div>
                )}
            </div>

            {/* Modal de Rejeição */}
            <Modal isOpen={isRejectModalOpen} onClose={() => setIsRejectModalOpen(false)} title="Rejeitar Questão" footer={<Button onClick={handleReject} variant="danger">Confirmar Rejeição</Button>}>
                <div className="space-y-4">
                    <p className="text-sm text-slate-600">O autor receberá este motivo e a questão voltará para rascunho privado.</p>
                    <Input label="Motivo da Rejeição" value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Ex: Conteúdo duplicado, erro gramatical, ofensivo..." autoFocus />
                    <div className="flex gap-2">
                        {['Duplicidade', 'Erro de Português', 'Conteúdo Impróprio', 'Incompleta'].map(reason => (
                            <button key={reason} onClick={() => setRejectReason(reason)} className="text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded border border-slate-200">{reason}</button>
                        ))}
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default ModerationPage;
