
import React, { useState, useEffect, useMemo } from 'react';
import { Discipline, UserRole, Question } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { Button, Modal, Input, Badge, Card } from '../components/UI';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';

const HierarchyPage = () => {
    const { user, refreshUser } = useAuth();
    const [hierarchy, setHierarchy] = useState<Discipline[]>([]);
    const [allQuestions, setAllQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedDisciplines, setExpandedDisciplines] = useState<Record<string, boolean>>({});
    const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});
    
    // Modal States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newItemName, setNewItemName] = useState('');
    const [modalConfig, setModalConfig] = useState<{
        type: 'discipline' | 'chapter' | 'unit' | 'topic';
        title: string;
        dId?: string;
        cId?: string;
        uId?: string;
    }>({ type: 'discipline', title: '' });

    // Share Modal States
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [sharingDiscipline, setSharingDiscipline] = useState<Discipline | null>(null);
    const [generatedToken, setGeneratedToken] = useState<string | null>(null);

    // Redeem Modal States
    const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false);
    const [redeemCode, setRedeemCode] = useState('');
    const [redeemLoading, setRedeemLoading] = useState(false);

    useEffect(() => { if(user) load(); }, [user]);
    
    const load = async () => { 
        const [hData, qData] = await Promise.all([
            FirebaseService.getHierarchy(user),
            FirebaseService.getQuestions(user)
        ]);
        setHierarchy(hData); 
        setAllQuestions(qData);
        setLoading(false); 
    };

    const handleDelete = async (type: any, ids: any) => {
        if(confirm('Tem certeza? Isso apagará todos os itens filhos.')) {
            await FirebaseService.deleteItem(type, ids);
            load();
        }
    }
    
    const handleOpenModal = (type: 'discipline' | 'chapter' | 'unit' | 'topic', ids: { dId?: string, cId?: string, uId?: string } = {}) => {
        let title = '';
        switch(type) {
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
        const { type, dId, cId, uId } = modalConfig;
        try {
            if (type === 'discipline') await FirebaseService.addDiscipline(newItemName);
            else if (type === 'chapter' && dId) await FirebaseService.addChapter(dId, newItemName);
            else if (type === 'unit' && dId && cId) await FirebaseService.addUnit(dId, cId, newItemName);
            else if (type === 'topic' && dId && cId && uId) await FirebaseService.addTopic(dId, cId, uId, newItemName);
            setIsModalOpen(false);
            load();
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar item.");
        }
    };

    const handleOpenShare = (d: Discipline) => {
        setSharingDiscipline(d);
        setGeneratedToken(null);
        setIsShareModalOpen(true);
    };

    const handleGenerateToken = async (includeQuestions: boolean) => {
        if (!sharingDiscipline) return;
        try {
            const code = await FirebaseService.generateCommercialToken(sharingDiscipline.id, includeQuestions);
            setGeneratedToken(code);
        } catch (e) {
            alert("Erro ao gerar token.");
        }
    };

    const handleRedeem = async () => {
        if (!redeemCode.trim() || !user) return;
        setRedeemLoading(true);
        try {
            const discName = await FirebaseService.redeemCommercialToken(redeemCode, user);
            alert(`Sucesso! A disciplina "${discName}" foi adicionada à sua conta.`);
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

    const getDisciplineStats = (d: Discipline) => {
        const chapters = d.chapters.length;
        const units = d.chapters.reduce((acc, c) => acc + c.units.length, 0);
        const topics = d.chapters.reduce((acc, c) => acc + c.units.reduce((accU, u) => accU + u.topics.length, 0), 0);
        const questions = allQuestions.filter(q => q.disciplineId === d.id).length;
        return { chapters, units, topics, questions };
    };

    const colorPalette = [
        { header: 'bg-blue-600', body: 'bg-blue-50', chapter: 'bg-blue-300', unit: 'bg-blue-200', text: 'text-blue-900', border: 'border-blue-200' },
        { header: 'bg-emerald-600', body: 'bg-emerald-50', chapter: 'bg-emerald-300', unit: 'bg-emerald-200', text: 'text-emerald-900', border: 'border-emerald-200' },
        { header: 'bg-purple-600', body: 'bg-purple-50', chapter: 'bg-purple-300', unit: 'bg-purple-200', text: 'text-purple-900', border: 'border-purple-200' },
        { header: 'bg-amber-600', body: 'bg-amber-50', chapter: 'bg-amber-300', unit: 'bg-amber-200', text: 'text-amber-900', border: 'border-amber-200' },
        { header: 'bg-rose-600', body: 'bg-rose-50', chapter: 'bg-rose-300', unit: 'bg-rose-200', text: 'text-rose-900', border: 'border-rose-200' },
    ];

    if(loading) return <div className="p-8 flex items-center justify-center text-slate-500 font-bold animate-pulse">Carregando acervo...</div>;

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 bg-slate-50">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-3xl font-display font-bold text-slate-800 flex items-center gap-2">
                        <Icons.BookOpen /> Gestão de Conteúdos
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Organize disciplinas e defina pacotes de compartilhamento comercial.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => setIsRedeemModalOpen(true)} className="shadow-md">
                        <Icons.Download /> Resgatar Conteúdo
                    </Button>
                    {user?.role === UserRole.ADMIN && (
                        <Button onClick={() => handleOpenModal('discipline')} className="shadow-lg"><Icons.Plus /> Nova Disciplina</Button>
                    )}
                </div>
            </div>

            <div className="grid gap-6">
                {hierarchy.length === 0 && (
                    <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-slate-200 text-slate-400">
                        <div className="mb-2"><Icons.BookOpen /></div>
                        <p>Nenhuma disciplina cadastrada para seu perfil.</p>
                    </div>
                )}

                {hierarchy.map((d, index) => {
                    const isExpanded = expandedDisciplines[d.id] === true;
                    const colors = colorPalette[index % colorPalette.length];
                    const stats = getDisciplineStats(d);

                    return (
                        <div key={d.id} className={`bg-white border ${colors.border} rounded-xl shadow-sm overflow-hidden transition-all duration-200`}>
                            <div className={`${colors.header} text-white p-4 flex justify-between items-center select-none cursor-pointer hover:opacity-95 transition-opacity`} onClick={() => setExpandedDisciplines(prev => ({ ...prev, [d.id]: !isExpanded }))}>
                                <div className="flex items-center gap-3">
                                    <div className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}><Icons.ChevronDown /></div>
                                    <div>
                                        <h3 className="text-lg font-bold tracking-wide">{d.name}</h3>
                                        <div className="flex gap-2 mt-0.5">
                                            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-black uppercase">{stats.chapters} Cap</span>
                                            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-black uppercase">{stats.questions} Questões</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                    {user?.role === UserRole.ADMIN && (
                                        <button 
                                            onClick={() => handleOpenShare(d)}
                                            className="bg-white/20 hover:bg-white text-white hover:text-brand-blue p-2 rounded-lg transition-all flex items-center gap-2 text-xs font-bold shadow-inner"
                                            title="Configurar Venda/Compartilhamento"
                                        >
                                            <Icons.Bank /> Comercializar
                                        </button>
                                    )}
                                    <Button variant="ghost" className="text-white/80 hover:text-white hover:bg-white/20 text-xs py-1 px-2 h-auto" onClick={() => handleOpenModal('chapter', { dId: d.id })}>
                                        + Capítulo
                                    </Button>
                                    {user?.role === UserRole.ADMIN && (
                                        <button onClick={() => handleDelete('discipline', { dId: d.id })} className="text-white/70 hover:text-white p-1.5 rounded hover:bg-white/20 transition-colors">
                                            <Icons.Trash />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {isExpanded && (
                                <div className={`p-4 ${colors.body} space-y-4 animate-fade-in`}>
                                    {d.chapters.length === 0 ? (
                                        <p className="text-slate-500 text-sm italic text-center py-4">Nenhum capítulo cadastrado.</p>
                                    ) : (
                                        d.chapters.map(c => {
                                            const isChapExpanded = expandedChapters[c.id] === true;
                                            return (
                                                <div key={c.id} className={`${colors.chapter} border border-white/20 rounded-lg shadow-sm`}>
                                                    <div className="p-3 flex justify-between items-center border-b border-black/5 cursor-pointer hover:bg-black/5 transition-colors" onClick={() => setExpandedChapters(prev => ({ ...prev, [c.id]: !isChapExpanded }))}>
                                                        <div className="flex items-center gap-2">
                                                            <div className={`transform transition-transform duration-200 text-slate-700 ${isChapExpanded ? 'rotate-180' : ''}`}><Icons.ChevronDown /></div>
                                                            <span className="font-semibold text-slate-800">{c.name}</span>
                                                        </div>
                                                        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                                            <Button variant="ghost" className="text-xs h-7 px-2 bg-white/50 hover:bg-white" onClick={() => handleOpenModal('unit', { dId: d.id, cId: c.id })}>+ Unidade</Button>
                                                            <button onClick={() => handleDelete('chapter', { dId: d.id, cId: c.id })} className="text-slate-600 hover:text-red-600 p-1"><Icons.Trash /></button>
                                                        </div>
                                                    </div>

                                                    {isChapExpanded && (
                                                        <div className="p-4 space-y-3">
                                                            {c.units.length === 0 ? <p className="text-xs text-slate-600 italic ml-6">Nenhuma unidade.</p> : (
                                                                c.units.map(u => (
                                                                    <div key={u.id} className={`p-3 rounded-lg border ${colors.border} ${colors.unit}`}>
                                                                        <div className="flex justify-between items-center mb-2">
                                                                            <span className={`text-sm font-bold ${colors.text}`}>{u.name}</span>
                                                                            <div className="flex gap-1">
                                                                                <button onClick={() => handleOpenModal('topic', { dId: d.id, cId: c.id, uId: u.id })} className="text-slate-600 hover:text-brand-blue text-xs font-medium hover:underline px-2 py-1">+ Tópico</button>
                                                                                <button onClick={() => handleDelete('unit', { dId: d.id, cId: c.id, uId: u.id })} className="text-slate-400 hover:text-red-500 p-1"><Icons.Trash /></button>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex flex-wrap gap-2">
                                                                            {u.topics.length === 0 && <span className="text-xs text-slate-400 italic">Sem tópicos</span>}
                                                                            {u.topics.map(t => (
                                                                                <div key={t.id} className="group flex items-center gap-2 bg-white border border-slate-200 px-3 py-1 rounded-full text-xs font-medium hover:border-slate-300 transition-colors shadow-sm text-slate-700">
                                                                                    {t.name}
                                                                                    <button onClick={() => handleDelete('topic', { dId: d.id, cId: c.id, uId: u.id, tId: t.id })} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                        <Icons.X />
                                                                                    </button>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            )}
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

            {/* SHARE MODAL - COMERCIALIZAÇÃO */}
            <Modal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                title={`Comercializar Disciplina: ${sharingDiscipline?.name}`}
                maxWidth="max-w-3xl"
            >
                {sharingDiscipline && (
                    <div className="space-y-6">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center">
                            <div>
                                <h4 className="font-bold text-slate-800 uppercase text-xs tracking-widest mb-1">Visão do Ativo</h4>
                                <p className="text-sm text-slate-500">Analise os componentes antes de gerar o pacote de venda.</p>
                            </div>
                            <div className="flex gap-4">
                                <div className="text-center"><p className="text-lg font-black text-brand-blue leading-none">{getDisciplineStats(sharingDiscipline).topics}</p><p className="text-[10px] text-slate-400 uppercase font-bold">Tópicos</p></div>
                                <div className="text-center"><p className="text-lg font-black text-emerald-600 leading-none">{getDisciplineStats(sharingDiscipline).questions}</p><p className="text-[10px] text-slate-400 uppercase font-bold">Questões</p></div>
                            </div>
                        </div>

                        {generatedToken ? (
                            <div className="bg-emerald-50 border-2 border-emerald-200 p-8 rounded-2xl text-center animate-scale-in">
                                <p className="text-emerald-800 font-bold mb-4 uppercase text-xs tracking-widest">Token Gerado com Sucesso!</p>
                                <div className="bg-white border-2 border-emerald-500 text-emerald-600 font-mono text-4xl font-black py-4 rounded-xl mb-4 shadow-inner">
                                    {generatedToken}
                                </div>
                                <p className="text-sm text-emerald-600 mb-6">Envie este código para a escola compradora. <br/>Eles devem usá-lo no botão <strong>"Resgatar Conteúdo"</strong>.</p>
                                <Button onClick={() => setGeneratedToken(null)} variant="outline" className="border-emerald-500 text-emerald-600">Gerar outro para esta disciplina</Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* NÍVEL 1 */}
                                <div className="border-2 border-slate-200 rounded-2xl p-6 hover:border-brand-blue transition-colors flex flex-col group">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 group-hover:bg-blue-100 group-hover:text-brand-blue transition-colors">
                                            <Icons.List />
                                        </div>
                                        <Badge color="blue">NÍVEL 1</Badge>
                                    </div>
                                    <h5 className="font-bold text-lg text-slate-800">Estrutura Curricular</h5>
                                    <p className="text-sm text-slate-500 mb-6 flex-1">Compartilha apenas o esqueleto da disciplina (Capítulos, Unidades e Tópicos). Ideal para licenciamento de metodologia.</p>
                                    <div className="pt-4 border-t border-slate-100 mt-auto">
                                        <p className="text-xs font-black text-slate-400 uppercase mb-2">Valor sugerido: <span className="text-slate-800">BAIXO</span></p>
                                        <Button variant="outline" className="w-full justify-center" onClick={() => handleGenerateToken(false)}>Gerar Token de Estrutura</Button>
                                    </div>
                                </div>

                                {/* NÍVEL 2 */}
                                <div className="border-2 border-brand-blue bg-blue-50/30 rounded-2xl p-6 hover:shadow-lg transition-all flex flex-col relative overflow-hidden">
                                    <div className="absolute -top-3 -right-8 bg-brand-orange text-white text-[10px] font-black px-10 py-4 rotate-45 shadow-sm">RECOMENDADO</div>
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="w-10 h-10 bg-brand-blue rounded-xl flex items-center justify-center text-white shadow-md">
                                            <Icons.Sparkles />
                                        </div>
                                        <Badge color="green">NÍVEL 2</Badge>
                                    </div>
                                    <h5 className="font-bold text-lg text-slate-800">Pacote Premium</h5>
                                    <p className="text-sm text-slate-500 mb-6 flex-1">Acesso total à estrutura + todas as questões oficiais vinculadas. O ativo intelectual completo para escolas parceiras.</p>
                                    <div className="pt-4 border-t border-slate-200 mt-auto">
                                        <p className="text-xs font-black text-blue-400 uppercase mb-2">Valor sugerido: <span className="text-brand-blue">ALTO</span></p>
                                        <Button className="w-full justify-center shadow-lg shadow-blue-200" onClick={() => handleGenerateToken(true)}>Gerar Token Master</Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <p className="text-[10px] text-slate-400 text-center uppercase font-bold tracking-tighter">
                            * Os tokens gerados podem ser vinculados a contratos ou planos específicos no módulo financeiro.
                        </p>
                    </div>
                )}
            </Modal>

            {/* REDEEM MODAL - RESGATE DE CONTEÚDO */}
            <Modal
                isOpen={isRedeemModalOpen}
                onClose={() => setIsRedeemModalOpen(false)}
                title="Resgatar Conteúdo via Token"
                maxWidth="max-w-md"
                footer={<Button onClick={handleRedeem} disabled={redeemLoading}>{redeemLoading ? 'Validando...' : 'Resgatar Agora'}</Button>}
            >
                <div className="space-y-4">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-blue-800 text-sm">
                        <p className="font-bold mb-1 flex items-center gap-2"><Icons.Sparkles /> Licenciamento Premium</p>
                        <p>Insira o código enviado pela administração ou pela escola parceira para desbloquear novas disciplinas e questões.</p>
                    </div>
                    <Input 
                        label="Código do Token" 
                        value={redeemCode} 
                        onChange={e => setRedeemCode(e.target.value.toUpperCase())} 
                        placeholder="EX: 4X9J2B7K" 
                        autoFocus
                        className="text-center font-mono text-2xl tracking-widest font-black text-brand-blue border-2"
                        onKeyDown={e => e.key === 'Enter' && handleRedeem()}
                    />
                    <p className="text-[10px] text-slate-400 text-center uppercase">Certifique-se de que o token ainda está dentro do prazo de validade.</p>
                </div>
            </Modal>

            <Modal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                title={modalConfig.title}
                footer={<Button onClick={handleSave}>Salvar</Button>}
                maxWidth="max-w-md"
            >
                <div className="space-y-4">
                    <Input 
                        label="Nome" 
                        value={newItemName} 
                        onChange={e => setNewItemName(e.target.value)} 
                        placeholder="Digite o nome..." 
                        autoFocus
                        onKeyDown={e => e.key === 'Enter' && handleSave()}
                    />
                </div>
            </Modal>
        </div>
    );
};

export default HierarchyPage;
