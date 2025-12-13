
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
            setAttempts(a.sort((x, y) => new Date(y.submittedAt || '').getTime() - new Date(x.submittedAt || '').getTime()));
            setLoading(false);
        };
        loadData();
    }, [state, navigate]);

    if (loading) return <div className="p-8 flex justify-center">Carregando resultados...</div>;

    const averageScore = attempts.length > 0 
        ? (attempts.reduce((acc, curr) => acc + curr.score, 0) / attempts.length).toFixed(1) 
        : '0';

    return (
        <div className="p-8 h-full flex flex-col bg-slate-50 overflow-y-auto custom-scrollbar">
            <div className="mb-6 flex justify-between items-start">
                <div>
                    <button onClick={() => navigate('/exams')} className="text-slate-400 hover:text-slate-600 flex items-center gap-1 text-sm mb-2"><Icons.ArrowLeft /> Voltar</button>
                    <h2 className="text-3xl font-display font-bold text-slate-800">Resultados: {exam?.title}</h2>
                    <p className="text-slate-500">Acompanhe o desempenho da turma em tempo real.</p>
                </div>
                <div className="flex gap-4">
                    <Card className="px-6 py-3 bg-white border border-slate-200 text-center">
                        <p className="text-xs text-slate-500 uppercase font-bold">Entregues</p>
                        <p className="text-2xl font-bold text-slate-800">{attempts.length}</p>
                    </Card>
                    <Card className="px-6 py-3 bg-white border border-slate-200 text-center">
                        <p className="text-xs text-slate-500 uppercase font-bold">Média da Turma</p>
                        <p className="text-2xl font-bold text-brand-blue">{averageScore}</p>
                    </Card>
                </div>
            </div>

            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase text-xs">
                            <tr>
                                <th className="p-4">Aluno</th>
                                <th className="p-4">Identificação</th>
                                <th className="p-4">Data Envio</th>
                                <th className="p-4">Nota (Automática)</th>
                                <th className="p-4">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {attempts.length === 0 ? (
                                <tr><td colSpan={5} className="p-8 text-center text-slate-400">Nenhuma resposta recebida ainda.</td></tr>
                            ) : (
                                attempts.map(attempt => (
                                    <tr key={attempt.id} className="hover:bg-slate-50">
                                        <td className="p-4 font-medium text-slate-800">{attempt.studentName}</td>
                                        <td className="p-4 text-slate-500">{attempt.studentIdentifier || '-'}</td>
                                        <td className="p-4 text-slate-500">
                                            {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : 'Em andamento'}
                                        </td>
                                        <td className="p-4">
                                            <span className="font-bold text-lg">{attempt.score}</span> <span className="text-slate-400">/ {attempt.totalQuestions}</span>
                                        </td>
                                        <td className="p-4">
                                            {attempt.status === 'COMPLETED' 
                                                ? <Badge color="green">Finalizado</Badge> 
                                                : <Badge color="yellow">Em Progresso</Badge>}
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
