
import React, { useState, useEffect, useMemo } from 'react';
import { Card, Badge, Button } from '../components/UI';
import { Icons } from '../components/Icons';
import { SimpleBarChart, SimpleDonutChart } from '../components/Charts';
import { FirebaseService } from '../services/firebaseService';
import { Exam, Question, SchoolClass, Discipline, Institution, QuestionType, User, UserRole, ExamAttempt, CurricularComponent } from '../types';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Dashboard = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState({
        exams: [] as Exam[],
        questions: [] as Question[],
        classes: [] as SchoolClass[],
        institutions: [] as Institution[],
        hierarchy: [] as CurricularComponent[],
        users: [] as User[],
        allAttempts: [] as ExamAttempt[]
    });

    const isAdmin = user?.role === UserRole.ADMIN;
    const isManager = user?.role === UserRole.MANAGER;

    useEffect(() => {
        if (!user) return;
        const loadAllData = async () => {
            try {
                const [exams, questions, classes, institutions, hierarchy, users] = await Promise.all([
                    FirebaseService.getExams(user),
                    FirebaseService.getQuestions(user),
                    FirebaseService.getClasses(user),
                    FirebaseService.getInstitutions(user),
                    FirebaseService.getHierarchy(),
                    FirebaseService.getUsers(user)
                ]);

                const attemptsPromises = (Array.isArray(exams) ? exams : []).map(e => FirebaseService.getExamResults(e.id));
                const attemptsArrays = await Promise.all(attemptsPromises);
                const allAttempts = attemptsArrays.flat();

                setData({
                    exams: Array.isArray(exams) ? exams : [],
                    questions: Array.isArray(questions) ? questions : [],
                    classes: Array.isArray(classes) ? classes : [],
                    institutions: Array.isArray(institutions) ? institutions : [],
                    hierarchy: Array.isArray(hierarchy) ? hierarchy : [],
                    users: Array.isArray(users) ? users : [],
                    allAttempts: Array.isArray(allAttempts) ? allAttempts : []
                });
            } catch (error) {
                console.error("Erro ao carregar dados do dashboard:", error);
            } finally {
                setLoading(false);
            }
        };

        loadAllData();
    }, [user]);

    // Otimização: Mapas de lookup
    const classesMap = useMemo(() => new Map(data.classes.map(c => [c.id, c])), [data.classes]);
    const examsMap = useMemo(() => new Map(data.exams.map(e => [e.id, e])), [data.exams]);

    // 1. Desempenho por Turma
    const classPerformance = useMemo(() => {
        const performanceMap: Record<string, { totalScore: number, totalQuestions: number, count: number, name: string }> = {};
        
        data.classes.forEach(c => {
            performanceMap[c.id] = { totalScore: 0, totalQuestions: 0, count: 0, name: c.name };
        });

        data.allAttempts.forEach(att => {
            const exam = examsMap.get(att.examId);
            if (exam && exam.classId && performanceMap[exam.classId]) {
                performanceMap[exam.classId].totalScore += att.score;
                performanceMap[exam.classId].totalQuestions += att.totalQuestions;
                performanceMap[exam.classId].count += 1;
            }
        });

        return Object.values(performanceMap)
            .filter(v => v.count > 0)
            .map(v => ({
                label: v.name,
                value: Number(((v.totalScore / Math.max(1, v.totalQuestions)) * 100).toFixed(1)) || 0,
                color: '#3A72EC'
            }))
            .sort((a, b) => b.value - a.value);
    }, [data.classes, data.allAttempts, examsMap]);

    // 2. Ranking de Engajamento
    const teacherEngagement = useMemo(() => {
        const teachers = data.users.filter(u => u.role === UserRole.TEACHER);
        return teachers.map(t => {
            const qCount = data.questions.filter(q => q.authorId === t.id).length;
            const eCount = data.exams.filter(e => e.authorId === t.id).length;
            return {
                id: t.id,
                name: t.name,
                photoUrl: t.photoUrl,
                questions: qCount,
                exams: eCount,
                score: (qCount * 2) + (eCount * 10)
            };
        }).sort((a, b) => b.score - a.score).slice(0, 5);
    }, [data.users, data.questions, data.exams]);

    // 3. Mapa de Calor por Tópicos
    const contentHeatmap = useMemo(() => {
        const usage: Record<string, { name: string, count: number, discipline: string }> = {};
        
        const topicLookup = new Map<string, { topicName: string, disciplineName: string }>();
        data.hierarchy.forEach(cc => {
            cc.disciplines?.forEach(d => {
                d.chapters?.forEach(c => c.units?.forEach(u => u.topics?.forEach(t => {
                    topicLookup.set(t.id, { topicName: t.name, disciplineName: d.name });
                })));
            });
        });

        data.exams.forEach(ex => {
            const questionsList = Array.isArray(ex.questions) ? ex.questions : [];
            questionsList.forEach(q => {
                if (!q) return;
                const topicId = q.topicId || 'unclassified';
                if (!usage[topicId]) {
                    const lookup = topicLookup.get(topicId);
                    usage[topicId] = { 
                        name: lookup?.topicName || 'Não Classificado', 
                        count: 0, 
                        discipline: lookup?.disciplineName || 'Geral'
                    };
                }
                usage[topicId].count++;
            });
        });

        const sorted = Object.values(usage).sort((a, b) => b.count - a.count);
        return {
            top: sorted.slice(0, 5),
            forgotten: [...sorted].reverse().slice(0, 5)
        };
    }, [data.exams, data.hierarchy]);

    if (loading) {
        return (
            <div className="p-8 h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-slate-400">
                    <div className="w-8 h-8 border-4 border-slate-200 border-t-brand-blue rounded-full animate-spin"></div>
                    <p className="font-bold">Gerando BI Escolar...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 overflow-y-auto custom-scrollbar h-full bg-slate-50">
            <div className="mb-8 flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-display font-bold text-slate-800">BI Institucional</h2>
                    <p className="text-slate-500">Monitoramento pedagógico e engajamento da unidade.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <Card className="border-l-4 border-l-blue-500">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Média Institucional</p>
                    <p className="text-3xl font-black text-slate-800">
                        {data.allAttempts.length > 0 
                            ? (data.allAttempts.reduce((acc, curr) => acc + (curr.score / Math.max(1, curr.totalQuestions)), 0) / data.allAttempts.length * 100).toFixed(1)
                            : '0'}%
                    </p>
                </Card>
                <Card className="border-l-4 border-l-emerald-500">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Provas Aplicadas</p>
                    <p className="text-3xl font-black text-slate-800">{data.exams.length}</p>
                </Card>
                <Card className="border-l-4 border-l-orange-500">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Questões Criadas</p>
                    <p className="text-3xl font-black text-slate-800">{data.questions.length}</p>
                </Card>
                <Card className="border-l-4 border-l-purple-500">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Professores Ativos</p>
                    <p className="text-3xl font-black text-slate-800">{data.users.filter(u => u.role === UserRole.TEACHER).length}</p>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                <div className="lg:col-span-2">
                    <Card title="Desempenho por Turma (%)" className="h-full min-h-[350px]">
                        {classPerformance.length > 0 ? (
                            <div className="mt-4">
                                <SimpleBarChart data={classPerformance} />
                                <p className="text-[10px] text-slate-400 mt-4 italic">* Gráfico baseado na taxa de acerto média de todas as provas aplicadas em cada turma.</p>
                            </div>
                        ) : (
                            <div className="h-48 flex items-center justify-center text-slate-400 italic">Sem dados de provas aplicadas.</div>
                        )}
                    </Card>
                </div>

                <div>
                    <Card title="Ranking de Engajamento" className="h-full min-h-[350px]">
                        <div className="space-y-4 mt-2">
                            {teacherEngagement.map((prof, i) => (
                                <div key={prof.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden border-2 border-white shadow-sm">
                                                {prof.photoUrl ? <img src={prof.photoUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-bold text-slate-400">{prof.name.charAt(0)}</div>}
                                            </div>
                                            <div className={`absolute -top-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-sm ${i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-slate-400' : i === 2 ? 'bg-orange-600' : 'bg-slate-300'}`}>
                                                {i + 1}
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-800 line-clamp-1">{prof.name}</p>
                                            <p className="text-[10px] text-slate-500 uppercase font-black">{prof.questions} qts • {prof.exams} provas</p>
                                        </div>
                                    </div>
                                    <Icons.ArrowRight />
                                </div>
                            ))}
                            {teacherEngagement.length === 0 && <p className="text-center text-slate-400 py-10 italic">Nenhum professor cadastrado.</p>}
                        </div>
                    </Card>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card title="Mapa de Conteúdos: Mais Cobrados">
                    <div className="mt-2 space-y-3">
                        {contentHeatmap.top.map((item, idx) => (
                            <div key={idx} className="space-y-1">
                                <div className="flex justify-between text-xs font-bold">
                                    <span className="text-slate-700">{item.name} <span className="text-[10px] text-slate-400 font-normal">({item.discipline})</span></span>
                                    <span className="text-brand-blue">{item.count} questões</span>
                                </div>
                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                    <div className="h-full bg-brand-blue" style={{ width: `${(item.count / Math.max(1, contentHeatmap.top[0]?.count || 1)) * 100}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card title="Mapa de Conteúdos: Menos Cobrados">
                    <div className="mt-2 space-y-3">
                        {contentHeatmap.forgotten.map((item, idx) => (
                            <div key={idx} className="space-y-1 opacity-80">
                                <div className="flex justify-between text-xs font-bold">
                                    <span className="text-slate-700">{item.name} <span className="text-[10px] text-slate-400 font-normal">({item.discipline})</span></span>
                                    <span className="text-orange-600">{item.count} questões</span>
                                </div>
                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                    <div className="h-full bg-orange-400" style={{ width: `${(item.count / Math.max(1, contentHeatmap.top[0]?.count || 1)) * 100}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default Dashboard;
