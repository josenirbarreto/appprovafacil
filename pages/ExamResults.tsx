
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FirebaseService } from '../services/firebaseService';
import { GeminiService } from '../services/geminiService';
import { Exam, ExamAttempt, QuestionType, Question } from '../types';
import { Button, Card, Badge, Modal, Input } from '../components/UI';
import { Icons } from '../components/Icons';

const ExamResults = () => {
    const { state } = useLocation();
    const navigate = useNavigate();
    const [exam, setExam] = useState<Exam | null>(null);
    const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
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
        const [e, a] = await Promise.all([
            FirebaseService.getExamById(state.examId),
            FirebaseService.getExamResults(state.examId)
        ]);
        setExam(e);
        const sortedAttempts = (Array.isArray(a) ? a : []).sort((x, y) => 
            (x.studentName || '').localeCompare(y.studentName || '', 'pt-BR')
        );
        setAttempts(sortedAttempts);
        setLoading(false);
    };

    const analysisData = useMemo(() => {
        // SEGURANÇA: Verifica se exam.questions existe e é array
        if (!exam || !Array.isArray(exam.questions) || attempts.length === 0) return [];

        return exam.questions.map((q, idx) => {
            const totalResponses = attempts.length;
            let correctCount = 0;
            const optionCounts: Record<string, number> = {};

            if (q.type === QuestionType.MULTIPLE_CHOICE && Array.isArray(q.options)) {
                q.options.forEach(opt => { optionCounts[opt.id] = 0; });
            }

            attempts.forEach(attempt => {
                const answer = attempt.answers?.[q.id];
                if (!answer) return;

                const correctOpt = Array.isArray(q.options) ? q.options.find(o => o.isCorrect) : null;
                if (correctOpt && (answer === correctOpt.id || answer === correctOpt.text)) {
                    correctCount++;
                }

                if (q.type === QuestionType.MULTIPLE_CHOICE && Array.isArray(q.options)) {
                    const matchedOpt = q.options.find(o => o.id === answer || o.text === answer);
                    if (matchedOpt) optionCounts[matchedOpt.id]++;
                }
            });

            const successRate = (correctCount / totalResponses) * 100;
            let mainDistractor = null;
            let maxDistractorVotes = 0;

            if (Array.isArray(q.options)) {
                q.options.forEach(opt => {
                    if (!opt.isCorrect && (optionCounts[opt.id] || 0) > maxDistractorVotes) {
                        maxDistractorVotes = optionCounts[opt.id];
                        mainDistractor = opt;
                    }
                });
            }

            return {
                question: q,
                index: idx + 1,
                correctCount,
                successRate,
                optionCounts,
                mainDistractor,
                distractorVotes: maxDistractorVotes
            };
        });
    }, [exam, attempts]);

    const criticalQuestion = useMemo(() => analysisData.length > 0 ? [...analysisData].sort((a, b) => a.successRate - b.successRate)[0] : null, [analysisData]);
    const mainTrap = useMemo(() => analysisData.length > 0 ? [...analysisData].sort((a, b) => b.distractorVotes - a.distractorVotes)[0] : null, [analysisData]);

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
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth; canvas.height = video.videoHeight;
            canvas.getContext('2d')?.drawImage(video, 0, 0);
            const imageData = canvas.toDataURL('image/jpeg', 0.8);
            setCapturedImage(imageData);
            stopCamera();
            processImage(imageData);
        }
    };

    const processImage = async (imageBase64: string) => {
        if (!exam || !Array.isArray(exam.questions)) return;
        setScanning(true);
        try {
            const result = await GeminiService.gradeExamImage(imageBase64, exam.questions.length);
            if (result) {
                let score = 0;
                const evaluatedAnswers: Record<string, string> = {};
                exam.questions.forEach((q, idx) => {
                    const qIndex = (idx + 1).toString();
                    const detectedOption = result.answers[qIndex];
                    if (detectedOption) {
                        const letterMap = ['A', 'B', 'C', 'D', 'E'];
                        const correctIndex = Array.isArray(q.options) ? q.options.findIndex(o => o.isCorrect) : -1;
                        if (correctIndex >= 0 && detectedOption.toUpperCase() === letterMap[correctIndex]) score++;
                        const selectedOptIndex = letterMap.indexOf(detectedOption.toUpperCase());
                        if (selectedOptIndex >= 0 && Array.isArray(q.options) && q.options[selectedOptIndex]) evaluatedAnswers[q.id] = q.options[selectedOptIndex].id;
                        else evaluatedAnswers[q.id] = detectedOption;
                    }
                });
                setScanResult({ studentName: result.studentName || "Aluno não Identificado", score, answers: evaluatedAnswers });
            } else { startCamera(); setCapturedImage(null); }
        } catch (e) { alert("Erro no scanner."); } finally { setScanning(false); }
    };

    const handleSaveScan = async () => {
        if (!scanResult || !exam) return;
        try {
            const attempt = await FirebaseService.startAttempt(exam.id, scanResult.studentName, 'SCAN-' + Date.now(), exam.questions.length);
            await FirebaseService.submitAttempt(attempt.id, scanResult.answers, scanResult.score, exam.questions.length);
            handleCloseScanner(); loadData();
        } catch (e) { alert("Erro ao salvar."); }
    };

    const handleCloseScanner = () => { stopCamera(); setCapturedImage(null); setScanResult(null); setIsScannerOpen(false); };
    const handleOpenGrading = (attempt: ExamAttempt) => { setSelectedAttempt(attempt); setEditingScore(attempt.score); setIsGradingModalOpen(true); };
    const handleSaveScore = async () => { if (!selectedAttempt) return; await FirebaseService.updateAttemptScore(selectedAttempt.id, Number(editingScore)); loadData(); setIsGradingModalOpen(false); };

    if (loading) return <div className="p-8 text-center">Carregando...</div>;

    const questionsList = Array.isArray(exam?.questions) ? exam.questions : [];

    return (
        <div className="p-8 h-full flex flex-col bg-slate-50 overflow-y-auto custom-scrollbar">
            <div className="mb-6 flex flex-col md:flex-row justify-between items-start gap-4">
                <div>
                    <button onClick={() => navigate('/exams')} className="text-slate-400 hover:text-slate-600 flex items-center gap-1 text-sm mb-2"><Icons.ArrowLeft /> Voltar</button>
                    <h2 className="text-3xl font-display font-bold text-slate-800">Resultados: {exam?.title}</h2>
                </div>
                <div className="flex gap-3"><Button variant="secondary" onClick={() => { setIsScannerOpen(true); startCamera(); }}><Icons.Camera /> Escanear Gabaritos</Button></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <Card className="text-center p-6 border-l-4 border-l-blue-500"><p className="text-xs uppercase font-black text-slate-400">Total Alunos</p><p className="text-4xl font-black">{attempts.length}</p></Card>
                <Card className="text-center p-6 border-l-4 border-l-emerald-500"><p className="text-xs uppercase font-black text-slate-400">Média</p><p className="text-4xl font-black text-brand-blue">{(attempts.reduce((a,b) => a+b.score,0)/Math.max(1,attempts.length)).toFixed(1)}</p></Card>
                <Card className="text-center p-6 border-l-4 border-l-orange-500"><p className="text-xs uppercase font-black text-slate-400">Questão Crítica</p><p className="text-3xl font-black text-orange-600">{criticalQuestion ? `Q${criticalQuestion.index}` : '-'}</p></Card>
                <Card className="text-center p-6 border-l-4 border-l-purple-500"><p className="text-xs uppercase font-black text-slate-400">Pegadinha</p><p className="text-3xl font-black text-purple-600">{mainTrap && mainTrap.distractorVotes > 0 ? `Q${mainTrap.index}` : '-'}</p></Card>
            </div>

            <div className="flex gap-4 border-b mb-6">
                <button onClick={() => setActiveTab('LIST')} className={`pb-3 px-2 text-sm font-bold ${activeTab === 'LIST' ? 'text-brand-blue border-b-2 border-brand-blue' : 'text-slate-400'}`}>Lista de Notas</button>
                <button onClick={() => setActiveTab('ANALYSIS')} className={`pb-3 px-2 text-sm font-bold ${activeTab === 'ANALYSIS' ? 'text-brand-blue border-b-2 border-brand-blue' : 'text-slate-400'}`}>Análise Pedagógica</button>
            </div>

            {activeTab === 'LIST' ? (
                <Card className="overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b"><tr><th className="p-4">Aluno</th><th className="p-4">Data</th><th className="p-4">Nota</th><th className="p-4 text-right">Ações</th></tr></thead>
                        <tbody className="divide-y">{attempts.map(att => (<tr key={att.id} className="hover:bg-slate-50"><td className="p-4 font-bold">{att.studentName}</td><td className="p-4">{att.submittedAt ? new Date(att.submittedAt).toLocaleDateString() : 'Andamento'}</td><td className="p-4"><span className="font-black">{att.score}</span> / {att.totalQuestions}</td><td className="p-4 text-right"><button onClick={() => handleOpenGrading(att)} className="text-brand-blue p-2"><Icons.Eye /></button></td></tr>))}</tbody>
                    </table>
                </Card>
            ) : (
                <div className="space-y-6">
                    {analysisData.map(item => (
                        <Card key={item.question.id} className="p-6">
                            <div className="flex gap-6">
                                <div className="w-24 text-center shrink-0"><p className="text-4xl font-black text-slate-800">Q{item.index}</p><p className={`text-xl font-bold ${item.successRate > 70 ? 'text-green-600' : 'text-red-600'}`}>{item.successRate.toFixed(0)}%</p><p className="text-[10px] uppercase font-black text-slate-400">Acerto</p></div>
                                <div className="flex-1">
                                    <div className="text-slate-800 font-medium mb-4" dangerouslySetInnerHTML={{__html: item.question.enunciado}} />
                                    {Array.isArray(item.question.options) && (
                                        <div className="space-y-2">
                                            {item.question.options.map((opt, i) => {
                                                const votes = item.optionCounts[opt.id] || 0;
                                                const pct = (votes / Math.max(1, attempts.length)) * 100;
                                                return (<div key={opt.id} className="text-xs space-y-1"><div className="flex justify-between"><span>{String.fromCharCode(65+i)}. {opt.text} {opt.isCorrect && <Badge color="green">Correta</Badge>}</span><span className="font-bold">{pct.toFixed(0)}%</span></div><div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden"><div className={`h-full ${opt.isCorrect ? 'bg-green-500' : 'bg-slate-300'}`} style={{width: `${pct}%`}}></div></div></div>);
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            <Modal isOpen={isGradingModalOpen} onClose={() => setIsGradingModalOpen(false)} title={`Revisão: ${selectedAttempt?.studentName}`} maxWidth="max-w-4xl" footer={<div className="flex gap-4 items-center ml-auto"><label className="font-bold">Nota Final:</label><input type="number" value={editingScore} onChange={e => setEditingScore(Number(e.target.value))} className="border-2 border-brand-blue rounded px-2 py-1 w-20 text-center font-black" /><Button onClick={handleSaveScore}>Salvar</Button></div>}>
                <div className="space-y-6">
                    {questionsList.map((q, idx) => {
                        const ans = selectedAttempt?.answers?.[q.id];
                        const correctOpt = Array.isArray(q.options) ? q.options.find(o => o.isCorrect) : null;
                        const isCorrect = correctOpt && (ans === correctOpt.id || ans === correctOpt.text);
                        return (<div key={q.id} className="border p-4 rounded-xl"><div className="flex gap-3 mb-3"><span className="font-black text-slate-300">{idx+1}.</span><div className="flex-1 text-sm font-medium" dangerouslySetInnerHTML={{__html: q.enunciado}} />{ans && (isCorrect ? <div className="text-green-500"><Icons.Check /></div> : <div className="text-red-500"><Icons.X /></div>)}</div><div className="grid grid-cols-2 gap-4 text-xs"><div className="p-3 bg-slate-50 rounded border"><b>Resposta:</b> {Array.isArray(q.options) ? q.options.find(o => o.id === ans)?.text || ans : ans}</div><div className="p-3 bg-green-50 rounded border border-green-100"><b>Gabarito:</b> {correctOpt?.text || 'Subjetiva'}</div></div></div>);
                    })}
                </div>
            </Modal>

            {isScannerOpen && (
                <div className="fixed inset-0 z-[100] bg-black flex flex-col">
                    <div className="p-4 flex justify-between items-center text-white"><h3>Escanear Gabarito</h3><button onClick={handleCloseScanner}><Icons.X /></button></div>
                    <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">{!capturedImage ? (<video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />) : (<div className="relative w-full h-full"><img src={capturedImage} className="w-full h-full object-contain" />{scanning && <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white"><div className="w-10 h-10 border-4 border-t-brand-blue rounded-full animate-spin mb-4" />Processando...</div>}</div>)}<canvas ref={canvasRef} className="hidden" /></div>
                    <div className="p-6 flex justify-center">{!capturedImage ? <button onClick={handleCapture} className="w-16 h-16 bg-white rounded-full border-4 border-slate-300" /> : scanResult && <div className="bg-white p-6 rounded-2xl w-full max-w-md"><h4 className="font-black text-xl mb-4">{scanResult.studentName}</h4><p className="text-4xl font-black text-brand-blue mb-6">{scanResult.score} Acertos</p><div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => { setCapturedImage(null); setScanResult(null); startCamera(); }}>Novo Scan</Button><Button className="flex-1" onClick={handleSaveScan}>Salvar</Button></div></div>}</div>
                </div>
            )}
        </div>
    );
};

export default ExamResults;
