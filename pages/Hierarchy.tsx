
import React, { useState, useEffect, useMemo } from 'react';
import { Discipline, UserRole, Question, CurricularComponent } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { Button, Modal, Input, Badge, Card } from '../components/UI';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';

const HierarchyPage = () => {
    const { user, refreshUser } = useAuth();
    const [hierarchy, setHierarchy] = useState<CurricularComponent[]>([]);
    const [allQuestions, setAllQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedComponents, setExpandedComponents] = useState<Record<string, boolean>>({});
    const [expandedDisciplines, setExpandedDisciplines] = useState<Record<string, boolean>>({});
    
    // Modal States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newItemName, setNewItemName] = useState('');
    const [modalConfig, setModalConfig] = useState<{
        type: 'component' | 'discipline' | 'chapter' | 'unit' | 'topic';
        title: string;
        ccId?: string;
        dId?: string;
        cId?: string;
        uId?: string;
    }>({ type: 'component', title: '' });

    // Share Modal States
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [sharingComponent, setSharingComponent] = useState<CurricularComponent | null>(null);
    const [generatedToken, setGeneratedToken] = useState<string | null>(null);

    // Redeem Modal States
    const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false);
    const [redeemCode, setRedeemCode] = useState('');
    const [redeemLoading, setRedeemLoading] = useState(false);

    useEffect(() => { if(user) load(); }, [user]);
    
    const load = async () => { 
        setLoading(true);
        try {
            const [hData, qData] = await Promise.all([
                FirebaseService.getHierarchy() as Promise<CurricularComponent[]>,
                FirebaseService.getQuestions(user)
            ]);
            setHierarchy(hData || []); 
            setAllQuestions(qData || []);
        } catch (err) {
            console.error("Erro ao carregar acervo:", err);
        } finally {
            setLoading(false); 
        }
    };

    const filteredHierarchy = useMemo(() => {
        if (!user || user.role === UserRole.ADMIN || user.role === UserRole.MANAGER) return hierarchy || [];
        const subjects = Array.isArray(user.subjects) ? user.subjects : [];
        const grants = Array.isArray(user.accessGrants) ? user.accessGrants : [];
        const authorized = [...subjects, ...grants];
        return (hierarchy || []).filter(cc => authorized.includes(cc.id));
    }, [hierarchy, user]);

    const handleDelete = async (type: any, ids: any) => {
        if(confirm('Tem certeza? Isso apagará todos os itens filhos.')) {
            await FirebaseService.deleteItem(type, ids);
            load();
        }
    }
    
    const handleOpenModal = (type: 'component' | 'discipline' | 'chapter' | 'unit' | 'topic', ids: any = {}) => {
        let title = '';
        switch(type) {
            case 'component': title = 'Novo Componente Curricular'; break;
            case 'discipline': title = 'Nova Disciplina'; break;
            case 'chapter': title = 'Novo Capítulo'; break;
            case 'unit': title = 'Nova Unidade'; break;
            case 'topic': title = 'Novo Tópico'; break;
        }
        setModalConfig({ type, title, ...ids });
        setNewItemName('');
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!newItemName.trim()) return;
        const { type, ccId, dId, cId, uId } = modalConfig;
        try {
            if (type === 'component') await FirebaseService.addComponent(newItemName);
            else if (type === 'discipline' && ccId) await FirebaseService.addDiscipline(ccId, newItemName);
            else if (type === 'chapter' && dId) await FirebaseService.addChapter(dId, newItemName);
            else if (type === 'unit' && cId) await FirebaseService.addUnit(cId, newItemName);
            else if (type === 'topic' && uId) await FirebaseService.addTopic(uId, newItemName);
            setIsModalOpen(false);
            load();
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar item.");
        }
    };

    const handleOpenShare = (cc: CurricularComponent) => {
        setSharingComponent(cc);
        setGeneratedToken(null);
        setIsShareModalOpen(true);
    };

    const handleGenerateToken = async (includeQuestions: boolean) => {
        if (!sharingComponent) return;
        try {
            const code = await FirebaseService.generateCommercialToken(sharingComponent.id, includeQuestions);
            setGeneratedToken(code);
        } catch (e) {
            alert("Erro ao gerar token.");
        }
    };

    const handleRedeem = async () => {
        if (!redeemCode.trim() || !user) return;
        setRedeemLoading(true);
        try {
            await FirebaseService.redeemCommercialToken(redeemCode, user);
            alert(`Sucesso! O conteúdo foi adicionado à sua conta.`);
            setIsRedeemModalOpen(false);
            setRedeemCode('');
            await refreshUser();
            await load();
        } catch (e: any) {
            alert(e.message || "Erro ao resgatar token.");
        } finally {
            setRedeemLoading(false);
        }
    };

    const getComponentStats = (cc: CurricularComponent) => {
        let disciplines = (cc.disciplines || []).length;
        let questions = allQuestions.filter(q => q.componentId === cc.id).length;
        return { disciplines, questions };
    };

    if(loading) return <div className="p-8 flex items-center justify-center text-slate-500 font-bold animate-pulse">Carregando acervo pedagógico...</div>;

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 bg-slate-50">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-3xl font-display font-bold text-slate-800 flex items-center gap-2">
                        <Icons.BookOpen /> Gestão de Conteúdos
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Organize componentes curriculares e suas disciplinas.</p>
                </div>
                <div className="flex gap-2">
                    {user?.role !== UserRole.ADMIN && (
                        <Button variant="secondary" onClick={() => setIsRedeemModalOpen(true)} className="shadow-md">
                            <Icons.Download /> Resgatar Conteúdo
                        </Button>
                    )}
                    {user?.role === UserRole.ADMIN && (
                        <Button onClick={() => handleOpenModal('component')} className="shadow-lg"><Icons.Plus /> Novo Componente</Button>
                    )}
                </div>
            </div>

            <div className="grid gap-6">
                {(filteredHierarchy || []).length === 0 && (
                    <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-slate-200 text-slate-400">
                        <div className="mb-2"><Icons.BookOpen /></div>
                        <p>Nenhum componente curricular disponível para seu perfil.</p>
                    </div>
                )}

                {(filteredHierarchy || []).map((cc) => {
                    const isExpanded = expandedComponents[cc.id] === true;
                    const stats = getComponentStats(cc);

                    return (
                        <div key={cc.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden transition-all duration-200">
                            <div className="bg-slate-800 text-white p-4 flex justify-between items-center select-none cursor-pointer hover:bg-slate-900" onClick={() => setExpandedComponents(prev => ({ ...prev, [cc.id]: !isExpanded }))}>
                                <div className="flex items-center gap-3">
                                    <div className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}><Icons.ChevronDown /></div>
                                    <div>
                                        <h3 className="text-lg font-bold tracking-wide uppercase">{cc.name}</h3>
                                        <div className="flex gap-2 mt-0.5">
                                            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-black uppercase">{stats.disciplines} Disciplinas</span>
                                            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-black uppercase">{stats.questions} Questões</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                    {user?.role === UserRole.ADMIN && (
                                        <button onClick={() => handleOpenShare(cc)} className="bg-white/20 hover:bg-white text-white hover:text-brand-dark p-2 rounded-lg transition-all flex items-center gap-2 text-xs font-bold">
                                            <Icons.Bank /> Comercializar
                                        </button>
                                    )}
                                    {(user?.role === UserRole.ADMIN || user?.role === UserRole.MANAGER) && (
                                        <Button variant="ghost" className="text-white/80 hover:text-white hover:bg-white/20 text-xs py-1 px-2 h-auto" onClick={() => handleOpenModal('discipline', { ccId: cc.id })}>
                                            + Disciplina
                                        </Button>
                                    )}
                                    {user?.role === UserRole.ADMIN && (
                                        <button onClick={() => handleDelete('component', { ccId: cc.id })} className="text-white/70 hover:text-white p-1.5 rounded hover:bg-white/20 transition-colors">
                                            <Icons.Trash />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {isExpanded && (
                                <div className="p-4 bg-slate-50 space-y-4 animate-fade-in">
                                    {(!cc.disciplines || cc.disciplines.length === 0) ? (
                                        <p className="text-slate-500 text-sm italic text-center py-4">Nenhuma disciplina cadastrada.</p>
                                    ) : (
                                        cc.disciplines.map(d => {
                                            const isDiscExpanded = expandedDisciplines[d.id] === true;
                                            return (
                                                <div key={d.id} className="border border-slate-200 rounded-lg bg-white shadow-sm overflow-hidden">
                                                    <div className="p-3 flex justify-between items-center bg-blue-50 border-b border-blue-100 cursor-pointer" onClick={() => setExpandedDisciplines(prev => ({ ...prev, [d.id]: !isDiscExpanded }))}>
                                                        <div className="flex items-center gap-2">
                                                            <div className={`transform transition-transform duration-200 text-blue-600 ${isDiscExpanded ? 'rotate-180' : ''}`}><Icons.ChevronDown /></div>
                                                            <span className="font-bold text-blue-900">{d.name}</span>
                                                        </div>
                                                        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                                            {(user?.role === UserRole.ADMIN || user?.role === UserRole.MANAGER) && (
                                                                <button onClick={() => handleOpenModal('chapter', { dId: d.id })} className="text-[10px] font-black uppercase text-blue-600 bg-white border border-blue-200 px-2 py-1 rounded hover:bg-blue-600 hover:text-white transition-colors">
                                                                    + Capítulo
                                                                </button>
                                                            )}
                                                            {user?.role === UserRole.ADMIN && (
                                                                <button onClick={() => handleDelete('discipline', { dId: d.id })} className="text-slate-400 hover:text-red-600"><Icons.Trash /></button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {isDiscExpanded && (
                                                        <div className="p-4 space-y-4">
                                                            {(d.chapters || []).map(c => (
                                                                <div key={c.id} className="border-l-4 border-blue-200 pl-4 py-1">
                                                                    <div className="flex justify-between items-center mb-3">
                                                                        <h5 className="font-bold text-slate-700">{c.name}</h5>
                                                                        <div className="flex gap-1">
                                                                            <button onClick={() => handleOpenModal('unit', { cId: c.id })} className="text-[10px] font-bold text-slate-500 hover:text-blue-600 px-2">+ Unidade</button>
                                                                            {user?.role === UserRole.ADMIN && <button onClick={() => handleDelete('chapter', { cId: c.id })} className="text-slate-300 hover:text-red-500"><Icons.Trash /></button>}
                                                                        </div>
                                                                    </div>
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                        {(c.units || []).map(u => (
                                                                            <div key={u.id} className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                                                                <div className="flex justify-between items-center mb-2">
                                                                                    <span className="text-xs font-bold text-slate-600 uppercase tracking-tight">{u.name}</span>
                                                                                    <div className="flex gap-1">
                                                                                        <button onClick={() => handleOpenModal('topic', { uId: u.id })} className="text-[10px] text-brand-blue font-bold hover:underline">+ Tópico</button>
                                                                                        {user?.role === UserRole.ADMIN && <button onClick={() => handleDelete('unit', { uId: u.id })} className="text-slate-300 hover:text-red-500"><Icons.Trash /></button>}
                                                                                    </div>
                                                                                </div>
                                                                                <div className="flex flex-wrap gap-1.5">
                                                                                    {(u.topics || []).map(t => (
                                                                                        <div key={t.id} className="group bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px] font-medium text-slate-500 flex items-center gap-1">
                                                                                            {t.name}
                                                                                            {user?.role === UserRole.ADMIN && <button onClick={() => handleDelete('topic', { tId: t.id })} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600"><Icons.X /></button>}
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Modal de Token */}
            <Modal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} title={`Licenciar Componente: ${sharingComponent?.name}`} maxWidth="max-w-2xl">
                {sharingComponent && (
                    <div className="space-y-6">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <h4 className="font-bold text-slate-800 uppercase text-xs tracking-widest mb-1">Impacto da Licença</h4>
                            <p className="text-sm text-slate-500">Este token liberará o Componente e todas as suas Disciplinas vinculadas.</p>
                        </div>

                        {generatedToken ? (
                            <div className="bg-emerald-50 border-2 border-emerald-200 p-8 rounded-2xl text-center">
                                <p className="text-emerald-800 font-bold mb-2">Token Gerado!</p>
                                <div className="bg-white border-2 border-emerald-500 text-emerald-600 font-mono text-4xl font-black py-4 rounded-xl mb-4">
                                    {generatedToken}
                                </div>
                                <Button onClick={() => setGeneratedToken(null)} variant="outline">Gerar Novo</Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-6 border-2 border-slate-200 rounded-xl hover:border-brand-blue cursor-pointer bg-white transition-all" onClick={() => handleGenerateToken(false)}>
                                    <h5 className="font-bold text-slate-800">Apenas Estrutura</h5>
                                    <p className="text-xs text-slate-500 mt-1">Libera o currículo vazio para o usuário preencher.</p>
                                </div>
                                <div className="p-6 border-2 border-brand-blue bg-blue-50 rounded-xl cursor-pointer transition-all" onClick={() => handleGenerateToken(true)}>
                                    <h5 className="font-bold text-brand-blue">Pacote Completo</h5>
                                    <p className="text-xs text-blue-700 mt-1">Libera currículo + todas as questões já cadastradas.</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalConfig.title} footer={<Button onClick={handleSave}>Salvar</Button>} maxWidth="max-w-md">
                <div className="space-y-4">
                    <Input label="Nome" value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="Digite o nome..." autoFocus onKeyDown={e => e.key === 'Enter' && handleSave()}/>
                </div>
            </Modal>

            <Modal isOpen={isRedeemModalOpen} onClose={() => setIsRedeemModalOpen(false)} title="Resgatar Conteúdo" footer={<Button onClick={handleRedeem} disabled={redeemLoading}>{redeemLoading ? 'Processando...' : 'Ativar Agora'}</Button>} maxWidth="max-w-md">
                <div className="space-y-4">
                    <p className="text-sm text-slate-600">Insira o código de ativação fornecido para liberar novos componentes curriculares.</p>
                    <Input label="Código do Token" value={redeemCode} onChange={e => setRedeemCode(e.target.value.toUpperCase())} placeholder="EX: 4X9J2B7K" className="text-center font-mono text-xl" />
                </div>
            </Modal>
        </div>
    );
};

export default HierarchyPage;
