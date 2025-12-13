
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { FirebaseService } from '../services/firebaseService';
import { Exam, Question, QuestionType, ExamAttempt } from '../types';
import { Button, Input, Card, Badge } from '../components/UI';
import { Icons } from '../components/Icons';

const PublicExam = () => {
    const { examId } = useParams();
    const [exam, setExam] = useState<Exam | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [step, setStep] = useState<'WELCOME' | 'TAKING' | 'FINISHED'>('WELCOME');
    
    // Student Data
    const [studentName, setStudentName] = useState('');
    const [studentId, setStudentId] = useState('');
    
    // Exam State
    const [currentAttempt, setCurrentAttempt] = useState<ExamAttempt | null>(null);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [randomizedQuestions, setRandomizedQuestions] = useState<Question[]>([]);

    useEffect(() => {
        const loadExam = async () => {
            if (!examId) return;
            
            try {
                // Tenta buscar a prova. Se as regras do Firestore bloquearem, vai cair no catch.
                const data = await FirebaseService.getExamById(examId);
                
                if (!data) {
                    setError('Prova não encontrada.');
                } else if (!data.publicConfig?.isPublished) {
                    setError('Esta prova não está mais disponível.');
                } else {
                    const now = new Date();
                    const start = new Date(data.publicConfig.startDate);
                    const end = new Date(data.publicConfig.endDate);
                    
                    if (now < start) setError(`A prova estará disponível em ${start.toLocaleString()}`);
                    else if (now > end) setError('O prazo para esta prova encerrou.');
                    else setExam(data);
                }
            } catch (err: any) {
                console.error("Erro ao carregar prova:", err);
                if (err.code === 'permission-denied' || err.message?.includes('permission')) {
                    setError('CONFIGURAÇÃO NECESSÁRIA: O Firestore está bloqueando acesso anônimo.');
                } else {
                    setError('Erro ao carregar a prova. Verifique sua conexão.');
                }
            } finally {
                setLoading(false);
            }
        };
        loadExam();
    }, [examId]);

    // Timer Logic
    useEffect(() => {
        if (step === 'TAKING' && timeLeft !== null) {
            if (timeLeft <= 0) {
                handleSubmit();
                return;
            }
            const timer = setInterval(() => setTimeLeft(prev => (prev !== null ? prev - 1 : null)), 1000);
            return () => clearInterval(timer);
        }
    }, [step, timeLeft]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const handleStart = async () => {
        if (!studentName) return alert('Por favor, informe seu nome.');
        if (exam?.publicConfig?.requireIdentifier && !studentId) return alert('Por favor, informe sua matrícula ou email.');

        const identifier = studentId || studentName.toLowerCase().replace(/\s/g, '');

        try {
            // Check attempts
            const previousAttempts = await FirebaseService.getStudentAttempts(exam!.id, identifier);
            const allowed = exam!.publicConfig!.allowedAttempts || 1;
            
            if (previousAttempts.length >= allowed) {
                alert(`Você já realizou esta prova ${previousAttempts.length} vezes. Limite atingido.`);
                return;
            }

            // Randomization Logic
            let questionsToUse = [...exam!.questions];
            if (exam!.publicConfig?.randomizeQuestions) {
                questionsToUse.sort(() => Math.random() - 0.5);
                questionsToUse = questionsToUse.map(q => {
                    if (q.type === QuestionType.MULTIPLE_CHOICE && q.options) {
                        return { ...q, options: [...q.options].sort(() => Math.random() - 0.5) };
                    }
                    return q;
                });
            }
            setRandomizedQuestions(questionsToUse);

            // Create Attempt in DB
            const attempt = await FirebaseService.startAttempt(exam!.id, studentName, identifier);
            setCurrentAttempt(attempt);

            if (exam!.publicConfig!.timeLimitMinutes > 0) {
                setTimeLeft(exam!.publicConfig!.timeLimitMinutes * 60);
            }

            setStep('TAKING');
        } catch (err: any) {
            console.error(err);
            if (err.code === 'permission-denied') {
                alert("Erro de Permissão: Configure as regras do Firestore para permitir escrita em 'exam_attempts'.");
            } else {
                alert("Erro ao iniciar a prova. Tente novamente.");
            }
        }
    };

    const handleAnswer = (qId: string, val: string) => {
        setAnswers(prev => ({ ...prev, [qId]: val }));
    };

    const handleSubmit = async () => {
        if (!currentAttempt || !exam) return;
        
        // Calculate Score (Auto-grading)
        let score = 0;
        randomizedQuestions.forEach(q => {
            const answer = answers[q.id];
            if (!answer) return;

            if (q.type === QuestionType.MULTIPLE_CHOICE || q.type === QuestionType.TRUE_FALSE) {
                const correctOpt = q.options?.find(o => o.isCorrect);
                if (correctOpt && (correctOpt.id === answer || correctOpt.text === answer)) { 
                     if (answer === correctOpt.id) score++;
                }
            } else if (q.type === QuestionType.NUMERIC) {
                const correctVal = q.options?.[0]?.text;
                if (parseFloat(answer) === parseFloat(correctVal || '0')) score++;
            }
        });

        await FirebaseService.submitAttempt(currentAttempt.id, answers, score, exam.questions.length);
        setStep('FINISHED');
    };

    if (loading) return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50 text-slate-500">Carregando prova...</div>;
    
    if (error) return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50 p-4 overflow-y-auto">
            <Card className="max-w-md w-full text-center py-10">
                <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Icons.X />
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Acesso Indisponível</h2>
                <p className="text-slate-500 mb-4">{error}</p>
                {error.includes("CONFIGURAÇÃO") && (
                    <div className="text-left bg-slate-100 p-3 rounded text-xs text-slate-600 font-mono overflow-x-auto">
                        <p className="mb-2 font-bold">Vá no Firebase Console {'>'} Firestore {'>'} Rules e cole:</p>
                        <pre>{`match /exams/{examId} { allow read: if true; }
match /exam_attempts/{attemptId} { allow read, write: if true; }`}</pre>
                    </div>
                )}
            </Card>
        </div>
    );

    // FIX DEFINITIVO: 'fixed inset-0' garante que o container ocupe a viewport inteira,
    // ignorando o 'overflow-hidden' do body definido no index.html.
    const containerClasses = "fixed inset-0 z-50 bg-slate-50 flex flex-col overflow-y-auto custom-scrollbar";

    if (step === 'WELCOME') {
        return (
            <div className={`${containerClasses} items-center justify-center p-4`}>
                <Card className="max-w-lg w-full shrink-0 my-auto shadow-xl">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-blue-100 text-brand-blue rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                            <Icons.FileText />
                        </div>
                        <h1 className="text-2xl font-display font-bold text-slate-800">{exam?.title}</h1>
                        <p className="text-slate-500">{exam?.headerText}</p>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg mb-6 text-sm text-blue-900 space-y-2 border border-blue-100">
                        <div className="flex justify-between">
                            <span>Tempo Limite:</span>
                            <span className="font-bold">{exam?.publicConfig?.timeLimitMinutes ? `${exam.publicConfig.timeLimitMinutes} min` : 'Sem limite'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Questões:</span>
                            <span className="font-bold">{exam?.questions.length}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Tentativas permitidas:</span>
                            <span className="font-bold">{exam?.publicConfig?.allowedAttempts}</span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <Input label="Nome Completo" value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="Seu nome" autoFocus />
                        {exam?.publicConfig?.requireIdentifier && (
                            <Input label="Matrícula ou Email" value={studentId} onChange={e => setStudentId(e.target.value)} placeholder="Identificação única" />
                        )}
                        <Button onClick={handleStart} className="w-full justify-center py-3 text-lg font-bold shadow-lg shadow-blue-200">Iniciar Prova</Button>
                    </div>
                </Card>
            </div>
        );
    }

    if (step === 'FINISHED') {
        return (
            <div className={`${containerClasses} items-center justify-center p-4`}>
                <Card className="max-w-md w-full text-center py-10 animate-fade-in shrink-0 my-auto shadow-xl">
                    <div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                        <Icons.Check />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Prova Enviada!</h2>
                    <p className="text-slate-500 mb-6">Suas respostas foram registradas com sucesso.</p>
                    
                    {exam?.publicConfig?.showFeedback && currentAttempt && (
                        <div className="bg-slate-50 p-4 rounded-lg inline-block border border-slate-200">
                            <p className="text-sm text-slate-500 uppercase font-bold mb-1">Resultado Preliminar</p>
                            <p className="text-4xl font-display font-bold text-brand-blue">
                                {currentAttempt.score} <span className="text-xl text-slate-400">/ {exam.questions.length}</span>
                            </p>
                        </div>
                    )}
                </Card>
            </div>
        );
    }

    return (
        <div className={containerClasses}>
            {/* Header Sticky */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-50 px-4 py-3 shadow-md flex justify-between items-center shrink-0">
                <div>
                    <h1 className="font-bold text-slate-800 text-sm md:text-base truncate max-w-[200px] md:max-w-none">{exam?.title}</h1>
                    <p className="text-xs text-slate-500">{studentName}</p>
                </div>
                {timeLeft !== null && (
                    <div className={`font-mono font-bold text-xl px-3 py-1 rounded ${timeLeft < 60 ? 'bg-red-50 text-red-600 animate-pulse border border-red-200' : 'bg-slate-100 text-slate-700'}`}>
                        {formatTime(timeLeft)}
                    </div>
                )}
            </div>

            <div className="max-w-3xl w-full mx-auto p-4 md:p-8 space-y-8 flex-1">
                {randomizedQuestions.map((q, idx) => (
                    <div key={q.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                        <div className="flex gap-4 mb-4">
                            <span className="bg-brand-blue text-white font-bold w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-blue-200">{idx + 1}</span>
                            <div className="prose prose-slate max-w-none text-slate-800 pt-1" dangerouslySetInnerHTML={{__html: q.enunciado}} />
                        </div>

                        <div className="ml-12">
                            {q.type === QuestionType.MULTIPLE_CHOICE && (
                                <div className="space-y-3">
                                    {q.options?.map((opt, i) => (
                                        <label key={opt.id} className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all ${answers[q.id] === opt.id ? 'border-brand-blue bg-blue-50 ring-1 ring-brand-blue shadow-sm' : 'border-slate-200 hover:bg-slate-50'}`}>
                                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${answers[q.id] === opt.id ? 'border-brand-blue bg-brand-blue text-white' : 'border-slate-300'}`}>
                                                {answers[q.id] === opt.id && <div className="w-2 h-2 bg-white rounded-full" />}
                                            </div>
                                            <input 
                                                type="radio" 
                                                name={q.id} 
                                                value={opt.id} 
                                                checked={answers[q.id] === opt.id} 
                                                onChange={() => handleAnswer(q.id, opt.id)} 
                                                className="hidden" 
                                            />
                                            <span className="text-sm text-slate-700 font-medium">{opt.text}</span>
                                        </label>
                                    ))}
                                </div>
                            )}

                            {q.type === QuestionType.TRUE_FALSE && (
                                <div className="space-y-3">
                                    {q.options?.map((opt) => (
                                        <label key={opt.id} className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all ${answers[q.id] === opt.id ? 'border-brand-blue bg-blue-50 ring-1 ring-brand-blue' : 'border-slate-200 hover:bg-slate-50'}`}>
                                            <input 
                                                type="radio" 
                                                name={q.id} 
                                                value={opt.id} 
                                                checked={answers[q.id] === opt.id} 
                                                onChange={() => handleAnswer(q.id, opt.id)} 
                                                className="w-4 h-4 text-brand-blue focus:ring-brand-blue" 
                                            />
                                            <span className="text-sm text-slate-700 font-medium">{opt.text}</span>
                                        </label>
                                    ))}
                                </div>
                            )}

                            {(q.type === QuestionType.SHORT_ANSWER || q.type === QuestionType.NUMERIC) && (
                                <Input 
                                    className="p-4 text-lg"
                                    placeholder="Digite sua resposta aqui..." 
                                    value={answers[q.id] || ''} 
                                    onChange={e => handleAnswer(q.id, e.target.value)}
                                    type={q.type === QuestionType.NUMERIC ? 'number' : 'text'}
                                />
                            )}
                        </div>
                    </div>
                ))}

                <div className="pt-8 pb-20">
                    <Button onClick={handleSubmit} className="w-full justify-center py-4 text-lg shadow-xl shadow-blue-500/20 hover:scale-[1.01] transform transition-all">
                        Finalizar e Enviar Prova
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default PublicExam;
