
import React, { useState, useEffect, useCallback } from 'react';
import { Button, Input, Modal, Select } from '../components/UI';
import { FirebaseService } from '../services/firebaseService';
import { EmailService } from '../services/emailService';
import { UserRole, CurricularComponent } from '../types';
// Import Icons to fix 'Cannot find name Icons' error on line 187
import { Icons } from '../components/Icons';

const Login = () => {
    const [isRegistering, setIsRegistering] = useState(false);
    const [isRecovering, setIsRecovering] = useState(false);
    
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [whatsapp, setWhatsapp] = useState('');
    const [selectedComponent, setSelectedComponent] = useState('');
    const [password, setPassword] = useState('');
    
    const [hierarchy, setHierarchy] = useState<CurricularComponent[]>([]);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingComponents, setLoadingComponents] = useState(false);

    // Estado para visualização do E-mail Simulado
    const [simulatedEmail, setSimulatedEmail] = useState<string | null>(null);

    const fetchHierarchy = useCallback(async () => {
        setLoadingComponents(true);
        setError('');
        try {
            // Busca os componentes do banco (sem orderBy para evitar erros de índice)
            const h = await FirebaseService.getPublicComponents();
            setHierarchy(h || []);
        } catch (e: any) {
            console.error("Erro ao carregar componentes", e);
            // Se houver falha crítica (não resolvida pelo fallback do service), mostra aviso
            if (hierarchy.length === 0) {
                setError("Não foi possível conectar ao banco de dados. Verifique sua conexão ou as configurações do Firebase.");
            }
        } finally {
            setLoadingComponents(false);
        }
    }, [hierarchy.length]);

    useEffect(() => {
        if (isRegistering) {
            fetchHierarchy();
        }
    }, [isRegistering, fetchHierarchy]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setLoading(true);
        
        try {
            if (isRegistering) {
                // Validações rigorosas de campos obrigatórios
                if (!name.trim()) throw new Error("Por favor, informe seu nome completo.");
                if (!whatsapp.trim()) throw new Error("Por favor, informe seu WhatsApp para contato.");
                if (!selectedComponent) throw new Error("A 'Área de Atuação' é obrigatória. Por favor, selecione uma opção.");
                if (password.length < 6) throw new Error("A senha deve conter no mínimo 6 caracteres.");
                
                await FirebaseService.register(
                    email.trim(), 
                    password, 
                    name, 
                    UserRole.TEACHER, 
                    whatsapp.trim(),
                    [selectedComponent]
                );
            } else {
                await FirebaseService.login(email.trim(), password);
            }
        } catch (err: any) {
            handleError(err);
        } finally {
            setLoading(false);
        }
    };

    const handleRecover = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setSimulatedEmail(null);
        setLoading(true);
        const cleanEmail = email.trim();

        try {
            if(!cleanEmail) throw new Error("Informe seu email para recuperação.");
            
            const userDoc = await FirebaseService.getUserByEmail(cleanEmail);
            
            if (!userDoc) {
                throw new Error("E-mail não encontrado no sistema.");
            }

            const isManagedUser = !!userDoc.ownerId;
            
            if (!isManagedUser) {
                await FirebaseService.resetPassword(cleanEmail).catch(err => {
                    console.log("Firebase Reset skipped/failed:", err.code);
                });
            }

            const response: any = await EmailService.sendRecoveryInstructions(
                cleanEmail, 
                userDoc.name,
                isManagedUser ? 'MANAGED' : 'REAL'
            );
            
            if (response && response.simulated) {
                setSimulatedEmail(response.emailContent);
                setSuccessMsg("E-mail gerado em Modo Simulação (veja a janela).");
            } else {
                setSuccessMsg(`Instruções enviadas! Verifique seu e-mail "${cleanEmail}".`);
            }

        } catch (err: any) {
            console.error(err);
            setError(err.message || "Erro ao processar recuperação.");
        } finally {
            setLoading(false);
        }
    };

    const handleError = (err: any) => {
        console.error("Auth Error:", err);
        const errorCode = err.code;
        if (errorCode === 'auth/email-already-in-use') {
            setError('Este e-mail já está cadastrado.');
        } else if (errorCode === 'auth/weak-password') {
            setError('A senha deve ter pelo menos 6 caracteres.');
        } else if (errorCode === 'auth/invalid-email') {
            setError('O formato do e-mail é inválido.');
        } else if (errorCode === 'auth/invalid-credential' || errorCode === 'auth/wrong-password') {
            setError('Email ou senha incorretos.');
        } else if (errorCode === 'permission-denied') {
            setError('Permissão negada no banco de dados. Verifique as regras do Firestore.');
        } else {
            setError(`${err.message || 'Ocorreu um erro. Tente novamente.'}`);
        }
    };

    const toggleMode = () => {
        setIsRegistering(!isRegistering);
        setIsRecovering(false);
        setError('');
        setSuccessMsg('');
        setName('');
        setWhatsapp('');
        setSelectedComponent('');
        setEmail('');
        setPassword('');
    };

    return (
        <div className="flex h-screen bg-white overflow-hidden text-slate-900">
            {/* Esquerda - Branding */}
            <div className="hidden md:flex md:w-1/2 bg-brand-blue flex-col justify-center items-center text-white p-12 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-blue-900 opacity-50"></div>
                <div className="relative z-10 text-center max-w-lg">
                    <div className="w-24 h-24 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-4xl font-bold mb-8 mx-auto shadow-xl border border-white/20">PF</div>
                    <h1 className="text-4xl font-display font-bold mb-6">Prova Fácil</h1>
                    <p className="text-blue-50 text-lg leading-relaxed">Avaliações inteligentes com IA e banco de questões estruturado.</p>
                </div>
            </div>

            {/* Direita - Formulário */}
            <div className="w-full md:w-1/2 h-full overflow-y-auto custom-scrollbar bg-white flex flex-col items-center">
                <div className="w-full max-w-md p-6 md:p-12 my-auto">
                    <div className="animate-fade-in py-8">
                        <div className="text-center md:text-left mb-8">
                            <h2 className="text-2xl font-bold text-brand-dark mb-2">
                                {isRecovering ? 'Recuperar Senha' : (isRegistering ? 'Criar Nova Conta' : 'Fazer Login')}
                            </h2>
                            <p className="text-slate-500 text-sm">
                                {isRecovering ? 'Dados para recuperação' : (isRegistering ? 'Cadastre-se para começar' : 'Acesse seu painel')}
                            </p>
                        </div>
                        
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg mb-6 text-sm">
                                <p className="font-bold flex items-center gap-2">
                                    {/* Icons imported from ../components/Icons */}
                                    <Icons.X className="w-4 h-4" /> {error}
                                </p>
                                {error.includes('conectar') && (
                                    <button onClick={fetchHierarchy} className="mt-2 text-xs underline font-black uppercase">Tentar Reconectar Banco</button>
                                )}
                            </div>
                        )}

                        {successMsg && (
                            <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg mb-6 text-sm font-medium">
                                {successMsg}
                            </div>
                        )}

                        {isRecovering ? (
                            <form onSubmit={handleRecover} className="space-y-5">
                                <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com" />
                                <Button type="submit" className="w-full justify-center h-11" disabled={loading}>{loading ? 'Enviando...' : 'Recuperar Accesso'}</Button>
                                <button type="button" onClick={() => setIsRecovering(false)} className="w-full text-center text-sm text-slate-500 mt-2 font-medium">Voltar</button>
                            </form>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-5">
                                {isRegistering && (
                                    <div className="animate-fade-in space-y-4">
                                        <Input label="Nome Completo *" value={name} onChange={e => setName(e.target.value)} required placeholder="Ex: Prof. Silva" />
                                        <div className="grid grid-cols-2 gap-4">
                                            <Input label="WhatsApp *" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} required placeholder="(00) 00000-0000" />
                                            <Select 
                                                label="Área de Atuação *" 
                                                value={selectedComponent} 
                                                onChange={e => setSelectedComponent(e.target.value)} 
                                                required 
                                                disabled={loadingComponents}
                                            >
                                                <option value="">{loadingComponents ? 'Sincronizando...' : 'Selecione sua área...'}</option>
                                                {hierarchy.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
                                            </Select>
                                        </div>
                                    </div>
                                )}
                                
                                <Input label="E-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="ex: prof@escola.com" />
                                <div>
                                    <Input label="Senha" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="******" />
                                    {!isRegistering && (
                                        <div className="text-right mt-2">
                                            <button type="button" onClick={() => setIsRecovering(true)} className="text-xs text-brand-blue font-bold hover:underline">Esqueci a senha</button>
                                        </div>
                                    )}
                                </div>
                                
                                <Button type="submit" className="w-full justify-center h-12 text-base shadow-lg shadow-blue-100" disabled={loading}>
                                    {loading ? (isRegistering ? 'Criando...' : 'Entrando...') : (isRegistering ? 'Finalizar Cadastro' : 'Entrar')}
                                </Button>
                            </form>
                        )}
                        
                        <div className="mt-8 text-center pt-6 border-t border-slate-100">
                            <button type="button" onClick={toggleMode} className="text-brand-blue font-bold hover:underline">
                                {isRegistering ? 'Já tenho conta: Fazer Login' : 'Não tem conta? Criar agora'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <Modal isOpen={!!simulatedEmail} onClose={() => setSimulatedEmail(null)} title="E-mail de Recuperação (Simulado)">
                <div className="p-4 bg-slate-50 rounded-lg border text-sm whitespace-pre-line font-medium text-slate-800">
                    {simulatedEmail}
                </div>
            </Modal>
        </div>
    );
};

export default Login;
