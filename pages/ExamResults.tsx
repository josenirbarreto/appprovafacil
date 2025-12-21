
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FirebaseService } from '../services/firebaseService';
import { GeminiService } from '../services/geminiService';
import { Exam, ExamAttempt, QuestionType, Question, Discipline } from '../types';
import { Button, Card, Badge, Modal, Input } from '../components/UI';
import { Icons } from '../components/Icons';

const ExamResults = () => {
    const { state } = useLocation();
    const navigate = useNavigate();
    const [exam, setExam] = useState<Exam | null>(null);
    const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
    const [hierarchy, setHierarchy] = useState<Discipline[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'LIST' | 'ANALYSIS'>('LIST');
    
    const [selectedAttempt, setSelectedAttempt] = useState<ExamAttempt | null>(null);
    const [editingScore, setEditingScore] = useState<number>(0);
    const [isGradingModalOpen, setIsGradingModalOpen] = useState(false);

    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [cameraActive, setCameraActive] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [scanning, setScanning] = useState(false);
    const [scanResult, setScanResult] = useState<{ studentName: string, score: number, answers: Record<string, string> } | null>(null);

    useEffect(() => {
        if (!state?.examId) { navigate('/exams'); return; }
        loadData();
    }, [state, navigate]);

    useEffect(() => {
        if (!isScannerOpen && cameraActive) stopCamera();
    }, [isScannerOpen]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [e, a, h] = await Promise.all([
                FirebaseService.getExamById(state.examId),
                FirebaseService.getExamResults(state.examId),
                FirebaseService.getHierarchy()
            ]);
            setExam(e);
            setHierarchy(h);
            // Ordenação garantida para evitar saltos na lista
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

    const handleExportExcel = () => {
        if (!attempts.length || !exam) return;
        const BOM = "\uFEFF";
        const headers = ["Nome do Aluno", "Identificador", "Data de Entrega", "Acertos", "Total de Questoes", "% Aproveitamento"];
        const rows = attempts.map(att => {
            const pct = ((att.score / Math.max(1, att.totalQuestions)) * 100).toFixed(1);
            return [
                att.studentName,
                att.studentIdentifier || 'N/A',
                att.submittedAt ? new Date(att.submittedAt).toLocaleString() : 'N/A',
                att.score,
                att.totalQuestions,
                `${pct}%`
            ].join(";");
        });
        const csvContent = BOM + headers.join(";") + "\n" + rows.join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `Relatorio_Notas_${exam.title.replace(/\s+/g, '_')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // Lógica de Correção Discursiva Individual
    const handleToggleDiscursivePoint = (isCorrect: boolean) => {
        if (isCorrect) setEditingScore(prev => prev + 1);
        else setEditingScore(prev => Math.max(0, prev - 1));
    };

    const handleOpenGrading = (attempt: ExamAttempt) => {
        setSelectedAttempt(attempt);
        setEditingScore(attempt.score);
        setIsGradingModalOpen(true);
    };

    const handleSaveScore = async () => {
        if (!selectedAttempt) return;
        setLoading(true);
        try {
            await FirebaseService.updateAttemptScore(selectedAttempt.id, Number(editingScore));
            await loadData();
            setIsGradingModalOpen(false);
        } catch (e) {
            alert("Erro ao salvar nota.");
        } finally {
            setLoading(false);
        }
    };

    // Análise de desempenho por questão e distratores
    const analysisData = useMemo(() => {
        if (!exam || !Array.isArray(exam.questions) || attempts.length === 0) return [];
        return exam.questions.map((q, idx) => {
            let correctCount = 0;
            const optionCounts: Record<string, number> = {};
            if (q.type === QuestionType.MULTIPLE_CHOICE && Array.isArray(q.options)) {
                q.options.forEach(opt => { optionCounts[opt.id] = 0; });
            }
            attempts.forEach(attempt => {
                const answer = attempt.answers?.[q.id];
                if (!answer) return;
                const correctOpt = Array.isArray(q.options) ? q.options.find(o => o.isCorrect) : null;
                if (correctOpt && (answer === correctOpt.id || answer === correctOpt.text)) correctCount++;
                if (q.type === QuestionType.MULTIPLE_CHOICE && Array.isArray(q.options)) {
                    const matchedOpt = q.options.find(o => o.id === answer || o.text === answer);
                    if (matchedOpt) optionCounts[matchedOpt.id]++;
                }
            });
            const successRate = (correctCount / attempts.length) * 100;
            return { question: q, index: idx + 1, correctCount, successRate, optionCounts };
        });
    }, [exam, attempts]);

    const topicAnalysis = useMemo(() => {
        const map: Record<string, { name: string, total: number, correct: number, count: number, path: string }> = {};
        analysisData.forEach(item => {
            const topicId = item.question.topicId || 'unclassified';
            if (!map[topicId]) {
                let topicName = 'Geral';
                let pathStr = 'Geral';
                hierarchy.forEach(d => d.chapters.forEach(c => c.units.forEach(u => u.topics.forEach(t => {
                    if (t.id === topicId) { topicName = t.name; pathStr = `${d.name} > ${c.name}`; }
                }))));
                map[topicId] = { name: topicName, total: 0, correct: 0, count: 0, path: pathStr };
            }
            map[topicId].total += attempts.length;
            map[topicId].correct += item.correctCount;
            map[topicId].count += 1;
        });
        return Object.values(map).sort((a,b) => (a.correct/a.total) - (b.correct/b.total));
    }, [analysisData, attempts.length, hierarchy]);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            if (videoRef.current) { videoRef.current.srcObject = stream; setCameraActive(true); }
        } catch (err) { alert("Erro ao acessar câmera."); }
    };

    const stopCamera = () => {
        if (videoRef.current?.srcObject) {
            (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
            setCameraActive(false);
        }
    };

    const handleCapture = () => {
        if (videoRef.current && canvasRef.current) {
            const canvas = canvasRef.current;
            canvas.width = videoRef.current.videoWidth; canvas.height = videoRef.current.videoHeight;
            canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
            const imageData = canvas.toDataURL('image/jpeg', 0.8);
            setCapturedImage(imageData);
            stopCamera();
            processImage(imageData);
        }
    };

    const processImage = async (imageBase64: string) => {
        if (!exam) return;
        setScanning(true);
        try {
            const result = await GeminiService.gradeExamImage(imageBase64, exam.questions.length);
            if (result) {
                let score = 0;
                const evaluatedAnswers: Record<string, string> = {};
                exam.questions.forEach((q, idx) => {
                    const detected = result.answers[(idx+1).toString()];
                    if (detected) {
                        const letterMap = ['A', 'B', 'C', 'D', 'E'];
                        const correctIdx = q.options?.findIndex(o => o.isCorrect) ?? -1;
                        if (correctIdx >= 0 && detected.toUpperCase() === letterMap[correctIdx]) score++;
                        evaluatedAnswers[q.id] = detected;
                    }
                });
                setScanResult({ studentName: result.studentName || "Aluno Desconhecido", score, answers: evaluatedAnswers });
            }
        } finally { setScanning(false); }
    };

    const handleSaveScan = async () => {
        if (!scanResult || !exam) return;
        const attempt = await FirebaseService.startAttempt(exam.id, scanResult.studentName, 'SCAN-' + Date.now(), exam.questions.length);
        await FirebaseService.submitAttempt(attempt.id, scanResult.answers, scanResult.score, exam.questions.length);
        setIsScannerOpen(false); setScanResult(null); loadData();
    };

    const hasDiscursive = exam?.questions.some(q => q.type === QuestionType.SHORT_ANSWER);

    if (loading && !attempts.length) return <div className="p-10 text-center animate-pulse font-bold text-slate-400">Processando resultados...</div>;

    return (
        <div className="p-8 h-full flex flex-col bg-slate-50 overflow-y-auto custom-scrollbar">
            <div className="mb-6 flex flex-col md:flex-row justify-between items-start gap-4">
                <div>
                    <button onClick={() => navigate('/exams')} className="text-slate-400 hover:text-slate-600 flex items-center gap-1 text-sm mb-2 font-bold"><Icons.ArrowLeft /> Voltar</button>
                    <h2 className="text-3xl font-display font-bold text-slate-800 tracking-tight">Análise Pedagógica: {exam?.title}</h2>
                    <p className="text-slate-500 mt-1">Gestão de notas, correção manual e BI por descritores.</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" onClick={handleExportExcel} disabled={attempts.length === 0} className="border-emerald-200 text-emerald-700 bg-white">
                        <Icons.Download /> Exportar Excel
                    </Button>
                    <Button variant="secondary" onClick={() => { setIsScannerOpen(true); startCamera(); }}>
                        <Icons.Camera /> Escanear Gabaritos
                    </Button>
                </div>
            </div>

            {/* KPI CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <Card className="p-6 border-l-4 border-l-blue-500 shadow-sm flex flex-col items-center">
                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Avaliados</p>
                    <p className="text-4xl font-black text-slate-800">{attempts.length}</p>
                </Card>
                <Card className="p-6 border-l-4 border-l-emerald-500 shadow-sm flex flex-col items-center">
                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Média Acertos</p>
                    <p className="text-4xl font-black text-emerald-600">{(attempts.reduce((a,b) => a+b.score, 0) / Math.max(1, attempts.length)).toFixed(1)}</p>
                </Card>
                <Card className="p-6 border-l-4 border-l-orange-500 shadow-sm flex flex-col items-center">
                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Zona de Alerta</p>
                    <p className="text-4xl font-black text-orange-600">{attempts.filter(a => (a.score/a.totalQuestions) < 0.5).length}</p>
                </Card>
                <Card className="p-6 border-l-4 border-l-purple-500 shadow-sm flex flex-col items-center">
                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Alta Performance</p>
                    <p className="text-4xl font-black text-purple-600">{attempts.filter(a => (a.score/a.totalQuestions) >= 0.8).length}</p>
                </Card>
            </div>

            {/* TABS */}
            <div className="flex gap-6 border-b border-slate-200 mb-8">
                <button onClick={() => setActiveTab('LIST')} className={`pb-3 px-2 text-sm font-black uppercase transition-all ${activeTab === 'LIST' ? 'text-brand-blue border-b-4 border-brand-blue' : 'text-slate-400'}`}>Lista de Alunos</button>
                <button onClick={() => setActiveTab('ANALYSIS')} className={`pb-3 px-2 text-sm font-black uppercase transition-all ${activeTab === 'ANALYSIS' ? 'text-brand-blue border-b-4 border-brand-blue' : 'text-slate-400'}`}>Análise por Tópico</button>
            </div>

            {activeTab === 'LIST' ? (
                <Card className="overflow-hidden shadow-md">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="p-4 text-slate-500 font-black uppercase text-[10px]">Aluno / Matrícula</th>
                                <th className="p-4 text-slate-500 font-black uppercase text-[10px]">Data Entrega</th>
                                <th className="p-4 text-slate-500 font-black uppercase text-[10px]">Acertos</th>
                                <th className="p-4 text-slate-500 font-black uppercase text-[10px] text-center">Status Correção</th>
                                <th className="p-4 text-right text-slate-500 font-black uppercase text-[10px]">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {attempts.length === 0 ? (
                                <tr><td colSpan={5} className="p-16 text-center text-slate-400 italic">Aguardando envios...</td></tr>
                            ) : (
                                attempts.map((att) => {
                                    const pct = (att.score / Math.max(1, att.totalQuestions)) * 100;
                                    return (
                                        <tr key={att.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-4">
                                                <div className="font-bold text-slate-800">{att.studentName}</div>
                                                <div className="text-[10px] font-mono text-slate-400">{att.studentIdentifier}</div>
                                            </td>
                                            <td className="p-4 text-xs text-slate-500 font-bold">
                                                {att.submittedAt ? new Date(att.submittedAt).toLocaleDateString() : 'Manual'}
                                            </td>
                                            <td className="p-4">
                                                <span className="text-xl font-black text-slate-700">{att.score}</span>
                                                <span className="text-slate-300 font-bold ml-1">/ {att.totalQuestions}</span>
                                            </td>
                                            <td className="p-4 text-center">
                                                {hasDiscursive ? (
                                                    <Badge color="orange">PENDENTE REVISÃO</Badge>
                                                ) : (
                                                    <Badge color="green">FINALIZADO IA</Badge>
                                                )}
                                            </td>
                                            <td className="p-4 text-right">
                                                <button onClick={() => handleOpenGrading(att)} className="text-brand-blue hover:bg-blue-100 p-2 rounded-xl transition-all border border-blue-50">
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                    {topicAnalysis.map((topic, i) => {
                        const pct = (topic.correct / topic.total) * 100;
                        return (
                            <Card key={i} className="p-5 border border-slate-200">
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">{topic.path}</p>
                                <h4 className="font-bold text-slate-800 mb-3">{topic.name}</h4>
                                <div className="flex justify-between items-end mb-2">
                                    <span className={`text-2xl font-black ${pct >= 70 ? 'text-green-600' : 'text-orange-600'}`}>{pct.toFixed(0)}%</span>
                                    <span className="text-[10px] text-slate-400 font-bold">{topic.correct} acertos totais</span>
                                </div>
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                    <div className={`h-full ${pct >= 70 ? 'bg-green-500' : 'bg-orange-500'}`} style={{width: `${pct}%`}}></div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* MODAL REVISÃO E CORREÇÃO MANUAL */}
            <Modal 
                isOpen={isGradingModalOpen} 
                onClose={() => setIsGradingModalOpen(false)} 
                title={`Correção de Prova: ${selectedAttempt?.studentName}`} 
                maxWidth="max-w-4xl" 
                footer={
                    <div className="flex gap-4 items-center w-full justify-between">
                        <div className="flex items-center gap-3 bg-blue-50 p-2 rounded-xl px-4 border border-blue-100">
                            <label className="font-black text-xs text-blue-800 uppercase tracking-tighter">Nota Final Atualizada:</label>
                            <input 
                                type="number" 
                                value={editingScore} 
                                onChange={e => setEditingScore(Number(e.target.value))} 
                                className="border-2 border-brand-blue rounded px-2 py-1 w-20 text-center font-black outline-none shadow-sm" 
                            />
                        </div>
                        <Button onClick={handleSaveScore} className="shadow-lg shadow-blue-200">Salvar Alterações e Nota</Button>
                    </div>
                }
            >
                <div className="space-y-6">
                    {exam?.questions.map((q, idx) => {
                        const studentAns = selectedAttempt?.answers?.[q.id];
                        const isDiscursive = q.type === QuestionType.SHORT_ANSWER;
                        const correctOpt = q.options?.find(o => o.isCorrect);
                        const isCorrectMC = !isDiscursive && studentAns === correctOpt?.id;

                        return (
                            <div key={q.id} className={`p-5 rounded-2xl border transition-all ${isDiscursive ? 'bg-orange-50/30 border-orange-200' : (isCorrectMC ? 'bg-green-50/30 border-green-100' : 'bg-slate-50 border-slate-200')}`}>
                                <div className="flex gap-4 mb-4">
                                    <span className="font-black text-slate-300 text-xl">{idx+1}.</span>
                                    <div className="flex-1 text-sm font-medium" dangerouslySetInnerHTML={{__html: q.enunciado}} />
                                    {isDiscursive ? (
                                        <Badge color="orange">DISCURSIVA</Badge>
                                    ) : (
                                        isCorrectMC ? <div className="text-green-500 p-1 bg-green-100 rounded-full"><Icons.Check /></div> : <div className="text-red-500 p-1 bg-red-100 rounded-full"><Icons.X /></div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                                        <b className="text-slate-400 uppercase text-[9px] block mb-1">Resposta do Aluno:</b>
                                        <div className="font-bold text-slate-700 text-sm italic">{isDiscursive ? studentAns : (q.options?.find(o => o.id === studentAns)?.text || studentAns || '(Sem resposta)')}</div>
                                    </div>
                                    <div className={`p-3 rounded-xl shadow-sm text-sm ${isDiscursive ? 'bg-slate-800 text-white' : 'bg-green-500 text-white'}`}>
                                        <b className="text-white/50 uppercase text-[9px] block mb-1">Gabarito/Sugestão:</b>
                                        <div className="font-bold">{isDiscursive ? 'Avalie a coerência da resposta acima.' : (correctOpt?.text || 'N/A')}</div>
                                    </div>
                                </div>

                                {isDiscursive && (
                                    <div className="mt-4 flex gap-2 justify-end border-t border-orange-100 pt-4">
                                        <button onClick={() => handleToggleDiscursivePoint(false)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-red-200 text-red-600 text-xs font-black hover:bg-red-50 transition-colors">
                                            <Icons.X /> MARCAR COMO ERRADA
                                        </button>
                                        <button onClick={() => handleToggleDiscursivePoint(true)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-black hover:bg-green-700 transition-colors shadow-md">
                                            <Icons.Check /> ATRIBUIR PONTO (+1)
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </Modal>

            {/* SCANNER UI - Mantido como no anterior */}
            {isScannerOpen && (
                <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-fade-in">
                    <div className="p-4 flex justify-between items-center text-white bg-slate-900 border-b border-white/10">
                        <h3 className="font-black uppercase tracking-widest text-sm">Scanner de Gabaritos</h3>
                        <button onClick={() => { stopCamera(); setIsScannerOpen(false); }} className="p-2 hover:bg-white/10 rounded-full"><Icons.X /></button>
                    </div>
                    <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
                        {!capturedImage ? (
                            <>
                                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                                <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none">
                                    <div className="w-full h-full border-2 border-dashed border-white/50 rounded-2xl flex items-center justify-center">
                                        <div className="text-white/30 text-xs font-black uppercase text-center">Enquadre as âncoras do cartão-resposta</div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="relative w-full h-full flex items-center justify-center">
                                <img src={capturedImage} className="max-w-full max-h-full object-contain" />
                                {scanning && (
                                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                                        <div className="w-12 h-12 border-4 border-white/20 border-t-brand-blue rounded-full animate-spin mb-4" />
                                        <p className="font-black uppercase tracking-widest animate-pulse">IA Analisando...</p>
                                    </div>
                                )}
                            </div>
                        )}
                        <canvas ref={canvasRef} className="hidden" />
                    </div>
                    <div className="p-6 flex justify-center bg-slate-900">
                        {!capturedImage ? (
                            <button onClick={handleCapture} className="w-20 h-20 bg-white rounded-full border-[6px] border-slate-700 flex items-center justify-center active:scale-95 transition-all"><div className="w-14 h-14 bg-red-500 rounded-full"></div></button>
                        ) : (
                            scanResult && (
                                <div className="bg-white p-6 rounded-3xl w-full max-w-md animate-scale-in">
                                    <div className="flex justify-between items-start mb-4">
                                        <div><h4 className="font-black text-xl text-slate-800">{scanResult.studentName}</h4><Badge color="blue">LEITURA ÓPTICA</Badge></div>
                                        <div className="text-right"><p className="text-4xl font-black text-brand-blue leading-none">{scanResult.score}</p><p className="text-[10px] font-black text-slate-400 uppercase">Acertos</p></div>
                                    </div>
                                    <div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => { setCapturedImage(null); setScanResult(null); startCamera(); }}>Repetir</Button><Button className="flex-1" onClick={handleSaveScan}>Salvar Nota</Button></div>
                                </div>
                            )
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExamResults;
