
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FirebaseService } from '../services/firebaseService';
import { Exam, ExamAttempt } from '../types';
import { Button, Card, Badge } from '../components/UI';
import { Icons } from '../components/Icons';

const ExamResults = () => {
    const { state } = useLocation(); // Receives examId
    const navigate = useNavigate();
    const [exam, setExam] = useState<Exam | null>(null);
    const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!state?.examId) {
            navigate('/exams');
            return;
        }
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
        loadData();
    }, [state, navigate]);

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
                    <p className="text-slate-500">Acompanhe o desempenho da turma em tempo real.</p>
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
                                <th className="hidden print:table-cell p-2">Assinatura</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 print:divide-gray-300">
                            {attempts.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-slate-400">Nenhuma resposta recebida ainda.</td></tr>
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
                                        <td className="hidden print:table-cell p-2 border-b border-gray-100 w-48">
                                            
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default ExamResults;
