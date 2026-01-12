
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
    const [genMethod, setGenMethod] = useState<'AUTO' | 'MANUAL'>('AUTO');
    
    // Filtros de Escopo (Passo 2)
    const [scopeFilters, setScopeFilters] = useState({ cc: '', d: '', c: '', u: '', t: '', count: 10 });
    const [manualSearch, setManualSearch] = useState('');

    // Estados de Impressão e Versões (Anti-cola)
    const [printFontSize, setPrintFontSize] = useState('text-sm');
    const [activeVersion, setActiveVersion] = useState('A');
    const [examVersions, setExamVersions] = useState<Record<string, Question[]>>({ 'A': [] });
    const [versionCount, setVersionCount] = useState(1);
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

    // --- FILTRO DE ÁREAS AUTORIZADAS ---
    const authorizedComponents = useMemo(() => {
        if (!user || user.role === UserRole.ADMIN) return hierarchy;
        const subjects = Array.isArray(user.subjects) ? user.subjects : [];
        const grants = Array.isArray(user.accessGrants) ? user.accessGrants : [];
        const authorizedIds = [...subjects, ...grants];
        return hierarchy.filter(cc => authorizedIds.includes(cc.id));
    }, [hierarchy, user]);

    // --- SCANNER LOGIC ---
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
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: [{ text: "Analise o cartão resposta. Identifique o nome do aluno e as marcações de A a E para as questões." }, { inlineData: { data: base64Image, mimeType: 'image/jpeg' } }],
                config: { responseMimeType: "application/json", responseSchema: { type: Type.OBJECT, properties: { studentName: { type: Type.STRING }, answers: { type: Type.OBJECT, additionalProperties: { type: Type.STRING } } }, required: ["studentName", "answers"] } }
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
                return { num: qNum, studentAns, correctAns: correctLetter, isCorrect };
            });
            setScanResult({ studentName: data.studentName || 'Desconhecido', score, total: scannedExam.questions?.length || 0, details: detailedResults });
        } catch (err) { alert("Erro no processamento visual."); } finally { setScanLoading(false); }
    };

    const confirmScan = async () => {
        if (!scanResult || !scannedExam) return;
        try {
            await FirebaseService.saveExam({ examId: scannedExam.id, studentName: scanResult.studentName, totalQuestions: scanResult.total, score: scanResult.score, status: 'COMPLETED', submittedAt: new Date().toISOString(), answers: {} }); 
            alert("Nota salva!"); stopScanner(); navigate('/exam-results', { state: { examId: scannedExam.id } });
        } catch (e) { alert("Erro ao salvar."); }
    };

    // --- HELPERS HIERARQUIA ---
    const filterComp = useMemo(() => hierarchy.find(cc => cc.id === scopeFilters.cc), [hierarchy, scopeFilters.cc]);
    const filterDisc = useMemo(() => filterComp?.disciplines?.find(d => d.id === scopeFilters.d), [filterComp, scopeFilters.d]);
    const filterChap = useMemo(() => filterDisc?.chapters?.find(c => c.id === scopeFilters.c), [filterDisc, scopeFilters.d, scopeFilters.c]);
    const filterUnit = useMemo(() => filterChap?.units?.find(u => u.id === scopeFilters.u), [filterChap, scopeFilters.u]);

    const filteredPool = useMemo(() => {
        return allQuestions.filter(q => {
            if (scopeFilters.cc && q.componentId !== scopeFilters.cc) return false;
            if (scopeFilters.d && q.disciplineId !== scopeFilters.d) return false;
            if (scopeFilters.c && q.chapterId !== scopeFilters.c) return false;
            if (scopeFilters.u && q.unitId !== scopeFilters.u) return false;
            if (scopeFilters.t && q.topicId !== scopeFilters.t) return false;
            if (manualSearch) return q.enunciado.toLowerCase().includes(manualSearch.toLowerCase());
            return true;
        });
    }, [allQuestions, scopeFilters, manualSearch]);

    const handleAutoGenerate = () => {
        if (filteredPool.length === 0) return alert("Nenhuma questão encontrada com esses filtros.");
        const selected = [...filteredPool].sort(() => 0.5 - Math.random()).slice(0, scopeFilters.count);
        setEditing(prev => ({ ...prev, questions: selected }));
        generateVersions(versionCount, selected);
        setCurrentStep(4);
    };

    const toggleManualQuestion = (q: Question) => {
        const current = [...(editing.questions || [])];
        const exists = current.find(x => x.id === q.id);
        const updated = exists ? current.filter(x => x.id !== q.id) : [...current, q];
        setEditing({ ...editing, questions: updated });
    };

    const generateVersions = (count: number, baseQs?: Question[]) => {
        const source = baseQs || (Array.isArray(editing.questions) ? editing.questions : []);
        const versions: Record<string, Question[]> = {};
        for (let i = 0; i < count; i++) {
            const vLetter = String.fromCharCode(65 + i);
            const shuffled = [...source].sort(() => 0.5 - Math.random()).map(q => ({
                ...q,
                options: q.type === QuestionType.MULTIPLE_CHOICE && Array.isArray(q.options) 
                    ? [...q.options].sort(() => 0.5 - Math.random()) 
                    : q.options
            }));
            versions[vLetter] = shuffled;
        }
        setExamVersions(versions);
        setActiveVersion('A');
    };

    const handleSaveExam = async () => {
        try {
            await FirebaseService.saveExam({ ...editing, authorId: user?.id, createdAt: editing.createdAt || new Date().toISOString() });
            setIsModalOpen(false); load();
        } catch (e) { alert("Erro ao salvar."); }
    };

    const selectedInstitution = useMemo(() => institutions.find(i => i.id === editing.institutionId), [institutions, editing.institutionId]);
    const currentQs = useMemo(() => examVersions[activeVersion] || editing.questions || [], [examVersions, activeVersion, editing.questions]);

    const renderHeaderPrint = (titleSuffix: string = '') => (
        <div className="border-2 border-black p-4 mb-6 bg-white relative block">
            <div className="flex items-center gap-6 mb-4">
                {selectedInstitution?.logoUrl && <img src={selectedInstitution.logoUrl} className="h-10 w-auto object-contain shrink-0" />}
                <div className="flex-1">
                    <h1 className="font-black text-base uppercase leading-none">{selectedInstitution?.name || 'INSTITUIÇÃO'}</h1>
                    <h2 className="font-bold text-[10px] uppercase text-slate-700">{editing.title} {titleSuffix}</h2>
                </div>
                <div className="text-right">
                    <div className="text-[10px] font-black border-2 border-black px-2 py-0.5 rounded">VERSÃO: {activeVersion}</div>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                <div className="border-b border-black font-black text-[9px] h-7 flex items-end">ALUNO:</div>
                <div className="border-b border-black font-black text-[9px] h-7 flex items-end">DATA: ___/___/___</div>
                <div className="border-b border-black font-black text-[9px] h-7 flex items-end">TURMA:</div>
                <div className="flex gap-4"><div className="flex-1 border-b border-black font-black text-[9px] h-7 flex items-end">NOTA:</div><div className="flex-1 border-b border-black font-black text-[9px] h-7 flex items-end">VALOR: 10,0</div></div>
            </div>
        </div>
    );

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
                }} className="h-12 px-6 shadow-lg"><Icons.Plus /> Criar Avaliação</Button>
            </div>

            {loading ? (
                <div className="p-20 text-center text-slate-300 font-black animate-pulse no-print">Carregando acervo...</div>
            ) : (
                <div className="space-y-6 no-print">
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
                                                    <div className="bg-slate-50 p-3 rounded-2xl text-center border border-slate-100"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Itens</p><p className="font-bold text-slate-700">{exam.questions?.length || 0}</p></div>
                                                    <div className="bg-slate-50 p-3 rounded-2xl text-center border border-slate-100"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</p><p className="font-bold text-emerald-600">Ativa</p></div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button onClick={() => startScanner(exam)} className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100 text-[10px] font-black uppercase"><Icons.Camera /> Corrigir</Button>
                                                    <Button variant="outline" className="h-11 px-3 border-slate-200" onClick={() => { setEditing(exam); setCurrentStep(4); setIsModalOpen(true); }}><Icons.Printer /></Button>
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
                            <div><h3 className="text-2xl font-black">Scanner Mobile V3</h3><p className="text-xs opacity-60 uppercase">{scannedExam?.title}</p></div>
                            <button onClick={stopScanner} className="bg-white/10 p-3 rounded-full"><Icons.X /></button>
                        </div>
                        {!scanResult ? (
                            <>
                                <div className="camera-viewport relative"><video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" /><div className="scan-frame"></div></div>
                                <Button onClick={captureAndAnalyze} disabled={scanLoading} className="h-16 w-full max-w-[320px] text-lg font-black">{scanLoading ? 'Processando...' : <><Icons.Camera /> Capturar</>}</Button>
                            </>
                        ) : (
                            <Card className="p-8 w-full border-4 border-emerald-500 rounded-[40px]">
                                <div className="text-center mb-6"><Badge color="green">SUCESSO</Badge><h3 className="text-2xl font-black mt-2">{scanResult.studentName}</h3></div>
                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className="bg-blue-50 p-4 rounded-3xl text-center"><p className="text-[10px] font-black text-blue-400 uppercase">Acertos</p><p className="text-4xl font-black text-brand-blue">{scanResult.score} / {scanResult.total}</p></div>
                                    <div className="bg-slate-50 p-4 rounded-3xl text-center"><p className="text-[10px] font-black text-slate-400 uppercase">Nota</p><p className="text-4xl font-black text-slate-800">{((scanResult.score/scanResult.total)*10).toFixed(1)}</p></div>
                                </div>
                                <Button className="w-full h-12" onClick={confirmScan}>Salvar Nota</Button>
                            </Card>
                        )}
                        <canvas ref={canvasRef} className="hidden" />
                    </div>
                </div>
            )}

            {/* MODAL DO WIZARD */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing.id ? "Editor de Avaliação" : "Nova Avaliação"} maxWidth="max-w-7xl" footer={
                <div className="flex justify-between w-full items-center no-print">
                    {currentStep > 1 && <Button variant="ghost" onClick={() => setCurrentStep(currentStep - 1)} className="font-black uppercase text-xs"><Icons.ArrowLeft /> Anterior</Button>}
                    <div className="flex gap-2 ml-auto">
                        {currentStep < 4 ? <Button onClick={() => setCurrentStep(currentStep + 1)} disabled={currentStep === 1 && !editing.title} className="px-10 h-12 font-black">Próximo <Icons.ArrowRight /></Button> : <Button onClick={handleSaveExam} className="px-12 h-12 shadow-xl font-black">SALVAR PROVA</Button>}
                    </div>
                </div>
            }>
                <div className="flex items-center justify-between mb-10 px-20 no-print">
                    {[1, 2, 3, 4].map(s => (
                        <React.Fragment key={s}>
                            <div className="flex flex-col items-center gap-3">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black transition-all ${currentStep >= s ? 'bg-brand-blue text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>{s}</div>
                                <span className={`text-[10px] font-black uppercase tracking-widest ${currentStep >= s ? 'text-brand-blue' : 'text-slate-300'}`}>{s === 1 ? 'Config' : s === 2 ? 'Escopo' : s === 3 ? 'Itens' : 'Arquivo'}</span>
                            </div>
                            {s < 4 && <div className={`flex-1 h-0.5 mx-4 transition-colors ${currentStep > s ? 'bg-brand-blue' : 'bg-slate-100'}`}></div>}
                        </React.Fragment>
                    ))}
                </div>
                
                <div className="animate-fade-in min-h-[500px]">
                    {currentStep === 1 && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <Input label="Título da Avaliação" value={editing.title} onChange={e => setEditing({...editing, title: e.target.value})} placeholder="P1, Simulado, etc." />
                                <div className="grid grid-cols-2 gap-4">
                                    <Select label="Instituição" value={editing.institutionId || ''} onChange={e => setEditing({...editing, institutionId: e.target.value})}>
                                        <option value="">Selecione...</option>
                                        {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                    </Select>
                                    <Select label="Turma" value={editing.classId || ''} onChange={e => setEditing({...editing, classId: e.target.value})}>
                                        <option value="">Geral</option>
                                        {classes.filter(c => c.institutionId === editing.institutionId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </Select>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-6">
                                <div className="bg-slate-50 p-6 rounded-3xl border space-y-3">
                                    <h4 className="text-[10px] font-black uppercase text-slate-400">Layout de Colunas</h4>
                                    <div className="flex gap-2">
                                        <button onClick={() => setEditing({...editing, columns: 1})} className={`flex-1 p-2 rounded-xl border-2 transition-all ${editing.columns === 1 ? 'border-brand-blue bg-white' : 'opacity-50'}`}>1 Coluna</button>
                                        <button onClick={() => setEditing({...editing, columns: 2})} className={`flex-1 p-2 rounded-xl border-2 transition-all ${editing.columns === 2 ? 'border-brand-blue bg-white' : 'opacity-50'}`}>2 Colunas</button>
                                    </div>
                                </div>
                                <div className="col-span-2">
                                    <RichTextEditor label="Instruções da Prova" value={editing.instructions || ''} onChange={html => setEditing({...editing, instructions: html})} />
                                </div>
                            </div>
                        </div>
                    )}

                    {currentStep === 2 && (
                        <div className="space-y-8">
                            <div className="bg-blue-600 p-8 rounded-[40px] text-white shadow-xl">
                                <h3 className="font-black text-xl mb-6 uppercase tracking-tight">Definição do Escopo Curricular</h3>
                                <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                                    <Select label="1. Área (Liberadas)" value={scopeFilters.cc} onChange={e => setScopeFilters({...scopeFilters, cc: e.target.value, d: '', c: '', u: '', t: ''})} className="!bg-blue-700 !border-blue-500 !text-white">
                                        <option value="">Todas</option>
                                        {authorizedComponents.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
                                    </Select>
                                    <Select label="2. Disciplina" value={scopeFilters.d} onChange={e => setScopeFilters({...scopeFilters, d: e.target.value, c: '', u: '', t: ''})} disabled={!scopeFilters.cc} className="!bg-blue-700 !border-blue-500 !text-white">
                                        <option value="">Todas</option>
                                        {filterComp?.disciplines?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </Select>
                                    <Select label="3. Capítulo" value={scopeFilters.c} onChange={e => setScopeFilters({...scopeFilters, c: e.target.value, u: '', t: ''})} disabled={!scopeFilters.d} className="!bg-blue-700 !border-blue-500 !text-white">
                                        <option value="">Todos</option>
                                        {filterDisc?.chapters?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </Select>
                                    <Select label="4. Unidade" value={scopeFilters.u} onChange={e => setScopeFilters({...scopeFilters, u: e.target.value, t: ''})} disabled={!scopeFilters.c} className="!bg-blue-700 !border-blue-500 !text-white">
                                        <option value="">Todas</option>
                                        {filterChap?.units?.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </Select>
                                    <Select label="5. Tópico" value={scopeFilters.t} onChange={e => setScopeFilters({...scopeFilters, t: e.target.value})} disabled={!scopeFilters.u} className="!bg-blue-700 !border-blue-500 !text-white">
                                        <option value="">Todos</option>
                                        {filterUnit?.topics?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </Select>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-3xl border border-slate-200 flex items-center justify-between">
                                <div><p className="text-xl font-bold text-slate-800">Questões Disponíveis</p><p className="text-slate-500 text-sm">Com base no filtro atual, temos {filteredPool.length} itens no banco.</p></div>
                                <div className="flex items-center gap-4"><label className="text-xs font-black uppercase text-slate-400">Total a Sair:</label><input type="number" value={scopeFilters.count} onChange={e => setScopeFilters({...scopeFilters, count: Number(e.target.value)})} className="w-20 h-10 border-2 rounded-xl text-center font-bold" /></div>
                            </div>
                        </div>
                    )}

                    {currentStep === 3 && (
                        <div className="space-y-6">
                            <div className="flex bg-slate-100 p-1 rounded-2xl w-fit mx-auto mb-6">
                                <button onClick={() => setGenMethod('AUTO')} className={`px-8 py-3 rounded-xl text-xs font-black uppercase transition-all ${genMethod === 'AUTO' ? 'bg-white text-brand-blue shadow-md' : 'text-slate-500'}`}>Sorteio Automático</button>
                                <button onClick={() => setGenMethod('MANUAL')} className={`px-8 py-3 rounded-xl text-xs font-black uppercase transition-all ${genMethod === 'MANUAL' ? 'bg-white text-brand-blue shadow-md' : 'text-slate-500'}`}>Seleção Manual</button>
                            </div>

                            {genMethod === 'AUTO' ? (
                                <div className="text-center py-20 flex flex-col items-center animate-fade-in">
                                    <div className="w-24 h-24 bg-blue-50 text-brand-blue rounded-full flex items-center justify-center mb-6 shadow-inner"><Icons.Sparkles className="w-12 h-12" /></div>
                                    <h3 className="text-2xl font-black mb-2 uppercase">Motor de Geração Aleatória</h3>
                                    <p className="text-slate-500 mb-10 max-w-sm">O sistema irá sortear <b>{scopeFilters.count}</b> questões do escopo selecionado.</p>
                                    <Button onClick={handleAutoGenerate} className="h-16 px-16 text-xl shadow-2xl font-black">Sortear e Visualizar</Button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
                                    <div className="lg:col-span-2 space-y-4">
                                        <div className="relative"><input type="text" placeholder="Buscar no catálogo..." value={manualSearch} onChange={e => setManualSearch(e.target.value)} className="w-full pl-10 pr-4 py-3 border-2 rounded-2xl outline-none focus:border-brand-blue" /><Icons.Search className="absolute left-3.5 top-3.5 text-slate-400" /></div>
                                        <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                                            {filteredPool.map(q => {
                                                const isSel = editing.questions?.some(x => x.id === q.id);
                                                return (
                                                    <div key={q.id} onClick={() => toggleManualQuestion(q)} className={`p-4 border-2 rounded-2xl cursor-pointer transition-all ${isSel ? 'border-brand-blue bg-blue-50' : 'bg-white border-slate-100 hover:border-slate-300'}`}>
                                                        <div className="flex justify-between mb-2"><Badge color="blue">{q.type}</Badge>{isSel && <div className="text-brand-blue"><Icons.Check /></div>}</div>
                                                        <div className="text-sm font-bold text-slate-700 line-clamp-2 rich-text-content" dangerouslySetInnerHTML={{__html: q.enunciado}} />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div className="bg-slate-900 rounded-[32px] p-6 text-white h-fit shadow-xl">
                                        <h4 className="font-black text-sm uppercase mb-4 tracking-widest text-blue-400">Prova Montada</h4>
                                        <div className="text-3xl font-black mb-1">{editing.questions?.length || 0}</div>
                                        <p className="text-xs opacity-60 uppercase mb-6">Questões Selecionadas</p>
                                        <Button onClick={() => { generateVersions(versionCount); setCurrentStep(4); }} disabled={!editing.questions?.length} className="w-full h-14 bg-brand-blue hover:bg-blue-600 !text-white border-none shadow-lg">Continuar para Impressão</Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {currentStep === 4 && (
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-full">
                            <div className="lg:col-span-1 space-y-6 bg-slate-50 p-6 rounded-3xl border no-print">
                                <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest">Painel Anti-Cola</h4>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-500 uppercase px-1">Número de Versões</label>
                                    <div className="flex gap-2">
                                        {[1, 2, 3, 4].map(v => (
                                            <button key={v} onClick={() => { setVersionCount(v); generateVersions(v); }} className={`flex-1 h-10 rounded-xl font-bold border-2 transition-all ${versionCount === v ? 'bg-brand-blue text-white border-brand-blue shadow-md' : 'bg-white text-slate-600'}`}>{v}</button>
                                        ))}
                                    </div>
                                </div>
                                <div className="pt-4 border-t">
                                    <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-3">Versão Ativa</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {Object.keys(examVersions).map(v => (
                                            <button key={v} onClick={() => setActiveVersion(v)} className={`w-10 h-10 rounded-full font-black transition-all ${activeVersion === v ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'}`}>{v}</button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2 pt-4 border-t">
                                    <Select label="Tamanho da Fonte" value={printFontSize} onChange={e => setPrintFontSize(e.target.value)}>
                                        <option value="text-[11px]">Pequena</option>
                                        <option value="text-sm">Padrão</option>
                                        <option value="text-base">Grande</option>
                                    </Select>
                                </div>
                                <div className="flex bg-white rounded-xl p-1 border shadow-inner">
                                    <button onClick={() => setViewingMode('EXAM')} className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${viewingMode === 'EXAM' ? 'bg-brand-blue text-white shadow-md' : 'text-slate-400'}`}>PROVA</button>
                                    <button onClick={() => setViewingMode('ANSWER_CARD')} className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${viewingMode === 'ANSWER_CARD' ? 'bg-brand-blue text-white shadow-md' : 'text-slate-400'}`}>CARTÃO RESPOSTA</button>
                                </div>
                                <Button onClick={() => window.print()} className="w-full h-14 bg-slate-900 text-white shadow-2xl mt-4 no-print"><Icons.Printer /> Imprimir</Button>
                            </div>

                            <div className="lg:col-span-3 bg-white rounded-2xl p-4 border overflow-y-auto custom-scrollbar print:p-0 print:border-none print:overflow-visible shadow-inner">
                                <div id="exam-print-container" className={`${printFontSize} text-black bg-white w-full print:block relative min-h-[290mm]`}>
                                    
                                    {/* Âncoras de Visão Globais para o Container de Impressão */}
                                    <div className="vision-anchor anchor-tl hidden print:block"></div>
                                    <div className="vision-anchor anchor-tr hidden print:block"></div>
                                    <div className="vision-anchor anchor-bl hidden print:block"></div>
                                    <div className="vision-anchor anchor-br hidden print:block"></div>

                                    {viewingMode === 'EXAM' ? (
                                        <div className="animate-fade-in bg-white w-full block p-4">
                                            {renderHeaderPrint()}
                                            {editing.instructions && <div className="mb-6 p-4 border-l-4 border-black bg-slate-50 italic rich-text-content break-inside-avoid text-xs" dangerouslySetInnerHTML={{__html: editing.instructions}} />}
                                            <div className={`${editing.columns === 2 ? 'preview-columns-2 print-columns-2' : 'w-full block'}`}>
                                                {currentQs.map((q, idx) => (
                                                    <div key={idx} className="break-inside-avoid bg-white block mb-8">
                                                        <div className="flex gap-2 font-bold mb-2"><span>{idx + 1}.</span><div className="flex-1 rich-text-content" dangerouslySetInnerHTML={{__html: q.enunciado}} /></div>
                                                        <div className="mt-2 ml-6 space-y-2 block">
                                                            {(q.options || []).map((opt, i) => (
                                                                <div key={i} className="flex gap-3 py-1 items-start">
                                                                    <span className="w-5 h-5 border border-black rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">{String.fromCharCode(65+i)}</span>
                                                                    <span className="text-sm leading-tight">{opt.text}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="animate-fade-in bg-white w-full block p-4">
                                            {renderHeaderPrint('(CARTÃO-RESPOSTA)')}
                                            <div className="mt-12 grid grid-cols-2 gap-x-12 gap-y-4 bg-white print:grid">
                                                {currentQs.map((q, idx) => (
                                                    <div key={`card-${idx}`} className="flex items-center justify-between border-b border-black/10 pb-2 break-inside-avoid h-12">
                                                        <div className="flex items-center gap-4">
                                                            <span className="font-black text-slate-800 w-6 text-base shrink-0">{idx + 1}</span>
                                                            
                                                            {q.type === QuestionType.SHORT_ANSWER ? (
                                                                <div className="flex-1 italic text-[10px] text-slate-400 border-b border-dashed border-slate-300 w-48 pt-1">
                                                                    Questão Dissertativa
                                                                </div>
                                                            ) : (
                                                                <div className="flex gap-3">
                                                                    {['A', 'B', 'C', 'D', 'E'].map(letter => (
                                                                        <div key={letter} className="w-7 h-7 rounded-full border-2 border-black flex items-center justify-center font-black text-xs bg-white shrink-0">
                                                                            {letter}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="absolute bottom-10 left-0 right-0 text-center opacity-10 text-[8px] uppercase font-black tracking-[1.5em] no-print">PROVA FÁCIL SCANNER V3</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default ExamsPage;
