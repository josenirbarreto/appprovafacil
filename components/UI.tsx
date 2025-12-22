
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
};

// Icons specific to the Rich Text Editor
const EditorIcons = {
    Undo: ({ className = "w-4 h-4" }: IconProps) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>,
    Redo: ({ className = "w-4 h-4" }: IconProps) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M18.4 10.6C16.55 9 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/></svg>,
    Bold: ({ className = "w-4 h-4" }: IconProps) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/></svg>,
    Italic: ({ className = "w-4 h-4" }: IconProps) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"/></svg>,
    Underline: ({ className = "w-4 h-4" }: IconProps) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z"/></svg>,
    ListBulleted: ({ className = "w-4 h-4" }: IconProps) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z"/></svg>,
    ListNumbered: ({ className = "w-4 h-4" }: IconProps) => <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"/></svg>,
};

/* Componente Button: Botão de ação com variantes pré-definidas de estilo. */
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

/* Componente Input: Campo de entrada de dados com suporte a labels. */
export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string }> = ({ label, className = '', ...props }) => (
    <div className="w-full space-y-1">
        {label && <label className="block text-sm font-bold text-slate-700">{label}</label>}
        <input 
            className={`w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-blue focus:border-brand-blue bg-white text-slate-800 transition-all text-sm placeholder:text-slate-400 ${className}`}
            {...props}
        />
    </div>
);

/* Componente Select: Elemento de seleção dropdown para formulários. */
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

/* Componente Card: Container visual para agrupamento de informações com bordas suaves. */
export const Card: React.FC<React.HTMLAttributes<HTMLDivElement> & { title?: string }> = ({ title, children, className = '', ...props }) => (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 p-6 ${className}`} {...props}>
        {title && <h3 className="text-lg font-bold text-slate-800 mb-4">{title}</h3>}
        {children}
    </div>
);

/* Componente Badge: Indicador colorido compacto para etiquetas e categorias. */
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

/* Componente Modal: Janela de diálogo sobreposta com fundo esmaecido. */
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

/* Componente RichTextEditor: Editor de texto rico simplificado baseado em contentEditable nativo. */
export const RichTextEditor: React.FC<{ label?: string, value: string, onChange: (html: string) => void }> = ({ label, value, onChange }) => {
    const editorRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== value) {
            editorRef.current.innerHTML = value || '';
        }
    }, [value]);

    const execCommand = (command: string, val: string = '') => {
        document.execCommand(command, false, val);
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
    };

    return (
        <div className="space-y-1">
            {label && <label className="block text-sm font-bold text-slate-700">{label}</label>}
            <div className="border border-slate-300 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-brand-blue focus-within:border-brand-blue transition-all bg-white shadow-inner">
                <div className="flex flex-wrap gap-1 p-2 bg-slate-50 border-b border-slate-200">
                    <button type="button" onClick={() => execCommand('bold')} className="p-1.5 hover:bg-white rounded transition-colors" title="Negrito"><EditorIcons.Bold /></button>
                    <button type="button" onClick={() => execCommand('italic')} className="p-1.5 hover:bg-white rounded transition-colors" title="Itálico"><EditorIcons.Italic /></button>
                    <button type="button" onClick={() => execCommand('underline')} className="p-1.5 hover:bg-white rounded transition-colors" title="Sublinhado"><EditorIcons.Underline /></button>
                    <div className="w-px h-6 bg-slate-300 mx-1"></div>
                    <button type="button" onClick={() => execCommand('insertUnorderedList')} className="p-1.5 hover:bg-white rounded transition-colors" title="Lista Marcadores"><EditorIcons.ListBulleted /></button>
                    <button type="button" onClick={() => execCommand('insertOrderedList')} className="p-1.5 hover:bg-white rounded transition-colors" title="Lista Numerada"><EditorIcons.ListNumbered /></button>
                    <div className="w-px h-6 bg-slate-300 mx-1"></div>
                    <button type="button" onClick={() => execCommand('undo')} className="p-1.5 hover:bg-white rounded transition-colors" title="Desfazer"><EditorIcons.Undo /></button>
                    <button type="button" onClick={() => execCommand('redo')} className="p-1.5 hover:bg-white rounded transition-colors" title="Refazer"><EditorIcons.Redo /></button>
                </div>
                <div 
                    ref={editorRef}
                    contentEditable
                    className="p-4 min-h-[150px] outline-none prose prose-sm prose-slate max-w-none rich-text-content"
                    onBlur={(e) => onChange(e.currentTarget.innerHTML)}
                    onInput={(e) => onChange(e.currentTarget.innerHTML)}
                />
            </div>
        </div>
    );
};
