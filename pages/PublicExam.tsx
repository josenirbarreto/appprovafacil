
import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { FirebaseService } from '../services/firebaseService';
import { Exam, Question, QuestionType, ExamAttempt, Student } from '../types';
import { Button, Input, Card, Badge, Select } from '../components/UI';
import { Icons } from '../components/Icons';

const PublicExam = () => {
    const { examId } = useParams();
    const [exam, setExam] = useState<Exam | null>(null);
    const [classStudents, setClassStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [step, setStep] = useState<'WELCOME' | 'TAKING' | 'FINISHED'>('WELCOME');
    
    // Student Data
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [manualStudentName, setManualStudentName] = useState('');
    const [studentIdInput, setStudentIdInput] = useState('');
    
    // Exam State
    const [currentAttempt, setCurrentAttempt] = useState<ExamAttempt | null>(null);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [randomizedQuestions, setRandomizedQuestions] = useState<Question[]>([]);

    useEffect(() => {
        const loadExam = async () => {
            if (!examId) return;
            try {
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
                    else {
                        setExam(data);
                        // Se a prova tiver turma, busca a lista de alunos
                        if (data.classId) {
                            const students = await FirebaseService.getStudents(data.classId);
                            setClassStudents(students);
                        }
                    }
                }
            } catch (err: any) {
                setError('Erro ao carregar a prova. Verifique sua conexão.');
            } finally {
                setLoading(false);
            }
        };
        loadExam();
    }, [examId]);

    useEffect(() => {
        if (step === 'TAKING' && timeLeft !== null) {
            if (timeLeft <= 0) { handleSubmit(); return; }
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
        let name = '';
        let identifier = '';
        let sid = undefined;

        if (classStudents.length > 0) {
            if (!selectedStudentId) return alert('Por favor, selecione seu nome na lista.');
            const student = classStudents.find(s => s.id === selectedStudentId)!;
            name = student.name;
            identifier = student.registration;
            sid = student.id;
        } else {
            if (!manualStudentName) return alert('Por favor, informe seu nome.');
            name = manualStudentName;
            identifier = studentIdInput || name.toLowerCase().replace(/\s/g, '');
        }

        try {
            const previousAttempts = await FirebaseService.getStudentAttempts(exam!.id, identifier);
            const allowed = exam!.publicConfig!.allowedAttempts || 1;
            if (previousAttempts.length >= allowed) return alert(`Limite de tentativas atingido.`);

            let questionsToUse = [...exam!.questions];
            if (exam!.publicConfig?.randomizeQuestions) {
                questionsToUse.sort(() => Math.random() - 0.5);
                questionsToUse = questionsToUse.map(q => {
                    if (q.type === QuestionType.MULTIPLE_CHOICE && q.options) return { ...q, options: [...q.options].sort(() => Math.random() - 0.5) };
                    return q;
                });
            }
            setRandomizedQuestions(questionsToUse);

            const attempt = await FirebaseService.startAttempt(exam!.id, name, identifier, sid);
            setCurrentAttempt(attempt);
            if (exam!.publicConfig!.timeLimitMinutes > 0) setTimeLeft(exam!.publicConfig!.timeLimitMinutes * 60);
            setStep('TAKING');
        } catch (err: any) {
            alert("Erro ao iniciar a prova.");
        }
    };

    const handleAnswer = (qId: string, val: string) => setAnswers(prev => ({ ...prev, [qId]: val }));

    const handleSubmit = async () => {
        if (!currentAttempt || !exam) return;
        let finalScore = 0;
        randomizedQuestions.forEach(q => {
            const answer = answers[q.id];
            if (!answer) return;
            if (q.type === QuestionType.MULTIPLE_CHOICE || q.type === QuestionType.TRUE_FALSE) {
                const correctOpt = q.options?.find(o => o.isCorrect);
                if (correctOpt && (correctOpt.id === answer || correctOpt.text === answer)) finalScore++;
            } else if (q.type === QuestionType.NUMERIC) {
                const correctVal = q.options?.[0]?.text;
                if (parseFloat(answer) === parseFloat(correctVal || '0')) finalScore++;
            }
        });
        setCurrentAttempt(prev => prev ? { ...prev, score: finalScore, answers, status: 'COMPLETED' } : null);
        await FirebaseService.submitAttempt(currentAttempt.id, answers, finalScore, exam.questions.length);
        setStep('FINISHED');
    };

    if (loading) return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50 text-slate-500 font-bold">Carregando avaliação...</div>;
    if (error) return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50 p-4">
            <Card className="max-w-md w-full text-center py-10 shadow-xl">
                <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4"><Icons.X /></div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Acesso Indisponível</h2>
                <p className="text-slate-500">{error}</p>
            </Card>
        </div>
    );

    const containerClasses = "fixed inset-0 z-50 bg-slate-50 flex flex-col overflow-y-auto custom-scrollbar";

    if (step === 'WELCOME') {
        return (
            <div className={`${containerClasses} items-center justify-center p-4`}>
                <Card className="max-w-lg w-full shrink-0 my-auto shadow-2xl border-t-4 border-brand-blue">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-blue-100 text-brand-blue rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold"><Icons.FileText /></div>
                        <h1 className="text-2xl font-display font-bold text-slate-800">{exam?.title}</h1>
                        <p className="text-slate-500 font-medium">{exam?.headerText}</p>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl mb-8 text-sm text-slate-600 space-y-3 border border-slate-100">
                        <div className="flex justify-between"><span>Tempo Máximo:</span><span className="font-bold text-slate-900">{exam?.publicConfig?.timeLimitMinutes ? `${exam.publicConfig.timeLimitMinutes} min` : 'Sem limite'}</span></div>
                        <div className="flex justify-between"><span>Questões:</span><span className="font-bold text-slate-900">{exam?.questions.length}</span></div>
                        <div className="flex justify-between"><span>Tentativas:</span><span className="font-bold text-slate-900">{exam?.publicConfig?.allowedAttempts}</span></div>
                    </div>

                    <div className="space-y-5">
                        {classStudents.length > 0 ? (
                            <div className="animate-fade-in">
                                <label className="block text-sm font-bold text-slate-700 mb-2">Selecione seu nome na lista:</label>
                                <Select value={selectedStudentId} onChange={e => setSelectedStudentId(e.target.value)} className="h-12 text-base font-bold text-brand-blue border-2 border-brand-blue/20">
                                    <option value="">Escolha seu nome...</option>
                                    {classStudents.map(s => <option key={s.id} value={s.id}>{s.name} ({s.registration})</option>)}
                                </Select>
                            </div>
                        ) : (
                            <div className="space-y-4 animate-fade-in">
                                <Input label="Seu Nome Completo" value={manualStudentName} onChange={e => setManualStudentName(e.target.value)} placeholder="Digite como consta na chamada" autoFocus className="h-12 text-lg" />
                                {exam?.publicConfig?.requireIdentifier && <Input label="Matrícula ou Código" value={studentIdInput} onChange={e => setStudentIdInput(e.target.value)} placeholder="Ex: 2024001" className="h-12" />}
                            </div>
                        )}
                        <Button onClick={handleStart} className="w-full justify-center py-4 text-xl font-black shadow-lg shadow-blue-500/30 hover:scale-[1.02] transition-transform">Iniciar Agora</Button>
                    </div>
                </Card>
            </div>
        );
    }

    if (step === 'FINISHED') {
        return (
            <div className={`${containerClasses} items-center justify-center p-4`}>
                <Card className="max-w-md w-full text-center py-12 animate-fade-in shadow-2xl">
                    <div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce"><Icons.Check /></div>
                    <h2 className="text-3xl font-black text-slate-800 mb-2">Prova Concluída!</h2>
                    <p className="text-slate-500 mb-8 font-medium">Suas respostas foram salvas no histórico da turma.</p>
                    {exam?.publicConfig?.showFeedback && currentAttempt && (
                        <div className="bg-brand-blue/5 p-6 rounded-2xl border-2 border-brand-blue/10">
                            <p className="text-xs text-slate-500 uppercase font-black tracking-widest mb-2">Nota Preliminar</p>
                            <p className="text-5xl font-display font-black text-brand-blue">{currentAttempt.score} <span className="text-2xl text-slate-400">/ {exam.questions.length}</span></p>
                            {exam.questions.some(q => q.type === QuestionType.SHORT_ANSWER) && <p className="text-xs text-slate-400 mt-4 italic font-medium">*Questões dissertativas dependem da correção do professor.</p>}
                        </div>
                    )}
                </Card>
            </div>
        );
    }

    return (
        <div className={containerClasses}>
            <div className="bg-white border-b border-slate-200 sticky top-0 z-50 px-6 py-4 shadow-sm flex justify-between items-center shrink-0">
                <div>
                    <h1 className="font-black text-slate-800 text-lg truncate max-w-[300px]">{exam?.title}</h1>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{currentAttempt?.studentName}</p>
                </div>
                {timeLeft !== null && (
                    <div className={`font-mono font-black text-2xl px-4 py-1.5 rounded-lg border-2 ${timeLeft < 120 ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' : 'bg-slate-50 text-slate-800 border-slate-200'}`}>
                        {formatTime(timeLeft)}
                    </div>
                )}
            </div>

            <div className="max-w-3xl w-full mx-auto p-4 md:p-8 space-y-10 flex-1">
                {randomizedQuestions.map((q, idx) => (
                    <div key={q.id} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                        <div className="flex gap-4 mb-6">
                            <span className="bg-slate-800 text-white font-black w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg shadow-md">{idx + 1}</span>
                            <div className="prose prose-slate max-w-none text-slate-800 pt-1 font-medium leading-relaxed" dangerouslySetInnerHTML={{__html: q.enunciado}} />
                        </div>

                        <div className="ml-14">
                            {q.type === QuestionType.MULTIPLE_CHOICE && (
                                <div className="space-y-3">
                                    {q.options?.map((opt) => (
                                        <label key={opt.id} className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${answers[q.id] === opt.id ? 'border-brand-blue bg-blue-50/50 shadow-md ring-1 ring-brand-blue' : 'border-slate-100 hover:bg-slate-50'}`}>
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${answers[q.id] === opt.id ? 'border-brand-blue bg-brand-blue text-white' : 'border-slate-300 bg-white'}`}>
                                                {answers[q.id] === opt.id && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
                                            </div>
                                            <input type="radio" name={q.id} value={opt.id} checked={answers[q.id] === opt.id} onChange={() => handleAnswer(q.id, opt.id)} className="hidden" />
                                            <span className="text-base text-slate-700 font-bold">{opt.text}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                            {(q.type === QuestionType.SHORT_ANSWER || q.type === QuestionType.NUMERIC) && (
                                <textarea className="w-full border-2 border-slate-100 rounded-xl p-4 text-lg font-medium focus:ring-4 focus:ring-blue-100 outline-none bg-slate-50/30 transition-all focus:bg-white" placeholder="Sua resposta aqui..." rows={3} value={answers[q.id] || ''} onChange={e => handleAnswer(q.id, e.target.value)} />
                            )}
                        </div>
                    </div>
                ))}
                <div className="pt-12 pb-32"><Button onClick={handleSubmit} className="w-full justify-center py-5 text-2xl font-black shadow-2xl shadow-blue-500/20 hover:scale-[1.01] transform transition-all">Enviar Prova Agora</Button></div>
            </div>
        </div>
    );
};

export default PublicExam;
