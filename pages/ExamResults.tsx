
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FirebaseService } from '../services/firebaseService';
import { GeminiService } from '../services/geminiService';
import { Exam, ExamAttempt, QuestionType, Question, Discipline, CurricularComponent } from '../types';
import { Button, Card, Badge, Modal, Input } from '../components/UI';
import { Icons } from '../components/Icons';

const ExamResults = () => {
    const { state } = useLocation();
    const navigate = useNavigate();
    const [exam, setExam] = useState<Exam | null>(null);
    const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
    const [hierarchy, setHierarchy] = useState<CurricularComponent[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'LIST' | 'ANALYSIS'>('LIST');
    
    const [selectedAttempt, setSelectedAttempt] = useState<ExamAttempt | null>(null);
    const [discursiveScores, setDiscursiveScores] = useState<Record<string, number>>({});
    const [isGradingModalOpen, setIsGradingModalOpen] = useState(false);

    useEffect(() => {
        if (!state?.examId) { navigate('/exams'); return; }
        loadData();
    }, [state, navigate]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [e, a, h] = await Promise.all([
                FirebaseService.getExamById(state.examId),
                FirebaseService.getExamResults(state.examId),
                FirebaseService.getHierarchy() as Promise<CurricularComponent[]>
            ]);
            setExam(e);
            setHierarchy(h || []);
            const sortedAttempts = (Array.isArray(a) ? a : []).sort((x, y) => 
                (x.studentName || '').localeCompare(y.studentName || '', 'pt-BR')
            );
            setAttempts(sortedAttempts);
        } catch (err) {
            console.error("Erro ao carregar dados:", err);
        } finally {
            setLoading(false);
        }
    };

    // Helper memoizado para garantir que as questões sejam tratadas sempre como array
    const questions = useMemo(() => {
        if (!exam || !exam.questions) return [];
        return Array.isArray(exam.questions) ? exam.questions : [];
    }, [exam]);

    const handleOpenGrading = (attempt: ExamAttempt) => {
        if (!exam) return;
        setSelectedAttempt(attempt);
        const scores: Record<string, number> = {};
        
        questions.forEach(q => {
            if (q.type === QuestionType.SHORT_ANSWER) {
                scores[q.id] = attempt.questionScores?.[q.id] || 0;
            }
        });
        setDiscursiveScores(scores);
        setIsGradingModalOpen(true);
    };

    const currentTotalScore = useMemo(() => {
        if (!selectedAttempt || questions.length === 0) return 0;
        
        let objetivasAcertos = 0;
        questions.forEach(q => {
            if (q.type !== QuestionType.SHORT_ANSWER) {
                const studentAns = selectedAttempt.answers?.[q.id];
                const correctOpt = q.options?.find(o => o.isCorrect);
                if (studentAns === correctOpt?.id || studentAns === correctOpt?.text) {
                    objetivasAcertos++;
                }
            }
        });

        const scoresArray = Object.values(discursiveScores) as number[];
        const discursivasSoma = scoresArray.reduce((a, b) => a + b, 0);
        return Number((objetivasAcertos + discursivasSoma).toFixed(2));
    }, [selectedAttempt, questions, discursiveScores]);

    const handleSaveScore = async () => {
        if (!selectedAttempt) return;
        setLoading(true);
        try {
            await FirebaseService.updateAttemptScore(selectedAttempt.id, currentTotalScore, true, discursiveScores);
            setIsGradingModalOpen(false);
            await loadData();
        } catch (e) {
            alert("Erro ao salvar nota.");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateDiscursiveNote = (qId: string, val: string) => {
        const normalized = val.replace(',', '.');
        const num = parseFloat(normalized) || 0;
        setDiscursiveScores(prev => ({ ...prev, [qId]: num }));
    };

    const hasDiscursiveInExam = useMemo(() => {
        return questions.some(q => q.type === QuestionType.SHORT_ANSWER);
    }, [questions]);

    const topicAnalysis = useMemo(() => {
        if (!exam || questions.length === 0 || attempts.length === 0) return [];

        const topicLookup: Record<string, { name: string, path: string }> = {};
        (hierarchy || []).forEach(cc => {
            (cc.disciplines || []).forEach(d => {
                (d.chapters || []).forEach(c => {
                    (c.units || []).forEach(u => {
                        (u.topics || []).forEach(t => {
                            topicLookup[t.id] = { name: t.name, path: `${cc.name} > ${d.name}` };
                        });
                    });
                });
            });
        });

        const analysisMap: Record<string, { name: string, path: string, total: number, correct: number }> = {};
        
        questions.forEach(q => {
            const topicId = q.topicId || 'unclassified';
            if (!analysisMap[topicId]) {
                const info = topicLookup[topicId] || { name: 'Geral', path: 'Outros' };
                analysisMap[topicId] = { ...info, total: 0, correct: 0 };
            }
            
            attempts.forEach(att => {
                analysisMap[topicId].total++;
                const studentAns = att.answers?.[q.id];
                const isDiscursive = q.type === QuestionType.SHORT_ANSWER;
                if (isDiscursive) {
                    if ((att.questionScores?.[q.id] || 0) >= 0.6) analysisMap[topicId].correct++;
                } else {
                    const correctOpt = q.options?.find(o => o.isCorrect);
                    if (studentAns === correctOpt?.id || studentAns === correctOpt?.text) {
                        analysisMap[topicId].correct++;
                    }
                }
            });
        });
        return Object.values(analysisMap);
    }, [exam, questions, attempts, hierarchy]);

    if (loading && attempts.length === 0) return (
        <div className="flex-1 flex items-center justify-center bg-slate-50">
            <div className="text-center font-black text-slate-300 animate-pulse uppercase tracking-widest">
                Sincronizando Resultados...
            </div>
        </div>
    );

    return (
        <div className="flex-1 min-h-0 flex flex-col bg-slate-50 overflow-y-auto custom-scrollbar p-8">
            <div className="mb-8 flex flex-col md:flex-row justify-between items-start gap-4 shrink-0">
                <div>
                    <button onClick={() => navigate('/exams')} className="text-slate-400 hover:text-slate-600 flex items-center gap-1 text-sm mb-2 font-bold"><Icons.ArrowLeft /> Voltar</button>
                    <h2 className="text-3xl font-display font-bold text-slate-800 tracking-tight">Resultados: {exam?.title}</h2>
                    <p className="text-slate-500 mt-1">Análise de desempenho individual e por tema curricular.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10 shrink-0">
                <Card className="p-6 border-l-4 border-l-blue-500 shadow-sm flex flex-col items-center text-center">
                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Avaliados</p>
                    <p className="text-4xl font-black text-slate-800">{attempts.length}</p>
                </Card>
                <Card className="p-6 border-l-4 border-l-emerald-500 shadow-sm flex flex-col items-center text-center">
                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Média Turma</p>
                    <p className="text-4xl font-black text-emerald-600">
                        {attempts.length > 0 
                            ? (attempts.reduce((a, b) => a + (b.score / (b.totalQuestions || 1)), 0) / attempts.length * 10).toFixed(1)
                            : '0.0'}
                    </p>
                </Card>
                <Card className="p-6 border-l-4 border-l-orange-500 shadow-sm flex flex-col items-center text-center">
                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Pendentes</p>
                    <p className="text-4xl font-black text-orange-600">
                        {attempts.filter(a => !a.manualGradingComplete && hasDiscursiveInExam).length}
                    </p>
                </Card>
                <Card className="p-6 border-l-4 border-l-purple-500 shadow-sm flex flex-col items-center text-center">
                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Excelência</p>
                    <p className="text-4xl font-black text-purple-600">
                        {attempts.filter(a => (a.score / (a.totalQuestions || 1)) >= 0.8).length}
                    </p>
                </Card>
            </div>

            <div className="flex gap-6 border-b border-slate-200 mb-8 shrink-0">
                <button onClick={() => setActiveTab('LIST')} className={`pb-3 px-2 text-sm font-black uppercase tracking-widest transition-all ${activeTab === 'LIST' ? 'text-brand-blue border-b-4 border-brand-blue' : 'text-slate-400 hover:text-slate-600'}`}>Lista de Alunos</button>
                <button onClick={() => setActiveTab('ANALYSIS')} className={`pb-3 px-2 text-sm font-black uppercase tracking-widest transition-all ${activeTab === 'ANALYSIS' ? 'text-brand-blue border-b-4 border-brand-blue' : 'text-slate-400 hover:text-slate-600'}`}>Análise de Temas</button>
            </div>

            <div className="flex-1 min-h-0">
                {activeTab === 'LIST' ? (
                    <Card className="overflow-visible shadow-md">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="p-4 text-slate-500 font-black uppercase text-[10px]">Aluno / Identificação</th>
                                    <th className="p-4 text-slate-500 font-black uppercase text-[10px]">Status</th>
                                    <th className="p-4 text-slate-500 font-black uppercase text-[10px]">Pontuação</th>
                                    <th className="p-4 text-right text-slate-500 font-black uppercase text-[10px]">Revisão</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {attempts.length === 0 ? (
                                    <tr><td colSpan={4} className="p-20 text-center text-slate-400 italic font-bold uppercase tracking-widest opacity-50">Nenhum resultado processado.</td></tr>
                                ) : (
                                    attempts.map((att) => {
                                        const isGraded = !hasDiscursiveInExam || att.manualGradingComplete;
                                        return (
                                            <tr key={att.id} className="hover:bg-slate-50 transition-colors group">
                                                <td className="p-4">
                                                    <div className="font-bold text-slate-800 text-base">{att.studentName}</div>
                                                    <div className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-widest">{att.studentIdentifier || 'S/ IDENTIFICAÇÃO'}</div>
                                                </td>
                                                <td className="p-4">
                                                    {isGraded ? (
                                                        <Badge color="green">FINALIZADO</Badge>
                                                    ) : (
                                                        <Badge color="orange">REVISÃO MANUAL</Badge>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="text-xl font-black text-slate-700">{att.score.toFixed(1)}</span>
                                                        <span className="text-slate-300 font-bold">/ {att.totalQuestions}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <button onClick={() => handleOpenGrading(att)} className="text-brand-blue hover:bg-blue-100 p-3 rounded-xl transition-all border border-transparent hover:border-blue-200 shadow-sm active:scale-95">
                                                        <Icons.Eye />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in pb-10">
                         {topicAnalysis.length === 0 ? (
                             <Card className="col-span-full py-20 text-center border-2 border-dashed border-slate-200 bg-white">
                                 <p className="text-slate-400 font-bold italic">Aguardando dados de alunos para gerar mapa de desempenho por tema.</p>
                             </Card>
                         ) : topicAnalysis.map((topic, i) => {
                            const pct = (topic.correct / Math.max(1, topic.total)) * 100;
                            return (
                                <Card key={i} className="p-6 border border-slate-200 hover:shadow-md transition-shadow">
                                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1 tracking-widest">{topic.path}</p>
                                    <h4 className="font-bold text-slate-800 text-lg mb-4 leading-tight">{topic.name}</h4>
                                    <div className="flex justify-between items-end mb-3">
                                        <span className={`text-3xl font-black ${pct >= 70 ? 'text-green-600' : pct >= 40 ? 'text-orange-600' : 'text-red-600'}`}>{pct.toFixed(0)}%</span>
                                        <span className="text-[10px] text-slate-400 font-black uppercase">{topic.correct} acertos na turma</span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                                        <div className={`h-full transition-all duration-700 ${pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-orange-500' : 'bg-red-500'}`} style={{width: `${pct}%`}}></div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>

            <Modal 
                isOpen={isGradingModalOpen} 
                onClose={() => setIsGradingModalOpen(false)} 
                title={`Revisão Individual: ${selectedAttempt?.studentName}`} 
                maxWidth="max-w-4xl" 
                footer={
                    <div className="flex gap-4 items-center w-full justify-between">
                        <div className="flex items-center gap-3 bg-blue-50 p-2 rounded-2xl px-6 border border-blue-200">
                            <label className="font-black text-xs text-blue-800 uppercase tracking-tighter">Nota Final:</label>
                            <span className="text-2xl font-black text-brand-blue">{currentTotalScore}</span>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="ghost" onClick={() => setIsGradingModalOpen(false)}>Cancelar</Button>
                            <Button onClick={handleSaveScore} className="shadow-xl shadow-blue-100 h-12 px-8 text-base">Salvar Alterações</Button>
                        </div>
                    </div>
                }
            >
                <div className="space-y-8 py-4">
                    {questions.length > 0 ? (
                        questions.map((q, idx) => {
                            const studentAns = selectedAttempt?.answers?.[q.id];
                            const isDiscursive = q.type === QuestionType.SHORT_ANSWER;
                            const correctOpt = q.options?.find(o => o.isCorrect);
                            const isCorrectMC = !isDiscursive && (studentAns === correctOpt?.id || studentAns === correctOpt?.text);

                            return (
                                <div key={q.id} className={`p-6 rounded-3xl border-2 transition-all ${isDiscursive ? 'bg-orange-50/20 border-orange-200' : (isCorrectMC ? 'bg-green-50/20 border-green-100' : 'bg-slate-50 border-slate-200')}`}>
                                    <div className="flex gap-4 mb-6">
                                        <span className="font-black text-slate-300 text-2xl">{idx+1}.</span>
                                        <div className="flex-1 text-sm font-bold text-slate-800 rich-text-content" dangerouslySetInnerHTML={{__html: q.enunciado}} />
                                        {isDiscursive ? (
                                            <Badge color="orange">DISCURSIVA</Badge>
                                        ) : (
                                            isCorrectMC ? <div className="text-green-500 p-1 bg-green-100 rounded-full"><Icons.Check /></div> : <div className="text-red-500 p-1 bg-red-100 rounded-full"><Icons.X /></div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                                            <b className="text-slate-400 uppercase text-[9px] font-black tracking-widest block mb-2">Resposta Enviada:</b>
                                            <div className="text-slate-700 text-sm font-bold italic">
                                                {isDiscursive 
                                                    ? (studentAns || '(Sem resposta escrita)') 
                                                    : (q.options?.find(o => o.id === studentAns || o.text === studentAns)?.text || studentAns || '(Não respondeu)')
                                                }
                                            </div>
                                        </div>
                                        <div className={`p-4 rounded-2xl shadow-md text-sm ${isDiscursive ? 'bg-slate-800 text-white' : 'bg-green-600 text-white'}`}>
                                            <b className="text-white/40 uppercase text-[9px] font-black tracking-widest block mb-2">Gabarito de Referência:</b>
                                            <div className="font-bold">
                                                {isDiscursive 
                                                    ? 'Questão dissertativa. Avalie a resposta e atribua a nota abaixo.' 
                                                    : (correctOpt?.text || 'Não definido')
                                                }
                                            </div>
                                        </div>
                                    </div>

                                    {isDiscursive && (
                                        <div className="mt-6 flex flex-col md:flex-row gap-4 items-center justify-between bg-orange-100/50 p-4 rounded-2xl border border-orange-200">
                                            <div className="flex items-center gap-2 text-orange-800">
                                                <Icons.Magic />
                                                <span className="text-xs font-black uppercase">Nota da Questão (0.0 a 1.0):</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <input 
                                                    type="number" 
                                                    step="0.1" 
                                                    min="0" 
                                                    max="1" 
                                                    value={discursiveScores[q.id] || 0}
                                                    onChange={e => handleUpdateDiscursiveNote(q.id, e.target.value)}
                                                    className="w-24 h-11 text-center font-black text-lg border-2 border-brand-blue rounded-xl outline-none focus:ring-4 focus:ring-blue-100 shadow-sm bg-white" 
                                                />
                                                <div className="flex gap-1">
                                                    <button onClick={() => setDiscursiveScores(prev => ({...prev, [q.id]: 0.5}))} className="px-2 py-1 bg-white border border-orange-300 text-[10px] font-bold rounded-lg hover:bg-orange-50 shadow-sm">0.5</button>
                                                    <button onClick={() => setDiscursiveScores(prev => ({...prev, [q.id]: 1.0}))} className="px-2 py-1 bg-brand-blue text-white text-[10px] font-bold rounded-lg shadow-sm hover:bg-blue-700">1.0</button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    ) : (
                        <div className="p-20 text-center text-slate-400 font-bold italic animate-pulse">A prova não possui questões cadastradas para exibição.</div>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default ExamResults;
