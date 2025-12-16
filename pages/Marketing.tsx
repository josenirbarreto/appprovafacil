
import React, { useState, useEffect } from 'react';
import { User, Campaign, UserRole, Plan, Coupon } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { EmailService } from '../services/emailService';
import { Button, Card, Badge, Input, Select, RichTextEditor, Modal } from '../components/UI';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';

const MarketingPage = () => {
    const { user } = useAuth();
    const [view, setView] = useState<'LIST' | 'NEW'>('LIST');
    const [activeTab, setActiveTab] = useState<'CAMPAIGNS' | 'COUPONS'>('CAMPAIGNS');
    
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [plans, setPlans] = useState<Plan[]>([]);
    
    // Wizard States (Campaigns)
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    
    // New Campaign Data
    const [newCampaign, setNewCampaign] = useState<Partial<Campaign>>({
        title: '',
        channel: 'EMAIL',
        segmentation: { roles: [], plans: [], status: [] },
        content: { subject: '', body: '' }
    });
    
    // Coupon Modal & Data
    const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
    const [editingCoupon, setEditingCoupon] = useState<Partial<Coupon>>({
        code: '', type: 'PERCENTAGE', value: 0, maxUses: 0, isActive: true
    });

    // Filtered Targets
    const [targets, setTargets] = useState<User[]>([]);
    
    // Sending Process
    const [sendingProgress, setSendingProgress] = useState({ current: 0, total: 0, failed: 0, active: false });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const [c, u, p, cps] = await Promise.all([
            FirebaseService.getCampaigns(),
            FirebaseService.getUsers(user),
            FirebaseService.getPlans(),
            FirebaseService.getCoupons()
        ]);
        setCampaigns(c);
        setUsers(u);
        setPlans(p);
        setCoupons(cps);
        setLoading(false);
    };

    // --- COUPONS HANDLERS ---
    const openCouponModal = (coupon?: Coupon) => {
        if (coupon) {
            setEditingCoupon(coupon);
        } else {
            setEditingCoupon({
                code: '',
                type: 'PERCENTAGE',
                value: 10,
                maxUses: 0,
                usedCount: 0,
                isActive: true,
                createdAt: new Date().toISOString()
            });
        }
        setIsCouponModalOpen(true);
    };

    const handleSaveCoupon = async () => {
        if (!editingCoupon.code || !editingCoupon.value) return alert("Código e Valor são obrigatórios.");
        
        try {
            const payload: any = {
                ...editingCoupon,
                code: editingCoupon.code.toUpperCase().replace(/\s/g, ''), // Formata código
                maxUses: Number(editingCoupon.maxUses) || 0,
                value: Number(editingCoupon.value)
            };

            if (editingCoupon.id) {
                await FirebaseService.updateCoupon(editingCoupon.id, payload);
            } else {
                await FirebaseService.addCoupon(payload as Coupon);
            }
            setIsCouponModalOpen(false);
            loadData(); // Recarrega para ver atualizações
        } catch (error: any) {
            console.error(error);
            alert(error.message || "Erro ao salvar cupom.");
        }
    };

    const handleDeleteCoupon = async (id: string) => {
        if (confirm("Tem certeza que deseja excluir este cupom?")) {
            await FirebaseService.deleteCoupon(id);
            loadData();
        }
    };

    // --- CAMPAIGN HANDLERS (EXISTING) ---
    // --- STEP 1: SEGMENTATION ---
    const updateSegmentation = (field: 'roles' | 'plans' | 'status', value: string) => {
        const current = newCampaign.segmentation?.[field] as string[] || [];
        const updated = current.includes(value) 
            ? current.filter(item => item !== value)
            : [...current, value];
        
        const updatedSeg = { ...newCampaign.segmentation!, [field]: updated };
        setNewCampaign({ ...newCampaign, segmentation: updatedSeg });
        
        // Recalculate targets immediately
        calculateTargets(updatedSeg);
    };

    const calculateTargets = (seg: any) => {
        const filtered = users.filter(u => {
            // Role Filter
            if (seg.roles.length > 0 && !seg.roles.includes(u.role)) return false;
            
            // Plan Filter
            if (seg.plans.length > 0) {
                // If user plan matches one of selected plans
                const userPlan = u.plan || 'Free';
                if (!seg.plans.includes(userPlan)) return false;
            }
            
            // Status Filter
            if (seg.status.length > 0) {
                const today = new Date().toISOString().split('T')[0];
                const isExpired = u.subscriptionEnd < today;
                const status = isExpired ? 'VENCIDO' : (u.status === 'INACTIVE' ? 'INATIVO' : 'ATIVO');
                if (!seg.status.includes(status)) return false;
            }
            
            return true;
        });
        setTargets(filtered);
    };

    const selectAll = () => {
        const allRoles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER];
        const allPlans = plans.map(p => p.name);
        const allStatus = ['ATIVO', 'INATIVO', 'VENCIDO'];
        
        const fullSeg = { roles: allRoles, plans: allPlans, status: allStatus };
        setNewCampaign({ ...newCampaign, segmentation: fullSeg });
        calculateTargets(fullSeg);
    };

    // --- STEP 3: SENDING ---
    const startSending = async () => {
        if (newCampaign.channel === 'EMAIL') {
            if (!confirm(`Confirmar envio de e-mails para ${targets.length} usuários?`)) return;
            
            setSendingProgress({ current: 0, total: targets.length, failed: 0, active: true });
            
            let sent = 0;
            let failed = 0;

            // Batch sending to avoid rate limits
            for (let i = 0; i < targets.length; i++) {
                const target = targets[i];
                try {
                    await EmailService.sendMarketingEmail(
                        target.email, 
                        target.name, 
                        newCampaign.content!.subject!, 
                        newCampaign.content!.body
                    );
                    sent++;
                } catch (e) {
                    console.error(`Falha ao enviar para ${target.email}`, e);
                    failed++;
                }
                
                setSendingProgress({ current: i + 1, total: targets.length, failed, active: true });
                
                // Small delay to be gentle with API
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            finishCampaign(sent, failed);
        } else {
            // WhatsApp is manual for now, save as draft/ready
            finishCampaign(0, 0);
        }
    };

    const finishCampaign = async (sent: number, failed: number) => {
        const finalCampaign: Omit<Campaign, 'id'> = {
            title: newCampaign.title || 'Campanha Sem Título',
            channel: newCampaign.channel as 'EMAIL' | 'WHATSAPP',
            status: 'COMPLETED',
            segmentation: newCampaign.segmentation as any,
            content: newCampaign.content as any,
            stats: {
                targetCount: targets.length,
                sentCount: sent,
                failedCount: failed
            },
            createdAt: new Date().toISOString(),
            sentAt: new Date().toISOString()
        };

        await FirebaseService.addCampaign(finalCampaign);
        alert('Campanha finalizada e salva no histórico!');
        setSendingProgress({ ...sendingProgress, active: false });
        setStep(1);
        setView('LIST');
        loadData();
    };

    // WhatsApp Helper
    const getWhatsAppLink = (phone: string | undefined, body: string) => {
        if (!phone) return '#';
        const cleanPhone = phone.replace(/\D/g, ''); // Remove non-digits
        // Add country code if missing (assumes BR +55)
        const finalPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
        const encodedBody = encodeURIComponent(body);
        return `https://wa.me/${finalPhone}?text=${encodedBody}`;
    };

    if (loading && view === 'LIST' && coupons.length === 0) return <div className="p-8 text-center text-slate-500">Carregando dados...</div>;

    return (
        <div className="p-8 h-full bg-slate-50 overflow-y-auto custom-scrollbar">
            
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-3xl font-display font-bold text-slate-800 flex items-center gap-2">
                        <Icons.Megaphone /> Marketing & Promoções
                    </h2>
                    <p className="text-slate-500">Gerencie campanhas de comunicação e cupons de desconto.</p>
                </div>
                {view === 'LIST' && activeTab === 'CAMPAIGNS' && (
                    <Button onClick={() => { 
                        setNewCampaign({ 
                            title: '', channel: 'EMAIL', 
                            segmentation: { roles: [], plans: [], status: [] }, 
                            content: { subject: '', body: '' } 
                        });
                        setTargets([]);
                        setStep(1);
                        setView('NEW'); 
                    }}>
                        <Icons.Plus /> Nova Campanha
                    </Button>
                )}
                {activeTab === 'COUPONS' && (
                    <Button onClick={() => openCouponModal()}>
                        <Icons.Plus /> Novo Cupom
                    </Button>
                )}
            </div>

            {/* Tabs */}
            {view === 'LIST' && (
                <div className="flex gap-4 border-b border-slate-200 mb-6">
                    <button 
                        className={`pb-2 px-4 font-bold text-sm transition-colors ${activeTab === 'CAMPAIGNS' ? 'border-b-2 border-brand-blue text-brand-blue' : 'text-slate-500 hover:text-slate-700'}`}
                        onClick={() => setActiveTab('CAMPAIGNS')}
                    >
                        Campanhas
                    </button>
                    <button 
                        className={`pb-2 px-4 font-bold text-sm transition-colors ${activeTab === 'COUPONS' ? 'border-b-2 border-brand-blue text-brand-blue' : 'text-slate-500 hover:text-slate-700'}`}
                        onClick={() => setActiveTab('COUPONS')}
                    >
                        Cupons de Desconto
                    </button>
                </div>
            )}

            {/* TAB: COUPONS */}
            {activeTab === 'COUPONS' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {coupons.map(coupon => {
                            const isExpired = coupon.expiresAt && new Date(coupon.expiresAt) < new Date();
                            const isDepleted = coupon.maxUses && coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses;
                            const isActive = coupon.isActive && !isExpired && !isDepleted;

                            return (
                                <Card key={coupon.id} className={`relative border-t-4 ${isActive ? 'border-t-green-500' : 'border-t-slate-300 opacity-75'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <Badge color={isActive ? 'green' : 'red'}>{isActive ? 'ATIVO' : 'INATIVO'}</Badge>
                                        <div className="flex gap-1">
                                            <button onClick={() => openCouponModal(coupon)} className="text-slate-400 hover:text-brand-blue p-1"><Icons.Edit /></button>
                                            <button onClick={() => handleDeleteCoupon(coupon.id)} className="text-slate-400 hover:text-red-500 p-1"><Icons.Trash /></button>
                                        </div>
                                    </div>
                                    
                                    <div className="text-center py-4 border-b border-slate-100 border-dashed mb-4">
                                        <h3 className="text-2xl font-mono font-bold text-slate-800 tracking-wider">{coupon.code}</h3>
                                        <p className="text-sm text-slate-500 font-bold">
                                            {coupon.type === 'PERCENTAGE' ? `${coupon.value}% OFF` : 
                                             coupon.type === 'FIXED' ? `R$ ${coupon.value.toFixed(2)} OFF` : 
                                             `${coupon.value} Dias Grátis`}
                                        </p>
                                    </div>

                                    <div className="space-y-2 text-xs text-slate-600">
                                        <div className="flex justify-between">
                                            <span>Usos:</span>
                                            <span className="font-bold">{coupon.usedCount} / {coupon.maxUses || '∞'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Validade:</span>
                                            <span className={isExpired ? 'text-red-500 font-bold' : ''}>
                                                {coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleDateString() : 'Indeterminada'}
                                            </span>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                        
                        {coupons.length === 0 && (
                            <div className="col-span-3 text-center py-12 border-2 border-dashed border-slate-200 rounded-xl text-slate-400">
                                <p>Nenhum cupom criado.</p>
                                <Button variant="outline" onClick={() => openCouponModal()} className="mt-4">Criar Primeiro Cupom</Button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB: CAMPAIGNS (Original View) */}
            {activeTab === 'CAMPAIGNS' && view === 'LIST' && (
                /* --- DASHBOARD VIEW --- */
                <div className="space-y-6 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="flex items-center gap-4 border-l-4 border-blue-500">
                            <div className="p-3 bg-blue-50 rounded-full text-blue-600"><Icons.Megaphone /></div>
                            <div>
                                <p className="text-2xl font-bold">{campaigns.length}</p>
                                <p className="text-sm text-slate-500">Campanhas Totais</p>
                            </div>
                        </Card>
                        <Card className="flex items-center gap-4 border-l-4 border-green-500">
                            <div className="p-3 bg-green-50 rounded-full text-green-600"><Icons.Mail /></div>
                            <div>
                                <p className="text-2xl font-bold">{campaigns.reduce((acc, c) => acc + c.stats.sentCount, 0)}</p>
                                <p className="text-sm text-slate-500">Mensagens Enviadas</p>
                            </div>
                        </Card>
                        <Card className="flex items-center gap-4 border-l-4 border-orange-500">
                            <div className="p-3 bg-orange-50 rounded-full text-orange-600"><Icons.UsersGroup /></div>
                            <div>
                                <p className="text-2xl font-bold">{users.length}</p>
                                <p className="text-sm text-slate-500">Base de Contatos</p>
                            </div>
                        </Card>
                    </div>

                    <Card title="Histórico de Campanhas">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs">
                                <tr>
                                    <th className="p-4">Campanha</th>
                                    <th className="p-4">Canal</th>
                                    <th className="p-4">Público</th>
                                    <th className="p-4">Data</th>
                                    <th className="p-4 text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {campaigns.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-400">Nenhuma campanha realizada.</td></tr>}
                                {campaigns.map(camp => (
                                    <tr key={camp.id} className="hover:bg-slate-50">
                                        <td className="p-4 font-bold text-slate-700">{camp.title}</td>
                                        <td className="p-4">
                                            <Badge color={camp.channel === 'EMAIL' ? 'blue' : 'green'}>
                                                {camp.channel === 'EMAIL' ? 'E-mail' : 'WhatsApp'}
                                            </Badge>
                                        </td>
                                        <td className="p-4 text-sm text-slate-600">
                                            {camp.stats.sentCount} / {camp.stats.targetCount} enviados
                                        </td>
                                        <td className="p-4 text-sm text-slate-500">
                                            {new Date(camp.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="p-4 text-right">
                                            <Badge color={camp.status === 'COMPLETED' ? 'green' : 'yellow'}>{camp.status}</Badge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                </div>
            )}

            {/* CAMPAIGN WIZARD (Visible when view === 'NEW') */}
            {view === 'NEW' && (
                /* --- CAMPAIGN WIZARD --- */
                <Card className="max-w-4xl mx-auto min-h-[600px] flex flex-col animate-fade-in">
                    {/* Wizard Header */}
                    <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
                        <div className="flex items-center gap-2">
                            <button onClick={() => setView('LIST')} className="text-slate-400 hover:text-slate-600"><Icons.ArrowLeft /></button>
                            <h3 className="font-bold text-xl text-slate-800">Nova Campanha</h3>
                        </div>
                        <div className="flex gap-2">
                            {[1, 2, 3].map(s => (
                                <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= s ? 'bg-brand-blue text-white' : 'bg-slate-100 text-slate-400'}`}>
                                    {s}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Step 1: Segmentation */}
                    {step === 1 && (
                        <div className="space-y-6 flex-1 animate-fade-in">
                            <div className="grid grid-cols-2 gap-4">
                                <Input label="Nome da Campanha (Interno)" value={newCampaign.title || ''} onChange={e => setNewCampaign({...newCampaign, title: e.target.value})} placeholder="Ex: Aviso de Manutenção" autoFocus />
                                <Select label="Canal de Envio" value={newCampaign.channel} onChange={e => setNewCampaign({...newCampaign, channel: e.target.value as any})}>
                                    <option value="EMAIL">E-mail (Marketing / Aviso)</option>
                                    <option value="WHATSAPP">WhatsApp (Manual / Link)</option>
                                </Select>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="font-bold text-slate-700">Segmentação de Público</h4>
                                    <button onClick={selectAll} className="text-xs text-brand-blue font-bold hover:underline">Selecionar Todos</button>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-6">
                                    {/* Roles */}
                                    <div>
                                        <p className="text-xs font-bold text-slate-500 uppercase mb-2">Função</p>
                                        <div className="space-y-2">
                                            {Object.values(UserRole).map(role => (
                                                <label key={role} className="flex items-center gap-2 cursor-pointer">
                                                    <input type="checkbox" checked={newCampaign.segmentation?.roles.includes(role)} onChange={() => updateSegmentation('roles', role)} className="rounded text-brand-blue bg-white border-gray-300 focus:ring-brand-blue w-4 h-4" />
                                                    <span className="text-sm text-slate-700">{role === 'MANAGER' ? 'Gestores' : role === 'TEACHER' ? 'Professores' : 'Admins'}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    {/* Status */}
                                    <div>
                                        <p className="text-xs font-bold text-slate-500 uppercase mb-2">Status Assinatura</p>
                                        <div className="space-y-2">
                                            {['ATIVO', 'INATIVO', 'VENCIDO'].map(st => (
                                                <label key={st} className="flex items-center gap-2 cursor-pointer">
                                                    <input type="checkbox" checked={newCampaign.segmentation?.status?.includes(st)} onChange={() => updateSegmentation('status', st)} className="rounded text-brand-blue bg-white border-gray-300 focus:ring-brand-blue w-4 h-4" />
                                                    <span className="text-sm text-slate-700 capitalize">{st.toLowerCase()}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Plans */}
                                    <div>
                                        <p className="text-xs font-bold text-slate-500 uppercase mb-2">Planos</p>
                                        <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar">
                                            {plans.map(p => (
                                                <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                                                    <input type="checkbox" checked={newCampaign.segmentation?.plans?.includes(p.name)} onChange={() => updateSegmentation('plans', p.name)} className="rounded text-brand-blue bg-white border-gray-300 focus:ring-brand-blue w-4 h-4" />
                                                    <span className="text-sm text-slate-700">{p.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex justify-between items-center">
                                <div>
                                    <p className="text-blue-900 font-bold">Público Alvo Selecionado</p>
                                    <p className="text-xs text-blue-700">Com base nos filtros acima.</p>
                                </div>
                                <div className="text-3xl font-bold text-blue-600">{targets.length} <span className="text-base font-normal text-blue-400">usuários</span></div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Content */}
                    {step === 2 && (
                        <div className="space-y-4 flex-1 animate-fade-in">
                            {newCampaign.channel === 'EMAIL' ? (
                                <>
                                    <Input label="Assunto do E-mail" value={newCampaign.content?.subject || ''} onChange={e => setNewCampaign({...newCampaign, content: { ...newCampaign.content!, subject: e.target.value }})} placeholder="Ex: Novidades na Plataforma" />
                                    <div className="bg-yellow-50 p-3 rounded text-xs text-yellow-800 border border-yellow-200 mb-2">
                                        <strong>Dica:</strong> Use <code>{'{nome}'}</code> para inserir o nome do usuário automaticamente.
                                    </div>
                                    <RichTextEditor label="Corpo do E-mail" value={newCampaign.content?.body || ''} onChange={html => setNewCampaign({...newCampaign, content: { ...newCampaign.content!, body: html }})} />
                                </>
                            ) : (
                                <>
                                    <div className="bg-green-50 p-4 rounded-lg border border-green-200 text-green-900 text-sm mb-4">
                                        <p className="font-bold mb-2 flex items-center gap-2"><Icons.Whatsapp /> Envio via WhatsApp</p>
                                        <p>Como a API oficial do WhatsApp é paga, este módulo gera links diretos de conversa para você clicar e enviar. É seguro e gratuito.</p>
                                    </div>
                                    <label className="text-sm font-bold text-slate-700">Mensagem de Texto</label>
                                    <textarea 
                                        className="w-full border border-slate-300 rounded-lg p-3 h-40 focus:ring-2 focus:ring-brand-blue outline-none resize-none"
                                        placeholder="Digite a mensagem aqui... Use {nome} para personalizar."
                                        value={newCampaign.content?.body || ''}
                                        onChange={e => setNewCampaign({...newCampaign, content: { ...newCampaign.content!, body: e.target.value }})}
                                    ></textarea>
                                </>
                            )}
                        </div>
                    )}

                    {/* Step 3: Review & Send */}
                    {step === 3 && (
                        <div className="space-y-6 flex-1 animate-fade-in">
                            <div className="text-center">
                                <h4 className="text-xl font-bold text-slate-800 mb-2">Resumo da Campanha</h4>
                                <p className="text-slate-500">Verifique os dados antes de iniciar o disparo.</p>
                            </div>

                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div className="bg-slate-50 p-4 rounded border border-slate-200">
                                    <p className="text-xs uppercase text-slate-500 font-bold">Canal</p>
                                    <p className="font-bold text-lg text-slate-800">{newCampaign.channel === 'EMAIL' ? 'E-mail Marketing' : 'WhatsApp'}</p>
                                </div>
                                <div className="bg-slate-50 p-4 rounded border border-slate-200">
                                    <p className="text-xs uppercase text-slate-500 font-bold">Destinatários</p>
                                    <p className="font-bold text-lg text-slate-800">{targets.length}</p>
                                </div>
                                <div className="bg-slate-50 p-4 rounded border border-slate-200">
                                    <p className="text-xs uppercase text-slate-500 font-bold">Estimativa</p>
                                    <p className="font-bold text-lg text-slate-800">{newCampaign.channel === 'EMAIL' ? `~${Math.ceil(targets.length * 0.8)} seg` : 'Manual'}</p>
                                </div>
                            </div>

                            {/* EMAIL SENDING UI */}
                            {newCampaign.channel === 'EMAIL' && (
                                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                                    {sendingProgress.active ? (
                                        <div className="space-y-4">
                                            <div className="flex justify-between text-sm font-bold text-slate-700">
                                                <span>Enviando...</span>
                                                <span>{sendingProgress.current} / {sendingProgress.total}</span>
                                            </div>
                                            <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
                                                <div 
                                                    className="bg-brand-blue h-full transition-all duration-300 relative" 
                                                    style={{ width: `${(sendingProgress.current / sendingProgress.total) * 100}%` }}
                                                >
                                                    <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                                                </div>
                                            </div>
                                            <p className="text-xs text-center text-red-500 font-bold animate-pulse">⚠️ NÃO FECHE ESTA JANELA ATÉ O TÉRMINO!</p>
                                        </div>
                                    ) : (
                                        <div className="text-center">
                                            <Button onClick={startSending} className="w-full py-4 text-lg font-bold shadow-lg shadow-blue-200">
                                                INICIAR DISPARO DE E-MAILS
                                            </Button>
                                            <p className="text-xs text-slate-400 mt-2">O sistema enviará em lotes para evitar bloqueios.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* WHATSAPP SENDING UI */}
                            {newCampaign.channel === 'WHATSAPP' && (
                                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col h-[400px]">
                                    <div className="bg-green-50 p-3 border-b border-green-100 text-green-800 text-sm font-bold flex justify-between items-center">
                                        <span>Lista de Envio Manual</span>
                                        <span className="text-xs bg-white px-2 py-1 rounded border border-green-200">Clique em "Enviar" para abrir o WhatsApp Web</span>
                                    </div>
                                    <div className="overflow-y-auto custom-scrollbar flex-1 p-2 space-y-2">
                                        {targets.map(t => {
                                            const message = newCampaign.content?.body?.replace(/{nome}/g, t.name) || '';
                                            const link = getWhatsAppLink(t.email, message); // Hack: using email field, assume phone might be stored somewhere or fallback
                                            
                                            return (
                                                <div key={t.id} className="flex justify-between items-center p-3 border border-slate-100 rounded hover:bg-slate-50">
                                                    <div>
                                                        <p className="font-bold text-sm text-slate-800">{t.name}</p>
                                                        <p className="text-xs text-slate-500">{t.email}</p>
                                                    </div>
                                                    <a 
                                                        href={link} 
                                                        target="_blank" 
                                                        rel="noreferrer"
                                                        className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1 transition-colors"
                                                    >
                                                        <Icons.Whatsapp /> Enviar
                                                    </a>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="p-4 border-t border-slate-100 bg-slate-50 text-center">
                                        <Button onClick={() => finishCampaign(targets.length, 0)} variant="secondary">
                                            Marcar Campanha como Concluída
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Footer Navigation */}
                    <div className="mt-6 pt-6 border-t border-slate-100 flex justify-between">
                        {step > 1 && !sendingProgress.active && (
                            <Button variant="ghost" onClick={() => setStep(step - 1)}>Voltar</Button>
                        )}
                        {!sendingProgress.active && step < 3 && (
                            <Button onClick={() => setStep(step + 1)} disabled={targets.length === 0} className="ml-auto">
                                Próximo: {step === 1 ? 'Conteúdo' : 'Revisão'}
                            </Button>
                        )}
                    </div>
                </Card>
            )}

            {/* COUPON MODAL */}
            <Modal
                isOpen={isCouponModalOpen}
                onClose={() => setIsCouponModalOpen(false)}
                title={editingCoupon.id ? 'Editar Cupom' : 'Novo Cupom'}
                footer={<Button onClick={handleSaveCoupon}>Salvar Cupom</Button>}
                maxWidth="max-w-md"
            >
                <div className="space-y-4">
                    <Input 
                        label="Código Promocional" 
                        value={editingCoupon.code} 
                        onChange={e => setEditingCoupon({...editingCoupon, code: e.target.value.toUpperCase()})} 
                        placeholder="EX: PROMO10" 
                        autoFocus
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                        <Select label="Tipo de Benefício" value={editingCoupon.type} onChange={e => setEditingCoupon({...editingCoupon, type: e.target.value as any})}>
                            <option value="PERCENTAGE">Desconto (%)</option>
                            <option value="FIXED">Desconto Fixo (R$)</option>
                            <option value="TRIAL_DAYS">Dias Grátis (Trial)</option>
                        </Select>
                        
                        <Input 
                            label="Valor" 
                            type="number" 
                            value={editingCoupon.value} 
                            onChange={e => setEditingCoupon({...editingCoupon, value: Number(e.target.value)})} 
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Input 
                            label="Limite de Usos (0 = Ilimitado)" 
                            type="number" 
                            value={editingCoupon.maxUses} 
                            onChange={e => setEditingCoupon({...editingCoupon, maxUses: Number(e.target.value)})} 
                        />
                        <Input 
                            label="Validade (Opcional)" 
                            type="date" 
                            value={editingCoupon.expiresAt?.split('T')[0] || ''} 
                            onChange={e => setEditingCoupon({...editingCoupon, expiresAt: e.target.value ? new Date(e.target.value).toISOString() : undefined})} 
                        />
                    </div>

                    <div className="flex items-center gap-2 border p-3 rounded bg-slate-50 mt-2">
                        <input 
                            type="checkbox" 
                            id="isActive"
                            checked={editingCoupon.isActive} 
                            onChange={e => setEditingCoupon({...editingCoupon, isActive: e.target.checked})} 
                            className="w-5 h-5 text-brand-blue rounded"
                        />
                        <label htmlFor="isActive" className="font-bold text-slate-700 cursor-pointer">Cupom Ativo</label>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default MarketingPage;
