
import React, { useState, useEffect, useMemo } from 'react';
import { Discipline, UserRole, Question, CurricularComponent, Chapter, Unit, Topic } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { Button, Modal, Input, Badge, Card } from '../components/UI';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';

// Paleta de cores para os componentes
const COLOR_PALETTE = [
    { base: 'blue', text: 'text-blue-600', bg: 'bg-blue-600', light: 'bg-blue-50', border: 'border-blue-200', medium: 'bg-blue-100', hover: 'hover:bg-blue-700' },
    { base: 'emerald', text: 'text-emerald-600', bg: 'bg-emerald-600', light: 'bg-emerald-50', border: 'border-emerald-200', medium: 'bg-emerald-100', hover: 'hover:bg-emerald-700' },
    { base: 'violet', text: 'text-violet-600', bg: 'bg-violet-600', light: 'bg-violet-50', border: 'border-violet-200', medium: 'bg-violet-100', hover: 'hover:bg-violet-700' },
    { base: 'orange', text: 'text-orange-600', bg: 'bg-orange-600', light: 'bg-orange-50', border: 'border-orange-200', medium: 'bg-orange-100', hover: 'hover:bg-orange-700' },
    { base: 'rose', text: 'text-rose-600', bg: 'bg-rose-600', light: 'bg-rose-50', border: 'border-rose-200', medium: 'bg-rose-100', hover: 'hover:bg-rose-700' },
    { base: 'amber', text: 'text-amber-600', bg: 'bg-amber-600', light: 'bg-amber-50', border: 'border-amber-200', medium: 'bg-amber-100', hover: 'hover:bg-amber-700' },
    { base: 'cyan', text: 'text-cyan-600', bg: 'bg-cyan-600', light: 'bg-cyan-50', border: 'border-cyan-200', medium: 'bg-cyan-100', hover: 'hover:bg-cyan-700' },
    { base: 'indigo', text: 'text-indigo-600', bg: 'bg-indigo-600', light: 'bg-indigo-50', border: 'border-indigo-200', medium: 'bg-indigo-100', hover: 'hover:bg-indigo-700' },
];

const HierarchyPage = () => {
    const { user, refreshUser } = useAuth();
    const [hierarchy, setHierarchy] = useState<CurricularComponent[]>([]);
    const [allQuestions, setAllQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Estados de Acordeon (Todos começam fechados por padrão)
    const [expandedComponents, setExpandedComponents] = useState<Record<string, boolean>>({});
    const [expandedDisciplines, setExpandedDisciplines] = useState<Record<string, boolean>>({});
    const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});
    const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>({});
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newItemName, setNewItemName] = useState('');
    const [modalConfig, setModalConfig] = useState<{
        type: 'component' | 'discipline' | 'chapter' | 'unit' | 'topic';
        title: string;
        ccId?: string; dId?: string; cId?: string; uId?: string;
    }>({ type: 'component', title: '' });

    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [sharingComponent, setSharingComponent] = useState<CurricularComponent | null>(null);
    const [generatedToken, setGeneratedToken] = useState<string | null>(null);

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

    const getColor = (index: number) => COLOR_PALETTE[index % COLOR_PALETTE.length];

    const handleDelete = async (type: string, ids: any) => {
        if(confirm('Tem certeza? Isso apagará este item e todos os seus subitens vinculados.')) {
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
        const code = await FirebaseService.generateCommercialToken(sharingComponent.id, includeQuestions);
        setGeneratedToken(code);
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

    if(loading) return <div className="p-8 flex items-center justify-center text-slate-500 font-bold animate-pulse">Carregando acervo pedagógico...</div>;

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 bg-slate-50">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-display font-bold text-slate-800 flex items-center gap-2">
                        <Icons.BookOpen /> Acervo Pedagógico
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Navegue e organize a estrutura curricular da instituição.</p>
                </div>
                <div className="flex gap-3">
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

            <div className="space-y-6">
                {filteredHierarchy.length === 0 && (
                    <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200 text-slate-400">
                        <Icons.BookOpen />
                        <p className="mt-2">Nenhum componente vinculado ao seu perfil.</p>
                    </div>
                )}

                {filteredHierarchy.map((cc, ccIdx) => {
                    const color = getColor(ccIdx);
                    const isCcExpanded = !!expandedComponents[cc.id];
                    const qCount = allQuestions.filter(q => q.componentId === cc.id).length;

                    return (
                        <div key={cc.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden transition-all duration-200">
                            {/* NÍVEL 1: COMPONENTE */}
                            <div 
                                className={`${color.bg} ${color.hover} text-white p-5 flex justify-between items-center cursor-pointer select-none`}
                                onClick={() => setExpandedComponents(prev => ({ ...prev, [cc.id]: !isCcExpanded }))}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`transform transition-transform duration-200 ${isCcExpanded ? 'rotate-180' : ''}`}><Icons.ChevronDown /></div>
                                    <div>
                                        <h3 className="text-xl font-black tracking-tight uppercase">{cc.name}</h3>
                                        <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">{cc.disciplines?.length || 0} Disciplinas • {qCount} Questões</p>
                                    </div>
                                </div>
                                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                    {user?.role === UserRole.ADMIN && (
                                        <button onClick={() => handleOpenShare(cc)} className="bg-white/20 hover:bg-white/40 p-2 rounded-lg text-xs font-bold flex items-center gap-2">
                                            <Icons.Bank /> Comercializar
                                        </button>
                                    )}
                                    <button onClick={() => handleOpenModal('discipline', { ccId: cc.id })} className="bg-white/20 hover:bg-white/40 p-2 rounded-lg text-xs font-bold">+ Disciplina</button>
                                    {user?.role === UserRole.ADMIN && <button onClick={() => handleDelete('component', { ccId: cc.id })} className="text-white/60 hover:text-white p-2"><Icons.Trash /></button>}
                                </div>
                            </div>

                            {isCcExpanded && (
                                <div className="p-4 space-y-4 bg-slate-50 animate-fade-in">
                                    {cc.disciplines?.map(d => {
                                        const isDExpanded = !!expandedDisciplines[d.id];
                                        return (
                                            <div key={d.id} className={`bg-white border ${color.border} rounded-xl shadow-sm overflow-hidden`}>
                                                {/* NÍVEL 2: DISCIPLINA */}
                                                <div 
                                                    className={`p-4 flex justify-between items-center cursor-pointer ${color.light}`}
                                                    onClick={() => setExpandedDisciplines(prev => ({ ...prev, [d.id]: !isDExpanded }))}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`transform transition-transform duration-200 ${color.text} ${isDExpanded ? 'rotate-180' : ''}`}><Icons.ChevronDown /></div>
                                                        <span className={`font-black text-lg ${color.text}`}>{d.name}</span>
                                                    </div>
                                                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                                        <button onClick={() => handleOpenModal('chapter', { dId: d.id })} className={`text-[10px] font-black uppercase ${color.bg} text-white px-3 py-1 rounded-full shadow-sm`}>+ Capítulo</button>
                                                        {user?.role === UserRole.ADMIN && <button onClick={() => handleDelete('discipline', { dId: d.id })} className="text-slate-300 hover:text-red-500"><Icons.Trash /></button>}
                                                    </div>
                                                </div>

                                                {isDExpanded && (
                                                    <div className="p-4 space-y-3 animate-fade-in">
                                                        {d.chapters?.map(chap => {
                                                            const isCExpanded = !!expandedChapters[chap.id];
                                                            return (
                                                                <div key={chap.id} className="border border-slate-100 rounded-lg overflow-hidden">
                                                                    {/* NÍVEL 3: CAPÍTULO (ACORDEON) */}
                                                                    <div 
                                                                        className={`p-3 flex justify-between items-center cursor-pointer ${color.medium} border-b border-white/50`}
                                                                        onClick={() => setExpandedChapters(prev => ({ ...prev, [chap.id]: !isCExpanded }))}
                                                                    >
                                                                        <div className="flex items-center gap-2">
                                                                            <div className={`transform transition-transform duration-200 text-slate-500 ${isCExpanded ? 'rotate-180' : ''}`}><Icons.ChevronDown /></div>
                                                                            <Icons.BookOpen />
                                                                            <span className="font-bold text-slate-700">{chap.name}</span>
                                                                        </div>
                                                                        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                                                            <button onClick={() => handleOpenModal('unit', { cId: chap.id })} className="text-[10px] font-bold text-slate-500 hover:text-brand-blue">+ Unidade</button>
                                                                            {user?.role === UserRole.ADMIN && <button onClick={() => handleDelete('chapter', { dId: d.id, cId: chap.id })} className="text-slate-400 hover:text-red-500"><Icons.X /></button>}
                                                                        </div>
                                                                    </div>

                                                                    {isCExpanded && (
                                                                        <div className="p-3 bg-slate-50/50 space-y-2 animate-fade-in">
                                                                            {chap.units?.map(unit => {
                                                                                const isUExpanded = !!expandedUnits[unit.id];
                                                                                return (
                                                                                    <div key={unit.id} className="bg-white border border-slate-200 rounded shadow-sm overflow-hidden">
                                                                                        {/* NÍVEL 4: UNIDADE (ACORDEON) */}
                                                                                        <div 
                                                                                            className="p-2 pl-4 border-l-4 flex justify-between items-center cursor-pointer hover:bg-slate-50"
                                                                                            style={{ borderLeftColor: `var(--tw-color-${color.base}-400)` }}
                                                                                            onClick={() => setExpandedUnits(prev => ({ ...prev, [unit.id]: !isUExpanded }))}
                                                                                        >
                                                                                            <div className="flex items-center gap-2">
                                                                                                <div className={`transform transition-transform text-slate-400 ${isUExpanded ? 'rotate-180' : ''}`}><Icons.ChevronDown /></div>
                                                                                                <span className="text-sm font-bold text-slate-600 uppercase tracking-tight">{unit.name}</span>
                                                                                            </div>
                                                                                            <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                                                                                <button onClick={() => handleOpenModal('topic', { uId: unit.id })} className={`text-[10px] font-bold ${color.text}`}>+ Tópico</button>
                                                                                                {user?.role === UserRole.ADMIN && <button onClick={() => handleDelete('unit', { dId: d.id, cId: chap.id, uId: unit.id })} className="text-slate-300 hover:text-red-500"><Icons.X /></button>}
                                                                                            </div>
                                                                                        </div>

                                                                                        {isUExpanded && (
                                                                                            <div className="p-3 flex flex-wrap gap-2 animate-fade-in">
                                                                                                {unit.topics?.map(topic => (
                                                                                                    <div key={topic.id} className={`group ${color.light} ${color.border} border px-3 py-1 rounded-full text-xs font-bold ${color.text} flex items-center gap-2`}>
                                                                                                        {topic.name}
                                                                                                        {user?.role === UserRole.ADMIN && (
                                                                                                            <button onClick={() => handleDelete('topic', { dId: d.id, cId: chap.id, uId: unit.id, tId: topic.id })} className="opacity-0 group-hover:opacity-100 text-red-500 transition-opacity">
                                                                                                                <Icons.X />
                                                                                                            </button>
                                                                                                        )}
                                                                                                    </div>
                                                                                                ))}
                                                                                                {(!unit.topics || unit.topics.length === 0) && <p className="text-[10px] text-slate-400 italic">Nenhum tópico.</p>}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                            {(!chap.units || chap.units.length === 0) && <p className="text-[10px] text-slate-400 italic ml-4">Nenhuma unidade.</p>}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                        {(!d.chapters || d.chapters.length === 0) && <p className="text-sm text-slate-400 italic text-center py-4">Nenhum capítulo cadastrado.</p>}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* MODAIS (Mantidos iguais, apenas as ações chamam o load()) */}
            <Modal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} title={`Licenciar: ${sharingComponent?.name}`} maxWidth="max-w-2xl">
                {sharingComponent && (
                    <div className="space-y-6">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <p className="text-sm text-slate-500">Este token liberará o Componente e todas as suas Disciplinas vinculadas para outro usuário.</p>
                        </div>
                        {generatedToken ? (
                            <div className="bg-emerald-50 border-2 border-emerald-200 p-8 rounded-2xl text-center animate-scale-in">
                                <p className="text-emerald-800 font-bold mb-2 uppercase text-xs tracking-widest">Token Gerado com Sucesso</p>
                                <div className="bg-white border-2 border-emerald-500 text-emerald-600 font-mono text-4xl font-black py-4 rounded-xl mb-4 shadow-inner">
                                    {generatedToken}
                                </div>
                                <Button onClick={() => setGeneratedToken(null)} variant="outline">Gerar outro para este componente</Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-6 border-2 border-slate-100 rounded-2xl hover:border-brand-blue cursor-pointer bg-white transition-all shadow-sm hover:shadow-md group" onClick={() => handleGenerateToken(false)}>
                                    <h5 className="font-black text-slate-800 group-hover:text-brand-blue">ESTRUTURA CURRICULAR</h5>
                                    <p className="text-xs text-slate-500 mt-2">Libera apenas o "esqueleto" do curso para o professor preencher.</p>
                                </div>
                                <div className="p-6 border-2 border-brand-blue/30 bg-blue-50 rounded-2xl cursor-pointer transition-all shadow-sm hover:shadow-md group" onClick={() => handleGenerateToken(true)}>
                                    <h5 className="font-black text-brand-blue">PACOTE CONTEÚDO (FULL)</h5>
                                    <p className="text-xs text-blue-700 mt-2">Libera a estrutura + todas as questões oficiais do banco.</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalConfig.title} footer={<Button onClick={handleSave}>Salvar Item</Button>} maxWidth="max-w-md">
                <div className="space-y-4">
                    <Input label="Nome do Item" value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="Digite o nome..." autoFocus onKeyDown={e => e.key === 'Enter' && handleSave()}/>
                </div>
            </Modal>

            <Modal isOpen={isRedeemModalOpen} onClose={() => setIsRedeemModalOpen(false)} title="Ativar Novo Conteúdo" footer={<Button onClick={handleRedeem} disabled={redeemLoading}>{redeemLoading ? 'Validando...' : 'Ativar Agora'}</Button>} maxWidth="max-w-md">
                <div className="space-y-4">
                    <p className="text-sm text-slate-600">Insira o código de ativação fornecido pela sua instituição ou adquirido comercialmente.</p>
                    <Input label="Código do Token" value={redeemCode} onChange={e => setRedeemCode(e.target.value.toUpperCase())} placeholder="EX: 4X9J2B7K" className="text-center font-mono text-xl uppercase tracking-widest" />
                </div>
            </Modal>
        </div>
    );
};

export default HierarchyPage;
