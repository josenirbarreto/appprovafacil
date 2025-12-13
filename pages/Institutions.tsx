
import React, { useState, useEffect } from 'react';
import { Institution } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { Button, Modal, Input, Card } from '../components/UI';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';

const InstitutionPage = () => {
    const { user } = useAuth();
    const [institutions, setInstitutions] = useState<Institution[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Partial<Institution>>({});

    useEffect(() => { if (user) load(); }, [user]);
    const load = async () => { setInstitutions(await FirebaseService.getInstitutions(user)); };

    const handleSave = async () => {
        if (!editing.name) return alert('Nome obrigatório');
        if (editing.id) await FirebaseService.updateInstitution(editing as Institution); else await FirebaseService.addInstitution(editing as Institution);
        setIsModalOpen(false); load();
    };

    const handleDelete = async (id: string) => { if(confirm('Excluir instituição?')) { await FirebaseService.deleteInstitution(id); load(); } };
    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => { setEditing({...editing, logoUrl: reader.result as string}); }; reader.readAsDataURL(file); } };

    return (
        <div className="p-8 h-full flex flex-col"><div className="flex justify-between items-center mb-6"><h2 className="text-3xl font-display font-bold text-slate-800">Instituições</h2><Button onClick={() => { setEditing({}); setIsModalOpen(true); }}><Icons.Plus /> Nova Instituição</Button></div><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto">{institutions.map(inst => (<Card key={inst.id} className="relative group"><div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2"><button onClick={() => { setEditing(inst); setIsModalOpen(true); }} className="p-1 bg-white rounded shadow hover:text-brand-blue"><Icons.Edit /></button><button onClick={() => handleDelete(inst.id)} className="p-1 bg-white rounded shadow hover:text-red-500"><Icons.Trash /></button></div><div className="flex flex-col items-center text-center">{inst.logoUrl ? <img src={inst.logoUrl} alt={inst.name} className="h-20 w-auto object-contain mb-4" /> : <div className="h-20 w-20 bg-slate-100 rounded-full flex items-center justify-center mb-4"><Icons.Building /></div>}<h3 className="font-bold text-lg">{inst.name}</h3><p className="text-sm text-slate-500">{inst.email}</p><p className="text-sm text-slate-500">{inst.phone}</p></div></Card>))}</div><Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing.id ? 'Editar Instituição' : 'Nova Instituição'} footer={<Button onClick={handleSave}>Salvar</Button>}><div className="space-y-4"><div className="flex items-center gap-4">{editing.logoUrl && <img src={editing.logoUrl} className="h-16 w-16 object-contain border" />}<Input type="file" accept="image/*" onChange={handleLogoUpload} className="border-0" /></div><Input label="Nome" value={editing.name || ''} onChange={e => setEditing({...editing, name: e.target.value})} /><Input label="Endereço" value={editing.address || ''} onChange={e => setEditing({...editing, address: e.target.value})} /><div className="grid grid-cols-2 gap-4"><Input label="Email" value={editing.email || ''} onChange={e => setEditing({...editing, email: e.target.value})} /><Input label="Telefone" value={editing.phone || ''} onChange={e => setEditing({...editing, phone: e.target.value})} /></div><Input label="Website" value={editing.website || ''} onChange={e => setEditing({...editing, website: e.target.value})} /></div></Modal></div>
    );
};

export default InstitutionPage;
