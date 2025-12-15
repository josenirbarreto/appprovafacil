
import React, { useState, useEffect } from 'react';
import { User, UserRole, Plan, Payment } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { EmailService } from '../services/emailService'; // Importação adicionada
import { Button, Card, Badge, Modal, Input, Select } from '../components/UI';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';

const UsersPage = () => {
    const { user, refreshUser } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    
    // States for Manager adding/editing Teacher
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'PROFILE' | 'FINANCE'>('PROFILE');
    
    // Estado para visualização do E-mail Simulado (NOVO)
    const [simulatedEmail, setSimulatedEmail] = useState<string | null>(null);
    const [resetLoading, setResetLoading] = useState(false);
    
    // States for Payments
    const [userPayments, setUserPayments] = useState<Payment[]>([]);
    const [newPayment, setNewPayment] = useState({
        amount: 0,
        period: 1, // meses
        plan: ''
    });
    
    // Estado do formulário de usuário
    const [userData, setUserData] = useState({ 
        name: '', 
        email: '', 
        role: UserRole.TEACHER, 
        plan: '' 
    });
    // Estado para alteração de senha
    const [password, setPassword] = useState('');

    // Atualiza dados do usuário atual (Gestor) ao entrar na tela para garantir limites atualizados
    useEffect(() => {
        refreshUser();
    }, []);

    useEffect(() => {
        loadData();
    }, [user]);

    const loadData = async () => {
        try {
            const [u, p] = await Promise.all([
                FirebaseService.getUsers(user),
                FirebaseService.getPlans()
            ]);
            setUsers(u);
            setAvailablePlans(p);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // Cálculos de Limites do Plano do Gestor
    const isManager = user?.role === UserRole.MANAGER;
    const isAdmin = user?.role === UserRole.ADMIN;
    
    const managerPlan = isManager ? availablePlans.find(p => p.name === user?.plan) : null;
    const maxUsers = managerPlan?.limits?.maxUsers || 0; 
    const currentUsage = users.length;
    const usagePercent = maxUsers > 0 ? (currentUsage / maxUsers) * 100 : 0;
    const isLimitReached = isManager && maxUsers > 0 && currentUsage >= maxUsers;

    const openAddModal = () => {
        if (isLimitReached) {
            return alert(`Você atingiu o limite de ${maxUsers} professores do seu plano "${user?.plan}". Faça um upgrade para adicionar mais.`);
        }

        setEditingUserId(null);
        setActiveTab('PROFILE');
        
        const initialPlan = isManager && user?.plan 
            ? user.plan 
            : (availablePlans.length > 0 ? availablePlans[0].name : 'BASIC');

        setUserData({ name: '', email: '', role: UserRole.TEACHER, plan: initialPlan });
        setPassword('');
        setIsModalOpen(true);
    };

    const openEditModal = async (u: User) => {
        setEditingUserId(u.id);
        setActiveTab('PROFILE');
        setUserData({ 
            name: u.name, 
            email: u.email,
            role: u.role,
            plan: u.plan
        });
        setPassword('');
        
        if (isAdmin) {
            try {
                const history = await FirebaseService.getPayments(u.id);
                setUserPayments(history);
            } catch (e) { console.error("Erro ao carregar pagamentos", e); }
        }
        
        setIsModalOpen(true);
    };

    const handleSaveUser = async () => {
        if (!user) return;
        if (!userData.name || !userData.email) return alert("Preencha todos os campos.");

        try {
            if (editingUserId) {
                await FirebaseService.updateUser(editingUserId, {
                    name: userData.name,
                    email: userData.email,
                    role: userData.role,
                    plan: userData.plan
                });

                if (password.trim()) {
                    await FirebaseService.adminSetManualPassword(editingUserId, password);
                }

                alert("Dados atualizados com sucesso!");
            } else {
                const newUser = await FirebaseService.createSubUser(user, {
                    name: userData.name,
                    email: userData.email,
                    role: userData.role
                });
                
                if (password.trim()) {
                    await FirebaseService.adminSetManualPassword(newUser.id, password);
                }
                
                alert("Usuário cadastrado com sucesso! (Senha definida)");
            }
            
            setIsModalOpen(false);
            setUserData({ name: '', email: '', role: UserRole.TEACHER, plan: '' });
            setPassword('');
            setEditingUserId(null);
            loadData();
            
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar usuário.");
        }
    };

    // FUNÇÃO ATUALIZADA: Lógica robusta de envio de e-mail com simulação
    const handleSendResetEmail = async () => {
        if (!userData.email) return alert("Email inválido");
        setResetLoading(true);
        try {
            // 1. Tenta reset nativo (funciona para usuários reais)
            // Ignoramos erro aqui pois usuários criados via 'createSubUser' não existem no Auth
            await FirebaseService.resetPassword(userData.email).catch(() => {});
            
            // 2. Tenta envio via EmailJS (ou Simulação)
            const response: any = await EmailService.sendRecoveryInstructions(userData.email, userData.name);

            if (response && response.simulated) {
                setSimulatedEmail(response.emailContent);
                // Opcional: fechar o modal de edição para focar no email
                // setIsModalOpen(false); 
            } else {
                alert(`E-mail de redefinição enviado com sucesso para ${userData.email}`);
            }
        } catch (e: any) {
            console.error(e);
            alert("Erro ao processar envio de e-mail.");
        } finally {
            setResetLoading(false);
        }
    };

    const handleAddPayment = async () => {
        if (!editingUserId || !newPayment.plan) return alert("Selecione um plano.");
        
        try {
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

            alert("Pagamento registrado e assinatura renovada!");
            
            const history = await FirebaseService.getPayments(editingUserId);
            setUserPayments(history);
            loadData(); 

        } catch (error) {
            console.error(error);
            alert("Erro ao registrar pagamento.");
        }
    };

    const handleDeleteUser = async (uId: string) => {
        if (!confirm("Tem certeza que deseja excluir este usuário? Ele perderá o acesso à plataforma.")) return;
        
        try {
            await FirebaseService.deleteUserDocument(uId);
            alert("Usuário excluído com sucesso.");
            loadData();
        } catch (error) {
            console.error(error);
            alert("Erro ao excluir usuário.");
        }
    };

    const calculateStatus = (u: User) => {
        const today = new Date().toISOString().split('T')[0];
        if (u.subscriptionEnd < today) return { label: 'Vencido', color: 'red' as const };
        if (u.status === 'INACTIVE') return { label: 'Inativo', color: 'red' as const };
        return { label: 'Ativo', color: 'green' as const };
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Carregando usuários...</div>;

    if (user?.role === UserRole.TEACHER) return <div className="p-8">Acesso restrito.</div>;

    return (
        <div className="p-8 h-full bg-slate-50 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-3xl font-display font-bold text-slate-800">
                        {isManager ? 'Meus Professores' : 'Gestão de Usuários'}
                    </h2>
                    <p className="text-slate-500">
                        {isManager ? 'Gerencie o acesso da sua equipe pedagógica.' : 'Visão global de acesso e pagamentos.'}
                    </p>
                </div>
                
                <Button onClick={openAddModal} disabled={isLimitReached} className={isLimitReached ? "opacity-50 cursor-not-allowed" : ""}>
                    <Icons.Plus /> {isManager ? 'Novo Professor' : 'Novo Usuário'}
                </Button>
            </div>

            {isManager && (
                <div className="mb-6 bg-white border border-slate-200 p-4 rounded-lg shadow-sm">
                    <div className="flex justify-between items-end mb-2">
                        <div>
                            <h4 className="font-bold text-slate-800">Capacidade do Plano ({user?.plan})</h4>
                            <p className="text-sm text-slate-500">
                                Você está utilizando <strong>{currentUsage}</strong> de <strong>{maxUsers}</strong> licenças disponíveis.
                            </p>
                        </div>
                        {isLimitReached && (
                            <Badge color="red">Limite Atingido</Badge>
                        )}
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full bg-slate-100 rounded-full h-2.5">
                        <div 
                            className={`h-2.5 rounded-full transition-all duration-500 ${isLimitReached ? 'bg-red-500' : 'bg-brand-blue'}`} 
                            style={{ width: `${Math.min(usagePercent, 100)}%` }}
                        ></div>
                    </div>
                </div>
            )}

            <Card className="overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="p-4 font-semibold text-slate-600 text-sm">Usuário</th>
                            <th className="p-4 font-semibold text-slate-600 text-sm">Função</th>
                            <th className="p-4 font-semibold text-slate-600 text-sm">Status</th>
                            <th className="p-4 font-semibold text-slate-600 text-sm">Plano</th>
                            <th className="p-4 font-semibold text-slate-600 text-sm">Vencimento</th>
                            <th className="p-4 font-semibold text-slate-600 text-sm text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {users.length === 0 && (
                            <tr><td colSpan={6} className="p-8 text-center text-slate-400">Nenhum usuário encontrado.</td></tr>
                        )}
                        {users.map(u => {
                            const status = calculateStatus(u);
                            return (
                                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold overflow-hidden">
                                                {u.photoUrl ? <img src={u.photoUrl} className="w-full h-full object-cover"/> : u.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800">{u.name}</p>
                                                <p className="text-xs text-slate-500">{u.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <Badge color={u.role === UserRole.ADMIN ? 'purple' : u.role === UserRole.MANAGER ? 'orange' : 'blue'}>
                                            {u.role === UserRole.MANAGER ? 'Gestor' : u.role === UserRole.TEACHER ? 'Professor' : 'Admin'}
                                        </Badge>
                                    </td>
                                    <td className="p-4">
                                        <Badge color={status.color}>{status.label}</Badge>
                                    </td>
                                    <td className="p-4 text-sm text-slate-600">{u.plan}</td>
                                    <td className="p-4 text-sm text-slate-600">
                                        {u.subscriptionEnd ? new Date(u.subscriptionEnd).toLocaleDateString() : '-'}
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button 
                                                onClick={() => openEditModal(u)} 
                                                className="text-slate-400 hover:text-brand-blue p-2 rounded hover:bg-blue-50 transition-colors" 
                                                title="Editar"
                                            >
                                                <Icons.Edit />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteUser(u.id)} 
                                                className="text-slate-400 hover:text-red-500 p-2 rounded hover:bg-red-50 transition-colors" 
                                                title="Excluir"
                                            >
                                                <Icons.Trash />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </Card>

            <Modal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                title={editingUserId ? "Gerenciar Usuário" : "Adicionar Usuário"} 
                footer={activeTab === 'PROFILE' ? <Button onClick={handleSaveUser}>{editingUserId ? "Salvar Alterações" : "Cadastrar"}</Button> : null}
                maxWidth="max-w-4xl"
            >
                {/* TABS */}
                {editingUserId && isAdmin && (
                    <div className="flex gap-4 border-b border-slate-200 mb-6">
                        <button 
                            className={`pb-2 px-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'PROFILE' ? 'border-brand-blue text-brand-blue' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            onClick={() => setActiveTab('PROFILE')}
                        >
                            Perfil e Acesso
                        </button>
                        <button 
                            className={`pb-2 px-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'FINANCE' ? 'border-brand-blue text-brand-blue' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            onClick={() => setActiveTab('FINANCE')}
                        >
                            Assinatura e Financeiro
                        </button>
                    </div>
                )}

                {/* PROFILE TAB */}
                {activeTab === 'PROFILE' && (
                    <div className="space-y-4">
                        <p className="text-sm text-slate-500">
                            {editingUserId 
                            ? "Atualize os dados e permissões do usuário." 
                            : "Preencha os dados do novo usuário."}
                        </p>
                        
                        <Input 
                            label="Nome Completo" 
                            value={userData.name} 
                            onChange={e => setUserData({...userData, name: e.target.value})} 
                            placeholder="Ex: João da Silva" 
                        />
                        
                        <Input 
                            label="Email Corporativo" 
                            type="email" 
                            value={userData.email} 
                            onChange={e => setUserData({...userData, email: e.target.value})} 
                            placeholder="joao@escola.com" 
                        />

                        {/* SEÇÃO DE SENHA / ACESSO */}
                        <div className="bg-orange-50 p-4 rounded-lg border border-orange-200 mt-4 animate-fade-in">
                             <div className="flex items-center gap-2 mb-3">
                                 <div className="text-orange-500"><Icons.UsersGroup /></div>
                                 <h4 className="text-sm font-bold text-orange-900 uppercase">Segurança e Acesso</h4>
                             </div>
                             
                             <div className="space-y-4">
                                 <Input 
                                     label={editingUserId ? "Definir Nova Senha (Opcional)" : "Senha Inicial (Opcional)"}
                                     type="password"
                                     value={password}
                                     onChange={e => setPassword(e.target.value)}
                                     placeholder={editingUserId ? "Deixe em branco para não alterar" : "Digite para definir uma senha manual"}
                                 />
                                 
                                 {editingUserId && (
                                     <div className="flex items-center justify-between text-xs text-slate-500 border-t border-orange-200 pt-3 mt-2">
                                         <span>Alternativa recomendada:</span>
                                         <button 
                                             type="button" 
                                             onClick={handleSendResetEmail}
                                             disabled={resetLoading}
                                             className="text-brand-blue hover:underline font-bold disabled:opacity-50"
                                         >
                                             {resetLoading ? 'Simulando envio...' : 'Enviar E-mail de Redefinição para o Usuário'}
                                         </button>
                                     </div>
                                 )}
                             </div>
                        </div>

                        {isAdmin ? (
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                                <Select 
                                    label="Função (Role)" 
                                    value={userData.role} 
                                    onChange={e => setUserData({...userData, role: e.target.value as UserRole})}
                                >
                                    <option value={UserRole.TEACHER}>Professor</option>
                                    <option value={UserRole.MANAGER}>Gestor</option>
                                    <option value={UserRole.ADMIN}>Administrador</option>
                                </Select>

                                <Select 
                                    label="Plano (Apenas rótulo)" 
                                    value={userData.plan} 
                                    onChange={e => setUserData({...userData, plan: e.target.value})}
                                >
                                    <option value="">Selecione um plano...</option>
                                    {availablePlans.map(p => (
                                        <option key={p.id} value={p.name}>
                                            {p.name} {p.price > 0 ? `(R$ ${p.price})` : '(Grátis)'}
                                        </option>
                                    ))}
                                    {!availablePlans.some(p => p.name === userData.plan) && userData.plan && (
                                        <option value={userData.plan}>{userData.plan} (Legado)</option>
                                    )}
                                </Select>
                            </div>
                        ) : (
                            // Visualização para Gestor: Mostra que o plano é herdado
                            <div className="mt-4 pt-4 border-t border-slate-100 animate-fade-in">
                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between items-center">
                                    <div>
                                        <p className="text-xs font-bold text-slate-500 uppercase">Plano e Licença</p>
                                        <p className="font-semibold text-slate-700">{userData.plan}</p>
                                    </div>
                                    <Badge color="blue">Herdado do Gestor</Badge>
                                </div>
                                <p className="text-xs text-slate-500 mt-2">
                                    O professor terá acesso aos mesmos recursos e data de vencimento do seu plano.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* FINANCIAL TAB */}
                {activeTab === 'FINANCE' && editingUserId && isAdmin && (
                    <div className="space-y-6 animate-fade-in">
                        {/* Status Atual */}
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex justify-between items-center">
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase">Vencimento Atual</p>
                                <p className="text-lg font-bold text-slate-800">
                                    {users.find(u => u.id === editingUserId)?.subscriptionEnd 
                                        ? new Date(users.find(u => u.id === editingUserId)!.subscriptionEnd).toLocaleDateString()
                                        : 'Indefinido'}
                                </p>
                            </div>
                            <Badge color={users.find(u => u.id === editingUserId)?.plan ? 'blue' : 'red'}>
                                {users.find(u => u.id === editingUserId)?.plan || 'Sem Plano'}
                            </Badge>
                        </div>

                        {/* Adicionar Pagamento */}
                        <div className="border rounded-lg p-4 border-blue-200 bg-blue-50/50">
                            <h4 className="font-bold text-brand-blue mb-3 flex items-center gap-2">
                                <Icons.Plus /> Registrar Renovação / Pagamento
                            </h4>
                            <div className="grid grid-cols-3 gap-3 mb-3">
                                <Select 
                                    label="Plano Renovado" 
                                    value={newPayment.plan} 
                                    onChange={e => setNewPayment({...newPayment, plan: e.target.value})}
                                >
                                    <option value="">Selecione...</option>
                                    {availablePlans.map(p => (
                                        <option key={p.id} value={p.name}>{p.name}</option>
                                    ))}
                                </Select>
                                <Select 
                                    label="Duração" 
                                    value={newPayment.period} 
                                    onChange={e => {
                                        const period = Number(e.target.value);
                                        // Auto-calcula valor baseado no plano selecionado
                                        const plan = availablePlans.find(p => p.name === newPayment.plan);
                                        const price = plan ? plan.price : 0;
                                        // Lógica simples: Se for 12 meses, assume anual, senão mensal
                                        const multiplier = period; 
                                        setNewPayment({...newPayment, period, amount: price * multiplier});
                                    }}
                                >
                                    <option value={1}>+ 1 Mês</option>
                                    <option value={3}>+ 3 Meses</option>
                                    <option value={6}>+ 6 Meses</option>
                                    <option value={12}>+ 1 Ano</option>
                                </Select>
                                <Input 
                                    label="Valor Pago (R$)" 
                                    type="number" 
                                    step="0.01"
                                    value={newPayment.amount} 
                                    onChange={e => setNewPayment({...newPayment, amount: Number(e.target.value)})} 
                                />
                            </div>
                            <Button onClick={handleAddPayment} className="w-full justify-center">Confirmar Pagamento</Button>
                        </div>

                        {/* Histórico */}
                        <div>
                            <h4 className="font-bold text-slate-700 mb-2">Histórico de Pagamentos</h4>
                            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500">
                                        <tr>
                                            <th className="p-2">Data</th>
                                            <th className="p-2">Plano</th>
                                            <th className="p-2">Valor</th>
                                            <th className="p-2">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {userPayments.length === 0 && (
                                            <tr><td colSpan={4} className="p-4 text-center text-slate-400">Nenhum pagamento registrado.</td></tr>
                                        )}
                                        {userPayments.map(pay => (
                                            <tr key={pay.id}>
                                                <td className="p-2">{new Date(pay.date).toLocaleDateString()}</td>
                                                <td className="p-2">{pay.planName} (+{pay.periodMonths}m)</td>
                                                <td className="p-2">R$ {pay.amount.toFixed(2)}</td>
                                                <td className="p-2"><Badge color="green">Pago</Badge></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* MODAL DE SIMULAÇÃO DE E-MAIL (NOVO) */}
            <Modal
                isOpen={!!simulatedEmail}
                onClose={() => setSimulatedEmail(null)}
                title="[Ambiente de Teste] E-mail Enviado"
                footer={<Button onClick={() => setSimulatedEmail(null)}>Fechar</Button>}
                maxWidth="max-w-2xl"
            >
                <div className="space-y-4">
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 text-sm text-yellow-800">
                        <p className="font-bold">Modo Simulação Ativo</p>
                        <p>Como as chaves de e-mail não estão configuradas ou o usuário é simulado, exibimos aqui o conteúdo que seria enviado.</p>
                    </div>
                    
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <div className="bg-slate-50 p-2 border-b border-slate-200 text-xs text-slate-500 font-mono">
                            Para: {userData.email}
                        </div>
                        <div className="p-6 bg-white whitespace-pre-line text-slate-800 font-medium">
                            {simulatedEmail}
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default UsersPage;
