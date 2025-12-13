
import React, { useState } from 'react';
import { Button, Input } from '../components/UI';
import { FirebaseService } from '../services/firebaseService';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        
        try {
            await FirebaseService.login(email, password);
            // O redirecionamento acontece automaticamente pelo AuthContext no App.tsx
        } catch (err: any) {
            console.error("Login Error:", err);
            
            // Tratamento de erros específicos do Firebase Auth
            const errorCode = err.code;
            if (errorCode === 'auth/invalid-credential' || errorCode === 'auth/wrong-password') {
                setError('Email ou senha incorretos.');
            } else if (errorCode === 'auth/user-not-found') {
                setError('Usuário não cadastrado.');
            } else if (errorCode === 'auth/too-many-requests') {
                setError('Muitas tentativas falhas. Tente novamente mais tarde.');
            } else if (errorCode === 'permission-denied') {
                setError('Permissão negada no banco de dados. Verifique as regras do Firestore.');
            } else {
                setError(`Erro ao entrar: ${err.message || 'Tente novamente.'}`);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
                <div className="text-center mb-6">
                    <div className="w-12 h-12 bg-brand-blue rounded-lg flex items-center justify-center text-white font-bold text-xl mx-auto mb-4 shadow-lg shadow-blue-200">PF</div>
                    <h1 className="text-2xl font-bold text-brand-dark">Prova Fácil</h1>
                    <p className="text-slate-500">Faça login para continuar</p>
                </div>
                
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded mb-4 text-sm flex items-start gap-2 animate-fade-in">
                        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                    <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="ex: admin@provafacil.com" />
                    <Input label="Senha" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="******" />
                    <Button type="submit" className="w-full justify-center" disabled={loading}>
                        {loading ? 'Entrando...' : 'Entrar'}
                    </Button>
                </form>
                
                <div className="mt-6 text-center text-xs text-slate-400">
                    <p>Não tem conta? Solicite ao administrador.</p>
                </div>
            </div>
        </div>
    );
};

export default Login;
