
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

    const handleScroll = () => {
        if (!contentRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
        // Se o usuário chegou a 95% do fim ou se o conteúdo é menor que a tela, libera o botão
        if (scrollTop + clientHeight >= scrollHeight - 50 || scrollHeight <= clientHeight) {
            setHasReadToBottom(true);
        }
    };

    // Verifica se o conteúdo cabe na tela sem precisar de scroll
    useEffect(() => {
        const timer = setTimeout(() => {
            handleScroll();
        }, 500);
        return () => clearTimeout(timer);
    }, [template]);

    const handleSign = async () => {
        if (typedName.trim() !== user.name) {
            return alert("Para assinar, você deve digitar seu nome completo exatamente como no cadastro.");
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
            {/* Custom Card Structure for Flex Control */}
            <div className="bg-white rounded-2xl max-w-4xl w-full h-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-scale-in">
                
                {/* Header - Fixed */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                    <div>
                        <h2 className="text-xl font-display font-bold text-slate-800">Termos de Uso e Licenciamento</h2>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
                            Versão {template.version}.0 | Plano {user.plan || 'BASIC'}
                        </p>
                    </div>
                    <div className="bg-brand-blue/10 text-brand-blue p-2 rounded-lg"><Icons.Shield /></div>
                </div>

                {/* Content - Scrollable Area */}
                <div 
                    ref={contentRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-y-auto p-8 md:p-12 bg-white font-serif leading-relaxed text-slate-800 custom-scrollbar"
                >
                    <div className="prose prose-slate max-w-none rich-text-content mb-8">
                        <div dangerouslySetInnerHTML={{ __html: template.content }} />
                    </div>
                    
                    <div className="mt-12 p-8 border-2 border-dashed border-slate-200 rounded-2xl text-center bg-slate-50">
                        <p className="text-sm text-slate-500 italic mb-2">Fim do documento.</p>
                        {!hasReadToBottom && (
                            <p className="text-brand-blue font-bold text-sm animate-pulse">
                                Role até o final para habilitar a assinatura.
                            </p>
                        )}
                    </div>
                </div>

                {/* Footer - Fixed */}
                <div className="p-6 bg-slate-50 border-t border-slate-200 shrink-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                        <div className="space-y-3">
                            <label className="block text-sm font-black text-slate-700 uppercase tracking-tighter">Confirmação de Identidade</label>
                            <p className="text-xs text-slate-500 mb-2">Digite seu nome completo (<b>{user.name}</b>) para assinar:</p>
                            <Input 
                                value={typedName} 
                                onChange={e => setTypedName(e.target.value)} 
                                placeholder={user.name}
                                className="font-bold text-slate-800 border-slate-300 h-11"
                            />
                        </div>
                        <div className="flex flex-col gap-3">
                            <div className="bg-white p-3 rounded-lg border border-slate-200 flex items-center justify-between">
                                <div className="text-[10px] text-slate-400 font-mono">
                                    <p>RASTREIO DE AUDITORIA:</p>
                                    <p>DATA: {new Date().toLocaleDateString()}</p>
                                    <p>HASH: {template.id.slice(0,8)}</p>
                                </div>
                                <Icons.Check />
                            </div>
                            <Button 
                                onClick={handleSign} 
                                disabled={!hasReadToBottom || typedName.trim() !== user.name || loading}
                                className="w-full h-12 text-lg font-black shadow-lg shadow-blue-200"
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
