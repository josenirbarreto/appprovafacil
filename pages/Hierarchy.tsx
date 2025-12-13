
import React, { useState, useEffect } from 'react';
import { Discipline } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { Button } from '../components/UI';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';

const HierarchyPage = () => {
    const { user } = useAuth();
    const [hierarchy, setHierarchy] = useState<Discipline[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedDisciplines, setExpandedDisciplines] = useState<Record<string, boolean>>({});
    const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});
    
    useEffect(() => { if(user) load(); }, [user]);
    const load = async () => { setHierarchy(await FirebaseService.getHierarchy(user)); setLoading(false); };

    const addD = async (name: string) => { await FirebaseService.addDiscipline(name); load(); }
    const addC = async (dId: string, name: string) => { await FirebaseService.addChapter(dId, name); load(); }
    const addU = async (dId: string, cId: string, name: string) => { await FirebaseService.addUnit(dId, cId, name); load(); }
    const addT = async (dId: string, cId: string, uId: string, name: string) => { await FirebaseService.addTopic(dId, cId, uId, name); load(); }

    const handleDelete = async (type: any, ids: any) => {
        if(confirm('Tem certeza? Isso apagará todos os itens filhos.')) {
            await FirebaseService.deleteItem(type, ids);
            load();
        }
    }
    
    const promptAdd = (type: string, callback: (name: string) => void) => {
        const name = prompt(`Nome do novo ${type}:`);
        if(name) callback(name);
    }

    const toggleDiscipline = (id: string) => {
        setExpandedDisciplines(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const toggleChapter = (id: string) => {
        setExpandedChapters(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const colorPalette = [
        { header: 'bg-blue-600', body: 'bg-blue-50', chapter: 'bg-blue-300', unit: 'bg-blue-200', text: 'text-blue-900', border: 'border-blue-200' },
        { header: 'bg-emerald-600', body: 'bg-emerald-50', chapter: 'bg-emerald-300', unit: 'bg-emerald-200', text: 'text-emerald-900', border: 'border-emerald-200' },
        { header: 'bg-purple-600', body: 'bg-purple-50', chapter: 'bg-purple-300', unit: 'bg-purple-200', text: 'text-purple-900', border: 'border-purple-200' },
        { header: 'bg-amber-600', body: 'bg-amber-50', chapter: 'bg-amber-300', unit: 'bg-amber-200', text: 'text-amber-900', border: 'border-amber-200' },
        { header: 'bg-rose-600', body: 'bg-rose-50', chapter: 'bg-rose-300', unit: 'bg-rose-200', text: 'text-rose-900', border: 'border-rose-200' },
        { header: 'bg-cyan-600', body: 'bg-cyan-50', chapter: 'bg-cyan-300', unit: 'bg-cyan-200', text: 'text-cyan-900', border: 'border-cyan-200' },
        { header: 'bg-indigo-600', body: 'bg-indigo-50', chapter: 'bg-indigo-300', unit: 'bg-indigo-200', text: 'text-indigo-900', border: 'border-indigo-200' },
    ];

    if(loading) return <div className="p-8 flex items-center justify-center text-slate-500">Carregando estrutura...</div>;

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 bg-slate-50">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-3xl font-display font-bold text-slate-800">Conteúdos</h2>
                    <p className="text-slate-500 text-sm mt-1">Gerencie a estrutura hierárquica das disciplinas, Capítulos, Unidades e tópicos.</p>
                </div>
                <Button onClick={() => promptAdd('Disciplina', addD)}><Icons.Plus /> Nova Disciplina</Button>
            </div>

            <div className="grid gap-6">
                {hierarchy.length === 0 && (
                    <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-slate-200 text-slate-400">
                        <div className="mb-2"><Icons.BookOpen /></div>
                        <p>Nenhuma disciplina cadastrada.</p>
                    </div>
                )}

                {hierarchy.map((d, index) => {
                    const isExpanded = expandedDisciplines[d.id] === true;
                    const colors = colorPalette[index % colorPalette.length];

                    return (
                        <div key={d.id} className={`bg-white border ${colors.border} rounded-xl shadow-sm overflow-hidden transition-all duration-200`}>
                            <div className={`${colors.header} text-white p-4 flex justify-between items-center select-none cursor-pointer hover:opacity-90 transition-opacity`} onClick={() => toggleDiscipline(d.id)}>
                                <div className="flex items-center gap-3">
                                    <div className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}><Icons.ChevronDown /></div>
                                    <h3 className="text-lg font-bold tracking-wide">{d.name}</h3>
                                </div>
                                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                    <Button variant="ghost" className="text-white/80 hover:text-white hover:bg-white/20 text-xs py-1 px-2 h-auto" onClick={() => promptAdd('Capítulo', (n) => addC(d.id, n))}>
                                        + Capítulo
                                    </Button>
                                    <button onClick={() => handleDelete('discipline', { dId: d.id })} className="text-white/70 hover:text-white p-1.5 rounded hover:bg-white/20 transition-colors">
                                        <Icons.Trash />
                                    </button>
                                </div>
                            </div>

                            {isExpanded && (
                                <div className={`p-4 ${colors.body} space-y-4 animate-fade-in`}>
                                    {d.chapters.length === 0 ? (
                                        <p className="text-slate-500 text-sm italic text-center py-4">Nenhum capítulo cadastrado nesta disciplina.</p>
                                    ) : (
                                        d.chapters.map(c => {
                                            const isChapExpanded = expandedChapters[c.id] === true;
                                            return (
                                                <div key={c.id} className={`${colors.chapter} border border-white/20 rounded-lg shadow-sm`}>
                                                    <div className="p-3 flex justify-between items-center border-b border-black/5 cursor-pointer hover:bg-black/5 transition-colors" onClick={() => toggleChapter(c.id)}>
                                                        <div className="flex items-center gap-2">
                                                            <div className={`transform transition-transform duration-200 text-slate-700 ${isChapExpanded ? 'rotate-180' : ''}`}><Icons.ChevronDown /></div>
                                                            <span className="font-semibold text-slate-800">{c.name}</span>
                                                        </div>
                                                        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                                            <Button variant="ghost" className="text-xs h-7 px-2 bg-white/50 hover:bg-white" onClick={() => promptAdd('Unidade', (n) => addU(d.id, c.id, n))}>+ Unidade</Button>
                                                            <button onClick={() => handleDelete('chapter', { dId: d.id, cId: c.id })} className="text-slate-600 hover:text-red-600 p-1"><Icons.Trash /></button>
                                                        </div>
                                                    </div>

                                                    {isChapExpanded && (
                                                        <div className="p-4 space-y-3">
                                                            {c.units.length === 0 ? <p className="text-xs text-slate-600 italic ml-6">Nenhuma unidade.</p> : (
                                                                c.units.map(u => (
                                                                    <div key={u.id} className={`p-3 rounded-lg border ${colors.border} ${colors.unit}`}>
                                                                        <div className="flex justify-between items-center mb-2">
                                                                            <span className={`text-sm font-bold ${colors.text}`}>{u.name}</span>
                                                                            <div className="flex gap-1">
                                                                                <button onClick={() => promptAdd('Tópico', (n) => addT(d.id, c.id, u.id, n))} className="text-slate-600 hover:text-brand-blue text-xs font-medium hover:underline px-2 py-1">+ Tópico</button>
                                                                                <button onClick={() => handleDelete('unit', { dId: d.id, cId: c.id, uId: u.id })} className="text-slate-400 hover:text-red-500 p-1"><Icons.Trash /></button>
                                                                            </div>
                                                                        </div>
                                                                        
                                                                        <div className="flex flex-wrap gap-2">
                                                                            {u.topics.length === 0 && <span className="text-xs text-slate-400 italic">Sem tópicos</span>}
                                                                            {u.topics.map(t => (
                                                                                <div key={t.id} className="group flex items-center gap-2 bg-white border border-slate-200 px-3 py-1 rounded-full text-xs font-medium hover:border-slate-300 transition-colors shadow-sm text-slate-700">
                                                                                    {t.name}
                                                                                    <button onClick={() => handleDelete('topic', { dId: d.id, cId: c.id, uId: u.id, tId: t.id })} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                        <span className="sr-only">Excluir</span>
                                                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                                                    </button>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default HierarchyPage;
