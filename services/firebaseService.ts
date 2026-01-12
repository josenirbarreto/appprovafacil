
import { 
    collection, 
    getDocs, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    query, 
    where, 
    getDoc, 
    setDoc,
    writeBatch,
    orderBy,
    limit,
    increment,
    onSnapshot,
    QueryConstraint
} from "firebase/firestore";
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    updatePassword,
    sendPasswordResetEmail
} from "firebase/auth";
import { db, auth } from "../firebaseConfig";
import { User, UserRole, Discipline, Question, Exam, Institution, SchoolClass, Chapter, Unit, Topic, ExamAttempt, Plan, Payment, Campaign, AuditLog, Ticket, TicketMessage, Coupon, SystemSettings, Tutorial, Student, ContractTemplate, TicketStatus, CurricularComponent } from '../types';

const COLLECTIONS = {
    USERS: 'users',
    INSTITUTIONS: 'institutions',
    CLASSES: 'classes',
    STUDENTS: 'students', 
    QUESTIONS: 'questions',
    EXAMS: 'exams',
    ATTEMPTS: 'exam_attempts',
    COMPONENTS: 'curricular_components',
    DISCIPLINES: 'disciplines',
    CHAPTERS: 'chapters',
    UNITS: 'units',
    TOPICS: 'topics',
    PLANS: 'plans',
    PAYMENTS: 'payments',
    CAMPAIGNS: 'campaigns',
    COUPONS: 'coupons', 
    AUDIT_LOGS: 'audit_logs',
    TICKETS: 'tickets',
    TICKET_MESSAGES: 'ticket_messages',
    SETTINGS: 'settings',
    TUTORIALS: 'tutorials',
    TOKENS: 'commercial_tokens',
    CONTRACT_TEMPLATES: 'contract_templates',
    SIGNATURES: 'signatures_log'
};

/**
 * Limpa o payload para o Firestore.
 */
const cleanPayload = (data: any, seen = new WeakSet()): any => {
    if (data === null || data === undefined) return null;
    if (typeof data !== 'object') return data;
    if (data instanceof Date) return data.toISOString();
    if (seen.has(data)) return undefined;
    seen.add(data);
    if (Array.isArray(data)) {
        return data.map(item => cleanPayload(item, seen)).filter(i => i !== undefined);
    }
    const cleaned: any = {};
    Object.keys(data).forEach(key => {
        const value = data[key];
        if (value === undefined || typeof value === 'function' || key.startsWith('_') || key === 'i' || key === 'src') return;
        const cleanedValue = cleanPayload(value, seen);
        if (cleanedValue !== undefined) cleaned[key] = cleanedValue;
    });
    return cleaned;
};

export const FirebaseService = {
    // Auth & Users
    login: async (email: string, pass: string) => { await signInWithEmailAndPassword(auth, email, pass); return await FirebaseService.getCurrentUserData(); },
    logout: async () => { await signOut(auth); },
    getCurrentUserData: async () => { const user = auth.currentUser; if (!user) return null; const snap = await getDoc(doc(db, COLLECTIONS.USERS, user.uid)); return snap.exists() ? snap.data() as User : null; },
    
    listenToCurrentUser: (uid: string, callback: (u: User | null) => void) => {
        return onSnapshot(doc(db, COLLECTIONS.USERS, uid), (snap) => {
            if (snap.exists()) callback({ ...snap.data(), id: snap.id } as User);
            else callback(null);
        });
    },

    getUsers: async (currentUser?: User | null) => { 
        if (!currentUser) return [];
        let q;
        if (currentUser?.role === UserRole.ADMIN) q = collection(db, COLLECTIONS.USERS);
        else if (currentUser?.role === UserRole.MANAGER) q = query(collection(db, COLLECTIONS.USERS), where("institutionId", "==", currentUser.institutionId));
        else return [];
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ ...(d.data() as object), id: d.id } as User));
    },
    getUserByEmail: async (email: string) => { const q = query(collection(db, COLLECTIONS.USERS), where("email", "==", email), limit(1)); const snap = await getDocs(q); return snap.empty ? null : { ...(snap.docs[0].data() as object), id: snap.docs[0].id } as User; },
    
    register: async (email: string, pass: string, name: string, role: UserRole, whatsapp?: string, subjects?: string[]) => { 
        const cred = await createUserWithEmailAndPassword(auth, email, pass); 
        const user: User = { 
            id: cred.user.uid, 
            name, 
            email, 
            whatsapp,
            role, 
            status: 'ACTIVE', 
            plan: 'BASIC', 
            subjects: subjects || [],
            subscriptionEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() 
        }; 
        await setDoc(doc(db, COLLECTIONS.USERS, cred.user.uid), user); 
        return user; 
    },

    createSubUser: async (owner: User, data: any) => { const id = `sub-${Date.now()}`; const user: User = { id, name: data.name, email: data.email, role: data.role, status: 'ACTIVE', plan: owner.plan, subscriptionEnd: owner.subscriptionEnd, ownerId: owner.id, subjects: data.subjects, institutionId: owner.institutionId, requiresPasswordChange: true }; await setDoc(doc(db, COLLECTIONS.USERS, id), user); return user; },
    updateUser: async (id: string, data: Partial<User>) => { await updateDoc(doc(db, COLLECTIONS.USERS, id), cleanPayload(data)); },
    deleteUser: async (id: string) => { await deleteDoc(doc(db, COLLECTIONS.USERS, id)); },
    changeUserPassword: async (newPassword: string) => { if (auth.currentUser) { await updatePassword(auth.currentUser, newPassword); await updateDoc(doc(db, COLLECTIONS.USERS, auth.currentUser.uid), { requiresPasswordChange: false }); } },
    resetPassword: async (email: string) => { await sendPasswordResetEmail(auth, email); },

    // Hierarchy
    getPublicComponents: async () => {
        try {
            const snap = await getDocs(collection(db, COLLECTIONS.COMPONENTS));
            if (snap.empty) throw new Error("Coleção vazia");
            return snap.docs.map(doc => ({ ...(doc.data() as object), id: doc.id } as CurricularComponent));
        } catch (e) {
            console.warn("Acesso ao Firestore negado ou indisponível. Usando fallback de componentes padrão.");
            return [
                { id: 'default-mat', name: 'Matemática', disciplines: [] },
                { id: 'default-port', name: 'Língua Portuguesa', disciplines: [] },
                { id: 'default-cie', name: 'Ciências da Natureza', disciplines: [] },
                { id: 'default-his', name: 'História', disciplines: [] },
                { id: 'default-geo', name: 'Geografia', disciplines: [] },
                { id: 'default-art', name: 'Artes', disciplines: [] },
                { id: 'default-efis', name: 'Educação Física', disciplines: [] },
                { id: 'default-ing', name: 'Língua Inglesa', disciplines: [] }
            ] as CurricularComponent[];
        }
    },
    getHierarchy: async () => { 
        const [cc, d, c, u, t] = await Promise.all([
            getDocs(collection(db, COLLECTIONS.COMPONENTS)),
            getDocs(collection(db, COLLECTIONS.DISCIPLINES)), 
            getDocs(collection(db, COLLECTIONS.CHAPTERS)), 
            getDocs(collection(db, COLLECTIONS.UNITS)), 
            getDocs(collection(db, COLLECTIONS.TOPICS))
        ]); 
        const components = cc.docs.map(doc => ({ ...(doc.data() as object), id: doc.id, disciplines: [] } as CurricularComponent));
        const disciplines = d.docs.map(doc => ({ ...(doc.data() as object), id: doc.id, chapters: [] } as Discipline)); 
        const chapters = c.docs.map(doc => ({ ...(doc.data() as object), id: doc.id, units: [] } as Chapter)); 
        const units = u.docs.map(doc => ({ ...(doc.data() as object), id: doc.id, topics: [] } as Unit)); 
        const topics = t.docs.map(doc => ({ ...(doc.data() as object), id: doc.id } as Topic)); 
        units.forEach(un => un.topics = topics.filter(to => to.unitId === un.id)); 
        chapters.forEach(ch => ch.units = units.filter(un => un.chapterId === ch.id)); 
        disciplines.forEach(di => di.chapters = chapters.filter(ch => ch.disciplineId === di.id)); 
        components.forEach(comp => comp.disciplines = disciplines.filter(di => di.componentId === comp.id));
        return components; 
    },
    getFullHierarchyString: (q: Question, hierarchy: CurricularComponent[]) => { 
        const comp = hierarchy.find(cc => cc.id === q.componentId);
        const disc = comp?.disciplines.find(d => d.id === q.disciplineId); 
        const chap = disc?.chapters.find(c => c.id === q.chapterId); 
        const unit = chap?.units.find(u => u.id === q.unitId); 
        const topic = unit?.topics.find(t => t.id === q.topicId); 
        return `${comp?.name || '?'} > ${disc?.name || '?'} > ${chap?.name || '?'} > ${unit?.name || '?'} > ${topic?.name || '?'}`; 
    },
    addComponent: async (name: string) => { await addDoc(collection(db, COLLECTIONS.COMPONENTS), { name }); },
    addDiscipline: async (componentId: string, name: string) => { await addDoc(collection(db, COLLECTIONS.DISCIPLINES), { componentId, name }); },
    addChapter: async (disciplineId: string, name: string) => { await addDoc(collection(db, COLLECTIONS.CHAPTERS), { disciplineId, name }); },
    addUnit: async (chapterId: string, name: string) => { await addDoc(collection(db, COLLECTIONS.UNITS), { chapterId, name }); },
    addTopic: async (unitId: string, name: string) => { await addDoc(collection(db, COLLECTIONS.TOPICS), { unitId, name }); },
    deleteItem: async (type: string, ids: any) => { 
        if (ids.tId) await deleteDoc(doc(db, COLLECTIONS.TOPICS, ids.tId)); 
        else if (ids.uId) await deleteDoc(doc(db, COLLECTIONS.UNITS, ids.uId)); 
        else if (ids.cId) await deleteDoc(doc(db, COLLECTIONS.CHAPTERS, ids.cId)); 
        else if (ids.dId) await deleteDoc(doc(db, COLLECTIONS.DISCIPLINES, ids.dId)); 
        else if (ids.ccId) await deleteDoc(doc(db, COLLECTIONS.COMPONENTS, ids.ccId)); 
    },

    // Questions
    getQuestions: async (currentUser?: User | null) => { 
        if (!currentUser) return []; 
        
        let constraints: QueryConstraint[] = [];
        if (currentUser?.role === UserRole.TEACHER) constraints.push(where("visibility", "in", ["PUBLIC", "INSTITUTION", "PRIVATE"]));
        else if (currentUser?.role === UserRole.MANAGER) constraints.push(where("institutionId", "==", currentUser.institutionId));
        
        const q = constraints.length > 0 ? query(collection(db, COLLECTIONS.QUESTIONS), ...constraints) : collection(db, COLLECTIONS.QUESTIONS);
        const snap = await getDocs(q);
        let results = snap.docs.map(d => ({...(d.data() as object), id: d.id} as Question));
        
        if (currentUser?.role === UserRole.TEACHER) {
            const authorizedComponents = [...(Array.isArray(currentUser.subjects) ? currentUser.subjects : []), ...(Array.isArray(currentUser.accessGrants) ? currentUser.accessGrants : [])];
            results = results.filter(q => {
                const isAuthor = q.authorId === currentUser.id;
                const isAuthorizedComponent = authorizedComponents.includes(q.componentId);
                const isPublicApproved = q.visibility === 'PUBLIC' && q.reviewStatus === 'APPROVED';
                const isOfficialSchool = q.visibility === 'INSTITUTION' && q.institutionId === currentUser.institutionId;
                const isRejectedSelf = q.reviewStatus === 'REJECTED' && q.authorId === currentUser.id;
                return isAuthor || (isAuthorizedComponent && (isPublicApproved || isOfficialSchool));
            });
        }
        return results;
    },
    getPendingQuestions: async () => { const q = query(collection(db, COLLECTIONS.QUESTIONS), where("visibility", "==", "PUBLIC"), where("reviewStatus", "==", "PENDING")); const snap = await getDocs(q); return snap.docs.map(d => ({ ...(d.data() as object), id: d.id } as Question)); },
    addQuestion: async (q: Question) => { const { id, ...data } = q; const docRef = await addDoc(collection(db, COLLECTIONS.QUESTIONS), cleanPayload(data)); return { ...q, id: docRef.id }; },
    updateQuestion: async (q: Question) => { 
        const { id, ...data } = q; 
        let finalStatus = q.reviewStatus;
        let finalVisibility = q.visibility;
        if (q.reviewStatus === 'REJECTED') { finalStatus = 'PENDING'; finalVisibility = 'PUBLIC'; } 
        else if (q.visibility === 'PUBLIC') { finalStatus = 'PENDING'; }
        const payload = { ...data, reviewStatus: finalStatus, visibility: finalVisibility, reviewComment: null };
        await updateDoc(doc(db, COLLECTIONS.QUESTIONS, id), cleanPayload(payload)); 
    },
    deleteQuestion: async (id: string) => { await deleteDoc(doc(db, COLLECTIONS.QUESTIONS, id)); },
    approveQuestion: async (id: string) => { await updateDoc(doc(db, COLLECTIONS.QUESTIONS, id), { reviewStatus: 'APPROVED', reviewComment: null }); },
    rejectQuestion: async (id: string, reason: string) => { await updateDoc(doc(db, COLLECTIONS.QUESTIONS, id), { reviewStatus: 'REJECTED', visibility: 'PRIVATE', reviewComment: reason }); },
    approveInstitutionalQuestion: async (id: string, adminId: string) => { await updateDoc(doc(db, COLLECTIONS.QUESTIONS, id), { isInstitutional: true, institutionalApprovedById: adminId }); },
    removeInstitutionalSeal: async (id: string) => { await updateDoc(doc(db, COLLECTIONS.QUESTIONS, id), { isInstitutional: false }); },

    // Exams
    getExams: async (currentUser?: User | null) => { 
        if (!currentUser) return [];
        let q;
        if (currentUser?.role === UserRole.ADMIN) q = collection(db, COLLECTIONS.EXAMS);
        else if (currentUser?.role === UserRole.MANAGER) q = query(collection(db, COLLECTIONS.EXAMS), where("institutionId", "==", currentUser.institutionId));
        else if (currentUser?.role === UserRole.TEACHER) q = query(collection(db, COLLECTIONS.EXAMS), where("authorId", "==", currentUser.id));
        else return [];
        const snap = await getDocs(q);
        return snap.docs.map(d => ({...(d.data() as object), id: d.id} as Exam));
    },
    getExamById: async (id: string) => { const snap = await getDoc(doc(db, COLLECTIONS.EXAMS, id)); return snap.exists() ? { ...(snap.data() as object), id: snap.id } as Exam : null; },
    saveExam: async (e: any) => { if(e.id) { await updateDoc(doc(db, COLLECTIONS.EXAMS, e.id), cleanPayload(e)); return e; } const docRef = await addDoc(collection(db, COLLECTIONS.EXAMS), cleanPayload(e)); return {...e, id: docRef.id}; },
    deleteExam: async (id: string) => { await deleteDoc(doc(db, COLLECTIONS.EXAMS, id)); },
    getExamResults: async (examId: string) => { const q = query(collection(db, COLLECTIONS.ATTEMPTS), where("examId", "==", examId)); const snap = await getDocs(q); return snap.docs.map(d => ({ ...(d.data() as object), id: d.id } as ExamAttempt)); },
    updateAttemptScore: async (id: string, score: number, manualGradingComplete: boolean = true, questionScores?: Record<string, number>) => { const updates: any = { score, manualGradingComplete }; if (questionScores) updates.questionScores = questionScores; await updateDoc(doc(db, COLLECTIONS.ATTEMPTS, id), updates); },
    
    // --- CORREÇÃO START ATTEMPT ---
    startAttempt: async (examId: string, studentName: string, studentIdentifier: string, totalQuestions: number, studentId?: string) => { 
        const attempt = { 
            examId, 
            studentName, 
            studentIdentifier, 
            studentId, 
            totalQuestions, 
            startedAt: new Date().toISOString(), 
            answers: {}, 
            score: 0, 
            status: 'IN_PROGRESS' 
        }; 
        // FIX: Salvando na coleção correta de ATTEMPTS
        const docRef = await addDoc(collection(db, COLLECTIONS.ATTEMPTS), cleanPayload(attempt)); 
        return { ...attempt, id: docRef.id } as ExamAttempt; 
    },
    
    submitAttempt: async (id: string, answers: any, score: number, total: number) => { 
        if (!id) throw new Error("ID da tentativa não fornecido.");
        await updateDoc(doc(db, COLLECTIONS.ATTEMPTS, id), { 
            answers, 
            score, 
            totalQuestions: total, 
            submittedAt: new Date().toISOString(), 
            status: 'COMPLETED' 
        }); 
    },
    
    getStudentAttempts: async (eId: string, ident: string) => { const q = query(collection(db, COLLECTIONS.ATTEMPTS), where("examId", "==", eId), where("studentIdentifier", "==", ident)); const snap = await getDocs(q); return snap.map(d => d.data()); },

    // Institutions & Classes
    getInstitutions: async (currentUser?: User | null) => { 
        if (!currentUser) return [];
        if (currentUser.role === UserRole.ADMIN) { const snap = await getDocs(collection(db, COLLECTIONS.INSTITUTIONS)); return snap.docs.map(d => ({...(d.data() as object), id: d.id} as Institution)); }
        const qOwner = query(collection(db, COLLECTIONS.INSTITUTIONS), where("ownerId", "==", currentUser.id));
        const [singleSnap, ownerSnap] = await Promise.all([currentUser.institutionId ? getDoc(doc(db, COLLECTIONS.INSTITUTIONS, currentUser.institutionId)) : null, getDocs(qOwner)]);
        const results: Map<string, Institution> = new Map();
        if (singleSnap?.exists()) results.set(singleSnap.id, { ...(singleSnap.data() as object), id: singleSnap.id } as Institution);
        ownerSnap.docs.forEach(d => results.set(d.id, { ...(d.data() as object), id: d.id } as Institution));
        return Array.from(results.values());
    },
    getInstitutionById: async (id: string) => { const snap = await getDoc(doc(db, COLLECTIONS.INSTITUTIONS, id)); return snap.exists() ? { ...(snap.data() as object), id: snap.id } as Institution : null; },
    addInstitution: async (data: Institution, creator?: User | null) => { 
        const payload = { ...data, ownerId: creator?.id };
        const docRef = await addDoc(collection(db, COLLECTIONS.INSTITUTIONS), cleanPayload(payload));
        if (creator && !creator.institutionId) await updateDoc(doc(db, COLLECTIONS.USERS, creator.id), { institutionId: docRef.id });
        return { ...data, id: docRef.id, ownerId: creator?.id }; 
    },
    updateInstitution: async (data: Institution) => { await updateDoc(doc(db, COLLECTIONS.INSTITUTIONS, data.id), cleanPayload(data)); },
    deleteInstitution: async (id: string) => { await deleteDoc(doc(db, COLLECTIONS.INSTITUTIONS, id)); },
    getClasses: async (currentUser?: User | null) => { 
        if (!currentUser) return [];
        let q;
        if (currentUser?.role === UserRole.ADMIN) q = collection(db, COLLECTIONS.CLASSES);
        else if (currentUser?.institutionId) q = query(collection(db, COLLECTIONS.CLASSES), where("institutionId", "==", currentUser.institutionId));
        else return [];
        const snap = await getDocs(q);
        return snap.docs.map(d => ({...(d.data() as object), id: d.id} as SchoolClass));
    },
    addClass: async (cls: SchoolClass) => { const docRef = await addDoc(collection(db, COLLECTIONS.CLASSES), cleanPayload(cls)); return { ...cls, id: docRef.id }; },
    updateClass: async (cls: SchoolClass) => { await updateDoc(doc(db, COLLECTIONS.CLASSES, cls.id), cleanPayload(cls)); },
    deleteClass: async (id: string) => { await deleteDoc(doc(db, COLLECTIONS.CLASSES, id)); },
    getStudents: async (classId: string) => { const q = query(collection(db, COLLECTIONS.STUDENTS), where("classId", "==", classId)); const snap = await getDocs(q); return snap.docs.map(d => ({ ...(d.data() as object), id: d.id } as Student)); },
    addStudent: async (s: any) => { await addDoc(collection(db, COLLECTIONS.STUDENTS), cleanPayload(s)); },
    updateStudent: async (id: string, data: any) => { await updateDoc(doc(db, COLLECTIONS.STUDENTS, id), cleanPayload(data)); },
    deleteStudent: async (id: string) => { await deleteDoc(doc(db, COLLECTIONS.STUDENTS, id)); },
    importStudents: async (classId: string, institutionId: string, list: any[]) => { const batch = writeBatch(db); list.forEach(s => { const ref = doc(collection(db, COLLECTIONS.STUDENTS)); batch.set(ref, { ...s, classId, institutionId, createdAt: new Date().toISOString() }); }); await batch.commit(); },

    // Plans & Payments
    getPlans: async () => { const snap = await getDocs(collection(db, COLLECTIONS.PLANS)); return snap.docs.map(d => ({ ...(d.data() as object), id: d.id } as Plan)); },
    savePlan: async (p: Plan) => { if (p.id) await updateDoc(doc(db, COLLECTIONS.PLANS, p.id), cleanPayload(p)); else await addDoc(collection(db, COLLECTIONS.PLANS), cleanPayload(p)); },
    deletePlan: async (id: string) => { await deleteDoc(doc(db, COLLECTIONS.PLANS, id)); },
    getPayments: async (userId: string) => { const q = query(collection(db, COLLECTIONS.PAYMENTS), where("userId", "==", userId)); const snap = await getDocs(q); return snap.docs.map(d => ({ ...(d.data() as object), id: d.id } as Payment)); },
    addPayment: async (p: any) => { await addDoc(collection(db, COLLECTIONS.PAYMENTS), { ...p, date: new Date().toISOString() }); },
    getAllPayments: async () => { const snap = await getDocs(collection(db, COLLECTIONS.PAYMENTS)); return snap.docs.map(d => ({ ...(d.data() as object), id: d.id } as Payment)); },

    // Marketing & Coupons
    getCampaigns: async () => { const snap = await getDocs(collection(db, COLLECTIONS.CAMPAIGNS)); return snap.docs.map(d => ({ ...(d.data() as object), id: d.id } as Campaign)); },
    addCampaign: async (c: any) => { await addDoc(collection(db, COLLECTIONS.CAMPAIGNS), cleanPayload(c)); },
    getCoupons: async () => { const snap = await getDocs(collection(db, COLLECTIONS.COUPONS)); return snap.docs.map(d => ({ ...(d.data() as object), id: d.id } as Coupon)); },
    addCoupon: async (c: Coupon) => { await addDoc(collection(db, COLLECTIONS.COUPONS), cleanPayload(c)); },
    updateCoupon: async (id: string, c: Partial<Coupon>) => { await updateDoc(doc(db, COLLECTIONS.COUPONS, id), cleanPayload(c)); },
    deleteCoupon: async (id: string) => { await deleteDoc(doc(db, COLLECTIONS.COUPONS, id)); },

    // System & Audit
    getSystemSettings: async () => { const snap = await getDoc(doc(db, COLLECTIONS.SETTINGS, 'global')); return snap.exists() ? (snap.data() as SystemSettings) : { banner: { active: false, message: '', type: 'INFO' }, aiConfig: { totalGenerations: 0, monthlyLimit: 1000, costPerRequestEst: 0.001 }, whiteLabel: { appName: 'Prova Fácil' } } as SystemSettings; },
    saveSystemSettings: async (s: SystemSettings) => { await setDoc(doc(db, COLLECTIONS.SETTINGS, 'global'), cleanPayload(s)); },
    getAuditLogs: async () => { const snap = await getDocs(query(collection(db, COLLECTIONS.AUDIT_LOGS), orderBy("timestamp", "desc"))); return snap.docs.map(d => ({ ...(d.data() as object), id: d.id } as AuditLog)); },
    trackAiUsage: async () => { try { await updateDoc(doc(db, COLLECTIONS.SETTINGS, 'global'), { "aiConfig.totalGenerations": increment(1) }); } catch (error) {} },

    // Support
    listenTickets: (user: User, callback: (ts: Ticket[]) => void) => { if (!user) return () => {}; const q = user.role === UserRole.ADMIN ? collection(db, COLLECTIONS.TICKETS) : query(collection(db, COLLECTIONS.TICKETS), where("authorId", "==", user.id)); return onSnapshot(q, (snap) => { callback(snap.docs.map(d => ({ ...(d.data() as object), id: d.id } as Ticket))); }); },
    listenTicketMessages: (ticketId: string, callback: (ms: TicketMessage[]) => void) => { const q = query(collection(db, COLLECTIONS.TICKET_MESSAGES), where("ticketId", "==", ticketId), orderBy("createdAt", "asc")); return onSnapshot(q, (snap) => { callback(snap.docs.map(d => ({ ...(d.data() as object), id: d.id } as TicketMessage))); }); },
    createTicket: async (t: any) => { await addDoc(collection(db, COLLECTIONS.TICKETS), { ...t, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); },
    addTicketMessage: async (ticketId: string, authorId: string, authorName: string, message: string, isAdminReply: boolean) => { await addDoc(collection(db, COLLECTIONS.TICKET_MESSAGES), { ticketId, authorId, authorName, message, isAdminReply, createdAt: new Date().toISOString() }); await updateDoc(doc(db, COLLECTIONS.TICKETS, ticketId), { updatedAt: new Date().toISOString() }); },
    updateTicketStatus: async (id: string, status: TicketStatus) => { await updateDoc(doc(db, COLLECTIONS.TICKETS, id), { status, updatedAt: new Date().toISOString() }); },
    getAdminOpenTicketsCount: async () => { const q = query(collection(db, COLLECTIONS.TICKETS), where("status", "!=", "CLOSED")); const snap = await getDocs(q); return snap.size; },

    // Tutorials & Contracts
    getTutorials: async () => { const snap = await getDocs(collection(db, COLLECTIONS.TUTORIALS)); return snap.docs.map(d => ({ ...(d.data() as object), id: d.id } as Tutorial)); },
    addTutorial: async (t: Tutorial) => { await addDoc(collection(db, COLLECTIONS.TUTORIALS), { ...cleanPayload(t), createdAt: new Date().toISOString() }); },
    deleteTutorial: async (id: string) => { await deleteDoc(doc(db, COLLECTIONS.TUTORIALS, id)); },
    getActiveContractForPlan: async (plan: string) => { const q = query(collection(db, COLLECTIONS.CONTRACT_TEMPLATES), where("isActive", "==", true)); const snap = await getDocs(q); const all = snap.docs.map(d => ({ ...(d.data() as object), id: d.id } as ContractTemplate)); all.sort((a, b) => (b.version || 0) - (a.version || 0)); return all.find(t => t.planId === plan || t.planId === 'ALL') || null; },
    getContractTemplates: async () => { const snap = await getDocs(collection(db, COLLECTIONS.CONTRACT_TEMPLATES)); return snap.docs.map(d => ({ ...(d.data() as object), id: d.id } as ContractTemplate)); },
    saveContractTemplate: async (t: any, forceNewVersion: boolean = false) => { if (!forceNewVersion && t.id) { await updateDoc(doc(db, COLLECTIONS.CONTRACT_TEMPLATES, t.id), { ...cleanPayload(t), updatedAt: new Date().toISOString() }); } else { const { id, ...data } = t; await addDoc(collection(db, COLLECTIONS.CONTRACT_TEMPLATES), { ...cleanPayload(data), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); } },
    signContract: async (user: User, template: ContractTemplate, typedName: string) => { await addDoc(collection(db, COLLECTIONS.SIGNATURES), { userId: user.id, userName: user.name, templateId: template.id, version: template.version, timestamp: new Date().toISOString(), typedName }); await updateDoc(doc(db, COLLECTIONS.USERS, user.id), { lastSignedContractId: template.id }); },
    
    generateCommercialToken: async (componentId: string, includeQuestions: boolean) => {
        const code = (Math.random().toString(36).substring(2, 6) + '-' + Math.random().toString(36).substring(2, 6)).toUpperCase();
        await setDoc(doc(db, COLLECTIONS.TOKENS, code), cleanPayload({
            code,
            componentId,
            includeQuestions,
            redeemed: false,
            createdAt: new Date().toISOString()
        }));
        return code;
    },

    redeemCommercialToken: async (code: string, user: User) => {
        const tokenRef = doc(db, COLLECTIONS.TOKENS, code);
        const tokenSnap = await getDoc(tokenRef);
        if (!tokenSnap.exists()) throw new Error("Código inválido.");
        const tokenData = tokenSnap.data();
        if (tokenData.redeemed) throw new Error("Este código já foi utilizado.");
        const currentGrants = Array.isArray(user.accessGrants) ? user.accessGrants : [];
        if (currentGrants.includes(tokenData.componentId)) throw new Error("Você já possui acesso a este conteúdo.");
        await updateDoc(doc(db, COLLECTIONS.USERS, user.id), cleanPayload({
            accessGrants: [...currentGrants, tokenData.componentId]
        }));
        await updateDoc(tokenRef, cleanPayload({ redeemed: true, redeemedBy: user.id, redeemedAt: new Date().toISOString() }));
    },
    
    seedDefaultContracts: async () => { },
};
