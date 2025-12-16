
import React, { useState, useEffect } from 'react';
import { User, Plan, Payment, UserRole } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { Card, Badge, Button, Modal } from '../components/UI';
import { Icons } from '../components/Icons';
import { SimpleBarChart } from '../components/Charts';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

const FinancePage = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    
    // Estados do Modal de Relatórios
    const [showReportModal, setShowReportModal] = useState(false);
    
    // Dados brutos
    const [allPayments, setAllPayments] = useState<Payment[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [plans, setPlans] = useState<Plan[]>([]);

    // Métricas Calculadas
    const [metrics, setMetrics] = useState({
        mrr: 0,
        totalRevenueYTD: 0,
        activeSubscribers: 0,
        churnRisk: 0, // Usuários vencendo em < 7 dias
        arpu: 0 // Average Revenue Per User
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
        try {
            const [payments, usersData, plansData] = await Promise.all([
                FirebaseService.getAllPayments(),
                FirebaseService.getUsers({ role: UserRole.ADMIN } as User), // Passa admin user para pegar tudo
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
        
        // 1. Receita YTD (Year to Date)
        const ytdRevenue = payments
            .filter(p => new Date(p.date).getFullYear() === currentYear && p.status === 'PAID')
            .reduce((acc, curr) => acc + curr.amount, 0);

        // 2. MRR (Receita Recorrente Mensal Aproximada)
        // Lógica: Soma do valor mensal de todos os usuários ativos
        let currentMrr = 0;
        let activeCount = 0;
        let riskCount = 0;
        const expiringList: User[] = [];

        users.forEach(u => {
            // Ignora Admins e Inativos
            if (u.role === UserRole.ADMIN || u.status === 'INACTIVE') return;

            // Verifica se está ativo (vencimento futuro)
            if (u.subscriptionEnd >= todayStr) {
                activeCount++;
                
                // Calcula valor mensal do plano
                const userPlan = plans.find(p => p.name === u.plan);
                if (userPlan && userPlan.price > 0) {
                    if (userPlan.interval === 'yearly') {
                        currentMrr += userPlan.price / 12;
                    } else if (userPlan.interval === 'monthly') {
                        currentMrr += userPlan.price;
                    }
                }

                // Risco de Churn: Vence nos próximos 7 dias
                const daysUntilExpire = Math.ceil((new Date(u.subscriptionEnd).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                if (daysUntilExpire <= 7 && daysUntilExpire >= 0) {
                    riskCount++;
                    expiringList.push(u);
                }
            } else {
                // Vencido recentemente (opcional: lógica de churn real seria aqui)
            }
        });

        // 3. ARPU (Ticket Médio)
        const arpu = activeCount > 0 ? (currentMrr / activeCount) : 0;

        // 4. Gráfico: Receita últimos 12 meses
        const monthlyData: Record<string, number> = {};
        const monthsLabel = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        
        // Inicializa últimos 12 meses com 0
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${monthsLabel[d.getMonth()]}/${d.getFullYear().toString().substr(2)}`;
            monthlyData[key] = 0;
        }

        payments.forEach(p => {
            if (p.status !== 'PAID') return;
            const pDate = new Date(p.date);
            // Se estiver dentro da janela de 12 meses
            const diffTime = Math.abs(now.getTime() - pDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            if (diffDays <= 365) {
                const key = `${monthsLabel[pDate.getMonth()]}/${pDate.getFullYear().toString().substr(2)}`;
                if (monthlyData[key] !== undefined) {
                    monthlyData[key] += p.amount;
                }
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

    // --- REPORT FUNCTIONS ---
    const exportCSV = (data: any[], filename: string) => {
        if (data.length === 0) return alert("Sem dados para exportar.");
        
        const headers = Object.keys(data[0]).join(',');
        const rows = data.map(obj => Object.values(obj).map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
        const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join('\n');
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportTransactions = () => {
        const data = allPayments.map(p => ({
            Data: new Date(p.date).toLocaleDateString(),
            Hora: new Date(p.date).toLocaleTimeString(),
            Cliente: p.userName,
            Plano: p.planName,
            Valor: p.amount,
            Status: p.status,
            Metodo: p.method
        }));
        exportCSV(data, `transacoes_${new Date().toISOString().slice(0,10)}.csv`);
    };

    const handleExportSubscribers = () => {
        const data = allUsers.filter(u => u.role !== UserRole.ADMIN).map(u => ({
            Nome: u.name,
            Email: u.email,
            Funcao: u.role,
            Plano: u.plan,
            Status: u.status,
            Vencimento: u.subscriptionEnd,
            DataCadastro: u.id // Usando ID como proxy se data de criação não existir no modelo
        }));
        exportCSV(data, `assinantes_${new Date().toISOString().slice(0,10)}.csv`);
    };

    const handlePrintReport = () => {
        setShowReportModal(false);
        setTimeout(() => window.print(), 300);
    };

    if (user?.role !== UserRole.ADMIN) {
        return <Navigate to="/" />;
    }

    if (loading) return <div className="p-8 text-center text-slate-500">Carregando dados financeiros...</div>;

    return (
        <div className="p-8 h-full bg-slate-50 overflow-y-auto custom-scrollbar print:p-0 print:bg-white">
            <div className="flex justify-between items-center mb-8 print:hidden">
                <div>
                    <h2 className="text-3xl font-display font-bold text-slate-800 flex items-center gap-2">
                        <Icons.Bank /> Financeiro Global
                    </h2>
                    <p className="text-slate-500">Visão macroeconômica da plataforma SaaS.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-sm text-slate-400 font-mono bg-white px-3 py-1 rounded border border-slate-200">
                        Atualizado: {new Date().toLocaleTimeString()}
                    </div>
                    <Button variant="secondary" onClick={() => setShowReportModal(true)}>
                        <Icons.FileText /> Relatórios
                    </Button>
                </div>
            </div>

            {/* RELATÓRIO DE IMPRESSÃO (HEADER) */}
            <div className="hidden print:block mb-8 border-b-2 border-black pb-4">
                <h1 className="text-2xl font-bold uppercase">Relatório Executivo Financeiro</h1>
                <p className="text-sm">Prova Fácil SaaS - Gerado em {new Date().toLocaleString()}</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 print:grid-cols-4 print:gap-4">
                <Card className="border-l-4 border-emerald-500 print:border-black print:shadow-none">
                    <p className="text-xs font-bold text-slate-500 uppercase">MRR (Mensal)</p>
                    <p className="text-3xl font-bold text-slate-800 mt-1">R$ {metrics.mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1 print:hidden">
                        <span className="bg-emerald-100 px-1 rounded">Receita Recorrente</span>
                    </p>
                </Card>
                <Card className="border-l-4 border-blue-500 print:border-black print:shadow-none">
                    <p className="text-xs font-bold text-slate-500 uppercase">Faturamento (Ano)</p>
                    <p className="text-3xl font-bold text-slate-800 mt-1">R$ {metrics.totalRevenueYTD.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <p className="text-xs text-blue-600 mt-2 print:hidden">Acumulado {new Date().getFullYear()}</p>
                </Card>
                <Card className="border-l-4 border-purple-500 print:border-black print:shadow-none">
                    <p className="text-xs font-bold text-slate-500 uppercase">Assinantes Ativos</p>
                    <p className="text-3xl font-bold text-slate-800 mt-1">{metrics.activeSubscribers}</p>
                    <p className="text-xs text-purple-600 mt-2">Ticket Médio: R$ {metrics.arpu.toFixed(2)}</p>
                </Card>
                <Card className="border-l-4 border-orange-500 print:border-black print:shadow-none">
                    <p className="text-xs font-bold text-slate-500 uppercase">Risco de Churn</p>
                    <p className="text-3xl font-bold text-slate-800 mt-1">{metrics.churnRisk}</p>
                    <p className="text-xs text-orange-600 mt-2 print:hidden">Vencendo em 7 dias</p>
                </Card>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8 print:block">
                {/* Revenue Chart - Hidden on print usually unless tailored, sticking to simple bar for now */}
                <div className="lg:col-span-2 print:hidden">
                    <Card title="Evolução da Receita (12 meses)" className="h-full min-h-[400px]">
                        <div className="mt-4">
                            <SimpleBarChart data={chartData.map(d => ({ ...d, color: '#10b981' }))} />
                        </div>
                    </Card>
                </div>

                {/* Expiring Users List */}
                <div className="print:hidden">
                    <Card title="Próximos Vencimentos" className="h-full min-h-[400px] flex flex-col">
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 mt-2">
                            {expiringUsers.length === 0 ? (
                                <div className="text-center text-slate-400 py-10 italic">Nenhum vencimento próximo.</div>
                            ) : (
                                <div className="space-y-3">
                                    {expiringUsers.map(u => (
                                        <div key={u.id} className="p-3 border border-orange-100 bg-orange-50/50 rounded-lg flex justify-between items-center">
                                            <div>
                                                <p className="font-bold text-sm text-slate-800">{u.name}</p>
                                                <p className="text-xs text-slate-500">{u.email}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-bold text-orange-600">
                                                    {new Date(u.subscriptionEnd).toLocaleDateString()}
                                                </p>
                                                <Badge color="orange">{u.plan}</Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-100 text-center">
                            <Button variant="outline" className="w-full text-xs h-8" onClick={() => window.location.href = '#/users'}>
                                Gerenciar Usuários
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Recent Transactions Table */}
            <Card title="Transações Recentes" className="print:shadow-none print:border print:border-black">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 uppercase text-xs print:bg-gray-100 print:text-black">
                            <tr>
                                <th className="p-3">Data</th>
                                <th className="p-3">Usuário</th>
                                <th className="p-3">Plano</th>
                                <th className="p-3">Valor</th>
                                <th className="p-3">Método</th>
                                <th className="p-3 text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 print:divide-black">
                            {allPayments.slice(0, 10).map(pay => (
                                <tr key={pay.id} className="hover:bg-slate-50 transition-colors print:hover:bg-transparent">
                                    <td className="p-3 font-mono text-slate-600 print:text-black">
                                        {new Date(pay.date).toLocaleDateString()} <span className="text-xs text-slate-400 print:hidden">{new Date(pay.date).toLocaleTimeString().slice(0,5)}</span>
                                    </td>
                                    <td className="p-3 font-medium text-slate-800 print:text-black">{pay.userName}</td>
                                    <td className="p-3 text-slate-600 print:text-black">{pay.planName} (+{pay.periodMonths}m)</td>
                                    <td className="p-3 font-bold text-emerald-600 print:text-black">R$ {pay.amount.toFixed(2)}</td>
                                    <td className="p-3 text-xs text-slate-500 print:text-black">{pay.method}</td>
                                    <td className="p-3 text-right">
                                        <div className="print:hidden">
                                            <Badge color={pay.status === 'PAID' ? 'green' : pay.status === 'PENDING' ? 'yellow' : 'red'}>
                                                {pay.status === 'PAID' ? 'Pago' : pay.status === 'PENDING' ? 'Pendente' : 'Falha'}
                                            </Badge>
                                        </div>
                                        <span className="hidden print:inline font-bold">{pay.status}</span>
                                    </td>
                                </tr>
                            ))}
                            {allPayments.length === 0 && (
                                <tr><td colSpan={6} className="p-6 text-center text-slate-400">Nenhuma transação registrada.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* MODAL DE RELATÓRIOS */}
            <Modal
                isOpen={showReportModal}
                onClose={() => setShowReportModal(false)}
                title="Central de Relatórios"
                maxWidth="max-w-2xl"
                footer={<Button onClick={() => setShowReportModal(false)} variant="ghost">Fechar</Button>}
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* CSV Transações */}
                    <div className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-green-100 text-green-600 rounded-lg"><Icons.FileText /></div>
                            <div>
                                <h4 className="font-bold text-slate-800">Extrato Financeiro</h4>
                                <p className="text-xs text-slate-500">CSV completo de transações.</p>
                            </div>
                        </div>
                        <Button onClick={handleExportTransactions} variant="outline" className="w-full text-xs">
                            <Icons.Download /> Baixar CSV
                        </Button>
                    </div>

                    {/* CSV Assinantes */}
                    <div className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-blue-100 text-brand-blue rounded-lg"><Icons.UsersGroup /></div>
                            <div>
                                <h4 className="font-bold text-slate-800">Base de Assinantes</h4>
                                <p className="text-xs text-slate-500">CSV de clientes e status.</p>
                            </div>
                        </div>
                        <Button onClick={handleExportSubscribers} variant="outline" className="w-full text-xs">
                            <Icons.Download /> Baixar CSV
                        </Button>
                    </div>

                    {/* Impressão Executiva */}
                    <div className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors md:col-span-2">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><Icons.Printer /></div>
                            <div>
                                <h4 className="font-bold text-slate-800">Relatório Executivo</h4>
                                <p className="text-xs text-slate-500">Versão de impressão desta tela com resumo dos KPIs.</p>
                            </div>
                        </div>
                        <Button onClick={handlePrintReport} className="w-full">
                            Imprimir Resumo Gerencial
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default FinancePage;
