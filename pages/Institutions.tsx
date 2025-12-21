
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Institution } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { Button, Modal, Input, Card } from '../components/UI';
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
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const itemsPerPage = 12;

    useEffect(() => { if (user) load(); }, [user]);
    
    const load = async () => { 
        setLoading(true);
        try {
            const data = await FirebaseService.getInstitutions(user);
            setInstitutions(data.sort((a,b) => a.name.localeCompare(b.name)));
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!editing.name) return alert('Nome obrigatório');
        
        try {
            if (editing.id) {
                await FirebaseService.updateInstitution(editing as Institution);
            } else {
                await FirebaseService.addInstitution(editing as Institution, user);
                // Se o usuário não tinha instituiçãoId, o FirebaseService atualizou o perfil dele.
                // Atualizamos o contexto para refletir isso.
                await refreshUser();
            }
            setIsModalOpen(false); 
            load();
        } catch (e) {
            alert("Erro ao salvar instituição.");
        }
    };

    const handleDelete = async (id: string) => { if(confirm('Excluir instituição?')) { await FirebaseService.deleteInstitution(id); load(); } };
    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => { setEditing({...editing, logoUrl: reader.result as string}); }; reader.readAsDataURL(file); } };

    // Navega para a página de turmas filtrando por esta instituição
    const handleManageClasses = (instId: string) => {
        navigate('/classes', { state: { institutionId: instId } });
    };

    // Filter Logic
    const filteredInstitutions = institutions.filter(inst => 
        inst.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        inst.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filteredInstitutions.length / itemsPerPage);
    const currentItems = filteredInstitutions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className="p-8 h-full flex flex-col bg-slate-50 overflow-y-auto custom-scrollbar">
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-3xl font-display font-bold text-slate-800">Instituições</h2>
                    <p className="text-slate-500 text-sm">Gerencie escolas, universidades e centros de ensino.</p>
                </div>
                
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <input 
                            type="text" 
                            className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-blue bg-white text-slate-800 placeholder-slate-400" 
                            placeholder="Buscar instituição..." 
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
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
                    {/* List View (Table) */}
                    {viewMode === 'list' && (
                        <Card className="overflow-hidden flex-1 flex flex-col">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="p-4 font-semibold text-slate-600 text-sm w-16">Logo</th>
                                            <th className="p-4 font-semibold text-slate-600 text-sm">Nome</th>
                                            <th className="p-4 font-semibold text-slate-600 text-sm">Contato</th>
                                            <th className="p-4 font-semibold text-slate-600 text-sm hidden md:table-cell">Endereço</th>
                                            <th className="p-4 font-semibold text-slate-600 text-sm text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {currentItems.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="p-8 text-center text-slate-400 italic">
                                                    Nenhuma instituição encontrada.
                                                </td>
                                            </tr>
                                        ) : (
                                            currentItems.map(inst => (
                                                <tr key={inst.id} className="hover:bg-slate-50 transition-colors group">
                                                    <td className="p-3">
                                                        {inst.logoUrl ? (
                                                            <img src={inst.logoUrl} alt={inst.name} className="w-10 h-10 object-contain rounded border border-slate-200 bg-white" />
                                                        ) : (
                                                            <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center text-slate-400">
                                                                <Icons.Building />
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="font-bold text-slate-800">{inst.name}</div>
                                                        {inst.website && <a href={inst.website.startsWith('http') ? inst.website : `https://${inst.website}`} target="_blank" rel="noreferrer" className="text-xs text-brand-blue hover:underline">{inst.website}</a>}
                                                    </td>
                                                    <td className="p-3 text-sm text-slate-600">
                                                        {inst.email && <div className="flex items-center gap-1"><span className="text-slate-400">@</span> {inst.email}</div>}
                                                        {inst.phone && <div className="flex items-center gap-1"><span className="text-slate-400">#</span> {inst.phone}</div>}
                                                    </td>
                                                    <td className="p-3 text-sm text-slate-500 hidden md:table-cell max-w-xs truncate" title={inst.address}>
                                                        {inst.address || '-'}
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={() => handleManageClasses(inst.id)} className="p-1.5 text-slate-500 hover:text-brand-blue bg-white border border-slate-200 rounded shadow-sm hover:shadow flex items-center gap-1 px-2" title="Gerenciar Turmas">
                                                                <Icons.UsersGroup /> <span className="text-xs font-bold">Turmas</span>
                                                            </button>
                                                            <button onClick={() => { setEditing(inst); setIsModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-brand-blue bg-white border border-slate-200 rounded shadow-sm hover:shadow">
                                                                <Icons.Edit />
                                                            </button>
                                                            <button onClick={() => handleDelete(inst.id)} className="p-1.5 text-slate-400 hover:text-red-500 bg-white border border-slate-200 rounded shadow-sm hover:shadow">
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
                        </Card>
                    )}

                    {/* Grid View (Cards) */}
                    {viewMode === 'grid' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {currentItems.map(inst => (
                                <Card key={inst.id} className="relative group hover:-translate-y-1 transition-transform duration-200">
                                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                        <button onClick={() => handleManageClasses(inst.id)} className="p-1.5 bg-white rounded-full shadow border border-slate-100 text-slate-500 hover:text-brand-blue" title="Gerenciar Turmas">
                                            <Icons.UsersGroup />
                                        </button>
                                        <button onClick={() => { setEditing(inst); setIsModalOpen(true); }} className="p-1.5 bg-white rounded-full shadow border border-slate-100 text-slate-500 hover:text-brand-blue">
                                            <Icons.Edit />
                                        </button>
                                        <button onClick={() => handleDelete(inst.id)} className="p-1.5 bg-white rounded-full shadow border border-slate-100 text-slate-500 hover:text-red-500">
                                            <Icons.Trash />
                                        </button>
                                    </div>
                                    <div className="flex flex-col items-center text-center pt-2">
                                        <div className="h-24 w-full flex items-center justify-center mb-4 bg-slate-50 rounded-lg border border-slate-100 p-2">
                                            {inst.logoUrl ? (
                                                <img src={inst.logoUrl} alt={inst.name} className="h-full w-auto object-contain" />
                                            ) : (
                                                <div className="text-slate-300 transform scale-150"><Icons.Building /></div>
                                            )}
                                        </div>
                                        <h3 className="font-bold text-lg text-slate-800 line-clamp-1 w-full" title={inst.name}>{inst.name}</h3>
                                        <div className="mt-2 space-y-1 w-full">
                                            {inst.email && <p className="text-sm text-slate-500 truncate w-full">{inst.email}</p>}
                                            {inst.phone && <p className="text-sm text-slate-500 truncate w-full">{inst.phone}</p>}
                                            {!inst.email && !inst.phone && <p className="text-sm text-slate-400 italic">Sem contato</p>}
                                        </div>
                                        <div className="mt-4 w-full">
                                            <button onClick={() => handleManageClasses(inst.id)} className="text-sm text-brand-blue font-bold hover:underline w-full py-1">
                                                Ver Turmas
                                            </button>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                            {currentItems.length === 0 && <div className="col-span-full text-center py-10 text-slate-400 italic">Nenhuma instituição encontrada.</div>}
                        </div>
                    )}
                </>
            )}

            {/* Pagination Footer */}
            {totalPages > 1 && (
                <div className="mt-6 flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                    <span className="text-sm text-slate-500">
                        Mostrando <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> a <strong>{Math.min(currentPage * itemsPerPage, filteredInstitutions.length)}</strong> de <strong>{filteredInstitutions.length}</strong>
                    </span>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1 text-sm border rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Anterior
                        </button>
                        <div className="flex items-center px-2 text-sm font-bold text-slate-700">
                            {currentPage} / {totalPages}
                        </div>
                        <button 
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1 text-sm border rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Próximo
                        </button>
                    </div>
                </div>
            )}

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing.id ? 'Editar Instituição' : 'Nova Instituição'} footer={<Button onClick={handleSave}>Salvar</Button>}>
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        {editing.logoUrl && <img src={editing.logoUrl} className="h-16 w-16 object-contain border rounded bg-slate-50" />}
                        <Input type="file" accept="image/*" onChange={handleLogoUpload} className="border-0" label="Logotipo" />
                    </div>
                    <Input label="Nome" value={editing.name || ''} onChange={e => setEditing({...editing, name: e.target.value})} placeholder="Ex: Colégio Santa Maria" />
                    <Input label="Endereço" value={editing.address || ''} onChange={e => setEditing({...editing, address: e.target.value})} placeholder="Rua, Número, Bairro, Cidade" />
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Email" value={editing.email || ''} onChange={e => setEditing({...editing, email: e.target.value})} />
                        <Input label="Telefone" value={editing.phone || ''} onChange={e => setEditing({...editing, phone: e.target.value})} />
                    </div>
                    <Input label="Website" value={editing.website || ''} onChange={e => setEditing({...editing, website: e.target.value})} placeholder="www.escola.com.br" />
                </div>
            </Modal>
        </div>
    );
};

export default InstitutionPage;
