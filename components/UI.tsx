
import React, { useRef, useEffect, useState } from 'react';

export const Icons = {
  Plus: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
  UsersGroup: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
  Building: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  ChevronDown: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>,
  Edit: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>,
  Trash: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  Menu: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>,
  X: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
};

// Icons specific to the Rich Text Editor
const EditorIcons = {
    Undo: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>,
    Redo: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.4 10.6C16.55 9 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/></svg>,
    Bold: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/></svg>,
    Italic: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"/></svg>,
    Underline: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z"/></svg>,
    Subscript: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M22,18H16V16H19V13H17.5V11H20.5V16H22V18M5.8,5L8.9,10.2L12,5H15.1L10.3,12L15.3,19H12.1L8.8,13.2L5.4,19H2.2L7.3,12L2.7,5H5.8Z"/></svg>,
    Superscript: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M16,7H22V9H19V14H16V7M5.8,5L8.9,10.2L12,5H15.1L10.3,12L15.3,19H12.1L8.8,13.2L5.4,19H2.2L7.3,12L2.7,5H5.8Z"/></svg>,
    AlignLeft: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M15 15H3v2h12v-2zm0-8H3v2h12V7zM3 13h18v-2H3v2zm0 8h18v-2H3v2zM3 3v2h18V3H3z"/></svg>,
    AlignCenter: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M7 15v2h10v-2H7zm-4 6h18v-2H3v2zm0-8h18v-2H3v2zm4-6v2h10V7H7zM3 3v2h18V3H3z"/></svg>,
    AlignRight: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M3 21h18v-2H3v2zm6-4h12v-2H9v2zm-6-4h18v-2H3v2zm6-4h12V7H9v2zM3 3v2h18V3H3z"/></svg>,
    Justify: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M3 21h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18V7H3v2zm0-6v2h18V3H3z"/></svg>,
    ListBulleted: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z"/></svg>,
    ListNumbered: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"/></svg>,
    IndentIncrease: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M3 21h18v-2H3v2zM3 8v8l4-4-4-4zm8 9h10v-2H11v2zM3 3v2h18V3H3zm8 6h10V7H11v2zm0 4h10v-2H11v2z"/></svg>,
    IndentDecrease: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M11 17h10v-2H11v2zm-8-5l4 4V8l-4 4zm0 9h18v-2H3v2zM3 3v2h18V3H3zm8 6h10V7H11v2zm0 4h10v-2H11v2z"/></svg>,
    Link: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>,
    Table: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 2h3.5v4H12V4zm0 6h3.5v4H12v-4zM4 4h3.5v4H4V4zm0 6h3.5v4H4v-4zm0 6h3.5v4H4v-4zm8 4v-4h3.5v4H12zm8-4h-3.5v-4H20v4zm0 4h-3.5v-4H20v4zm0-10h-3.5V4H20v4z"/></svg>,
    Image: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>,
    Clear: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M3.27 5L2 6.27l6.97 6.97L6.5 19h3l1.57-3.66L16.73 21 18 19.73 3.55 5.27 3.27 5zM6 5v.18L8.82 8h2.4l-.72 1.68 2.1 2.1L14.21 8H20V5H6z"/></svg>,
    Flask: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14,12.94C19.07,12.87 19,12.81 18.9,12.76L13,6V5H14V3H10V5H11V6L5.1,12.76C5,12.81 4.93,12.87 4.86,12.94C4.28,13.56 4.19,14.5 4.64,15.22L7,19H17L19.36,15.22C19.81,14.5 19.72,13.56 19.14,12.94M15.54,18H8.46L6.89,15.5L12,9.91L17.11,15.5L15.54,18Z" /></svg>,
    Calculator: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M19,3H5C3.9,3 3,3.9 3,5V19C3,20.1 3.9,21 5,21H19C20.1,21 21,20.1 21,19V5C21,3.9 20.1,3 19,3M19,19H5V5H19V19M13,7.5H17V9H13V7.5M13,10.5H17V12H13V10.5M7,7.5H11V9H7V7.5M7,10.5H11V12H7V10.5M7,13.5H11V15H7V13.5M13,13.5H17V15H13V13.5Z" /></svg>,
    Type: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M2.5,4V7H5V19H8V7H10.5V4H2.5M12.5,9V12H14.5V19H17.5V12H19.5V9H12.5Z" /></svg>
};

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
    <input className={`border border-slate-300 bg-white !text-slate-900 rounded-md px-3 py-2 focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none transition-all ${className}`} {...props} />
  </div>
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }> = ({ label, className = '', children, ...props }) => (
  <div className="flex flex-col gap-1 w-full">
    {label && <label className="text-sm font-semibold text-slate-700">{label}</label>}
    <select className={`border border-slate-300 bg-white !text-slate-900 rounded-md px-3 py-2 focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none ${className}`} {...props}>
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

export const Badge: React.FC<{ children: React.ReactNode; color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'orange' }> = ({ children, color = 'blue' }) => {
  const colors = {
    blue: 'bg-blue-100 text-blue-800',
    green: 'bg-green-100 text-green-800',
    red: 'bg-red-100 text-red-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    purple: 'bg-purple-100 text-purple-800',
    orange: 'bg-orange-100 text-orange-800'
  };
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${colors[color]}`}>{children}</span>;
};

// Novo Componente Modal (CRÍTICO: position absolute na impressão para permitir paginação)
export const Modal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    title: string; 
    children: React.ReactNode;
    footer?: React.ReactNode;
    maxWidth?: string;
    compact?: boolean;
}> = ({ isOpen, onClose, title, children, footer, maxWidth = 'max-w-2xl', compact = false }) => {
    if (!isOpen) return null;

    const headerPadding = compact ? 'p-3' : 'p-5';
    const bodyPadding = compact ? 'p-4' : 'p-6';
    const footerPadding = compact ? 'p-3' : 'p-5';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in print:absolute print:inset-0 print:bg-white print:p-0 print:z-[100] print:block print:h-auto print:overflow-visible">
            <div className={`bg-white rounded-2xl shadow-2xl w-full ${maxWidth} max-h-[90vh] flex flex-col overflow-hidden animate-scale-in print:shadow-none print:w-full print:max-w-none print:max-h-none print:rounded-none print:overflow-visible print:h-auto print:block`}>
                <div className={`flex justify-between items-center ${headerPadding} border-b border-slate-100 bg-slate-50/50 print:hidden`}>
                    <h3 className={`${compact ? 'text-lg' : 'text-xl'} font-display font-bold text-brand-dark`}>{title}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-slate-100">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <div className={`${bodyPadding} overflow-y-auto custom-scrollbar flex-1 print:p-0 print:overflow-visible print:h-auto print:block`}>
                    {children}
                </div>

                {footer && (
                    <div className={`${footerPadding} border-t border-slate-100 bg-slate-50/30 flex justify-end gap-3 print:hidden`}>
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

const SymbolBtn: React.FC<{ char: string; onInsert: (char: string) => void }> = ({ char, onInsert }) => (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onInsert(char); }}
      className="w-8 h-8 flex items-center justify-center hover:bg-blue-100 rounded text-slate-700 font-serif text-lg border border-transparent hover:border-blue-200 transition-colors"
    >
        {char}
    </button>
);

export const RichTextEditor: React.FC<{ label?: string; value: string; onChange: (html: string) => void }> = ({ label, value, onChange }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'text' | 'math' | 'chem'>('text');
  const [mathSubTab, setMathSubTab] = useState('general');
  const [chemSubTab, setChemSubTab] = useState('general');
  const [activeFormats, setActiveFormats] = useState<string[]>([]);

  // Sync prop value to DOM only when not focused, to prevent cursor jumping
  useEffect(() => {
    if (editorRef.current) {
        if (value !== editorRef.current.innerHTML && document.activeElement !== editorRef.current) {
             editorRef.current.innerHTML = value;
        }
    }
  }, [value]);

  const checkFormats = () => {
      const formats = [];
      if (document.queryCommandState('bold')) formats.push('bold');
      if (document.queryCommandState('italic')) formats.push('italic');
      if (document.queryCommandState('underline')) formats.push('underline');
      if (document.queryCommandState('subscript')) formats.push('subscript');
      if (document.queryCommandState('superscript')) formats.push('superscript');
      if (document.queryCommandState('justifyLeft')) formats.push('justifyLeft');
      if (document.queryCommandState('justifyCenter')) formats.push('justifyCenter');
      if (document.queryCommandState('justifyRight')) formats.push('justifyRight');
      if (document.queryCommandState('justifyFull')) formats.push('justifyFull');
      if (document.queryCommandState('insertUnorderedList')) formats.push('insertUnorderedList');
      if (document.queryCommandState('insertOrderedList')) formats.push('insertOrderedList');
      setActiveFormats(formats);
  };

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
      checkFormats();
    }
  };

  const execCommand = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
        editorRef.current.focus();
        onChange(editorRef.current.innerHTML);
        checkFormats();
    }
  };

  const insertSymbol = (symbol: string) => {
      document.execCommand('insertText', false, symbol);
      if (editorRef.current) {
          editorRef.current.focus();
          onChange(editorRef.current.innerHTML);
      }
  };

  const promptLink = () => {
      const url = prompt("Digite a URL:");
      if(url) execCommand('createLink', url);
  }

  const promptImage = () => {
      const url = prompt("Digite a URL da imagem:");
      if(url) execCommand('insertImage', url);
  }

  const insertTable = () => {
      const tableHtml = '<table style="width:100%; border-collapse: collapse; margin: 1em 0;"><tbody><tr><td style="border:1px solid #ccc; padding: 8px;">Célula 1</td><td style="border:1px solid #ccc; padding: 8px;">Célula 2</td></tr><tr><td style="border:1px solid #ccc; padding: 8px;">Célula 3</td><td style="border:1px solid #ccc; padding: 8px;">Célula 4</td></tr></tbody></table><p>&nbsp;</p>';
      execCommand('insertHTML', tableHtml);
  }

  const ToolbarBtn = ({ cmd, arg, children, title }: any) => {
      const isActive = activeFormats.includes(cmd);
      return (
        <button 
            type="button" 
            onMouseDown={(e) => { e.preventDefault(); cmd === 'link' ? promptLink() : cmd === 'image' ? promptImage() : cmd === 'table' ? insertTable() : execCommand(cmd, arg); }} 
            className={`p-1.5 rounded flex items-center justify-center transition-all focus:outline-none ${isActive ? 'bg-blue-300 text-blue-900 shadow-inner' : 'text-slate-700 hover:bg-blue-200 hover:text-blue-900'}`}
            title={title}
        >
            {children}
        </button>
      );
  };

  const Divider = () => <div className="w-px h-5 bg-blue-300 mx-1 self-center"></div>;

  const TabButton = ({ id, label, icon }: any) => (
      <button
        type="button"
        onClick={() => { 
            setActiveTab(id); 
            if(id === 'math') setMathSubTab('general');
            if(id === 'chem') setChemSubTab('general');
        }}
        className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-t-lg transition-colors border-t border-x ${activeTab === id ? 'bg-blue-100 border-blue-300 text-blue-900 border-b-transparent relative top-px z-10' : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'}`}
      >
          {icon} {label}
      </button>
  );

  const MathSubTab = ({ id, label }: any) => (
      <button
        type="button"
        onClick={() => setMathSubTab(id)}
        className={`px-3 py-1 text-[10px] font-bold rounded-full transition-colors ${mathSubTab === id ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-blue-50'}`}
      >
          {label}
      </button>
  );

  const ChemSubTab = ({ id, label }: any) => (
      <button
        type="button"
        onClick={() => setChemSubTab(id)}
        className={`px-3 py-1 text-[10px] font-bold rounded-full transition-colors ${chemSubTab === id ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-blue-50'}`}
      >
          {label}
      </button>
  );

  const mathCategories: Record<string, string[]> = {
      general: ['+', '-', '±', '×', '÷', '=', '≠', '≈', '>', '<', '≥', '≤', '√', '∛', '∜', '%', '‰', '∞'],
      sets: ['∀', '∃', '∄', '∅', '∈', '∉', '⊂', '⊃', '⊆', '⊇', '∪', '∩', '∖', 'ℕ', 'ℤ', 'ℚ', 'ℝ'],
      greek: ['α', 'β', 'γ', 'δ', 'ε', 'θ', 'λ', 'μ', 'π', 'ρ', 'σ', 'τ', 'φ', 'ω', 'Δ', 'Γ', 'Λ', 'Ω', 'Φ', 'Ψ', 'Σ'],
      calculus: ['∫', '∬', '∮', '∂', '∇', '∑', '∏', 'lim', '′', '″', '‴'],
      operators: ['→', '←', '↔', '⇒', '⇔', '↑', '↓', '↦', '∴', '∵', '⊕', '⊗'],
      geometry: ['∠', '⊥', '∥', '°', '△', 'π', 'rad', 'sin', 'cos', 'tan']
  };

  const chemCategories: Record<string, string[]> = {
      general: ['H', 'C', 'N', 'O', 'F', 'S', 'P', 'Cl', 'Br', 'I', 'Na', 'K', 'Ca', 'Mg', 'Al', 'Fe', 'Cu', 'Zn', 'Ag', 'Au'],
      bonds: ['-', '=', '≡', '–', '—', '·', '•', ':', '+', '−'], 
      arrows: ['→', '↔', '⇌', '↑', '↓', '⇄', '⇆', '⇢', '⟶', '⟹'],
      symbols: ['°', '∆', 'δ', 'mol', 'M', 'pH', '[', ']', 'ℓ', 'λ', 'ν'],
      states: ['(s)', '(l)', '(g)', '(aq)', '(v)']
  };

  return (
    <div className="flex flex-col gap-1 w-full">
      {label && <label className="text-sm font-semibold text-slate-700">{label}</label>}
      
      {/* Tab Header */}
      <div className="flex items-end gap-1 px-1 border-b border-blue-300">
          <TabButton id="text" label="Formatação" icon={<EditorIcons.Type />} />
          <TabButton id="math" label="Matemática" icon={<EditorIcons.Calculator />} />
          <TabButton id="chem" label="Química" icon={<EditorIcons.Flask />} />
      </div>

      <div className="border border-blue-300 rounded-b-md overflow-hidden bg-white focus-within:ring-2 focus-within:ring-brand-blue focus-within:border-brand-blue transition-all">
        {/* Toolbar Body */}
        <div className="bg-blue-100 border-b border-blue-200 p-1.5 min-h-[46px]">
          
          {/* TEXT TOOLBAR */}
          {activeTab === 'text' && (
              <div className="flex flex-wrap items-center gap-0.5 animate-fade-in">
                <ToolbarBtn cmd="undo" title="Desfazer"><EditorIcons.Undo /></ToolbarBtn>
                <ToolbarBtn cmd="redo" title="Refazer"><EditorIcons.Redo /></ToolbarBtn>
                <Divider />
                <div className="relative group mx-1">
                    <select 
                        className="appearance-none bg-white hover:bg-blue-50 text-slate-700 text-xs font-semibold py-1.5 pl-2 pr-6 rounded border border-blue-300 cursor-pointer outline-none focus:border-brand-blue"
                        onChange={(e) => execCommand('formatBlock', e.target.value)}
                        defaultValue="P"
                    >
                        <option value="P">Padrão</option>
                        <option value="H1">Título 1</option>
                        <option value="H2">Título 2</option>
                        <option value="H3">Título 3</option>
                        <option value="BLOCKQUOTE">Citação</option>
                    </select>
                </div>
                <ToolbarBtn cmd="removeFormat" title="Limpar"><EditorIcons.Clear /></ToolbarBtn>
                <Divider />
                <ToolbarBtn cmd="bold" title="Negrito"><EditorIcons.Bold /></ToolbarBtn>
                <ToolbarBtn cmd="italic" title="Itálico"><EditorIcons.Italic /></ToolbarBtn>
                <ToolbarBtn cmd="underline" title="Sublinhado"><EditorIcons.Underline /></ToolbarBtn>
                <ToolbarBtn cmd="subscript" title="Subscrito"><EditorIcons.Subscript /></ToolbarBtn>
                <ToolbarBtn cmd="superscript" title="Sobrescrito"><EditorIcons.Superscript /></ToolbarBtn>
                <Divider />
                <ToolbarBtn cmd="justifyLeft" title="Esquerda"><EditorIcons.AlignLeft /></ToolbarBtn>
                <ToolbarBtn cmd="justifyCenter" title="Centro"><EditorIcons.AlignCenter /></ToolbarBtn>
                <ToolbarBtn cmd="justifyRight" title="Direita"><EditorIcons.AlignRight /></ToolbarBtn>
                <ToolbarBtn cmd="justifyFull" title="Justificado"><EditorIcons.Justify /></ToolbarBtn>
                <Divider />
                <ToolbarBtn cmd="insertUnorderedList" title="Marcadores"><EditorIcons.ListBulleted /></ToolbarBtn>
                <ToolbarBtn cmd="insertOrderedList" title="Lista Num."><EditorIcons.ListNumbered /></ToolbarBtn>
                <Divider />
                <ToolbarBtn cmd="link" title="Link"><EditorIcons.Link /></ToolbarBtn>
                <ToolbarBtn cmd="table" title="Tabela"><EditorIcons.Table /></ToolbarBtn>
                <ToolbarBtn cmd="image" title="Imagem"><EditorIcons.Image /></ToolbarBtn>
              </div>
          )}

          {/* MATH TOOLBAR */}
          {activeTab === 'math' && (
              <div className="flex flex-col gap-2 animate-fade-in">
                  <div className="flex gap-1 bg-blue-200 p-1 rounded-lg overflow-x-auto custom-scrollbar">
                      <MathSubTab id="general" label="Geral" />
                      <MathSubTab id="sets" label="Conjuntos" />
                      <MathSubTab id="greek" label="Grego" />
                      <MathSubTab id="calculus" label="Cálculo" />
                      <MathSubTab id="operators" label="Operadores" />
                      <MathSubTab id="geometry" label="Geometria" />
                  </div>
                  <div className="flex flex-wrap gap-1 p-2 bg-white rounded border border-blue-200 shadow-sm">
                      <div className="flex items-center gap-1 border-r border-slate-100 pr-2 mr-2">
                        <ToolbarBtn cmd="bold" title="Negrito"><EditorIcons.Bold /></ToolbarBtn>
                        <ToolbarBtn cmd="italic" title="Itálico"><EditorIcons.Italic /></ToolbarBtn>
                        <ToolbarBtn cmd="subscript" title="Subscrito"><EditorIcons.Subscript /></ToolbarBtn>
                        <ToolbarBtn cmd="superscript" title="Sobrescrito"><EditorIcons.Superscript /></ToolbarBtn>
                      </div>
                      {mathCategories[mathSubTab].map(char => <SymbolBtn key={char} char={char} onInsert={insertSymbol} />)}
                  </div>
              </div>
          )}

          {/* CHEM TOOLBAR */}
          {activeTab === 'chem' && (
              <div className="flex flex-col gap-2 animate-fade-in">
                  <div className="flex gap-1 bg-blue-200 p-1 rounded-lg overflow-x-auto custom-scrollbar">
                      <ChemSubTab id="general" label="Elementos" />
                      <ChemSubTab id="bonds" label="Ligações" />
                      <ChemSubTab id="arrows" label="Setas" />
                      <ChemSubTab id="symbols" label="Símbolos" />
                      <ChemSubTab id="states" label="Estados" />
                  </div>
                  <div className="flex flex-wrap gap-1 p-2 bg-white rounded border border-blue-200 shadow-sm">
                      <div className="flex items-center gap-1 border-r border-slate-100 pr-2 mr-2">
                        <ToolbarBtn cmd="subscript" title="Subscrito (H₂O)"><EditorIcons.Subscript /></ToolbarBtn>
                        <ToolbarBtn cmd="superscript" title="Sobrescrito (íons)"><EditorIcons.Superscript /></ToolbarBtn>
                        <ToolbarBtn cmd="bold" title="Negrito"><EditorIcons.Bold /></ToolbarBtn>
                      </div>
                      {chemCategories[chemSubTab].map(char => <SymbolBtn key={char} char={char} onInsert={insertSymbol} />)}
                  </div>
              </div>
          )}

        </div>
        
        {/* Editor Area */}
        <div
          ref={editorRef}
          className="p-4 min-h-[150px] outline-none prose prose-sm max-w-none text-slate-800 leading-relaxed rich-text-content"
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyUp={checkFormats}
          onMouseUp={checkFormats}
          style={{ minHeight: '150px' }}
        />
      </div>
    </div>
  );
};
