
import React, { useState, useEffect } from 'react';
import { User, AuditLog, UserRole } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { Card, Badge, Button, Input, Select } from '../components/UI';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

const AuditLogsPage = () => {
    const { user } = useAuth();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Filtros
    const [filterActor, setFilterActor] = useState('');
    const [filterAction, setFilterAction] = useState('');
    const [filterDate, setFilterDate] = useState('');

    useEffect(() => {
        if (user?.role === UserRole.ADMIN) {
            loadLogs();
        } else {
            setLoading(false);
        }
    }, [user]);

    // Aplica filtros localmente
    useEffect(() => {
        let res = logs;
        if (filterActor) {
            res = res.filter(l => l.actorName.toLowerCase().includes(filterActor.toLowerCase()) || l.actorId === filterActor);
        }
        if (filterAction) {
            res = res.filter(l => l.action === filterAction);
        }
        if (filterDate) {
            res = res.filter(l => l.timestamp.startsWith(filterDate));
        }
        setFilteredLogs(res);
    }, [logs, filterActor, filterAction, filterDate]);

    const loadLogs = async () => {
        try {
            const data = await FirebaseService.getAuditLogs();
            setLogs(data);
            setFilteredLogs(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (user?.role !== UserRole.ADMIN) {
        return <Navigate to="/" />;
    }

    if (loading) return <div className="p-8 text-center text-slate-500">Carregando logs de segurança...</div>;

    const getActionBadgeColor = (action: string) => {
        switch (action) {
            case 'DELETE': return 'red';
            case 'CREATE': return 'green';
            case 'UPDATE': return 'blue';
            case 'LOGIN': return 'purple';
            case 'SECURITY': return 'orange';
            default: return 'blue';
        }
    };

    return (
        <div className="p-8 h-full bg-slate-50 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-3xl font-display font-bold text-slate-800 flex items-center gap-2">
                        <Icons.Shield /> Auditoria e Segurança
                    </h2>
                    <p className="text-slate-500">Registro imutável de ações críticas no sistema.</p>
                </div>
                <Button variant="outline" onClick={loadLogs}>
                    <Icons.Refresh /> Atualizar
                </Button>
            </div>

            {/* Filtros */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex gap-4 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                    <Input 
                        label="Buscar Usuário" 
                        placeholder="Nome ou ID" 
                        value={filterActor} 
                        onChange={e => setFilterActor(e.target.value)} 
                    />
                </div>
                <div className="w-48">
                    <Select label="Tipo de Ação" value={filterAction} onChange={e => setFilterAction(e.target.value)}>
                        <option value="">Todas</option>
                        <option value="LOGIN">Acesso (Login)</option>
                        <option value="DELETE">Exclusão</option>
                        <option value="UPDATE">Alteração</option>
                        <option value="CREATE">Criação</option>
                        <option value="SECURITY">Segurança</option>
                    </Select>
                </div>
                <div className="w-48">
                    <Input 
                        label="Data" 
                        type="date" 
                        value={filterDate} 
                        onChange={e => setFilterDate(e.target.value)} 
                    />
                </div>
            </div>

            {/* Tabela de Logs */}
            <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs">
                            <tr>
                                <th className="p-4 w-40">Data/Hora</th>
                                <th className="p-4 w-48">Usuário</th>
                                <th className="p-4 w-24">Ação</th>
                                <th className="p-4 w-32">Recurso</th>
                                <th className="p-4">Detalhes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredLogs.length === 0 && (
                                <tr><td colSpan={5} className="p-8 text-center text-slate-400">Nenhum registro encontrado.</td></tr>
                            )}
                            {filteredLogs.map(log => (
                                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 text-slate-500 font-mono text-xs">
                                        {new Date(log.timestamp).toLocaleString()}
                                    </td>
                                    <td className="p-4">
                                        <div className="font-bold text-slate-800">{log.actorName}</div>
                                        <div className="text-xs text-slate-400">{log.actorRole}</div>
                                    </td>
                                    <td className="p-4">
                                        <Badge color={getActionBadgeColor(log.action) as any}>{log.action}</Badge>
                                    </td>
                                    <td className="p-4 text-slate-600 font-medium">
                                        {log.targetResource}
                                    </td>
                                    <td className="p-4">
                                        <p className="text-slate-800">{log.details}</p>
                                        {log.metadata && (
                                            <details className="mt-1 text-xs text-slate-500 cursor-pointer">
                                                <summary>Ver metadados</summary>
                                                <pre className="bg-slate-100 p-2 rounded mt-1 overflow-x-auto">
                                                    {JSON.stringify(log.metadata, null, 2)}
                                                </pre>
                                            </details>
                                        )}
                                        {log.targetId && (
                                            <span className="text-[10px] text-slate-400 font-mono block mt-1">ID: {log.targetId}</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default AuditLogsPage;
