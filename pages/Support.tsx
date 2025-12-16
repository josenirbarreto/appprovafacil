
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

    useEffect(() => {
        if (user) loadTickets();
    }, [user]);

    const loadTickets = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const data = await FirebaseService.getTickets(user);
            setTickets(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

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
            loadTickets();
        } catch (e) {
            console.error(e);
            alert("Erro ao abrir chamado.");
        }
    };

    const openTicketDetails = async (ticket: Ticket) => {
        setSelectedTicket(ticket);
        setMessagesLoading(true);
        try {
            const msgs = await FirebaseService.getTicketMessages(ticket.id);
            setMessages(msgs);
            setTimeout(() => scrollToBottom(), 100);
        } catch (e) {
            console.error(e);
        } finally {
            setMessagesLoading(false);
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
            
            // Atualiza localmente para feedback instantâneo
            const optimisticMsg: TicketMessage = {
                id: Date.now().toString(),
                ticketId: selectedTicket.id,
                authorId: user.id,
                authorName: user.name,
                message: newMessage,
                createdAt: new Date().toISOString(),
                isAdminReply
            };
            setMessages([...messages, optimisticMsg]);
            setNewMessage('');
            setTimeout(() => scrollToBottom(), 100);
            
            // Recarrega lista para atualizar status/timestamp se mudou
            loadTickets();
        } catch (e) {
            console.error(e);
            alert("Erro ao enviar mensagem.");
        }
    };

    const handleStatusChange = async (newStatus: TicketStatus) => {
        if (!selectedTicket) return;
        try {
            await FirebaseService.updateTicketStatus(selectedTicket.id, newStatus);
            setSelectedTicket({ ...selectedTicket, status: newStatus });
            loadTickets(); // Atualiza lista principal
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
                            ? 'Gerencie os chamados dos usuários.' 
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
                        <div className="p-4 border-b border-slate-100 bg-slate-50 font-bold text-slate-700">
                            Meus Chamados ({tickets.length})
                        </div>
                        <div className="overflow-y-auto custom-scrollbar flex-1 p-2 space-y-2">
                            {tickets.length === 0 && <p className="text-center text-slate-400 p-8 text-sm">Nenhum chamado encontrado.</p>}
                            {tickets.map(t => (
                                <div 
                                    key={t.id} 
                                    onClick={() => openTicketDetails(t)}
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
                                    {messagesLoading && <div className="text-center text-xs text-slate-400">Carregando histórico...</div>}
                                    
                                    {messages.length === 0 && !messagesLoading && (
                                        <div className="text-center text-slate-400 italic text-sm mt-10">
                                            Nenhuma resposta ainda. Aguarde o atendimento.
                                        </div>
                                    )}

                                    {messages.map(msg => {
                                        const isMe = msg.authorId === user?.id;
                                        const isAdmin = msg.isAdminReply;
                                        
                                        return (
                                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[80%] rounded-lg p-3 text-sm shadow-sm ${
                                                    isMe 
                                                        ? 'bg-brand-blue text-white rounded-tr-none' 
                                                        : isAdmin 
                                                            ? 'bg-purple-100 text-purple-900 border border-purple-200 rounded-tl-none' 
                                                            : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                                                }`}>
                                                    <div className="flex justify-between items-center gap-4 mb-1 text-[10px] opacity-80 font-bold border-b border-white/20 pb-1">
                                                        <span>{msg.authorName} {isAdmin && !isMe && '(Suporte)'}</span>
                                                        <span>{new Date(msg.createdAt).toLocaleTimeString().slice(0,5)}</span>
                                                    </div>
                                                    <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Input Area */}
                                <div className="p-4 border-t border-slate-200 bg-white">
                                    {selectedTicket.status === 'CLOSED' ? (
                                        <div className="text-center text-sm text-slate-500 bg-slate-100 p-2 rounded">
                                            Este chamado foi fechado. Abra um novo se precisar.
                                        </div>
                                    ) : (
                                        <div className="flex gap-2">
                                            <input 
                                                type="text" 
                                                className="flex-1 border border-slate-300 bg-white text-slate-900 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-brand-blue focus:border-brand-blue"
                                                placeholder="Digite sua resposta..."
                                                value={newMessage}
                                                onChange={e => setNewMessage(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                                            />
                                            <Button onClick={handleSendMessage} disabled={!newMessage.trim()}>
                                                <Icons.Send />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-300 p-8">
                                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4"><Icons.MessageCircle /></div>
                                <p className="text-lg font-medium">Selecione um chamado para ver detalhes</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* MODAL NOVO TICKET */}
            <Modal isOpen={isNewModalOpen} onClose={() => setIsNewModalOpen(false)} title="Novo Chamado" maxWidth="max-w-xl" footer={<Button onClick={handleCreateTicket}>Abrir Chamado</Button>}>
                <div className="space-y-4">
                    <Input label="Assunto" value={newTicket.subject} onChange={e => setNewTicket({...newTicket, subject: e.target.value})} placeholder="Resumo do problema" />
                    <div className="grid grid-cols-2 gap-4">
                        <Select label="Categoria" value={newTicket.category} onChange={e => setNewTicket({...newTicket, category: e.target.value})}>
                            <option value="DOUBT">Dúvida</option>
                            <option value="BUG">Erro / Bug</option>
                            <option value="BILLING">Financeiro</option>
                            <option value="FEATURE_REQUEST">Sugestão</option>
                            <option value="OTHER">Outro</option>
                        </Select>
                        <Select label="Prioridade" value={newTicket.priority} onChange={e => setNewTicket({...newTicket, priority: e.target.value})}>
                            <option value="LOW">Baixa</option>
                            <option value="MEDIUM">Média</option>
                            <option value="HIGH">Alta</option>
                            <option value="CRITICAL">Crítica</option>
                        </Select>
                    </div>
                    <div>
                        <label className="text-sm font-semibold text-slate-700 mb-1 block">Descrição</label>
                        <textarea 
                            className="w-full border border-slate-300 bg-white text-slate-900 rounded-lg p-3 h-32 focus:ring-2 focus:ring-brand-blue outline-none resize-none"
                            placeholder="Descreva detalhadamente o que aconteceu..."
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
