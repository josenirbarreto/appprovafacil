
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { FirebaseService } from '../services/firebaseService';
import { Button, Input, Card, Badge, Modal } from '../components/UI';
import { Icons } from '../components/Icons';
import { UserRole, ContractTemplate } from '../types';

const ProfilePage = () => {
    const { user, refreshUser } = useAuth();
    const [name, setName] = useState(user?.name || '');
    const [photoUrl, setPhotoUrl] = useState(user?.photoUrl || '');
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState('');
    
    // Estados para visualização de contrato
    const [activeContract, setActiveContract] = useState<ContractTemplate | null>(null);
    const [isContractModalOpen, setIsContractModalOpen] = useState(false);
    const [loadingContract, setLoadingContract] = useState(false);

    const isAdmin = user?.role === UserRole.ADMIN;

    useEffect(() => {
        if (user) {
            setName(user.name);
            setPhotoUrl(user.photoUrl || '');
        }
    }, [user]);

    const handleSave = async () => {
        if (!user) return; 
        setLoading(true); 
        try { 
            await FirebaseService.updateUser(user.id, { name, photoUrl }); 
            await refreshUser(); 
            setMsg('Perfil atualizado com sucesso!'); 
            setTimeout(() => setMsg(''), 3000);
        } catch (error) { 
            console.error(error); 
            setMsg('Erro ao atualizar perfil.'); 
        } 
        setLoading(false);
    };
    
    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => { 
        const file = e.target.files?.[0]; 
        if (file) { 
            const reader = new FileReader(); 
            reader.onloadend = () => { setPhotoUrl(reader.result as string); }; 
            reader.readAsDataURL(file); 
        } 
    };

    const handleViewContract = async () => {
        if (!user) return;
        setLoadingContract(true);
        try {
            const contract = await FirebaseService.getActiveContractForPlan(user.plan || 'BASIC');
            setActiveContract(contract);
            setIsContractModalOpen(true);
        } catch (e) {
            alert("Não foi possível carregar os termos de uso.");
        } finally {
            setLoadingContract(false);
        }
    };

    const getRoleLabel = () => {
        if (user?.role === UserRole.ADMIN) return 'Administrador';
        if (user?.role === UserRole.MANAGER) return 'Gestor Escolar';
        return 'Professor';
    };

    return (
        <div className="p-8 max-w-4xl mx-auto h-full overflow-y-auto custom-scrollbar">
            <h2 className="text-3xl font-display font-bold text-slate-800 mb-8">Configurações da Conta</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Coluna da Esquerda: Perfil */}
                <div className="md:col-span-2 space-y-6">
                    <Card title="Informações Pessoais">
                        <div className="flex items-center gap-6 mb-8">
                            <div className="relative group shrink-0">
                                {photoUrl ? (
                                    <img src={photoUrl} alt="Profile" className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md" />
                                ) : (
                                    <div className="w-24 h-24 bg-brand-blue text-white rounded-full flex items-center justify-center text-3xl font-bold shadow-md">
                                        {name.charAt(0)}
                                    </div>
                                )}
                                <label className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity text-white text-[10px] font-black uppercase">
                                    Alterar
                                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                                </label>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 leading-tight">{user?.name}</h3>
                                <p className="text-slate-500 text-sm mb-2">{user?.email}</p>
                                <Badge color={isAdmin ? 'purple' : 'blue'}>{getRoleLabel()}</Badge>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <Input label="Nome Completo" value={name} onChange={e => setName(e.target.value)} />
                            
                            <div className="grid grid-cols-2 gap-4">
                                <Input 
                                    label="Plano de Acesso" 
                                    value={isAdmin ? 'Plano Vitalício Admin' : (user?.plan || 'Plano Basic')} 
                                    disabled 
                                    className="bg-slate-50 font-bold text-slate-600"
                                />
                                <Input 
                                    label="Próxima Renovação" 
                                    value={isAdmin ? 'Nunca expira' : (user?.subscriptionEnd ? new Date(user.subscriptionEnd).toLocaleDateString() : '-')} 
                                    disabled 
                                    className="bg-slate-50 font-bold text-slate-600"
                                />
                            </div>
                        </div>

                        <div className="flex justify-between items-center pt-6 mt-6 border-t border-slate-100">
                            <span className={`text-xs font-bold uppercase tracking-widest ${msg.includes('sucesso') ? 'text-green-600' : 'text-red-600'}`}>
                                {msg}
                            </span>
                            <Button onClick={handleSave} disabled={loading} className="px-8 shadow-lg shadow-blue-100">
                                {loading ? 'Salvando...' : 'Salvar Alterações'}
                            </Button>
                        </div>
                    </Card>
                </div>

                {/* Coluna da Direita: Documentos e Legal */}
                <div className="space-y-6">
                    <Card title="Jurídico & Contratos">
                        <div className="space-y-4">
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="flex items-center gap-3 mb-3 text-brand-blue">
                                    <Icons.Shield />
                                    <span className="text-sm font-bold text-slate-800">Contrato Ativo</span>
                                </div>
                                <p className="text-xs text-slate-500 leading-relaxed mb-4">
                                    Consulte os termos de licenciamento e políticas de privacidade aceitos para o seu plano atual.
                                </p>
                                <Button 
                                    variant="outline" 
                                    className="w-full text-xs font-bold h-9" 
                                    onClick={handleViewContract}
                                    disabled={loadingContract}
                                >
                                    {loadingContract ? 'Carregando...' : 'Visualizar Termos'}
                                </Button>
                            </div>

                            <div className="text-[10px] text-slate-400 font-mono text-center uppercase tracking-tighter">
                                ID Assinatura: {user?.lastSignedContractId?.slice(0,12) || 'N/A'}
                            </div>
                        </div>
                    </Card>

                    <Card title="Segurança">
                        <div className="space-y-3">
                            <p className="text-xs text-slate-500">Deseja alterar sua senha de acesso?</p>
                            <Button variant="ghost" className="w-full text-xs font-bold text-brand-blue justify-start px-0" onClick={() => alert("Função disponível no próximo login via 'Esqueci minha senha'.")}>
                                <Icons.Refresh /> Solicitar Nova Senha
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>

            {/* MODAL DE VISUALIZAÇÃO DE CONTRATO */}
            <Modal
                isOpen={isContractModalOpen}
                onClose={() => setIsContractModalOpen(false)}
                title="Termos de Uso e Licenciamento"
                maxWidth="max-w-4xl"
                footer={<Button onClick={() => setIsContractModalOpen(false)}>Fechar Documento</Button>}
            >
                {activeContract ? (
                    <div className="animate-fade-in">
                        <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between">
                            <div>
                                <h4 className="text-sm font-bold text-blue-900">{activeContract.title}</h4>
                                <p className="text-[10px] text-blue-700 font-bold uppercase tracking-widest">Versão {activeContract.version}.0 | Publicado em {new Date(activeContract.updatedAt).toLocaleDateString()}</p>
                            </div>
                            <Badge color="green">VIGENTE</Badge>
                        </div>
                        
                        <div className="prose prose-slate max-w-none bg-white p-8 border rounded-2xl shadow-inner overflow-y-auto max-h-[60vh] custom-scrollbar rich-text-content">
                            <div dangerouslySetInnerHTML={{ __html: activeContract.content }} />
                        </div>

                        <div className="mt-6 p-4 border-t border-slate-100 flex items-center gap-3 grayscale opacity-60">
                            <Icons.Check />
                            <p className="text-xs text-slate-500 italic">Este documento foi aceito eletronicamente e possui validade jurídica vinculada ao seu usuário.</p>
                        </div>
                    </div>
                ) : (
                    <div className="p-20 text-center text-slate-400 italic">Nenhum contrato encontrado para seu plano.</div>
                )}
            </Modal>
        </div>
    );
};

export default ProfilePage;
