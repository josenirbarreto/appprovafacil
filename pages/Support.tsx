
import React, { useState, useEffect, useRef } from 'react';
import { User, Ticket, TicketMessage, UserRole, TicketStatus } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { Button, Card, Badge, Modal, Input, Select } from '../components/UI';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';

const SupportPage = () => {
    const { user } = useAuth();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Modal de Novo Ticket
    const [isNewModalOpen, setIsNewModalOpen] = useState(false);
    const [newTicket, setNewTicket] = useState({ subject: '', category: 'DOUBT', description: '', priority: 'MEDIUM' });
    
    // Modal de Detalhes/Chat
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [messages, setMessages] = useState<TicketMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [messagesLoading, setMessagesLoading] = useState(false);
    
    // Scroll ref para o chat
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // OUvinte em tempo real para a lista de tickets
    useEffect(() => {
        if (!user) return;
        
        const unsubscribe = FirebaseService.listenTickets(user, (updatedTickets) => {
            setTickets(updatedTickets);
            setLoading(false);

            // Atualiza o ticket selecionado se ele estiver aberto e sofrer alteração (ex: status)
            if (selectedTicket) {
                const refreshed = updatedTickets.find(t => t.id === selectedTicket.id);
                if (refreshed && (refreshed.status !== selectedTicket.status || refreshed.lastMessageAt !== selectedTicket.lastMessageAt)) {
                    setSelectedTicket(refreshed);
                }
            }
        });

        return () => unsubscribe();
    }, [user, selectedTicket?.id]);

    // Ouvinte em tempo real para mensagens do ticket selecionado
    useEffect(() => {
        if (!selectedTicket?.id) {
            setMessages([]);
            return;
        }

        setMessagesLoading(true);
        const unsubscribe = FirebaseService.listenTicketMessages(selectedTicket.id, (newMessages) => {
            setMessages(newMessages);
            setMessagesLoading(false);
            setTimeout(() => scrollToBottom(), 100);
        });

        return () => unsubscribe();
    }, [selectedTicket?.id]);

    const handleCreateTicket = async () => {
        if (!newTicket.subject || !newTicket.description) return alert("Preencha assunto e descrição.");
        if (!user) return;

        try {
            await FirebaseService.createTicket({
                authorId: user.id,
                authorName: user.name,
                authorEmail: user.email,
                authorRole: user.role,
                subject: newTicket.subject,
                description: newTicket.description,
                category: newTicket.category as any,
                priority: newTicket.priority as any,
                status: 'OPEN'
            });
            alert("Chamado aberto com sucesso!");
            setIsNewModalOpen(false);
            setNewTicket({ subject: '', category: 'DOUBT', description: '', priority: 'MEDIUM' });
        } catch (e) {
            console.error(e);
            alert("Erro ao abrir chamado.");
        }
    };

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !selectedTicket || !user) return;
        
        try {
            const isAdminReply = user.role === UserRole.ADMIN;
            await FirebaseService.addTicketMessage(
                selectedTicket.id, 
                user.id, 
                user.name, 
                newMessage, 
                isAdminReply
            );
            setNewMessage('');
            // O scroll e a atualização dos dados ocorrem via Listeners do Firebase
        } catch (e) {
            console.error(e);
            alert("Erro ao enviar mensagem.");
        }
    };

    const handleStatusChange = async (newStatus: TicketStatus) => {
        if (!selectedTicket) return;
        try {
            await FirebaseService.updateTicketStatus(selectedTicket.id, newStatus);
            // O estado local é atualizado pelo listener do useEffect principal
        } catch (e) {
            alert("Erro ao atualizar status");
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const getStatusColor = (status: string) => {
        switch(status) {
            case 'OPEN': return 'red';
            case 'IN_PROGRESS': return 'yellow';
            case 'RESOLVED': return 'green';
            case 'CLOSED': return 'blue';
            default: return 'blue';
        }
    };

    const getCategoryLabel = (cat: string) => {
        const map: any = { 'BUG': 'Erro/Bug', 'DOUBT': 'Dúvida', 'BILLING': 'Financeiro', 'FEATURE_REQUEST': 'Sugestão', 'OTHER': 'Outro' };
        return map[cat] || cat;
    };

    return (
        <div className="p-8 h-full bg-slate-50 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-3xl font-display font-bold text-slate-800 flex items-center gap-2">
                        <Icons.LifeBuoy /> Central de Suporte
                    </h2>
                    <p className="text-slate-500">
                        {user?.role === UserRole.ADMIN 
                            ? 'Gerencie os chamados dos usuários em tempo real.' 
                            : 'Tire dúvidas e reporte problemas para nossa equipe.'}
                    </p>
                </div>
                <Button onClick={() => setIsNewModalOpen(true)}>
                    <Icons.Plus /> Novo Chamado
                </Button>
            </div>

            {loading ? <div className="text-center p-8 text-slate-400">Carregando chamados...</div> : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100%-100px)]">
                    {/* LISTA DE TICKETS */}
                    <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-slate-100 bg-slate-50 font-bold text-slate-700 flex justify-between items-center">
                            <span>Tickets ({tickets.length})</span>
                            <div className="flex gap-1">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                <span className="text-[10px] text-green-600 font-bold uppercase">Ao vivo</span>
                            </div>
                        </div>
                        <div className="overflow-y-auto custom-scrollbar flex-1 p-2 space-y-2">
                            {tickets.length === 0 && <p className="text-center text-slate-400 p-8 text-sm">Nenhum chamado encontrado.</p>}
                            {tickets.map(t => (
                                <div 
                                    key={t.id} 
                                    onClick={() => setSelectedTicket(t)}
                                    className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${selectedTicket?.id === t.id ? 'border-brand-blue bg-blue-50' : 'border-slate-100 hover:bg-slate-50'}`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <Badge color={getStatusColor(t.status) as any}>{t.status === 'IN_PROGRESS' ? 'EM ANDAMENTO' : t.status === 'OPEN' ? 'ABERTO' : t.status === 'RESOLVED' ? 'RESOLVIDO' : 'FECHADO'}</Badge>
                                        <span className="text-[10px] text-slate-400">{new Date(t.updatedAt).toLocaleDateString()}</span>
                                    </div>
                                    <h4 className="font-bold text-sm text-slate-800 line-clamp-1">{t.subject}</h4>
                                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{t.description}</p>
                                    {user?.role === UserRole.ADMIN && (
                                        <div className="mt-2 text-[10px] font-mono text-slate-400 bg-white px-2 py-1 rounded border border-slate-100 inline-block">
                                            {t.authorName} ({t.authorRole})
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* DETALHES E CHAT */}
                    <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden relative">
                        {selectedTicket ? (
                            <>
                                {/* Ticket Header */}
                                <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">#{selectedTicket.id.slice(0,6)}</span>
                                            <Badge color="blue">{getCategoryLabel(selectedTicket.category)}</Badge>
                                        </div>
                                        <h3 className="font-bold text-lg text-slate-800">{selectedTicket.subject}</h3>
                                        <p className="text-sm text-slate-600 mt-1">{selectedTicket.description}</p>
                                    </div>
                                    {user?.role === UserRole.ADMIN && (
                                        <div className="flex flex-col gap-2 items-end">
                                            <select 
                                                className="text-xs border border-slate-300 rounded p-1 bg-white font-bold text-slate-700 outline-none focus:border-brand-blue"
                                                value={selectedTicket.status}
                                                onChange={(e) => handleStatusChange(e.target.value as any)}
                                            >
                                                <option value="OPEN">ABERTO</option>
                                                <option value="IN_PROGRESS">EM ANDAMENTO</option>
                                                <option value="RESOLVED">RESOLVIDO</option>
                                                <option value="CLOSED">FECHADO</option>
                                            </select>
                                            <span className="text-xs text-slate-400">{selectedTicket.authorEmail}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Chat Area */}
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 bg-slate-100/50">
                                    {messagesLoading && messages.length === 0 && <div className="text-center text-xs text-slate-400">Iniciando conversa segura...</div>}
                                    
                                    {messages.length === 0 && !messagesLoading && (
                                        <div className="text-center text-slate-400 italic text-sm mt-10">
                                            Aguarde enquanto um atendente analisa seu chamado.
                                        </div>
                                    )}

                                    {messages.map(msg => {
                                        const isMe = msg.authorId === user?.id;
                                        const isSuporte = msg.isAdminReply;
                                        
                                        return (
                                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[85%] rounded-2xl p-4 text-sm shadow-sm ${
                                                    isMe 
                                                        ? 'bg-brand-blue text-white rounded-tr-none' 
                                                        : isSuporte 
                                                            ? 'bg-purple-100 text-purple-900 border border-purple-200 rounded-tl-none' 
                                                            : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                                                }`}>
                                                    <div className="flex justify-between items-center gap-4 mb-2 text-[10px] opacity-80 font-black border-b border-black/5 pb-1">
                                                        <span>{msg.authorName.split(' ')[0]} {isSuporte && !isMe ? '• SUPORTE' : ''}</span>
                                                        <span>{new Date(msg.createdAt).toLocaleTimeString().slice(0,5)}</span>
                                                    </div>
                                                    <p className="whitespace-pre-wrap leading-relaxed font-medium">{msg.message}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Input Area */}
                                <div className="p-4 border-t border-slate-200 bg-white">
                                    {selectedTicket.status === 'CLOSED' ? (
                                        <div className="text-center text-sm font-bold text-slate-500 bg-slate-100 p-3 rounded-xl border border-dashed border-slate-300">
                                            Este chamado foi finalizado e arquivado.
                                        </div>
                                    ) : (
                                        <div className="flex gap-2">
                                            <input 
                                                type="text" 
                                                className="flex-1 border border-slate-300 bg-white text-slate-900 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-blue focus:border-brand-blue shadow-inner"
                                                placeholder="Sua mensagem..."
                                                value={newMessage}
                                                onChange={e => setNewMessage(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                                            />
                                            <Button onClick={handleSendMessage} disabled={!newMessage.trim()} className="h-[46px] w-[46px] !p-0 justify-center rounded-xl shadow-lg shadow-blue-100">
                                                <Icons.Send />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-300 p-8">
                                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4"><Icons.MessageCircle /></div>
                                <p className="text-lg font-bold text-slate-400">Selecione um chamado</p>
                                <p className="text-sm">Clique em um ticket ao lado para ver o histórico e responder.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* MODAL NOVO TICKET */}
            <Modal isOpen={isNewModalOpen} onClose={() => setIsNewModalOpen(false)} title="Abrir Novo Chamado" maxWidth="max-w-xl" footer={<Button onClick={handleCreateTicket}>Confirmar Envio</Button>}>
                <div className="space-y-4">
                    <Input label="Assunto Curto" value={newTicket.subject} onChange={e => setNewTicket({...newTicket, subject: e.target.value})} placeholder="Resumo do problema" />
                    <div className="grid grid-cols-2 gap-4">
                        <Select label="Categoria" value={newTicket.category} onChange={e => setNewTicket({...newTicket, category: e.target.value})}>
                            <option value="DOUBT">Dúvida Técnica</option>
                            <option value="BUG">Erro / Problema no App</option>
                            <option value="BILLING">Financeiro / Plano</option>
                            <option value="FEATURE_REQUEST">Sugestão de Recurso</option>
                            <option value="OTHER">Outros Assuntos</option>
                        </Select>
                        <Select label="Prioridade" value={newTicket.priority} onChange={e => setNewTicket({...newTicket, priority: e.target.value})}>
                            <option value="LOW">Baixa (Dúvidas gerais)</option>
                            <option value="MEDIUM">Média (Uso diário)</option>
                            <option value="HIGH">Alta (Impedimento de uso)</option>
                            <option value="CRITICAL">Urgente (Sistema off)</option>
                        </Select>
                    </div>
                    <div>
                        <label className="text-sm font-bold text-slate-700 mb-1 block">O que aconteceu?</label>
                        <textarea 
                            className="w-full border border-slate-300 bg-white text-slate-900 rounded-xl p-3 h-32 focus:ring-2 focus:ring-brand-blue outline-none resize-none shadow-inner"
                            placeholder="Descreva detalhadamente sua dúvida ou problema para que possamos ajudar melhor..."
                            value={newTicket.description}
                            onChange={e => setNewTicket({...newTicket, description: e.target.value})}
                        ></textarea>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default SupportPage;
