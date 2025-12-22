
import React, { useRef, useEffect, useState } from 'react';

export interface IconProps {
  className?: string;
}

export const Icons = {
  Plus: ({ className = "w-4 h-4" }: IconProps) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
  UsersGroup: ({ className = "w-5 h-5" }: IconProps) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
  Building: ({ className = "w-5 h-5" }: IconProps) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  ChevronDown: ({ className = "w-5 h-5" }: IconProps) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>,
  Edit: ({ className = "w-4 h-4" }: IconProps) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>,
  Trash: ({ className = "w-4 h-4" }: IconProps) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  Menu: ({ className = "w-6 h-6" }: IconProps) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>,
  X: ({ className = "w-6 h-6" }: IconProps) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  Image: ({ className = "w-4 h-4" }: IconProps) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  Table: ({ className = "w-4 h-4" }: IconProps) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  List: ({ className = "w-4 h-4" }: IconProps) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>,
  OrderedList: ({ className = "w-4 h-4" }: IconProps) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h13M7 12h13M7 16h13M4 8h.01M4 12h.01M4 16h.01" /></svg>,
  AlignLeft: ({ className = "w-4 h-4" }: IconProps) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h16" /></svg>,
  AlignCenter: ({ className = "w-4 h-4" }: IconProps) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M4 18h16" /></svg>,
  AlignRight: ({ className = "w-4 h-4" }: IconProps) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M10 12h10M4 18h16" /></svg>,
  AlignJustify: ({ className = "w-4 h-4" }: IconProps) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>,
};

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' }> = ({ className = '', variant = 'primary', ...props }) => {
    const base = "flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 text-sm";
    const variants = {
        primary: "bg-brand-blue text-white hover:bg-blue-700 shadow-md shadow-blue-900/20",
        secondary: "bg-slate-800 text-white hover:bg-slate-900 shadow-md shadow-slate-900/20",
        outline: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50",
        ghost: "bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700",
        danger: "bg-red-500 text-white hover:bg-red-600 shadow-md shadow-red-900/20"
    };
    return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
};

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string }> = ({ label, className = '', ...props }) => (
    <div className="w-full space-y-1">
        {label && <label className="block text-sm font-bold text-slate-700">{label}</label>}
        <input 
            className={`w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-blue focus:border-brand-blue bg-white text-slate-800 transition-all text-sm placeholder:text-slate-400 ${className}`}
            {...props}
        />
    </div>
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }> = ({ label, children, className = '', ...props }) => (
    <div className="w-full space-y-1">
        {label && <label className="block text-sm font-bold text-slate-700">{label}</label>}
        <select 
            className={`w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-blue focus:border-brand-blue bg-white text-slate-800 transition-all cursor-pointer text-sm ${className}`}
            {...props}
        >
            {children}
        </select>
    </div>
);

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement> & { title?: string }> = ({ title, children, className = '', ...props }) => (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 p-6 ${className}`} {...props}>
        {title && <h3 className="text-lg font-bold text-slate-800 mb-4">{title}</h3>}
        {children}
    </div>
);

export const Badge: React.FC<{ color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'orange' | 'slate', children: React.ReactNode }> = ({ color = 'blue', children }) => {
    const colors = {
        blue: "bg-blue-100 text-blue-700 border-blue-200",
        green: "bg-green-100 text-green-700 border-green-200",
        red: "bg-red-100 text-red-700 border-red-200",
        yellow: "bg-yellow-100 text-yellow-800 border-yellow-200",
        purple: "bg-purple-100 text-purple-700 border-purple-200",
        orange: "bg-orange-100 text-orange-700 border-orange-200",
        slate: "bg-slate-100 text-slate-700 border-slate-200"
    };
    return (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border whitespace-nowrap ${colors[color]}`}>
            {children}
        </span>
    );
};

export const Modal: React.FC<{ isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode, footer?: React.ReactNode, maxWidth?: string, compact?: boolean }> = ({ isOpen, onClose, title, children, footer, maxWidth = 'max-w-2xl', compact = false }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
            <div className={`relative bg-white rounded-3xl shadow-2xl w-full ${maxWidth} max-h-[90vh] flex flex-col overflow-hidden animate-scale-in`}>
                <div className={`flex justify-between items-center border-b border-slate-100 shrink-0 ${compact ? 'p-4' : 'p-6'}`}>
                    <h3 className="text-xl font-display font-bold text-slate-800">{title}</h3>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"><Icons.X /></button>
                </div>
                <div className={`flex-1 overflow-y-auto custom-scrollbar ${compact ? 'p-4' : 'p-6'}`}>
                    {children}
                </div>
                {footer && (
                    <div className={`border-t border-slate-100 bg-slate-50 shrink-0 flex justify-end gap-2 ${compact ? 'p-4' : 'p-6'}`}>
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

export const RichTextEditor: React.FC<{ label?: string, value: string, onChange: (html: string) => void }> = ({ label, value, onChange }) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeTab, setActiveTab] = useState<'FORMAT' | 'MATH' | 'CHEM'>('FORMAT');
    const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);

    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== value) {
            editorRef.current.innerHTML = value || '';
        }
    }, [value]);

    const exec = (cmd: string, val: string = '') => {
        document.execCommand(cmd, false, val);
        if (editorRef.current) onChange(editorRef.current.innerHTML);
    };

    const insertHTML = (html: string) => {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            const div = document.createElement("div");
            div.innerHTML = html;
            const frag = document.createDocumentFragment();
            let lastNode;
            while (lastNode = div.firstChild) {
                frag.appendChild(lastNode);
            }
            range.insertNode(frag);
            if (editorRef.current) onChange(editorRef.current.innerHTML);
        }
    };

    const handleInsertTable = () => {
        const rowsIn = prompt("Número de linhas:", "3") || "0";
        const colsIn = prompt("Número de colunas:", "3") || "0";
        const rows = parseInt(rowsIn);
        const cols = parseInt(colsIn);
        
        if (rows > 0 && cols > 0) {
            let tableHtml = '<table style="border-collapse: collapse; width: 100%; border: 1px solid #cbd5e1; margin: 10px 0;">';
            for (let i = 0; i < rows; i++) {
                tableHtml += '<tr>';
                for (let j = 0; j < cols; j++) {
                    tableHtml += '<td style="border: 1px solid #cbd5e1; padding: 8px; min-width: 40px;">&nbsp;</td>';
                }
                tableHtml += '</tr>';
            }
            tableHtml += '</table><p>&nbsp;</p>';
            insertHTML(tableHtml);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const imgHtml = `<img src="${event.target?.result}" style="max-width: 100%; height: auto; display: block; margin: 10px auto;" />`;
                insertHTML(imgHtml);
            };
            reader.readAsDataURL(file);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleEditorClick = (e: React.MouseEvent) => {
        if (e.target instanceof HTMLImageElement) {
            setSelectedImage(e.target);
        } else {
            setSelectedImage(null);
        }
    };

    const resizeImage = (change: number) => {
        if (selectedImage) {
            const currentWidth = selectedImage.offsetWidth;
            const newWidth = Math.max(50, currentWidth + change);
            selectedImage.style.width = `${newWidth}px`;
            selectedImage.style.height = 'auto';
            if (editorRef.current) onChange(editorRef.current.innerHTML);
        }
    };

    const alignImage = (align: 'left' | 'center' | 'right') => {
        if (selectedImage) {
            selectedImage.style.marginLeft = align === 'left' ? '0' : align === 'center' ? 'auto' : 'auto';
            selectedImage.style.marginRight = align === 'right' ? '0' : align === 'center' ? 'auto' : 'auto';
            selectedImage.style.display = 'block';
            if (editorRef.current) onChange(editorRef.current.innerHTML);
        }
    };

    const SYMBOLS = {
        MATH: ['π', '√', '∛', '±', '≠', '≈', '∞', '∫', '∑', 'Δ', 'α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'λ', 'μ', 'ξ', 'ρ', 'σ', 'τ', 'φ', 'χ', 'ψ', 'ω', 'Ω', '∈', '∉', '⊂', '⊆', '∪', '∩', '∀', '∃', '∠', '°'],
        CHEM: ['H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne', 'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar', 'K', 'Ca', 'Fe', 'Cu', 'Zn', 'Ag', 'Au', 'Hg', 'Pb', '→', '⇄', '↑', '↓', 'Δ', '°C']
    };

    return (
        <div className="space-y-1 w-full">
            {label && <label className="block text-sm font-bold text-slate-700">{label}</label>}
            <div className="border-2 border-[#3d5a73] rounded-2xl overflow-hidden bg-white shadow-lg focus-within:ring-2 focus-within:ring-blue-400 transition-all">
                
                {/* Header Estilo MathType */}
                <div className="bg-[#4a6b8a] p-1 flex items-center justify-between border-b border-[#3d5a73]">
                    <div className="flex">
                        <button type="button" onClick={() => setActiveTab('FORMAT')} className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all rounded-t-lg mx-0.5 ${activeTab === 'FORMAT' ? 'bg-white text-[#4a6b8a]' : 'text-white hover:bg-white/10'}`}>Formatação</button>
                        <button type="button" onClick={() => setActiveTab('MATH')} className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all rounded-t-lg mx-0.5 ${activeTab === 'MATH' ? 'bg-white text-[#4a6b8a]' : 'text-white hover:bg-white/10'}`}>Matemática</button>
                        <button type="button" onClick={() => setActiveTab('CHEM')} className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all rounded-t-lg mx-0.5 ${activeTab === 'CHEM' ? 'bg-white text-[#4a6b8a]' : 'text-white hover:bg-white/10'}`}>Química</button>
                    </div>
                    <span className="text-[9px] text-white/50 font-mono pr-3 hidden sm:block">ACADEMIC v7.0</span>
                </div>

                {/* Toolbar Dinâmica */}
                <div className="flex flex-wrap gap-1 p-2 bg-[#f0f4f7] border-b border-slate-200 min-h-[50px]">
                    {activeTab === 'FORMAT' && (
                        <div className="flex flex-wrap gap-1 items-center">
                            <div className="flex gap-0.5 bg-white border border-slate-200 p-0.5 rounded shadow-sm">
                                <button type="button" onMouseDown={e => { e.preventDefault(); exec('bold'); }} className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded font-bold" title="Negrito">B</button>
                                <button type="button" onMouseDown={e => { e.preventDefault(); exec('italic'); }} className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded italic" title="Itálico">I</button>
                                <button type="button" onMouseDown={e => { e.preventDefault(); exec('underline'); }} className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded underline" title="Sublinhado">U</button>
                            </div>
                            <div className="w-px h-6 bg-slate-300 mx-1"></div>
                            <div className="flex gap-0.5 bg-white border border-slate-200 p-0.5 rounded shadow-sm">
                                <button type="button" onMouseDown={e => { e.preventDefault(); exec('justifyLeft'); }} className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded" title="Alinhar Esquerda"><Icons.AlignLeft /></button>
                                <button type="button" onMouseDown={e => { e.preventDefault(); exec('justifyCenter'); }} className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded" title="Centralizar"><Icons.AlignCenter /></button>
                                <button type="button" onMouseDown={e => { e.preventDefault(); exec('justifyRight'); }} className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded" title="Alinhar Direita"><Icons.AlignRight /></button>
                                <button type="button" onMouseDown={e => { e.preventDefault(); exec('justifyFull'); }} className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded" title="Justificar"><Icons.AlignJustify /></button>
                            </div>
                            <div className="w-px h-6 bg-slate-300 mx-1"></div>
                            <div className="flex gap-0.5 bg-white border border-slate-200 p-0.5 rounded shadow-sm">
                                <button type="button" onMouseDown={e => { e.preventDefault(); exec('insertUnorderedList'); }} className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded" title="Marcadores"><Icons.List /></button>
                                <button type="button" onMouseDown={e => { e.preventDefault(); exec('insertOrderedList'); }} className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded" title="Numeração"><Icons.OrderedList /></button>
                            </div>
                            <div className="w-px h-6 bg-slate-300 mx-1"></div>
                            <button type="button" onMouseDown={e => { e.preventDefault(); handleInsertTable(); }} className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 hover:bg-slate-50 rounded shadow-sm text-slate-600" title="Inserir Tabela"><Icons.Table /></button>
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 hover:bg-slate-50 rounded shadow-sm text-slate-600" title="Inserir Imagem"><Icons.Image /></button>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                            
                            {selectedImage && (
                                <div className="flex gap-1 items-center bg-brand-blue/10 p-1 rounded-lg border border-brand-blue/20 animate-fade-in ml-2">
                                    <span className="text-[10px] font-black text-brand-blue uppercase px-1">Img:</span>
                                    <button type="button" onClick={() => resizeImage(20)} className="w-7 h-7 flex items-center justify-center bg-white border rounded hover:bg-slate-50 font-bold" title="Aumentar Zoom">+</button>
                                    <button type="button" onClick={() => resizeImage(-20)} className="w-7 h-7 flex items-center justify-center bg-white border rounded hover:bg-slate-50 font-bold" title="Diminuir Zoom">-</button>
                                    <div className="w-px h-4 bg-brand-blue/20 mx-1"></div>
                                    <button type="button" onClick={() => alignImage('left')} className="w-7 h-7 flex items-center justify-center bg-white border rounded hover:bg-slate-50 text-[10px] font-black">L</button>
                                    <button type="button" onClick={() => alignImage('center')} className="w-7 h-7 flex items-center justify-center bg-white border rounded hover:bg-slate-50 text-[10px] font-black">C</button>
                                    <button type="button" onClick={() => alignImage('right')} className="w-7 h-7 flex items-center justify-center bg-white border rounded hover:bg-slate-50 text-[10px] font-black">R</button>
                                </div>
                            )}
                        </div>
                    )}
                    {activeTab === 'MATH' && (
                        <div className="grid grid-cols-8 sm:grid-cols-12 gap-0.5">
                            <button type="button" onMouseDown={e => { e.preventDefault(); insertHTML('<sup>x</sup>'); }} className="w-7 h-7 flex items-center justify-center bg-white border border-slate-200 text-[10px] font-bold hover:bg-blue-50" title="Sobrescrito">x²</button>
                            <button type="button" onMouseDown={e => { e.preventDefault(); insertHTML('<sub>x</sub>'); }} className="w-7 h-7 flex items-center justify-center bg-white border border-slate-200 text-[10px] font-bold hover:bg-blue-50" title="Subscrito">x₂</button>
                            <button type="button" onMouseDown={e => { e.preventDefault(); insertHTML('<span style="border-top:1px solid">x</span>'); }} className="w-7 h-7 flex items-center justify-center bg-white border border-slate-200 text-[10px] font-bold hover:bg-blue-50" title="Raiz">√</button>
                            <div className="w-px h-7 bg-slate-300 mx-0.5"></div>
                            {SYMBOLS.MATH.map(sym => (
                                <button key={sym} type="button" onMouseDown={e => { e.preventDefault(); insertHTML(sym); }} className="w-7 h-7 flex items-center justify-center bg-white border border-slate-200 text-xs hover:bg-blue-50 font-medium transition-colors">{sym}</button>
                            ))}
                        </div>
                    )}
                    {activeTab === 'CHEM' && (
                        <div className="grid grid-cols-8 sm:grid-cols-12 gap-0.5">
                            <button type="button" onMouseDown={e => { e.preventDefault(); exec('subscript'); }} className="w-7 h-7 flex items-center justify-center bg-white border border-slate-200 text-[10px] font-bold hover:bg-emerald-50" title="H2O">H₂</button>
                            <button type="button" onMouseDown={e => { e.preventDefault(); exec('superscript'); }} className="w-7 h-7 flex items-center justify-center bg-white border border-slate-200 text-[10px] font-bold hover:bg-emerald-50" title="Ion">Fe³⁺</button>
                            <div className="w-px h-7 bg-slate-300 mx-0.5"></div>
                            {SYMBOLS.CHEM.map(sym => (
                                <button key={sym} type="button" onMouseDown={e => { e.preventDefault(); insertHTML(sym); }} className="w-7 h-7 flex items-center justify-center bg-white border border-slate-200 text-xs hover:bg-emerald-50 font-bold transition-colors">{sym}</button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Editor Content */}
                <div 
                    ref={editorRef}
                    contentEditable
                    onClick={handleEditorClick}
                    className="p-5 min-h-[300px] outline-none prose prose-slate max-w-none rich-text-content font-medium text-slate-800 bg-[#fdfdfd]"
                    onBlur={(e) => onChange(e.currentTarget.innerHTML)}
                    onInput={(e) => onChange(e.currentTarget.innerHTML)}
                />
            </div>
        </div>
    );
};
