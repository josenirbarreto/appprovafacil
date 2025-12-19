
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SchoolClass, Institution, Student, UserRole } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { Button, Modal, Select, Input, Card, Badge } from '../components/UI';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';

const ClassesPage = () => {
    const { user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    
    const filterInstitutionId = location.state?.institutionId;

    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [institutions, setInstitutions] = useState<Institution[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Partial<SchoolClass>>({});
    const [expandedInstitutions, setExpandedInstitutions] = useState<Record<string, boolean>>({});
    const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>({});

    // --- ALUNOS STATE ---
    const [isStudentsModalOpen, setIsStudentsModalOpen] = useState(false);
    const [activeClass, setActiveClass] = useState<SchoolClass | null>(null);
    const [students, setStudents] = useState<Student[]>([]);
    const [isImportMode, setIsImportMode] = useState(false);
    const [importText, setImportText] = useState('');
    const [newStudent, setNewStudent] = useState({ name: '', registration: '' });
    const [loadingStudents, setLoadingStudents] = useState(false);

    useEffect(() => { if(user) load(); }, [user, filterInstitutionId]);
    
    const load = async () => {
        const [cls, insts] = await Promise.all([FirebaseService.getClasses(user), FirebaseService.getInstitutions(user)]);
        let visibleInsts = insts.sort((a,b) => a.name.localeCompare(b.name));
        if (filterInstitutionId) {
            visibleInsts = visibleInsts.filter(i => i.id === filterInstitutionId);
            setExpandedInstitutions(prev => ({ ...prev, [filterInstitutionId]: true }));
        }
        setClasses(cls);
        setInstitutions(visibleInsts);
    };

    const clearFilter = () => navigate(location.pathname, { replace: true, state: {} });

    const handleSave = async () => {
        if(!editing.name || !editing.institutionId) return alert('Campos obrigatórios (Nome e Instituição)');
        const clsData = { ...editing, year: Number(editing.year) || new Date().getFullYear() } as SchoolClass;
        if (editing.id) await FirebaseService.updateClass(clsData); else await FirebaseService.addClass(clsData);
        setIsModalOpen(false);
        load();
    };

    const openNewClassModal = () => {
        const initialData: Partial<SchoolClass> = { 
            year: new Date().getFullYear(), 
            institutionId: filterInstitutionId || '' 
        };
        
        // Se for gestor, já amarra a instituição dele
        if (user?.role === UserRole.MANAGER && user.institutionId) {
            initialData.institutionId = user.institutionId;
        }

        setEditing(initialData);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => { if(confirm('Excluir turma?')) { await FirebaseService.deleteClass(id); load(); } };
    
    // --- GESTÃO DE ALUNOS ---
    const openStudentsModal = async (cls: SchoolClass) => {
        setActiveClass(cls);
        setLoadingStudents(true);
        setIsStudentsModalOpen(true);
        setIsImportMode(false); // Reseta para manual ao abrir
        const data = await FirebaseService.getStudents(cls.id);
        setStudents(data);
        setLoadingStudents(false);
    };

    const handleAddStudent = async () => {
        if (!newStudent.name || !activeClass) return;
        const reg = newStudent.registration || `MAT-${Date.now().toString().slice(-6)}`;
        await FirebaseService.addStudent({
            name: newStudent.name,
            registration: reg,
            classId: activeClass.id,
            institutionId: activeClass.institutionId
        });
        setNewStudent({ name: '', registration: '' });
        const data = await FirebaseService.getStudents(activeClass.id);
        setStudents(data);
    };

    const handleImportStudents = async () => {
        if (!importText.trim() || !activeClass) return;
        const lines = importText.split('\n');
        const toImport = lines.map(line => {
            const parts = line.split(/[;,]/); // Aceita ponto e vírgula ou vírgula
            return {
                name: parts[0]?.trim() || '',
                registration: parts[1]?.trim() || `MAT-${Math.random().toString(36).slice(-6).toUpperCase()}`
            };
        }).filter(s => s.name.length > 2);

        if (toImport.length === 0) return alert("Nenhum dado válido encontrado.");
        
        setLoadingStudents(true);
        await FirebaseService.importStudents(activeClass.id, activeClass.institutionId, toImport);
        setImportText('');
        setIsImportMode(false);
        const data = await FirebaseService.getStudents(activeClass.id);
        setStudents(data);
        setLoadingStudents(false);
    };

    const removeStudent = async (id: string) => {
        if (confirm("Remover aluno?")) {
            await FirebaseService.deleteStudent(id);
            setStudents(students.filter(s => s.id !== id));
        }
    };

    return (
        <div className="p-8 h-full flex flex-col bg-slate-50 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-3xl font-display font-bold text-slate-800">Turmas</h2>
                    <p className="text-slate-500 mt-1">Gerencie turmas e o quadro de alunos cadastrados.</p>
                </div>
                <div className="flex gap-2">
                    {filterInstitutionId && <Button variant="outline" onClick={clearFilter}><Icons.Refresh /> Ver Todas</Button>}
                    <Button onClick={openNewClassModal}><Icons.Plus /> Nova Turma</Button>
                </div>
            </div>

            <div className="space-y-4">
                {institutions.map(inst => {
                    const instClasses = classes.filter(c => c.institutionId === inst.id);
                    const years = Array.from(new Set(instClasses.map(c => c.year))).sort((a, b) => Number(b) - Number(a));
                    const isExpandedInst = expandedInstitutions[inst.id];
                    return (
                        <div key={inst.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 select-none" onClick={() => setExpandedInstitutions(prev => ({ ...prev, [inst.id]: !prev[inst.id] }))}>
                                <div className="flex items-center gap-4">
                                    <div className={`transform transition-transform text-slate-400 ${isExpandedInst ? 'rotate-180' : ''}`}><Icons.ChevronDown /></div>
                                    <div className="flex items-center gap-3">{inst.logoUrl ? <img src={inst.logoUrl} className="w-8 h-8 object-contain rounded border p-0.5" /> : <div className="w-8 h-8 bg-slate-100 rounded flex items-center justify-center text-slate-400"><Icons.Building /></div>}<span className="font-bold text-lg text-slate-800">{inst.name}</span></div>
                                </div>
                                <Badge color="blue">{instClasses.length} turmas</Badge>
                            </div>
                            {isExpandedInst && (<div className="bg-slate-50 p-4 border-t border-slate-200 space-y-3 animate-fade-in">{years.map(year => { const yearId = `${inst.id}-${year}`; const isExpandedYear = expandedYears[yearId]; const yearClasses = instClasses.filter(c => c.year === year); return (<div key={yearId} className="bg-white border border-slate-200 rounded-lg overflow-hidden"><div className="p-3 flex justify-between items-center cursor-pointer hover:bg-slate-50 select-none pl-6" onClick={() => setExpandedYears(prev => ({ ...prev, [yearId]: !prev[yearId] }))}><div className="flex items-center gap-3"><div className={`transform transition-transform text-slate-400 ${isExpandedYear ? 'rotate-180' : ''}`}><Icons.ChevronDown /></div><span className="font-semibold text-slate-700">Ano Letivo {year}</span></div><span className="text-xs text-slate-400 mr-2">{yearClasses.length} turmas</span></div>{isExpandedYear && (<div className="border-t border-slate-100 animate-fade-in"><table className="w-full text-left"><tbody className="divide-y divide-slate-50">{yearClasses.map(c => (<tr key={c.id} className="hover:bg-blue-50/50 transition-colors group"><td className="p-3 pl-12 text-sm text-slate-700 font-bold">{c.name}</td><td className="p-3 text-right"><div className="flex justify-end gap-3"><button onClick={() => openStudentsModal(c)} className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:text-brand-blue hover:border-brand-blue transition-all"><Icons.UsersGroup /> Alunos</button><div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => { setEditing(c); setIsModalOpen(true); }} className="text-slate-400 hover:text-brand-blue p-1"><Icons.Edit /></button><button onClick={() => handleDelete(c.id)} className="text-slate-400 hover:text-red-500 p-1"><Icons.Trash /></button></div></div></td></tr>))}</tbody></table></div>)}</div>); })}</div>)}
                        </div>
                    );
                })}
            </div>

            {/* MODAL GESTÃO DE ALUNOS */}
            <Modal isOpen={isStudentsModalOpen} onClose={() => setIsStudentsModalOpen(false)} title={`Alunos: ${activeClass?.name}`} maxWidth="max-w-3xl">
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h4 className="font-bold text-slate-700 flex items-center gap-2"><Icons.List /> Quadro de Alunos ({students.length})</h4>
                        <div className="flex gap-2">
                             <Button 
                                variant={isImportMode ? "outline" : "primary"} 
                                className={`text-xs font-black shadow-sm ${!isImportMode ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-600 shadow-emerald-100' : ''}`} 
                                onClick={() => setIsImportMode(!isImportMode)}
                             >
                                {isImportMode ? (
                                    <><Icons.Plus /> Cadastrar Individual</>
                                ) : (
                                    <><Icons.FileText /> Importar Lista de Alunos</>
                                )}
                             </Button>
                        </div>
                    </div>

                    {isImportMode ? (
                        <div className="space-y-3 animate-fade-in">
                            <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100 text-xs text-emerald-800">
                                <div className="flex items-center gap-2 mb-1 font-bold"><Icons.Sparkles /> DICA DE IMPORTAÇÃO RÁPIDA:</div>
                                <p>Cole os nomes abaixo (um por linha). Se quiser incluir a matrícula, use o formato: <code>Nome do Aluno, Matrícula</code></p>
                            </div>
                            <textarea 
                                className="w-full h-48 border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-brand-blue outline-none bg-white font-medium"
                                placeholder="João Silva, 1001&#10;Maria Oliveira, 1002&#10;..."
                                value={importText}
                                onChange={e => setImportText(e.target.value)}
                            />
                            <Button onClick={handleImportStudents} disabled={loadingStudents} className="w-full justify-center bg-emerald-600 hover:bg-emerald-700 border-emerald-600 font-bold py-3">Confirmar Importação de Lista</Button>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-fade-in">
                            <div className="grid grid-cols-5 gap-2 items-end bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <div className="col-span-3"><Input label="Nome do Aluno" value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} placeholder="Ex: João Silva" /></div>
                                <div className="col-span-1"><Input label="Matrícula" value={newStudent.registration} onChange={e => setNewStudent({...newStudent, registration: e.target.value})} placeholder="Auto" /></div>
                                <div className="col-span-1"><Button onClick={handleAddStudent} className="w-full justify-center"><Icons.Plus /> Add</Button></div>
                            </div>

                            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white max-h-80 overflow-y-auto custom-scrollbar">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                                        <tr>
                                            <th className="p-3 text-slate-500 font-bold">Nome</th>
                                            <th className="p-3 text-slate-500 font-bold">Matrícula</th>
                                            <th className="p-3 text-right"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {loadingStudents ? <tr><td colSpan={3} className="p-8 text-center animate-pulse">Carregando...</td></tr> : students.length === 0 ? (
                                            <tr>
                                                <td colSpan={3} className="p-12 text-center text-slate-400 italic">
                                                    <div className="flex flex-col items-center gap-2 opacity-50">
                                                        <Icons.UsersGroup />
                                                        <p>Nenhum aluno cadastrado. Use o botão acima para importar sua lista!</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            students.map(s => (
                                                <tr key={s.id} className="hover:bg-slate-50 group transition-colors">
                                                    <td className="p-3 font-medium text-slate-800">{s.name}</td>
                                                    <td className="p-3 font-mono text-xs text-slate-500">{s.registration}</td>
                                                    <td className="p-3 text-right">
                                                        <button onClick={() => removeStudent(s.id)} className="text-slate-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100"><Icons.Trash /></button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing.id ? 'Editar Turma' : 'Nova Turma'} footer={<Button onClick={handleSave}>Salvar</Button>}>
                <div className="space-y-4">
                    <Select label="Instituição" value={editing.institutionId || ''} onChange={e => setEditing({...editing, institutionId: e.target.value})} disabled={!!filterInstitutionId || (user?.role === UserRole.MANAGER)}>
                        <option value="">Selecione...</option>
                        {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </Select>
                    <Input label="Ano Letivo" type="number" value={editing.year || ''} onChange={e => setEditing({...editing, year: Number(e.target.value)})} />
                    <Input label="Nome da Turma" value={editing.name || ''} onChange={e => setEditing({...editing, name: e.target.value})} placeholder="Ex: 3º Ano A" />
                </div>
            </Modal>
        </div>
    );
};

export default ClassesPage;
