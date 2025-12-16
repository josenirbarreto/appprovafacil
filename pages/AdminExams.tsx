
import React, { useState, useEffect } from 'react';
import { Exam, Institution, SchoolClass } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { Button, Badge, Card } from '../components/UI';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';

const AdminExamsPage = () => {
    const { user } = useAuth();
    const [exams, setExams] = useState<Exam[]>([]);
    const [institutions, setInstitutions] = useState<Institution[]>([]);
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    
    // Accordion States
    const [expandedInstitutions, setExpandedInstitutions] = useState<Record<string, boolean>>({});
    const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>({});

    useEffect(() => { if(user) load(); }, [user]);
    
    const load = async () => {
        const [e, i, c] = await Promise.all([
            FirebaseService.getExams(user), 
            FirebaseService.getInstitutions(user),
            FirebaseService.getClasses(user)
        ]);
        setExams(e);
        setInstitutions(i.sort((a,b) => a.name.localeCompare(b.name)));
        setClasses(c);
    };

    const handleDelete = async (id: string) => { 
        if(confirm('ATENÇÃO ADMINISTRAÇÃO:\n\nTem certeza que deseja excluir esta prova? Todas as tentativas e notas de alunos vinculadas a ela serão perdidas.')) { 
            await FirebaseService.deleteExam(id); 
            load(); 
        } 
    };

    const toggleInstitution = (id: string) => setExpandedInstitutions(prev => ({ ...prev, [id]: !prev[id] }));
    const toggleYear = (id: string) => setExpandedYears(prev => ({ ...prev, [id]: !prev[id] }));

    const getClassName = (classId?: string) => {
        if (!classId) return 'Sem turma';
        const cls = classes.find(c => c.id === classId);
        return cls ? `${cls.name} (${cls.year})` : 'Turma Excluída';
    };

    return (
        <div className="p-8 h-full flex flex-col bg-slate-50 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-3xl font-display font-bold text-slate-800">Todas as Provas</h2>
                    <p className="text-slate-500 mt-1">Visão geral administrativa organizada por Instituição e Ano.</p>
                </div>
            </div>

            <div className="space-y-4">
                {institutions.length === 0 && (
                    <div className="text-center py-10 text-slate-400">
                        Nenhuma instituição encontrada.
                    </div>
                )}
                {institutions.map(inst => {
                    const instExams = exams.filter(e => e.institutionId === inst.id);
                    
                    // Agrupar por Ano de Criação
                    const years = Array.from(new Set(instExams.map(e => new Date(e.createdAt).getFullYear()))).sort((a: number, b: number) => b - a);
                    
                    const isExpandedInst = expandedInstitutions[inst.id];
                    
                    return (
                        <div key={inst.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 select-none" onClick={() => toggleInstitution(inst.id)}>
                                <div className="flex items-center gap-4">
                                    <div className={`transform transition-transform text-slate-400 ${isExpandedInst ? 'rotate-180' : ''}`}>
                                        <Icons.ChevronDown />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {inst.logoUrl ? <img src={inst.logoUrl} className="w-8 h-8 object-contain rounded border p-0.5" /> : <div className="w-8 h-8 bg-slate-100 rounded flex items-center justify-center text-slate-400"><Icons.Building /></div>}
                                        <span className="font-bold text-lg text-slate-800">{inst.name}</span>
                                    </div>
                                </div>
                                <Badge color="blue">{instExams.length} provas</Badge>
                            </div>
                            
                            {isExpandedInst && (
                                <div className="bg-slate-50 p-4 border-t border-slate-200 space-y-3 animate-fade-in">
                                    {years.length === 0 && <div className="text-slate-400 italic text-sm ml-10">Nenhuma prova registrada nesta instituição.</div>}
                                    
                                    {years.map(year => {
                                        const yearId = `${inst.id}-${year}`;
                                        const isExpandedYear = expandedYears[yearId];
                                        const yearExams = instExams.filter(e => new Date(e.createdAt).getFullYear() === year);
                                        
                                        return (
                                            <div key={yearId} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                                                <div className="p-3 flex justify-between items-center cursor-pointer hover:bg-slate-50 select-none pl-6" onClick={() => toggleYear(yearId)}>
                                                    <div className="flex items-center gap-3">
                                                        <div className={`transform transition-transform text-slate-400 ${isExpandedYear ? 'rotate-180' : ''}`}>
                                                            <Icons.ChevronDown />
                                                        </div>
                                                        <span className="font-semibold text-slate-700">Provas de {year}</span>
                                                    </div>
                                                    <span className="text-xs text-slate-400 mr-2">{yearExams.length} provas</span>
                                                </div>
                                                
                                                {isExpandedYear && (
                                                    <div className="border-t border-slate-100 animate-fade-in">
                                                        <table className="w-full text-left">
                                                            <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold">
                                                                <tr>
                                                                    <th className="p-3 pl-12">Título</th>
                                                                    <th className="p-3">Turma</th>
                                                                    <th className="p-3">Data Criação</th>
                                                                    <th className="p-3">Questões</th>
                                                                    <th className="p-3">Status</th>
                                                                    <th className="p-3 text-right">Ações</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-50">
                                                                {yearExams.map(exam => (
                                                                    <tr key={exam.id} className="hover:bg-blue-50/50 transition-colors group">
                                                                        <td className="p-3 pl-12 text-sm text-slate-800 font-bold">{exam.title}</td>
                                                                        <td className="p-3 text-sm text-slate-600">{getClassName(exam.classId)}</td>
                                                                        <td className="p-3 text-sm text-slate-500">{new Date(exam.createdAt).toLocaleDateString()}</td>
                                                                        <td className="p-3 text-sm text-slate-600">{exam.questions?.length || 0}</td>
                                                                        <td className="p-3">
                                                                            {exam.publicConfig?.isPublished 
                                                                                ? <Badge color="green">Online</Badge> 
                                                                                : <Badge color="yellow">Rascunho</Badge>
                                                                            }
                                                                        </td>
                                                                        <td className="p-3 text-right">
                                                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                <button onClick={() => handleDelete(exam.id)} className="text-slate-400 hover:text-red-500 p-1" title="Excluir Prova">
                                                                                    <Icons.Trash />
                                                                                </button>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AdminExamsPage;
