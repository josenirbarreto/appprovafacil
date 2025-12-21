
import React, { useState, useEffect, useRef } from 'react';
import { ContractTemplate, User } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { Button, Input } from './UI';
import { Icons } from './Icons';

interface ContractOverlayProps {
    user: User;
    template: ContractTemplate;
    onSigned: () => void;
}

export const ContractOverlay: React.FC<ContractOverlayProps> = ({ user, template, onSigned }) => {
    const [typedName, setTypedName] = useState('');
    const [hasReadToBottom, setHasReadToBottom] = useState(false);
    const [loading, setLoading] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Intersection Observer para detectar o fim do documento com precisão
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setHasReadToBottom(true);
                }
            },
            { threshold: 0.5 } // 50% da âncora final visível
        );

        if (bottomRef.current) {
            observer.observe(bottomRef.current);
        }

        return () => observer.disconnect();
    }, [template]);

    // Fallback: se o conteúdo for menor que o container, marca como lido
    useEffect(() => {
        const checkContentHeight = () => {
            if (contentRef.current) {
                const { scrollHeight, clientHeight } = contentRef.current;
                if (scrollHeight <= clientHeight + 10) {
                    setHasReadToBottom(true);
                }
            }
        };

        const timer = setTimeout(checkContentHeight, 600);
        window.addEventListener('resize', checkContentHeight);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', checkContentHeight);
        };
    }, [template]);

    const isNameValid = typedName.trim().toLowerCase() === user.name.trim().toLowerCase();

    const handleSign = async () => {
        if (!isNameValid) {
            return alert(`Para assinar, digite seu nome exatamente como no cadastro: ${user.name}`);
        }
        setLoading(true);
        try {
            await FirebaseService.signContract(user, template, typedName);
            onSigned();
        } catch (e) {
            alert("Erro ao processar assinatura.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 overflow-hidden">
            <div className="bg-white rounded-2xl max-w-4xl w-full h-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-scale-in">
                
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                    <div>
                        <h2 className="text-xl font-display font-bold text-slate-800">Termos de Uso e Licenciamento</h2>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
                            Versão {template.version}.0 | Plano {user.plan || 'BASIC'}
                        </p>
                    </div>
                    <div className="bg-brand-blue/10 text-brand-blue p-2 rounded-lg shadow-sm">
                        <Icons.Shield />
                    </div>
                </div>

                {/* Content Area */}
                <div 
                    ref={contentRef}
                    className="flex-1 overflow-y-auto p-8 md:p-12 bg-white font-serif leading-relaxed text-slate-800 custom-scrollbar"
                >
                    <div className="prose prose-slate max-w-none rich-text-content mb-8">
                        <div dangerouslySetInnerHTML={{ __html: template.content }} />
                    </div>
                    
                    <div className="mt-12 p-8 border-2 border-dashed border-slate-200 rounded-2xl text-center bg-slate-50 relative">
                        <p className="text-sm text-slate-500 italic mb-2">Fim do documento oficial.</p>
                        {!hasReadToBottom && (
                            <div className="flex flex-col items-center gap-2 animate-pulse text-brand-blue">
                                <Icons.ChevronDown />
                                <p className="font-bold text-sm">Prossiga a leitura até o final para assinar.</p>
                            </div>
                        )}
                        {/* Âncora invisível para o Observer */}
                        <div ref={bottomRef} className="absolute bottom-0 h-4 w-full pointer-events-none" />
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="p-6 bg-slate-50 border-t border-slate-200 shrink-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                        <div className="space-y-3">
                            <label className="block text-sm font-black text-slate-700 uppercase tracking-tighter">Confirmação de Identidade</label>
                            <p className="text-xs text-slate-500 mb-2">Digite seu nome completo (<b>{user.name}</b>) para validar:</p>
                            <div className="relative">
                                <Input 
                                    value={typedName} 
                                    onChange={e => setTypedName(e.target.value)} 
                                    placeholder={user.name}
                                    className={`font-bold text-slate-800 h-11 transition-colors ${typedName.trim() ? (isNameValid ? 'border-green-500 ring-2 ring-green-100' : 'border-orange-400') : 'border-slate-300'}`}
                                />
                                {typedName.trim() && isNameValid && (
                                    <div className="absolute right-3 top-3 text-green-500"><Icons.Check /></div>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col gap-3">
                            <div className="bg-white p-3 rounded-lg border border-slate-200 flex items-center justify-between">
                                <div className="text-[10px] text-slate-400 font-mono">
                                    <p className="font-bold text-slate-500">RASTREIO DE AUDITORIA:</p>
                                    <p>DATA: {new Date().toLocaleDateString()} | HASH: {template.id.slice(0,8)}</p>
                                </div>
                                <div className={hasReadToBottom ? "text-green-500" : "text-slate-200"}>
                                    <Icons.Check />
                                </div>
                            </div>
                            <Button 
                                onClick={handleSign} 
                                disabled={!hasReadToBottom || !isNameValid || loading}
                                className={`w-full h-12 text-lg font-black shadow-lg transition-all ${(!hasReadToBottom || !isNameValid) ? 'opacity-50 grayscale' : 'shadow-blue-200 active:scale-95'}`}
                            >
                                {loading ? 'PROCESSANDO...' : 'ACEITAR E ASSINAR AGORA'}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
