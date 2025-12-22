
import React, { useState, useEffect, useMemo } from 'react';
import { Discipline, UserRole, Question, CurricularComponent, Chapter, Unit, Topic } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { Button, Modal, Input, Badge, Card } from '../components/UI';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';

// Paleta técnica para mapeamento dinâmico de cores
const LEVEL_PALETTE: Record<string, any> = {
    blue: { 
        c600: 'bg-blue-600', 
        c400: 'border-blue-400 text-blue-800', 
        c300: 'bg-blue-200 text-blue-900', 
        c200: 'bg-blue-50 border-l-blue-400', 
        c50: 'bg-white border-blue-100 text-blue-700' 
    },
    emerald: { 
        c600: 'bg-emerald-600', 
        c400: 'border-emerald-400 text-emerald-800', 
        c300: 'bg-emerald-200 text-emerald-900', 
        c200: 'bg-emerald-50 border-l-emerald-400', 
        c50: 'bg-white border-emerald-100 text-emerald-700' 
    },
    violet: { 
        c600: 'bg-violet-600', 
        c400: 'border-violet-400 text-violet-800', 
        c300: 'bg-violet-200 text-violet-900', 
        c200: 'bg-violet-50 border-l-violet-400', 
        c50: 'bg-white border-violet-100 text-violet-700' 
    },
    orange: { 
        c600: 'bg-orange-600', 
        c400: 'border-orange-400 text-orange-800', 
        c300: 'bg-orange-200 text-orange-900', 
        c200: 'bg-orange-50 border-l-orange-400', 
        c50: 'bg-white border-orange-100 text-orange-700' 
    },
    rose: { 
        c600: 'bg-rose-600', 
        c400: 'border-rose-400 text-rose-800', 
        c300: 'bg-rose-200 text-rose-900', 
        c200: 'bg-rose-50 border-l-rose-400', 
        c50: 'bg-white border-rose-100 text-rose-700' 
    },
    amber: { 
        c600: 'bg-amber-600', 
        c400: 'border-amber-400 text-amber-800', 
        c300: 'bg-amber-200 text-amber-900', 
        c200: 'bg-amber-50 border-l-amber-400', 
        c50: 'bg-white border-amber-100 text-amber-700' 
    },
    cyan: { 
        c600: 'bg-cyan-600', 
        c400: 'border-cyan-400 text-cyan-800', 
        c300: 'bg-cyan-200 text-cyan-900', 
        c200: 'bg-cyan-50 border-l-cyan-400', 
        c50: 'bg-white border-cyan-100 text-cyan-700' 
    },
    indigo: { 
        c600: 'bg-indigo-600', 
        c400: 'border-indigo-400 text-indigo-800', 
        c300: 'bg-indigo-200 text-indigo-900', 
        c200: 'bg-indigo-50 border-l-indigo-400', 
        c50: 'bg-white border-indigo-100 text-indigo-700' 
    },
};

const COLOR_KEYS = Object.keys(LEVEL_PALETTE);

const HierarchyPage = () => {
    const { user, refreshUser } = useAuth();
    const [hierarchy, setHierarchy] = useState<CurricularComponent[]>([]);
    const [allQuestions, setAllQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Estados de Acordeon (Tudo contraído por padrão)
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

    const getColors = (index: number) => LEVEL_PALETTE[COLOR_KEYS[index % COLOR_KEYS.length]];

    const handleDelete = async (type: string, ids: any) => {
        if(confirm('Tem certeza? Isso apagará este item e todos os seus subitens vinculados permanentemente.')) {
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
            alert(`Sucesso! Conteúdo ativado.`);
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

    if(loading) return <div className="p-20 text-center font-bold text-slate-400 animate-pulse">Carregando acervo pedagógico...</div>;

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 bg-slate-50">
            <div className="flex justify-between items-center mb-10">
                <div>
                    <h2 className="text-3xl font-display font-black text-slate-800 flex items-center gap-3">
                        <Icons.BookOpen className="text-brand-blue" /> Gestão de Acervo
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Organize a hierarquia de conhecimentos da instituição.</p>
                </div>
                <div className="flex gap-2">
                    {user?.role !== UserRole.ADMIN && (
                        <Button variant="secondary" onClick={() => setIsRedeemModalOpen(true)}>
                            <Icons.Download /> Ativar Token
                        </Button>
                    )}
                    {user?.role === UserRole.ADMIN && (
                        <Button onClick={() => handleOpenModal('component')} className="shadow-lg">
                            <Icons.Plus /> Novo Componente
                        </Button>
                    )}
                </div>
            </div>

            <div className="space-y-8 max-w-6xl mx-auto">
                {filteredHierarchy.length === 0 && (
                    <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-slate-200 text-slate-400">
                        <p className="font-bold">Nenhum componente curricular encontrado.</p>
                    </div>
                )}

                {filteredHierarchy.map((cc, ccIdx) => {
                    const colors = getColors(ccIdx);
                    const isCcOpen = !!expandedComponents[cc.id];
                    const qTotal = allQuestions.filter(q => q.componentId === cc.id).length;

                    return (
                        <div key={cc.id} className="bg-white rounded-3xl shadow-md border border-slate-100 overflow-hidden transition-all duration-300">
                            {/* NÍVEL 1: COMPONENTE (FORTE 600) */}
                            <div 
                                className={`${colors.c600} p-6 flex justify-between items-center cursor-pointer select-none group`}
                                onClick={() => setExpandedComponents(prev => ({ ...prev, [cc.id]: !isCcOpen }))}
                            >
                                <div className="flex items-center gap-4 text-white">
                                    <div className={`transform transition-transform duration-300 ${isCcOpen ? 'rotate-180' : ''}`}>
                                        <Icons.ChevronDown className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black uppercase tracking-tight">{cc.name}</h3>
                                        <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">{cc.disciplines?.length || 0} Disciplinas • {qTotal} Questões</p>
                                    </div>
                                </div>
                                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                    {user?.role === UserRole.ADMIN && (
                                        <button onClick={() => handleOpenShare(cc)} className="bg-white/20 hover:bg-white text-white hover:text-slate-900 p-2 rounded-xl transition-all flex items-center gap-2 text-xs font-black uppercase">
                                            <Icons.Bank className="w-4 h-4" /> Licenciar
                                        </button>
                                    )}
                                    <button onClick={() => handleOpenModal('discipline', { ccId: cc.id })} className="bg-white/20 hover:bg-white text-white hover:text-slate-900 p-2 px-4 rounded-xl transition-all text-xs font-black uppercase">+ Disciplina</button>
                                    {user?.role === UserRole.ADMIN && <button onClick={() => handleDelete('component', { ccId: cc.id })} className="text-white/60 hover:text-white p-2 transition-colors"><Icons.Trash className="w-5 h-5" /></button>}
                                </div>
                            </div>

                            {isCcOpen && (
                                <div className="p-6 bg-slate-50/50 space-y-6 animate-fade-in">
                                    {(!cc.disciplines || cc.disciplines.length === 0) ? (
                                        <p className="text-center text-slate-400 italic py-4">Nenhuma disciplina cadastrada.</p>
                                    ) : cc.disciplines.map(d => {
                                        const isDOpen = !!expandedDisciplines[d.id];
                                        return (
                                            <div key={d.id} className={`bg-white border-2 ${colors.c400} rounded-2xl shadow-sm overflow-hidden`}>
                                                {/* NÍVEL 2: DISCIPLINA (SUAVE 400 COM BORDA) */}
                                                <div 
                                                    className="p-4 flex justify-between items-center cursor-pointer select-none hover:bg-slate-50 transition-colors"
                                                    onClick={() => setExpandedDisciplines(prev => ({ ...prev, [d.id]: !isDOpen }))}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`transform transition-transform text-slate-400 ${isDOpen ? 'rotate-180' : ''}`}>
                                                            <Icons.ChevronDown className="w-5 h-5" />
                                                        </div>
                                                        <span className="font-black text-lg uppercase">{d.name}</span>
                                                    </div>
                                                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                                        <button onClick={() => handleOpenModal('chapter', { dId: d.id })} className={`text-[10px] font-black uppercase ${colors.c600} text-white px-4 py-1.5 rounded-full shadow-sm hover:scale-105 transition-transform`}>+ Capítulo</button>
                                                        {user?.role === UserRole.ADMIN && <button onClick={() => handleDelete('discipline', { dId: d.id })} className="text-slate-300 hover:text-red-500 p-1"><Icons.Trash /></button>}
                                                    </div>
                                                </div>

                                                {isDOpen && (
                                                    <div className="p-4 bg-slate-50/30 space-y-4 animate-fade-in border-t border-slate-100">
                                                        {(!d.chapters || d.chapters.length === 0) ? (
                                                            <p className="text-xs text-slate-400 italic text-center">Nenhum capítulo.</p>
                                                        ) : d.chapters.map(chap => {
                                                            const isCOpen = !!expandedChapters[chap.id];
                                                            return (
                                                                <div key={chap.id} className="rounded-xl overflow-hidden border border-slate-100 shadow-sm">
                                                                    {/* NÍVEL 3: CAPÍTULO (TOM MÉDIO 300) */}
                                                                    <div 
                                                                        className={`p-3 flex justify-between items-center cursor-pointer ${colors.c300} transition-opacity hover:opacity-90`}
                                                                        onClick={() => setExpandedChapters(prev => ({ ...prev, [chap.id]: !isCOpen }))}
                                                                    >
                                                                        <div className="flex items-center gap-3">
                                                                            <div className={`transform transition-transform ${isCOpen ? 'rotate-180' : ''}`}>
                                                                                <Icons.ChevronDown className="w-4 h-4" />
                                                                            </div>
                                                                            <Icons.BookOpen className="w-4 h-4 opacity-70" />
                                                                            <span className="font-bold text-sm">{chap.name}</span>
                                                                        </div>
                                                                        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                                                            <button onClick={() => handleOpenModal('unit', { cId: chap.id })} className="text-[10px] font-black uppercase text-slate-600 hover:text-slate-900">+ Unidade</button>
                                                                            {user?.role === UserRole.ADMIN && <button onClick={() => handleDelete('chapter', { dId: d.id, cId: chap.id })} className="text-slate-400 hover:text-red-500"><Icons.X className="w-4 h-4" /></button>}
                                                                        </div>
                                                                    </div>

                                                                    {isCOpen && (
                                                                        <div className="p-4 bg-white space-y-3 animate-fade-in">
                                                                            {(!chap.units || chap.units.length === 0) ? (
                                                                                <p className="text-[10px] text-slate-400 italic">Nenhuma unidade.</p>
                                                                            ) : chap.units.map(unit => {
                                                                                const isUOpen = !!expandedUnits[unit.id];
                                                                                return (
                                                                                    <div key={unit.id} className={`${colors.c200} border-l-4 rounded-r-xl shadow-sm overflow-hidden`}>
                                                                                        {/* NÍVEL 4: UNIDADE (SUTIL 200 COM BORDA GROSSA) */}
                                                                                        <div 
                                                                                            className="p-3 flex justify-between items-center cursor-pointer hover:bg-white/40 transition-colors"
                                                                                            onClick={() => setExpandedUnits(prev => ({ ...prev, [unit.id]: !isUOpen }))}
                                                                                        >
                                                                                            <div className="flex items-center gap-2">
                                                                                                <div className={`transform transition-transform text-slate-400 ${isUOpen ? 'rotate-180' : ''}`}>
                                                                                                    <Icons.ChevronDown className="w-3 h-3" />
                                                                                                </div>
                                                                                                <span className="text-xs font-black uppercase tracking-tight text-slate-700">{unit.name}</span>
                                                                                            </div>
                                                                                            <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                                                                                <button onClick={() => handleOpenModal('topic', { uId: unit.id })} className="text-[10px] font-bold text-slate-500 hover:text-brand-blue">+ Tópico</button>
                                                                                                {user?.role === UserRole.ADMIN && <button onClick={() => handleDelete('unit', { dId: d.id, cId: chap.id, uId: unit.id })} className="text-slate-300 hover:text-red-500"><Icons.X className="w-3 h-3" /></button>}
                                                                                            </div>
                                                                                        </div>

                                                                                        {isUOpen && (
                                                                                            <div className="p-3 bg-white/60 flex flex-wrap gap-2 border-t border-white/50 animate-fade-in">
                                                                                                {(!unit.topics || unit.topics.length === 0) ? (
                                                                                                    <p className="text-[10px] text-slate-400 italic">Sem tópicos.</p>
                                                                                                ) : unit.topics.map(topic => (
                                                                                                    <div key={topic.id} className={`group ${colors.c50} border px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-2 shadow-sm transition-all hover:shadow-md`}>
                                                                                                        {topic.name}
                                                                                                        {user?.role === UserRole.ADMIN && (
                                                                                                            <button onClick={() => handleDelete('topic', { dId: d.id, cId: chap.id, uId: unit.id, tId: topic.id })} className="opacity-0 group-hover:opacity-100 text-red-500 transition-opacity">
                                                                                                                <Icons.X className="w-3 h-3" />
                                                                                                            </button>
                                                                                                        )}
                                                                                                    </div>
                                                                                                ))}
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

            {/* MODAIS */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalConfig.title} footer={<Button onClick={handleSave}>Salvar Item</Button>} maxWidth="max-w-md">
                <div className="space-y-4">
                    <Input label="Nome do Item" value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="Ex: Frações, Segunda Guerra..." autoFocus onKeyDown={e => e.key === 'Enter' && handleSave()}/>
                </div>
            </Modal>

            <Modal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} title={`Licenciar: ${sharingComponent?.name}`} maxWidth="max-w-2xl">
                {sharingComponent && (
                    <div className="space-y-6">
                        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                            <p className="text-sm text-blue-800 font-medium">Gere um código de acesso comercial para este componente. O usuário que resgatar terá acesso a toda esta estrutura.</p>
                        </div>
                        {generatedToken ? (
                            <div className="bg-emerald-50 border-2 border-emerald-200 p-10 rounded-3xl text-center animate-scale-in">
                                <p className="text-emerald-800 font-black mb-3 uppercase text-xs tracking-widest">Código Gerado</p>
                                <div className="bg-white border-4 border-emerald-500 text-emerald-600 font-mono text-5xl font-black py-6 rounded-2xl mb-6 shadow-xl">
                                    {generatedToken}
                                </div>
                                <Button onClick={() => setGeneratedToken(null)} variant="outline">Gerar outro código</Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-8 border-2 border-slate-100 rounded-3xl hover:border-brand-blue cursor-pointer bg-white transition-all shadow-sm hover:shadow-xl group text-center" onClick={() => handleGenerateToken(false)}>
                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-50 transition-colors">
                                        <Icons.BookOpen className="text-slate-400 group-hover:text-brand-blue" />
                                    </div>
                                    <h5 className="font-black text-slate-800 group-hover:text-brand-blue uppercase text-sm">Estrutura Vazia</h5>
                                    <p className="text-xs text-slate-500 mt-2">Libera apenas o plano de ensino para preenchimento.</p>
                                </div>
                                <div className="p-8 border-2 border-brand-blue/20 bg-blue-50/30 rounded-3xl cursor-pointer transition-all shadow-sm hover:shadow-xl group text-center" onClick={() => handleGenerateToken(true)}>
                                    <div className="w-16 h-16 bg-brand-blue rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
                                        <Icons.Sparkles className="text-white" />
                                    </div>
                                    <h5 className="font-black text-brand-blue uppercase text-sm">Pacote Completo</h5>
                                    <p className="text-xs text-blue-700 mt-2">Libera a estrutura + banco de questões associado.</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            <Modal isOpen={isRedeemModalOpen} onClose={() => setIsRedeemModalOpen(false)} title="Ativar Conteúdo" footer={<Button onClick={handleRedeem} disabled={redeemLoading}>{redeemLoading ? 'Processando...' : 'Ativar Agora'}</Button>} maxWidth="max-w-md">
                <div className="space-y-4">
                    <p className="text-sm text-slate-600">Insira o código de 8 dígitos para liberar novos componentes curriculares na sua conta.</p>
                    <Input label="Código do Token" value={redeemCode} onChange={e => setRedeemCode(e.target.value.toUpperCase())} placeholder="XXXX XXXX" className="text-center font-mono text-2xl font-black uppercase tracking-widest h-16" />
                </div>
            </Modal>
        </div>
    );
};

export default HierarchyPage;
