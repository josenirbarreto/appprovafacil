
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FirebaseService } from '../services/firebaseService';
import { GeminiService } from '../services/geminiService';
import { Exam, ExamAttempt, QuestionType } from '../types';
import { Button, Card, Badge, Modal, Input } from '../components/UI';
import { Icons } from '../components/Icons';

const ExamResults = () => {
    const { state } = useLocation(); // Receives examId
    const navigate = useNavigate();
    const [exam, setExam] = useState<Exam | null>(null);
    const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
    const [loading, setLoading] = useState(true);
    
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

    // --- CAMERA FUNCTIONS ---
    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' } // Prefer back camera
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
            
            // Set canvas dimensions to match video
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            // Draw video frame to canvas
            if (context) {
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const imageData = canvas.toDataURL('image/jpeg', 0.8);
                setCapturedImage(imageData);
                stopCamera(); // Stop camera after capture
                processImage(imageData); // Auto start processing
            }
        }
    };

    const processImage = async (imageBase64: string) => {
        if (!exam) return;
        setScanning(true);
        setScanResult(null);

        try {
            // Chama o Gemini para ler o gabarito
            const result = await GeminiService.gradeExamImage(imageBase64, exam.questions.length);
            
            if (result) {
                // Calcular nota baseado no gabarito oficial
                let score = 0;
                const evaluatedAnswers: Record<string, string> = {};

                exam.questions.forEach((q, idx) => {
                    const qIndex = (idx + 1).toString();
                    const detectedOption = result.answers[qIndex]; // Ex: "A", "B"... ou null
                    
                    if (detectedOption) {
                        // Encontra a opção correta na questão
                        const correctOpt = q.options?.find(o => o.isCorrect);
                        const correctIndex = q.options?.findIndex(o => o.isCorrect);
                        
                        // Mapeia letra para índice se necessário ou compara letra se o modelo retornou letra
                        // Assumindo que o Gemini retorna "A", "B", "C"...
                        const letterMap = ['A', 'B', 'C', 'D', 'E'];
                        const correctLetter = correctIndex !== undefined && correctIndex >= 0 ? letterMap[correctIndex] : null;

                        if (correctLetter && detectedOption.toUpperCase() === correctLetter) {
                            score++;
                        }
                        
                        // Salva o ID da opção correspondente para persistência, se possível
                        // Se não, salva a letra mesmo
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
        
        // Cria attempt
        try {
            const attempt = await FirebaseService.startAttempt(
                exam.id, 
                scanResult.studentName, 
                'SCANNER-' + Date.now() // ID Provisório
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

    // --- MANUAL GRADING HANDLERS ---
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
            
            {/* Cabeçalho de Tela (Escondido na Impressão) */}
            <div className="mb-6 flex flex-col md:flex-row justify-between items-start gap-4 print:hidden">
                <div>
                    <button onClick={() => navigate('/exams')} className="text-slate-400 hover:text-slate-600 flex items-center gap-1 text-sm mb-2">
                        <Icons.ArrowLeft /> Voltar
                    </button>
                    <h2 className="text-3xl font-display font-bold text-slate-800">Resultados: {exam?.title}</h2>
                    <p className="text-slate-500">Clique na lupa para visualizar e corrigir provas manualmente.</p>
                </div>
                <div className="flex flex-wrap gap-4 items-center">
                    <Card className="px-6 py-3 bg-white border border-slate-200 text-center">
                        <p className="text-xs text-slate-500 uppercase font-bold">Entregues</p>
                        <p className="text-2xl font-bold text-slate-800">{attempts.length}</p>
                    </Card>
                    <Card className="px-6 py-3 bg-white border border-slate-200 text-center">
                        <p className="text-xs text-slate-500 uppercase font-bold">Média da Turma</p>
                        <p className="text-2xl font-bold text-brand-blue">{averageScore}</p>
                    </Card>
                    <div className="h-10 w-px bg-slate-300 mx-2 hidden md:block"></div>
                    <Button variant="secondary" onClick={() => { setIsScannerOpen(true); startCamera(); }}>
                        <Icons.Camera /> Escanear Gabaritos
                    </Button>
                    <Button variant="outline" onClick={() => window.print()}>
                        <Icons.Printer /> Imprimir Lista
                    </Button>
                </div>
            </div>

            {/* Cabeçalho Exclusivo de Impressão */}
            <div className="hidden print:block mb-6 border-b-2 border-black pb-4">
                <h1 className="text-2xl font-bold uppercase text-black">{exam?.title}</h1>
                <h2 className="text-lg text-black mt-1">Relatório de Notas da Turma</h2>
                <div className="flex justify-between mt-4 text-sm font-mono border-t border-gray-300 pt-2">
                    <span>Data do Relatório: {new Date().toLocaleDateString()}</span>
                    <span>Total de Alunos: {attempts.length} | Média: {averageScore}</span>
                </div>
            </div>

            <Card className="print:shadow-none print:border-none print:rounded-none">
                <div className="overflow-x-auto print:overflow-visible">
                    <table className="w-full text-left text-sm print:text-xs">
                        <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase text-xs print:bg-gray-100 print:text-black print:border-black">
                            <tr>
                                <th className="p-4 print:p-2">Aluno</th>
                                <th className="p-4 print:p-2">Identificação</th>
                                <th className="p-4 print:p-2">Data Envio</th>
                                <th className="p-4 print:p-2">Nota</th>
                                <th className="p-4 print:p-2 print:hidden">Status</th>
                                <th className="p-4 print:hidden text-right">Ações</th>
                                <th className="hidden print:table-cell p-2">Assinatura</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 print:divide-gray-300">
                            {attempts.length === 0 ? (
                                <tr><td colSpan={7} className="p-8 text-center text-slate-400">Nenhuma resposta recebida ainda.</td></tr>
                            ) : (
                                attempts.map(attempt => (
                                    <tr key={attempt.id} className="hover:bg-slate-50 print:hover:bg-transparent break-inside-avoid">
                                        <td className="p-4 font-bold text-slate-800 print:text-black print:p-2">{attempt.studentName}</td>
                                        <td className="p-4 text-slate-500 print:text-black print:p-2">{attempt.studentIdentifier || '-'}</td>
                                        <td className="p-4 text-slate-500 print:text-black print:p-2">
                                            {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : 'Em andamento'}
                                        </td>
                                        <td className="p-4 print:p-2">
                                            <span className="font-bold text-lg print:text-base">{attempt.score}</span> 
                                            <span className="text-slate-400 print:text-black"> / {attempt.totalQuestions}</span>
                                        </td>
                                        <td className="p-4 print:hidden">
                                            {attempt.status === 'COMPLETED' 
                                                ? <Badge color="green">Finalizado</Badge> 
                                                : <Badge color="yellow">Em Progresso</Badge>}
                                        </td>
                                        <td className="p-4 print:hidden text-right">
                                            <button 
                                                onClick={() => handleOpenGrading(attempt)}
                                                className="text-brand-blue hover:bg-blue-50 p-2 rounded-lg transition-colors flex items-center gap-1 ml-auto"
                                                title="Visualizar e Corrigir"
                                            >
                                                <Icons.Eye /> <span className="text-xs font-bold">Corrigir</span>
                                            </button>
                                        </td>
                                        <td className="hidden print:table-cell p-2 border-b border-gray-100 w-48">
                                            
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* MODAL DE CORREÇÃO MANUAL */}
            <Modal 
                isOpen={isGradingModalOpen} 
                onClose={() => setIsGradingModalOpen(false)} 
                title={`Correção: ${selectedAttempt?.studentName}`} 
                maxWidth="max-w-4xl"
                footer={
                    <div className="flex justify-between w-full items-center">
                         <div className="text-sm text-slate-500">
                             Total de Questões: <strong>{exam?.questions.length}</strong>
                         </div>
                         <div className="flex gap-4 items-center">
                            <div className="flex items-center gap-2">
                                <label className="font-bold text-slate-700">Nota Final:</label>
                                <input 
                                    type="number" 
                                    value={editingScore} 
                                    onChange={(e) => setEditingScore(Number(e.target.value))}
                                    className="border border-brand-blue rounded px-2 py-1 w-20 text-center font-bold text-lg text-brand-blue outline-none focus:ring-2 focus:ring-blue-200"
                                />
                            </div>
                            <Button onClick={handleSaveScore}>Salvar Nota</Button>
                         </div>
                    </div>
                }
            >
                <div className="space-y-6">
                    {exam?.questions.map((q, idx) => {
                        const studentAnswer = selectedAttempt?.answers[q.id];
                        let isAutoCorrect = false;
                        let correctText = '';

                        // Lógica de visualização de correção
                        if (q.type === QuestionType.MULTIPLE_CHOICE || q.type === QuestionType.TRUE_FALSE) {
                            const correctOpt = q.options?.find(o => o.isCorrect);
                            isAutoCorrect = correctOpt ? (studentAnswer === correctOpt.id || studentAnswer === correctOpt.text) : false;
                            correctText = correctOpt?.text || 'Não definido';
                            
                            // Transformar ID em Texto para exibição se necessário
                            var displayAnswer = studentAnswer;
                            const selectedOpt = q.options?.find(o => o.id === studentAnswer);
                            if (selectedOpt) displayAnswer = selectedOpt.text;

                        } else if (q.type === QuestionType.NUMERIC) {
                            const correctVal = q.options?.[0]?.text;
                            isAutoCorrect = parseFloat(studentAnswer) === parseFloat(correctVal || '0');
                            correctText = correctVal || '';
                            var displayAnswer = studentAnswer;
                        } else {
                            // Dissertativa
                            correctText = q.options?.[0]?.text || '(Gabarito sugerido pelo professor)';
                            var displayAnswer = studentAnswer;
                        }

                        return (
                            <div key={q.id} className="border border-slate-200 rounded-lg p-4 bg-white">
                                <div className="flex gap-2 mb-2">
                                    <span className="font-bold text-slate-500">{idx + 1}.</span>
                                    <div className="flex-1">
                                        <div dangerouslySetInnerHTML={{__html: q.enunciado}} className="text-sm text-slate-800 mb-2 font-medium" />
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                            <div className={`p-3 rounded border ${
                                                q.type !== QuestionType.SHORT_ANSWER 
                                                    ? (isAutoCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200')
                                                    : 'bg-blue-50 border-blue-200'
                                            }`}>
                                                <span className="block text-xs font-bold uppercase mb-1 opacity-70">Resposta do Aluno</span>
                                                <span className="font-semibold">{displayAnswer || <span className="italic text-slate-400">Sem resposta</span>}</span>
                                            </div>
                                            
                                            <div className="p-3 rounded border bg-slate-50 border-slate-200">
                                                <span className="block text-xs font-bold uppercase mb-1 opacity-70">Gabarito Esperado</span>
                                                <span className="text-slate-600">{correctText}</span>
                                            </div>
                                        </div>
                                    </div>
                                    {q.type !== QuestionType.SHORT_ANSWER && (
                                        <div className="shrink-0">
                                            {isAutoCorrect 
                                                ? <div className="text-green-500 bg-green-100 p-1 rounded"><Icons.Check /></div>
                                                : <div className="text-red-500 bg-red-100 p-1 rounded"><Icons.X /></div>
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
                        <button onClick={handleCloseScanner} className="p-2 bg-white/20 rounded-full"><Icons.X /></button>
                    </div>
                    
                    <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
                        {!capturedImage ? (
                            <>
                                <video 
                                    ref={videoRef} 
                                    autoPlay 
                                    playsInline 
                                    className="w-full h-full object-cover"
                                ></video>
                                {/* Overlay / Mira */}
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="w-[80%] aspect-[3/4] border-2 border-white/50 rounded-lg relative">
                                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-500 -mt-1 -ml-1"></div>
                                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-500 -mt-1 -mr-1"></div>
                                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-500 -mb-1 -ml-1"></div>
                                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-500 -mb-1 -mr-1"></div>
                                        <p className="text-white text-center mt-[120%] text-sm font-bold drop-shadow-md">Enquadre o cartão-resposta</p>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="relative w-full h-full">
                                <img src={capturedImage} alt="Capture" className="w-full h-full object-contain" />
                                {scanning && (
                                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white">
                                        <div className="w-12 h-12 border-4 border-white/30 border-t-brand-blue rounded-full animate-spin mb-4"></div>
                                        <p className="font-bold animate-pulse">A Inteligência Artificial está corrigindo...</p>
                                    </div>
                                )}
                            </div>
                        )}
                        <canvas ref={canvasRef} className="hidden"></canvas>
                    </div>

                    <div className="p-6 bg-black flex justify-center pb-10">
                        {!capturedImage ? (
                            <button 
                                onClick={handleCapture} 
                                className="w-20 h-20 bg-white rounded-full border-4 border-gray-300 flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                            >
                                <div className="w-16 h-16 bg-white rounded-full border-2 border-black"></div>
                            </button>
                        ) : (
                            scanResult ? (
                                <div className="w-full bg-white rounded-xl p-4 text-slate-800 animate-slide-up">
                                    <div className="flex justify-between items-center mb-4">
                                        <div>
                                            <p className="text-xs text-slate-500 uppercase">Aluno Detectado</p>
                                            <h4 className="font-bold text-lg">{scanResult.studentName}</h4>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-slate-500 uppercase">Nota</p>
                                            <p className="font-bold text-3xl text-brand-blue">{scanResult.score}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="outline" onClick={() => { setCapturedImage(null); setScanResult(null); startCamera(); }} className="flex-1">Tentar Novamente</Button>
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
