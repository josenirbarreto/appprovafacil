
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
            const prompt = `Analise este cartão-resposta de prova. Extraia o nome do aluno e identifique as respostas marcadas de 1 a ${scannedExam.questions?.length || 10}. Retorne JSON.`;

            const schema = {
                type: Type.OBJECT,
                properties: {
                    studentName: { type: Type.STRING },
                    answers: { type: Type.OBJECT, additionalProperties: { type: Type.STRING } }
                },
                required: ["studentName", "answers"]
            };

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: [{ text: prompt }, { inlineData: { data: base64Image, mimeType: 'image/jpeg' } }],
                config: { responseMimeType: "application/json", responseSchema: schema }
            });

            if (!response.text) throw new Error("Erro IA");
            const data = JSON.parse(response.text);
            
            let score = 0;
            const detailedResults = (scannedExam.questions || []).map((q, idx) => {
                const qNum = (idx + 1).toString();
                const studentAns = data.answers[qNum] || '';
                const correctOpt = q.options?.find(o => o.isCorrect);
                const correctLetter = q.options ? String.fromCharCode(65 + q.options.indexOf(correctOpt!)) : '?';
                const isCorrect = studentAns.toUpperCase() === correctLetter.toUpperCase();
                if (isCorrect) score++;
                return { num: qNum, studentAns, correctAns: correctLetter, isCorrect };
            });

            setScanResult({ studentName: data.studentName || 'Não identificado', score, total: scannedExam.questions?.length || 0, details: detailedResults });
        } catch (err) {
            alert("Erro visual.");
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
                answers: scanResult.details.reduce((acc: any, curr: any) => { acc[curr.num] = curr.studentAns; return acc; }, {})
            };
            await FirebaseService.saveExam(attempt); 
            stopScanner();
            navigate('/exam-results', { state: { examId: scannedExam.id } });
        } catch (e) { alert("Erro ao salvar."); }
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

    const handleAutoGenerate = () => {
        const scope = editing.contentScopes?.[0];
        if (!scope || !scope.componentId) return alert("Selecione a área.");
        const pool = allQuestions.filter(q => q.componentId === scope.componentId);
        const count = Math.min(scope.questionCount || 10, pool.length);
        const selected = [...pool].sort(() => 0.5 - Math.random()).slice(0, count);
        setEditing(prev => ({ ...prev, questions: selected }));
        setExamVersions({ 'A': selected });
        setCurrentStep(4);
    };

    const handleSaveExam = async () => {
        try {
            await FirebaseService.saveExam({ ...editing, authorId: user?.id, createdAt: editing.createdAt || new Date().toISOString() });
            setIsModalOpen(false);
            load();
        } catch (e) { alert("Erro ao salvar."); }
    };

    // --- RENDERIZADORES DE IMPRESSÃO ---
    const renderHeaderPrint = (titleSuffix: string = '') => (
        <div className="print-span-all border-b-2 border-black pb-4 mb-6 bg-white relative block">
            {/* Âncoras de Scanner APENAS no Cabeçalho */}
            <div className="vision-anchor anchor-tl hidden print:block"></div>
            <div className="vision-anchor anchor-tr hidden print:block"></div>
            
            <div className="flex items-center gap-6 mb-4">
                {selectedInstitution?.logoUrl && (
                    <img src={selectedInstitution.logoUrl} alt="Logo" className="h-14 w-auto object-contain shrink-0" />
                )}
                <div className="flex-1">
                    <h1 className="font-black text-xl uppercase leading-none">{selectedInstitution?.name || 'INSTITUIÇÃO'}</h1>
                    <h2 className="font-bold text-sm uppercase text-slate-700">{editing.title} {titleSuffix}</h2>
                </div>
                <div className="text-right">
                    <div className="text-xs font-black border-2 border-black px-3 py-1 rounded">VERSÃO: {activeVersion}</div>
                    <div className="text-[7px] font-mono mt-1 opacity-40">ID: {editing.id?.slice(0,8)}</div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                <div className="border-b-2 border-black font-black text-xs h-8 flex items-end">ALUNO:</div>
                <div className="border-b-2 border-black font-black text-xs h-8 flex items-end">DATA: ___/___/___</div>
                <div className="border-b-2 border-black font-black text-xs h-8 flex items-end">TURMA:</div>
                <div className="flex gap-4">
                    <div className="flex-1 border-b-2 border-black font-black text-xs h-8 flex items-end">NOTA:</div>
                    <div className="flex-1 border-b-2 border-black font-black text-xs h-8 flex items-end">VALOR: 10,0</div>
                </div>
            </div>
        </div>
    );

    const renderStepContent = () => {
        switch(currentStep) {
            case 1: return (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <Input label="Título" value={editing.title} onChange={e => setEditing({...editing, title: e.target.value})} />
                        <div className="grid grid-cols-2 gap-4">
                            <Select label="Instituição" value={editing.institutionId} onChange={e => setEditing({...editing, institutionId: e.target.value})}>
                                <option value="">Selecione...</option>
                                {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                            </Select>
                            <Select label="Turma" value={editing.classId} onChange={e => setEditing({...editing, classId: e.target.value})}>
                                <option value="">Selecione...</option>
                                {classes.filter(c => c.institutionId === editing.institutionId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </Select>
                        </div>
                    </div>
                    <div className="flex gap-4 p-4 bg-slate-50 rounded-2xl">
                        <button onClick={() => setEditing({...editing, columns: 1})} className={`flex-1 p-2 rounded-xl border-2 ${editing.columns === 1 ? 'border-brand-blue bg-white' : 'border-transparent'}`}>1 Coluna</button>
                        <button onClick={() => setEditing({...editing, columns: 2})} className={`flex-1 p-2 rounded-xl border-2 ${editing.columns === 2 ? 'border-brand-blue bg-white' : 'border-transparent'}`}>2 Colunas</button>
                    </div>
                    <RichTextEditor label="Instruções" value={editing.instructions || ''} onChange={h => setEditing({...editing, instructions: h})} />
                </div>
            );
            case 2: return (
                <div className="space-y-4">
                    <Select label="Área" value={editing.contentScopes?.[0]?.componentId} onChange={e => setEditing({...editing, contentScopes: [{ componentId: e.target.value, questionCount: 10 } as any]})}>
                        <option value="">Selecione...</option>
                        {authorizedHierarchy.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
                    </Select>
                    <Input label="Quantidade" type="number" value={editing.contentScopes?.[0]?.questionCount} onChange={e => {
                        const scopes = [...(editing.contentScopes || [])];
                        if(scopes[0]) scopes[0].questionCount = Number(e.target.value);
                        setEditing({...editing, contentScopes: scopes});
                    }} />
                </div>
            );
            case 3: return (
                <div className="text-center py-20">
                    <Icons.Sparkles className="w-16 h-16 mx-auto text-brand-blue mb-4" />
                    <Button onClick={handleAutoGenerate}>Sorteio Automático</Button>
                </div>
            );
            case 4: return (
                <div className="grid grid-cols-3 gap-6 h-full">
                    <div className="col-span-1 space-y-4 no-print">
                        <Select label="Fonte" value={printFontSize} onChange={e => setPrintFontSize(e.target.value)}>
                            <option value="text-xs">Pequena</option>
                            <option value="text-sm">Média</option>
                            <option value="text-base">Grande</option>
                        </Select>
                        <div className="flex bg-white rounded-lg p-1 border">
                            <button onClick={() => setViewingMode('EXAM')} className={`flex-1 py-2 text-xs font-black rounded ${viewingMode === 'EXAM' ? 'bg-brand-blue text-white' : 'text-slate-400'}`}>PROVA</button>
                            <button onClick={() => setViewingMode('ANSWER_CARD')} className={`flex-1 py-2 text-xs font-black rounded ${viewingMode === 'ANSWER_CARD' ? 'bg-brand-blue text-white' : 'text-slate-400'}`}>CARTÃO</button>
                        </div>
                        <Button onClick={() => window.print()} className="w-full h-12 bg-slate-900 text-white"><Icons.Printer /> Imprimir</Button>
                    </div>

                    <div className="col-span-2 bg-white rounded-xl border p-4 overflow-y-auto custom-scrollbar print:p-0 print:border-none print:overflow-visible">
                        <div id="exam-print-container" className={`${printFontSize} text-black`}>
                            {viewingMode === 'EXAM' ? (
                                <div className="block">
                                    {renderHeaderPrint()}
                                    {editing.instructions && (
                                        <div className="print-span-all mb-6 p-4 border-l-4 border-black bg-slate-50 italic" dangerouslySetInnerHTML={{__html: editing.instructions}} />
                                    )}
                                    <div className={`${editing.columns === 2 ? 'preview-columns-2 print-columns-2' : 'w-full block'}`}>
                                        {currentQs.map((q, idx) => (
                                            <div key={idx} className="break-inside-avoid mb-8">
                                                <div className="flex gap-2 font-bold mb-2">
                                                    <span>{idx + 1}.</span>
                                                    <div className="flex-1 rich-text-content" dangerouslySetInnerHTML={{__html: q.enunciado}} />
                                                </div>
                                                <div className="mt-2 ml-6 space-y-2">
                                                    {q.options?.map((opt, i) => (
                                                        <div key={i} className="flex gap-3 items-center">
                                                            <span className="w-5 h-5 border border-black rounded-full flex items-center justify-center text-[9px] font-black">{String.fromCharCode(65+i)}</span>
                                                            <span className="text-sm">{opt.text}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="relative min-h-[280mm] block">
                                    {/* Âncoras do Scanner - ESSENCIAL PARA VISÃO COMPUTACIONAL */}
                                    <div className="vision-anchor anchor-tl hidden print:block"></div>
                                    <div className="vision-anchor anchor-tr hidden print:block"></div>
                                    <div className="vision-anchor anchor-bl hidden print:block"></div>
                                    <div className="vision-anchor anchor-br hidden print:block"></div>

                                    {renderHeaderPrint('(CARTÃO-RESPOSTA)')}
                                    
                                    <div className="mt-10 grid grid-cols-2 gap-x-10 gap-y-4">
                                        {currentQs.map((_, idx) => (
                                            <div key={`card-${idx}`} className="flex flex-row items-center gap-4 border-b border-slate-100 pb-2 break-inside-avoid h-10">
                                                <span className="font-black text-slate-300 w-8 text-lg">{idx + 1}</span>
                                                <div className="flex gap-3 flex-row items-center">
                                                    {['A', 'B', 'C', 'D', 'E'].map(letter => (
                                                        <div key={letter} className="answer-bubble">{letter}</div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="absolute bottom-10 left-0 right-0 text-center opacity-10 text-[8px] font-black tracking-[1.5em] uppercase">
                                        PROVA FÁCIL SCAN ENGINE V4.0
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
                    <h2 className="text-3xl font-display font-bold text-slate-800">Avaliações Impressas</h2>
                    <p className="text-slate-500">Imprima provas com gabaritos escaneáveis.</p>
                </div>
                <Button onClick={() => { setEditing({ title: '', questions: [], columns: 1 }); setCurrentStep(1); setIsModalOpen(true); }}><Icons.Plus /> Criar</Button>
            </div>

            <div className="space-y-6 no-print">
                {institutions.map(inst => (
                    <div key={inst.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
                        <div className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50" onClick={() => setExpandedInstitutions(p => ({...p, [inst.id]: !p[inst.id]}))}>
                            <span className="font-black text-lg uppercase">{inst.name}</span>
                            <Badge>{exams.filter(e => e.institutionId === inst.id).length} provas</Badge>
                        </div>
                        {expandedInstitutions[inst.id] && (
                            <div className="bg-slate-50 p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                                {exams.filter(e => e.institutionId === inst.id).map(exam => (
                                    <Card key={exam.id} className="bg-white border-2 border-transparent hover:border-brand-blue transition-all">
                                        <h4 className="font-bold mb-4">{exam.title}</h4>
                                        <div className="flex gap-2">
                                            <Button onClick={() => startScanner(exam)} className="flex-1 bg-emerald-600 text-[10px] uppercase font-black"><Icons.Camera /> Corrigir</Button>
                                            <Button variant="outline" onClick={() => { setEditing(exam); setCurrentStep(4); setIsModalOpen(true); }}><Icons.Printer /></Button>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* SCANNER OVERLAY */}
            {isScannerOpen && (
                <div className="fixed inset-0 z-[200] bg-slate-900 flex flex-col items-center justify-center p-6">
                    <div className="w-full max-w-lg">
                        {!scanResult ? (
                            <div className="space-y-6">
                                <div className="aspect-[3/4] bg-black rounded-3xl overflow-hidden relative border-4 border-white/20">
                                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                                    <div className="absolute inset-8 border-2 border-brand-blue rounded-xl pointer-events-none"></div>
                                    <div className="absolute top-0 left-0 w-full h-1 bg-brand-blue shadow-[0_0_20px_blue] animate-pulse"></div>
                                </div>
                                <div className="flex gap-4">
                                    <Button onClick={stopScanner} variant="ghost" className="text-white">Cancelar</Button>
                                    <Button onClick={captureAndAnalyze} disabled={scanLoading} className="flex-1 h-14 text-lg">{scanLoading ? 'Analisando...' : 'Capturar Gabarito'}</Button>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white p-8 rounded-[40px] shadow-2xl space-y-6">
                                <h3 className="text-2xl font-black text-center">{scanResult.studentName}</h3>
                                <div className="grid grid-cols-2 gap-4 text-center">
                                    <div className="bg-blue-50 p-4 rounded-2xl"><p className="text-[10px] font-black opacity-40 uppercase">Acertos</p><p className="text-3xl font-black">{scanResult.score} / {scanResult.total}</p></div>
                                    <div className="bg-slate-50 p-4 rounded-2xl"><p className="text-[10px] font-black opacity-40 uppercase">Nota</p><p className="text-3xl font-black">{((scanResult.score/scanResult.total)*10).toFixed(1)}</p></div>
                                </div>
                                <Button onClick={confirmScan} className="w-full h-14">Salvar Resultado</Button>
                                <Button onClick={() => setScanResult(null)} variant="outline" className="w-full">Tentar Novamente</Button>
                            </div>
                        )}
                        <canvas ref={canvasRef} className="hidden" />
                    </div>
                </div>
            )}

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Configurar Avaliação" maxWidth="max-w-7xl">
                <div className="flex gap-12 px-12 mb-8 no-print">
                    {[1, 2, 3, 4].map(s => (
                        <div key={s} className={`flex-1 h-2 rounded-full ${currentStep >= s ? 'bg-brand-blue' : 'bg-slate-100'}`}></div>
                    ))}
                </div>
                {renderStepContent()}
            </Modal>
        </div>
    );
};

export default ExamsPage;
