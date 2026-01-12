
import React, { useState, useEffect, useMemo } from 'react';
import { User, Plan, Payment, UserRole } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { Card, Badge, Button, Modal, Select } from '../components/UI';
import { Icons } from '../components/Icons';
import { SimpleBarChart } from '../components/Charts';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const YEARS = [2024, 2025, 2026];

const FinancePage = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'GLOBAL' | 'MONTHLY'>('GLOBAL');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    
    // Estados do Modal
    const [showReportModal, setShowReportModal] = useState(false);
    const [isActionLoading, setIsActionLoading] = useState(false);
    
    // Dados brutos
    const [allPayments, setAllPayments] = useState<Payment[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [plans, setPlans] = useState<Plan[]>([]);

    // Métricas Calculadas
    const [metrics, setMetrics] = useState({
        mrr: 0,
        totalRevenueYTD: 0,
        activeSubscribers: 0,
        churnRisk: 0,
        arpu: 0
    });

    const [chartData, setChartData] = useState<{ label: string, value: number }[]>([]);
    const [expiringUsers, setExpiringUsers] = useState<User[]>([]);

    useEffect(() => {
        if (user?.role === UserRole.ADMIN) {
            loadData();
        } else {
            setLoading(false);
        }
    }, [user]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [payments, usersData, plansData] = await Promise.all([
                FirebaseService.getAllPayments(),
                FirebaseService.getUsers({ role: UserRole.ADMIN } as User),
                FirebaseService.getPlans()
            ]);

            setAllPayments(payments);
            setAllUsers(usersData);
            setPlans(plansData);

            calculateMetrics(payments, usersData, plansData);
        } catch (error) {
            console.error("Erro ao carregar financeiro:", error);
        } finally {
            setLoading(false);
        }
    };

    const calculateMetrics = (payments: Payment[], users: User[], plans: Plan[]) => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const todayStr = now.toISOString().split('T')[0];
        
        const ytdRevenue = payments
            .filter(p => new Date(p.date).getFullYear() === currentYear && p.status === 'PAID')
            .reduce((acc, curr) => acc + curr.amount, 0);

        let currentMrr = 0;
        let activeCount = 0;
        let riskCount = 0;
        const expiringList: User[] = [];

        users.forEach(u => {
            if (u.role === UserRole.ADMIN || u.status === 'INACTIVE') return;

            if (u.subscriptionEnd >= todayStr) {
                activeCount++;
                const userPlan = plans.find(p => p.name === u.plan);
                if (userPlan && userPlan.price > 0) {
                    if (userPlan.interval === 'yearly') currentMrr += userPlan.price / 12;
                    else if (userPlan.interval === 'monthly') currentMrr += userPlan.price;
                }

                const daysUntilExpire = Math.ceil((new Date(u.subscriptionEnd).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                if (daysUntilExpire <= 7 && daysUntilExpire >= 0) {
                    riskCount++;
                    expiringList.push(u);
                }
            }
        });

        const arpu = activeCount > 0 ? (currentMrr / activeCount) : 0;

        const monthlyData: Record<string, number> = {};
        const monthsLabel = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${monthsLabel[d.getMonth()]}/${d.getFullYear().toString().substr(2)}`;
            monthlyData[key] = 0;
        }

        payments.forEach(p => {
            if (p.status !== 'PAID') return;
            const pDate = new Date(p.date);
            const diffTime = Math.abs(now.getTime() - pDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            if (diffDays <= 365) {
                const key = `${monthsLabel[pDate.getMonth()]}/${pDate.getFullYear().toString().substr(2)}`;
                if (monthlyData[key] !== undefined) monthlyData[key] += p.amount;
            }
        });

        const chart = Object.entries(monthlyData).map(([label, value]) => ({ label, value }));

        setMetrics({
            mrr: currentMrr,
            totalRevenueYTD: ytdRevenue,
            activeSubscribers: activeCount,
            churnRisk: riskCount,
            arpu: arpu
        });
        setChartData(chart);
        setExpiringUsers(expiringList);
    };

    const handleCreateMonthlyPayment = async (u: User, monthIdx: number) => {
        if (isActionLoading) return;
        
        const monthName = MONTHS[monthIdx];
        const year = selectedYear;
        
        if (!confirm(`Deseja registrar o pagamento de ${monthName}/${year} para ${u.name}?`)) return;

        setIsActionLoading(true);
        try {
            const userPlan = plans.find(p => p.name === u.plan);
            const amount = userPlan ? userPlan.price : 0;
            
            // Criar data no meio do mês para evitar erros de virada
            const paymentDate = new Date(year, monthIdx, 15).toISOString();

            await FirebaseService.addPayment({
                userId: u.id,
                userName: u.name,
                planName: u.plan,
                amount: amount,
                periodMonths: 1,
                status: 'PAID',
                method: 'MANUAL_CHECK',
                date: paymentDate
            });

            await loadData();
        } catch (e) {
            alert("Erro ao registrar pagamento.");
        } finally {
            setIsActionLoading(false);
        }
    };

    // Helper para verificar se um mês está pago
    const isMonthPaid = (userId: string, monthIdx: number) => {
        return allPayments.some(p => {
            const pDate = new Date(p.date);
            return p.userId === userId && 
                   p.status === 'PAID' && 
                   pDate.getMonth() === monthIdx && 
                   pDate.getFullYear() === selectedYear;
        });
    };

    const subscribers = useMemo(() => {
        return allUsers.filter(u => u.role !== UserRole.ADMIN).sort((a, b) => a.name.localeCompare(b.name));
    }, [allUsers]);

    if (user?.role !== UserRole.ADMIN) return <Navigate to="/" />;
    if (loading && allUsers.length === 0) return <div className="p-8 text-center text-slate-500">Carregando painel financeiro...</div>;

    return (
        <div className="p-8 h-full bg-slate-50 overflow-y-auto custom-scrollbar print:p-0 print:bg-white">
            <div className="flex justify-between items-center mb-6 print:hidden">
                <div>
                    <h2 className="text-3xl font-display font-bold text-slate-800 flex items-center gap-2">
                        <Icons.Bank /> Gestão Financeira
                    </h2>
                    <p className="text-slate-500">Controle de faturamento e mensalidades.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={loadData} disabled={isActionLoading}>
                        <Icons.Refresh /> {isActionLoading ? 'Sincronizando...' : 'Atualizar'}
                    </Button>
                    <Button variant="secondary" onClick={() => setShowReportModal(true)}>
                        <Icons.FileText /> Exportar
                    </Button>
                </div>
            </div>

            {/* Abas */}
            <div className="flex gap-4 border-b border-slate-200 mb-8 print:hidden">
                <button 
                    className={`pb-3 px-4 text-sm font-black uppercase tracking-widest transition-all ${activeTab === 'GLOBAL' ? 'border-b-4 border-brand-blue text-brand-blue' : 'text-slate-400 hover:text-slate-600'}`}
                    onClick={() => setActiveTab('GLOBAL')}
                >
                    Financeiro Global
                </button>
                <button 
                    className={`pb-3 px-4 text-sm font-black uppercase tracking-widest transition-all ${activeTab === 'MONTHLY' ? 'border-b-4 border-brand-blue text-brand-blue' : 'text-slate-400 hover:text-slate-600'}`}
                    onClick={() => setActiveTab('MONTHLY')}
                >
                    Mensalidades
                </button>
            </div>

            {activeTab === 'GLOBAL' ? (
                <div className="animate-fade-in">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 print:grid-cols-4 print:gap-4">
                        <Card className="border-l-4 border-emerald-500 shadow-sm">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">MRR Estimado</p>
                            <p className="text-3xl font-black text-slate-800 mt-1">R$ {metrics.mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </Card>
                        <Card className="border-l-4 border-blue-500 shadow-sm">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Receita {new Date().getFullYear()}</p>
                            <p className="text-3xl font-black text-slate-800 mt-1">R$ {metrics.totalRevenueYTD.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </Card>
                        <Card className="border-l-4 border-purple-500 shadow-sm">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Assinantes</p>
                            <p className="text-3xl font-black text-slate-800 mt-1">{metrics.activeSubscribers}</p>
                        </Card>
                        <Card className="border-l-4 border-orange-500 shadow-sm">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Churn Risk</p>
                            <p className="text-3xl font-black text-slate-800 mt-1">{metrics.churnRisk}</p>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2">
                            <Card title="Evolução da Receita (R$)" className="h-full">
                                <SimpleBarChart 
                                    data={chartData.map(d => ({ ...d, color: '#10b981' }))} 
                                    valuePrefix="R$ " 
                                    valueSuffix=""
                                />
                            </Card>
                        </div>
                        <Card title="Recentes" className="max-h-[450px] overflow-hidden flex flex-col">
                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                                {allPayments.slice(0, 15).map(p => (
                                    <div key={p.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center">
                                        <div className="overflow-hidden">
                                            <p className="font-bold text-sm text-slate-800 truncate">{p.userName}</p>
                                            <p className="text-[10px] text-slate-400 uppercase font-black">{new Date(p.date).toLocaleDateString()}</p>
                                        </div>
                                        <p className="font-black text-emerald-600 text-sm">R$ {p.amount.toFixed(2)}</p>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>
                </div>
            ) : (
                <div className="animate-fade-in space-y-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                           <div className="p-2 bg-blue-100 text-brand-blue rounded-lg">
                               <Icons.Magic className="w-5 h-5" />
                           </div>
                           <div>
                               <p className="text-sm text-blue-900 font-bold">Matriz de Recebimento {selectedYear}</p>
                               <p className="text-[10px] text-blue-600 uppercase font-black">Clique no checkbox para gerar baixa manual</p>
                           </div>
                        </div>
                        <div className="w-32">
                            <Select 
                                value={selectedYear} 
                                onChange={e => setSelectedYear(Number(e.target.value))}
                                className="h-9 font-black text-xs"
                            >
                                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                            </Select>
                        </div>
                    </div>
                    
                    <Card className="overflow-hidden p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="p-4 font-black text-slate-500 uppercase text-[10px] sticky left-0 bg-slate-50 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">Assinante</th>
                                        {MONTHS.map(m => (
                                            <th key={m} className="p-2 font-black text-slate-500 uppercase text-[10px] text-center min-w-[60px]">{m}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {subscribers.map(sub => (
                                        <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-4 sticky left-0 bg-white group-hover:bg-slate-50 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                                                <p className="font-bold text-slate-800 truncate max-w-[150px]">{sub.name}</p>
                                                <p className="text-[9px] text-slate-400 font-black uppercase tracking-tighter">{sub.plan}</p>
                                            </td>
                                            {MONTHS.map((_, idx) => {
                                                const paid = isMonthPaid(sub.id, idx);
                                                return (
                                                    <td key={idx} className="p-2 text-center">
                                                        <input 
                                                            type="checkbox"
                                                            checked={paid}
                                                            disabled={paid || isActionLoading}
                                                            onChange={() => handleCreateMonthlyPayment(sub, idx)}
                                                            className={`w-5 h-5 rounded cursor-pointer transition-all ${paid ? 'text-green-500 bg-green-50 border-green-200 opacity-50' : 'text-brand-blue border-slate-300 hover:border-brand-blue'}`}
                                                        />
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            )}

            {/* MODAL DE RELATÓRIOS (Simplificado) */}
            <Modal isOpen={showReportModal} onClose={() => setShowReportModal(false)} title="Exportar Dados">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                    <Button variant="outline" className="h-20 flex-col" onClick={() => alert('Exportando CSV...')}>
                        <Icons.Download /> CSV de Transações
                    </Button>
                    <Button variant="outline" className="h-20 flex-col" onClick={() => window.print()}>
                        <Icons.Printer /> Imprimir Resumo
                    </Button>
                </div>
            </Modal>
        </div>
    );
};

export default FinancePage;
