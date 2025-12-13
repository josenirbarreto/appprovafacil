
import React, { useState } from 'react';
import { Button, Input } from '../components/UI';
import { FirebaseService } from '../services/firebaseService';
import { UserRole } from '../types';

const Login = () => {
    const [isRegistering, setIsRegistering] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    
    // Estado para teste de Gestor
    const [isManager, setIsManager] = useState(false);
    
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        
        try {
            if (isRegistering) {
                if (!name.trim()) throw new Error("Por favor, informe seu nome.");
                
                // Define a Role baseada no checkbox de teste
                const roleToRegister = isManager ? UserRole.MANAGER : UserRole.TEACHER;
                
                await FirebaseService.register(email, password, name, roleToRegister);
            } else {
                await FirebaseService.login(email, password);
            }
            // O redirecionamento acontece automaticamente pelo AuthContext no App.tsx
        } catch (err: any) {
            console.error("Auth Error:", err);
            
            // Tratamento de erros específicos do Firebase Auth
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
        } finally {
            setLoading(false);
        }
    };

    const toggleMode = () => {
        setIsRegistering(!isRegistering);
        setError('');
        setName('');
        setEmail('');
        setPassword('');
        setIsManager(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md animate-fade-in">
                <div className="text-center mb-6">
                    <div className="w-12 h-12 bg-brand-blue rounded-lg flex items-center justify-center text-white font-bold text-xl mx-auto mb-4 shadow-lg shadow-blue-200">PF</div>
                    <h1 className="text-2xl font-bold text-brand-dark">Prova Fácil</h1>
                    <p className="text-slate-500">
                        {isRegistering ? 'Crie sua conta grátis' : 'Faça login para continuar'}
                    </p>
                </div>
                
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded mb-4 text-sm flex items-start gap-2 animate-fade-in">
                        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {isRegistering && (
                        <div className="animate-fade-in space-y-4">
                            <Input 
                                label="Nome Completo" 
                                type="text" 
                                value={name} 
                                onChange={e => setName(e.target.value)} 
                                required={isRegistering} 
                                placeholder="Seu nome" 
                            />
                            
                            {/* Opção de Teste para Gestor */}
                            <label className="flex items-start gap-3 p-3 border border-orange-200 bg-orange-50 rounded-lg cursor-pointer hover:bg-orange-100 transition-colors">
                                <input 
                                    type="checkbox" 
                                    className="mt-1 w-4 h-4 text-brand-orange rounded border-orange-300 focus:ring-brand-orange"
                                    checked={isManager}
                                    onChange={e => setIsManager(e.target.checked)}
                                />
                                <div>
                                    <span className="block text-sm font-bold text-orange-800">Sou um Gestor Escolar</span>
                                    <span className="block text-xs text-orange-700">Habilita o Painel Administrativo para cadastrar professores.</span>
                                </div>
                            </label>
                        </div>
                    )}
                    <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="ex: professor@escola.com" />
                    <Input label="Senha" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="******" />
                    
                    <Button type="submit" className="w-full justify-center" disabled={loading}>
                        {loading 
                            ? (isRegistering ? 'Criando conta...' : 'Entrando...') 
                            : (isRegistering ? 'Cadastrar Grátis' : 'Entrar')
                        }
                    </Button>
                </form>
                
                <div className="mt-6 text-center pt-4 border-t border-slate-100">
                    <p className="text-sm text-slate-600 mb-2">
                        {isRegistering ? 'Já possui uma conta?' : 'Ainda não tem uma conta?'}
                    </p>
                    <button 
                        type="button"
                        onClick={toggleMode} 
                        className="text-brand-blue font-bold hover:underline text-sm"
                    >
                        {isRegistering ? 'Fazer Login' : 'Criar nova conta'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Login;
