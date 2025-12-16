
import React, { useState, useEffect } from 'react';
import { SystemSettings, UserRole } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { Button, Card, Badge, Input, Select } from '../components/UI';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

const SystemSettingsPage = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [activeTab, setActiveTab] = useState<'BANNER' | 'AI' | 'WHITELABEL'>('BANNER');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (user?.role === UserRole.ADMIN) {
            loadSettings();
        } else {
            setLoading(false);
        }
    }, [user]);

    const loadSettings = async () => {
        try {
            const data = await FirebaseService.getSystemSettings();
            setSettings(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!settings) return;
        setSaving(true);
        try {
            await FirebaseService.saveSystemSettings(settings);
            alert("Configurações salvas com sucesso! As alterações globais podem levar alguns segundos para propagar.");
        } catch (error) {
            alert("Erro ao salvar configurações.");
        } finally {
            setSaving(false);
        }
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && settings) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setSettings({
                    ...settings,
                    whiteLabel: { ...settings.whiteLabel, logoUrl: reader.result as string }
                });
            };
            reader.readAsDataURL(file);
        }
    };

    if (user?.role !== UserRole.ADMIN) {
        return <Navigate to="/" />;
    }

    if (loading || !settings) return <div className="p-8 text-center text-slate-500">Carregando configurações...</div>;

    return (
        <div className="p-8 h-full bg-slate-50 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-3xl font-display font-bold text-slate-800 flex items-center gap-2">
                        <Icons.Magic /> Configurações do Sistema
                    </h2>
                    <p className="text-slate-500">Controle global de variáveis, avisos e monitoramento.</p>
                </div>
                <Button onClick={handleSave} disabled={saving} className="shadow-lg shadow-blue-200">
                    {saving ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
            </div>

            {/* Abas */}
            <div className="flex gap-4 border-b border-slate-200 mb-6">
                <button 
                    className={`pb-2 px-4 font-bold text-sm transition-colors flex items-center gap-2 ${activeTab === 'BANNER' ? 'border-b-2 border-brand-blue text-brand-blue' : 'text-slate-500 hover:text-slate-700'}`}
                    onClick={() => setActiveTab('BANNER')}
                >
                    <Icons.Megaphone /> Banner de Aviso
                </button>
                <button 
                    className={`pb-2 px-4 font-bold text-sm transition-colors flex items-center gap-2 ${activeTab === 'AI' ? 'border-b-2 border-brand-blue text-brand-blue' : 'text-slate-500 hover:text-slate-700'}`}
                    onClick={() => setActiveTab('AI')}
                >
                    <Icons.Sparkles /> Monitoramento IA
                </button>
                <button 
                    className={`pb-2 px-4 font-bold text-sm transition-colors flex items-center gap-2 ${activeTab === 'WHITELABEL' ? 'border-b-2 border-brand-blue text-brand-blue' : 'text-slate-500 hover:text-slate-700'}`}
                    onClick={() => setActiveTab('WHITELABEL')}
                >
                    <Icons.Building /> White Label
                </button>
            </div>

            {/* CONTEÚDO DAS ABAS */}
            <div className="max-w-4xl mx-auto">
                {activeTab === 'BANNER' && (
                    <Card className="animate-fade-in space-y-6">
                        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 text-sm text-yellow-800">
                            <strong>Atenção:</strong> O banner ativado aparecerá no topo da tela de <strong>todos</strong> os usuários logados. Use para manutenções ou avisos urgentes.
                        </div>

                        <div className="flex items-center justify-between border p-4 rounded-lg bg-slate-50">
                            <div>
                                <h4 className="font-bold text-slate-800">Status do Banner</h4>
                                <p className="text-xs text-slate-500">Se ativo, será visível imediatamente.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold ${settings.banner.active ? 'text-green-600' : 'text-slate-400'}`}>
                                    {settings.banner.active ? 'ATIVADO' : 'DESATIVADO'}
                                </span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" checked={settings.banner.active} onChange={e => setSettings({ ...settings, banner: { ...settings.banner, active: e.target.checked } })} />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-2">
                                <Input 
                                    label="Mensagem do Banner" 
                                    value={settings.banner.message} 
                                    onChange={e => setSettings({ ...settings, banner: { ...settings.banner, message: e.target.value } })} 
                                    placeholder="Ex: Manutenção programada para as 22h."
                                />
                            </div>
                            <div>
                                <Select 
                                    label="Tipo de Alerta" 
                                    value={settings.banner.type} 
                                    onChange={e => setSettings({ ...settings, banner: { ...settings.banner, type: e.target.value as any } })}
                                >
                                    <option value="INFO">Informação (Azul)</option>
                                    <option value="WARNING">Aviso (Amarelo)</option>
                                    <option value="ERROR">Crítico (Vermelho)</option>
                                </Select>
                            </div>
                        </div>

                        {/* Preview */}
                        <div className="border-t pt-4 mt-4">
                            <p className="text-xs font-bold text-slate-400 uppercase mb-2">Pré-visualização</p>
                            <div className={`p-3 rounded text-center text-sm font-bold flex items-center justify-center gap-2 ${
                                settings.banner.type === 'ERROR' ? 'bg-red-600 text-white' : 
                                settings.banner.type === 'WARNING' ? 'bg-yellow-400 text-yellow-900' : 
                                'bg-blue-600 text-white'
                            }`}>
                                <Icons.Megaphone /> {settings.banner.message || 'Sua mensagem aqui...'}
                            </div>
                        </div>
                    </Card>
                )}

                {activeTab === 'AI' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <Card className="border-l-4 border-purple-500">
                                <p className="text-xs font-bold text-slate-500 uppercase">Requisições Totais</p>
                                <p className="text-3xl font-bold text-slate-800 mt-1">{settings.aiConfig.totalGenerations}</p>
                                <p className="text-xs text-purple-600 mt-2">Acumulado Vitalício</p>
                            </Card>
                            <Card className="border-l-4 border-green-500">
                                <p className="text-xs font-bold text-slate-500 uppercase">Custo Estimado</p>
                                <p className="text-3xl font-bold text-slate-800 mt-1">
                                    $ {(settings.aiConfig.totalGenerations * settings.aiConfig.costPerRequestEst).toFixed(2)}
                                </p>
                                <p className="text-xs text-green-600 mt-2">Baseado em ${settings.aiConfig.costPerRequestEst}/req</p>
                            </Card>
                            <Card className="border-l-4 border-blue-500">
                                <p className="text-xs font-bold text-slate-500 uppercase">Status</p>
                                <p className="text-xl font-bold text-slate-800 mt-2">
                                    {settings.aiConfig.totalGenerations > settings.aiConfig.monthlyLimit ? 'LIMITE EXCEDIDO' : 'NORMAL'}
                                </p>
                                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3">
                                    <div 
                                        className={`h-1.5 rounded-full ${settings.aiConfig.totalGenerations > settings.aiConfig.monthlyLimit ? 'bg-red-500' : 'bg-blue-500'}`} 
                                        style={{ width: `${Math.min((settings.aiConfig.totalGenerations / settings.aiConfig.monthlyLimit) * 100, 100)}%` }}
                                    ></div>
                                </div>
                            </Card>
                        </div>

                        <Card title="Configuração de Custos">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input 
                                    label="Limite Mensal (Alerta)" 
                                    type="number"
                                    value={settings.aiConfig.monthlyLimit} 
                                    onChange={e => setSettings({ ...settings, aiConfig: { ...settings.aiConfig, monthlyLimit: Number(e.target.value) } })}
                                    placeholder="Ex: 1000"
                                />
                                <Input 
                                    label="Custo Médio por Req. (USD)" 
                                    type="number"
                                    step="0.0001"
                                    value={settings.aiConfig.costPerRequestEst} 
                                    onChange={e => setSettings({ ...settings, aiConfig: { ...settings.aiConfig, costPerRequestEst: Number(e.target.value) } })}
                                    placeholder="Ex: 0.0015"
                                />
                            </div>
                            <p className="text-xs text-slate-500 mt-4">
                                * O custo é apenas uma estimativa baseada no contador de chamadas. Consulte o console do Google Cloud para faturamento real.
                            </p>
                        </Card>
                    </div>
                )}

                {activeTab === 'WHITELABEL' && (
                    <Card className="animate-fade-in space-y-6">
                        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-sm text-blue-900">
                            <strong>White Label (Enterprise):</strong> Personalize a aparência do sistema para grandes clientes. 
                            As alterações aqui afetam o nome do app, a URL da logo na barra lateral e o favicon.
                        </div>

                        <Input 
                            label="Nome da Aplicação" 
                            value={settings.whiteLabel.appName} 
                            onChange={e => setSettings({ ...settings, whiteLabel: { ...settings.whiteLabel, appName: e.target.value } })} 
                            placeholder="Ex: Escola Futuro System"
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-semibold text-slate-700">Logotipo (PNG/SVG Transparente)</label>
                                <div className="flex items-center gap-4">
                                    {settings.whiteLabel.logoUrl ? (
                                        <div className="w-12 h-12 border border-slate-200 rounded-lg p-1 flex items-center justify-center bg-white shadow-sm shrink-0">
                                            <img src={settings.whiteLabel.logoUrl} className="max-w-full max-h-full" alt="Preview" />
                                        </div>
                                    ) : (
                                        <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 shrink-0">
                                            <Icons.Building />
                                        </div>
                                    )}
                                    <div className="flex-1">
                                        <input 
                                            type="file" 
                                            accept="image/*" 
                                            onChange={handleLogoUpload}
                                            className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                                        />
                                        <div className="mt-2 text-xs">
                                            <span className="text-slate-400">Ou use URL: </span>
                                            <input 
                                                type="text"
                                                className="border-b border-slate-300 outline-none w-full bg-transparent focus:border-brand-blue"
                                                value={settings.whiteLabel.logoUrl || ''}
                                                onChange={e => setSettings({ ...settings, whiteLabel: { ...settings.whiteLabel, logoUrl: e.target.value } })}
                                                placeholder="https://..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                    <Input 
                                        label="Cor Primária (Hex)" 
                                        value={settings.whiteLabel.primaryColor || '#3A72EC'} 
                                        onChange={e => setSettings({ ...settings, whiteLabel: { ...settings.whiteLabel, primaryColor: e.target.value } })} 
                                        placeholder="#3A72EC"
                                    />
                                </div>
                                <div 
                                    className="w-10 h-10 rounded border border-slate-200 mb-1" 
                                    style={{ backgroundColor: settings.whiteLabel.primaryColor || '#3A72EC' }}
                                ></div>
                            </div>
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
};

export default SystemSettingsPage;
