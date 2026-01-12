
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
                setLoading(true);
                const data = await FirebaseService.getExamById(examId);
                if (!data) { 
                    setError('Avaliação não localizada. Verifique o link fornecido pelo professor.'); 
                    return;
                } 
                
                if (!data.publicConfig?.isPublished) { 
                    setError('Esta avaliação não está mais disponível para acesso online.'); 
                    return;
                } 

                const now = new Date();
                const start = new Date(data.publicConfig.startDate);
                const end = new Date(data.publicConfig.endDate);
                
                if (now < start) {
                    setError(`Esta prova ainda não iniciou. Estará disponível em ${start.toLocaleString()}`);
                    return;
                }
                
                if (now > end) {
                    setError('O prazo para realizar esta avaliação já expirou.');
                    return;
                }

                setExam(data);

                // CARGA DE ALUNOS - Crucial para navegadores anônimos
                if (data.classId) {
                    console.log("Tentando carregar lista de alunos para a turma:", data.classId);
                    FirebaseService.getStudents(data.classId)
                        .then(students => {
                            if (Array.isArray(students)) {
                                console.log(`${students.length} alunos carregados.`);
                                setClassStudents(students);
                            }
                        })
                        .catch(err => {
                            console.warn("Acesso público à lista de alunos negado (Verifique as Rules do Firebase):", err);
                        });
                }

                if (data.institutionId) {
                    FirebaseService.getInstitutionById(data.institutionId)
                        .then(setInstitution)
                        .catch(e => console.warn("Erro ao buscar logo da escola."));
                }

            } catch (err) { 
                console.error("Critical Exam Load Error:", err);
                setError('Houve um erro técnico ao carregar a prova. Tente recarregar a página.'); 
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
        const m = Math.floor(seconds / 60); const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const handleStart = async () => {
        if (!exam) return;
        let name = '', identifier = '', sid = undefined;

        if (classStudents.length > 0) {
            if (!selectedStudentId) return alert('Por favor, selecione seu nome na lista.');
            const student = classStudents.find(s => s.id === selectedStudentId);
            if (!student) return;
            name = student.name; identifier = student.registration; sid = student.id;
        } else {
            if (!manualStudentName.trim()) return alert('Informe seu nome completo para iniciar.');
            name = manualStudentName.trim(); identifier = studentIdInput.trim() || name.toLowerCase().replace(/\s/g, '');
        }

        setLoading(true);
        try {
            const previousAttempts = await FirebaseService.getStudentAttempts(exam.id, identifier);
            const allowed = Number(exam.publicConfig?.allowedAttempts) || 1;
            if (previousAttempts.length >= allowed) {
                setLoading(false);
                return alert(`Você já realizou esta prova anteriormente. Limite de tentativas: ${allowed}`);
            }

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
            if (!attempt.id) throw new Error("Falha ao gerar ID da tentativa.");
            
            setCurrentAttempt(attempt);
            if (exam.publicConfig?.timeLimitMinutes) setTimeLeft(exam.publicConfig.timeLimitMinutes * 60);
            setStep('TAKING');
        } catch (err) { 
            console.error(err);
            alert("Erro ao iniciar a sessão. Verifique sua conexão."); 
        } finally {
            setLoading(false);
        }
    };

    const handleAnswer = (qId: string, val: string) => setAnswers(prev => ({ ...prev, [qId]: val }));

    const handleSubmit = async () => {
        if (!currentAttempt || !currentAttempt.id || !exam) return;
        
        setLoading(true);
        try {
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
            
            await FirebaseService.submitAttempt(currentAttempt.id, answers, finalScore, Array.isArray(exam.questions) ? exam.questions.length : 0);
            
            setCurrentAttempt(prev => prev ? { ...prev, score: finalScore, answers, status: 'COMPLETED' } : null);
            setStep('FINISHED');
        } catch (err) {
            console.error(err);
            alert("Erro ao enviar suas respostas. Tente clicar em Enviar novamente.");
        } finally {
            setLoading(false);
        }
    };

    if (loading && step === 'WELCOME') return <div className="fixed inset-0 flex items-center justify-center bg-slate-50 font-black uppercase text-slate-400">Iniciando sessão...</div>;
    if (error) return <div className="fixed inset-0 flex items-center justify-center p-4 bg-slate-50"><Card className="max-w-md text-center py-10 border-t-8 border-red-500 shadow-xl"><h2 className="text-xl font-bold mb-4 text-slate-800">{error}</h2><Button onClick={() => window.location.reload()}>Recarregar Página</Button></Card></div>;

    const containerClasses = "fixed inset-0 z-50 bg-slate-50 flex flex-col overflow-y-auto custom-scrollbar";

    if (step === 'WELCOME') {
        return (
            <div className={`${containerClasses} items-center p-4 py-12`}>
                <Card className="max-w-lg w-full shadow-2xl border-t-8 border-brand-blue p-8 text-center">
                    {institution?.logoUrl && <img src={institution.logoUrl} className="h-16 mx-auto mb-6 object-contain" />}
                    <h1 className="text-3xl font-black mb-4 text-slate-800">{exam?.title || "Avaliação Online"}</h1>
                    <div className="bg-slate-50 p-4 rounded-xl mb-8 flex justify-around text-xs font-black uppercase">
                        <div><p className="text-slate-400">Tempo</p><p className="text-slate-800">{exam?.publicConfig?.timeLimitMinutes ? `${exam.publicConfig.timeLimitMinutes} min` : 'Livre'}</p></div>
                        <div><p className="text-slate-400">Itens</p><p className="text-slate-800">{Array.isArray(exam?.questions) ? exam.questions.length : 0}</p></div>
                    </div>
                    
                    {classStudents.length > 0 ? (
                        <div className="space-y-4 text-left animate-fade-in">
                            <label className="text-[10px] font-black text-slate-500 uppercase px-1">Selecione seu nome da lista oficial:</label>
                            <Select value={selectedStudentId} onChange={e => setSelectedStudentId(e.target.value)} className="h-14 font-bold border-2">
                                <option value="">Procure seu nome...</option>
                                {classStudents.sort((a, b) => a.name.localeCompare(b.name)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </Select>
                            <p className="text-[9px] text-slate-400 text-center uppercase font-bold tracking-widest">OU INFORME SEUS DADOS CASO NÃO ESTEJA NA LISTA</p>
                        </div>
                    ) : null}

                    {(!classStudents.length || selectedStudentId === 'manual') && (
                        <div className="space-y-4 animate-fade-in mt-4">
                            <Input label="Seu Nome Completo" value={manualStudentName} onChange={e => setManualStudentName(e.target.value)} placeholder="Digite como na chamada" />
                            <Input label="Documento / Matrícula (Opcional)" value={studentIdInput} onChange={e => setStudentIdInput(e.target.value)} placeholder="Para identificação" />
                        </div>
                    )}
                    
                    <Button onClick={handleStart} className="w-full h-16 text-xl font-black mt-8 shadow-xl">INICIAR AVALIAÇÃO</Button>
                </Card>
            </div>
        );
    }

    if (step === 'FINISHED') {
        return (
            <div className={`${containerClasses} items-center justify-center p-4`}>
                <Card className="max-w-md w-full text-center py-12 border-t-8 border-green-500 animate-fade-in shadow-2xl">
                    <div className="w-24 h-24 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner"><Icons.Check className="w-12 h-12" /></div>
                    <h2 className="text-3xl font-black mb-2 text-slate-800">Tudo Pronto!</h2>
                    <p className="text-slate-500 font-medium">Suas respostas foram enviadas com sucesso.</p>
                    {exam?.publicConfig?.showFeedback && currentAttempt && (
                        <div className="bg-blue-50 p-6 rounded-[32px] mt-8 border-2 border-blue-100 shadow-sm">
                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Pontuação Provisória</p>
                            <p className="text-6xl font-black text-brand-blue">{currentAttempt.score} <span className="text-2xl text-blue-300">/ {currentAttempt.totalQuestions}</span></p>
                        </div>
                    )}
                    <Button variant="outline" className="mt-10 w-full h-12 font-black" onClick={() => window.location.href = "/"}>SAIR DO SISTEMA</Button>
                </Card>
            </div>
        );
    }

    return (
        <div className={containerClasses}>
            <div className="bg-white border-b sticky top-0 z-50 px-6 py-4 flex justify-between items-center shadow-md">
                <div className="flex items-center gap-3">
                    <Badge color="blue">EM PROGRESSO</Badge>
                    <h1 className="font-black text-slate-700 truncate max-w-xs">{exam?.title}</h1>
                </div>
                {timeLeft !== null && <div className={`font-mono font-black text-3xl px-4 py-1 rounded-xl bg-slate-50 border-2 ${timeLeft < 60 ? 'text-red-600 border-red-200 animate-pulse' : 'text-slate-800 border-slate-200'}`}>{formatTime(timeLeft)}</div>}
            </div>
            <div className="max-w-3xl w-full mx-auto p-4 space-y-10 pb-40 mt-6">
                {randomizedQuestions.map((q, idx) => (
                    <div key={q.id} className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm transition-all hover:shadow-lg group">
                        <div className="flex gap-5 mb-8">
                            <span className="bg-slate-800 text-white font-black w-12 h-12 rounded-[18px] flex items-center justify-center shrink-0 text-xl shadow-lg shadow-slate-200 group-hover:scale-110 transition-transform">{idx + 1}</span>
                            <div className="text-xl font-bold leading-relaxed pt-1 text-slate-800 rich-text-content" dangerouslySetInnerHTML={{__html: q.enunciado}} />
                        </div>
                        <div className="md:ml-16 space-y-4">
                            {q.type === QuestionType.MULTIPLE_CHOICE && Array.isArray(q.options) && q.options.map((opt, oIdx) => (
                                <label key={opt.id} className={`flex items-center gap-5 p-5 rounded-[24px] border-2 cursor-pointer transition-all ${answers[q.id] === opt.id ? 'border-brand-blue bg-blue-50/50 shadow-md ring-4 ring-blue-100' : 'border-slate-100 hover:bg-slate-50'}`}>
                                    <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-black text-lg ${answers[q.id] === opt.id ? 'bg-brand-blue border-brand-blue text-white shadow-lg shadow-blue-200' : 'text-slate-400 border-slate-200 bg-white'}`}>{String.fromCharCode(65+oIdx)}</div>
                                    <input type="radio" name={`q-${q.id}`} checked={answers[q.id] === opt.id} onChange={() => handleAnswer(q.id, opt.id)} className="hidden" />
                                    <span className={`font-bold text-lg ${answers[q.id] === opt.id ? 'text-blue-900' : 'text-slate-700'}`}>{opt.text}</span>
                                </label>
                            ))}
                            {(q.type === QuestionType.SHORT_ANSWER || q.type === QuestionType.NUMERIC) && (
                                <textarea 
                                    className="w-full border-2 border-slate-200 rounded-[24px] p-6 text-lg font-bold outline-none focus:border-brand-blue focus:ring-4 focus:ring-blue-100 shadow-inner bg-slate-50 min-h-[150px] transition-all" 
                                    placeholder="Escreva sua resposta com clareza..." 
                                    value={answers[q.id] || ''} 
                                    onChange={e => handleAnswer(q.id, e.target.value)} 
                                />
                            )}
                        </div>
                    </div>
                ))}
                <div className="pt-10">
                    <Button onClick={handleSubmit} disabled={loading} className="w-full h-20 text-3xl font-black shadow-2xl rounded-[32px] hover:scale-[1.02]">
                        {loading ? 'ENVIANDO...' : 'FINALIZAR E ENVIAR'}
                    </Button>
                    <p className="text-center text-slate-400 text-sm mt-6 font-bold uppercase tracking-widest">Confira todas as respostas antes de enviar.</p>
                </div>
            </div>
        </div>
    );
};

export default PublicExam;
