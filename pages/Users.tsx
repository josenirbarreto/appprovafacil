
import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { Button, Card, Badge } from '../components/UI';
import { Icons } from '../components/Icons';

const UsersPage = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const u = await FirebaseService.getUsers();
                setUsers(u);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    if (loading) return <div className="p-8 text-center text-slate-500">Carregando usuários...</div>;

    return (
        <div className="p-8 h-full bg-slate-50 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-3xl font-display font-bold text-slate-800">Usuários</h2>
                    <p className="text-slate-500">Gestão de acesso da plataforma.</p>
                </div>
                {/* Futuramente: Modal de cadastro manual de usuário */}
                <Button variant="secondary" onClick={() => alert("Funcionalidade de convite em breve.")}>
                    <Icons.Plus /> Convidar Usuário
                </Button>
            </div>

            <Card className="overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="p-4 font-semibold text-slate-600 text-sm">Usuário</th>
                            <th className="p-4 font-semibold text-slate-600 text-sm">Role</th>
                            <th className="p-4 font-semibold text-slate-600 text-sm">Status</th>
                            <th className="p-4 font-semibold text-slate-600 text-sm">Plano</th>
                            <th className="p-4 font-semibold text-slate-600 text-sm text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {users.map(u => (
                            <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold overflow-hidden">
                                            {u.photoUrl ? <img src={u.photoUrl} className="w-full h-full object-cover"/> : u.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800">{u.name}</p>
                                            <p className="text-xs text-slate-500">{u.email}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <Badge color={u.role === UserRole.ADMIN ? 'purple' : 'blue'}>
                                        {u.role}
                                    </Badge>
                                </td>
                                <td className="p-4">
                                    <Badge color={u.status === 'ACTIVE' ? 'green' : 'red'}>
                                        {u.status}
                                    </Badge>
                                </td>
                                <td className="p-4 text-sm text-slate-600">{u.plan}</td>
                                <td className="p-4 text-right">
                                    <button className="text-slate-400 hover:text-brand-blue p-2">
                                        <Icons.Edit />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>
        </div>
    );
};

export default UsersPage;
