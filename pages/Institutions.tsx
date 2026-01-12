import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Institution } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { Button, Modal, Input, Card, Badge } from '../components/UI';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';

const InstitutionPage = () => {
    const { user, refreshUser } = useAuth();
    const navigate = useNavigate();
    const [institutions, setInstitutions] = useState<Institution[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Partial<Institution>>({});
    
    // View States
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => { if (user) load(); }, [user]);
    
    const load = async () => { 
        setLoading(true);
        try {
            const data = await FirebaseService.getInstitutions(user);
            setInstitutions(data);
        } finally {
            setLoading(false);
        }
    };

    // Lógica de agrupamento por nome
    const groupedInstitutions = useMemo(() => {
        const groups: Record<string, { data: Institution, count: number }> = {};
        
        institutions.forEach(inst => {
            const nameKey = inst.name.toLowerCase().trim();
            if (!groups[nameKey]) {
                groups[nameKey] = { data: inst, count: 1 };
            } else {
                groups[nameKey].count += 1;
            }
        });

        const list = Object.values(groups);
        
        return list.filter(item => 
            item.data.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            item.data.email?.toLowerCase().includes(searchTerm.toLowerCase())
        ).sort((a, b) => a.data.name.localeCompare(b.data.name));
    }, [institutions, searchTerm]);

    const handleSave = async () => {
        if (!editing.name) return alert('Nome obrigatório');
        
        try {
            if (editing.id) {
                await FirebaseService.updateInstitution(editing as Institution);
            } else {
                await FirebaseService.addInstitution(editing as Institution, user);
                await refreshUser();
            }
            setIsModalOpen(false); 
            load();
        } catch (e) {
            alert("Erro ao salvar instituição.");
        }
    };

    const handleDelete = async (id: string) => { 
        if(confirm('Excluir este registro de instituição?')) { 
            await FirebaseService.deleteInstitution(id); 
            load(); 
        } 
    };

    const handleManageClasses = (instId: string) => {
        navigate('/classes', { state: { institutionId: instId } });
    };

    return (
        <div className="p-8 h-full flex flex-col bg-slate-50 overflow-y-auto custom-scrollbar">
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-3xl font-display font-bold text-slate-800">Instituições</h2>
                    <p className="text-slate-500 text-sm">Gerencie escolas e centros de ensino cadastrados.</p>
                </div>
                
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <input 
                            type="text" 
                            className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-blue bg-white text-slate-800 placeholder-slate-400" 
                            placeholder="Buscar por nome..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <div className="absolute left-2.5 top-2.5 text-slate-400"><Icons.Search /></div>
                    </div>
                    
                    <div className="bg-white border border-slate-300 rounded-lg flex p-1 shrink-0">
                        <button onClick={() => setViewMode('list')} className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-slate-100 text-brand-blue' : 'text-slate-400 hover:text-slate-600'}`} title="Lista">
                            <Icons.List />
                        </button>
                        <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded transition-colors ${viewMode === 'grid' ? 'bg-slate-100 text-brand-blue' : 'text-slate-400 hover:text-slate-600'}`} title="Grade">
                            <Icons.Grid />
                        </button>
                    </div>

                    <Button onClick={() => { setEditing({ logoUrl: '' }); setIsModalOpen(true); }} className="shrink-0"><Icons.Plus /> Nova</Button>
                </div>
            </div>

            {loading && institutions.length === 0 ? (
                <div className="flex-1 flex items-center justify-center p-20 text-slate-400 font-bold animate-pulse">Carregando Instituições...</div>
            ) : (
                <>
                    {viewMode === 'list' && (
                        <Card className="overflow-hidden flex-1 flex flex-col">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="p-4 font-semibold text-slate-600 text-sm w-16">Logo</th>
                                            <th className="p-4 font-semibold text-slate-600 text-sm">Nome da Instituição</th>
                                            <th className="p-4 font-semibold text-slate-600 text-sm">Registros</th>
                                            <th className="p-4 font-semibold text-slate-600 text-sm hidden md:table-cell">Contato</th>
                                            <th className="p-4 font-semibold text-slate-600 text-sm text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {groupedInstitutions.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="p-8 text-center text-slate-400 italic">Nenhuma instituição encontrada.</td>
                                            </tr>
                                        ) : (
                                            groupedInstitutions.map(group => (
                                                <tr key={group.data.id} className="hover:bg-slate-50 transition-colors group">
                                                    <td className="p-3">
                                                        {group.data.logoUrl ? (
                                                            <img src={group.data.logoUrl} alt={group.data.name} className="w-10 h-10 object-contain rounded border border-slate-200 bg-white" />
                                                        ) : (
                                                            <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center text-slate-400"><Icons.Building /></div>
                                                        )}
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="font-bold text-slate-800">{group.data.name}</div>
                                                        <div className="text-xs text-slate-500">{group.data.address || 'Sem endereço cadastrado'}</div>
                                                    </td>
                                                    <td className="p-3">
                                                        <Badge color={group.count > 1 ? "orange" : "blue"}>
                                                            {group.count === 1 ? "1 cadastro" : `${group.count} cadastros`}
                                                        </Badge>
                                                    </td>
                                                    <td className="p-3 text-sm text-slate-600 hidden md:table-cell">
                                                        {group.data.email || group.data.phone || '-'}
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={() => handleManageClasses(group.data.id)} className="p-1.5 text-slate-500 hover:text-brand-blue bg-white border border-slate-200 rounded shadow-sm hover:shadow flex items-center gap-1 px-2">
                                                                <Icons.UsersGroup /> <span className="text-xs font-bold">Turmas</span>
                                                            </button>
                                                            <button onClick={() => { setEditing(group.data); setIsModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-brand-blue bg-white border border-slate-200 rounded shadow-sm hover:shadow"><Icons.Edit /></button>
                                                            <button onClick={() => handleDelete(group.data.id)} className="p-1.5 text-slate-400 hover:text-red-500 bg-white border border-slate-200 rounded shadow-sm hover:shadow"><Icons.Trash /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    )}

                    {viewMode === 'grid' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {groupedInstitutions.map(group => (
                                <Card key={group.data.id} className="relative group hover:-translate-y-1 transition-transform duration-200">
                                    <div className="absolute top-2 right-2">
                                        <Badge color={group.count > 1 ? "orange" : "blue"}>{group.count}</Badge>
                                    </div>
                                    <div className="flex flex-col items-center text-center pt-2">
                                        <div className="h-20 w-full flex items-center justify-center mb-4 bg-slate-50 rounded-lg border border-slate-100 p-2">
                                            {group.data.logoUrl ? (
                                                <img src={group.data.logoUrl} alt={group.data.name} className="h-full w-auto object-contain" />
                                            ) : (
                                                <div className="text-slate-300 transform scale-150"><Icons.Building /></div>
                                            )}
                                        </div>
                                        <h3 className="font-bold text-lg text-slate-800 line-clamp-1 w-full" title={group.data.name}>{group.data.name}</h3>
                                        <p className="text-xs text-slate-500 mt-1">{group.data.address || 'Sem endereço'}</p>
                                        
                                        <div className="mt-4 flex gap-2 w-full">
                                            <Button variant="outline" className="flex-1 text-xs px-1" onClick={() => handleManageClasses(group.data.id)}>Turmas</Button>
                                            <button onClick={() => { setEditing(group.data); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-brand-blue"><Icons.Edit /></button>
                                            <button onClick={() => handleDelete(group.data.id)} className="p-2 text-slate-400 hover:text-red-500"><Icons.Trash /></button>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </>
            )}

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing.id ? 'Editar Instituição' : 'Nova Instituição'} footer={<Button onClick={handleSave}>Salvar</Button>}>
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        {editing.logoUrl && <img src={editing.logoUrl} className="h-16 w-16 object-contain border rounded bg-slate-50" />}
                        <Input type="file" accept="image/*" onChange={(e: any) => {
                            const file = e.target.files?.[0];
                            if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => setEditing({...editing, logoUrl: reader.result as string});
                                reader.readAsDataURL(file);
                            }
                        }} className="border-0" label="Logotipo" />
                    </div>
                    <Input label="Nome" value={editing.name || ''} onChange={e => setEditing({...editing, name: e.target.value})} placeholder="Ex: Colégio Santa Maria" />
                    <Input label="Endereço" value={editing.address || ''} onChange={e => setEditing({...editing, address: e.target.value})} placeholder="Rua, Número, Bairro, Cidade" />
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Email" value={editing.email || ''} onChange={e => setEditing({...editing, email: e.target.value})} />
                        <Input label="Telefone" value={editing.phone || ''} onChange={e => setEditing({...editing, phone: e.target.value})} />
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default InstitutionPage;