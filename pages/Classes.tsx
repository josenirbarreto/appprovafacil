import React, { useState, useEffect } from 'react';
import { SchoolClass, Institution } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { Button, Modal, Select, Input, Card, Badge } from '../components/UI';
import { Icons } from '../components/Icons';

const ClassesPage = () => {
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [institutions, setInstitutions] = useState<Institution[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Partial<SchoolClass>>({});
    const [expandedInstitutions, setExpandedInstitutions] = useState<Record<string, boolean>>({});
    const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>({});

    useEffect(() => { load(); }, []);
    const load = async () => {
        const [cls, insts] = await Promise.all([FirebaseService.getClasses(), FirebaseService.getInstitutions()]);
        setClasses(cls);
        setInstitutions(insts.sort((a,b) => a.name.localeCompare(b.name)));
    };

    const handleSave = async () => {
        if(!editing.name || !editing.institutionId) return alert('Campos obrigatórios');
        const clsData = { ...editing, year: Number(editing.year) || new Date().getFullYear() } as SchoolClass;
        if (editing.id) await FirebaseService.updateClass(clsData); else await FirebaseService.addClass(clsData);
        setIsModalOpen(false);
        load();
    };

    const handleDelete = async (id: string) => { if(confirm('Excluir turma?')) { await FirebaseService.deleteClass(id); load(); } };
    const toggleInstitution = (id: string) => setExpandedInstitutions(prev => ({ ...prev, [id]: !prev[id] }));
    const toggleYear = (id: string) => setExpandedYears(prev => ({ ...prev, [id]: !prev[id] }));

    return (
        <div className="p-8 h-full flex flex-col bg-slate-50 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-6"><div><h2 className="text-3xl font-display font-bold text-slate-800">Turmas</h2><p className="text-slate-500 mt-1">Gerencie suas turmas por Instituição e Ano Letivo.</p></div><Button onClick={() => { setEditing({ year: new Date().getFullYear() }); setIsModalOpen(true); }}><Icons.Plus /> Nova Turma</Button></div>
            <div className="space-y-4">
                {institutions.length === 0 && <div className="text-center py-10 text-slate-400">Nenhuma instituição cadastrada.</div>}
                {institutions.map(inst => {
                    const instClasses = classes.filter(c => c.institutionId === inst.id);
                    const years = Array.from(new Set(instClasses.map(c => c.year))).sort((a, b) => Number(b) - Number(a));
                    const isExpandedInst = expandedInstitutions[inst.id];
                    return (
                        <div key={inst.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 select-none" onClick={() => toggleInstitution(inst.id)}><div className="flex items-center gap-4"><div className={`transform transition-transform text-slate-400 ${isExpandedInst ? 'rotate-180' : ''}`}><Icons.ChevronDown /></div><div className="flex items-center gap-3">{inst.logoUrl ? <img src={inst.logoUrl} className="w-8 h-8 object-contain rounded border p-0.5" /> : <div className="w-8 h-8 bg-slate-100 rounded flex items-center justify-center text-slate-400"><Icons.Building /></div>}<span className="font-bold text-lg text-slate-800">{inst.name}</span></div></div><Badge color="blue">{instClasses.length} turmas</Badge></div>
                            {isExpandedInst && (<div className="bg-slate-50 p-4 border-t border-slate-200 space-y-3 animate-fade-in">{years.length === 0 && <div className="text-slate-400 italic text-sm ml-10">Nenhuma turma.</div>}{years.map(year => { const yearId = `${inst.id}-${year}`; const isExpandedYear = expandedYears[yearId]; const yearClasses = instClasses.filter(c => c.year === year); return (<div key={yearId} className="bg-white border border-slate-200 rounded-lg overflow-hidden"><div className="p-3 flex justify-between items-center cursor-pointer hover:bg-slate-50 select-none pl-6" onClick={() => toggleYear(yearId)}><div className="flex items-center gap-3"><div className={`transform transition-transform text-slate-400 ${isExpandedYear ? 'rotate-180' : ''}`}><Icons.ChevronDown /></div><span className="font-semibold text-slate-700">Ano Letivo {year}</span></div><span className="text-xs text-slate-400 mr-2">{yearClasses.length} turmas</span></div>{isExpandedYear && (<div className="border-t border-slate-100 animate-fade-in"><table className="w-full text-left"><tbody className="divide-y divide-slate-50">{yearClasses.map(c => (<tr key={c.id} className="hover:bg-blue-50/50 transition-colors group"><td className="p-3 pl-12 text-sm text-slate-700 font-medium">{c.name}</td><td className="p-3 text-right"><div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => { setEditing(c); setIsModalOpen(true); }} className="text-slate-400 hover:text-brand-blue p-1"><Icons.Edit /></button><button onClick={() => handleDelete(c.id)} className="text-slate-400 hover:text-red-500 p-1"><Icons.Trash /></button></div></td></tr>))}</tbody></table></div>)}</div>); })}</div>)}
                        </div>
                    );
                })}
            </div>
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing.id ? 'Editar Turma' : 'Nova Turma'} footer={<Button onClick={handleSave}>Salvar</Button>}>
                <div className="space-y-4"><Select label="Instituição" value={editing.institutionId || ''} onChange={e => setEditing({...editing, institutionId: e.target.value})}><option value="">Selecione...</option>{institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</Select><Input label="Ano Letivo" type="number" value={editing.year || ''} onChange={e => setEditing({...editing, year: Number(e.target.value)})} /><Input label="Nome da Turma" value={editing.name || ''} onChange={e => setEditing({...editing, name: e.target.value})} placeholder="Ex: 3º Ano A" /></div>
            </Modal>
        </div>
    );
};

export default ClassesPage;
