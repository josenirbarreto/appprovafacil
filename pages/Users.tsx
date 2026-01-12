
import React, { useState, useEffect } from 'react';
import { User, UserRole, Plan, CurricularComponent } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { Button, Card, Badge, Modal, Input, Select } from '../components/UI';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';

const UsersPage = () => {
    const { user } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);
    const [hierarchy, setHierarchy] = useState<CurricularComponent[]>([]); 
    const [loading, setLoading] = useState(true);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'PROFILE' | 'GRANTS'>('PROFILE');
    
    const [userData, setUserData] = useState({ 
        name: '', 
        email: '', 
        role: UserRole.TEACHER, 
        plan: '',
        whatsapp: '',
        accessGrants: [] as string[],
        subjects: [] as string[] 
    });

    useEffect(() => { loadData(); }, [user]);

    const loadData = async () => {
        try {
            const [u, p, h] = await Promise.all([
                FirebaseService.getUsers(user),
                FirebaseService.getPlans(),
                FirebaseService.getHierarchy() 
            ]);
            setUsers(u || []);
            setAvailablePlans(p || []);
            setHierarchy(h || []);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const handleSaveUser = async () => {
        if (!userData.name || !userData.email) return alert("Preencha todos os campos.");
        try {
            if (editingUserId) {
                await FirebaseService.updateUser(editingUserId, { ...userData });
            } else {
                await FirebaseService.createSubUser(user!, { ...userData, password: Math.random().toString(36).slice(-8) });
            }
            setIsModalOpen(false); loadData();
        } catch (error: any) { alert("Erro ao salvar usuário."); }
    };

    const handleDeleteUser = async (id: string) => {
        if (id === user?.id) return alert("Você não pode excluir seu próprio usuário.");
        if (confirm("Tem certeza que deseja excluir este usuário permanentemente? Esta ação não pode ser desfeita.")) {
            try {
                await FirebaseService.deleteUser(id);
                loadData();
            } catch (e) {
                alert("Erro ao excluir usuário.");
            }
        }
    };

    const toggleSubject = (ccId: string) => {
        const current = Array.isArray(userData.subjects) ? userData.subjects : [];
        setUserData({ ...userData, subjects: current.includes(ccId) ? current.filter(id => id !== ccId) : [...current, ccId] });
    };

    const getRoleLabel = (role: UserRole) => {
        switch(role) {
            case UserRole.ADMIN: return 'Administrador';
            case UserRole.MANAGER: return 'Gestor';
            case UserRole.TEACHER: return 'Professor';
            default: return role;
        }
    };

    const getStatusInfo = (u: User) => {
        const today = new Date().toISOString().split('T')[0];
        const isExpired = u.subscriptionEnd < today;
        
        if (u.status === 'INACTIVE') return { label: 'Inativo', color: 'red' as const };
        if (isExpired) return { label: 'Expirado', color: 'orange' as const };
        return { label: 'Ativo', color: 'green' as const };
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Carregando usuários...</div>;

    return (
        <div className="p-8 h-full bg-slate-50 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-3xl font-display font-bold text-slate-800">Usuários</h2>
                    <p className="text-slate-500 text-sm">Gerencie o acesso dos educadores e gestores.</p>
                </div>
                <Button onClick={() => { 
                    setEditingUserId(null); 
                    setUserData({ name: '', email: '', role: UserRole.TEACHER, plan: 'BASIC', whatsapp: '', accessGrants: [], subjects: [] });
                    setIsModalOpen(true); 
                }}><Icons.Plus /> Novo Usuário</Button>
            </div>

            <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            <tr>
                                <th className="p-4">Usuário / E-mail</th>
                                <th className="p-4">Função</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {users.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-slate-400 italic">Nenhum usuário cadastrado.</td>
                                </tr>
                            )}
                            {users.map(u => {
                                const statusInfo = getStatusInfo(u);
                                return (
                                    <tr key={u.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="p-4">
                                            <p className="font-bold text-slate-800">{u.name}</p>
                                            <p className="text-xs text-slate-500">{u.email}</p>
                                        </td>
                                        <td className="p-4">
                                            <Badge color={u.role === UserRole.ADMIN ? 'purple' : u.role === UserRole.MANAGER ? 'orange' : 'blue'}>
                                                {getRoleLabel(u.role)}
                                            </Badge>
                                        </td>
                                        <td className="p-4">
                                            <Badge color={statusInfo.color}>{statusInfo.label}</Badge>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <a href={`mailto:${u.email}`} className="p-2 text-slate-400 hover:text-brand-blue bg-white border border-slate-200 rounded-lg shadow-sm" title="Enviar E-mail">
                                                    <Icons.Mail className="w-4 h-4" />
                                                </a>
                                                {u.whatsapp && (
                                                    <a href={`https://wa.me/${u.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="p-2 text-slate-400 hover:text-green-600 bg-white border border-slate-200 rounded-lg shadow-sm" title="Abrir WhatsApp">
                                                        <Icons.Whatsapp className="w-4 h-4" />
                                                    </a>
                                                )}
                                                <button onClick={() => { 
                                                    setEditingUserId(u.id); 
                                                    setUserData({
                                                        ...u, 
                                                        whatsapp: u.whatsapp || '',
                                                        accessGrants: Array.isArray(u.accessGrants) ? u.accessGrants : [], 
                                                        subjects: Array.isArray(u.subjects) ? u.subjects : []
                                                    } as any); 
                                                    setIsModalOpen(true); 
                                                }} className="p-2 text-slate-400 hover:text-brand-blue bg-white border border-slate-200 rounded-lg shadow-sm" title="Editar">
                                                    <Icons.Edit className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDeleteUser(u.id)} className="p-2 text-slate-400 hover:text-red-500 bg-white border border-slate-200 rounded-lg shadow-sm" title="Excluir">
                                                    <Icons.Trash className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingUserId ? "Editar Usuário" : "Novo Usuário"} maxWidth="max-w-4xl" footer={<Button onClick={handleSaveUser}>Salvar Alterações</Button>}>
                <div className="flex gap-4 border-b border-slate-200 mb-6">
                    <button className={`pb-2 px-4 text-sm font-black uppercase tracking-widest border-b-4 transition-all ${activeTab === 'PROFILE' ? 'border-brand-blue text-brand-blue' : 'border-transparent text-slate-400'}`} onClick={() => setActiveTab('PROFILE')}>Perfil</button>
                    <button className={`pb-2 px-4 text-sm font-black uppercase tracking-widest border-b-4 transition-all ${activeTab === 'GRANTS' ? 'border-brand-blue text-brand-blue' : 'border-transparent text-slate-400'}`} onClick={() => setActiveTab('GRANTS')}>Áreas de Atuação</button>
                </div>

                {activeTab === 'PROFILE' && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="grid grid-cols-2 gap-4">
                            <Input label="Nome Completo" value={userData.name} onChange={e => setUserData({...userData, name: e.target.value})} placeholder="Ex: Prof. Roberto Silva" />
                            <Input label="E-mail" value={userData.email} onChange={e => setUserData({...userData, email: e.target.value})} placeholder="email@exemplo.com" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <Input label="WhatsApp" value={userData.whatsapp} onChange={e => setUserData({...userData, whatsapp: e.target.value})} placeholder="(00) 00000-0000" />
                            <Select label="Função no Sistema" value={userData.role} onChange={e => setUserData({...userData, role: e.target.value as UserRole})}>
                                <option value={UserRole.TEACHER}>Professor</option>
                                <option value={UserRole.MANAGER}>Gestor Escolar</option>
                                {user?.role === UserRole.ADMIN && <option value={UserRole.ADMIN}>Administrador</option>}
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <Select label="Plano de Acesso" value={userData.plan} onChange={e => setUserData({...userData, plan: e.target.value})}>
                                {availablePlans.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                            </Select>
                        </div>
                    </div>
                )}

                {activeTab === 'GRANTS' && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4">
                            <p className="text-xs text-blue-800 font-medium">Selecione as áreas que este usuário poderá gerenciar. Ele terá acesso a todas as disciplinas e tópicos dentro do componente curricular selecionado.</p>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 border p-4 rounded-2xl bg-slate-50 max-h-[400px] overflow-y-auto custom-scrollbar">
                            {hierarchy.length === 0 && <p className="col-span-full text-center py-8 text-slate-400 italic">Nenhum componente cadastrado no sistema.</p>}
                            {hierarchy.map(cc => (
                                <label key={cc.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 cursor-pointer hover:border-brand-blue hover:shadow-sm transition-all">
                                    <input type="checkbox" checked={Array.isArray(userData.subjects) && userData.subjects.includes(cc.id)} onChange={() => toggleSubject(cc.id)} className="w-5 h-5 text-brand-blue rounded" />
                                    <span className="text-xs font-bold text-slate-700">{cc.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default UsersPage;
