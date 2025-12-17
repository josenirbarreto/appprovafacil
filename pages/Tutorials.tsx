
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
        
        // Filter by Category
        if (activeCategory !== 'ALL') {
            res = res.filter(t => t.category === activeCategory);
        }

        // Filter by Search
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
        if (editing.type === 'VIDEO' && !editing.contentUrl) return alert("URL do vídeo obrigatória.");
        
        try {
            if (editing.id) {
                // Simula update deletando e criando novamente para manter consistência sem alterar service
                await FirebaseService.deleteTutorial(editing.id);
            }
            await FirebaseService.addTutorial(editing as Tutorial);
            setIsEditModalOpen(false);
            loadTutorials();
        } catch (e) {
            console.error(e);
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
        // Regex estrito para ID do YouTube
        const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const match = url.match(regExp);
        return match ? match[1] : null;
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
            {/* Hero Section */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-8 md:p-12 text-white shrink-0">
                <div className="max-w-4xl mx-auto text-center">
                    <h1 className="text-3xl md:text-4xl font-display font-bold mb-4">Como podemos ajudar você hoje?</h1>
                    <p className="text-blue-100 text-lg mb-8 max-w-2xl mx-auto">Explore nossos tutoriais e aprenda a extrair o máximo do Prova Fácil em poucos minutos.</p>
                    
                    <div className="relative max-w-xl mx-auto text-left">
                        <input 
                            type="text" 
                            className="w-full pl-12 pr-4 py-4 rounded-xl bg-white !text-slate-900 shadow-xl focus:outline-none focus:ring-4 focus:ring-blue-400/50 transition-all placeholder-slate-400 font-medium"
                            placeholder="Pesquisar por assunto (ex: como criar turma)..."
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
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8">
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
                            Nenhum tutorial encontrado para esta busca.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredTutorials.map(tutorial => (
                                <Card 
                                    key={tutorial.id} 
                                    className="group cursor-pointer hover:-translate-y-1 transition-all duration-300 hover:shadow-lg border-t-4 border-t-transparent hover:border-t-brand-blue overflow-hidden"
                                >
                                    <div onClick={() => setViewingTutorial(tutorial)}>
                                        {/* Thumbnail Area */}
                                        <div className="h-40 bg-slate-100 relative flex items-center justify-center overflow-hidden">
                                            {tutorial.type === 'VIDEO' ? (
                                                <>
                                                    {tutorial.contentUrl && getYoutubeId(tutorial.contentUrl) ? (
                                                        <img 
                                                            src={`https://img.youtube.com/vi/${getYoutubeId(tutorial.contentUrl)}/hqdefault.jpg`} 
                                                            className="w-full h-full object-cover opacity-100 group-hover:scale-105 transition-transform duration-500"
                                                        />
                                                    ) : (
                                                        <div className="w-16 h-16 bg-blue-100 text-brand-blue rounded-full flex items-center justify-center">
                                                            <Icons.Video />
                                                        </div>
                                                    )}
                                                    {/* Overlay transparente por padrão, escurece levemente no hover */}
                                                    <div className="absolute inset-0 bg-transparent group-hover:bg-black/10 transition-colors duration-300 flex items-center justify-center">
                                                        {/* Botão com efeito vidro (backdrop-blur) e levemente transparente */}
                                                        <div className="w-12 h-12 bg-white/70 backdrop-blur-sm rounded-full flex items-center justify-center text-brand-blue shadow-lg group-hover:scale-110 transition-transform group-hover:bg-white/90">
                                                            <Icons.Play />
                                                        </div>
                                                    </div>
                                                    {tutorial.videoDuration && (
                                                        <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded font-bold">
                                                            {tutorial.videoDuration}
                                                        </span>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="w-full h-full bg-gradient-to-br from-slate-50 to-slate-200 flex items-center justify-center">
                                                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-slate-400 shadow-sm">
                                                        <Icons.FileText />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Content Area */}
                                        <div className="p-5">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                    {CATEGORIES.find(c => c.id === tutorial.category)?.label}
                                                </span>
                                                {isAdmin && (
                                                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                                        <button 
                                                            onClick={() => { setEditing(tutorial); setIsEditModalOpen(true); }} 
                                                            className="text-slate-300 hover:text-brand-blue transition-colors p-1" 
                                                            title="Editar"
                                                        >
                                                            <Icons.Edit />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDelete(tutorial.id)} 
                                                            className="text-slate-300 hover:text-red-500 transition-colors p-1" 
                                                            title="Excluir"
                                                        >
                                                            <Icons.Trash />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            <h3 className="font-bold text-slate-800 mb-2 line-clamp-2 group-hover:text-brand-blue transition-colors">
                                                {tutorial.title}
                                            </h3>
                                            <p className="text-sm text-slate-500 line-clamp-2">
                                                {tutorial.description}
                                            </p>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ADMIN MODAL (ADD/EDIT) */}
            <Modal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                title={editing.id ? "Editar Tutorial" : "Novo Tutorial"}
                footer={<Button onClick={handleSave}>Publicar Tutorial</Button>}
                maxWidth="max-w-2xl"
            >
                <div className="space-y-4">
                    <Input label="Título" value={editing.title || ''} onChange={e => setEditing({...editing, title: e.target.value})} placeholder="Ex: Como criar uma prova" />
                    
                    <div className="grid grid-cols-2 gap-4">
                        <Select label="Categoria" value={editing.category} onChange={e => setEditing({...editing, category: e.target.value as any})}>
                            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </Select>
                        <Select label="Tipo de Conteúdo" value={editing.type} onChange={e => setEditing({...editing, type: e.target.value as any})}>
                            <option value="VIDEO">Vídeo (+ Texto Opcional)</option>
                            <option value="ARTICLE">Apenas Artigo (Texto)</option>
                        </Select>
                    </div>

                    <Input label="Descrição Curta" value={editing.description || ''} onChange={e => setEditing({...editing, description: e.target.value})} placeholder="Resumo exibido no card..." />

                    {/* VIDEO INPUTS */}
                    {editing.type === 'VIDEO' && (
                        <div className="space-y-4 border-t pt-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <h4 className="text-sm font-bold text-slate-700">Configuração do Vídeo</h4>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-2">
                                    <Input label="URL do Vídeo (YouTube)" value={editing.contentUrl || ''} onChange={e => setEditing({...editing, contentUrl: e.target.value.trim()})} placeholder="https://www.youtube.com/watch?v=..." />
                                </div>
                                <Input label="Duração" value={editing.videoDuration || ''} onChange={e => setEditing({...editing, videoDuration: e.target.value})} placeholder="Ex: 5 min" />
                            </div>
                            {editing.contentUrl && getYoutubeId(editing.contentUrl) ? (
                                <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black shadow-inner">
                                    <iframe 
                                        className="absolute top-0 left-0 w-full h-full"
                                        src={`https://www.youtube.com/embed/${getYoutubeId(editing.contentUrl)}`}
                                        title="Preview"
                                        frameBorder="0" 
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                        allowFullScreen
                                    ></iframe>
                                </div>
                            ) : (
                                editing.contentUrl && (
                                    <div className="text-red-500 text-xs mt-1">URL inválida ou ID não encontrado.</div>
                                )
                            )}
                        </div>
                    )}

                    {/* TEXT EDITOR (Always visible for ARTICLE, optional for VIDEO) */}
                    <div className="border-t pt-4">
                        <RichTextEditor 
                            label={editing.type === 'VIDEO' ? "Conteúdo de Apoio / Artigo Completo (Opcional)" : "Conteúdo do Artigo"} 
                            value={editing.contentBody || ''} 
                            onChange={html => setEditing({...editing, contentBody: html})} 
                        />
                    </div>

                    {/* ATTACHMENT SECTION (FILE DOWNLOAD) */}
                    <div className="border-t pt-4">
                        <h4 className="text-sm font-bold text-slate-700 mb-2">Material de Apoio (Download)</h4>
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 grid grid-cols-2 gap-4">
                            <Input 
                                label="Nome do Arquivo" 
                                value={editing.attachmentLabel || ''} 
                                onChange={e => setEditing({...editing, attachmentLabel: e.target.value})} 
                                placeholder="Ex: Slides da Aula (PDF)" 
                            />
                            <Input 
                                label="Link do Arquivo (URL)" 
                                value={editing.attachmentUrl || ''} 
                                onChange={e => setEditing({...editing, attachmentUrl: e.target.value})} 
                                placeholder="https://drive.google.com/..." 
                            />
                        </div>
                    </div>
                </div>
            </Modal>

            {/* VIEWING MODAL */}
            <Modal
                isOpen={!!viewingTutorial}
                onClose={() => setViewingTutorial(null)}
                title={viewingTutorial?.title || ''}
                maxWidth="max-w-4xl"
                footer={<Button onClick={() => setViewingTutorial(null)} variant="ghost">Fechar</Button>}
                compact={true}
            >
                <div className="space-y-6">
                    {/* VIDEO PLAYER SECTION */}
                    {viewingTutorial?.type === 'VIDEO' && viewingTutorial.contentUrl && (
                        /* Correção: Limitar largura para w-10/12 (aprox 83%) e centralizar com mx-auto */
                        <div className="relative w-full md:w-10/12 mx-auto aspect-video bg-black rounded-xl overflow-hidden shadow-lg">
                            {getYoutubeId(viewingTutorial.contentUrl) ? (
                                <iframe 
                                    className="absolute top-0 left-0 w-full h-full"
                                    src={`https://www.youtube.com/embed/${getYoutubeId(viewingTutorial.contentUrl)}?autoplay=1&rel=0`}
                                    title={viewingTutorial.title}
                                    frameBorder="0" 
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                    allowFullScreen
                                ></iframe>
                            ) : (
                                <div className="flex items-center justify-center h-full text-white">Vídeo indisponível</div>
                            )}
                        </div>
                    )}

                    {/* TEXT CONTENT SECTION */}
                    {viewingTutorial?.contentBody && (
                        <div className="prose prose-slate max-w-none prose-img:rounded-xl prose-a:text-brand-blue">
                            <div dangerouslySetInnerHTML={{__html: viewingTutorial.contentBody}} />
                        </div>
                    )}
                    
                    {/* DOWNLOAD SECTION */}
                    {viewingTutorial?.attachmentUrl && (
                        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-3">
                            <div className="p-3 bg-blue-100 text-brand-blue rounded-lg">
                                <Icons.Download />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-slate-800 text-sm">Material Complementar</h4>
                                <p className="text-sm font-semibold text-slate-700">{viewingTutorial.attachmentLabel || 'Arquivo Disponível'}</p>
                                <p className="text-xs text-slate-500">Faça o download do arquivo anexado a esta aula.</p>
                            </div>
                            <a 
                                href={viewingTutorial.attachmentUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="bg-white border border-slate-200 text-brand-blue px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-50 transition-colors shadow-sm flex items-center gap-2"
                            >
                                Baixar {viewingTutorial.attachmentLabel || 'Arquivo'}
                            </a>
                        </div>
                    )}

                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 mt-4">
                        <h4 className="font-bold text-slate-800 text-sm mb-1">Sobre este tutorial</h4>
                        <p className="text-slate-600 text-sm">{viewingTutorial?.description}</p>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default TutorialsPage;
