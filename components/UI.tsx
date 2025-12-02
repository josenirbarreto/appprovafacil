
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
const EditorButton = ({ command, icon, active = false, arg = null, onClick }: { command?: string, icon: React.ReactNode, active?: boolean, arg?: string | null, onClick?: () => void }) => (
    <button
        type="button"
        onMouseDown={(e) => {
            e.preventDefault(); // Prevent losing focus
            if(onClick) onClick();
            else if(command) document.execCommand(command, false, arg || '');
        }}
        className={`p-1.5 rounded hover:bg-slate-200 text-slate-600 transition-colors ${active ? 'bg-slate-200 text-brand-blue' : ''}`}
    >
        {icon}
    </button>
);

export const RichTextEditor: React.FC<{ label?: string, value: string, onChange: (html: string) => void, className?: string }> = ({ label, value, onChange, className = '' }) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedImg, setSelectedImg] = useState<HTMLImageElement | null>(null);

    // Sync external value changes
    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== value) {
             if (value === '' && editorRef.current.innerHTML === '<br>') return;
             // Simple check to avoid cursor jumping if content is identical
             if (editorRef.current.innerHTML !== value) {
                editorRef.current.innerHTML = value;
             }
        }
    }, [value]);

    const handleInput = () => {
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
    };

    // Image Upload Handler
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && editorRef.current) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                // Insert with default styling
                const imgTag = `<img src="${ev.target?.result}" style="max-width: 50%; display: block; margin: 10px 0;" />`;
                editorRef.current?.focus();
                // Execute insert
                document.execCommand('insertHTML', false, imgTag);
                handleInput();
            };
            reader.readAsDataURL(file);
        }
        // Reset input to allow selecting same file again
        if(fileInputRef.current) fileInputRef.current.value = '';
    };

    // Detect Image Selection
    const handleMouseUp = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).tagName === 'IMG') {
            setSelectedImg(e.target as HTMLImageElement);
        } else {
            // Only deselect if clicking outside the overlay menu
            // (Handled by the fact the overlay is outside the contentEditable div usually, 
            // but we need to be careful not to deselect immediately if clicking the menu)
            // For simplicity, we deselect on editor click if it's not an image.
            setSelectedImg(null);
        }
    };

    // Image Modification Actions
    const updateImageStyle = (styles: Partial<CSSStyleDeclaration> & { float?: string }) => {
        if (selectedImg) {
            // Apply styles directly to the element
            Object.keys(styles).forEach((key) => {
                // @ts-ignore
                selectedImg.style[key] = styles[key];
            });

            // Special case for centering (reset float, set margins)
            if (styles.margin === '0 auto') {
                 selectedImg.style.display = 'block';
                 selectedImg.style.marginLeft = 'auto';
                 selectedImg.style.marginRight = 'auto';
                 selectedImg.style.float = 'none';
            }

            handleInput(); // Trigger onChange to save the HTML
            setSelectedImg(null); // Hide menu
        }
    };

    const Icons = {
        Bold: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6V4zm0 8h9a4 4 0 014 4 4 4 0 01-4 4H6v-8z" /></svg>,
        ItalicReal: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 4h-9l-4 16h9" /></svg>,
        Underline: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 3v7a6 6 0 006 6 6 6 0 006-6V3M4 21h16" /></svg>,
        Left: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h16" /></svg>,
        Center: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M4 18h16" /></svg>,
        Right: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M10 12h10M4 18h16" /></svg>,
        Justify: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>,
        Image: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
    };

    return (
        <div className={`flex flex-col gap-1 w-full ${className}`}>
             {label && <label className="text-sm font-semibold text-slate-700">{label}</label>}
             <div className="border border-slate-300 rounded-md bg-white focus-within:ring-2 focus-within:ring-brand-blue focus-within:border-brand-blue transition-all relative">
                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-50 border-b border-slate-200">
                    <EditorButton command="bold" icon={Icons.Bold} />
                    <EditorButton command="italic" icon={Icons.ItalicReal} />
                    <EditorButton command="underline" icon={Icons.Underline} />
                    <div className="w-px h-4 bg-slate-300 mx-1" />
                    <EditorButton command="justifyLeft" icon={Icons.Left} />
                    <EditorButton command="justifyCenter" icon={Icons.Center} />
                    <EditorButton command="justifyRight" icon={Icons.Right} />
                    <EditorButton command="justifyFull" icon={Icons.Justify} />
                    <div className="w-px h-4 bg-slate-300 mx-1" />
                    <EditorButton command="insertOrderedList" icon={<span>1.</span>} />
                    <EditorButton command="insertUnorderedList" icon={<span>•</span>} />
                    <div className="w-px h-4 bg-slate-300 mx-1" />
                    <EditorButton onClick={() => fileInputRef.current?.click()} icon={Icons.Image} />
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                </div>
                
                {/* Editable Area */}
                <div
                    ref={editorRef}
                    contentEditable
                    onInput={handleInput}
                    onMouseUp={handleMouseUp}
                    // onBlur handling is tricky with overlays, keeping it simple
                    className="p-3 min-h-[150px] max-h-[400px] overflow-y-auto text-slate-900 outline-none prose prose-sm max-w-none custom-scrollbar"
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
        </div>
    );
};
