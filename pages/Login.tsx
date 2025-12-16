
import React, { useState } from 'react';
import { Button, Input, Modal } from '../components/UI';
import { FirebaseService } from '../services/firebaseService';
import { EmailService } from '../services/emailService';
import { UserRole } from '../types';

const Login = () => {
    const [isRegistering, setIsRegistering] = useState(false);
    const [isRecovering, setIsRecovering] = useState(false);
    
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    
    // Estado para teste de Gestor
    const [isManager, setIsManager] = useState(false);
    
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [loading, setLoading] = useState(false);

    // Estado para visualização do E-mail Simulado
    const [simulatedEmail, setSimulatedEmail] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setLoading(true);
        
        try {
            if (isRegistering) {
                if (!name.trim()) throw new Error("Por favor, informe seu nome.");
                
                // Define a Role baseada no checkbox de teste
                const roleToRegister = isManager ? UserRole.MANAGER : UserRole.TEACHER;
                
                await FirebaseService.register(email.trim(), password, name, roleToRegister);
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
            // Se tiver ownerId, é gerenciado.
            const isManagedUser = !!userDoc.ownerId;
            
            if (!isManagedUser) {
                // Usuário Real: Tenta enviar o link do Firebase Auth
                await FirebaseService.resetPassword(cleanEmail).catch(err => {
                    console.log("Firebase Reset skipped/failed:", err.code);
                    // Não lançamos erro aqui para permitir que o EmailJS envie o aviso mesmo assim
                });
            }

            // 3. Envia o e-mail instrutivo via EmailJS
            const response: any = await EmailService.sendRecoveryInstructions(
                cleanEmail, 
                userDoc.name,
                isManagedUser ? 'MANAGED' : 'REAL'
            );
            
            // Verifica domínio para mensagem personalizada
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
                     setSuccessMsg(`ATENÇÃO: Provedores como Yahoo/Outlook bloqueiam links automáticos. Verifique o SPAM. Se não chegar, peça ao seu Gestor para redefinir manualmente.`);
                } else {
                     setSuccessMsg(`Link enviado! Verifique a caixa de entrada e SPAM do e-mail "${cleanEmail}".`);
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
        setEmail('');
        setPassword('');
        setIsManager(false);
    };

    return (
        <div className="flex min-h-screen bg-white overflow-hidden">
            {/* Esquerda - Branding (Apenas Desktop) */}
            <div className="hidden md:flex md:w-1/2 bg-brand-blue flex-col justify-center items-center text-white p-12 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-blue-900 opacity-50"></div>
                <div className="relative z-10 text-center max-w-lg">
                    <div className="w-24 h-24 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-4xl font-bold mb-8 mx-auto shadow-xl border border-white/20">
                        PF
                    </div>
                    <h1 className="text-4xl font-display font-bold mb-6">Prova Fácil</h1>
                    <p className="text-blue-50 text-lg leading-relaxed">
                        A plataforma completa para gestão escolar, banco de questões inteligente e aplicação de provas online.
                    </p>
                </div>
                {/* Elementos Decorativos de Fundo */}
                <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
                <div className="absolute top-12 right-12 w-40 h-40 bg-orange-500/20 rounded-full blur-2xl"></div>
            </div>

            {/* Direita - Formulário */}
            <div className="w-full md:w-1/2 flex items-center justify-center p-6 md:p-12 bg-white">
                <div className="w-full max-w-md animate-fade-in">
                    <div className="text-center md:text-left mb-8">
                        {/* Logo Mobile */}
                        <div className="md:hidden w-12 h-12 bg-brand-blue rounded-lg flex items-center justify-center text-white font-bold text-xl mx-auto mb-4 shadow-lg shadow-blue-200">PF</div>
                        
                        <h2 className="text-2xl font-bold text-brand-dark mb-2">
                            {isRecovering ? 'Recuperar Senha' : (isRegistering ? 'Criar Nova Conta' : 'Bem-vindo de volta')}
                        </h2>
                        <p className="text-slate-500">
                            {isRecovering 
                                ? 'Informe seus dados para recuperar o acesso.' 
                                : (isRegistering ? 'Preencha os dados abaixo para começar.' : 'Insira suas credenciais para acessar o painel.')}
                        </p>
                    </div>
                    
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg mb-6 text-sm flex items-start gap-3 animate-fade-in">
                            <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <span>{error}</span>
                        </div>
                    )}

                    {successMsg && (
                        <div className={`border p-4 rounded-lg mb-6 text-sm flex items-start gap-3 animate-fade-in ${successMsg.includes('ATENÇÃO') ? 'bg-orange-50 border-orange-200 text-orange-800' : 'bg-green-50 border-green-200 text-green-700'}`}>
                            <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            <span className="font-medium">{successMsg}</span>
                        </div>
                    )}

                    {isRecovering ? (
                        // FORMULÁRIO DE RECUPERAÇÃO
                        <form onSubmit={handleRecover} className="space-y-5">
                            <div className="bg-blue-50 text-blue-800 p-4 rounded-lg text-sm border border-blue-100">
                                Enviaremos instruções de recuperação para o seu e-mail cadastrado.
                            </div>
                            <Input label="Email Cadastrado" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com" className="h-11" />
                            <Button type="submit" className="w-full justify-center h-11 text-base" disabled={loading}>
                                {loading ? 'Processando...' : 'Enviar Instruções'}
                            </Button>
                            <button 
                                type="button"
                                onClick={() => { setIsRecovering(false); setError(''); setSuccessMsg(''); }} 
                                className="w-full text-center text-sm text-slate-500 hover:text-slate-800 mt-2 font-medium py-2"
                            >
                                Voltar para o Login
                            </button>
                        </form>
                    ) : (
                        // FORMULÁRIO DE LOGIN / CADASTRO
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {isRegistering && (
                                <div className="animate-fade-in space-y-5">
                                    <Input 
                                        label="Nome Completo" 
                                        type="text" 
                                        value={name} 
                                        onChange={e => setName(e.target.value)} 
                                        required={isRegistering} 
                                        placeholder="Seu nome"
                                        className="h-11" 
                                    />
                                    
                                    {/* Opção de Teste para Gestor */}
                                    <label className="flex items-start gap-3 p-4 border border-orange-200 bg-orange-50 rounded-xl cursor-pointer hover:bg-orange-100 transition-colors">
                                        <input 
                                            type="checkbox" 
                                            className="mt-1 w-5 h-5 text-brand-orange rounded border-orange-300 focus:ring-brand-orange"
                                            checked={isManager}
                                            onChange={e => setIsManager(e.target.checked)}
                                        />
                                        <div>
                                            <span className="block text-sm font-bold text-orange-900">Sou um Gestor Escolar</span>
                                            <span className="block text-xs text-orange-700 mt-1">Habilita o Painel Administrativo para cadastrar professores.</span>
                                        </div>
                                    </label>
                                </div>
                            )}
                            <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="ex: professor@escola.com" className="h-11" />
                            
                            <div>
                                <Input label="Senha" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="******" className="h-11" />
                                {!isRegistering && (
                                    <div className="text-right mt-2">
                                        <button 
                                            type="button"
                                            onClick={() => { setIsRecovering(true); setError(''); setSuccessMsg(''); }}
                                            className="text-sm text-brand-blue font-medium hover:underline"
                                        >
                                            Esqueci minha senha
                                        </button>
                                    </div>
                                )}
                            </div>
                            
                            <Button type="submit" className="w-full justify-center h-11 text-base shadow-lg shadow-blue-100" disabled={loading}>
                                {loading 
                                    ? (isRegistering ? 'Criando conta...' : 'Entrando...') 
                                    : (isRegistering ? 'Cadastrar Grátis' : 'Entrar')
                                }
                            </Button>
                        </form>
                    )}
                    
                    {!isRecovering && (
                        <div className="mt-8 text-center pt-6 border-t border-slate-100">
                            <p className="text-sm text-slate-600 mb-3">
                                {isRegistering ? 'Já possui uma conta?' : 'Ainda não tem uma conta?'}
                            </p>
                            <button 
                                type="button"
                                onClick={toggleMode} 
                                className="text-brand-blue font-bold hover:text-blue-700 hover:underline transition-colors"
                            >
                                {isRegistering ? 'Fazer Login' : 'Criar nova conta gratuitamente'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL DE SIMULAÇÃO DE E-MAIL */}
            <Modal
                isOpen={!!simulatedEmail}
                onClose={() => setSimulatedEmail(null)}
                title="[Ambiente de Teste] E-mail Enviado"
                footer={<Button onClick={() => setSimulatedEmail(null)}>Fechar</Button>}
            >
                <div className="space-y-4">
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 text-sm text-yellow-800">
                        <p className="font-bold">Modo Simulação Ativo</p>
                        <p>Como o serviço de e-mail não está configurado com chaves reais, exibimos aqui o conteúdo que o usuário receberia.</p>
                    </div>
                    
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <div className="bg-slate-50 p-2 border-b border-slate-200 text-xs text-slate-500 font-mono">
                            Para: {email}
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

export default Login;
