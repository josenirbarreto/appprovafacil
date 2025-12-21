
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
    
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [manualStudentName, setManualStudentName] = useState('');
    const [studentIdInput, setStudentIdInput] = useState('');
    
    const [currentAttempt, setCurrentAttempt] = useState<ExamAttempt | null>(null);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [randomizedQuestions, setRandomizedQuestions] = useState<Question[]>([]);

    useEffect(() => {
        const loadExam = async () => {
            if (!examId) return;
            try {
                const data = await FirebaseService.getExamById(examId);
                if (!data) { setError('Prova não encontrada.'); } 
                else if (!data.publicConfig?.isPublished) { setError('Esta prova não está mais disponível.'); } 
                else {
                    const now = new Date();
                    const start = new Date(data.publicConfig.startDate);
                    const end = new Date(data.publicConfig.endDate);
                    if (now < start) setError(`Disponível em ${start.toLocaleString()}`);
                    else if (now > end) setError('Prazo encerrado.');
                    else {
                        setExam(data);
                        if (data.institutionId) {
                            const inst = await FirebaseService.getInstitutionById(data.institutionId);
                            setInstitution(inst);
                        }
                        if (data.classId) {
                            const students = await FirebaseService.getStudents(data.classId);
                            setClassStudents(Array.isArray(students) ? students : []);
                        }
                    }
                }
            } catch (err) { setError('Erro ao carregar prova.'); } finally { setLoading(false); }
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
        const m = Math.floor(seconds / 60); const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const handleStart = async () => {
        if (!exam) return;
        let name = '', identifier = '', sid = undefined;

        if (classStudents.length > 0) {
            if (!selectedStudentId) return alert('Selecione seu nome.');
            const student = classStudents.find(s => s.id === selectedStudentId);
            if (!student) return;
            name = student.name; identifier = student.registration; sid = student.id;
        } else {
            if (!manualStudentName) return alert('Informe seu nome.');
            name = manualStudentName; identifier = studentIdInput || name.toLowerCase().replace(/\s/g, '');
        }

        try {
            const previousAttempts = await FirebaseService.getStudentAttempts(exam.id, identifier);
            const allowed = Number(exam.publicConfig?.allowedAttempts) || 1;
            if (previousAttempts.length >= allowed) return alert(`Limite atingido.`);

            let questionsToUse = Array.isArray(exam.questions) ? [...exam.questions] : [];
            
            if (exam.publicConfig?.randomizeQuestions) {
                questionsToUse.sort(() => Math.random() - 0.5);
                questionsToUse = questionsToUse.map(q => {
                    if (q && q.type === QuestionType.MULTIPLE_CHOICE && Array.isArray(q.options)) {
                        return { ...q, options: [...q.options].sort(() => Math.random() - 0.5) };
                    }
                    return q;
                });
            }
            setRandomizedQuestions(questionsToUse.filter(Boolean));

            const attempt = await FirebaseService.startAttempt(exam.id, name, identifier, questionsToUse.length, sid);
            setCurrentAttempt(attempt);
            if (exam.publicConfig?.timeLimitMinutes) setTimeLeft(exam.publicConfig.timeLimitMinutes * 60);
            setStep('TAKING');
        } catch (err) { alert("Erro ao iniciar."); }
    };

    const handleAnswer = (qId: string, val: string) => setAnswers(prev => ({ ...prev, [qId]: val }));

    const handleSubmit = async () => {
        if (!currentAttempt || !exam) return;
        let finalScore = 0;
        randomizedQuestions.forEach(q => {
            const answer = answers[q.id]; if (!answer) return;
            if (q.type === QuestionType.MULTIPLE_CHOICE || q.type === QuestionType.TRUE_FALSE) {
                const correctOpt = Array.isArray(q.options) ? q.options.find(o => o.isCorrect) : null;
                if (correctOpt && (correctOpt.id === answer || correctOpt.text === answer)) finalScore++;
            } else if (q.type === QuestionType.NUMERIC) {
                const correctVal = Array.isArray(q.options) ? q.options[0]?.text : '';
                if (parseFloat(answer) === parseFloat(correctVal || '0')) finalScore++;
            }
        });
        setCurrentAttempt(prev => prev ? { ...prev, score: finalScore, answers, status: 'COMPLETED' } : null);
        await FirebaseService.submitAttempt(currentAttempt.id, answers, finalScore, Array.isArray(exam.questions) ? exam.questions.length : 0);
        setStep('FINISHED');
    };

    if (loading) return <div className="fixed inset-0 flex items-center justify-center bg-slate-50 font-black uppercase text-slate-400">Iniciando...</div>;
    if (error) return <div className="fixed inset-0 flex items-center justify-center p-4 bg-slate-50"><Card className="max-w-md text-center py-10 border-t-4 border-red-500"><h2 className="text-xl font-bold mb-4">{error}</h2><Button onClick={() => window.location.reload()}>Tentar Novamente</Button></Card></div>;

    const containerClasses = "fixed inset-0 z-50 bg-slate-50 flex flex-col overflow-y-auto custom-scrollbar";

    if (step === 'WELCOME') {
        return (
            <div className={`${containerClasses} items-center p-4 py-12`}>
                <Card className="max-w-lg w-full shadow-2xl border-t-8 border-brand-blue p-8 text-center">
                    {institution?.logoUrl && <img src={institution.logoUrl} className="h-16 mx-auto mb-6" />}
                    <h1 className="text-3xl font-black mb-4">{exam?.title || "Prova"}</h1>
                    <div className="bg-slate-50 p-4 rounded-xl mb-8 flex justify-around text-xs font-black uppercase">
                        <div><p className="text-slate-400">Tempo</p><p>{exam?.publicConfig?.timeLimitMinutes ? `${exam.publicConfig.timeLimitMinutes}m` : 'Livre'}</p></div>
                        <div><p className="text-slate-400">Questões</p><p>{Array.isArray(exam?.questions) ? exam.questions.length : 0}</p></div>
                    </div>
                    {classStudents.length > 0 ? (
                        <Select value={selectedStudentId} onChange={e => setSelectedStudentId(e.target.value)} className="h-14 font-bold"><option value="">Selecione seu nome...</option>{classStudents.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
                    ) : (
                        <div className="space-y-4"><Input label="Seu Nome Completo" value={manualStudentName} onChange={e => setManualStudentName(e.target.value)} /><Input label="Identificação (Opcional)" value={studentIdInput} onChange={e => setStudentIdInput(e.target.value)} /></div>
                    )}
                    <Button onClick={handleStart} className="w-full h-16 text-xl font-black mt-8 shadow-xl">ACESSAR PROVA</Button>
                </Card>
            </div>
        );
    }

    if (step === 'FINISHED') {
        return (
            <div className={`${containerClasses} items-center justify-center p-4`}>
                <Card className="max-w-md w-full text-center py-12 border-t-8 border-green-500 animate-fade-in">
                    <div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6"><Icons.Check /></div>
                    <h2 className="text-3xl font-black mb-2">Concluído!</h2>
                    {exam?.publicConfig?.showFeedback && currentAttempt && (
                        <div className="bg-blue-50 p-6 rounded-2xl mt-6"><p className="text-xs font-black text-slate-400 uppercase">Sua Nota</p><p className="text-5xl font-black text-brand-blue">{currentAttempt.score} / {currentAttempt.totalQuestions}</p></div>
                    )}
                    <Button variant="outline" className="mt-8 w-full" onClick={() => window.location.href = "/"}>Sair</Button>
                </Card>
            </div>
        );
    }

    return (
        <div className={containerClasses}>
            <div className="bg-white border-b sticky top-0 z-50 px-6 py-4 flex justify-between items-center shadow-sm">
                <h1 className="font-black text-lg truncate max-w-xs">{exam?.title}</h1>
                {timeLeft !== null && <div className={`font-mono font-black text-2xl ${timeLeft < 60 ? 'text-red-600 animate-pulse' : ''}`}>{formatTime(timeLeft)}</div>}
            </div>
            <div className="max-w-3xl w-full mx-auto p-4 space-y-10 pb-40">
                {randomizedQuestions.map((q, idx) => (
                    <div key={q.id} className="bg-white p-8 rounded-3xl border shadow-sm transition-all hover:shadow-md">
                        <div className="flex gap-4 mb-6">
                            <span className="bg-slate-800 text-white font-black w-10 h-10 rounded-xl flex items-center justify-center shrink-0">{idx + 1}</span>
                            <div className="text-lg font-bold leading-relaxed pt-1" dangerouslySetInnerHTML={{__html: q.enunciado}} />
                        </div>
                        <div className="md:ml-14 space-y-3">
                            {q.type === QuestionType.MULTIPLE_CHOICE && Array.isArray(q.options) && q.options.map((opt, oIdx) => (
                                <label key={opt.id} className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${answers[q.id] === opt.id ? 'border-brand-blue bg-blue-50' : 'hover:bg-slate-50'}`}>
                                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-black text-sm ${answers[q.id] === opt.id ? 'bg-brand-blue border-brand-blue text-white' : 'text-slate-400'}`}>{String.fromCharCode(65+oIdx)}</div>
                                    <input type="radio" checked={answers[q.id] === opt.id} onChange={() => handleAnswer(q.id, opt.id)} className="hidden" />
                                    <span className="font-bold text-slate-700">{opt.text}</span>
                                </label>
                            ))}
                            {(q.type === QuestionType.SHORT_ANSWER || q.type === QuestionType.NUMERIC) && <textarea className="w-full border-2 rounded-xl p-4 font-bold outline-none focus:border-brand-blue shadow-inner" placeholder="Sua resposta..." rows={3} value={answers[q.id] || ''} onChange={e => handleAnswer(q.id, e.target.value)} />}
                        </div>
                    </div>
                ))}
                <Button onClick={handleSubmit} className="w-full h-16 text-2xl font-black shadow-2xl">FINALIZAR E ENVIAR</Button>
            </div>
        </div>
    );
};

export default PublicExam;
