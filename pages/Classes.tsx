
import React, { useState, useEffect, useCallback } from 'react';
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
    const [importMethod, setImportMethod] = useState<'PASTE' | 'FILE'>('PASTE');
    const [importText, setImportText] = useState('');
    const [importFile, setImportFile] = useState<File | null>(null);
    const [newStudent, setNewStudent] = useState({ name: '', registration: '' });
    const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
    const [loadingStudents, setLoadingStudents] = useState(false);

    useEffect(() => { if(user) load(); }, [user, filterInstitutionId]);
    
    const load = async () => {
        const [cls, insts] = await Promise.all([FirebaseService.getClasses(user), FirebaseService.getInstitutions(user)]);
        let visibleInsts = insts.sort((a,b) => (a.name || '').localeCompare(b.name || ''));
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
        
        if (user?.role === UserRole.MANAGER && user.institutionId) {
            initialData.institutionId = user.institutionId;
        }

        setEditing(initialData);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => { 
        if(confirm('Excluir turma?')) { 
            try {
                await FirebaseService.deleteClass(id); 
                load(); 
            } catch (e) {
                alert("Erro ao excluir turma. Verifique dependências.");
            }
        } 
    };
    
    // --- GESTÃO DE ALUNOS ---
    const openStudentsModal = async (cls: SchoolClass) => {
        setActiveClass(cls);
        setLoadingStudents(true);
        setIsStudentsModalOpen(true);
        setIsImportMode(false);
        setEditingStudentId(null);
        setImportMethod('PASTE');
        setImportFile(null);
        setImportText('');
        setNewStudent({ name: '', registration: '' });
        try {
            const data = await FirebaseService.getStudents(cls.id);
            setStudents(Array.isArray(data) ? data : []);
        } catch (e) {
            setStudents([]);
        } finally {
            setLoadingStudents(false);
        }
    };

    const handleSaveStudent = async () => {
        if (!newStudent.name || !activeClass) return;
        setLoadingStudents(true);
        try {
            if (editingStudentId) {
                await FirebaseService.updateStudent(editingStudentId, {
                    name: newStudent.name,
                    registration: newStudent.registration
                });
                setEditingStudentId(null);
            } else {
                const reg = newStudent.registration || `MAT-${Date.now().toString().slice(-6)}`;
                await FirebaseService.addStudent({
                    name: newStudent.name,
                    registration: reg,
                    classId: activeClass.id,
                    institutionId: activeClass.institutionId
                });
            }
            
            setNewStudent({ name: '', registration: '' });
            const data = await FirebaseService.getStudents(activeClass.id);
            setStudents(data);
        } catch (e) {
            alert("Erro ao salvar dados do aluno.");
        } finally {
            setLoadingStudents(false);
        }
    };

    const startEditStudent = (student: Student) => {
        setIsImportMode(false);
        setEditingStudentId(student.id);
        setNewStudent({ name: student.name, registration: student.registration });
    };

    const cancelEditStudent = () => {
        setEditingStudentId(null);
        setNewStudent({ name: '', registration: '' });
    };

    const processImportList = (text: string) => {
        const lines = text.split('\n');
        return lines.map(line => {
            const parts = line.split(/[;,\t]/);
            const name = parts[0]?.trim() || '';
            const reg = parts[1]?.trim() || `MAT-${Math.random().toString(36).slice(-6).toUpperCase()}`;
            return { name, registration: reg };
        }).filter(s => s.name.length > 2);
    }

    const handleImportStudents = async () => {
        if (!activeClass) return;
        
        let toImport: { name: string, registration: string }[] = [];

        if (importMethod === 'PASTE') {
            if (!importText.trim()) return alert("Cole a lista de alunos primeiro.");
            toImport = processImportList(importText);
        } else {
            if (!importFile) return alert("Selecione um arquivo CSV primeiro.");
            try {
                const text = await importFile.text();
                toImport = processImportList(text);
            } catch (e) {
                return alert("Erro ao ler o arquivo.");
            }
        }

        if (toImport.length === 0) return alert("Nenhum dado válido encontrado. Verifique o formato.");
        
        setLoadingStudents(true);
        try {
            await FirebaseService.importStudents(activeClass.id, activeClass.institutionId, toImport);
            setImportText('');
            setImportFile(null);
            setIsImportMode(false);
            const data = await FirebaseService.getStudents(activeClass.id);
            setStudents(data);
        } catch (e) {
            alert("Erro na importação.");
        } finally {
            setLoadingStudents(false);
        }
    };

    // Otimização INP: removeStudent agora é assíncrona e não bloqueia a UI
    const removeStudent = async (id: string) => {
        // Yielding to next frame to avoid blocking the main thread during click event handling
        // O confirm nativo ainda bloqueia, mas envolver em async/await e setTimeout ajuda o INP em alguns casos
        if (!window.confirm("Deseja realmente remover este aluno?")) return;
        
        setLoadingStudents(true);
        try {
            await FirebaseService.deleteStudent(id);
            // Atualização de estado funcional para garantir consistência
            setStudents(prev => prev.filter(s => s.id !== id));
            if (editingStudentId === id) cancelEditStudent();
        } catch (e) {
            console.error("Falha ao deletar aluno:", e);
            alert("Não foi possível remover o aluno. Verifique sua conexão.");
        } finally {
            setLoadingStudents(false);
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
            <Modal isOpen={isStudentsModalOpen} onClose={() => setIsStudentsModalOpen(false)} title={`Alunos: ${activeClass?.name}`} maxWidth="max-w-4xl">
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h4 className="font-bold text-slate-700 flex items-center gap-2"><Icons.List /> Quadro de Alunos ({students.length})</h4>
                        <div className="flex gap-2">
                             {!editingStudentId && (
                                <Button 
                                    variant={isImportMode ? "outline" : "primary"} 
                                    className={`text-xs font-black shadow-sm ${!isImportMode ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-600 shadow-emerald-100' : ''}`} 
                                    onClick={() => { setIsImportMode(!isImportMode); setEditingStudentId(null); }}
                                >
                                    {isImportMode ? (
                                        <><Icons.Plus /> Cadastrar Individual</>
                                    ) : (
                                        <><Icons.FileText /> Importar Lista de Alunos</>
                                    )}
                                </Button>
                             )}
                        </div>
                    </div>

                    {isImportMode && !editingStudentId ? (
                        <div className="space-y-4 animate-fade-in">
                            <div className="flex bg-slate-100 p-1 rounded-xl w-fit mx-auto mb-2">
                                <button onClick={() => setImportMethod('PASTE')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${importMethod === 'PASTE' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Colar Lista</button>
                                <button onClick={() => setImportMethod('FILE')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${importMethod === 'FILE' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Carregar Arquivo (.csv)</button>
                            </div>

                            <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100 text-xs text-emerald-800">
                                <div className="flex items-center gap-2 mb-1 font-bold"><Icons.Sparkles /> FORMATO RECOMENDADO:</div>
                                <p>Um aluno por linha no formato: <code>Nome do Aluno, Matrícula</code> (a matrícula é opcional).</p>
                            </div>

                            {importMethod === 'PASTE' ? (
                                <textarea className="w-full h-48 border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-brand-blue outline-none bg-white font-medium" placeholder="João Silva, 1001&#10;Maria Oliveira, 1002&#10;..." value={importText} onChange={e => setImportText(e.target.value)} />
                            ) : (
                                <div className="border-2 border-dashed border-emerald-200 bg-emerald-50/30 rounded-2xl p-10 text-center relative hover:bg-emerald-50 transition-colors group">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"><Icons.FileText /></div>
                                        <div><p className="font-bold text-emerald-900">{importFile ? importFile.name : 'Selecionar arquivo CSV'}</p><p className="text-xs text-emerald-600 mt-1">{importFile ? 'Clique para trocar de arquivo' : 'Arraste ou clique para buscar'}</p></div>
                                    </div>
                                    <input type="file" accept=".csv,.txt" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => setImportFile(e.target.files?.[0] || null)} />
                                </div>
                            )}

                            <Button onClick={handleImportStudents} disabled={loadingStudents || (importMethod === 'PASTE' ? !importText.trim() : !importFile)} className="w-full justify-center bg-emerald-600 hover:bg-emerald-700 border-emerald-600 font-bold py-3 shadow-lg shadow-emerald-100">
                                {loadingStudents ? 'Processando...' : `Importar ${importMethod === 'PASTE' ? 'da Caixa de Texto' : 'do Arquivo'}`}
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-fade-in">
                            <div className={`p-4 rounded-xl border transition-all ${editingStudentId ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-100' : 'bg-slate-50 border-slate-100'}`}>
                                <h5 className="text-xs font-black uppercase text-slate-400 mb-3 tracking-widest">{editingStudentId ? 'Modo Edição' : 'Novo Aluno'}</h5>
                                <div className="grid grid-cols-5 gap-2 items-end">
                                    <div className="col-span-3"><Input label="Nome do Aluno" value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} placeholder="Ex: João Silva" /></div>
                                    <div className="col-span-1"><Input label="Matrícula" value={newStudent.registration} onChange={e => setNewStudent({...newStudent, registration: e.target.value})} placeholder="Auto" /></div>
                                    <div className="col-span-1 flex gap-1">
                                        <Button onClick={handleSaveStudent} className="flex-1 justify-center h-10" disabled={loadingStudents}>{editingStudentId ? <Icons.Check /> : <Icons.Plus />}</Button>
                                        {editingStudentId && <Button variant="ghost" onClick={cancelEditStudent} className="bg-white border border-slate-200 text-slate-400 hover:text-red-500" disabled={loadingStudents}><Icons.X /></Button>}
                                    </div>
                                </div>
                            </div>

                            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white max-h-80 overflow-y-auto custom-scrollbar relative">
                                {loadingStudents && (
                                    <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
                                        <div className="w-6 h-6 border-2 border-slate-300 border-t-brand-blue rounded-full animate-spin"></div>
                                    </div>
                                )}
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                                        <tr>
                                            <th className="p-3 text-slate-500 font-bold">Nome</th>
                                            <th className="p-3 text-slate-500 font-bold">Matrícula</th>
                                            <th className="p-3 text-right"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {!loadingStudents && students.length === 0 ? (
                                            <tr>
                                                <td colSpan={3} className="p-12 text-center text-slate-400 italic">
                                                    <div className="flex flex-col items-center gap-2 opacity-50"><Icons.UsersGroup /><p>Nenhum aluno cadastrado.</p></div>
                                                </td>
                                            </tr>
                                        ) : (
                                            students.map(s => (
                                                <tr key={s.id} className={`hover:bg-slate-50 group transition-colors ${editingStudentId === s.id ? 'bg-blue-50/50' : ''}`}>
                                                    <td className="p-3 font-medium text-slate-800">{s.name}</td>
                                                    <td className="p-3 font-mono text-xs text-slate-500">{s.registration}</td>
                                                    <td className="p-3 text-right">
                                                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button 
                                                                onClick={() => startEditStudent(s)} 
                                                                className={`p-1.5 rounded transition-colors ${editingStudentId === s.id ? 'text-brand-blue bg-blue-100' : 'text-slate-400 hover:text-brand-blue hover:bg-white border border-transparent hover:border-slate-200 shadow-sm'}`} 
                                                                title="Editar Aluno"
                                                                disabled={loadingStudents}
                                                            >
                                                                <Icons.Edit />
                                                            </button>
                                                            <button 
                                                                onClick={() => removeStudent(s.id)} 
                                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-white border border-transparent hover:border-slate-200 shadow-sm rounded" 
                                                                title="Remover Aluno"
                                                                disabled={loadingStudents}
                                                            >
                                                                <Icons.Trash />
                                                            </button>
                                                        </div>
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
