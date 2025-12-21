
import React, { useState, useEffect } from 'react';
import { User, UserRole, Plan, Payment, CurricularComponent } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { EmailService } from '../services/emailService'; 
import { Button, Card, Badge, Modal, Input, Select } from '../components/UI';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';

const UsersPage = () => {
    const { user, refreshUser } = useAuth();
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
            setUsers(u);
            setAvailablePlans(p);
            setHierarchy(h);
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

    const toggleGrant = (ccId: string) => {
        const current = userData.accessGrants || [];
        setUserData({ ...userData, accessGrants: current.includes(ccId) ? current.filter(id => id !== ccId) : [...current, ccId] });
    };

    const toggleSubject = (ccId: string) => {
        const current = userData.subjects || [];
        setUserData({ ...userData, subjects: current.includes(ccId) ? current.filter(id => id !== ccId) : [...current, ccId] });
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Carregando...</div>;

    return (
        <div className="p-8 h-full bg-slate-50 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-display font-bold text-slate-800">Usuários</h2>
                <Button onClick={() => { setEditingUserId(null); setIsModalOpen(true); }}><Icons.Plus /> Novo</Button>
            </div>

            <Card className="overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
                        <tr><th className="p-4">Usuário</th><th className="p-4">Função</th><th className="p-4">Status</th><th className="p-4 text-right">Ações</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {users.map(u => (
                            <tr key={u.id} className="hover:bg-slate-50">
                                <td className="p-4">
                                    <p className="font-bold text-slate-800">{u.name}</p>
                                    <p className="text-xs text-slate-500">{u.email}</p>
                                </td>
                                <td className="p-4"><Badge>{u.role}</Badge></td>
                                <td className="p-4"><Badge color={u.status === 'ACTIVE' ? 'green' : 'red'}>{u.status}</Badge></td>
                                <td className="p-4 text-right"><button onClick={() => { setEditingUserId(u.id); setUserData({...u, accessGrants: u.accessGrants || [], subjects: u.subjects || []}); setIsModalOpen(true); }} className="text-slate-400 hover:text-brand-blue"><Icons.Edit /></button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Gerenciar Usuário" maxWidth="max-w-4xl" footer={<Button onClick={handleSaveUser}>Salvar</Button>}>
                <div className="flex gap-4 border-b border-slate-200 mb-6">
                    <button className={`pb-2 px-2 text-sm font-bold border-b-2 ${activeTab === 'PROFILE' ? 'border-brand-blue text-brand-blue' : 'border-transparent text-slate-500'}`} onClick={() => setActiveTab('PROFILE')}>Perfil</button>
                    <button className={`pb-2 px-2 text-sm font-bold border-b-2 ${activeTab === 'GRANTS' ? 'border-brand-blue text-brand-blue' : 'border-transparent text-slate-500'}`} onClick={() => setActiveTab('GRANTS')}>Componentes Curriculares</button>
                </div>

                {activeTab === 'PROFILE' && (
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Nome" value={userData.name} onChange={e => setUserData({...userData, name: e.target.value})} />
                        <Input label="Email" value={userData.email} onChange={e => setUserData({...userData, email: e.target.value})} />
                    </div>
                )}

                {activeTab === 'GRANTS' && (
                    <div className="space-y-4">
                        <h4 className="font-bold text-slate-800 text-sm uppercase">Atribuir Áreas de Atuação</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 border p-4 rounded-xl bg-slate-50">
                            {hierarchy.map(cc => (
                                <label key={cc.id} className="flex items-center gap-2 p-2 bg-white rounded border cursor-pointer hover:bg-blue-50">
                                    <input type="checkbox" checked={userData.subjects?.includes(cc.id)} onChange={() => toggleSubject(cc.id)} />
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
