
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

    // --- EXPORTAÇÃO COMPATÍVEL COM EXCEL (CSV UTF-8 BOM) ---
    const handleExportExcel = () => {
        if (!attempts.length || !exam) return;
        
        // Byte Order Mark (BOM) para UTF-8 - Força o Excel a reconhecer acentos corretamente
        const BOM = "\uFEFF";
        
        // Cabeçalhos com separador ponto-e-vírgula (Padrão Excel Brasil)
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

    const analysisData = useMemo(() => {
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

    // Agrupamento Pedagógico por Descritor (Tópico)
    const topicAnalysis = useMemo(() => {
        const map: Record<string, { name: string, total: number, correct: number, count: number, path: string }> = {};
        
        analysisData.forEach(item => {
            const q = item.question;
            const topicId = q.topicId || 'unclassified';
            
            if (!map[topicId]) {
                let topicName = 'Conteúdo Geral';
                let pathStr = 'Geral';
                
                // Mapear caminho curricular na hierarquia
                hierarchy.forEach(d => {
                    d.chapters.forEach(c => {
                        c.units.forEach(u => {
                            u.topics.forEach(t => {
                                if (t.id === topicId) {
                                    topicName = t.name;
                                    pathStr = `${d.name} > ${c.name} > ${u.name}`;
                                }
                            });
                        });
                    });
                });
                
                map[topicId] = { name: topicName, total: 0, correct: 0, count: 0, path: pathStr };
            }
            
            map[topicId].total += attempts.length;
            map[topicId].correct += item.correctCount;
            map[topicId].count += 1;
        });

        return Object.values(map).sort((a,b) => (a.correct/a.total) - (b.correct/b.total));
    }, [analysisData, attempts.length, hierarchy]);

    const globalMetrics = useMemo(() => {
        const totalAttempts = Math.max(1, attempts.length);
        const avg = (attempts.reduce((a,b) => a+b.score,0) / totalAttempts);
        const excellent = attempts.filter(a => (a.score/a.totalQuestions) >= 0.8).length;
        const critical = attempts.filter(a => (a.score/a.totalQuestions) < 0.5).length;
        return { avg, excellent, critical };
    }, [attempts]);

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

    if (loading) return <div className="p-8 h-full flex flex-col items-center justify-center text-slate-400 font-bold"><div className="w-8 h-8 border-4 border-slate-200 border-t-brand-blue rounded-full animate-spin mb-4"></div>Mapeando desempenho pedagógico...</div>;

    return (
        <div className="p-8 h-full flex flex-col bg-slate-50 overflow-y-auto custom-scrollbar">
            {/* HEADER */}
            <div className="mb-6 flex flex-col md:flex-row justify-between items-start gap-4">
                <div>
                    <button onClick={() => navigate('/exams')} className="text-slate-400 hover:text-slate-600 flex items-center gap-1 text-sm mb-2 font-bold"><Icons.ArrowLeft /> Voltar</button>
                    <h2 className="text-3xl font-display font-bold text-slate-800 tracking-tight">Resultados: {exam?.title}</h2>
                    <p className="text-slate-500 mt-1">Visão analítica de proficiência por descritores e desempenho individual.</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" onClick={handleExportExcel} disabled={attempts.length === 0} className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 bg-white">
                        <Icons.Download /> Exportar Relatório (Excel)
                    </Button>
                    <Button variant="secondary" onClick={() => { setIsScannerOpen(true); startCamera(); }} className="shadow-lg shadow-orange-100">
                        <Icons.Camera /> Escanear Gabaritos
                    </Button>
                </div>
            </div>

            {/* KPI CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <Card className="text-center p-6 border-l-4 border-l-blue-500 shadow-sm">
                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Avaliados</p>
                    <p className="text-4xl font-black text-slate-800">{attempts.length}</p>
                    <p className="text-xs text-slate-500 font-bold mt-1">Total de Alunos</p>
                </Card>
                <Card className="text-center p-6 border-l-4 border-l-emerald-500 shadow-sm">
                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Média da Turma</p>
                    <p className="text-4xl font-black text-emerald-600">{globalMetrics.avg.toFixed(1)}</p>
                    <p className="text-xs text-slate-500 font-bold mt-1">Acertos médios</p>
                </Card>
                <Card className="text-center p-6 border-l-4 border-l-orange-500 shadow-sm">
                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Alerta Crítico</p>
                    <p className="text-4xl font-black text-orange-600">{globalMetrics.critical}</p>
                    <p className="text-xs text-slate-500 font-bold mt-1">Aproveitamento &lt; 50%</p>
                </Card>
                <Card className="text-center p-6 border-l-4 border-l-purple-500 shadow-sm">
                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Alta Performance</p>
                    <p className="text-4xl font-black text-purple-600">{globalMetrics.excellent}</p>
                    <p className="text-xs text-slate-500 font-bold mt-1">Aproveitamento &gt; 80%</p>
                </Card>
            </div>

            {/* TABS */}
            <div className="flex gap-6 border-b border-slate-200 mb-8">
                <button onClick={() => setActiveTab('LIST')} className={`pb-3 px-2 text-sm font-black uppercase tracking-widest transition-all ${activeTab === 'LIST' ? 'text-brand-blue border-b-4 border-brand-blue' : 'text-slate-400 hover:text-slate-600'}`}>Lista de Notas</button>
                <button onClick={() => setActiveTab('ANALYSIS')} className={`pb-3 px-2 text-sm font-black uppercase tracking-widest transition-all ${activeTab === 'ANALYSIS' ? 'text-brand-blue border-b-4 border-brand-blue' : 'text-slate-400 hover:text-slate-600'}`}>Análise por Descritores</button>
            </div>

            {activeTab === 'LIST' ? (
                <Card className="overflow-hidden animate-fade-in shadow-md">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="p-4 text-slate-500 font-black uppercase text-[10px]">Aluno / Matrícula</th>
                                <th className="p-4 text-slate-500 font-black uppercase text-[10px]">Data de Entrega</th>
                                <th className="p-4 text-slate-500 font-black uppercase text-[10px]">Acertos</th>
                                <th className="p-4 text-slate-500 font-black uppercase text-[10px] text-center">Desempenho</th>
                                <th className="p-4 text-right text-slate-500 font-black uppercase text-[10px]">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {attempts.length === 0 ? (
                                <tr><td colSpan={5} className="p-16 text-center text-slate-400 italic">Nenhum resultado registrado para esta avaliação.</td></tr>
                            ) : (
                                attempts.map(att => {
                                    const pct = (att.score / Math.max(1, att.totalQuestions)) * 100;
                                    return (
                                        <tr key={att.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="p-4">
                                                <div className="font-bold text-slate-800 text-base">{att.studentName}</div>
                                                <div className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-widest">{att.studentIdentifier || 'S/ IDENTIFICAÇÃO'}</div>
                                            </td>
                                            <td className="p-4 text-slate-500 text-xs font-bold">
                                                {att.submittedAt ? new Date(att.submittedAt).toLocaleString() : 'Em Aberto'}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-xl font-black text-slate-700">{att.score}</span>
                                                    <span className="text-slate-300 font-bold">/ {att.totalQuestions}</span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-col items-center gap-1">
                                                    <Badge color={pct >= 80 ? 'green' : pct >= 50 ? 'yellow' : 'red'}>
                                                        {pct.toFixed(0)}%
                                                    </Badge>
                                                    <div className="w-24 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                        <div className={`h-full ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{width: `${pct}%`}}></div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 text-right">
                                                <button onClick={() => handleOpenGrading(att)} className="text-brand-blue hover:bg-blue-100 p-2 rounded-xl transition-all shadow-sm border border-transparent hover:border-blue-200">
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
                <div className="space-y-10 animate-fade-in">
                    {/* RESUMO POR DESCRITORES */}
                    <div className="space-y-4">
                        <h3 className="font-black text-slate-800 text-lg flex items-center gap-2 px-1 uppercase tracking-tighter">
                            <Icons.List /> Proficiência por Tópico (Descritor)
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {topicAnalysis.map((topic, i) => {
                                const pct = (topic.correct / topic.total) * 100;
                                return (
                                    <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex-1 pr-4">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{topic.path}</p>
                                                <h4 className="text-base font-bold text-slate-800 leading-tight group-hover:text-brand-blue transition-colors">{topic.name}</h4>
                                            </div>
                                            <div className="text-right">
                                                <span className={`text-2xl font-black ${pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{pct.toFixed(0)}%</span>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Taxa de Acerto</p>
                                            </div>
                                        </div>
                                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mb-3">
                                            <div className={`h-full transition-all duration-700 ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }}></div>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-tighter text-slate-400">
                                            <span className="flex items-center gap-1"><Icons.Questions /> {topic.count} Questões vinculadas</span>
                                            <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{topic.correct} acertos da turma</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* DETALHAMENTO POR QUESTÃO */}
                    <div className="space-y-4">
                        <h3 className="font-black text-slate-800 text-lg flex items-center gap-2 px-1 uppercase tracking-tighter">
                            <Icons.Grid /> Diagnóstico por Questão
                        </h3>
                        {analysisData.map(item => (
                            <Card key={item.question.id} className="p-0 overflow-hidden hover:shadow-lg transition-shadow border-slate-200">
                                <div className="flex flex-col md:flex-row">
                                    <div className={`w-full md:w-32 text-center shrink-0 p-6 flex flex-col justify-center items-center gap-2 border-b md:border-b-0 md:border-r border-slate-100 ${item.successRate >= 70 ? 'bg-green-50/50' : item.successRate >= 40 ? 'bg-yellow-50/50' : 'bg-red-50/50'}`}>
                                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Questão</p>
                                        <p className="text-4xl font-black text-slate-800">{item.index}</p>
                                        <div className="mt-1">
                                            <p className={`text-xl font-black ${item.successRate >= 70 ? 'text-green-600' : item.successRate >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                {item.successRate.toFixed(0)}%
                                            </p>
                                            <p className="text-[10px] uppercase font-black text-slate-400 tracking-tighter">Acerto</p>
                                        </div>
                                    </div>
                                    <div className="flex-1 p-6">
                                        <div className="mb-4">
                                            <p className="text-[9px] font-black text-brand-blue uppercase tracking-widest bg-blue-50 px-2 py-1 rounded w-fit mb-3">
                                                {FirebaseService.getFullHierarchyString(item.question, hierarchy)}
                                            </p>
                                            <div className="text-slate-800 font-medium text-sm leading-relaxed rich-text-content" dangerouslySetInnerHTML={{__html: item.question.enunciado}} />
                                        </div>
                                        
                                        {Array.isArray(item.question.options) && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
                                                {item.question.options.map((opt, i) => {
                                                    const votes = item.optionCounts[opt.id] || 0;
                                                    const pct = (votes / Math.max(1, attempts.length)) * 100;
                                                    const isCorrect = opt.isCorrect;
                                                    const isTrap = !isCorrect && item.mainDistractor?.id === opt.id && votes > 0;

                                                    return (
                                                        <div key={opt.id} className={`p-3 rounded-xl border text-xs transition-all ${isCorrect ? 'bg-green-50 border-green-200 ring-1 ring-green-100' : isTrap ? 'bg-red-50 border-red-200' : 'bg-white border-slate-100'}`}>
                                                            <div className="flex justify-between items-center mb-1.5">
                                                                <span className="font-bold flex items-center gap-2">
                                                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] border ${isCorrect ? 'bg-green-500 border-green-500 text-white' : 'bg-slate-100 border-slate-200'}`}>{String.fromCharCode(65+i)}</span>
                                                                    <span className="line-clamp-1">{opt.text}</span>
                                                                </span>
                                                                <span className="font-black text-slate-600">{pct.toFixed(0)}%</span>
                                                            </div>
                                                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                                                <div className={`h-full transition-all duration-700 ${isCorrect ? 'bg-green-500' : isTrap ? 'bg-red-400' : 'bg-slate-300'}`} style={{width: `${pct}%`}}></div>
                                                            </div>
                                                            {isTrap && <p className="text-[9px] font-black text-red-600 uppercase mt-1.5 flex items-center gap-1"><Icons.Shield /> Principal Distrator (Pegadinha)</p>}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* MODAL REVISÃO */}
            <Modal isOpen={isGradingModalOpen} onClose={() => setIsGradingModalOpen(false)} title={`Revisão Individual: ${selectedAttempt?.studentName}`} maxWidth="max-w-4xl" footer={<div className="flex gap-4 items-center ml-auto"><label className="font-bold text-sm text-slate-500 uppercase tracking-tighter">Ajustar Nota Final:</label><input type="number" value={editingScore} onChange={e => setEditingScore(Number(e.target.value))} className="border-2 border-brand-blue rounded px-2 py-1 w-20 text-center font-black outline-none focus:ring-4 focus:ring-blue-100" /><Button onClick={handleSaveScore}>Salvar Alteração</Button></div>}>
                <div className="space-y-6">
                    {(Array.isArray(exam?.questions) ? exam.questions : []).map((q, idx) => {
                        const ans = selectedAttempt?.answers?.[q.id];
                        const correctOpt = Array.isArray(q.options) ? q.options.find(o => o.isCorrect) : null;
                        const isCorrect = correctOpt && (ans === correctOpt.id || ans === correctOpt.text);
                        return (
                            <div key={q.id} className={`border p-5 rounded-2xl transition-colors ${isCorrect ? 'bg-green-50/30 border-green-100' : ans ? 'bg-red-50/30 border-red-100' : 'bg-slate-50 border-slate-200'}`}>
                                <div className="flex gap-3 mb-4">
                                    <span className="font-black text-slate-300 text-lg">{idx+1}.</span>
                                    <div className="flex-1 text-sm font-medium rich-text-content" dangerouslySetInnerHTML={{__html: q.enunciado}} />
                                    {ans ? (isCorrect ? <div className="text-green-500 p-1 bg-green-100 rounded-full"><Icons.Check /></div> : <div className="text-red-500 p-1 bg-red-100 rounded-full"><Icons.X /></div>) : <Badge color="yellow">Sem Resposta</Badge>}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                    <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                                        <b className="text-slate-400 uppercase text-[9px] block mb-1">Resposta do Aluno:</b> 
                                        <span className="font-bold text-slate-700">{Array.isArray(q.options) ? q.options.find(o => o.id === ans)?.text || ans || '---' : ans || '---'}</span>
                                    </div>
                                    <div className="p-3 bg-green-500 text-white rounded-xl shadow-md">
                                        <b className="text-green-200 uppercase text-[9px] block mb-1">Gabarito Oficial:</b> 
                                        <span className="font-bold">{correctOpt?.text || 'Questão Dissertativa'}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Modal>

            {/* SCANNER UI */}
            {isScannerOpen && (
                <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-fade-in">
                    <div className="p-4 flex justify-between items-center text-white bg-slate-900 border-b border-white/10">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                            <h3 className="font-black uppercase tracking-widest text-sm">Scanner de Gabaritos Prova Fácil</h3>
                        </div>
                        <button onClick={handleCloseScanner} className="p-2 hover:bg-white/10 rounded-full transition-colors"><Icons.X /></button>
                    </div>
                    <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
                        {!capturedImage ? (
                            <>
                                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                                <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none">
                                    <div className="w-full h-full border-2 border-dashed border-white/50 rounded-2xl flex items-center justify-center">
                                        <div className="text-white/30 text-xs font-black uppercase text-center">
                                            Enquadre o Gabarito com as Âncoras visíveis
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="relative w-full h-full flex items-center justify-center">
                                <img src={capturedImage} className="max-w-full max-h-full object-contain" />
                                {scanning && (
                                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                                        <div className="w-12 h-12 border-4 border-white/20 border-t-brand-blue rounded-full animate-spin mb-4" />
                                        <p className="font-black uppercase tracking-widest animate-pulse">IA Processando Gabarito...</p>
                                    </div>
                                )}
                            </div>
                        )}
                        <canvas ref={canvasRef} className="hidden" />
                    </div>
                    <div className="p-6 flex justify-center bg-slate-900">
                        {!capturedImage ? (
                            <button onClick={handleCapture} className="w-20 h-20 bg-white rounded-full border-[6px] border-slate-700 flex items-center justify-center shadow-2xl active:scale-95 transition-all group">
                                <div className="w-14 h-14 bg-red-500 rounded-full group-hover:bg-red-600 transition-colors shadow-inner"></div>
                            </button>
                        ) : (
                            scanResult && (
                                <div className="bg-white p-6 rounded-3xl w-full max-w-md shadow-2xl animate-scale-in">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h4 className="font-black text-xl text-slate-800">{scanResult.studentName}</h4>
                                            <Badge color="blue">LEITURA ÓPTICA</Badge>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-4xl font-black text-brand-blue leading-none">{scanResult.score}</p>
                                            <p className="text-[10px] font-black text-slate-400 uppercase">Acertos</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="outline" className="flex-1" onClick={() => { setCapturedImage(null); setScanResult(null); startCamera(); }}>Repetir</Button>
                                        <Button className="flex-1" onClick={handleSaveScan}>Confirmar & Salvar</Button>
                                    </div>
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
