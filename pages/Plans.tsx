
import React from 'react';
import { Card, Button, Badge } from '../components/UI';
import { Icons } from '../components/Icons';

const PlansPage = () => {
    return (
        <div className="p-8 h-full bg-slate-50 overflow-y-auto custom-scrollbar">
            <div className="mb-8">
                <h2 className="text-3xl font-display font-bold text-slate-800">Planos e Assinaturas</h2>
                <p className="text-slate-500">Gerencie os pacotes disponíveis na plataforma.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-t-4 border-t-slate-300">
                    <div className="mb-4">
                        <h3 className="text-xl font-bold text-slate-800">Básico</h3>
                        <p className="text-slate-500 text-sm">Para professores individuais.</p>
                    </div>
                    <div className="text-3xl font-bold text-slate-800 mb-6">Grátis</div>
                    <ul className="space-y-3 mb-8 text-sm text-slate-600">
                        <li className="flex gap-2"><Icons.Check /> Até 50 questões</li>
                        <li className="flex gap-2"><Icons.Check /> 3 Turmas</li>
                        <li className="flex gap-2"><Icons.Check /> Provas em PDF</li>
                    </ul>
                    <Button variant="outline" className="w-full">Editar Detalhes</Button>
                </Card>

                <Card className="border-t-4 border-t-brand-blue shadow-lg relative transform scale-105">
                    <div className="absolute top-0 right-0 bg-brand-blue text-white text-xs font-bold px-2 py-1 rounded-bl">Popular</div>
                    <div className="mb-4">
                        <h3 className="text-xl font-bold text-brand-blue">Premium</h3>
                        <p className="text-slate-500 text-sm">Recursos ilimitados.</p>
                    </div>
                    <div className="text-3xl font-bold text-slate-800 mb-6">R$ 29,90<span className="text-sm font-normal text-slate-400">/mês</span></div>
                    <ul className="space-y-3 mb-8 text-sm text-slate-600">
                        <li className="flex gap-2"><Icons.Check /> Questões Ilimitadas</li>
                        <li className="flex gap-2"><Icons.Check /> Turmas Ilimitadas</li>
                        <li className="flex gap-2"><Icons.Check /> IA Generativa (50/mês)</li>
                        <li className="flex gap-2"><Icons.Check /> Importação de PDF</li>
                    </ul>
                    <Button className="w-full">Editar Detalhes</Button>
                </Card>

                <Card className="border-t-4 border-t-purple-500">
                    <div className="mb-4">
                        <h3 className="text-xl font-bold text-purple-600">Escola</h3>
                        <p className="text-slate-500 text-sm">Para instituições inteiras.</p>
                    </div>
                    <div className="text-3xl font-bold text-slate-800 mb-6">Sob Consulta</div>
                    <ul className="space-y-3 mb-8 text-sm text-slate-600">
                        <li className="flex gap-2"><Icons.Check /> Múltiplos Professores</li>
                        <li className="flex gap-2"><Icons.Check /> Painel Administrativo</li>
                        <li className="flex gap-2"><Icons.Check /> Banco de Questões Unificado</li>
                        <li className="flex gap-2"><Icons.Check /> Suporte Dedicado</li>
                    </ul>
                    <Button variant="outline" className="w-full">Editar Detalhes</Button>
                </Card>
            </div>
        </div>
    );
};

export default PlansPage;
