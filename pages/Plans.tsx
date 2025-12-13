
import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Modal, Input, Select } from '../components/UI';
import { Icons } from '../components/Icons';
import { FirebaseService } from '../services/firebaseService';
import { Plan, PlanHighlightType } from '../types';

// Configuração visual dos destaques
const HIGHLIGHT_CONFIG: Record<string, { label: string, borderColor: string, badgeBg: string, textColor: string, badgeText: string }> = {
    'POPULAR': { 
        label: 'Popular', 
        borderColor: 'border-t-brand-blue', 
        badgeBg: 'bg-brand-blue', 
        textColor: 'text-brand-blue',
        badgeText: 'text-white'
    },
    'BEST_VALUE': { 
        label: 'Melhor Custo-Benefício', 
        borderColor: 'border-t-emerald-500', 
        badgeBg: 'bg-emerald-500', 
        textColor: 'text-emerald-600',
        badgeText: 'text-white'
    },
    'CHEAPEST': { 
        label: 'Mais Barato', 
        borderColor: 'border-t-amber-500', 
        badgeBg: 'bg-amber-500', 
        textColor: 'text-amber-600',
        badgeText: 'text-white'
    },
    'NONE': { 
        label: 'Nenhum', 
        borderColor: 'border-t-slate-300', 
        badgeBg: '', 
        textColor: 'text-slate-800',
        badgeText: ''
    }
};

const PlansPage = () => {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Partial<Plan>>({});
    const [newFeature, setNewFeature] = useState('');

    useEffect(() => {
        loadPlans();
    }, []);

    const loadPlans = async () => {
        try {
            const data = await FirebaseService.getPlans();
            setPlans(data.sort((a, b) => {
                if (a.price === -1) return 1;
                if (b.price === -1) return -1;
                return a.price - b.price;
            }));
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!editing.name || editing.price === undefined) return alert("Preencha nome e preço.");
        
        const planToSave: Plan = {
            id: editing.id || '',
            name: editing.name,
            description: editing.description || '',
            price: Number(editing.price),
            interval: editing.interval || 'monthly',
            isPopular: editing.highlightType === 'POPULAR', // Mantém retrocompatibilidade
            highlightType: editing.highlightType || 'NONE',
            features: editing.features || [],
            limits: {
                maxUsers: Number(editing.limits?.maxUsers) || 1,
                maxQuestions: Number(editing.limits?.maxQuestions) || 50,
                maxClasses: Number(editing.limits?.maxClasses) || 3,
                maxAiGenerations: Number(editing.limits?.maxAiGenerations) || 0,
                allowPdfImport: editing.limits?.allowPdfImport || false,
                allowWhiteLabel: editing.limits?.allowWhiteLabel || false
            }
        };

        try {
            await FirebaseService.savePlan(planToSave);
            setIsModalOpen(false);
            loadPlans();
        } catch (error) {
            console.error("Erro ao salvar plano", error);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("Tem certeza que deseja excluir este plano?")) {
            await FirebaseService.deletePlan(id);
            loadPlans();
        }
    };

    const addFeature = () => {
        if (!newFeature.trim()) return;
        setEditing({
            ...editing,
            features: [...(editing.features || []), newFeature]
        });
        setNewFeature('');
    };

    const removeFeature = (index: number) => {
        const newFeatures = [...(editing.features || [])];
        newFeatures.splice(index, 1);
        setEditing({ ...editing, features: newFeatures });
    };

    const openModal = (plan?: Plan) => {
        if (plan) {
            // Garante que plans antigos sem highlightType mas com isPopular sejam tratados
            let hType = plan.highlightType || 'NONE';
            if (hType === 'NONE' && plan.isPopular) hType = 'POPULAR';
            
            setEditing({
                ...JSON.parse(JSON.stringify(plan)),
                highlightType: hType
            });
        } else {
            setEditing({
                name: '',
                price: 0,
                interval: 'monthly',
                highlightType: 'NONE',
                features: [],
                limits: { maxUsers: 1, maxQuestions: 50, maxClasses: 3, maxAiGenerations: 0, allowPdfImport: false, allowWhiteLabel: false }
            });
        }
        setIsModalOpen(true);
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Carregando planos...</div>;

    return (
        <div className="p-8 h-full bg-slate-50 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-display font-bold text-slate-800">Planos e Assinaturas</h2>
                    <p className="text-slate-500">Gerencie os pacotes disponíveis na plataforma.</p>
                </div>
                <Button onClick={() => openModal()}><Icons.Plus /> Novo Plano</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.length === 0 && (
                    <div className="col-span-3 text-center py-10 border-2 border-dashed border-slate-200 rounded-xl text-slate-400">
                        Nenhum plano cadastrado.
                    </div>
                )}
                
                {plans.map(plan => {
                    // Fallback para isPopular se highlightType não existir (legado)
                    const type = plan.highlightType || (plan.isPopular ? 'POPULAR' : 'NONE');
                    const config = HIGHLIGHT_CONFIG[type] || HIGHLIGHT_CONFIG['NONE'];

                    return (
                        <Card key={plan.id} className={`relative transition-transform hover:-translate-y-1 border-t-4 shadow-lg ${config.borderColor}`}>
                            {type !== 'NONE' && (
                                <div className={`absolute top-0 right-0 text-xs font-bold px-3 py-1 rounded-bl ${config.badgeBg} ${config.badgeText}`}>
                                    {config.label}
                                </div>
                            )}
                            
                            <div className="mb-4">
                                <h3 className={`text-xl font-bold ${type !== 'NONE' ? config.textColor : 'text-slate-800'}`}>{plan.name}</h3>
                                <p className="text-slate-500 text-sm h-10">{plan.description}</p>
                            </div>
                            
                            <div className="text-3xl font-bold text-slate-800 mb-6 flex items-baseline gap-1">
                                {plan.price === -1 ? (
                                    <span className="text-2xl">Sob Consulta</span>
                                ) : plan.price === 0 ? (
                                    'Grátis'
                                ) : (
                                    `R$ ${plan.price.toFixed(2)}`
                                )}
                                <span className="text-sm font-normal text-slate-400">
                                    {plan.price > 0 && (plan.interval === 'monthly' ? '/mês' : '/ano')}
                                </span>
                            </div>
                            
                            <ul className="space-y-3 mb-8 text-sm text-slate-600 min-h-[150px]">
                                <li className="flex gap-2 items-start font-semibold text-brand-dark">
                                    <div className="mt-0.5 text-brand-blue"><Icons.UsersGroup /></div>
                                    <span className="flex-1">
                                        {plan.limits.maxUsers > 1 
                                            ? `Até ${plan.limits.maxUsers} Usuários (Gestão)` 
                                            : 'Uso Individual'}
                                    </span>
                                </li>
                                {plan.features.map((feat, idx) => (
                                    <li key={idx} className="flex gap-2 items-start">
                                        <div className="mt-0.5 text-green-500"><Icons.Check /></div>
                                        <span className="flex-1">{feat}</span>
                                    </li>
                                ))}
                            </ul>
                            
                            <div className="flex gap-2">
                                <Button variant="outline" className="flex-1" onClick={() => openModal(plan)}>Editar</Button>
                                <Button variant="ghost" className="text-red-400 hover:text-red-600 px-2" onClick={() => handleDelete(plan.id)}><Icons.Trash /></Button>
                            </div>
                        </Card>
                    );
                })}
            </div>

            <Modal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                title={editing.id ? "Editar Plano" : "Novo Plano"} 
                maxWidth="max-w-4xl"
                footer={<Button onClick={handleSave}>Salvar Plano</Button>}
            >
                <div className="space-y-6">
                    {/* Dados Básicos */}
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Nome do Plano" value={editing.name || ''} onChange={e => setEditing({...editing, name: e.target.value})} placeholder="Ex: Premium" />
                        <div className="flex gap-4 items-end">
                            <div className="flex-1">
                                <Input 
                                    label="Preço (R$)" 
                                    type="number" 
                                    step="0.01" 
                                    disabled={editing.price === -1}
                                    value={editing.price === -1 ? '' : (editing.price || '')} 
                                    onChange={e => setEditing({...editing, price: Number(e.target.value)})} 
                                />
                            </div>
                            <label className="flex items-center gap-2 mb-3 cursor-pointer p-2 rounded hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all h-[42px]">
                                <input 
                                    type="checkbox" 
                                    checked={editing.price === -1} 
                                    onChange={e => setEditing({...editing, price: e.target.checked ? -1 : 0})} 
                                    className="w-5 h-5 text-brand-blue rounded focus:ring-brand-blue" 
                                />
                                <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">Sob Consulta</span>
                            </label>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <Select label="Intervalo" value={editing.interval || 'monthly'} onChange={e => setEditing({...editing, interval: e.target.value as any})}>
                            <option value="monthly">Mensal</option>
                            <option value="yearly">Anual</option>
                            <option value="lifetime">Vitalício</option>
                        </Select>
                        <Input label="Descrição Curta" value={editing.description || ''} onChange={e => setEditing({...editing, description: e.target.value})} placeholder="Ex: Para escolas em crescimento" />
                    </div>
                    
                    {/* Seleção de Destaque Visual */}
                    <div>
                        <label className="text-sm font-semibold text-slate-700 mb-2 block">Destaque Visual</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {Object.entries(HIGHLIGHT_CONFIG).map(([key, conf]) => {
                                const isSelected = (editing.highlightType || 'NONE') === key;
                                return (
                                    <div 
                                        key={key}
                                        onClick={() => setEditing({ ...editing, highlightType: key as PlanHighlightType })}
                                        className={`
                                            cursor-pointer p-3 rounded-lg border-2 text-center transition-all
                                            ${isSelected 
                                                ? `border-brand-blue bg-blue-50 ring-1 ring-brand-blue` 
                                                : 'border-slate-200 hover:border-slate-300 bg-white'
                                            }
                                        `}
                                    >
                                        <div className={`text-sm font-bold ${isSelected ? 'text-brand-blue' : 'text-slate-600'}`}>
                                            {conf.label}
                                        </div>
                                        {key !== 'NONE' && (
                                            <div className={`mt-2 h-1.5 w-8 mx-auto rounded-full ${conf.badgeBg}`}></div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="border-t border-slate-200 pt-4">
                        <h4 className="font-bold text-slate-800 mb-4">Limites e Capacidade</h4>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="col-span-2 bg-blue-50 p-3 rounded border border-blue-100">
                                <Input 
                                    label="Limite de Usuários (Professores)" 
                                    type="number" 
                                    min="1"
                                    value={editing.limits?.maxUsers || 1} 
                                    onChange={e => setEditing({...editing, limits: {...editing.limits!, maxUsers: Number(e.target.value)}})} 
                                />
                                <p className="text-xs text-slate-500 mt-1">Defina 1 para planos individuais ou mais para planos escolares (Painel Administrativo).</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <Input label="Máx. Questões (-1 = Ilimitado)" type="number" value={editing.limits?.maxQuestions || ''} onChange={e => setEditing({...editing, limits: {...editing.limits!, maxQuestions: Number(e.target.value)}})} />
                            <Input label="Máx. Turmas" type="number" value={editing.limits?.maxClasses || ''} onChange={e => setEditing({...editing, limits: {...editing.limits!, maxClasses: Number(e.target.value)}})} />
                            <Input label="Gerações IA / mês" type="number" value={editing.limits?.maxAiGenerations || ''} onChange={e => setEditing({...editing, limits: {...editing.limits!, maxAiGenerations: Number(e.target.value)}})} />
                        </div>
                        <div className="flex gap-6 mt-4">
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="checkbox" checked={editing.limits?.allowPdfImport || false} onChange={e => setEditing({...editing, limits: {...editing.limits!, allowPdfImport: e.target.checked}})} className="w-4 h-4 text-brand-blue" />
                                Permitir Importação PDF
                            </label>
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="checkbox" checked={editing.limits?.allowWhiteLabel || false} onChange={e => setEditing({...editing, limits: {...editing.limits!, allowWhiteLabel: e.target.checked}})} className="w-4 h-4 text-brand-blue" />
                                White Label (Sem logo PF)
                            </label>
                        </div>
                    </div>

                    <div className="border-t border-slate-200 pt-4">
                        <h4 className="font-bold text-slate-800 mb-2">Lista de Recursos (Marketing)</h4>
                        <div className="flex gap-2 mb-4">
                            <Input value={newFeature} onChange={e => setNewFeature(e.target.value)} placeholder="Ex: Suporte Prioritário" onKeyDown={e => e.key === 'Enter' && addFeature()} />
                            <Button variant="secondary" onClick={addFeature}>Adicionar</Button>
                        </div>
                        <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar bg-slate-50 p-2 rounded border border-slate-200">
                            {editing.features?.length === 0 && <p className="text-slate-400 text-sm italic text-center">Nenhum recurso adicionado.</p>}
                            {editing.features?.map((feat, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-white p-2 rounded border border-slate-100 shadow-sm">
                                    <span className="text-sm">{feat}</span>
                                    <button onClick={() => removeFeature(idx)} className="text-red-400 hover:text-red-600"><Icons.Trash /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default PlansPage;
