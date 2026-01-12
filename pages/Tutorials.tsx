import React, { useState, useEffect } from 'react';
import { Tutorial, UserRole } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { Button, Modal, Input, Select, Badge, Card, RichTextEditor } from '../components/UI';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';

const TutorialsPage = () => {
    const { user } = useAuth();
    const [tutorials, setTutorials] = useState<Tutorial[]>([]);
    const [filteredTutorials, setFilteredTutorials] = useState<Tutorial[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState<string>('ALL');
    const [search, setSearch] = useState('');

    // Admin Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editing, setEditing] = useState<Partial<Tutorial>>({
        type: 'VIDEO',
        category: 'ONBOARDING'
    });

    // Content Modal State
    const [viewingTutorial, setViewingTutorial] = useState<Tutorial | null>(null);

    const isAdmin = user?.role === UserRole.ADMIN;

    const CATEGORIES = [
        { id: 'ONBOARDING', label: 'Primeiros Passos', icon: <Icons.GraduationCap /> },
        { id: 'EXAMS', label: 'Provas e Avaliações', icon: <Icons.FileText /> },
        { id: 'MANAGEMENT', label: 'Gestão Escolar', icon: <Icons.Building /> },
        { id: 'FINANCE', label: 'Financeiro', icon: <Icons.Bank /> },
        { id: 'OTHER', label: 'Outros', icon: <Icons.List /> }
    ];

    useEffect(() => {
        loadTutorials();
    }, []);

    useEffect(() => {
        let res = tutorials;
        if (activeCategory !== 'ALL') res = res.filter(t => t.category === activeCategory);
        if (search) {
            const term = search.toLowerCase();
            res = res.filter(t => t.title.toLowerCase().includes(term) || t.description.toLowerCase().includes(term));
        }
        setFilteredTutorials(res);
    }, [tutorials, activeCategory, search]);

    const loadTutorials = async () => {
        try {
            const data = await FirebaseService.getTutorials();
            setTutorials(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!editing.title || !editing.description) return alert("Título e descrição são obrigatórios.");
        try {
            if (editing.id) await FirebaseService.deleteTutorial(editing.id);
            await FirebaseService.addTutorial(editing as Tutorial);
            setIsEditModalOpen(false);
            loadTutorials();
        } catch (e) {
            alert("Erro ao salvar tutorial.");
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("Excluir este tutorial?")) {
            await FirebaseService.deleteTutorial(id);
            loadTutorials();
        }
    };

    const getYoutubeId = (url: string) => {
        if (!url) return null;
        const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const match = url.match(regExp);
        return match ? match[1] : null;
    };

    return (
        <div className="h-full bg-slate-50 overflow-y-auto custom-scrollbar">
            {/* Hero Section - Agora dentro do container de scroll */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-8 md:p-12 text-white">
                <div className="max-w-4xl mx-auto text-center">
                    <h1 className="text-3xl md:text-4xl font-display font-bold mb-4 tracking-tight">Como podemos ajudar você hoje?</h1>
                    <p className="text-blue-100 text-lg mb-8 max-w-2xl mx-auto">Explore nossos tutoriais e aprenda a extrair o máximo do Prova Fácil em poucos minutos.</p>
                    
                    <div className="relative max-w-xl mx-auto text-left">
                        <input 
                            type="text" 
                            className="w-full pl-12 pr-4 py-4 rounded-xl bg-white !text-slate-900 shadow-2xl focus:outline-none focus:ring-4 focus:ring-blue-400/50 transition-all placeholder-slate-400 font-medium"
                            placeholder="Pesquisar por assunto..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <div className="absolute left-4 top-4 text-slate-400 pointer-events-none">
                            <Icons.Search />
                        </div>
                    </div>
                </div>
            </div>

            {/* Categories & Content */}
            <div className="p-6 md:p-8">
                <div className="max-w-6xl mx-auto">
                    
                    {/* Category Tabs */}
                    <div className="flex flex-wrap gap-2 mb-8 justify-center">
                        <button 
                            onClick={() => setActiveCategory('ALL')}
                            className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${activeCategory === 'ALL' ? 'bg-brand-blue text-white shadow-md scale-105' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                        >
                            Todos
                        </button>
                        {CATEGORIES.map(cat => (
                            <button 
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                className={`px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${activeCategory === cat.id ? 'bg-brand-blue text-white shadow-md scale-105' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>

                    {/* Admin Actions */}
                    {isAdmin && (
                        <div className="mb-6 flex justify-end">
                            <Button onClick={() => { setEditing({ type: 'VIDEO', category: 'ONBOARDING' }); setIsEditModalOpen(true); }}>
                                <Icons.Plus /> Novo Tutorial
                            </Button>
                        </div>
                    )}

                    {/* Grid */}
                    {loading ? (
                        <div className="text-center py-12 text-slate-400">Carregando tutoriais...</div>
                    ) : filteredTutorials.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-xl border border-slate-200 text-slate-400">
                            Nenhum tutorial encontrado.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredTutorials.map(tutorial => (
                                <Card 
                                    key={tutorial.id} 
                                    className="group cursor-pointer hover:-translate-y-1 transition-all duration-300 hover:shadow-lg border-t-4 border-t-transparent hover:border-t-brand-blue overflow-hidden"
                                >
                                    <div onClick={() => setViewingTutorial(tutorial)}>
                                        <div className="h-40 bg-slate-100 relative flex items-center justify-center overflow-hidden">
                                            {tutorial.type === 'VIDEO' ? (
                                                <>
                                                    {tutorial.contentUrl && getYoutubeId(tutorial.contentUrl) ? (
                                                        <img src={`https://img.youtube.com/vi/${getYoutubeId(tutorial.contentUrl)}/hqdefault.jpg`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                    ) : (
                                                        <div className="w-16 h-16 bg-blue-100 text-brand-blue rounded-full flex items-center justify-center"><Icons.Video /></div>
                                                    )}
                                                    <div className="absolute inset-0 bg-transparent group-hover:bg-black/10 transition-colors duration-300 flex items-center justify-center">
                                                        <div className="w-12 h-12 bg-white/70 backdrop-blur-sm rounded-full flex items-center justify-center text-brand-blue shadow-lg group-hover:scale-110 transition-transform">
                                                            <Icons.Play />
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="w-full h-full bg-gradient-to-br from-slate-50 to-slate-200 flex items-center justify-center">
                                                    <Icons.FileText className="text-slate-300 w-12 h-12" />
                                                </div>
                                            )}
                                        </div>

                                        <div className="p-5">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                    {CATEGORIES.find(c => c.id === tutorial.category)?.label}
                                                </span>
                                                {isAdmin && (
                                                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                                        <button onClick={() => { setEditing(tutorial); setIsEditModalOpen(true); }} className="text-slate-300 hover:text-brand-blue p-1"><Icons.Edit /></button>
                                                        <button onClick={() => handleDelete(tutorial.id)} className="text-slate-300 hover:text-red-500 p-1"><Icons.Trash /></button>
                                                    </div>
                                                )}
                                            </div>
                                            <h3 className="font-bold text-slate-800 mb-2 line-clamp-2 group-hover:text-brand-blue transition-colors">{tutorial.title}</h3>
                                            <p className="text-sm text-slate-500 line-clamp-2">{tutorial.description}</p>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* MODAIS (EDIT & VIEW) - Mantêm o mesmo conteúdo funcional */}
            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title={editing.id ? "Editar Tutorial" : "Novo Tutorial"} footer={<Button onClick={handleSave}>Publicar</Button>} maxWidth="max-w-2xl">
                <div className="space-y-4">
                    <Input label="Título" value={editing.title || ''} onChange={e => setEditing({...editing, title: e.target.value})} />
                    <div className="grid grid-cols-2 gap-4">
                        <Select label="Categoria" value={editing.category} onChange={e => setEditing({...editing, category: e.target.value as any})}>
                            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </Select>
                        <Select label="Tipo" value={editing.type} onChange={e => setEditing({...editing, type: e.target.value as any})}>
                            <option value="VIDEO">Vídeo</option>
                            <option value="ARTICLE">Artigo</option>
                        </Select>
                    </div>
                    <Input label="Descrição Curta" value={editing.description || ''} onChange={e => setEditing({...editing, description: e.target.value})} />
                    {editing.type === 'VIDEO' && <Input label="URL YouTube" value={editing.contentUrl || ''} onChange={e => setEditing({...editing, contentUrl: e.target.value})} />}
                    <RichTextEditor label="Conteúdo Adicional" value={editing.contentBody || ''} onChange={html => setEditing({...editing, contentBody: html})} />
                </div>
            </Modal>

            <Modal isOpen={!!viewingTutorial} onClose={() => setViewingTutorial(null)} title={viewingTutorial?.title || ''} maxWidth="max-w-4xl" compact={true}>
                <div className="space-y-6">
                    {viewingTutorial?.type === 'VIDEO' && viewingTutorial.contentUrl && (
                        <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-lg">
                            <iframe className="absolute top-0 left-0 w-full h-full" src={`https://www.youtube.com/embed/${getYoutubeId(viewingTutorial.contentUrl)}?autoplay=1`} title={viewingTutorial.title} frameBorder="0" allow="autoplay; encrypted-media" allowFullScreen></iframe>
                        </div>
                    )}
                    {viewingTutorial?.contentBody && <div className="prose prose-slate max-w-none px-4" dangerouslySetInnerHTML={{__html: viewingTutorial.contentBody}} />}
                    {viewingTutorial?.attachmentUrl && (
                        <div className="p-4 bg-blue-50 rounded-xl flex items-center justify-between border border-blue-100">
                            <div className="flex items-center gap-3">
                                <Icons.Download className="text-brand-blue" />
                                <span className="text-sm font-bold text-blue-900">{viewingTutorial.attachmentLabel || 'Material Complementar'}</span>
                            </div>
                            <a href={viewingTutorial.attachmentUrl} target="_blank" rel="noreferrer" className="text-sm font-black text-brand-blue uppercase hover:underline">Download</a>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default TutorialsPage;