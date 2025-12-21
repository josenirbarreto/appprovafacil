
import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { FirebaseService } from '../services/firebaseService';
import { Exam, Question, QuestionType, ExamAttempt, Student, Institution } from '../types';
import { Button, Input, Card, Badge, Select } from '../components/UI';
import { Icons } from '../components/Icons';

const PublicExam = () => {
    const { examId } = useParams();
    const [exam, setExam] = useState<Exam | null>(null);
    const [institution, setInstitution] = useState<Institution | null>(null);
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
                        
                        // Busca Instituição
                        if (data.institutionId) {
                            const inst = await FirebaseService.getInstitutionById(data.institutionId);
                            setInstitution(inst);
                        }

                        // Se a prova tiver turma, busca a lista de alunos
                        if (data.classId) {
                            const students = await FirebaseService.getStudents(data.classId);
                            setClassStudents(Array.isArray(students) ? students : []);
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
        if (!exam) return;
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
            const previousAttempts = await FirebaseService.getStudentAttempts(exam.id, identifier);
            const allowed = parseInt(String(exam.publicConfig!.allowedAttempts)) || 1;
            if (previousAttempts.length >= allowed) return alert(`Limite de tentativas atingido.`);

            let questionsToUse = Array.isArray(exam.questions) ? [...exam.questions] : [];
            
            if (exam.publicConfig?.randomizeQuestions) {
                questionsToUse.sort(() => Math.random() - 0.5);
                questionsToUse = questionsToUse.map(q => {
                    if (q.type === QuestionType.MULTIPLE_CHOICE && Array.isArray(q.options)) {
                        return { ...q, options: [...q.options].sort(() => Math.random() - 0.5) };
                    }
                    return q;
                });
            }
            setRandomizedQuestions(questionsToUse);

            const attempt = await FirebaseService.startAttempt(exam.id, name, identifier, questionsToUse.length, sid);
            setCurrentAttempt(attempt);
            if (exam.publicConfig!.timeLimitMinutes > 0) setTimeLeft(exam.publicConfig!.timeLimitMinutes * 60);
            setStep('TAKING');
        } catch (err: any) {
            console.error("Start Exam Error:", err);
            alert("Erro ao iniciar a prova. Verifique se o banco de dados está online.");
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
                const options = Array.isArray(q.options) ? q.options : [];
                const correctOpt = options.find(o => o.isCorrect);
                if (correctOpt && (correctOpt.id === answer || correctOpt.text === answer)) finalScore++;
            } else if (q.type === QuestionType.NUMERIC) {
                const options = Array.isArray(q.options) ? q.options : [];
                const correctVal = options[0]?.text;
                if (parseFloat(answer) === parseFloat(correctVal || '0')) finalScore++;
            }
        });
        setCurrentAttempt(prev => prev ? { ...prev, score: finalScore, answers, status: 'COMPLETED' } : null);
        await FirebaseService.submitAttempt(currentAttempt.id, answers, finalScore, exam.questions.length);
        setStep('FINISHED');
    };

    const handleCloseWindow = () => {
        window.close();
        setTimeout(() => {
            window.location.href = "/";
        }, 100);
    };

    if (loading) return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-50 text-slate-400">
            <div className="w-12 h-12 border-4 border-slate-200 border-t-brand-blue rounded-full animate-spin mb-4"></div>
            <p className="font-black uppercase tracking-widest animate-pulse">Iniciando Portal do Aluno</p>
        </div>
    );

    if (error) return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50 p-4">
            <Card className="max-w-md w-full text-center py-10 shadow-xl border-t-4 border-red-500">
                <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4"><Icons.X /></div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Acesso Indisponível</h2>
                <p className="text-slate-500 font-medium px-4">{error}</p>
                <div className="mt-8">
                    <Button variant="ghost" onClick={() => window.location.reload()}>Tentar Novamente</Button>
                </div>
            </Card>
        </div>
    );

    const containerClasses = "fixed inset-0 z-50 bg-slate-50 flex flex-col overflow-y-auto custom-scrollbar";

    if (step === 'WELCOME') {
        const attemptsLimit = parseInt(String(exam?.publicConfig?.allowedAttempts));
        const displayAttempts = isNaN(attemptsLimit) || attemptsLimit < 1 ? 1 : attemptsLimit;

        return (
            <div className={`${containerClasses} items-center p-4 py-12`}>
                <Card className="max-w-lg w-full shrink-0 my-auto shadow-2xl border-t-8 border-brand-blue relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-blue-50 rounded-full"></div>
                    
                    <div className="text-center mb-8 relative z-10">
                        {institution?.logoUrl ? (
                            <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 inline-block mb-6">
                                <img src={institution.logoUrl} alt={institution.name} className="h-20 w-auto object-contain" />
                            </div>
                        ) : (
                            <div className="w-20 h-20 bg-blue-100 text-brand-blue rounded-2xl flex items-center justify-center mx-auto mb-6 text-3xl shadow-inner border border-blue-200">
                                <Icons.FileText />
                            </div>
                        )}
                        
                        {institution && (
                            <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{institution.name}</h2>
                        )}
                        <h1 className="text-3xl font-display font-black text-slate-800 leading-tight mb-2">{exam?.title}</h1>
                        <p className="text-slate-500 font-bold italic">{exam?.headerText || 'Seja bem-vindo(a)!'}</p>
                    </div>

                    <div className="bg-slate-50/80 backdrop-blur-sm p-5 rounded-2xl mb-8 border border-slate-200 grid grid-cols-3 gap-2">
                        <div className="text-center">
                            <p className="text-[10px] text-slate-400 font-black uppercase mb-1">Duração</p>
                            <p className="font-black text-slate-800 text-sm">{exam?.publicConfig?.timeLimitMinutes ? `${exam.publicConfig.timeLimitMinutes} min` : 'Livre'}</p>
                        </div>
                        <div className="text-center border-x border-slate-200">
                            <p className="text-[10px] text-slate-400 font-black uppercase mb-1">Questões</p>
                            <p className="font-black text-slate-800 text-sm">{Array.isArray(exam?.questions) ? exam?.questions.length : 0}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-[10px] text-slate-400 font-black uppercase mb-1">Tentativas</p>
                            <p className="font-black text-slate-800 text-sm">{displayAttempts}</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {classStudents.length > 0 ? (
                            <div className="animate-fade-in">
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3 text-center">Encontre seu nome na lista</label>
                                <Select value={selectedStudentId} onChange={e => setSelectedStudentId(e.target.value)} className="h-14 text-lg font-bold text-brand-blue border-2 border-brand-blue/10 bg-white hover:border-brand-blue/30 transition-all rounded-xl shadow-sm">
                                    <option value="">Clique para selecionar...</option>
                                    {classStudents.map(s => <option key={s.id} value={s.id}>{s.name} ({s.registration})</option>)}
                                </Select>
                            </div>
                        ) : (
                            <div className="space-y-4 animate-fade-in">
                                <Input label="Seu Nome Completo" value={manualStudentName} onChange={e => setManualStudentName(e.target.value)} placeholder="Digite seu nome completo" autoFocus className="h-14 text-lg font-bold rounded-xl border-2 border-slate-100" />
                                {exam?.publicConfig?.requireIdentifier && <Input label="Matrícula ou Código" value={studentIdInput} onChange={e => setStudentIdInput(e.target.value)} placeholder="Ex: 2024001" className="h-14 font-bold rounded-xl border-2 border-slate-100" />}
                            </div>
                        )}
                        
                        <div className="pt-4">
                            <Button onClick={handleStart} className="w-full justify-center h-16 text-xl font-black shadow-xl shadow-blue-500/30 hover:scale-[1.02] transition-all bg-brand-blue rounded-2xl active:scale-95">
                                ACESSAR PROVA AGORA
                            </Button>
                        </div>
                    </div>
                    
                    <div className="mt-8 text-center">
                        <p className="text-[10px] text-slate-400 font-bold flex items-center justify-center gap-1">
                            <Icons.Shield /> CONEXÃO SEGURA E MONITORADA
                        </p>
                    </div>
                </Card>
            </div>
        );
    }

    if (step === 'FINISHED') {
        return (
            <div className={`${containerClasses} items-center justify-center p-4`}>
                <Card className="max-w-md w-full text-center py-12 animate-fade-in shadow-2xl border-t-8 border-green-500">
                    <div className="w-20 h-20 bg-green-100 text-green-500 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-bounce shadow-sm"><Icons.Check /></div>
                    <h2 className="text-3xl font-display font-black text-slate-800 mb-2">Prova Concluída!</h2>
                    <p className="text-slate-500 mb-8 font-bold italic">Suas respostas foram enviadas com sucesso.</p>
                    
                    {exam?.publicConfig?.showFeedback && currentAttempt && (
                        <div className="bg-brand-blue/5 p-8 rounded-3xl border-2 border-brand-blue/10 relative overflow-hidden">
                            <div className="absolute top-0 right-0 -mr-4 -mt-4 w-12 h-12 bg-brand-blue/10 rounded-full"></div>
                            <p className="text-xs text-slate-500 uppercase font-black tracking-widest mb-3">Sua Nota Preliminar</p>
                            <p className="text-6xl font-display font-black text-brand-blue drop-shadow-sm">
                                {currentAttempt.score} 
                                <span className="text-2xl text-slate-300 font-bold ml-1">/ {Array.isArray(exam.questions) ? exam.questions.length : 0}</span>
                            </p>
                            {Array.isArray(exam.questions) && exam.questions.some(q => q.type === QuestionType.SHORT_ANSWER) && (
                                <div className="mt-6 flex items-start gap-2 text-left bg-white p-3 rounded-xl border border-blue-100">
                                    <div className="text-blue-500 mt-0.5"><Icons.Sparkles /></div>
                                    <p className="text-[11px] text-slate-500 font-bold leading-tight uppercase">Nota Parcial: Questões dissertativas serão corrigidas pelo professor.</p>
                                </div>
                            )}
                        </div>
                    )}
                    
                    <div className="mt-10">
                        <Button variant="outline" className="w-full h-12 font-bold" onClick={handleCloseWindow}>Sair do Portal</Button>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className={containerClasses}>
            <div className="bg-white border-b border-slate-200 sticky top-0 z-50 px-6 py-4 shadow-sm flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                    {institution?.logoUrl && <img src={institution.logoUrl} className="h-8 w-auto hidden md:block" />}
                    <div>
                        <h1 className="font-black text-slate-800 text-base md:text-lg truncate max-w-[200px] md:max-w-[400px]">{exam?.title}</h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{currentAttempt?.studentName}</p>
                    </div>
                </div>
                {timeLeft !== null && (
                    <div className={`font-mono font-black text-xl md:text-2xl px-4 py-1.5 rounded-xl border-2 transition-all ${timeLeft < 120 ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' : 'bg-slate-50 text-slate-800 border-slate-200 shadow-inner'}`}>
                        {formatTime(timeLeft)}
                    </div>
                )}
            </div>

            <div className="max-w-3xl w-full mx-auto p-4 md:p-8 space-y-10 flex-1">
                {randomizedQuestions.map((q, idx) => (
                    <div key={q.id} className="bg-white p-6 md:p-10 rounded-3xl shadow-sm border border-slate-200 transition-all hover:shadow-md">
                        <div className="flex gap-4 mb-8">
                            <span className="bg-slate-800 text-white font-black w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg shadow-lg border-2 border-white ring-1 ring-slate-100">{idx + 1}</span>
                            <div className="prose prose-slate max-w-none text-slate-800 pt-1 font-bold text-lg leading-relaxed rich-text-content" dangerouslySetInnerHTML={{__html: q.enunciado}} />
                        </div>

                        <div className="md:ml-14">
                            {q.type === QuestionType.MULTIPLE_CHOICE && Array.isArray(q.options) && (
                                <div className="space-y-4">
                                    {q.options.map((opt, oIdx) => (
                                        <label key={opt.id} className={`flex items-center gap-4 p-5 rounded-2xl border-2 cursor-pointer transition-all ${answers[q.id] === opt.id ? 'border-brand-blue bg-blue-50/50 shadow-md ring-1 ring-brand-blue' : 'border-slate-50 hover:bg-slate-50/80'}`}>
                                            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-black text-sm transition-colors ${answers[q.id] === opt.id ? 'border-brand-blue bg-brand-blue text-white shadow-sm' : 'border-slate-300 bg-white text-slate-400'}`}>
                                                {String.fromCharCode(65 + oIdx)}
                                            </div>
                                            <input type="radio" name={q.id} value={opt.id} checked={answers[q.id] === opt.id} onChange={() => handleAnswer(q.id, opt.id)} className="hidden" />
                                            <span className="text-base text-slate-700 font-bold flex-1">{opt.text}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                            {(q.type === QuestionType.SHORT_ANSWER || q.type === QuestionType.NUMERIC) && (
                                <div className="relative">
                                    <textarea 
                                        className="w-full border-2 border-slate-100 rounded-2xl p-5 text-lg font-bold focus:ring-4 focus:ring-blue-100 outline-none bg-slate-50/30 transition-all focus:bg-white focus:border-brand-blue shadow-inner placeholder-slate-300" 
                                        placeholder="Digite sua resposta aqui..." 
                                        rows={4} 
                                        value={answers[q.id] || ''} 
                                        onChange={e => handleAnswer(q.id, e.target.value)} 
                                    />
                                    <div className="absolute top-4 right-4 text-slate-200">
                                        <Icons.Edit />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                
                <div className="pt-12 pb-32">
                    <Button onClick={handleSubmit} className="w-full justify-center py-6 text-2xl font-black shadow-2xl shadow-blue-500/30 hover:scale-[1.01] transform transition-all bg-brand-blue rounded-3xl active:scale-95">
                        <Icons.Check /> FINALIZAR E ENVIAR RESPOSTAS
                    </Button>
                    <p className="text-center text-slate-400 text-xs mt-6 font-bold uppercase tracking-widest">Verifique todas as questões antes de enviar.</p>
                </div>
            </div>
            
            {/* Footer de Progresso (Mobile Friendly) */}
            <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-100 p-3 md:hidden flex justify-between items-center z-40">
                <span className="text-[10px] font-black text-slate-400 uppercase">Respondidas: {Object.keys(answers).length} / {Array.isArray(exam?.questions) ? exam?.questions.length : 0}</span>
                <div className="w-32 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-blue" style={{ width: `${(Object.keys(answers).length / (Array.isArray(exam?.questions) ? exam?.questions.length : 1)) * 100}%` }}></div>
                </div>
            </div>
        </div>
    );
};

export default PublicExam;
