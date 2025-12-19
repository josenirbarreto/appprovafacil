
import React, { useState, useEffect } from 'react';
import { User, UserRole, Plan, Payment, Discipline } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { EmailService } from '../services/emailService'; 
import { Button, Card, Badge, Modal, Input, Select } from '../components/UI';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';

const UsersPage = () => {
    const { user, refreshUser } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);
    const [hierarchy, setHierarchy] = useState<Discipline[]>([]); 
    const [loading, setLoading] = useState(true);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'PROFILE' | 'FINANCE' | 'GRANTS'>('PROFILE');
    
    const [simulatedEmail, setSimulatedEmail] = useState<string | null>(null);
    const [resetLoading, setResetLoading] = useState(false);
    
    const [userPayments, setUserPayments] = useState<Payment[]>([]);
    const [newPayment, setNewPayment] = useState({ amount: 0, period: 1, plan: '' });
    
    const [userData, setUserData] = useState({ 
        name: '', 
        email: '', 
        role: UserRole.TEACHER, 
        plan: '',
        accessGrants: [] as string[],
        subjects: [] as string[] 
    });
    const [password, setPassword] = useState('');

    useEffect(() => { refreshUser(); }, []);
    useEffect(() => { loadData(); }, [user]);

    const loadData = async () => {
        try {
            const [u, p, h] = await Promise.all([
                FirebaseService.getUsers(user),
                FirebaseService.getPlans(),
                FirebaseService.getHierarchy(user) 
            ]);
            setUsers(u);
            setAvailablePlans(p);
            setHierarchy(h);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const isManager = user?.role === UserRole.MANAGER;
    const isAdmin = user?.role === UserRole.ADMIN;
    
    const managerPlan = isManager ? availablePlans.find(p => p.name === user?.plan) : null;
    const maxUsers = managerPlan?.limits?.maxUsers || 0; 
    const currentUsage = users.length;
    const usagePercent = maxUsers > 0 ? (currentUsage / maxUsers) * 100 : 0;
    const isLimitReached = isManager && maxUsers > 0 && currentUsage >= maxUsers;

    const openAddModal = () => {
        if (isLimitReached) return alert(`Limite de ${maxUsers} professores atingido.`);
        setEditingUserId(null); setActiveTab('PROFILE');
        const initialPlan = isManager && user?.plan ? user.plan : (availablePlans.length > 0 ? availablePlans[0].name : 'BASIC');
        setUserData({ name: '', email: '', role: UserRole.TEACHER, plan: initialPlan, accessGrants: [], subjects: [] });
        setPassword(''); setIsModalOpen(true);
    };

    const openEditModal = async (u: User) => {
        setEditingUserId(u.id); setActiveTab('PROFILE');
        setUserData({ 
            name: u.name, 
            email: u.email, 
            role: u.role, 
            plan: u.plan || 'BASIC', 
            accessGrants: u.accessGrants || [], 
            subjects: u.subjects || [] 
        });
        setPassword('');
        if (isAdmin) { try { const history = await FirebaseService.getPayments(u.id); setUserPayments(history); } catch (e) {} }
        setIsModalOpen(true);
    };

    const toggleGrant = (disciplineId: string) => {
        const current = userData.accessGrants || [];
        setUserData({ ...userData, accessGrants: current.includes(disciplineId) ? current.filter(id => id !== disciplineId) : [...current, disciplineId] });
    };

    const toggleSubject = (disciplineId: string) => {
        const current = userData.subjects || [];
        setUserData({ ...userData, subjects: current.includes(disciplineId) ? current.filter(id => id !== disciplineId) : [...current, disciplineId] });
    };

    const handleSaveUser = async () => {
        if (!user || !userData.name || !userData.email) return alert("Preencha todos os campos.");
        try {
            if (editingUserId) {
                await FirebaseService.updateUser(editingUserId, { 
                    name: userData.name, 
                    email: userData.email, 
                    role: userData.role, 
                    plan: userData.plan, 
                    accessGrants: userData.accessGrants, 
                    subjects: userData.subjects 
                });
                alert("Dados atualizados!");
            } else {
                const finalPassword = password || Math.random().toString(36).slice(-8);
                const newUser = await FirebaseService.createSubUser(user, { 
                    name: userData.name, 
                    email: userData.email, 
                    role: userData.role, 
                    subjects: userData.subjects, 
                    password: finalPassword 
                });
                // Atualiza plano e grants logo após criar
                await FirebaseService.updateUser(newUser.id, { 
                    plan: userData.plan,
                    accessGrants: userData.accessGrants 
                });
                
                const response: any = await EmailService.sendWelcomeCredentials(userData.email, userData.name, finalPassword);
                if (response && response.simulated) setSimulatedEmail(response.emailContent);
                else alert(`Sucesso! Credenciais enviadas para ${userData.email}.`);
            }
            setIsModalOpen(false); loadData();
        } catch (error: any) { alert("Erro ao salvar usuário."); }
    };

    const handleSendResetEmail = async () => {
        if (!userData.email) return; setResetLoading(true);
        try {
            await FirebaseService.resetPassword(userData.email).catch(() => {});
            const response: any = await EmailService.sendRecoveryInstructions(userData.email, userData.name);
            if (response && response.simulated) setSimulatedEmail(response.emailContent); else alert("E-mail enviado!");
        } finally { setResetLoading(false); }
    };

    const handleAddPayment = async () => {
        if (!editingUserId || !newPayment.plan) return;
        const currentUser = users.find(u => u.id === editingUserId);
        if (!currentUser) return;
        await FirebaseService.addPayment({ 
            userId: editingUserId, 
            userName: currentUser.name, 
            planName: newPayment.plan, 
            amount: newPayment.amount, 
            periodMonths: newPayment.period, 
            method: 'MANUAL', 
            status: 'PAID' 
        });
        loadData(); 
    };

    const calculateStatus = (u: User) => {
        const today = new Date().toISOString().split('T')[0];
        if (u.subscriptionEnd < today) return { label: 'Vencido', color: 'red' as const };
        if (u.status === 'INACTIVE') return { label: 'Inativo', color: 'red' as const };
        return { label: 'Ativo', color: 'green' as const };
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Carregando...</div>;

    return (
        <div className="p-8 h-full bg-slate-50 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-3xl font-display font-bold text-slate-800">{isManager ? 'Meus Professores' : 'Gestão de Usuários'}</h2>
                    <p className="text-slate-500">{isManager ? 'Gerencie o acesso da sua equipe pedagógica.' : 'Visão global de acesso e pagamentos.'}</p>
                </div>
                <Button onClick={openAddModal} disabled={isLimitReached}><Icons.Plus /> {isManager ? 'Novo Professor' : 'Novo Usuário'}</Button>
            </div>

            {isManager && (
                <div className="mb-6 bg-white border border-slate-200 p-4 rounded-lg shadow-sm">
                    <div className="flex justify-between items-end mb-2">
                        <div><h4 className="font-bold text-slate-800">Capacidade ({user?.plan || 'Nenhum'})</h4><p className="text-sm text-slate-500"><strong>{currentUsage}</strong> de <strong>{maxUsers}</strong> licenças.</p></div>
                        {isLimitReached && <Badge color="red">Limite Atingido</Badge>}
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5"><div className={`h-2.5 rounded-full transition-all duration-500 ${isLimitReached ? 'bg-red-500' : 'bg-brand-blue'}`} style={{ width: `${Math.min(usagePercent, 100)}%` }}></div></div>
                </div>
            )}

            <Card className="overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
                        <tr><th className="p-4">Usuário</th><th className="p-4">Função</th><th className="p-4">Plano</th><th className="p-4">Status</th><th className="p-4">Vencimento</th><th className="p-4 text-right">Ações</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {users.map(u => {
                            const status = calculateStatus(u);
                            return (
                                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold overflow-hidden">{u.photoUrl ? <img src={u.photoUrl} className="w-full h-full object-cover"/> : u.name.charAt(0)}</div><div><p className="font-bold text-slate-800">{u.name}</p><p className="text-xs text-slate-500">{u.email}</p></div></div></td>
                                    <td className="p-4"><Badge color={u.role === UserRole.MANAGER ? 'orange' : 'blue'}>{u.role}</Badge></td>
                                    <td className="p-4"><span className="text-sm font-bold text-slate-600">{u.plan || 'BASIC'}</span></td>
                                    <td className="p-4"><Badge color={status.color}>{status.label}</Badge></td>
                                    <td className="p-4 text-sm text-slate-600">{u.subscriptionEnd ? new Date(u.subscriptionEnd).toLocaleDateString() : '-'}</td>
                                    <td className="p-4 text-right"><div className="flex justify-end gap-2"><button onClick={() => openEditModal(u)} className="text-slate-400 hover:text-brand-blue p-2"><Icons.Edit /></button></div></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingUserId ? "Gerenciar Usuário" : "Adicionar Usuário"} footer={activeTab !== 'FINANCE' ? <Button onClick={handleSaveUser}>{editingUserId ? "Salvar Alterações" : "Cadastrar Usuário"}</Button> : null} maxWidth="max-w-4xl">
                <div className="flex gap-4 border-b border-slate-200 mb-6">
                    <button className={`pb-2 px-2 text-sm font-bold border-b-2 ${activeTab === 'PROFILE' ? 'border-brand-blue text-brand-blue' : 'border-transparent text-slate-500'}`} onClick={() => setActiveTab('PROFILE')}>Perfil</button>
                    {(isAdmin || isManager) && (
                        <button className={`pb-2 px-2 text-sm font-bold border-b-2 ${activeTab === 'GRANTS' ? 'border-brand-blue text-brand-blue' : 'border-transparent text-slate-500'}`} onClick={() => setActiveTab('GRANTS')}>Acesso Global</button>
                    )}
                    {isAdmin && editingUserId && (
                        <button className={`pb-2 px-2 text-sm font-bold border-b-2 ${activeTab === 'FINANCE' ? 'border-brand-blue text-brand-blue' : 'border-transparent text-slate-500'}`} onClick={() => setActiveTab('FINANCE')}>Financeiro</button>
                    )}
                </div>

                {activeTab === 'PROFILE' && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="grid grid-cols-2 gap-4">
                            <Input label="Nome Completo" value={userData.name} onChange={e => setUserData({...userData, name: e.target.value})} />
                            <Input label="Email Corporativo" type="email" value={userData.email} onChange={e => setUserData({...userData, email: e.target.value})} />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <Select label="Função no Sistema" value={userData.role} onChange={e => setUserData({...userData, role: e.target.value as any})} disabled={isManager && userData.role === UserRole.MANAGER}>
                                <option value={UserRole.TEACHER}>Professor</option>
                                <option value={UserRole.MANAGER}>Gestor Escolar</option>
                                {isAdmin && <option value={UserRole.ADMIN}>Administrador Master</option>}
                            </Select>
                            <Select label="Plano de Assinatura" value={userData.plan} onChange={e => setUserData({...userData, plan: e.target.value})}>
                                <option value="BASIC">Plano Basic</option>
                                {availablePlans.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                            </Select>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-4">
                            <label className="block text-sm font-bold text-slate-700 mb-1">Componentes Curriculares (Subjects)</label>
                            <p className="text-[10px] text-slate-500 uppercase mb-3">Defina quais disciplinas este professor leciona para organizar sua visualização.</p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto custom-scrollbar border border-slate-200 rounded-lg p-3 bg-white">
                                {hierarchy.map(d => (
                                    <label key={d.id} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 cursor-pointer rounded transition-colors">
                                        <input type="checkbox" className="rounded text-brand-blue" checked={userData.subjects?.includes(d.id)} onChange={() => toggleSubject(d.id)}/>
                                        <span className="text-xs font-medium text-slate-700 truncate">{d.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 mt-4">
                             <Input label={editingUserId ? "Alterar Senha Manualmente" : "Definir Senha Inicial"} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={editingUserId ? "Deixe em branco para manter" : "Mínimo 6 caracteres"} />
                             {editingUserId && (
                                <div className="mt-3 flex justify-between items-center">
                                    <p className="text-[10px] text-orange-700 font-bold uppercase">Ações de Segurança</p>
                                    <button type="button" onClick={handleSendResetEmail} className="text-brand-blue text-xs font-bold hover:underline flex items-center gap-1">
                                        {resetLoading ? 'Enviando...' : <><Icons.Mail /> Enviar Link de Recuperação</>}
                                    </button>
                                </div>
                             )}
                        </div>
                    </div>
                )}

                {activeTab === 'GRANTS' && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
                            <div className="p-2 bg-white rounded-lg text-brand-blue shadow-sm"><Icons.Shield /></div>
                            <div>
                                <h4 className="text-sm font-bold text-blue-900 uppercase tracking-tight">Licenciamento de Conteúdo (Acesso Global)</h4>
                                <p className="text-xs text-blue-700 mt-1">Marque as disciplinas abaixo para liberar o banco de questões completo para este usuário, independente do plano dele. Ideal para licenciamento de disciplinas avulsas.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto custom-scrollbar p-1">
                            {hierarchy.map(d => (
                                <div key={d.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${userData.accessGrants?.includes(d.id) ? 'bg-brand-blue/5 border-brand-blue shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'}`} onClick={() => toggleGrant(d.id)}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${userData.accessGrants?.includes(d.id) ? 'bg-brand-blue border-brand-blue text-white' : 'border-slate-300 bg-white'}`}>
                                            {userData.accessGrants?.includes(d.id) && <Icons.Check />}
                                        </div>
                                        <span className={`text-sm font-bold ${userData.accessGrants?.includes(d.id) ? 'text-brand-blue' : 'text-slate-700'}`}>{d.name}</span>
                                    </div>
                                    {userData.accessGrants?.includes(d.id) && <Badge color="blue">LIBERADO</Badge>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'FINANCE' && editingUserId && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <h4 className="text-sm font-bold text-slate-700 mb-4 uppercase">Registrar Pagamento Manual</h4>
                            <div className="grid grid-cols-3 gap-4 items-end">
                                <Input label="Valor (R$)" type="number" value={newPayment.amount} onChange={e => setNewPayment({...newPayment, amount: Number(e.target.value)})} />
                                <Select label="Meses de Acesso" value={newPayment.period} onChange={e => setNewPayment({...newPayment, period: Number(e.target.value)})}>
                                    <option value={1}>1 Mês</option>
                                    <option value={3}>3 Meses</option>
                                    <option value={6}>6 Meses</option>
                                    <option value={12}>1 Ano</option>
                                </Select>
                                <Button onClick={handleAddPayment} className="w-full justify-center">Registrar</Button>
                            </div>
                        </div>

                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr><th className="p-3">Data</th><th className="p-3">Plano</th><th className="p-3">Valor</th><th className="p-3 text-right">Status</th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {userPayments.map(p => (
                                        <tr key={p.id}>
                                            <td className="p-3 font-mono text-xs">{new Date(p.date).toLocaleDateString()}</td>
                                            <td className="p-3 font-bold">{p.planName}</td>
                                            <td className="p-3 text-emerald-600 font-bold">R$ {p.amount.toFixed(2)}</td>
                                            <td className="p-3 text-right"><Badge color="green">PAGO</Badge></td>
                                        </tr>
                                    ))}
                                    {userPayments.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-400">Nenhum pagamento registrado.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </Modal>

            <Modal isOpen={!!simulatedEmail} onClose={() => setSimulatedEmail(null)} title="E-mail Simulado" footer={<Button onClick={() => setSimulatedEmail(null)}>Fechar</Button>} maxWidth="max-w-2xl">
                <div className="border border-slate-200 rounded-lg overflow-hidden"><div className="p-6 bg-white whitespace-pre-line text-slate-800 font-medium">{simulatedEmail}</div></div>
            </Modal>
        </div>
    );
};

export default UsersPage;
