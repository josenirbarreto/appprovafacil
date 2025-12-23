
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

    // Dados
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
        instructions: '' 
    });
    const [currentStep, setCurrentStep] = useState(1);
    const [selectionMode, setSelectionMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
    
    // Estados de Impressão
    const [printFontSize, setPrintFontSize] = useState('text-sm');
    const [headerFields, setHeaderFields] = useState({ nome: true, data: true, turma: true, nota: true, valor: true });
    const [activeVersion, setActiveVersion] = useState('A');
    const [examVersions, setExamVersions] = useState<Record<string, Question[]>>({});
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
            alert("Não foi possível acessar a câmera.");
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
            // Inicializa GoogleGenAI conforme as diretrizes
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `Analise este cartão-resposta. 
            Extraia o nome do aluno escrito à mão no topo.
            Identifique qual opção (A, B, C, D, E) está preenchida para cada questão de 1 a ${scannedExam.questions.length}.
            Atenção ao contraste: a bolinha mais escura/pintada é a resposta.
            Retorne um JSON estrito seguindo este schema.`;

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

            // Utiliza o modelo recomendado gemini-3-flash-preview para tarefas básicas de texto/visão
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: [
                    { text: prompt },
                    { inlineData: { data: base64Image, mimeType: 'image/jpeg' } }
                ],
                config: { responseMimeType: "application/json", responseSchema: schema }
            });

            const data = JSON.parse(response.text || '{}');
            
            // Cruzar com o gabarito real
            let score = 0;
            const detailedResults = scannedExam.questions.map((q, idx) => {
                const qNum = (idx + 1).toString();
                const studentAns = data.answers[qNum];
                const correctOpt = q.options?.find(o => o.isCorrect);
                const correctLetter = q.options ? String.fromCharCode(65 + q.options.indexOf(correctOpt!)) : '?';
                
                const isCorrect = studentAns === correctLetter;
                if (isCorrect) score++;

                return {
                    num: qNum,
                    studentAns,
                    correctAns: correctLetter,
                    isCorrect
                };
            });

            setScanResult({
                studentName: data.studentName,
                score,
                total: scannedExam.questions.length,
                details: detailedResults
            });

        } catch (err) {
            console.error(err);
            alert("Erro ao processar imagem. Tente uma foto mais nítida.");
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
            await FirebaseService.saveExam(attempt); // Usando endpoint genérico para salvar tentativa
            alert("Resultado salvo com sucesso!");
            stopScanner();
            navigate('/exam-results', { state: { examId: scannedExam.id } });
        } catch (e) {
            alert("Erro ao salvar resultado.");
        }
    };

    // --- HELPERS E RENDERS ---
    const authorizedHierarchy = useMemo(() => {
        const full = Array.isArray(hierarchy) ? hierarchy : [];
        if (!user || user.role === UserRole.ADMIN) return full;
        const authorizedIds = [...(user.subjects || []), ...(user.accessGrants || [])];
        return full.filter(cc => authorizedIds.includes(cc.id));
    }, [hierarchy, user]);

    const selectedInstitution = useMemo(() => institutions.find(i => i.id === editing.institutionId), [institutions, editing.institutionId]);

    const renderHeaderPrint = (titleSuffix: string = '') => (
        <div className="border-2 border-black p-4 mb-4 break-inside-avoid bg-white block relative">
            {/* Âncora de Visão Top-Left */}
            <div className="vision-anchor top-0 left-0 no-print hidden print:block"></div>
            {/* Âncora de Visão Top-Right */}
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
                    <div className="text-[7px] font-mono mt-1 opacity-50 uppercase tracking-tighter">ID: {editing.id?.slice(0,8)}</div>
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

    const generateVersions = (count: number, baseQs?: Question[]) => {
        const source = baseQs || (Array.isArray(editing.questions) ? editing.questions : []);
        const versions: Record<string, Question[]> = {};
        for (let i = 0; i < count; i++) {
            const vLetter = String.fromCharCode(65 + i);
            const shuffledQs = [...source].sort(() => 0.5 - Math.random());
            versions[vLetter] = shuffledQs;
        }
        setExamVersions(versions);
        setActiveVersion('A');
    };

    // Fix: Implementada a função handleAutoGenerate para realizar o sorteio de questões
    const handleAutoGenerate = () => {
        const scope = editing.contentScopes?.[0];
        if (!scope || !scope.componentId) {
            alert("Selecione uma área e defina o escopo no passo anterior.");
            return;
        }

        const candidates = allQuestions.filter(q => q.componentId === scope.componentId);
        
        if (candidates.length === 0) {
            alert("Nenhuma questão disponível no banco para esta área.");
            return;
        }

        const count = Math.min(scope.questionCount || 10, candidates.length);
        const shuffled = [...candidates].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, count);

        setEditing(prev => ({ ...prev, questions: selected }));
        setCurrentStep(4);
    };

    const handleSaveExam = async () => {
        try {
            const payload = { ...editing, authorId: user?.id, institutionId: editing.institutionId || user?.institutionId, createdAt: editing.createdAt || new Date().toISOString() };
            await FirebaseService.saveExam(payload);
            setIsModalOpen(false);
            load();
        } catch (e) { alert("Erro ao salvar."); }
    };

    const currentQs = examVersions[activeVersion] || (Array.isArray(editing.questions) ? editing.questions : []);

    const renderStepContent = () => {
        switch(currentStep) {
            case 1: return (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <Input label="Título da Avaliação" value={editing.title || ''} onChange={e => setEditing({...editing, title: e.target.value})} placeholder="Ex: P1 - Cálculo Diferencial" />
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
                            <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest">Layout de Impressão</h4>
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
                                <span className="text-sm font-bold text-slate-700">Imprimir Gabarito</span>
                            </label>
                        </div>
                    </div>
                    <RichTextEditor label="Instruções para os Alunos" value={editing.instructions || ''} onChange={html => setEditing({...editing, instructions: html})} />
                </div>
            );
            case 2: return (
                <div className="space-y-6">
                    <div className="bg-blue-600 p-8 rounded-[40px] text-white shadow-xl">
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <Select label="Área" value={editing.contentScopes?.[0]?.componentId || ''} onChange={e => setEditing({...editing, contentScopes: [{ componentId: e.target.value, questionCount: 10, componentName: 'Selecionado' } as any]})} className="!bg-blue-700 !border-blue-500 !text-white">
                                <option value="">Selecione...</option>
                                {authorizedHierarchy.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
                            </Select>
                            <Input label="Quantidade de Questões" type="number" min="1" value={editing.contentScopes?.[0]?.questionCount || 10} onChange={e => {
                                const scopes = [...(editing.contentScopes || [])];
                                if(scopes[0]) scopes[0].questionCount = Number(e.target.value);
                                setEditing({...editing, contentScopes: scopes});
                            }} className="!bg-blue-700 !border-blue-500 !text-white" />
                         </div>
                    </div>
                    <p className="text-center text-slate-400 py-10 font-bold italic">Defina as regras de sorteio ou selecione as questões manualmente no próximo passo.</p>
                </div>
            );
            case 3: return (
                <div className="text-center py-20 flex flex-col items-center">
                    <Icons.Sparkles className="w-12 h-12 text-brand-blue mb-4" />
                    <h3 className="text-2xl font-black mb-2">Pronto para Gerar?</h3>
                    <Button onClick={handleAutoGenerate} className="h-16 px-12 text-xl shadow-2xl">Sortear Questões</Button>
                </div>
            );
            case 4: return (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
                    <div className="lg:col-span-1 space-y-6 bg-slate-50 p-6 rounded-3xl border no-print">
                        <Select label="Tamanho da Fonte" value={printFontSize} onChange={e => setPrintFontSize(e.target.value)}>
                            <option value="text-[10px]">Econômica</option>
                            <option value="text-sm">Confortável</option>
                        </Select>
                        <div className="flex bg-white rounded-xl p-1 border">
                            <button onClick={() => setViewingMode('EXAM')} className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${viewingMode === 'EXAM' ? 'bg-brand-blue text-white' : 'text-slate-400'}`}>PROVA</button>
                            <button onClick={() => setViewingMode('ANSWER_CARD')} className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${viewingMode === 'ANSWER_CARD' ? 'bg-brand-blue text-white' : 'text-slate-400'}`}>CARTÃO</button>
                        </div>
                        <Button onClick={() => window.print()} className="w-full h-14 bg-slate-900 text-white shadow-xl mt-4 no-print"><Icons.Printer /> Imprimir</Button>
                    </div>

                    <div className="lg:col-span-2 bg-white rounded-2xl p-4 border overflow-y-auto custom-scrollbar print:p-0 print:border-none">
                        <div id="exam-print-container" className={`${printFontSize} text-black bg-white w-full print:block print:static relative`}>
                            {viewingMode === 'EXAM' ? (
                                <div className="animate-fade-in bg-white w-full block">
                                    {renderHeaderPrint()}
                                    <div className={`${editing.columns === 2 ? 'preview-columns-2 print-columns-2' : 'w-full block'}`}>
                                        {currentQs.map((q, idx) => (
                                            <div key={idx} className="break-inside-avoid bg-white block mb-6">
                                                <div className="flex gap-2"><span className="font-bold">{idx + 1}.</span><div className="flex-1 rich-text-content" dangerouslySetInnerHTML={{__html: q.enunciado}} /></div>
                                                <div className="mt-2 ml-6 space-y-1 block">
                                                    {q.options?.map((opt, i) => (<div key={i} className="flex gap-2 py-0.5"><span className="w-5 h-5 border border-black rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">{String.fromCharCode(65+i)}</span><span className="text-sm">{opt.text}</span></div>))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="animate-fade-in bg-white w-full block relative min-h-[297mm]">
                                    {/* Âncoras Seletivas para o Scanner */}
                                    <div className="vision-anchor top-0 left-0 no-print hidden print:block"></div>
                                    <div className="vision-anchor top-0 right-0 no-print hidden print:block"></div>
                                    <div className="vision-anchor bottom-0 left-0 no-print hidden print:block"></div>
                                    <div className="vision-anchor bottom-0 right-0 no-print hidden print:block"></div>

                                    {renderHeaderPrint('(CARTÃO-RESPOSTA)')}
                                    <div className="mt-8 grid grid-cols-2 gap-x-10 gap-y-6 bg-white print:block">
                                        {currentQs.map((q, idx) => (
                                            <div key={`card-${idx}`} className="flex items-center gap-4 border-b border-black pb-3 break-inside-avoid bg-white mb-4">
                                                <span className="font-black text-slate-600 w-8">{idx + 1}</span>
                                                <div className="flex gap-2">
                                                    {['A', 'B', 'C', 'D', 'E'].map(letter => (
                                                        <div key={letter} className="answer-bubble bg-white">{letter}</div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-auto pt-10 text-center opacity-30 text-[10px] uppercase font-black tracking-[0.5em]">
                                        Controle de Visão Multimodal - Prova Fácil
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
            <div className="flex justify-between items-center mb-8 no-print">
                <div>
                    <h2 className="text-3xl font-display font-bold text-slate-800 tracking-tight">Avaliações</h2>
                    <p className="text-slate-500 mt-1">Gerencie suas provas impressas e correções automatizadas.</p>
                </div>
                <Button onClick={() => { setEditing({ title: '', questions: [], columns: 1, showAnswerKey: false, instructions: '' }); setCurrentStep(1); setIsModalOpen(true); }} className="h-12 px-6 shadow-lg">
                    <Icons.Plus /> Nova Prova
                </Button>
            </div>

            {loading ? (
                <div className="p-20 text-center text-slate-300 font-black animate-pulse no-print">Sincronizando...</div>
            ) : (
                <div className="space-y-6 no-print">
                    {institutions.map(inst => {
                        const instExams = exams.filter(e => e.institutionId === inst.id);
                        if (instExams.length === 0) return null;
                        return (
                            <div key={inst.id} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden mb-6">
                                <div className="p-5 flex justify-between items-center cursor-pointer hover:bg-slate-50" onClick={() => setExpandedInstitutions(prev => ({ ...prev, [inst.id]: !prev[inst.id] }))}>
                                    <div className="flex items-center gap-3">
                                        <div className={`transform transition-transform text-slate-400 ${expandedInstitutions[inst.id] ? 'rotate-180' : ''}`}><Icons.ChevronDown /></div>
                                        <span className="font-black text-xl text-slate-800 uppercase">{inst.name}</span>
                                    </div>
                                    <Badge color="blue">{instExams.length} provas</Badge>
                                </div>
                                {expandedInstitutions[inst.id] && (
                                    <div className="bg-slate-50 p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {instExams.map(exam => (
                                            <Card key={exam.id} className="hover:border-brand-blue transition-all border-2 group">
                                                <h4 className="font-bold text-slate-800 text-lg mb-6 line-clamp-1">{exam.title}</h4>
                                                <div className="grid grid-cols-2 gap-2 mb-4">
                                                    <div className="bg-slate-100 p-2 rounded-xl text-center">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase">Questões</p>
                                                        <p className="font-bold text-slate-700">{exam.questions?.length}</p>
                                                    </div>
                                                    <div className="bg-slate-100 p-2 rounded-xl text-center">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase">Versão</p>
                                                        <p className="font-bold text-slate-700">A</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button onClick={() => startScanner(exam)} className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100 text-[10px] font-black uppercase"><Icons.Camera /> Escanear</Button>
                                                    <Button variant="outline" className="h-10 px-2" onClick={() => { setEditing(exam); setCurrentStep(4); setIsModalOpen(true); }}><Icons.Printer /></Button>
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
                    <div className="flex flex-col items-center gap-6 w-full max-w-lg p-4">
                        <div className="w-full flex justify-between items-center text-white px-4">
                            <div>
                                <h3 className="text-xl font-black">Scanner Ativo</h3>
                                <p className="text-xs opacity-60 uppercase">{scannedExam?.title}</p>
                            </div>
                            <button onClick={stopScanner} className="bg-white/10 hover:bg-white/20 p-3 rounded-full transition-colors"><Icons.X /></button>
                        </div>

                        {!scanResult ? (
                            <>
                                <div className="camera-viewport shadow-2xl relative">
                                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                                    <div className="scan-frame rounded-xl"></div>
                                    <div className="absolute top-0 left-0 w-full h-1 bg-brand-blue shadow-[0_0_15px_rgba(58,114,236,1)] animate-scan-line"></div>
                                </div>
                                
                                <div className="text-white text-center px-8">
                                    <p className="text-sm font-bold">Aponte para o Cartão-Resposta</p>
                                    <p className="text-[10px] opacity-50 mt-1">Enquadre o papel dentro da moldura para extrair o resultado automaticamente.</p>
                                </div>

                                <Button onClick={captureAndAnalyze} disabled={scanLoading} className="h-16 w-full max-w-[300px] text-lg font-black shadow-2xl shadow-blue-500/40 rounded-2xl">
                                    {scanLoading ? <span className="flex items-center gap-2 animate-pulse"><Icons.Refresh className="animate-spin" /> Analisando...</span> : <><Icons.Camera /> Capturar Agora</>}
                                </Button>
                            </>
                        ) : (
                            <div className="bg-white w-full rounded-[40px] p-8 shadow-2xl animate-scale-in">
                                <div className="text-center mb-8">
                                    <Badge color="green" className="mb-2">Leitura Concluída</Badge>
                                    <h3 className="text-2xl font-black text-slate-800">{scanResult.studentName || 'Aluno não identificado'}</h3>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-8">
                                    <div className="bg-blue-50 p-6 rounded-3xl text-center">
                                        <p className="text-[10px] font-black text-blue-400 uppercase mb-1">Acertos</p>
                                        <p className="text-4xl font-black text-brand-blue">{scanResult.score} / {scanResult.total}</p>
                                    </div>
                                    <div className="bg-slate-50 p-6 rounded-3xl text-center">
                                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Taxa</p>
                                        <p className="text-4xl font-black text-slate-700">{((scanResult.score/scanResult.total)*100).toFixed(0)}%</p>
                                    </div>
                                </div>

                                <div className="max-h-48 overflow-y-auto custom-scrollbar border rounded-2xl p-4 mb-8 space-y-2">
                                    {scanResult.details.map((d: any) => (
                                        <div key={d.num} className="flex justify-between items-center text-xs font-bold border-b border-slate-50 pb-1 last:border-0">
                                            <span className="text-slate-400">Questão {d.num}</span>
                                            <div className="flex gap-4">
                                                <span className="text-slate-400">Capturado: <span className="text-slate-800">{d.studentAns || '-'}</span></span>
                                                <span className={d.isCorrect ? 'text-green-600' : 'text-red-500'}>
                                                    {d.isCorrect ? 'CORRETO' : `GABARITO: ${d.correctAns}`}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex gap-4">
                                    <Button variant="outline" className="flex-1" onClick={() => setScanResult(null)}>Tentar Novamente</Button>
                                    <Button className="flex-1" onClick={confirmScan}>Salvar Nota</Button>
                                </div>
                            </div>
                        )}
                        
                        <canvas ref={canvasRef} className="hidden" />
                    </div>
                </div>
            )}

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing.id ? "Editor de Prova" : "Gerador Inteligente"} maxWidth="max-w-7xl" footer={
                <div className="flex justify-between w-full items-center no-print">
                    {currentStep > 1 && <Button variant="ghost" onClick={() => setCurrentStep(currentStep - 1)} className="font-black uppercase text-xs"><Icons.ArrowLeft /> Voltar</Button>}
                    <div className="flex gap-2 ml-auto">
                        {currentStep < 4 ? <Button onClick={() => setCurrentStep(currentStep + 1)} disabled={currentStep === 1 && !editing.title} className="px-8 h-12">Próximo <Icons.ArrowRight /></Button> : <Button onClick={handleSaveExam} className="px-10 h-12 shadow-lg font-black">SALVAR PROVA</Button>}
                    </div>
                </div>
            }>
                <div className="flex items-center justify-between mb-10 px-20 no-print">
                    {[1, 2, 3, 4].map(s => (
                        <React.Fragment key={s}>
                            <div className="flex flex-col items-center gap-2">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black transition-all ${currentStep >= s ? 'bg-brand-blue text-white shadow-xl' : 'bg-slate-100 text-slate-400'}`}>{s}</div>
                                <span className={`text-[10px] font-black uppercase tracking-widest ${currentStep >= s ? 'text-brand-blue' : 'text-slate-400'}`}>
                                    {s === 1 ? 'Config' : s === 2 ? 'Escopo' : s === 3 ? 'Gerar' : 'Impressão'}
                                </span>
                            </div>
                            {s < 4 && <div className={`flex-1 h-1 mx-4 rounded-full ${currentStep > s ? 'bg-brand-blue' : 'bg-slate-100'}`}></div>}
                        </React.Fragment>
                    ))}
                </div>
                <div className="animate-fade-in min-h-[400px] no-print">{renderStepContent()}</div>
                <div className="hidden print:block">{currentStep === 4 && renderStepContent()}</div>
            </Modal>
        </div>
    );
};

export default ExamsPage;
