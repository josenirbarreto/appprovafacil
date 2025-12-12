import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { FirebaseService } from '../services/firebaseService';
import { Button, Input, Card, Badge } from '../components/UI';

const ProfilePage = () => {
    const { user, refreshUser } = useAuth();
    const [name, setName] = useState(user?.name || '');
    const [photoUrl, setPhotoUrl] = useState(user?.photoUrl || '');
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState('');

    const handleSave = async () => {
        if (!user) return; setLoading(true); try { await FirebaseService.updateUser(user.id, { name, photoUrl }); await refreshUser(); setMsg('Perfil atualizado com sucesso!'); } catch (error) { console.error(error); setMsg('Erro ao atualizar perfil.'); } setLoading(false);
    };
    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => { setPhotoUrl(reader.result as string); }; reader.readAsDataURL(file); } };

    return (
        <div className="p-8 max-w-2xl mx-auto"><h2 className="text-3xl font-display font-bold text-slate-800 mb-6">Meu Perfil</h2><Card className="space-y-6"><div className="flex items-center gap-6"><div className="relative group">{photoUrl ? <img src={photoUrl} alt="Profile" className="w-24 h-24 rounded-full object-cover border-2 border-slate-200" /> : <div className="w-24 h-24 bg-brand-orange text-white rounded-full flex items-center justify-center text-3xl font-bold">{name.charAt(0)}</div>}<label className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity text-white text-xs font-bold">Alterar<input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} /></label></div><div><h3 className="text-xl font-bold">{user?.name}</h3><p className="text-slate-500">{user?.email}</p><Badge>{user?.role === 'TEACHER' ? 'Professor' : user?.role}</Badge></div></div><div className="space-y-4"><Input label="Nome Completo" value={name} onChange={e => setName(e.target.value)} /><div className="grid grid-cols-2 gap-4"><Input label="Plano" value={user?.plan || 'Free'} disabled /><Input label="Vencimento" value={user?.subscriptionEnd ? new Date(user.subscriptionEnd).toLocaleDateString() : '-'} disabled /></div></div><div className="flex justify-between items-center pt-4 border-t border-slate-100"><span className={`text-sm ${msg.includes('sucesso') ? 'text-green-600' : 'text-red-600'}`}>{msg}</span><Button onClick={handleSave} disabled={loading}>{loading ? 'Salvando...' : 'Salvar Alterações'}</Button></div></Card></div>
    );
};

export default ProfilePage;
