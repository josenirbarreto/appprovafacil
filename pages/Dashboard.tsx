import React, { useState, useEffect } from 'react';
import { Card, Badge, Button } from '../components/UI';
import { Icons } from '../components/Icons';
import { SimpleBarChart, SimpleDonutChart } from '../components/Charts';
import { FirebaseService } from '../services/firebaseService';
import { Exam, Question, SchoolClass, Discipline, Institution, QuestionType } from '../types';
import { Link } from 'react-router-dom';

const Dashboard = () => {
    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState({
        totalExams: 0,
        totalQuestions: 0,
        totalClasses: 0,
        totalInstitutions: 0,
        questionsByDifficulty: [] as { label: string, value: number, color: string }[],
        questionsByType: [] as { label: string, value: number, color: string }[],
        questionsByDiscipline: [] as { label: string, value: number, color: string }[],
        recentExams: [] as (Exam & { className?: string, institutionName?: string })[]
    });

    useEffect(() => {
        const loadStats = async () => {
            try {
                const [exams, questions, classes, institutions, disciplines] = await Promise.all([
                    FirebaseService.getExams(),
                    FirebaseService.getQuestions(),
                    FirebaseService.getClasses(),
                    FirebaseService.getInstitutions(),
                    FirebaseService.getHierarchy()
                ]);

                // 1. Totais Básicos
                const totalExams = exams.length;
                const totalQuestions = questions.length;
                const totalClasses = classes.length;
                const totalInstitutions = institutions.length;

                // 2. Questões por Dificuldade
                const diffCount = { Easy: 0, Medium: 0, Hard: 0 };
                questions.forEach(q => {
                    if (q.difficulty in diffCount) diffCount[q.difficulty as keyof typeof diffCount]++;
                });
                const questionsByDifficulty = [
                    { label: 'Fácil', value: diffCount.Easy, color: '#4ade80' },   // Green
                    { label: 'Médio', value: diffCount.Medium, color: '#facc15' }, // Yellow
                    { label: 'Difícil', value: diffCount.Hard, color: '#f87171' }  // Red
                ].filter(d => d.value > 0);

                // 3. Questões por Tipo
                const typeLabels: Record<string, string> = {
                    [QuestionType.MULTIPLE_CHOICE]: 'Múltipla Escolha',
                    [QuestionType.TRUE_FALSE]: 'V/F',
                    [QuestionType.SHORT_ANSWER]: 'Dissertativa',
                    [QuestionType.NUMERIC]: 'Numérica',
                    [QuestionType.ASSOCIATION]: 'Associação'
                };
                const typeCount: Record<string, number> = {};
                questions.forEach(q => {
                    const type = q.type;
                    typeCount[type] = (typeCount[type] || 0) + 1;
                });
                const typeColors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6'];
                const questionsByType = Object.entries(typeCount).map(([type, count], index) => ({
                    label: typeLabels[type] || type,
                    value: count,
                    color: typeColors[index % typeColors.length]
                }));

                // 4. Questões por Disciplina (Top 5)
                const discCount: Record<string, number> = {};
                questions.forEach(q => {
                    const discName = disciplines.find(d => d.id === q.disciplineId)?.name || 'Sem Disciplina';
                    discCount[discName] = (discCount[discName] || 0) + 1;
                });
                const questionsByDiscipline = Object.entries(discCount)
                    .map(([name, count], index) => ({
                        label: name,
                        value: count,
                        color: ['#3A72EC', '#22c55e', '#a855f7', '#f59e0b', '#ef4444'][index % 5]
                    }))
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 5); // Pegar apenas as top 5 disciplinas

                // 5. Provas Recentes (Top 5)
                const sortedExams = [...exams].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);
                const recentExams = sortedExams.map(e => ({
                    ...e,
                    className: classes.find(c => c.id === e.classId)?.name,
                    institutionName: institutions.find(i => i.id === e.institutionId)?.name
                }));

                setMetrics({
                    totalExams,
                    totalQuestions,
                    totalClasses,
                    totalInstitutions,
                    questionsByDifficulty,
                    questionsByType,
                    questionsByDiscipline,
                    recentExams
                });
            } catch (error) {
                console.error("Erro ao calcular métricas:", error);
            } finally {
                setLoading(false);
            }
        };

        loadStats();
    }, []);

    if (loading) {
        return (
            <div className="p-8 h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-slate-400">
                    <div className="w-8 h-8 border-4 border-slate-200 border-t-brand-blue rounded-full animate-spin"></div>
                    <p>Carregando estatísticas...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 overflow-y-auto custom-scrollbar h-full bg-slate-50">
            <div className="mb-8">
                <h2 className="text-3xl font-display font-bold text-slate-800">Dashboard</h2>
                <p className="text-slate-500">Visão geral do seu banco de questões e avaliações.</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                 <Card className="flex items-center gap-4 border-l-4 border-l-blue-500">
                     <div className="w-12 h-12 rounded-full bg-blue-50 text-brand-blue flex items-center justify-center shrink-0"><Icons.Exams /></div>
                     <div>
                         <p className="text-2xl font-bold text-slate-800">{metrics.totalExams}</p>
                         <p className="text-sm text-slate-500 font-medium">Provas Criadas</p>
                     </div>
                 </Card>
                 <Card className="flex items-center gap-4 border-l-4 border-l-green-500">
                     <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center shrink-0"><Icons.Questions /></div>
                     <div>
                         <p className="text-2xl font-bold text-slate-800">{metrics.totalQuestions}</p>
                         <p className="text-sm text-slate-500 font-medium">Questões Totais</p>
                     </div>
                 </Card>
                 <Card className="flex items-center gap-4 border-l-4 border-l-purple-500">
                     <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center shrink-0"><Icons.UsersGroup /></div>
                     <div>
                         <p className="text-2xl font-bold text-slate-800">{metrics.totalClasses}</p>
                         <p className="text-sm text-slate-500 font-medium">Turmas Ativas</p>
                     </div>
                 </Card>
                 <Card className="flex items-center gap-4 border-l-4 border-l-orange-500">
                     <div className="w-12 h-12 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0"><Icons.Building /></div>
                     <div>
                         <p className="text-2xl font-bold text-slate-800">{metrics.totalInstitutions}</p>
                         <p className="text-sm text-slate-500 font-medium">Instituições</p>
                     </div>
                 </Card>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                {/* Distribuição por Disciplina */}
                <div className="lg:col-span-2">
                    <Card title="Questões por Disciplina (Top 5)" className="h-full min-h-[320px]">
                        {metrics.questionsByDiscipline.length > 0 ? (
                            <SimpleBarChart data={metrics.questionsByDiscipline} />
                        ) : (
                            <div className="h-40 flex items-center justify-center text-slate-400 italic">Nenhuma questão cadastrada.</div>
                        )}
                    </Card>
                </div>

                {/* Distribuição por Dificuldade */}
                <div>
                    <Card title="Dificuldade das Questões" className="h-full min-h-[320px] flex flex-col items-center justify-center">
                        {metrics.questionsByDifficulty.length > 0 ? (
                             <SimpleDonutChart data={metrics.questionsByDifficulty} />
                        ) : (
                             <div className="text-slate-400 italic">Dados insuficientes.</div>
                        )}
                    </Card>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 {/* Tipos de Questão */}
                 <Card title="Tipos de Questão" className="min-h-[300px]">
                    <div className="flex flex-col gap-4 mt-4">
                        {metrics.questionsByType.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></span>
                                    <span className="text-sm font-medium text-slate-700">{item.label}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full" style={{ width: `${(item.value / metrics.totalQuestions) * 100}%`, backgroundColor: item.color }}></div>
                                    </div>
                                    <span className="text-sm font-bold text-slate-800 min-w-[2rem] text-right">{item.value}</span>
                                </div>
                            </div>
                        ))}
                        {metrics.questionsByType.length === 0 && <div className="text-center text-slate-400 py-8">Nenhuma questão cadastrada.</div>}
                    </div>
                 </Card>

                 {/* Últimas Provas */}
                 <Card title="Provas Recentes" className="min-h-[300px]">
                    <div className="space-y-4 mt-2">
                        {metrics.recentExams.length === 0 ? (
                            <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-100 rounded-lg">
                                Nenhuma prova criada recentemente.
                                <div className="mt-4">
                                    <Link to="/exams"><Button variant="outline" className="text-xs">Criar Prova</Button></Link>
                                </div>
                            </div>
                        ) : (
                            metrics.recentExams.map(exam => (
                                <div key={exam.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100 group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-blue-50 text-brand-blue rounded-lg flex items-center justify-center font-bold text-lg">
                                            {exam.questions.length}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 text-sm">{exam.title}</h4>
                                            <p className="text-xs text-slate-500">
                                                {exam.className || 'Sem turma'} • {new Date(exam.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <Badge color={exam.showAnswerKey ? 'green' : 'blue'}>
                                        {exam.showAnswerKey ? 'Gabarito ON' : 'Gabarito OFF'}
                                    </Badge>
                                </div>
                            ))
                        )}
                        {metrics.recentExams.length > 0 && (
                            <div className="pt-4 text-center border-t border-slate-50">
                                <Link to="/exams" className="text-sm text-brand-blue hover:underline font-medium">Ver todas as provas</Link>
                            </div>
                        )}
                    </div>
                 </Card>
            </div>
        </div>
    );
};

export default Dashboard;