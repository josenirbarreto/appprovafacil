
import React, { useState, useEffect } from 'react';
import { ContractTemplate, Plan } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { Button, Card, Badge, Modal, Input, Select, RichTextEditor } from '../components/UI';
import { Icons } from '../components/Icons';

const ContractTemplatesPage = () => {
    const [templates, setTemplates] = useState<ContractTemplate[]>([]);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [seeding, setSeeding] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Partial<ContractTemplate>>({});

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        const [t, p] = await Promise.all([
            FirebaseService.getContractTemplates(),
            FirebaseService.getPlans()
        ]);
        setTemplates(t);
        setPlans(p);
        setLoading(false);
    };

    const handleSave = async () => {
        if (!editing.title || !editing.content) return alert("Título e Conteúdo são obrigatórios.");
        await FirebaseService.saveContractTemplate({
            ...editing,
            version: (editing.version || 0) + 1
        });
        setIsModalOpen(false);
        loadData();
    };

    const handleSeed = async () => {
        if (!confirm("Isso criará automaticamente minutas de teste para todos os planos cadastrados. Continuar?")) return;
        setSeeding(true);
        try {
            await FirebaseService.seedDefaultContracts();
            alert("Modelos gerados com sucesso!");
            loadData();
        } catch (e) {
            alert("Erro ao gerar sementes.");
        } finally {
            setSeeding(false);
        }
    };

    const openModal = (t?: ContractTemplate) => {
        setEditing(t || { 
            title: '', 
            content: '<h1>CONTRATO DE PRESTAÇÃO DE SERVIÇOS</h1><p>Insira os termos aqui...</p>', 
            planId: 'ALL', 
            isActive: true, 
            version: 0 
        });
        setIsModalOpen(true);
    };

    const toggleStatus = async (t: ContractTemplate) => {
        await FirebaseService.saveContractTemplate({ ...t, isActive: !t.isActive });
        loadData();
    };

    if (loading && !seeding) return <div className="p-8 text-center">Carregando minutas...</div>;

    return (
        <div className="p-8 h-full bg-slate-50 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-display font-bold text-slate-800 flex items-center gap-2">
                        <Icons.FileText /> Gestão de Contratos
                    </h2>
                    <p className="text-slate-500">Defina as minutas jurídicas que os usuários devem assinar.</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" onClick={handleSeed} disabled={seeding || plans.length === 0} title="Gera automaticamente minutas para cada plano cadastrado">
                        {seeding ? 'Gerando...' : 'Gerar Modelos de Teste'}
                    </Button>
                    <Button onClick={() => openModal()}><Icons.Plus /> Nova Minuta</Button>
                </div>
            </div>

            {seeding && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3 animate-pulse">
                    <Icons.Refresh /> <span className="text-blue-800 text-sm font-bold">Processando geração automática de contratos...</span>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {templates.length === 0 && !seeding && (
                    <div className="col-span-3 text-center py-20 bg-white rounded-xl border-2 border-dashed border-slate-200 text-slate-400">
                        <Icons.FileText />
                        <p className="mt-2">Nenhuma minuta cadastrada. Use o botão acima para gerar modelos de teste.</p>
                    </div>
                )}
                
                {templates.map(t => (
                    <Card key={t.id} className={`border-t-4 transition-all hover:shadow-md ${t.isActive ? 'border-t-emerald-500' : 'border-t-slate-300'}`}>
                        <div className="flex justify-between items-start mb-4">
                            <Badge color={t.isActive ? 'green' : 'red'}>{t.isActive ? 'ATIVO' : 'INATIVO'}</Badge>
                            <span className="text-[10px] font-black text-slate-400">V{t.version}.0</span>
                        </div>
                        <h3 className="font-bold text-lg text-slate-800 mb-1">{t.title}</h3>
                        <p className="text-xs text-slate-500 mb-6 uppercase font-bold tracking-widest">Plano: {t.planId}</p>
                        
                        <div className="flex gap-2">
                            <Button variant="outline" className="flex-1 text-xs" onClick={() => openModal(t)}>Editar</Button>
                            <Button variant="ghost" className="text-xs" onClick={() => toggleStatus(t)}>
                                {t.isActive ? 'Desativar' : 'Ativar'}
                            </Button>
                        </div>
                    </Card>
                ))}
            </div>

            <Modal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                title={editing.id ? "Editar Minuta" : "Nova Minuta Jurídica"}
                maxWidth="max-w-5xl"
                footer={<Button onClick={handleSave}>Salvar e Gerar Nova Versão</Button>}
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Título do Documento" value={editing.title || ''} onChange={e => setEditing({...editing, title: e.target.value})} />
                        <Select label="Plano Aplicável" value={editing.planId || 'ALL'} onChange={e => setEditing({...editing, planId: e.target.value})}>
                            <option value="ALL">Todos os Planos</option>
                            {plans.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                        </Select>
                    </div>
                    <RichTextEditor 
                        label="Conteúdo do Contrato (Termos e Condições)" 
                        value={editing.content || ''} 
                        onChange={html => setEditing({...editing, content: html})} 
                    />
                </div>
            </Modal>
        </div>
    );
};

export default ContractTemplatesPage;
