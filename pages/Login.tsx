
import React, { useState, useEffect } from 'react';
import { Button, Input, Modal, Select } from '../components/UI';
import { FirebaseService } from '../services/firebaseService';
import { EmailService } from '../services/emailService';
import { UserRole, CurricularComponent } from '../types';

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

    // Estado para visualização do E-mail Simulado
    const [simulatedEmail, setSimulatedEmail] = useState<string | null>(null);

    useEffect(() => {
        const fetchHierarchy = async () => {
            try {
                // Usamos getPublicComponents para evitar erros de permissão antes do login
                const h = await FirebaseService.getPublicComponents();
                setHierarchy(h);
            } catch (e) {
                console.error("Erro ao carregar componentes", e);
            }
        };
        fetchHierarchy();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setLoading(true);
        
        try {
            if (isRegistering) {
                if (!name.trim()) throw new Error("Por favor, informe seu nome.");
                if (!whatsapp.trim()) throw new Error("Por favor, informe seu WhatsApp.");
                if (!selectedComponent) throw new Error("Por favor, selecione sua área principal.");
                
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
            // O redirecionamento acontece automaticamente pelo AuthContext no App.tsx
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
            
            // 1. Verifica se o usuário existe no banco de dados
            const userDoc = await FirebaseService.getUserByEmail(cleanEmail);
            
            if (!userDoc) {
                throw new Error("E-mail não encontrado no sistema.");
            }

            // 2. Determina se é Usuário Gerenciado (SubUser) ou Real (Auth)
            const isManagedUser = !!userDoc.ownerId;
            
            if (!isManagedUser) {
                await FirebaseService.resetPassword(cleanEmail).catch(err => {
                    console.log("Firebase Reset skipped/failed:", err.code);
                });
            }

            // 3. Envia o e-mail instrutivo via EmailJS
            const response: any = await EmailService.sendRecoveryInstructions(
                cleanEmail, 
                userDoc.name,
                isManagedUser ? 'MANAGED' : 'REAL'
            );
            
            const domain = cleanEmail.split('@')[1] || '';
            const problematicDomains = ['yahoo', 'uol', 'bol', 'terra', 'hotmail', 'live', 'outlook', 'ig.com'];
            const isProblematic = problematicDomains.some(d => domain.includes(d));
            
            if (response && response.simulated) {
                setSimulatedEmail(response.emailContent);
                setSuccessMsg("E-mail gerado em Modo Simulação (veja a janela).");
            } else {
                if (isManagedUser) {
                     setSuccessMsg(`Conta Gerenciada: Instruções enviadas para "${cleanEmail}". Contate seu Gestor.`);
                } else if (isProblematic) {
                     setSuccessMsg(`ATENÇÃO: Provedores bloqueiam links automáticos. Verifique o SPAM.`);
                } else {
                     setSuccessMsg(`Link enviado! Verifique a caixa de entrada do e-mail "${cleanEmail}".`);
                }
            }

        } catch (err: any) {
            console.error(err);
            if (err.code === 'auth/invalid-email') {
                setError("Formato de e-mail inválido.");
            } else if (err.message) {
                setError(err.message);
            } else {
                setError("Ocorreu um erro ao processar. Tente novamente.");
            }
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
        } else if (errorCode === 'auth/user-not-found') {
            setError('Usuário não cadastrado.');
        } else if (errorCode === 'auth/too-many-requests') {
            setError('Muitas tentativas falhas. Tente novamente mais tarde.');
        } else if (errorCode === 'permission-denied') {
            setError('Permissão negada no banco de dados.');
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
        <div className="flex h-screen bg-white overflow-hidden">
            {/* Esquerda - Branding (Fixo) */}
            <div className="hidden md:flex md:w-1/2 bg-brand-blue flex-col justify-center items-center text-white p-12 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-blue-900 opacity-50"></div>
                <div className="relative z-10 text-center max-w-lg">
                    <div className="w-24 h-24 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-4xl font-bold mb-8 mx-auto shadow-xl border border-white/20">
                        PF
                    </div>
                    <h1 className="text-4xl font-display font-bold mb-6">Prova Fácil</h1>
                    <p className="text-blue-50 text-lg leading-relaxed">
                        Transforme sua rotina pedagógica com IA, banco de questões e correções instantâneas.
                    </p>
                </div>
                <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
                <div className="absolute top-12 right-12 w-40 h-40 bg-orange-500/20 rounded-full blur-2xl"></div>
            </div>

            {/* Direita - Formulário (Com Scroll) */}
            <div className="w-full md:w-1/2 h-full overflow-y-auto custom-scrollbar bg-white flex flex-col items-center">
                <div className="w-full max-w-md p-6 md:p-12 my-auto">
                    <div className="animate-fade-in py-8">
                        <div className="text-center md:text-left mb-8">
                            <div className="md:hidden w-12 h-12 bg-brand-blue rounded-lg flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">PF</div>
                            <h2 className="text-2xl font-bold text-brand-dark mb-2">
                                {isRecovering ? 'Recuperar Senha' : (isRegistering ? 'Criar Nova Conta' : 'Bem-vindo de volta')}
                            </h2>
                            <p className="text-slate-500 text-sm">
                                {isRecovering 
                                    ? 'Informe seus dados para recuperar o acesso.' 
                                    : (isRegistering ? 'Complete seu perfil de educador para começar.' : 'Insira suas credenciais para acessar o painel.')}
                            </p>
                        </div>
                        
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg mb-6 text-sm flex items-start gap-3">
                                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <span>{error}</span>
                            </div>
                        )}

                        {successMsg && (
                            <div className={`border p-4 rounded-lg mb-6 text-sm flex items-start gap-3 ${successMsg.includes('ATENÇÃO') ? 'bg-orange-50 border-orange-200 text-orange-800' : 'bg-green-50 border-green-200 text-green-700'}`}>
                                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                <span className="font-medium">{successMsg}</span>
                            </div>
                        )}

                        {isRecovering ? (
                            <form onSubmit={handleRecover} className="space-y-5">
                                <Input label="Email Cadastrado" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com" className="h-11" />
                                <Button type="submit" className="w-full justify-center h-11" disabled={loading}>
                                    {loading ? 'Processando...' : 'Enviar Instruções'}
                                </Button>
                                <button type="button" onClick={() => { setIsRecovering(false); setError(''); setSuccessMsg(''); }} className="w-full text-center text-sm text-slate-500 hover:text-slate-800 mt-2 font-medium">Voltar para o Login</button>
                            </form>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-5">
                                {isRegistering && (
                                    <div className="animate-fade-in space-y-4">
                                        <Input label="Nome Completo" type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Ex: Prof. Roberto Carlos" className="h-11" />
                                        
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <Input label="WhatsApp" type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} required placeholder="(00) 00000-0000" className="h-11" />
                                            <Select label="Área de Atuação" value={selectedComponent} onChange={e => setSelectedComponent(e.target.value)} required className="h-11">
                                                <option value="">Selecione...</option>
                                                {hierarchy.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
                                            </Select>
                                        </div>
                                        <div className="p-3 bg-blue-50 rounded-lg text-[10px] text-blue-700 font-bold uppercase leading-tight">
                                            Ao se cadastrar, você inicia no plano <b>BASIC (Grátis)</b> com 30 dias de trial das ferramentas de IA.
                                        </div>
                                    </div>
                                )}
                                
                                <Input label="E-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="ex: professor@escola.com" className="h-11" />
                                
                                <div>
                                    <Input label="Senha" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="******" className="h-11" />
                                    {!isRegistering && (
                                        <div className="text-right mt-2">
                                            <button type="button" onClick={() => { setIsRecovering(true); setError(''); setSuccessMsg(''); }} className="text-sm text-brand-blue font-medium hover:underline">Esqueci minha senha</button>
                                        </div>
                                    )}
                                </div>
                                
                                <Button type="submit" className="w-full justify-center h-11 text-base shadow-lg shadow-blue-100" disabled={loading}>
                                    {loading 
                                        ? (isRegistering ? 'Criando conta...' : 'Entrando...') 
                                        : (isRegistering ? 'Finalizar Cadastro' : 'Entrar')
                                    }
                                </Button>
                            </form>
                        )}
                        
                        {!isRecovering && (
                            <div className="mt-8 text-center pt-6 border-t border-slate-100">
                                <p className="text-sm text-slate-600 mb-3">
                                    {isRegistering ? 'Já possui uma conta?' : 'Ainda não tem uma conta?'}
                                </p>
                                <button type="button" onClick={toggleMode} className="text-brand-blue font-bold hover:text-blue-700 hover:underline transition-colors">
                                    {isRegistering ? 'Fazer Login' : 'Criar nova conta gratuitamente'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <Modal isOpen={!!simulatedEmail} onClose={() => setSimulatedEmail(null)} title="[Ambiente de Teste] E-mail Enviado" footer={<Button onClick={() => setSimulatedEmail(null)}>Fechar</Button>}>
                <div className="space-y-4">
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 text-sm text-yellow-800">
                        <p className="font-bold">Modo Simulação Ativo</p>
                        <p>Como o serviço de e-mail não está configurado com chaves reais, exibimos o conteúdo aqui.</p>
                    </div>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <div className="bg-slate-50 p-2 border-b border-slate-200 text-xs text-slate-500 font-mono">Para: {email}</div>
                        <div className="p-6 bg-white whitespace-pre-line text-slate-800 font-medium">{simulatedEmail}</div>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Login;
