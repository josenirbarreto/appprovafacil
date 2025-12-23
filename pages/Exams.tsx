
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Exam, Institution, SchoolClass, Question, ExamContentScope, CurricularComponent, UserRole, QuestionType, ExamAttempt } from '../types';
import { FirebaseService } from '../services/firebaseService';
import { GoogleGenAI, Type } from "@google/genai";
import { Button, Modal, Select, Input, Badge, Card, RichTextEditor } from '../components/UI';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';

const ExamsPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    // Dados base
    const [exams, setExams] = useState<Exam[]>([]);
    const [institutions, setInstitutions] = useState<Institution[]>([]);
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [hierarchy, setHierarchy] = useState<CurricularComponent[]>([]);
    const [allQuestions, setAllQuestions] = useState<Question[]>([]);
    
    // UI States
    const [loading, setLoading] = useState(true);
    const [expandedInstitutions, setExpandedInstitutions] = useState<Record<string, boolean>>({});

    // Scanner States
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scannedExam, setScannedExam] = useState<Exam | null>(null);
    const [scanLoading, setScanLoading] = useState(false);
    const [scanResult, setScanResult] = useState<any>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Modal/Wizard States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Partial<Exam>>({ 
        questions: [], 
        title: '', 
        columns: 1, 
        showAnswerKey: false, 
        instructions: '',
        contentScopes: []
    });
    const [currentStep, setCurrentStep] = useState(1);
    
    // Estados de Impressão e Versões
    const [printFontSize, setPrintFontSize] = useState('text-sm');
    const [headerFields, setHeaderFields] = useState({ nome: true, data: true, turma: true, nota: true, valor: true });
    const [activeVersion, setActiveVersion] = useState('A');
    const [examVersions, setExamVersions] = useState<Record<string, Question[]>>({ 'A': [] });
    const [viewingMode, setViewingMode] = useState<'EXAM' | 'ANSWER_CARD'>('EXAM');

    useEffect(() => { if (user) load(); }, [user]);

    const load = async () => {
        setLoading(true);
        try {
            const [e, i, c, h, q] = await Promise.all([
                FirebaseService.getExams(user),
                FirebaseService.getInstitutions(user),
                FirebaseService.getClasses(user),
                FirebaseService.getHierarchy(),
                FirebaseService.getQuestions(user)
            ]);
            setExams(Array.isArray(e) ? e : []); 
            setInstitutions(Array.isArray(i) ? i.sort((a,b) => (a.name || '').localeCompare(b.name || '')) : []); 
            setClasses(Array.isArray(c) ? c : []); 
            setHierarchy(Array.isArray(h) ? h : []); 
            setAllQuestions(Array.isArray(q) ? q : []);
        } catch (err) {
            console.error("Erro ao carregar exames:", err);
        } finally {
            setLoading(false);
        }
    };

    // --- LÓGICA DO SCANNER ---
    const startScanner = async (exam: Exam) => {
        setScannedExam(exam);
        setIsScannerOpen(true);
        setScanResult(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
            }
        } catch (err) {
            alert("Não foi possível acessar a câmera. Verifique as permissões.");
            setIsScannerOpen(false);
        }
    };

    const stopScanner = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
        }
        setIsScannerOpen(false);
    };

    const captureAndAnalyze = async () => {
        if (!videoRef.current || !canvasRef.current || !scannedExam) return;
        setScanLoading(true);

        const canvas = canvasRef.current;
        const video = videoRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0);

        const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
        
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `Analise este cartão-resposta de prova. 
            1. Extraia o nome do aluno escrito à mão no topo.
            2. Identifique qual opção (A, B, C, D, E) está preenchida para cada questão de 1 a ${scannedExam.questions?.length || 10}.
            3. A bolinha mais escura ou marcada com X é a resposta escolhida.
            4. Retorne um JSON estrito.`;

            const schema = {
                type: Type.OBJECT,
                properties: {
                    studentName: { type: Type.STRING },
                    answers: {
                        type: Type.OBJECT,
                        additionalProperties: { type: Type.STRING }
                    }
                },
                required: ["studentName", "answers"]
            };

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: [
                    { text: prompt },
                    { inlineData: { data: base64Image, mimeType: 'image/jpeg' } }
                ],
                config: { responseMimeType: "application/json", responseSchema: schema }
            });

            if (!response.text) throw new Error("IA não retornou texto");
            const data = JSON.parse(response.text);
            
            let score = 0;
            const detailedResults = (scannedExam.questions || []).map((q, idx) => {
                const qNum = (idx + 1).toString();
                const studentAns = data.answers[qNum] || '';
                const correctOpt = q.options?.find(o => o.isCorrect);
                const correctLetter = q.options ? String.fromCharCode(65 + q.options.indexOf(correctOpt!)) : '?';
                
                const isCorrect = studentAns.toUpperCase() === correctLetter.toUpperCase();
                if (isCorrect) score++;

                return {
                    num: qNum,
                    studentAns,
                    correctAns: correctLetter,
                    isCorrect
                };
            });

            setScanResult({
                studentName: data.studentName || 'Não identificado',
                score,
                total: scannedExam.questions?.length || 0,
                details: detailedResults
            });

        } catch (err) {
            console.error(err);
            alert("Erro no processamento visual. Certifique-se que o papel está bem iluminado e plano.");
        } finally {
            setScanLoading(false);
        }
    };

    const confirmScan = async () => {
        if (!scanResult || !scannedExam) return;
        try {
            const attempt: Partial<ExamAttempt> = {
                examId: scannedExam.id,
                studentName: scanResult.studentName,
                totalQuestions: scanResult.total,
                score: scanResult.score,
                status: 'COMPLETED',
                submittedAt: new Date().toISOString(),
                answers: scanResult.details.reduce((acc: any, curr: any) => {
                    acc[curr.num] = curr.studentAns;
                    return acc;
                }, {})
            };
            await FirebaseService.saveExam(attempt); 
            alert("Correção salva com sucesso!");
            stopScanner();
            navigate('/exam-results', { state: { examId: scannedExam.id } });
        } catch (e) {
            alert("Erro ao persistir nota.");
        }
    };

    // --- HELPERS ---
    const authorizedHierarchy = useMemo(() => {
        const full = Array.isArray(hierarchy) ? hierarchy : [];
        if (!user || user.role === UserRole.ADMIN) return full;
        const authIds = [...(user.subjects || []), ...(user.accessGrants || [])];
        return full.filter(cc => authIds.includes(cc.id));
    }, [hierarchy, user]);

    const selectedInstitution = useMemo(() => institutions.find(i => i.id === editing.institutionId), [institutions, editing.institutionId]);

    const currentQs = useMemo(() => {
        const versionQs = examVersions[activeVersion];
        if (versionQs && versionQs.length > 0) return versionQs;
        return Array.isArray(editing.questions) ? editing.questions : [];
    }, [examVersions, activeVersion, editing.questions]);

    const generateVersions = (count: number, baseQs?: Question[]) => {
        const source = baseQs || (Array.isArray(editing.questions) ? editing.questions : []);
        const versions: Record<string, Question[]> = {};
        for (let i = 0; i < count; i++) {
            const vLetter = String.fromCharCode(65 + i);
            // Embaralha questões para cada versão
            const shuffled = [...source].sort(() => 0.5 - Math.random());
            versions[vLetter] = shuffled;
        }
        setExamVersions(versions);
        setActiveVersion('A');
    };

    const handleAutoGenerate = () => {
        const scope = editing.contentScopes?.[0];
        if (!scope || !scope.componentId) {
            alert("Selecione uma área e defina o escopo no passo anterior.");
            return;
        }

        const pool = allQuestions.filter(q => q.componentId === scope.componentId);
        if (pool.length === 0) {
            alert("Não há questões suficientes no banco para esta área.");
            return;
        }

        const count = Math.min(scope.questionCount || 10, pool.length);
        const selected = [...pool].sort(() => 0.5 - Math.random()).slice(0, count);

        setEditing(prev => ({ ...prev, questions: selected }));
        generateVersions(1, selected);
        setCurrentStep(4);
    };

    const handleSaveExam = async () => {
        try {
            const payload = { 
                ...editing, 
                authorId: user?.id, 
                institutionId: editing.institutionId || user?.institutionId, 
                createdAt: editing.createdAt || new Date().toISOString() 
            };
            await FirebaseService.saveExam(payload);
            setIsModalOpen(false);
            load();
        } catch (e) { 
            alert("Erro ao salvar prova no banco."); 
        }
    };

    // --- RENDERIZADORES ---
    const renderHeaderPrint = (titleSuffix: string = '') => (
        <div className="border-2 border-black p-4 mb-4 break-inside-avoid bg-white block relative">
            <div className="vision-anchor top-0 left-0 no-print hidden print:block"></div>
            <div className="vision-anchor top-0 right-0 no-print hidden print:block"></div>
            <div className="flex items-center gap-4 mb-4 pb-4 border-b border-black/10">
                {selectedInstitution?.logoUrl && (
                    <img src={selectedInstitution.logoUrl} alt="Logo" className="h-10 w-auto object-contain shrink-0" />
                )}
                <div className="flex-1">
                    <h1 className="font-black text-base uppercase leading-tight">{selectedInstitution?.name || 'INSTITUIÇÃO DE ENSINO'}</h1>
                    <h2 className="font-bold text-xs uppercase text-slate-600">{editing.title || 'AVALIAÇÃO'} {titleSuffix}</h2>
                </div>
                <div className="text-right">
                    <div className="text-[10px] font-black border border-black px-2 py-0.5 rounded">VERSÃO: {activeVersion}</div>
                    <div className="text-[7px] font-mono mt-1 opacity-50 uppercase tracking-tighter">PROVA ID: {editing.id?.slice(0,8) || 'NOVA'}</div>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-y-3 gap-x-8">
                {headerFields.nome && <div className="border-b border-black pb-0.5 font-bold text-xs h-6 flex items-end">ALUNO:</div>}
                {headerFields.data && <div className="border-b border-black pb-0.5 font-bold text-xs h-6 flex items-end">DATA: ____/____/____</div>}
                {headerFields.turma && <div className="border-b border-black pb-0.5 font-bold text-xs h-6 flex items-end">TURMA:</div>}
                <div className="flex gap-4">
                    {headerFields.nota && <div className="flex-1 border-b border-black pb-0.5 font-bold text-xs h-6 flex items-end">NOTA:</div>}
                    {headerFields.valor && <div className="flex-1 border-b border-black pb-0.5 font-bold text-xs h-6 flex items-end">VALOR: 10,0</div>}
                </div>
            </div>
        </div>
    );

    const renderStepContent = () => {
        switch(currentStep) {
            case 1: return (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <Input label="Título da Avaliação" value={editing.title || ''} onChange={e => setEditing({...editing, title: e.target.value})} placeholder="Ex: P1 - Matemática Aplicada" />
                            <div className="grid grid-cols-2 gap-4">
                                <Select label="Instituição" value={editing.institutionId || ''} onChange={e => setEditing({...editing, institutionId: e.target.value, classId: ''})}>
                                    <option value="">Selecione...</option>
                                    {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                </Select>
                                <Select label="Turma" value={editing.classId || ''} onChange={e => setEditing({...editing, classId: e.target.value})} disabled={!editing.institutionId}>
                                    <option value="">Geral</option>
                                    {classes.filter(c => c.institutionId === editing.institutionId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </Select>
                            </div>
                        </div>
                        <div className="bg-slate-50 p-6 rounded-3xl border-2 border-slate-100 space-y-4">
                            <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest">Opções de Layout</h4>
                            <div className="flex gap-4">
                                <button onClick={() => setEditing({...editing, columns: 1})} className={`flex-1 p-3 rounded-xl border-2 transition-all ${editing.columns === 1 ? 'border-brand-blue bg-white shadow-md' : 'border-transparent opacity-60'}`}>
                                    <div className="h-10 w-full bg-slate-200 rounded mb-2"></div>
                                    <span className="text-[10px] font-black uppercase">1 Coluna</span>
                                </button>
                                <button onClick={() => setEditing({...editing, columns: 2})} className={`flex-1 p-3 rounded-xl border-2 transition-all ${editing.columns === 2 ? 'border-brand-blue bg-white shadow-md' : 'border-transparent opacity-60'}`}>
                                    <div className="h-10 w-full flex gap-1"><div className="flex-1 bg-slate-200 rounded"></div><div className="flex-1 bg-slate-200 rounded"></div></div>
                                    <span className="text-[10px] font-black uppercase mt-2 block">2 Colunas</span>
                                </button>
                            </div>
                            <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-white rounded-xl transition-colors">
                                <input type="checkbox" checked={editing.showAnswerKey} onChange={e => setEditing({...editing, showAnswerKey: e.target.checked})} className="w-5 h-5 rounded text-brand-blue" />
                                <span className="text-sm font-bold text-slate-700">Incluir Folha de Gabarito</span>
                            </label>
                        </div>
                    </div>
                    <RichTextEditor label="Instruções Gerais" value={editing.instructions || ''} onChange={html => setEditing({...editing, instructions: html})} />
                </div>
            );
            case 2: return (
                <div className="space-y-6">
                    <div className="bg-blue-600 p-8 rounded-[40px] text-white shadow-xl">
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <Select label="Área de Conhecimento" value={editing.contentScopes?.[0]?.componentId || ''} onChange={e => setEditing({...editing, contentScopes: [{ componentId: e.target.value, questionCount: 10, componentName: 'Selecionado' } as any]})} className="!bg-blue-700 !border-blue-500 !text-white">
                                <option value="">Selecione...</option>
                                {authorizedHierarchy.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
                            </Select>
                            <Input label="Quantidade de Itens" type="number" min="1" value={editing.contentScopes?.[0]?.questionCount || 10} onChange={e => {
                                const scopes = [...(editing.contentScopes || [])];
                                if(scopes[0]) scopes[0].questionCount = Number(e.target.value);
                                setEditing({...editing, contentScopes: scopes});
                            }} className="!bg-blue-700 !border-blue-500 !text-white" />
                         </div>
                    </div>
                    <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-3xl">
                        <p className="text-slate-400 font-bold italic">O sistema sorteará questões aleatórias do banco baseadas na área escolhida.</p>
                    </div>
                </div>
            );
            case 3: return (
                <div className="text-center py-20 flex flex-col items-center">
                    <div className="w-20 h-20 bg-blue-50 text-brand-blue rounded-full flex items-center justify-center mb-6 shadow-inner"><Icons.Sparkles className="w-10 h-10" /></div>
                    <h3 className="text-2xl font-black mb-2">Motor de Geração Ativo</h3>
                    <p className="text-slate-500 mb-8 max-w-sm">Clique abaixo para sortear os itens e preparar a impressão.</p>
                    <Button onClick={handleAutoGenerate} className="h-16 px-12 text-xl shadow-2xl font-black">Sortear Agora</Button>
                </div>
            );
            case 4: return (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
                    <div className="lg:col-span-1 space-y-6 bg-slate-50 p-6 rounded-3xl border no-print">
                        <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest">Ajustes Finais</h4>
                        <Select label="Tamanho do Texto" value={printFontSize} onChange={e => setPrintFontSize(e.target.value)}>
                            <option value="text-[10px]">Econômica (Pequena)</option>
                            <option value="text-sm">Confortável (Padrão)</option>
                            <option value="text-base">Acessibilidade (Grande)</option>
                        </Select>
                        <div className="flex bg-white rounded-xl p-1 border">
                            <button onClick={() => setViewingMode('EXAM')} className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${viewingMode === 'EXAM' ? 'bg-brand-blue text-white shadow-md' : 'text-slate-400'}`}>CADERNO</button>
                            <button onClick={() => setViewingMode('ANSWER_CARD')} className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${viewingMode === 'ANSWER_CARD' ? 'bg-brand-blue text-white shadow-md' : 'text-slate-400'}`}>CARTÃO</button>
                        </div>
                        <Button onClick={() => window.print()} className="w-full h-14 bg-slate-900 text-white shadow-xl mt-4 no-print"><Icons.Printer /> Imprimir Documento</Button>
                    </div>

                    <div className="lg:col-span-2 bg-white rounded-2xl p-4 border overflow-y-auto custom-scrollbar print:p-0 print:border-none print:overflow-visible">
                        <div id="exam-print-container" className={`${printFontSize} text-black bg-white w-full print:block print:static relative`}>
                            {viewingMode === 'EXAM' ? (
                                <div className="animate-fade-in bg-white w-full block">
                                    {renderHeaderPrint()}
                                    {editing.instructions && (
                                        <div className="mb-6 p-4 border-l-4 border-black bg-slate-50 italic rich-text-content break-inside-avoid" dangerouslySetInnerHTML={{__html: editing.instructions}} />
                                    )}
                                    <div className={`${editing.columns === 2 ? 'preview-columns-2 print-columns-2' : 'w-full block'}`}>
                                        {(currentQs || []).filter(Boolean).map((q, idx) => (
                                            <div key={idx} className="break-inside-avoid bg-white block mb-8">
                                                <div className="flex gap-2 font-bold mb-2">
                                                    <span>{idx + 1}.</span>
                                                    <div className="flex-1 rich-text-content" dangerouslySetInnerHTML={{__html: q.enunciado}} />
                                                </div>
                                                <div className="mt-2 ml-6 space-y-2 block">
                                                    {(q.options || []).map((opt, i) => (
                                                        <div key={i} className="flex gap-3 py-1 items-start">
                                                            <span className="w-5 h-5 border-2 border-black rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">{String.fromCharCode(65+i)}</span>
                                                            <span className="text-sm leading-tight">{opt.text}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="animate-fade-in bg-white w-full block relative min-h-[297mm]">
                                    <div className="vision-anchor top-0 left-0 no-print hidden print:block"></div>
                                    <div className="vision-anchor top-0 right-0 no-print hidden print:block"></div>
                                    <div className="vision-anchor bottom-0 left-0 no-print hidden print:block"></div>
                                    <div className="vision-anchor bottom-0 right-0 no-print hidden print:block"></div>

                                    {renderHeaderPrint('(CARTÃO-RESPOSTA)')}
                                    <div className="mt-12 grid grid-cols-2 gap-x-16 gap-y-6 bg-white print:block">
                                        {(currentQs || []).filter(Boolean).map((_, idx) => (
                                            <div key={`card-${idx}`} className="flex items-center gap-6 border-b border-black/10 pb-4 break-inside-avoid bg-white mb-4">
                                                <span className="font-black text-slate-400 w-8 text-xl">{idx + 1}</span>
                                                <div className="flex gap-3">
                                                    {['A', 'B', 'C', 'D', 'E'].map(letter => (
                                                        <div key={letter} className="answer-bubble bg-white">{letter}</div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-20 pt-10 text-center opacity-20 text-[10px] uppercase font-black tracking-[0.8em] border-t border-dashed border-black/20">
                                        Sistema de Correção Prova Fácil
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
            default: return null;
        }
    };

    return (
        <div className="p-8 h-full flex flex-col bg-slate-50 overflow-y-auto custom-scrollbar print:block print:p-0 print:bg-white print:overflow-visible">
            <div className="flex justify-between items-center mb-8 no-print shrink-0">
                <div>
                    <h2 className="text-3xl font-display font-bold text-slate-800 tracking-tight">Avaliações Impressas</h2>
                    <p className="text-slate-500 mt-1">Gerencie provas, imprima cartões e realize correções automáticas.</p>
                </div>
                <Button onClick={() => { 
                    setEditing({ title: '', questions: [], columns: 1, showAnswerKey: false, instructions: '', contentScopes: [] }); 
                    setExamVersions({ 'A': [] });
                    setCurrentStep(1); 
                    setIsModalOpen(true); 
                }} className="h-12 px-6 shadow-lg">
                    <Icons.Plus /> Criar Avaliação
                </Button>
            </div>

            {loading ? (
                <div className="p-20 text-center text-slate-300 font-black animate-pulse no-print">Carregando acervo...</div>
            ) : (
                <div className="space-y-6 no-print">
                    {institutions.length === 0 && <Card className="p-10 text-center text-slate-400 italic">Cadastre uma instituição para começar a criar provas.</Card>}
                    {institutions.map(inst => {
                        const instExams = exams.filter(e => e.institutionId === inst.id);
                        if (instExams.length === 0) return null;
                        return (
                            <div key={inst.id} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden mb-6">
                                <div className="p-5 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setExpandedInstitutions(prev => ({ ...prev, [inst.id]: !prev[inst.id] }))}>
                                    <div className="flex items-center gap-4">
                                        <div className={`transform transition-transform text-slate-400 ${expandedInstitutions[inst.id] ? 'rotate-180' : ''}`}><Icons.ChevronDown /></div>
                                        <span className="font-black text-xl text-slate-800 uppercase tracking-tight">{inst.name}</span>
                                    </div>
                                    <Badge color="blue">{instExams.length} avaliações</Badge>
                                </div>
                                {expandedInstitutions[inst.id] && (
                                    <div className="bg-slate-50 p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                                        {instExams.map(exam => (
                                            <Card key={exam.id} className="hover:border-brand-blue transition-all border-2 group shadow-sm bg-white">
                                                <h4 className="font-bold text-slate-800 text-lg mb-6 line-clamp-1">{exam.title}</h4>
                                                <div className="grid grid-cols-2 gap-2 mb-6">
                                                    <div className="bg-slate-50 p-3 rounded-2xl text-center border border-slate-100">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase">Itens</p>
                                                        <p className="font-bold text-slate-700">{exam.questions?.length || 0}</p>
                                                    </div>
                                                    <div className="bg-slate-50 p-3 rounded-2xl text-center border border-slate-100">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase">Status</p>
                                                        <p className="font-bold text-emerald-600">Ativa</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button onClick={() => startScanner(exam)} className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100 text-[10px] font-black uppercase"><Icons.Camera /> Corrigir</Button>
                                                    <Button variant="outline" className="h-11 px-3 border-slate-200" onClick={() => { setEditing(exam); setCurrentStep(4); setIsModalOpen(true); }}><Icons.Printer /></Button>
                                                    <Button variant="ghost" className="h-11 px-2 text-red-400 hover:bg-red-50" onClick={() => { if(confirm('Excluir avaliação permanentemente?')) FirebaseService.deleteExam(exam.id).then(load); }}><Icons.Trash /></Button>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* SCANNER OVERLAY */}
            {isScannerOpen && (
                <div className="scanner-overlay animate-fade-in no-print">
                    <div className="flex flex-col items-center gap-6 w-full max-w-lg p-6">
                        <div className="w-full flex justify-between items-center text-white">
                            <div>
                                <h3 className="text-2xl font-black">Scanner de Notas</h3>
                                <p className="text-xs opacity-60 uppercase tracking-widest">{scannedExam?.title}</p>
                            </div>
                            <button onClick={stopScanner} className="bg-white/10 hover:bg-white/20 p-3 rounded-full transition-colors"><Icons.X /></button>
                        </div>

                        {!scanResult ? (
                            <>
                                <div className="camera-viewport shadow-2xl relative">
                                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                                    <div className="scan-frame rounded-2xl"></div>
                                    <div className="absolute top-0 left-0 w-full h-1 bg-brand-blue shadow-[0_0_20px_rgba(58,114,236,1)] animate-scan-line"></div>
                                </div>
                                
                                <div className="text-white text-center px-10">
                                    <p className="text-sm font-bold">Enquadre o Cartão-Resposta</p>
                                    <p className="text-[10px] opacity-50 mt-2 leading-relaxed uppercase tracking-tighter">Posicione o papel reto e dentro da moldura azul para leitura automática.</p>
                                </div>

                                <Button onClick={captureAndAnalyze} disabled={scanLoading} className="h-16 w-full max-w-[320px] text-lg font-black shadow-2xl shadow-blue-500/40 rounded-3xl">
                                    {scanLoading ? <span className="flex items-center gap-3 animate-pulse"><Icons.Refresh className="animate-spin" /> Processando Visão...</span> : <><Icons.Camera /> Capturar Agora</>}
                                </Button>
                            </>
                        ) : (
                            <div className="bg-white w-full rounded-[40px] p-8 shadow-2xl animate-scale-in border-4 border-emerald-500">
                                <div className="text-center mb-8">
                                    <Badge color="green" className="mb-3 px-4 py-1">LEITURA FINALIZADA</Badge>
                                    <h3 className="text-3xl font-black text-slate-800">{scanResult.studentName}</h3>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-8">
                                    <div className="bg-blue-50 p-6 rounded-[32px] text-center border border-blue-100">
                                        <p className="text-[11px] font-black text-blue-400 uppercase mb-2">Acertos</p>
                                        <p className="text-5xl font-black text-brand-blue">{scanResult.score} <span className="text-xl text-blue-300">/ {scanResult.total}</span></p>
                                    </div>
                                    <div className="bg-slate-50 p-6 rounded-[32px] text-center border border-slate-100">
                                        <p className="text-[11px] font-black text-slate-400 uppercase mb-2">Nota Final</p>
                                        <p className="text-5xl font-black text-slate-800">{((scanResult.score/scanResult.total)*10).toFixed(1)}</p>
                                    </div>
                                </div>

                                <div className="max-h-48 overflow-y-auto custom-scrollbar border-2 border-slate-50 rounded-2xl p-4 mb-8 space-y-3 bg-slate-50/30">
                                    {(scanResult.details || []).map((d: any) => (
                                        <div key={d.num} className="flex justify-between items-center text-xs font-bold border-b border-white pb-2 last:border-0">
                                            <span className="text-slate-400 bg-white px-2 py-0.5 rounded shadow-sm">ITEM {d.num}</span>
                                            <div className="flex gap-6 items-center">
                                                <span className="text-slate-500">LIDO: <span className="text-slate-900 font-black">{d.studentAns || 'N/A'}</span></span>
                                                <span className={d.isCorrect ? 'text-emerald-600' : 'text-red-500'}>
                                                    {d.isCorrect ? '✓ OK' : `GAB: ${d.correctAns}`}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex gap-4">
                                    <Button variant="outline" className="flex-1 rounded-2xl h-12" onClick={() => setScanResult(null)}>Tentar Denovo</Button>
                                    <Button className="flex-1 rounded-2xl h-12 shadow-lg" onClick={confirmScan}>Salvar Nota</Button>
                                </div>
                            </div>
                        )}
                        
                        <canvas ref={canvasRef} className="hidden" />
                    </div>
                </div>
            )}

            {/* MODAL DO WIZARD */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing.id ? "Configurações da Avaliação" : "Criar Nova Prova"} maxWidth="max-w-7xl" footer={
                <div className="flex justify-between w-full items-center no-print">
                    {currentStep > 1 && <Button variant="ghost" onClick={() => setCurrentStep(currentStep - 1)} className="font-black uppercase text-xs"><Icons.ArrowLeft /> Anterior</Button>}
                    <div className="flex gap-2 ml-auto">
                        {currentStep < 4 ? <Button onClick={() => setCurrentStep(currentStep + 1)} disabled={currentStep === 1 && !editing.title} className="px-10 h-12 font-black">Próximo Passo <Icons.ArrowRight /></Button> : <Button onClick={handleSaveExam} className="px-12 h-12 shadow-xl shadow-blue-200 font-black">FINALIZAR E SALVAR</Button>}
                    </div>
                </div>
            }>
                <div className="flex items-center justify-between mb-12 px-20 no-print">
                    {[1, 2, 3, 4].map(s => (
                        <React.Fragment key={s}>
                            <div className="flex flex-col items-center gap-3">
                                <div className={`w-14 h-14 rounded-full flex items-center justify-center font-black transition-all duration-500 ${currentStep >= s ? 'bg-brand-blue text-white shadow-xl shadow-blue-200 scale-110' : 'bg-slate-100 text-slate-400'}`}>{s}</div>
                                <span className={`text-[10px] font-black uppercase tracking-widest ${currentStep >= s ? 'text-brand-blue' : 'text-slate-300'}`}>
                                    {s === 1 ? 'Config' : s === 2 ? 'Filtros' : s === 3 ? 'Motor' : 'Arquivo'}
                                </span>
                            </div>
                            {s < 4 && <div className={`flex-1 h-1 mx-6 rounded-full transition-colors duration-500 ${currentStep > s ? 'bg-brand-blue' : 'bg-slate-100'}`}></div>}
                        </React.Fragment>
                    ))}
                </div>
                <div className="animate-fade-in min-h-[450px] no-print">{renderStepContent()}</div>
                <div className="hidden print:block">{currentStep === 4 && renderStepContent()}</div>
            </Modal>
        </div>
    );
};

export default ExamsPage;
