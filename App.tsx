
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { User, UserRole } from './types';
import { FirebaseService } from './services/firebaseService';
import { Icons } from './components/Icons';
import { AuthContext, useAuth } from './contexts/AuthContext';
import { auth } from './firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';

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

const Layout = ({ children }: { children?: React.ReactNode }) => {
    const location = useLocation();
    const { user } = useAuth();
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    
    // Fechar sidebar ao navegar em mobile
    useEffect(() => {
        setSidebarOpen(false);
    }, [location]);

    const isAdmin = user?.role === UserRole.ADMIN;

    // Definição dinâmica do menu baseada no Role
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
                // Itens exclusivos para ADMIN
                ...(isAdmin ? [
                    { path: '/institutions', label: 'Instituições', icon: Icons.Building },
                    { path: '/users', label: 'Usuários', icon: Icons.User },
                    { path: '/plans', label: 'Planos', icon: Icons.Filter } // Using Filter as generic icon for Plans/Subs
                ] : []),
                { path: '/classes', label: 'Turmas', icon: Icons.UsersGroup },
                { path: '/hierarchy', label: 'Conteúdos', icon: Icons.BookOpen },
            ]
        },
        {
            title: 'AVALIAÇÃO',
            items: [
                { path: '/questions', label: 'Questões', icon: Icons.Questions },
                { path: '/exams', label: 'Provas', icon: Icons.Exams },
            ]
        }
    ];

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-brand-dark z-30 flex items-center px-4 justify-between shadow-md">
                <div className="flex items-center gap-3">
                    <button onClick={() => setSidebarOpen(true)} className="text-slate-300 hover:text-white p-1">
                        <Icons.Menu />
                    </button>
                    <span className="font-display font-bold text-lg text-white tracking-tight">Prova Fácil</span>
                </div>
            </div>

            {/* Overlay para Mobile */}
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar Dark Theme - Responsive */}
            <aside className={`
                fixed inset-y-0 left-0 z-50 w-64 bg-brand-dark border-r border-slate-700 flex flex-col shrink-0 transition-transform duration-300
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
                md:relative md:translate-x-0 md:z-auto
            `}>
                <div className="p-6 border-b border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-brand-blue rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-900/50">PF</div>
                        <div className="flex flex-col">
                            <span className="font-display font-bold text-xl text-white tracking-tight leading-none">Prova Fácil</span>
                            <span className="text-[10px] text-slate-400 font-mono mt-1 uppercase tracking-wider">
                                {isAdmin ? 'Painel Admin' : 'Painel Professor'}
                            </span>
                        </div>
                    </div>
                    {/* Close Button Mobile */}
                    <button onClick={() => setSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-white">
                        <Icons.X />
                    </button>
                </div>

                <nav className="flex-1 p-4 space-y-6 overflow-y-auto custom-scrollbar">
                    {menuGroups.map((group, groupIdx) => (
                        <div key={groupIdx}>
                            {group.title && (
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 px-4">
                                    {group.title}
                                </h4>
                            )}
                            <div className="space-y-1">
                                {group.items.map(link => {
                                    const active = location.pathname === link.path;
                                    return (
                                        <Link 
                                            key={link.path} 
                                            to={link.path} 
                                            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                                                active 
                                                ? 'bg-brand-blue text-white font-semibold shadow-md shadow-blue-900/30' 
                                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                            }`}
                                        >
                                            <div className={`${active ? 'text-white' : 'text-slate-500 group-hover:text-white transition-colors'}`}>
                                                <link.icon />
                                            </div>
                                            {link.label}
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
                                 <div className={`w-2 h-2 rounded-full ${isAdmin ? 'bg-purple-400' : 'bg-green-400'}`}></div>
                                 <p className="text-xs text-slate-500 truncate">{isAdmin ? 'Administrador' : 'Professor'}</p>
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
                {children}
            </main>
        </div>
    );
};

const App = () => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                const userData = await FirebaseService.getCurrentUserData();
                setUser(userData);
            } else {
                setUser(null);
            }
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const refreshUser = async () => {
        const userData = await FirebaseService.getCurrentUserData();
        if(userData) setUser(userData);
    };

    if (loading) return <div className="h-screen w-screen flex items-center justify-center bg-slate-900 text-slate-400">Carregando...</div>;

    return (
        <AuthContext.Provider value={{ user, loading, refreshUser }}>
            <HashRouter>
                <Routes>
                    {/* ROTA PÚBLICA (ALUNO) - Fora do Auth Guard */}
                    <Route path="/p/:examId" element={<PublicExam />} />

                    {/* ROTAS PROTEGIDAS (PROFESSOR) */}
                    <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
                    <Route path="/*" element={user ? (
                        <Layout>
                            <Routes>
                                <Route path="/" element={<Dashboard />} />
                                <Route path="/hierarchy" element={<HierarchyPage />} />
                                <Route path="/questions" element={<QuestionsPage />} />
                                <Route path="/exams" element={<ExamsPage />} />
                                <Route path="/exam-results" element={<ExamResults />} />
                                <Route path="/classes" element={<ClassesPage />} />
                                
                                {/* Rotas de Admin */}
                                <Route path="/institutions" element={<InstitutionPage />} />
                                <Route path="/users" element={<UsersPage />} />
                                <Route path="/plans" element={<PlansPage />} />
                                
                                <Route path="/profile" element={<ProfilePage />} />
                                <Route path="*" element={<Navigate to="/" />} />
                            </Routes>
                        </Layout>
                    ) : (
                        <Navigate to="/login" />
                    )} />
                </Routes>
            </HashRouter>
        </AuthContext.Provider>
    );
};

export default App;
