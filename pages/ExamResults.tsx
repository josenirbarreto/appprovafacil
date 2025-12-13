
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FirebaseService } from '../services/firebaseService';
import { Exam, ExamAttempt, QuestionType } from '../types';
import { Button, Card, Badge, Modal, Input } from '../components/UI';
import { Icons } from '../components/Icons';

const ExamResults = () => {
    const { state } = useLocation(); // Receives examId
    const navigate = useNavigate();
    const [exam, setExam] = useState<Exam | null>(null);
    const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Grading State
    const [selectedAttempt, setSelectedAttempt] = useState<ExamAttempt | null>(null);
    const [editingScore, setEditingScore] = useState<number>(0);
    const [isGradingModalOpen, setIsGradingModalOpen] = useState(false);

    useEffect(() => {
        if (!state?.examId) {
            navigate('/exams');
            return;
        }
        loadData();
    }, [state, navigate]);

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
            <div className="mb-6 flex justify-between items-start print:hidden">
                <div>
                    <button onClick={() => navigate('/exams')} className="text-slate-400 hover:text-slate-600 flex items-center gap-1 text-sm mb-2">
                        <Icons.ArrowLeft /> Voltar
                    </button>
                    <h2 className="text-3xl font-display font-bold text-slate-800">Resultados: {exam?.title}</h2>
                    <p className="text-slate-500">Clique na lupa para visualizar e corrigir provas manualmente.</p>
                </div>
                <div className="flex gap-4 items-center">
                    <Card className="px-6 py-3 bg-white border border-slate-200 text-center">
                        <p className="text-xs text-slate-500 uppercase font-bold">Entregues</p>
                        <p className="text-2xl font-bold text-slate-800">{attempts.length}</p>
                    </Card>
                    <Card className="px-6 py-3 bg-white border border-slate-200 text-center">
                        <p className="text-xs text-slate-500 uppercase font-bold">Média da Turma</p>
                        <p className="text-2xl font-bold text-brand-blue">{averageScore}</p>
                    </Card>
                    <div className="h-10 w-px bg-slate-300 mx-2"></div>
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
        </div>
    );
};

export default ExamResults;
