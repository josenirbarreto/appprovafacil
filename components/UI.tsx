
import React, { useRef, useEffect, useState } from 'react';

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' }> = ({ className = '', variant = 'primary', ...props }) => {
  const baseStyle = "px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-brand-blue text-white hover:bg-blue-700 focus:ring-brand-blue shadow-md hover:shadow-lg",
    secondary: "bg-brand-orange text-white hover:bg-orange-600 focus:ring-brand-orange",
    outline: "border-2 border-brand-blue text-brand-blue hover:bg-blue-50",
    ghost: "text-slate-600 hover:bg-slate-100",
    danger: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
  };

  return <button className={`${baseStyle} ${variants[variant]} ${className}`} {...props} />;
};

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string }> = ({ label, className = '', ...props }) => (
  <div className="flex flex-col gap-1 w-full">
    {label && <label className="text-sm font-semibold text-slate-700">{label}</label>}
    <input className={`border border-slate-300 bg-white text-slate-900 rounded-md px-3 py-2 focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none transition-all ${className}`} {...props} />
  </div>
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }> = ({ label, className = '', children, ...props }) => (
  <div className="flex flex-col gap-1 w-full">
    {label && <label className="text-sm font-semibold text-slate-700">{label}</label>}
    <select className={`border border-slate-300 bg-white text-slate-900 rounded-md px-3 py-2 focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none ${className}`} {...props}>
      {children}
    </select>
  </div>
);

export const Card: React.FC<{ children: React.ReactNode; className?: string; title?: string }> = ({ children, className = '', title }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden ${className}`}>
    {title && (
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-100">
        <h3 className="text-lg font-display font-bold text-brand-dark">{title}</h3>
      </div>
    )}
    <div className="p-6">{children}</div>
  </div>
);

export const Badge: React.FC<{ children: React.ReactNode; color?: 'blue' | 'green' | 'red' | 'yellow' }> = ({ children, color = 'blue' }) => {
  const colors = {
    blue: 'bg-blue-100 text-blue-800',
    green: 'bg-green-100 text-green-800',
    red: 'bg-red-100 text-red-800',
    yellow: 'bg-yellow-100 text-yellow-800',
  };
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${colors[color]}`}>{children}</span>;
};

// Novo Componente Modal
export const Modal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    title: string; 
    children: React.ReactNode;
    footer?: React.ReactNode;
    maxWidth?: string;
}> = ({ isOpen, onClose, title, children, footer, maxWidth = 'max-w-2xl' }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className={`bg-white rounded-2xl shadow-2xl w-full ${maxWidth} max-h-[90vh] flex flex-col overflow-hidden animate-scale-in`}>
                <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-xl font-display font-bold text-brand-dark">{title}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-slate-100">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    {children}
                </div>

                {footer && (
                    <div className="p-5 border-t border-slate-100 bg-slate-50/30 flex justify-end gap-3">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

// --- RICH TEXT EDITOR ---
const EditorButton = ({ 
    command, 
    icon, 
    active = false, 
    arg = null, 
    onClick, 
    title,
    children 
}: { 
    command?: string, 
    icon?: React.ReactNode, 
    active?: boolean, 
    arg?: string | null, 
    onClick?: () => void,
    title?: string,
    children?: React.ReactNode 
}) => (
    <button
        type="button"
        title={title}
        onMouseDown={(e) => {
            e.preventDefault(); // Prevent losing focus
            if(onClick) onClick();
            else if(command) document.execCommand(command, false, arg || '');
        }}
        // Atualizado para contrastar com o fundo azul mais forte. Active: Azul forte + Texto Branco.
        className={`p-1.5 rounded min-w-[28px] h-[28px] flex items-center justify-center transition-colors ${
            active 
            ? 'bg-brand-blue text-white shadow-inner ring-1 ring-blue-700' 
            : 'hover:bg-blue-200 text-slate-700 hover:text-brand-blue'
        }`}
    >
        {icon}
        {children}
    </button>
);

export const RichTextEditor: React.FC<{ label?: string, value: string, onChange: (html: string) => void, className?: string }> = ({ label, value, onChange, className = '' }) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const colorInputRef = useRef<HTMLInputElement>(null);
    const bgInputRef = useRef<HTMLInputElement>(null);
    const [selectedImg, setSelectedImg] = useState<HTMLImageElement | null>(null);
    
    // States para Modais
    const [showTableModal, setShowTableModal] = useState(false);
    const [showLinkModal, setShowLinkModal] = useState(false);
    
    // Estado do Link
    const [linkUrl, setLinkUrl] = useState('');
    // Armazena metadados sobre o link que está sendo editado (URL temporária, se é novo ou existente)
    const linkStateRef = useRef<{ isNew: boolean, tempUrl: string, originalUrl: string }>({
        isNew: false,
        tempUrl: '',
        originalUrl: ''
    });
    
    // Estado para botões ativos (negrito, itálico, etc.)
    const [activeFormats, setActiveFormats] = useState<Record<string, boolean>>({});

    const [tableConfig, setTableConfig] = useState({
        rows: 3,
        cols: 3,
        width: 100,
        align: 'left',
        padding: 8,
        header: true
    });

    // Sincronização de valor externo
    useEffect(() => {
        // Se o modal de link estiver aberto, NÃO atualize o HTML vindo de fora.
        // Isso previne que o React sobrescreva o DOM (e nossos placeholders temporários)
        // enquanto o usuário está digitando no modal.
        if (showLinkModal) return;

        if (editorRef.current && editorRef.current.innerHTML !== value) {
             if (value === '' && editorRef.current.innerHTML === '<br>') return;
             if (editorRef.current.innerHTML !== value) {
                editorRef.current.innerHTML = value;
             }
        }
    }, [value, showLinkModal]); // Adicionado showLinkModal como dependência

    const handleInput = () => {
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
            checkFormats();
        }
    };

    // Função para verificar quais formatações estão ativas no cursor
    const checkFormats = () => {
        if (!document.queryCommandState) return;
        setActiveFormats({
            bold: document.queryCommandState('bold'),
            italic: document.queryCommandState('italic'),
            underline: document.queryCommandState('underline'),
            justifyLeft: document.queryCommandState('justifyLeft'),
            justifyCenter: document.queryCommandState('justifyCenter'),
            justifyRight: document.queryCommandState('justifyRight'),
            justifyFull: document.queryCommandState('justifyFull'),
            insertOrderedList: document.queryCommandState('insertOrderedList'),
            insertUnorderedList: document.queryCommandState('insertUnorderedList'),
        });
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && editorRef.current) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const imgTag = `<img src="${ev.target?.result}" style="max-width: 50%; display: block; margin: 10px 0;" />`;
                editorRef.current?.focus();
                document.execCommand('insertHTML', false, imgTag);
                handleInput();
            };
            reader.readAsDataURL(file);
        }
        if(fileInputRef.current) fileInputRef.current.value = '';
    };

    // --- LINK HANDLER ROBUSTO (Estratégia Placeholder) ---

    const handleLinkClick = () => {
        const selection = window.getSelection();
        if (!editorRef.current) return;
        
        // Gera uma URL temporária única para identificar este link no DOM
        const uniqueTempUrl = `http://temp-link-${Date.now()}.com/`;
        
        // Verifica se o usuário está clicando dentro de um link já existente
        let node = selection?.anchorNode;
        while (node && node.nodeName !== 'A' && node !== editorRef.current) {
            node = node.parentNode;
        }

        if (node && node.nodeName === 'A') {
            // EDITANDO LINK EXISTENTE
            const anchor = node as HTMLAnchorElement;
            const originalUrl = anchor.getAttribute('href') || '';
            
            // Marca o link existente com a URL temporária para encontrá-lo depois
            anchor.setAttribute('href', uniqueTempUrl);
            
            // Configura estado
            setLinkUrl(originalUrl);
            linkStateRef.current = { isNew: false, tempUrl: uniqueTempUrl, originalUrl: originalUrl };
        } else {
            // CRIANDO NOVO LINK
            setLinkUrl('https://');
            linkStateRef.current = { isNew: true, tempUrl: uniqueTempUrl, originalUrl: '' };

            if (selection && !selection.isCollapsed) {
                // Se tem texto selecionado, transforma em link
                document.execCommand('createLink', false, uniqueTempUrl);
            } else {
                // Se não tem texto, insere um link padrão "Link"
                const tempHtml = `<a href="${uniqueTempUrl}">Link</a>`;
                document.execCommand('insertHTML', false, tempHtml);
            }
        }

        // Sincroniza o estado do React com o novo DOM (contendo o placeholder)
        handleInput();
        
        // Abre o modal
        setShowLinkModal(true);
    };

    const closeLinkModal = (isSave: boolean) => {
        if (!editorRef.current) return;

        const { isNew, tempUrl, originalUrl } = linkStateRef.current;
        
        // Encontra todos os links que tenham nossa URL temporária
        const tempLinks = editorRef.current.querySelectorAll(`a[href="${tempUrl}"]`);
        
        tempLinks.forEach(link => {
            if (isSave && linkUrl) {
                // SALVAR: Atualiza href e target
                link.setAttribute('href', linkUrl);
                link.setAttribute('target', '_blank');
                link.setAttribute('rel', 'noopener noreferrer');
            } else {
                // CANCELAR ou SALVAR VAZIO
                if (isNew) {
                    // Se era novo, removemos o link mas mantemos o texto (unwrap)
                    const parent = link.parentNode;
                    while (link.firstChild) parent?.insertBefore(link.firstChild, link);
                    parent?.removeChild(link);
                } else {
                    // Se era edição, restauramos a URL original
                    if (isSave && !linkUrl) {
                        // Usuário apagou a URL -> remover link
                        const parent = link.parentNode;
                        while (link.firstChild) parent?.insertBefore(link.firstChild, link);
                        parent?.removeChild(link);
                    } else {
                        // Cancelou -> voltar ao original
                        link.setAttribute('href', originalUrl);
                    }
                }
            }
        });
        
        // Atualiza estado final
        handleInput();
        setShowLinkModal(false);
    };

    // --- TABLE HANDLER ---
    const handleTableOpen = () => setShowTableModal(true);

    const insertCustomTable = () => {
        let style = `width: ${tableConfig.width}%; border-collapse: collapse; border: 1px solid #cbd5e1; margin-bottom: 1em;`;
        if (tableConfig.align === 'center') style += ' margin-left: auto; margin-right: auto;';
        else if (tableConfig.align === 'right') style += ' float: right; margin-left: 1em;';
        else style += ' margin-right: auto;';

        const cellStyle = `border: 1px solid #cbd5e1; padding: ${tableConfig.padding}px;`;
        const headerStyle = `border: 1px solid #cbd5e1; padding: ${tableConfig.padding}px; background-color: #f1f5f9; font-weight: bold; text-align: left;`;

        let html = `<table style="${style}">`;
        if (tableConfig.header) {
            html += '<thead><tr>';
            for (let c = 0; c < tableConfig.cols; c++) html += `<th style="${headerStyle}">Cabeçalho ${c + 1}</th>`;
            html += '</tr></thead>';
        }
        html += '<tbody>';
        for (let r = 0; r < tableConfig.rows; r++) {
            html += '<tr>';
            for (let c = 0; c < tableConfig.cols; c++) html += `<td style="${cellStyle}">&nbsp;</td>`;
            html += '</tr>';
        }
        html += '</tbody></table><p><br/></p>';

        editorRef.current?.focus();
        document.execCommand('insertHTML', false, html);
        handleInput();
        setShowTableModal(false);
    };

    const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'foreColor' | 'hiliteColor') => {
        editorRef.current?.focus();
        document.execCommand(type, false, e.target.value);
        handleInput();
    };

    const handleFontSize = (e: React.ChangeEvent<HTMLSelectElement>) => {
        editorRef.current?.focus();
        document.execCommand('fontSize', false, e.target.value);
        handleInput();
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        checkFormats(); 
        if ((e.target as HTMLElement).tagName === 'IMG') {
            setSelectedImg(e.target as HTMLImageElement);
        } else {
            setSelectedImg(null);
        }
    };

    const handleKeyUp = () => {
        checkFormats(); 
    };

    const updateImageStyle = (styles: Partial<CSSStyleDeclaration> & { float?: string }) => {
        if (selectedImg) {
            Object.keys(styles).forEach((key) => {
                // @ts-ignore
                selectedImg.style[key] = styles[key];
            });
            if (styles.margin === '0 auto') {
                 selectedImg.style.display = 'block';
                 selectedImg.style.marginLeft = 'auto';
                 selectedImg.style.marginRight = 'auto';
                 selectedImg.style.float = 'none';
            }
            handleInput();
            setSelectedImg(null);
        }
    };

    // --- ÍCONES SVG ---
    const Icons = {
        Undo: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>,
        Redo: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 3.7"/></svg>,
        Bold: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path></svg>,
        Italic: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="4" x2="10" y2="4"></line><line x1="14" y1="20" x2="5" y2="20"></line><line x1="15" y1="4" x2="9" y2="20"></line></svg>,
        Underline: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"></path><line x1="4" y1="21" x2="20" y2="21"></line></svg>,
        AlignLeft: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="17" y1="10" x2="3" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="17" y1="18" x2="3" y2="18"></line></svg>,
        AlignCenter: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="10" x2="6" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="18" y1="18" x2="6" y2="18"></line></svg>,
        AlignRight: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="10" x2="7" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="21" y1="18" x2="7" y2="18"></line></svg>,
        AlignJustify: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="10" x2="3" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="21" y1="18" x2="3" y2="18"></line></svg>,
        ListOrdered: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="10" y1="6" x2="21" y2="6"></line><line x1="10" y1="12" x2="21" y2="12"></line><line x1="10" y1="18" x2="21" y2="18"></line><path d="M4 6h1v4"></path><path d="M4 10h2"></path><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"></path></svg>,
        ListBullet: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>,
        Indent: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 8 7 12 3 16"></polyline><line x1="21" y1="12" x2="7" y2="12"></line><line x1="21" y1="6" x2="7" y2="6"></line><line x1="21" y1="18" x2="7" y2="18"></line></svg>,
        Outdent: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="7 8 3 12 7 16"></polyline><line x1="21" y1="12" x2="3" y2="12"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="18" x2="3" y2="18"></line></svg>,
        Link: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>,
        Image: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>,
        Table: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M12 3v18"/></svg>,
        Eraser: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>,
        TextColor: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16"/><path d="m6 16 6-14 6 14"/><path d="M8 12h8"/></svg>,
        BgColor: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16.5 7.5l0 .01"/><path d="M19 11l-8-8-9 9 8 8 5-5 9-9-5-5Z"/><path d="m21 21-9-9"/><path d="m9 9 5-5"/></svg>,
    };

    return (
        <div className={`flex flex-col gap-1 w-full ${className}`}>
             {label && <label className="text-sm font-semibold text-slate-700">{label}</label>}
             <div className="border border-slate-300 rounded-md bg-white focus-within:ring-2 focus-within:ring-brand-blue focus-within:border-brand-blue transition-all relative overflow-hidden">
                
                {/* Estilos específicos para corrigir o reset do Tailwind em listas dentro do editor */}
                <style>{`
                    /* Listas Não Ordenadas (Bullets) */
                    .rich-text-content ul { list-style-type: disc !important; padding-left: 1.5rem !important; margin-left: 0 !important; text-align: left; }
                    .rich-text-content ul ul { list-style-type: circle !important; }
                    .rich-text-content ul ul ul { list-style-type: square !important; }

                    /* Listas Ordenadas (Números) */
                    .rich-text-content ol { list-style-type: decimal !important; padding-left: 1.5rem !important; margin-left: 0 !important; text-align: left; }
                    .rich-text-content ol ol { list-style-type: lower-alpha !important; }
                    .rich-text-content ol ol ol { list-style-type: lower-roman !important; }

                    .rich-text-content li { margin-bottom: 0.25rem; }

                    /* Links: Força estilo azul e sublinhado */
                    .rich-text-content a { color: #3A72EC !important; text-decoration: underline !important; cursor: pointer; }
                    .rich-text-content a:hover { color: #1d4ed8 !important; }
                `}</style>

                {/* --- TOOLBAR (Fundo Azul Mais Forte) --- */}
                <div className="flex flex-wrap items-center p-2 bg-blue-100 border-b border-blue-300 gap-y-2">
                    
                    {/* Grupo 1: Histórico */}
                    <div className="flex items-center gap-1 pr-2 border-r border-blue-300">
                        <EditorButton command="undo" icon={Icons.Undo} title="Desfazer" />
                        <EditorButton command="redo" icon={Icons.Redo} title="Refazer" />
                    </div>

                    {/* Grupo 2: Fonte e Cores */}
                    <div className="flex items-center gap-1 px-2 border-r border-blue-300">
                        <select 
                            className="h-[28px] text-xs border border-blue-300 rounded px-1 outline-none bg-white cursor-pointer hover:border-brand-blue w-20 text-slate-700"
                            onChange={handleFontSize}
                            title="Tamanho da Fonte"
                            defaultValue="3"
                        >
                            <option value="1">Pequeno</option>
                            <option value="2">Normal</option>
                            <option value="3">Padrão</option>
                            <option value="4">Médio</option>
                            <option value="5">Grande</option>
                            <option value="6">Enorme</option>
                            <option value="7">Máximo</option>
                        </select>
                        
                        <div className="relative">
                             <EditorButton icon={Icons.TextColor} onClick={() => colorInputRef.current?.click()} title="Cor do Texto" />
                             <input type="color" ref={colorInputRef} onChange={(e) => handleColorChange(e, 'foreColor')} className="absolute opacity-0 w-0 h-0" />
                        </div>
                        <div className="relative">
                             <EditorButton icon={Icons.BgColor} onClick={() => bgInputRef.current?.click()} title="Cor de Fundo (Realce)" />
                             <input type="color" ref={bgInputRef} onChange={(e) => handleColorChange(e, 'hiliteColor')} className="absolute opacity-0 w-0 h-0" />
                        </div>
                        <EditorButton command="removeFormat" icon={Icons.Eraser} title="Limpar Formatação" />
                    </div>

                    {/* Grupo 3: Estilo de Texto (Com Destaque Ativo) */}
                    <div className="flex items-center gap-1 px-2 border-r border-blue-300">
                        <EditorButton command="bold" icon={Icons.Bold} title="Negrito" active={activeFormats.bold} />
                        <EditorButton command="italic" icon={Icons.Italic} title="Itálico" active={activeFormats.italic} />
                        <EditorButton command="underline" icon={Icons.Underline} title="Sublinhado" active={activeFormats.underline} />
                    </div>

                    {/* Grupo 4: Alinhamento */}
                    <div className="flex items-center gap-1 px-2 border-r border-blue-300">
                        <EditorButton command="justifyLeft" icon={Icons.AlignLeft} title="Alinhar à Esquerda" active={activeFormats.justifyLeft} />
                        <EditorButton command="justifyCenter" icon={Icons.AlignCenter} title="Centralizar" active={activeFormats.justifyCenter} />
                        <EditorButton command="justifyRight" icon={Icons.AlignRight} title="Alinhar à Direita" active={activeFormats.justifyRight} />
                        <EditorButton command="justifyFull" icon={Icons.AlignJustify} title="Justificar" active={activeFormats.justifyFull} />
                    </div>

                    {/* Grupo 5: Listas e Indentação */}
                    <div className="flex items-center gap-1 px-2 border-r border-blue-300">
                        <EditorButton command="insertOrderedList" icon={Icons.ListOrdered} title="Lista Ordenada" active={activeFormats.insertOrderedList} />
                        <EditorButton command="insertUnorderedList" icon={Icons.ListBullet} title="Lista Não Ordenada" active={activeFormats.insertUnorderedList} />
                        <EditorButton command="indent" icon={Icons.Indent} title="Aumentar Recuo" />
                        <EditorButton command="outdent" icon={Icons.Outdent} title="Diminuir Recuo" />
                    </div>

                    {/* Grupo 6: Inserção */}
                    <div className="flex items-center gap-1 pl-2">
                        <EditorButton onClick={handleLinkClick} icon={Icons.Link} title="Inserir Link" />
                        <EditorButton onClick={handleTableOpen} icon={Icons.Table} title="Inserir Tabela" />
                        <EditorButton onClick={() => fileInputRef.current?.click()} icon={Icons.Image} title="Inserir Imagem" />
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </div>
                </div>
                
                {/* Editable Area */}
                <div
                    ref={editorRef}
                    contentEditable
                    onInput={handleInput}
                    onMouseUp={handleMouseUp}
                    onKeyUp={handleKeyUp}
                    onClick={checkFormats} 
                    className="rich-text-content p-4 min-h-[150px] max-h-[500px] overflow-y-auto text-slate-900 outline-none max-w-none custom-scrollbar"
                    style={{ lineHeight: '1.5' }}
                />

                {/* Image Edit Overlay Menu */}
                {selectedImg && (
                    <div className="absolute top-12 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white p-1.5 rounded-lg shadow-xl flex gap-3 z-10 text-xs items-center animate-fade-in ring-1 ring-slate-700">
                        <span className="font-bold text-slate-300 border-r border-slate-600 pr-2">IMG</span>
                        <div className="flex gap-1 border-r border-slate-600 pr-2">
                             <button onClick={() => updateImageStyle({ width: '25%' })} className="hover:text-brand-orange px-1 transition-colors">25%</button>
                             <button onClick={() => updateImageStyle({ width: '50%' })} className="hover:text-brand-orange px-1 transition-colors">50%</button>
                             <button onClick={() => updateImageStyle({ width: '75%' })} className="hover:text-brand-orange px-1 transition-colors">75%</button>
                             <button onClick={() => updateImageStyle({ width: '100%' })} className="hover:text-brand-orange px-1 transition-colors">100%</button>
                        </div>
                        <div className="flex gap-1">
                             <button onClick={() => updateImageStyle({ float: 'left', margin: '0 10px 0 0' })} className="hover:text-brand-orange px-1 transition-colors">Esq</button>
                             <button onClick={() => updateImageStyle({ margin: '0 auto' })} className="hover:text-brand-orange px-1 transition-colors">Centro</button>
                             <button onClick={() => updateImageStyle({ float: 'right', margin: '0 0 0 10px' })} className="hover:text-brand-orange px-1 transition-colors">Dir</button>
                        </div>
                        <button onClick={() => setSelectedImg(null)} className="ml-1 text-slate-400 hover:text-white px-1">✕</button>
                    </div>
                )}
             </div>

             {/* MODAL INSERIR TABELA */}
             <Modal isOpen={showTableModal} onClose={() => setShowTableModal(false)} title="Inserir Tabela" maxWidth="max-w-md" footer={
                 <div className="flex gap-2">
                     <Button variant="ghost" onClick={() => setShowTableModal(false)}>Cancelar</Button>
                     <Button onClick={insertCustomTable}>Inserir</Button>
                 </div>
             }>
                 <div className="space-y-4">
                     <div className="grid grid-cols-2 gap-4">
                         <Input label="Linhas" type="number" min="1" max="20" value={tableConfig.rows} onChange={(e) => setTableConfig({...tableConfig, rows: parseInt(e.target.value)})} />
                         <Input label="Colunas" type="number" min="1" max="10" value={tableConfig.cols} onChange={(e) => setTableConfig({...tableConfig, cols: parseInt(e.target.value)})} />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <Select label="Alinhamento" value={tableConfig.align} onChange={(e) => setTableConfig({...tableConfig, align: e.target.value})}>
                            <option value="left">Esquerda</option>
                            <option value="center">Centro</option>
                            <option value="right">Direita</option>
                        </Select>
                        <Input label="Largura (%)" type="number" min="10" max="100" value={tableConfig.width} onChange={(e) => setTableConfig({...tableConfig, width: parseInt(e.target.value)})} />
                     </div>
                     <div className="grid grid-cols-2 gap-4 items-end">
                        <Input label="Padding das células (px)" type="number" min="0" value={tableConfig.padding} onChange={(e) => setTableConfig({...tableConfig, padding: parseInt(e.target.value)})} />
                        <div className="flex items-center gap-2 mb-3">
                             <input type="checkbox" id="headerRow" className="w-4 h-4 text-brand-blue" checked={tableConfig.header} onChange={(e) => setTableConfig({...tableConfig, header: e.target.checked})} />
                             <label htmlFor="headerRow" className="text-sm text-slate-700">Incluir linha de cabeçalho</label>
                        </div>
                     </div>
                 </div>
             </Modal>

             {/* MODAL INSERIR LINK */}
             <Modal isOpen={showLinkModal} onClose={() => closeLinkModal(false)} title="Inserir / Editar Link" maxWidth="max-w-sm" footer={
                 <div className="flex gap-2">
                     <Button variant="ghost" onClick={() => closeLinkModal(false)}>Cancelar</Button>
                     <Button type="button" onClick={() => closeLinkModal(true)}>Salvar Link</Button>
                 </div>
             }>
                 <div className="space-y-4">
                     <p className="text-sm text-slate-500">Insira a URL para onde o texto selecionado deve apontar.</p>
                     <Input 
                        label="URL" 
                        value={linkUrl} 
                        onChange={(e) => setLinkUrl(e.target.value)} 
                        placeholder="https://exemplo.com"
                        autoFocus
                     />
                 </div>
             </Modal>
        </div>
    );
};
