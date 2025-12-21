
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FirebaseService } from '../services/firebaseService';
import { GeminiService } from '../services/geminiService';
import { Exam, ExamAttempt, QuestionType, Question } from '../types';
import { Button, Card, Badge, Modal, Input } from '../components/UI';
import { Icons } from '../components/Icons';

const ExamResults = () => {
    const { state } = useLocation(); // Receives examId
    const navigate = useNavigate();
    const [exam, setExam] = useState<Exam | null>(null);
    const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'LIST' | 'ANALYSIS'>('LIST');
    
    // Grading State (Manual)
    const [selectedAttempt, setSelectedAttempt] = useState<ExamAttempt | null>(null);
    const [editingScore, setEditingScore] = useState<number>(0);
    const [isGradingModalOpen, setIsGradingModalOpen] = useState(false);

    // --- SCANNER STATES ---
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [cameraActive, setCameraActive] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [scanning, setScanning] = useState(false);
    const [scanResult, setScanResult] = useState<{ studentName: string, score: number, answers: Record<string, string> } | null>(null);

    useEffect(() => {
        if (!state?.examId) {
            navigate('/exams');
            return;
        }
        loadData();
    }, [state, navigate]);

    // Cleanup camera on unmount or modal close
    useEffect(() => {
        if (!isScannerOpen && cameraActive) {
            stopCamera();
        }
    }, [isScannerOpen]);

    const loadData = async () => {
        const [e, a] = await Promise.all([
            FirebaseService.getExamById(state.examId),
            FirebaseService.getExamResults(state.examId)
        ]);
        setExam(e);
        
        // Ordenação Alfabética por Nome do Aluno
        const sortedAttempts = a.sort((x, y) => 
            x.studentName.localeCompare(y.studentName, 'pt-BR', { sensitivity: 'base' })
        );
        
        setAttempts(sortedAttempts);
        setLoading(false);
    };

    // --- ITEM ANALYSIS CALCULATIONS ---
    const analysisData = useMemo(() => {
        if (!exam || attempts.length === 0) return [];

        const questionsAnalysis = exam.questions.map((q, idx) => {
            const totalResponses = attempts.length;
            let correctCount = 0;
            const optionCounts: Record<string, number> = {};

            // Inicializa contadores para opções de múltipla escolha
            if (q.type === QuestionType.MULTIPLE_CHOICE && q.options) {
                q.options.forEach(opt => {
                    optionCounts[opt.id] = 0;
                });
            }

            attempts.forEach(attempt => {
                const answer = attempt.answers[q.id];
                if (!answer) return;

                // Verifica acerto
                const correctOpt = q.options?.find(o => o.isCorrect);
                if (correctOpt && (answer === correctOpt.id || answer === correctOpt.text)) {
                    correctCount++;
                }

                // Conta marcações por opção (para distratores)
                if (q.type === QuestionType.MULTIPLE_CHOICE && q.options) {
                    const matchedOpt = q.options.find(o => o.id === answer || o.text === answer);
                    if (matchedOpt) {
                        optionCounts[matchedOpt.id]++;
                    }
                }
            });

            const successRate = (correctCount / totalResponses) * 100;
            
            // Identifica o principal distrator (pegadinha)
            let mainDistractor = null;
            let maxDistractorVotes = 0;

            if (q.options) {
                q.options.forEach(opt => {
                    if (!opt.isCorrect && optionCounts[opt.id] > maxDistractorVotes) {
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

        return questionsAnalysis;
    }, [exam, attempts]);

    const criticalQuestion = useMemo(() => {
        if (analysisData.length === 0) return null;
        return [...analysisData].sort((a, b) => a.successRate - b.successRate)[0];
    }, [analysisData]);

    const mainTrap = useMemo(() => {
        if (analysisData.length === 0) return null;
        return [...analysisData].sort((a, b) => b.distractorVotes - a.distractorVotes)[0];
    }, [analysisData]);

    // --- CAMERA FUNCTIONS ---
    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' } 
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setCameraActive(true);
            }
        } catch (err) {
            console.error("Camera Error:", err);
            alert("Não foi possível acessar a câmera. Verifique as permissões.");
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
            setCameraActive(false);
        }
    };

    const handleCapture = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');
            
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            if (context) {
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const imageData = canvas.toDataURL('image/jpeg', 0.8);
                setCapturedImage(imageData);
                stopCamera();
                processImage(imageData);
            }
        }
    };

    const processImage = async (imageBase64: string) => {
        if (!exam) return;
        setScanning(true);
        setScanResult(null);

        try {
            const result = await GeminiService.gradeExamImage(imageBase64, exam.questions.length);
            
            if (result) {
                let score = 0;
                const evaluatedAnswers: Record<string, string> = {};

                exam.questions.forEach((q, idx) => {
                    const qIndex = (idx + 1).toString();
                    const detectedOption = result.answers[qIndex];
                    
                    if (detectedOption) {
                        const correctIndex = q.options?.findIndex(o => o.isCorrect);
                        const letterMap = ['A', 'B', 'C', 'D', 'E'];
                        const correctLetter = correctIndex !== undefined && correctIndex >= 0 ? letterMap[correctIndex] : null;

                        if (correctLetter && detectedOption.toUpperCase() === correctLetter) {
                            score++;
                        }
                        
                        const selectedOptIndex = letterMap.indexOf(detectedOption.toUpperCase());
                        if (selectedOptIndex >= 0 && q.options && q.options[selectedOptIndex]) {
                            evaluatedAnswers[q.id] = q.options[selectedOptIndex].id;
                        } else {
                            evaluatedAnswers[q.id] = detectedOption; 
                        }
                    }
                });

                setScanResult({
                    studentName: result.studentName || "Aluno Não Identificado",
                    score,
                    answers: evaluatedAnswers
                });
            } else {
                alert("Não foi possível ler o gabarito. Tente aproximar a câmera e focar bem.");
                setCapturedImage(null);
                startCamera();
            }
        } catch (e) {
            console.error(e);
            alert("Erro no processamento da imagem.");
        } finally {
            setScanning(false);
        }
    };

    const handleSaveScan = async () => {
        if (!scanResult || !exam) return;
        try {
            // FIX: Adicionando exam.questions.length como 4º argumento (totalQuestions) conforme esperado por FirebaseService.startAttempt
            const attempt = await FirebaseService.startAttempt(
                exam.id, 
                scanResult.studentName, 
                'SCANNER-' + Date.now(),
                exam.questions.length
            );
            await FirebaseService.submitAttempt(
                attempt.id,
                scanResult.answers,
                scanResult.score,
                exam.questions.length
            );
            alert("Nota salva com sucesso!");
            handleCloseScanner();
            loadData();
        } catch (e) {
            alert("Erro ao salvar nota.");
        }
    };

    const handleCloseScanner = () => {
        stopCamera();
        setCapturedImage(null);
        setScanResult(null);
        setIsScannerOpen(false);
    };

    const handleOpenGrading = (attempt: ExamAttempt) => {
        setSelectedAttempt(attempt);
        setEditingScore(attempt.score);
        setIsGradingModalOpen(true);
    };

    const handleSaveScore = async () => {
        if (!selectedAttempt) return;
        await FirebaseService.updateAttemptScore(selectedAttempt.id, Number(editingScore));
        await loadData();
        setIsGradingModalOpen(false);
    };

    if (loading) return <div className="p-8 flex justify-center print:hidden">Carregando resultados...</div>;

    const averageScore = attempts.length > 0 
        ? (attempts.reduce((acc, curr) => acc + curr.score, 0) / attempts.length).toFixed(1) 
        : '0';

    return (
        <div className="p-8 h-full flex flex-col bg-slate-50 overflow-y-auto custom-scrollbar print:p-0 print:bg-white print:overflow-visible print:h-auto">
            
            {/* Cabeçalho de Tela */}
            <div className="mb-6 flex flex-col md:flex-row justify-between items-start gap-4 print:hidden">
                <div>
                    <button onClick={() => navigate('/exams')} className="text-slate-400 hover:text-slate-600 flex items-center gap-1 text-sm mb-2">
                        <Icons.ArrowLeft /> Voltar para Provas
                    </button>
                    <h2 className="text-3xl font-display font-bold text-slate-800 tracking-tight">Resultados: {exam?.title}</h2>
                    <p className="text-slate-500">Gestão de notas e análise de desempenho pedagógico.</p>
                </div>
                <div className="flex flex-wrap gap-3 items-center">
                    <Button variant="secondary" onClick={() => { setIsScannerOpen(true); startCamera(); }}>
                        <Icons.Camera /> Escanear Gabaritos
                    </Button>
                    <Button variant="outline" onClick={() => window.print()}>
                        <Icons.Printer /> Imprimir Relatório
                    </Button>
                </div>
            </div>

            {/* Dash de Resumo Pedagógico */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 print:hidden">
                <Card className="flex flex-col items-center justify-center p-6 border-l-4 border-l-blue-500">
                    <p className="text-xs text-slate-500 uppercase font-black tracking-widest mb-1">Total Alunos</p>
                    <p className="text-4xl font-black text-slate-800">{attempts.length}</p>
                </Card>
                <Card className="flex flex-col items-center justify-center p-6 border-l-4 border-l-emerald-500">
                    <p className="text-xs text-slate-500 uppercase font-black tracking-widest mb-1">Média Turma</p>
                    <p className="text-4xl font-black text-brand-blue">{averageScore}</p>
                </Card>
                <Card className="flex flex-col items-center justify-center p-6 border-l-4 border-l-orange-500">
                    <p className="text-xs text-slate-500 uppercase font-black tracking-widest mb-1">Questão Crítica</p>
                    <p className="text-3xl font-black text-orange-600">
                        {criticalQuestion ? `Q${criticalQuestion.index}` : '-'}
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold mt-1 text-center">MENOR TAXA DE ACERTO ({criticalQuestion?.successRate.toFixed(0)}%)</p>
                </Card>
                <Card className="flex flex-col items-center justify-center p-6 border-l-4 border-l-purple-500">
                    <p className="text-xs text-slate-500 uppercase font-black tracking-widest mb-1">Maior Pegadinha</p>
                    <p className="text-3xl font-black text-purple-600">
                        {mainTrap && mainTrap.distractorVotes > 0 ? `Q${mainTrap.index}` : '-'}
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold mt-1 text-center">MAIOR ERRO CONCENTRADO</p>
                </Card>
            </div>

            {/* Tabs de Navegação */}
            <div className="flex gap-4 border-b border-slate-200 mb-6 print:hidden">
                <button 
                    onClick={() => setActiveTab('LIST')}
                    className={`pb-3 px-2 text-sm font-bold transition-all relative ${activeTab === 'LIST' ? 'text-brand-blue' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    Lista de Notas
                    {activeTab === 'LIST' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-blue rounded-full"></div>}
                </button>
                <button 
                    onClick={() => setActiveTab('ANALYSIS')}
                    className={`pb-3 px-2 text-sm font-bold transition-all relative flex items-center gap-2 ${activeTab === 'ANALYSIS' ? 'text-brand-blue' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    Análise de Itens (Pedagógico)
                    <span className="inline-flex"><Badge color="blue">Novo</Badge></span>
                    {activeTab === 'ANALYSIS' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-blue rounded-full"></div>}
                </button>
            </div>

            {/* ABA: LISTA DE NOTAS */}
            {activeTab === 'LIST' && (
                <Card className="print:shadow-none print:border print:border-black print:rounded-none animate-fade-in">
                    <div className="overflow-x-auto print:overflow-visible">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase text-xs">
                                <tr>
                                    <th className="p-4">Aluno</th>
                                    <th className="p-4">Identificação</th>
                                    <th className="p-4">Data Envio</th>
                                    <th className="p-4">Nota</th>
                                    <th className="p-4 print:hidden">Status</th>
                                    <th className="p-4 print:hidden text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {attempts.length === 0 ? (
                                    <tr><td colSpan={6} className="p-12 text-center text-slate-400">Nenhuma resposta recebida ainda.</td></tr>
                                ) : (
                                    attempts.map(attempt => (
                                        <tr key={attempt.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="p-4 font-bold text-slate-800">{attempt.studentName}</td>
                                            <td className="p-4 text-slate-500">{attempt.studentIdentifier || '-'}</td>
                                            <td className="p-4 text-slate-500">
                                                {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : 'Em andamento'}
                                            </td>
                                            <td className="p-4">
                                                <span className="font-black text-lg">{attempt.score}</span> 
                                                <span className="text-slate-400 font-medium"> / {attempt.totalQuestions}</span>
                                            </td>
                                            <td className="p-4 print:hidden">
                                                {attempt.status === 'COMPLETED' 
                                                    ? <Badge color="green">Finalizado</Badge> 
                                                    : <Badge color="yellow">Em Progresso</Badge>}
                                            </td>
                                            <td className="p-4 print:hidden text-right">
                                                <button 
                                                    onClick={() => handleOpenGrading(attempt)}
                                                    className="text-brand-blue hover:bg-blue-50 p-2 rounded-lg transition-colors ml-auto"
                                                    title="Visualizar e Corrigir"
                                                >
                                                    <Icons.Eye />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {/* ABA: ANÁLISE DE ITENS */}
            {activeTab === 'ANALYSIS' && (
                <div className="space-y-6 animate-fade-in print:block">
                    {analysisData.length === 0 && (
                        <div className="text-center p-20 bg-white rounded-2xl border border-dashed border-slate-300 text-slate-400">
                            Aguarde o envio das primeiras provas para gerar estatísticas.
                        </div>
                    )}
                    
                    {analysisData.map((item) => {
                        const isCritical = criticalQuestion?.question.id === item.question.id;
                        const isTrap = mainTrap?.question.id === item.question.id;
                        
                        return (
                            <Card key={item.question.id} className={`overflow-hidden border-2 ${isCritical ? 'border-orange-200 bg-orange-50/10' : 'border-white'}`}>
                                <div className="flex flex-col md:flex-row gap-8">
                                    {/* Info Panel */}
                                    <div className="md:w-64 shrink-0 p-4 bg-slate-50 rounded-lg flex flex-col justify-between h-full">
                                        <div>
                                            <div className="flex items-center gap-3 mb-4">
                                                <span className="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center font-black text-xl">
                                                    {item.index}
                                                </span>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black uppercase text-slate-400">Taxa de Acerto</span>
                                                    <span className={`text-xl font-black ${item.successRate > 70 ? 'text-green-600' : item.successRate > 40 ? 'text-amber-600' : 'text-red-600'}`}>
                                                        {item.successRate.toFixed(1)}%
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            <div className="space-y-3">
                                                <div className="flex justify-between text-xs font-bold">
                                                    <span className="text-slate-500 uppercase">Acertos:</span>
                                                    <span className="text-slate-800">{item.correctCount} / {attempts.length}</span>
                                                </div>
                                                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                                    <div className={`h-full ${item.successRate > 70 ? 'bg-green-500' : item.successRate > 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${item.successRate}%` }}></div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-6 space-y-2">
                                            {isCritical && <Badge color="orange">QUESTÃO CRÍTICA</Badge>}
                                            {isTrap && <Badge color="purple">ALTA DISTRAÇÃO</Badge>}
                                        </div>
                                    </div>

                                    {/* Content and Options Chart */}
                                    <div className="flex-1">
                                        <div className="prose prose-sm max-w-none mb-6 text-slate-800 font-medium" dangerouslySetInnerHTML={{__html: item.question.enunciado}} />
                                        
                                        {item.question.type === QuestionType.MULTIPLE_CHOICE && item.question.options ? (
                                            <div className="space-y-4">
                                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Distribuição de Alternativas</p>
                                                <div className="grid gap-3">
                                                    {item.question.options.map((opt, idx) => {
                                                        const votes = item.optionCounts[opt.id] || 0;
                                                        const percent = attempts.length > 0 ? (votes / attempts.length) * 100 : 0;
                                                        const isMainDistractor = item.mainDistractor?.id === opt.id && !opt.isCorrect && votes > 0;

                                                        return (
                                                            <div key={opt.id} className="relative">
                                                                <div className="flex justify-between items-center mb-1 text-xs">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`font-black w-5 ${opt.isCorrect ? 'text-green-600' : 'text-slate-400'}`}>{String.fromCharCode(65+idx)}</span>
                                                                        <span className={`line-clamp-1 ${opt.isCorrect ? 'font-bold text-green-700' : 'text-slate-600'}`}>{opt.text}</span>
                                                                        {opt.isCorrect && <Badge color="green">Correta</Badge>}
                                                                        {isMainDistractor && <Badge color="orange">Pegadinha</Badge>}
                                                                    </div>
                                                                    <span className="font-mono font-bold text-slate-500">{votes} ({percent.toFixed(0)}%)</span>
                                                                </div>
                                                                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
                                                                    <div 
                                                                        className={`h-full transition-all duration-500 ${opt.isCorrect ? 'bg-green-500' : isMainDistractor ? 'bg-orange-400' : 'bg-slate-300'}`} 
                                                                        style={{ width: `${percent}%` }}
                                                                    ></div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-500 italic">
                                                Análise de alternativas disponível apenas para questões de múltipla escolha.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* MODAL DE CORREÇÃO MANUAL */}
            <Modal 
                isOpen={isGradingModalOpen} 
                onClose={() => setIsGradingModalOpen(false)} 
                title={`Correção: ${selectedAttempt?.studentName}`} 
                maxWidth="max-w-4xl"
                footer={
                    <div className="flex justify-between w-full items-center">
                         <div className="text-sm text-slate-500">
                             Questões: <strong>{exam?.questions.length}</strong>
                         </div>
                         <div className="flex gap-4 items-center">
                            <div className="flex items-center gap-2">
                                <label className="font-bold text-slate-700">Nota Final:</label>
                                <input 
                                    type="number" 
                                    value={editingScore} 
                                    onChange={(e) => setEditingScore(Number(e.target.value))}
                                    className="border-2 border-brand-blue rounded px-2 py-1 w-24 text-center font-black text-xl text-brand-blue outline-none focus:ring-4 focus:ring-blue-100"
                                />
                            </div>
                            <Button onClick={handleSaveScore}>Salvar Alterações</Button>
                         </div>
                    </div>
                }
            >
                <div className="space-y-6">
                    {exam?.questions.map((q, idx) => {
                        const studentAnswer = selectedAttempt?.answers[q.id];
                        let isAutoCorrect = false;
                        let correctText = '';

                        if (q.type === QuestionType.MULTIPLE_CHOICE || q.type === QuestionType.TRUE_FALSE) {
                            const correctOpt = q.options?.find(o => o.isCorrect);
                            isAutoCorrect = correctOpt ? (studentAnswer === correctOpt.id || studentAnswer === correctOpt.text) : false;
                            correctText = correctOpt?.text || 'Não definido';
                            
                            var displayAnswer = studentAnswer;
                            const selectedOpt = q.options?.find(o => o.id === studentAnswer);
                            if (selectedOpt) displayAnswer = selectedOpt.text;
                        } else if (q.type === QuestionType.NUMERIC) {
                            const correctVal = q.options?.[0]?.text;
                            isAutoCorrect = parseFloat(studentAnswer!) === parseFloat(correctVal || '0');
                            correctText = correctVal || '';
                            var displayAnswer = studentAnswer;
                        } else {
                            correctText = q.options?.[0]?.text || '(Gabarito sugerido pelo professor)';
                            var displayAnswer = studentAnswer;
                        }

                        return (
                            <div key={q.id} className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm">
                                <div className="flex gap-3">
                                    <span className="font-black text-slate-300 text-lg">{idx + 1}.</span>
                                    <div className="flex-1">
                                        <div dangerouslySetInnerHTML={{__html: q.enunciado}} className="text-sm text-slate-800 mb-4 font-medium" />
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                            <div className={`p-3 rounded-lg border ${
                                                q.type !== QuestionType.SHORT_ANSWER 
                                                    ? (isAutoCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200')
                                                    : 'bg-blue-50 border-blue-200'
                                            }`}>
                                                <span className="block text-[10px] font-black uppercase mb-1 opacity-70 tracking-wider">Resposta do Aluno</span>
                                                <span className="font-bold">{displayAnswer || <span className="italic text-slate-400 font-normal">Sem resposta</span>}</span>
                                            </div>
                                            
                                            <div className="p-3 rounded-lg border bg-slate-50 border-slate-200">
                                                <span className="block text-[10px] font-black uppercase mb-1 opacity-70 tracking-wider">Gabarito Esperado</span>
                                                <span className="text-slate-600 font-medium">{correctText}</span>
                                            </div>
                                        </div>
                                    </div>
                                    {q.type !== QuestionType.SHORT_ANSWER && (
                                        <div className="shrink-0 pt-1">
                                            {isAutoCorrect 
                                                ? <div className="text-green-600 bg-green-100 p-1.5 rounded-full"><Icons.Check /></div>
                                                : <div className="text-red-600 bg-red-100 p-1.5 rounded-full"><Icons.X /></div>
                                            }
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Modal>

            {/* SCANNER MODAL */}
            {isScannerOpen && (
                <div className="fixed inset-0 z-[100] bg-black flex flex-col">
                    <div className="p-4 flex justify-between items-center text-white bg-black/50 z-10">
                        <h3 className="font-bold text-lg">Escanear Gabarito</h3>
                        <button onClick={handleCloseScanner} className="p-2 bg-white/20 rounded-full hover:bg-white/40 transition-colors"><Icons.X /></button>
                    </div>
                    
                    <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
                        {!capturedImage ? (
                            <>
                                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover"></video>
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="w-[80%] aspect-[3/4] border-2 border-white/50 rounded-lg relative">
                                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-500 -mt-1 -ml-1"></div>
                                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-500 -mt-1 -mr-1"></div>
                                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-500 -mb-1 -ml-1"></div>
                                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-500 -mb-1 -mr-1"></div>
                                        <p className="text-white text-center mt-[120%] text-sm font-bold drop-shadow-md">Aponte para o Cartão-Resposta</p>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="relative w-full h-full">
                                <img src={capturedImage} alt="Capture" className="w-full h-full object-contain" />
                                {scanning && (
                                    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white">
                                        <div className="w-12 h-12 border-4 border-white/30 border-t-brand-blue rounded-full animate-spin mb-4"></div>
                                        <p className="font-black tracking-widest animate-pulse">PROCESSANDO...</p>
                                    </div>
                                )}
                            </div>
                        )}
                        <canvas ref={canvasRef} className="hidden"></canvas>
                    </div>

                    <div className="p-6 bg-black flex justify-center pb-12">
                        {!capturedImage ? (
                            <button 
                                onClick={handleCapture} 
                                className="w-20 h-20 bg-white rounded-full border-4 border-gray-300 flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                            >
                                <div className="w-16 h-16 bg-white rounded-full border-2 border-black"></div>
                            </button>
                        ) : (
                            scanResult ? (
                                <div className="w-full max-w-md bg-white rounded-2xl p-6 text-slate-800 animate-slide-up">
                                    <div className="flex justify-between items-center mb-6">
                                        <div>
                                            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Aluno</p>
                                            <h4 className="font-black text-xl">{scanResult.studentName}</h4>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Acertos</p>
                                            <p className="font-black text-4xl text-brand-blue">{scanResult.score}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <Button variant="outline" onClick={() => { setCapturedImage(null); setScanResult(null); startCamera(); }} className="flex-1">Novo Scan</Button>
                                        <Button onClick={handleSaveScan} className="flex-1">Salvar Nota</Button>
                                    </div>
                                </div>
                            ) : null
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExamResults;
