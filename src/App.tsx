
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { User, UserRole, SystemSettings } from './types';
import { FirebaseService } from './services/firebaseService';
import { Icons } from './components/Icons';
import { AuthContext, useAuth } from './contexts/AuthContext';
import { auth } from './firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { Modal, Input, Button } from './components/UI';

// Pages Imports
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import HierarchyPage from './pages/Hierarchy';
import QuestionsPage from './pages/Questions';
import ExamsPage from './pages/Exams';
import ExamResults from './pages/ExamResults';
import PublicExam from './pages/PublicExam';
import ClassesPage from './pages/Classes';
import InstitutionPage from './pages/Institutions';
import ProfilePage from './pages/Profile';
import UsersPage from './pages/Users';
import PlansPage from './pages/Plans';
import AdminExamsPage from './pages/AdminExams';
import MarketingPage from './pages/Marketing';
import FinancePage from './pages/Finance';
import AuditLogsPage from './pages/AuditLogs';
import SupportPage from './pages/Support';
import ModerationPage from './pages/Moderation';
import SystemSettingsPage from './pages/SystemSettings'; // NOVO IMPORT

const ForcePasswordChangeModal = ({ user, refreshUser }: { user: User, refreshUser: () => Promise<void> }) => {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        if (newPassword.length < 6) return setError("A senha deve ter pelo menos 6 caracteres.");
        if (newPassword !== confirmPassword) return setError("As senhas não conferem.");
        
        setLoading(true);
        setError('');
        try {
            await FirebaseService.changeUserPassword(newPassword);
            alert("Senha alterada com sucesso!");
            await refreshUser(); 
        } catch (e: any) {
            console.error(e);
            setError("Erro ao alterar senha. Tente novamente.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal 
            isOpen={true} 
            onClose={() => {}} 
            title="Troca de Senha Obrigatória"
            maxWidth="max-w-md"
        >
            <div className="space-y-4">
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 text-sm text-yellow-800">
                    <p className="font-bold">Primeiro Acesso</p>
                    <p>Por segurança, você deve alterar a senha provisória fornecida pelo gestor para uma senha pessoal.</p>
                </div>
                {error && <p className="text-red-500 text-sm font-bold">{error}</p>}
                <Input label="Nova Senha" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
                <Input label="Confirmar Nova Senha" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repita a senha" />
                <Button onClick={handleSubmit} disabled={loading} className="w-full justify-center">
                    {loading ? 'Salvando...' : 'Definir Nova Senha'}
                </Button>
            </div>
        </Modal>
    );
};

const Layout = ({ children }: { children?: React.ReactNode }) => {
    const location = useLocation();
    const { user } = useAuth();
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [openTicketsCount, setOpenTicketsCount] = useState(0);
    const [pendingQuestionsCount, setPendingQuestionsCount] = useState(0);
    
    // Global Settings State
    const [globalSettings, setGlobalSettings] = useState<SystemSettings | null>(null);
    
    useEffect(() => { setSidebarOpen(false); }, [location]);

    // Load Global Settings & Notifications
    useEffect(() => {
        const fetchGlobals = async () => {
            try {
                // Fetch Settings (Banner, WhiteLabel)
                const settings = await FirebaseService.getSystemSettings();
                setGlobalSettings(settings);

                // Fetch Admin Notifications
                if (user?.role === UserRole.ADMIN) {
                    const tCount = await FirebaseService.getAdminOpenTicketsCount();
                    const qCount = (await FirebaseService.getPendingQuestions()).length; 
                    setOpenTicketsCount(tCount);
                    setPendingQuestionsCount(qCount);
                }
            } catch (e) {
                console.error("Failed to load globals", e);
            }
        };
        fetchGlobals();
        
        // Poll for updates every 60s
        const interval = setInterval(fetchGlobals, 60000);
        return () => clearInterval(interval);
    }, [user]);

    // Apply Favicon Dinâmico
    useEffect(() => {
        if (globalSettings?.whiteLabel?.logoUrl) {
            let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
            if (!link) {
                link = document.createElement('link');
                link.rel = 'icon';
                document.getElementsByTagName('head')[0].appendChild(link);
            }
            link.href = globalSettings.whiteLabel.logoUrl;
        }
    }, [globalSettings]);

    const isAdmin = user?.role === UserRole.ADMIN;
    const isManager = user?.role === UserRole.MANAGER;

    const menuGroups = [
        {
            title: null, 
            items: [
                { path: '/', label: 'Dashboard', icon: Icons.Dashboard }
            ]
        },
        {
            title: 'GESTÃO',
            items: [
                { path: '/institutions', label: 'Instituições', icon: Icons.Building },
                { path: '/classes', label: 'Turmas', icon: Icons.UsersGroup },
                ...((isAdmin || isManager) ? [ { path: '/admin-exams', label: 'Todas as Provas', icon: Icons.FileText } ] : []),
                { path: '/hierarchy', label: 'Conteúdos', icon: Icons.BookOpen },
                ...((isAdmin || isManager) ? [ { path: '/users', label: isManager ? 'Professores' : 'Usuários', icon: Icons.User } ] : []),
                ...(isAdmin ? [ { path: '/plans', label: 'Planos', icon: Icons.Filter } ] : []),
                ...(isAdmin ? [ { path: '/finance', label: 'Financeiro', icon: Icons.Bank } ] : []),
                ...(isAdmin ? [ { path: '/marketing', label: 'Marketing', icon: Icons.Megaphone } ] : []),
                ...(isAdmin ? [ { path: '/audit', label: 'Auditoria', icon: Icons.Shield } ] : []),
                ...(isAdmin ? [ { path: '/moderation', label: 'Moderação', icon: Icons.Check, badge: pendingQuestionsCount > 0 ? pendingQuestionsCount : undefined } ] : []),
                ...(isAdmin ? [ { path: '/settings', label: 'Sistema', icon: Icons.Settings } ] : []), // ÍCONE ATUALIZADO
            ]
        },
        {
            title: 'AVALIAÇÃO',
            items: [
                { path: '/questions', label: 'Questões', icon: Icons.Questions },
                { path: '/exams', label: 'Minhas Provas', icon: Icons.Exams },
            ]
        },
        {
            title: 'AJUDA',
            items: [
                { 
                    path: '/support', 
                    label: 'Suporte', 
                    icon: Icons.LifeBuoy,
                    badge: (isAdmin && openTicketsCount > 0) ? openTicketsCount : undefined
                },
            ]
        }
    ];

    // White Label overrides
    const appName = globalSettings?.whiteLabel?.appName || 'Prova Fácil';
    const logoUrl = globalSettings?.whiteLabel?.logoUrl;
    // Primary color handling via inline styles would require more complex context or CSS vars injection. 
    // Keeping it simple for MVP: Banner logic only.

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-brand-dark z-30 flex items-center px-4 justify-between shadow-md">
                <div className="flex items-center gap-3">
                    <button onClick={() => setSidebarOpen(true)} className="text-slate-300 hover:text-white p-1"><Icons.Menu /></button>
                    <span className="font-display font-bold text-lg text-white tracking-tight">{appName}</span>
                </div>
            </div>

            {/* Overlay */}
            {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity" onClick={() => setSidebarOpen(false)} />}

            {/* Sidebar */}
            <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-brand-dark border-r border-slate-700 flex flex-col shrink-0 transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 md:z-auto`}>
                <div className="p-6 border-b border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {logoUrl ? (
                            <img src={logoUrl} alt="Logo" className="w-8 h-8 object-contain" />
                        ) : (
                            <div className="w-8 h-8 bg-brand-blue rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-900/50">PF</div>
                        )}
                        <div className="flex flex-col">
                            <span className="font-display font-bold text-xl text-white tracking-tight leading-none truncate max-w-[140px]" title={appName}>{appName}</span>
                            <span className="text-[10px] text-slate-400 font-mono mt-1 uppercase tracking-wider">{isAdmin ? 'Painel Admin' : isManager ? 'Painel Gestor' : 'Painel Professor'}</span>
                        </div>
                    </div>
                    <button onClick={() => setSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-white"><Icons.X /></button>
                </div>

                <nav className="flex-1 p-4 space-y-6 overflow-y-auto custom-scrollbar">
                    {menuGroups.map((group, groupIdx) => (
                        <div key={groupIdx}>
                            {group.title && <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 px-4">{group.title}</h4>}
                            <div className="space-y-1">
                                {group.items.map(link => {
                                    const active = location.pathname === link.path;
                                    return (
                                        <Link key={link.path} to={link.path} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group relative ${active ? 'bg-brand-blue text-white font-semibold shadow-md shadow-blue-900/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                                            <div className={`${active ? 'text-white' : 'text-slate-500 group-hover:text-white transition-colors'}`}><link.icon /></div>
                                            {link.label}
                                            {link.badge && (
                                                <span className="absolute right-3 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse shadow-sm">
                                                    {link.badge}
                                                </span>
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-700 bg-slate-900/30">
                    <Link to="/profile" className="flex items-center gap-3 mb-4 px-2 hover:bg-slate-800 rounded-lg p-2 transition-colors cursor-pointer group">
                         <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 overflow-hidden border-2 border-slate-600 group-hover:border-slate-500 shadow-sm shrink-0 transition-colors">
                             {user?.photoUrl ? <img src={user.photoUrl} className="w-full h-full object-cover" /> : <Icons.User />}
                         </div>
                         <div className="overflow-hidden">
                             <p className="text-sm font-bold text-slate-200 truncate group-hover:text-white transition-colors" title={user?.name}>{user?.name}</p>
                             <div className="flex items-center gap-1">
                                 <div className={`w-2 h-2 rounded-full ${isAdmin ? 'bg-purple-400' : isManager ? 'bg-orange-400' : 'bg-green-400'}`}></div>
                                 <p className="text-xs text-slate-500 truncate">{isAdmin ? 'Administrador' : isManager ? 'Gestor' : 'Professor'}</p>
                             </div>
                         </div>
                    </Link>
                    <button onClick={() => FirebaseService.logout()} className="flex items-center gap-2 text-slate-400 hover:text-red-400 hover:bg-red-950/30 w-full px-4 py-2 rounded-lg transition-colors text-sm font-medium">
                        <Icons.Logout /> Sair
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative pt-16 md:pt-0">
                {/* SYSTEM BANNER */}
                {globalSettings?.banner?.active && (
                    <div className={`w-full py-2 px-4 text-center text-sm font-bold shadow-md z-20 flex items-center justify-center gap-2 ${
                        globalSettings.banner.type === 'ERROR' ? 'bg-red-600 text-white' : 
                        globalSettings.banner.type === 'WARNING' ? 'bg-yellow-400 text-yellow-900' : 
                        'bg-blue-600 text-white'
                    }`}>
                        <Icons.Megaphone />
                        <span>{globalSettings.banner.message}</span>
                    </div>
                )}
                {children}
            </main>
        </div>
    );
};

const AppContent = () => {
    const { user, loading, refreshUser } = useAuth();

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50 text-slate-400">
                <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 border-4 border-slate-200 border-t-brand-blue rounded-full animate-spin"></div>
                    <span className="text-sm font-medium">Carregando...</span>
                </div>
            </div>
        );
    }

    return (
        <Routes>
            <Route path="/p/:examId" element={<PublicExam />} />
            <Route path="*" element={
                !user ? (
                    <Login />
                ) : (
                    <>
                        {user.requiresPasswordChange && <ForcePasswordChangeModal user={user} refreshUser={refreshUser} />}
                        <Layout>
                            <Routes>
                                <Route path="/" element={<Dashboard />} />
                                <Route path="/hierarchy" element={<HierarchyPage />} />
                                <Route path="/questions" element={<QuestionsPage />} />
                                <Route path="/exams" element={<ExamsPage />} />
                                <Route path="/exam-results" element={<ExamResults />} />
                                <Route path="/classes" element={<ClassesPage />} />
                                <Route path="/institutions" element={<InstitutionPage />} />
                                <Route path="/profile" element={<ProfilePage />} />
                                <Route path="/users" element={<UsersPage />} />
                                <Route path="/plans" element={<PlansPage />} />
                                <Route path="/admin-exams" element={<AdminExamsPage />} />
                                <Route path="/marketing" element={<MarketingPage />} />
                                <Route path="/finance" element={<FinancePage />} />
                                <Route path="/audit" element={<AuditLogsPage />} />
                                <Route path="/support" element={<SupportPage />} />
                                <Route path="/moderation" element={<ModerationPage />} />
                                <Route path="/settings" element={<SystemSettingsPage />} />
                                <Route path="*" element={<Navigate to="/" replace />} />
                            </Routes>
                        </Layout>
                    </>
                )
            } />
        </Routes>
    );
};

const App = () => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const refreshUser = async () => {
        if (auth.currentUser) {
            const userData = await FirebaseService.getCurrentUserData();
            setUser(userData);
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                try {
                    const userData = await FirebaseService.getCurrentUserData();
                    setUser(userData);
                } catch (error) {
                    console.error("Error fetching user", error);
                    setUser(null);
                }
            } else {
                setUser(null);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, refreshUser }}>
            <HashRouter>
                <AppContent />
            </HashRouter>
        </AuthContext.Provider>
    );
};

export default App;
