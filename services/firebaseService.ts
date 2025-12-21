
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
    onSnapshot
} from "firebase/firestore";
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    updateProfile, 
    deleteUser,
    sendPasswordResetEmail,
    updatePassword,
    getAuth
} from "firebase/auth";
import { initializeApp, deleteApp } from "firebase/app"; 
import { db, auth, firebaseConfig } from "../firebaseConfig";
import { User, UserRole, Discipline, Question, Exam, Institution, SchoolClass, Chapter, Unit, Topic, ExamAttempt, Plan, Payment, Campaign, AuditLog, Ticket, TicketMessage, Coupon, SystemSettings, Tutorial, Student, ContractTemplate, SignatureLog } from '../types';

const COLLECTIONS = {
    USERS: 'users',
    INSTITUTIONS: 'institutions',
    CLASSES: 'classes',
    STUDENTS: 'students', 
    QUESTIONS: 'questions',
    EXAMS: 'exams',
    ATTEMPTS: 'exam_attempts',
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

const safeLog = (message: string, error: any) => {
    console.error(message, error?.code || error?.message || String(error));
};

const cleanPayload = (data: any): any => {
    const process = (obj: any): any => {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return obj.toISOString();
        if (typeof obj.toDate === 'function') return obj.toDate().toISOString();
        const newObj: any = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const value = obj[key];
                if (value !== undefined && typeof value !== 'function' && !key.startsWith('_')) {
                    newObj[key] = process(value);
                }
            }
        }
        return newObj;
    };
    return process(data);
};

const isVisible = (item: any, user: User | null | undefined) => {
    if (!user) return false;
    if ((user.role as string) === UserRole.ADMIN) return true;
    if ('name' in item && 'logoUrl' in item && user.institutionId === item.id) return true;
    if (item.authorId === user.id) return true;
    if (item.isInstitutional && user.institutionId && item.institutionId === user.institutionId) return true;
    if (user.role === UserRole.TEACHER && user.subjects && user.subjects.length > 0) {
        if ('disciplineId' in item && item.disciplineId) {
            if (!user.subjects.includes(item.disciplineId)) return false;
        }
    }
    const sameInstitution = user.institutionId && item.institutionId === user.institutionId;
    if (user.role === UserRole.MANAGER && sameInstitution) return true;
    if ('enunciado' in item || 'visibility' in item) { 
        const q = item as Question;
        if (q.reviewStatus === 'APPROVED' && q.visibility === 'PUBLIC') {
            const userGrants = user.accessGrants || [];
            if (q.disciplineId && (userGrants.includes(q.disciplineId) || user.role === UserRole.ADMIN)) return true;
        }
        if (q.reviewStatus && q.reviewStatus !== 'APPROVED') return false;
        if (!q.visibility) return false; 
        if (q.visibility === 'PRIVATE') return false; 
        if (q.visibility === 'INSTITUTION') return sameInstitution || false;
    }
    if (item.authorId && item.authorId !== user.id) return false;
    if (!item.authorId) return true;
    return false;
};

const logAuditAction = async (action: AuditLog['action'], resource: string, details: string, targetId?: string, metadata?: any) => {
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        const userDocRef = doc(db, COLLECTIONS.USERS, currentUser.uid);
        const userSnap = await getDoc(userDocRef);
        const userData = userSnap.exists() ? userSnap.data() as User : null;
        const logEntry: any = {
            actorId: currentUser.uid,
            actorName: userData?.name || currentUser.displayName || 'Unknown',
            actorRole: userData?.role || 'UNKNOWN',
            action,
            targetResource: resource,
            targetId,
            details,
            metadata,
            timestamp: new Date().toISOString()
        };
        await addDoc(collection(db, COLLECTIONS.AUDIT_LOGS), cleanPayload(logEntry));
    } catch (e) {
        console.error("Failed to write audit log:", e);
    }
};

async function generateSHA256(message: string) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

export const FirebaseService = {
    // --- CONTRATOS ---
    getContractTemplates: async (): Promise<ContractTemplate[]> => {
        const snap = await getDocs(collection(db, COLLECTIONS.CONTRACT_TEMPLATES));
        return snap.docs.map(d => ({ ...d.data(), id: d.id } as ContractTemplate))
            .sort((a, b) => b.version - a.version);
    },

    saveContractTemplate: async (data: Partial<ContractTemplate>, forceResign: boolean = false) => {
        const planId = data.planId || 'ALL';
        const isNewDoc = !data.id || forceResign;
        if (data.isActive) {
            const q = query(
                collection(db, COLLECTIONS.CONTRACT_TEMPLATES), 
                where("planId", "==", planId),
                where("isActive", "==", true)
            );
            const activeSnap = await getDocs(q);
            const batch = writeBatch(db);
            activeSnap.forEach(d => {
                if (d.id !== data.id) batch.update(d.ref, { isActive: false });
            });
            await batch.commit();
        }
        const payload: any = { ...data, updatedAt: new Date().toISOString() };
        if (isNewDoc) {
            payload.createdAt = new Date().toISOString();
            if (forceResign) delete payload.id;
            const docRef = await addDoc(collection(db, COLLECTIONS.CONTRACT_TEMPLATES), cleanPayload(payload));
            await logAuditAction('CREATE', 'CONTRACT', `Contrato publicado (V${payload.version}): ${payload.title}`, docRef.id);
        } else {
            await updateDoc(doc(db, COLLECTIONS.CONTRACT_TEMPLATES, data.id!), cleanPayload(payload));
            await logAuditAction('UPDATE', 'CONTRACT', `Contrato atualizado (V${payload.version}): ${payload.title}`, data.id);
        }
    },

    seedDefaultContracts: async () => {
        const plans = (await getDocs(collection(db, COLLECTIONS.PLANS))).docs.map(d => d.data() as Plan);
        const batch = writeBatch(db);
        const generateContent = (planName: string) => `
            <div style="font-family: serif; max-width: 800px; margin: auto;">
                <h1 style="text-align: center; border-bottom: 2px solid black; padding-bottom: 10px;">CONTRATO DE LICENCIAMENTO DE SOFTWARE - PLANO ${planName.toUpperCase()}</h1>
                <p><strong>1. OBJETO:</strong> O presente contrato tem por objeto o licenciamento de uso da Plataforma Prova Fácil para o plano <strong>${planName}</strong>.</p>
                <p><strong>2. USO DE DADOS:</strong> O usuário concorda com a coleta de logs de auditoria e processamento de dados pedagógicos para fins de geração de relatórios de desempenho.</p>
                <p><strong>3. PROPRIEDADE INTELECTUAL:</strong> Todo o conteúdo gerado via Inteligência Artificial é de propriedade intelectual compartilhada, sendo vedada a comercialização direta das questões fora da plataforma sem autorização prévia.</p>
                <p><strong>4. RESPONSABILIDADE:</strong> A plataforma não se responsabiliza por erros pedagógicos em questões geradas automaticamente, cabendo ao professor a revisão final.</p>
                <p><strong>5. ASSINATURA:</strong> Ao clicar no botão de aceite, o usuário firma este compromisso eletrônico com validade jurídica plena sob a égide da MP 2.200-2/2001.</p>
                <br/>
                <p style="text-align: center;"><em>Assinado Eletronicamente via Prova Fácil SaaS</em></p>
            </div>
        `;
        for (const plan of plans) {
            const docRef = doc(collection(db, COLLECTIONS.PLANS));
            batch.set(docRef, cleanPayload({
                title: `Contrato Padrão - ${plan.name}`,
                planId: plan.name,
                content: generateContent(plan.name),
                version: 1,
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }));
        }
        const globalRef = doc(collection(db, COLLECTIONS.CONTRACT_TEMPLATES));
        batch.set(globalRef, cleanPayload({
            title: `Termos de Uso Gerais (Todos os Planos)`,
            planId: 'ALL',
            content: generateContent('GERAL'),
            version: 1,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }));
        await batch.commit();
        await logAuditAction('CREATE', 'CONTRACT', 'Seed de contratos padrão executado com sucesso');
    },

    deleteContractTemplate: async (id: string) => {
        await deleteDoc(doc(db, COLLECTIONS.CONTRACT_TEMPLATES, id));
        await logAuditAction('DELETE', 'CONTRACT', `Contrato removido`, id);
    },

    getActiveContractForPlan: async (planName: string): Promise<ContractTemplate | null> => {
        const q = query(
            collection(db, COLLECTIONS.CONTRACT_TEMPLATES),
            where("isActive", "==", true),
            where("planId", "in", [planName, "ALL"])
        );
        const snap = await getDocs(q);
        if (snap.empty) return null;
        const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as ContractTemplate));
        const specific = list.find(l => l.planId === planName);
        return specific || list[0];
    },

    signContract: async (user: User, template: ContractTemplate, typedName: string) => {
        const contentHash = await generateSHA256(template.content);
        const ipAddress = "Detectado via conexão segura"; 
        const signature: Omit<SignatureLog, 'id'> = {
            userId: user.id,
            userName: user.name,
            templateId: template.id,
            version: template.version,
            timestamp: new Date().toISOString(),
            ipAddress,
            userAgent: navigator.userAgent,
            contentHash,
            typedName
        };
        await addDoc(collection(db, COLLECTIONS.SIGNATURES), cleanPayload(signature));
        await updateDoc(doc(db, COLLECTIONS.USERS, user.id), { 
            lastSignedContractId: template.id 
        });
        await logAuditAction('SECURITY', 'CONTRACT', `Contrato assinado eletronicamente pelo usuário`, user.id, { templateId: template.id });
    },

    generateCommercialToken: async (disciplineId: string, includeQuestions: boolean) => {
        const code = Math.random().toString(36).substring(2, 10).toUpperCase();
        const tokenData = { code, disciplineId, includeQuestions, createdAt: new Date().toISOString(), status: 'ACTIVE', usedBy: null, usedAt: null };
        await setDoc(doc(db, COLLECTIONS.TOKENS, code), tokenData);
        await logAuditAction('CREATE', 'MARKETING', `Token comercial de USO ÚNICO gerado para disciplina ${disciplineId}`, code);
        return code;
    },

    redeemCommercialToken: async (code: string, user: User) => {
        const tokenRef = doc(db, COLLECTIONS.TOKENS, code.toUpperCase());
        const tokenSnap = await getDoc(tokenRef);
        if (!tokenSnap.exists()) throw new Error("Token inválido ou inexistente.");
        const tokenData = tokenSnap.data();
        if (tokenData.status !== 'ACTIVE' || tokenData.usedBy) throw new Error("Este token já foi utilizado ou está expirado.");
        const discRef = doc(db, COLLECTIONS.DISCIPLINES, tokenData.disciplineId);
        const discSnap = await getDoc(discRef);
        if (!discSnap.exists()) throw new Error("Disciplina de origem não encontrada.");
        const updates: any = { subjects: Array.from(new Set([...(user.subjects || []), tokenData.disciplineId])), accessGrants: Array.from(new Set([...(user.accessGrants || []), tokenData.disciplineId])) };
        await updateDoc(doc(db, COLLECTIONS.USERS, user.id), updates);
        await updateDoc(tokenRef, { status: 'USED', usedBy: user.id, usedAt: new Date().toISOString() });
        await logAuditAction('UPDATE', 'USER', `Resgate via Token: ${code}`, user.id);
        return discSnap.data().name;
    },

    getStudents: async (classId: string): Promise<Student[]> => {
        try {
            const q = query(collection(db, COLLECTIONS.STUDENTS), where("classId", "==", classId));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => ({ ...(d.data() as any), id: d.id } as Student)).sort((a,b) => a.name.localeCompare(b.name, 'pt-BR'));
        } catch (error) { safeLog("Erro ao buscar alunos:", error); return []; }
    },

    addStudent: async (student: Omit<Student, 'id' | 'createdAt'>) => {
        const data = cleanPayload({ ...student, createdAt: new Date().toISOString() });
        const docRef = await addDoc(collection(db, COLLECTIONS.STUDENTS), data);
        return docRef.id;
    },

    updateStudent: async (id: string, data: Partial<Student>) => { await updateDoc(doc(db, COLLECTIONS.STUDENTS, id), cleanPayload(data)); },
    deleteStudent: async (id: string) => { await deleteDoc(doc(db, COLLECTIONS.STUDENTS, id)); },

    importStudents: async (classId: string, institutionId: string, list: {name: string, registration: string}[]) => {
        const batch = writeBatch(db);
        list.forEach(item => {
            const newDocRef = doc(collection(db, COLLECTIONS.STUDENTS));
            batch.set(newDocRef, cleanPayload({ ...item, classId, institutionId, createdAt: new Date().toISOString() }));
        });
        await batch.commit();
        await logAuditAction('CREATE', 'CLASSES', `Importados ${list.length} alunos para turma`, classId);
    },

    getTutorials: async (): Promise<Tutorial[]> => {
        try {
            const q = query(collection(db, COLLECTIONS.TUTORIALS), orderBy("createdAt", "desc"));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => ({ ...(d.data() as any), id: d.id } as Tutorial));
        } catch (error) {
            try {
                const snapshot = await getDocs(collection(db, COLLECTIONS.TUTORIALS));
                return snapshot.docs.map(d => ({ ...(d.data() as any), id: d.id } as Tutorial));
            } catch (e) { return []; }
        }
    },

    addTutorial: async (tutorial: Omit<Tutorial, 'id' | 'createdAt'>) => {
        const data = cleanPayload({ ...tutorial, createdAt: new Date().toISOString() });
        const docRef = await addDoc(collection(db, COLLECTIONS.TUTORIALS), data);
        await logAuditAction('CREATE', 'SYSTEM', `Tutorial criado: ${tutorial.title}`, docRef.id);
        return docRef.id;
    },

    deleteTutorial: async (id: string) => {
        await deleteDoc(doc(db, COLLECTIONS.TUTORIALS, id));
        await logAuditAction('DELETE', 'SYSTEM', `Tutorial excluído`, id);
    },

    getSystemSettings: async (): Promise<SystemSettings> => {
        try {
            const docRef = doc(db, COLLECTIONS.SETTINGS, 'global');
            const snap = await getDoc(docRef);
            if (snap.exists()) return snap.data() as SystemSettings;
            const defaultSettings: SystemSettings = {
                banner: { active: false, message: 'Bem-vindo ao Prova Fácil!', type: 'INFO' },
                aiConfig: { totalGenerations: 0, monthlyLimit: 1000, costPerRequestEst: 0.0015 },
                whiteLabel: { appName: 'Prova Fácil', primaryColor: '#3A72EC' }
            };
            try { await setDoc(docRef, defaultSettings); } catch (e) {}
            return defaultSettings;
        } catch (error: any) {
            return { banner: { active: false, message: '', type: 'INFO' }, aiConfig: { totalGenerations: 0, monthlyLimit: 1000, costPerRequestEst: 0 }, whiteLabel: { appName: 'Prova Fácil' } };
        }
    },

    saveSystemSettings: async (settings: SystemSettings) => {
        await updateDoc(doc(db, COLLECTIONS.SETTINGS, 'global'), cleanPayload(settings));
        await logAuditAction('UPDATE', 'SYSTEM', 'Configurações globais atualizadas');
    },

    trackAiUsage: async () => { try { await updateDoc(doc(db, COLLECTIONS.SETTINGS, 'global'), { "aiConfig.totalGenerations": increment(1) }); } catch (error) {} },

    // --- SUPORTE / TICKETS ---
    listenTickets: (currentUser: User, callback: (tickets: Ticket[]) => void) => {
        const q = currentUser.role === UserRole.ADMIN 
            ? collection(db, COLLECTIONS.TICKETS)
            : query(collection(db, COLLECTIONS.TICKETS), where("authorId", "==", currentUser.id));

        return onSnapshot(q, (snapshot) => {
            const tickets = snapshot.docs.map(d => ({ ...(d.data() as any), id: d.id } as Ticket));
            const sortedTickets = tickets.sort((a, b) => 
                new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
            );
            callback(sortedTickets);
        }, (error) => {
            console.error("Error listening tickets:", error);
        });
    },

    listenTicketMessages: (ticketId: string, callback: (messages: TicketMessage[]) => void) => {
        const q = query(collection(db, COLLECTIONS.TICKET_MESSAGES), where("ticketId", "==", ticketId));
        return onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(d => ({ ...(d.data() as any), id: d.id } as TicketMessage));
            const sortedMsgs = msgs.sort((a, b) => 
                new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
            );
            callback(sortedMsgs);
        }, (error) => {
            console.error("Error listening messages:", error);
        });
    },

    getTickets: async (currentUser: User) => {
        try {
            let q = currentUser.role === UserRole.ADMIN 
                ? collection(db, COLLECTIONS.TICKETS)
                : query(collection(db, COLLECTIONS.TICKETS), where("authorId", "==", currentUser.id));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => ({ ...(d.data() as any), id: d.id } as Ticket))
                .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        } catch (error) {
            return [];
        }
    },

    getAdminOpenTicketsCount: async () => {
        try {
            const q = query(collection(db, COLLECTIONS.TICKETS), where("status", "==", "OPEN"));
            const snapshot = await getDocs(q);
            return snapshot.size;
        } catch (error) { return 0; }
    },

    createTicket: async (data: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt'>) => {
        const ticketData = { ...cleanPayload(data), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), lastMessageAt: new Date().toISOString() };
        const docRef = await addDoc(collection(db, COLLECTIONS.TICKETS), ticketData);
        await logAuditAction('CREATE', 'TICKET', `Novo chamado aberto: ${data.subject}`, docRef.id);
        return docRef.id;
    },

    addTicketMessage: async (ticketId: string, authorId: string, authorName: string, message: string, isAdminReply: boolean) => {
        const msgData: Omit<TicketMessage, 'id'> = { 
            ticketId: String(ticketId), 
            authorId: String(authorId), 
            authorName: String(authorName), 
            message: String(message), 
            createdAt: new Date().toISOString(), 
            isAdminReply: Boolean(isAdminReply) 
        };
        await addDoc(collection(db, COLLECTIONS.TICKET_MESSAGES), msgData);
        const ticketRef = doc(db, COLLECTIONS.TICKETS, ticketId);
        await updateDoc(ticketRef, { 
            updatedAt: new Date().toISOString(), 
            lastMessageAt: new Date().toISOString() 
        }).catch(err => console.warn("Could not update ticket timestamp", err));
    },

    getTicketMessages: async (ticketId: string) => {
        try {
            const q = query(collection(db, COLLECTIONS.TICKET_MESSAGES), where("ticketId", "==", ticketId));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => ({ ...(d.data() as any), id: d.id } as TicketMessage))
                .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        } catch (error) { return []; }
    },

    updateTicketStatus: async (ticketId: string, status: Ticket['status']) => {
        await updateDoc(doc(db, COLLECTIONS.TICKETS, ticketId), { status, updatedAt: new Date().toISOString() });
        await logAuditAction('UPDATE', 'TICKET', `Status alterado para ${status}`, ticketId);
    },

    getAuditLogs: async () => {
        try {
            const q = query(collection(db, COLLECTIONS.AUDIT_LOGS), limit(100));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => ({ ...(d.data() as any), id: d.id } as AuditLog))
                .sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        } catch (error) {
            return [];
        }
    },

    getCoupons: async () => {
        const q = query(collection(db, COLLECTIONS.COUPONS));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ ...(d.data() as any), id: d.id } as Coupon)).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },

    addCoupon: async (coupon: Omit<Coupon, 'id'>) => {
        const q = query(collection(db, COLLECTIONS.COUPONS), where("code", "==", coupon.code));
        const snap = await getDocs(q);
        if (!snap.empty) throw new Error("Este código de cupom já existe.");
        const docRef = await addDoc(collection(db, COLLECTIONS.COUPONS), cleanPayload(coupon));
        await logAuditAction('CREATE', 'MARKETING', `Cupom criado: ${coupon.code}`, docRef.id);
        return { ...coupon, id: docRef.id };
    },

    updateCoupon: async (id: string, data: Partial<Coupon>) => { await updateDoc(doc(db, COLLECTIONS.COUPONS, id), cleanPayload(data)); await logAuditAction('UPDATE', 'MARKETING', `Cupom atualizado`, id); },
    deleteCoupon: async (id: string) => { await deleteDoc(doc(db, COLLECTIONS.COUPONS, id)); await logAuditAction('DELETE', 'MARKETING', `Cupom excluído`, id); },

    register: async (email: string, pass: string, name: string, role: UserRole) => {
        const userCred = await createUserWithEmailAndPassword(auth, email, pass);
        const user = userCred.user;
        try {
            await updateProfile(user, { displayName: name });
            const userData: User = { id: user.uid, name, email, role, status: 'ACTIVE', plan: 'BASIC', subscriptionEnd: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0], accessGrants: [], subjects: [] };
            await setDoc(doc(db, COLLECTIONS.USERS, user.uid), userData);
            await logAuditAction('CREATE', 'USER', `Novo usuário registrado: ${email}`, user.uid);
            return userData;
        } catch (error: any) {
            try { await deleteUser(user); } catch(e) { }
            throw error;
        }
    },

    createSubUser: async (manager: User, data: { name: string, email: string, role: UserRole, subjects?: string[], password?: string }) => {
        const secondaryApp = initializeApp(firebaseConfig, "SecondaryAppCreation");
        const secondaryAuth = getAuth(secondaryApp);
        try {
            const tempPassword = data.password || Math.random().toString(36).slice(-8); 
            const userCred = await createUserWithEmailAndPassword(secondaryAuth, data.email, tempPassword);
            const newUserAuth = userCred.user;
            await updateProfile(newUserAuth, { displayName: data.name });
            const newUserDoc: any = { id: newUserAuth.uid, name: data.name, email: data.email, role: data.role, status: 'ACTIVE', plan: manager.plan, subscriptionEnd: manager.subscriptionEnd, ownerId: manager.id, accessGrants: [], subjects: data.subjects || [], requiresPasswordChange: true };
            if (manager.institutionId) newUserDoc.institutionId = manager.institutionId;
            await setDoc(doc(db, COLLECTIONS.USERS, newUserAuth.uid), newUserDoc);
            await logAuditAction('CREATE', 'USER', `Gestor criou sub-usuário: ${data.email}`, newUserAuth.uid, { createdBy: manager.id });
            await signOut(secondaryAuth);
            return newUserDoc as User;
        } finally { await deleteApp(secondaryApp); }
    },

    login: async (email: string, pass: string) => {
        const cred = await signInWithEmailAndPassword(auth, email, pass);
        await logAuditAction('LOGIN', 'SESSION', `Login realizado com sucesso`, cred.user.uid);
        return await FirebaseService.getCurrentUserData();
    },

    logout: async () => { await signOut(auth); },

    changeUserPassword: async (newPassword: string) => {
        const user = auth.currentUser;
        if (!user) throw new Error("Usuário não autenticado.");
        await updatePassword(user, newPassword);
        await updateDoc(doc(db, COLLECTIONS.USERS, user.uid), { requiresPasswordChange: false });
        await logAuditAction('UPDATE', 'USER', 'Senha alterada pelo usuário', user.uid);
        return true;
    },

    resetPassword: async (email: string) => {
        await sendPasswordResetEmail(auth, email);
        await logAuditAction('SECURITY', 'USER', `Solicitação de reset de senha para ${email}`);
    },

    getCurrentUserData: async () => {
        const user = auth.currentUser;
        if (!user) return null;
        const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, user.uid));
        if (userDoc.exists()) return userDoc.data() as User;
        const recoveredUser: User = { id: user.uid, name: user.displayName || 'Usuário', email: user.email || '', role: UserRole.TEACHER, status: 'ACTIVE', plan: 'BASIC', subscriptionEnd: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0], accessGrants: [] };
        await setDoc(doc(db, COLLECTIONS.USERS, user.uid), recoveredUser);
        return recoveredUser;
    },

    getUserByEmail: async (email: string) => {
        const q = query(collection(db, COLLECTIONS.USERS), where("email", "==", email));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;
        return snapshot.docs[0].data() as User;
    },

    updateUser: async (uid: string, data: Partial<User>) => {
        await updateDoc(doc(db, COLLECTIONS.USERS, uid), cleanPayload(data));
        if (auth.currentUser && auth.currentUser.uid === uid) {
            const profileUpdates: any = {};
            if (data.name) profileUpdates.displayName = data.name;
            if (data.photoUrl && !data.photoUrl.startsWith('data:')) profileUpdates.photoURL = data.photoUrl;
            if (Object.keys(profileUpdates).length > 0) await updateProfile(auth.currentUser, profileUpdates);
        }
        if (Object.keys(data).length > 0) await logAuditAction('UPDATE', 'USER', `Perfil de usuário atualizado`, uid, { fields: Object.keys(data) });
    },
    
    deleteUserDocument: async (uid: string) => { await deleteDoc(doc(db, COLLECTIONS.USERS, uid)); await logAuditAction('DELETE', 'USER', `Usuário excluído do sistema`, uid); },

    getUsers: async (currentUser?: User | null) => {
        if (!currentUser) return [];
        const snapshot = await getDocs(collection(db, COLLECTIONS.USERS));
        const allUsers = snapshot.docs.map(d => d.data() as User);
        if (currentUser.role === UserRole.ADMIN) return allUsers;
        if (currentUser.role === UserRole.MANAGER) return allUsers.filter(u => u.ownerId === currentUser.id || (currentUser.institutionId && u.institutionId === currentUser.institutionId));
        return []; 
    },

    addPayment: async (paymentData: Omit<Payment, 'id' | 'date'>) => {
        const paymentRef = await addDoc(collection(db, COLLECTIONS.PAYMENTS), { ...cleanPayload(paymentData), date: new Date().toISOString() });
        const userDocRef = doc(db, COLLECTIONS.USERS, paymentData.userId);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
            const user = userSnap.data() as User;
            const today = new Date();
            const currentEnd = new Date(user.subscriptionEnd);
            let baseDate = currentEnd > today ? currentEnd : today;
            const newEnd = new Date(baseDate);
            newEnd.setMonth(newEnd.getMonth() + paymentData.periodMonths);
            await updateDoc(userDocRef, { subscriptionEnd: newEnd.toISOString().split('T')[0], plan: paymentData.planName, status: 'ACTIVE' });
        }
        await logAuditAction('UPDATE', 'FINANCE', `Pagamento registrado: R$ ${paymentData.amount}`, paymentData.userId);
        return paymentRef.id;
    },

    getPayments: async (userId: string) => {
        const q = query(collection(db, COLLECTIONS.PAYMENTS), where("userId", "==", userId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ ...(d.data() as any), id: d.id } as Payment)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },

    getAllPayments: async () => {
        const q = query(collection(db, COLLECTIONS.PAYMENTS));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ ...(d.data() as any), id: d.id } as Payment))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },

    getCampaigns: async () => {
        const q = query(collection(db, COLLECTIONS.CAMPAIGNS));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ ...(d.data() as any), id: d.id } as Campaign)).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },

    addCampaign: async (campaign: Omit<Campaign, 'id'>) => { const docRef = await addDoc(collection(db, COLLECTIONS.CAMPAIGNS), cleanPayload(campaign)); return { ...campaign, id: docRef.id }; },
    updateCampaign: async (id: string, data: Partial<Campaign>) => { await updateDoc(doc(db, COLLECTIONS.CAMPAIGNS, id), cleanPayload(data)); },

    getInstitutions: async (currentUser?: User | null) => {
        if (!currentUser) return [];
        const snapshot = await getDocs(collection(db, COLLECTIONS.INSTITUTIONS));
        return snapshot.docs.map(d => ({ ...(d.data() as any), id: d.id } as Institution)).filter(item => { 
            if (currentUser.institutionId && item.id === currentUser.institutionId) return true; 
            return isVisible(item, currentUser); 
        });
    },

    getInstitutionById: async (id: string): Promise<Institution | null> => {
        const docRef = doc(db, COLLECTIONS.INSTITUTIONS, id);
        const snap = await getDoc(docRef);
        if (snap.exists()) return { ...(snap.data() as any), id: snap.id } as Institution;
        return null;
    },
    
    addInstitution: async (data: Institution) => { 
        const { id, ...rest } = data; 
        const payload: any = cleanPayload(rest); 
        if (auth.currentUser?.uid) payload.authorId = auth.currentUser.uid; 
        const docRef = await addDoc(collection(db, COLLECTIONS.INSTITUTIONS), payload); 
        if (auth.currentUser) { 
            const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, auth.currentUser.uid)); 
            const userData = userDoc.data() as User; 
            if (userData.role === UserRole.MANAGER && !userData.institutionId) await updateDoc(doc(db, COLLECTIONS.USERS, auth.currentUser.uid), { institutionId: docRef.id }); 
        } 
        return { ...data, id: docRef.id }; 
    },
    
    updateInstitution: async (data: Institution) => { await updateDoc(doc(db, COLLECTIONS.INSTITUTIONS, data.id), cleanPayload(data)); return data; },
    deleteInstitution: async (id: string) => { await deleteDoc(doc(db, COLLECTIONS.INSTITUTIONS, id)); },
    
    getClasses: async (currentUser?: User | null) => { if (!currentUser) return []; const snapshot = await getDocs(collection(db, COLLECTIONS.CLASSES)); return snapshot.docs.map(d => ({ ...(d.data() as any), id: d.id } as SchoolClass)).filter(item => { if (currentUser.role === UserRole.TEACHER && currentUser.institutionId && item.institutionId === currentUser.institutionId) return true; return isVisible(item, currentUser); }); },
    
    addClass: async (data: SchoolClass) => { 
        const { id, ...rest } = data; 
        const payload: any = cleanPayload(rest); 
        if (auth.currentUser?.uid) payload.authorId = auth.currentUser.uid; 
        const docRef = await addDoc(collection(db, COLLECTIONS.CLASSES), payload); 
        return { ...data, id: docRef.id }; 
    },
    
    updateClass: async (data: SchoolClass) => { await updateDoc(doc(db, COLLECTIONS.CLASSES, data.id), cleanPayload(data)); return data; },
    deleteClass: async (id: string) => { await deleteDoc(doc(db, COLLECTIONS.CLASSES, id)); },
    
    getHierarchy: async (currentUser?: User | null): Promise<Discipline[]> => { 
        const [dSnap, cSnap, uSnap, tSnap] = await Promise.all([getDocs(collection(db, COLLECTIONS.DISCIPLINES)), getDocs(collection(db, COLLECTIONS.CHAPTERS)), getDocs(collection(db, COLLECTIONS.UNITS)), getDocs(collection(db, COLLECTIONS.TOPICS))]); 
        const sortByCreated = (a: any, b: any) => { if (!a.createdAt && !b.createdAt) return 0; if (!a.createdAt) return -1; if (!b.createdAt) return 1; return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); }; 
        let disciplines = dSnap.docs.map(d => ({ ...d.data() as any, id: d.id, chapters: [] } as Discipline)).sort(sortByCreated); 
        const chapters = cSnap.docs.map(c => ({ ...c.data() as any, id: c.id, units: [] } as Chapter)).sort(sortByCreated); 
        const units = uSnap.docs.map(u => ({ ...u.data() as any, id: u.id, topics: [] } as Unit)).sort(sortByCreated); 
        const topics = tSnap.docs.map(t => ({ ...t.data() as any, id: t.id } as Topic)).sort(sortByCreated); 
        units.forEach(u => { u.topics = topics.filter(t => t.unitId === u.id); }); 
        chapters.forEach(c => { c.units = units.filter(u => u.chapterId === c.id); }); 
        disciplines.forEach(d => { d.chapters = chapters.filter(c => c.disciplineId === d.id); }); 
        if (currentUser?.role === UserRole.TEACHER) { if (currentUser.subjects && currentUser.subjects.length > 0) return disciplines.filter(d => currentUser.subjects!.includes(d.id)); return []; }
        return disciplines; 
    },
    
    addDiscipline: async (name: string) => { const payload: any = { name, createdAt: new Date().toISOString() }; if (auth.currentUser?.uid) payload.authorId = auth.currentUser.uid; await addDoc(collection(db, COLLECTIONS.DISCIPLINES), payload); },
    addChapter: async (disciplineId: string, name: string) => { const payload: any = { disciplineId, name, createdAt: new Date().toISOString() }; if (auth.currentUser?.uid) payload.authorId = auth.currentUser.uid; await addDoc(collection(db, COLLECTIONS.CHAPTERS), payload); },
    addUnit: async (disciplineId: string, chapterId: string, name: string) => { const payload: any = { chapterId, name, createdAt: new Date().toISOString() }; if (auth.currentUser?.uid) payload.authorId = auth.currentUser.uid; await addDoc(collection(db, COLLECTIONS.UNITS), payload); },
    addTopic: async (disciplineId: string, chapterId: string, unitId: string, name: string) => { const payload: any = { unitId, name, createdAt: new Date().toISOString() }; if (auth.currentUser?.uid) payload.authorId = auth.currentUser.uid; await addDoc(collection(db, COLLECTIONS.TOPICS), payload); },
    updateHierarchyItem: async (type: 'discipline'|'chapter'|'unit'|'topic', id: string, newName: string) => { let col = COLLECTIONS.DISCIPLINES; if (type === 'chapter') col = COLLECTIONS.CHAPTERS; if (type === 'unit') col = COLLECTIONS.UNITS; if (type === 'topic') col = COLLECTIONS.TOPICS; await updateDoc(doc(db, col, id), { name: newName }); },
    deleteItem: async (type: 'discipline'|'chapter'|'unit'|'topic', ids: {dId?: string, cId?: string, uId?: string, tId?: string}) => { const batch = writeBatch(db); if (type === 'topic' && ids.tId) batch.delete(doc(db, COLLECTIONS.TOPICS, ids.tId)); else if (type === 'unit' && ids.uId) { batch.delete(doc(db, COLLECTIONS.UNITS, ids.uId)); const qT = query(collection(db, COLLECTIONS.TOPICS), where("unitId", "==", ids.uId)); (await getDocs(qT)).forEach(d => batch.delete(d.ref)); } else if (type === 'chapter' && ids.cId) { batch.delete(doc(db, COLLECTIONS.CHAPTERS, ids.cId)); const qU = query(collection(db, COLLECTIONS.UNITS), where("chapterId", "==", ids.cId)); for (const uDoc of (await getDocs(qU)).docs) { batch.delete(uDoc.ref); (await getDocs(query(collection(db, COLLECTIONS.TOPICS), where("unitId", "==", uDoc.id)))).forEach(t => batch.delete(t.ref)); } } else if (type === 'discipline' && ids.dId) { batch.delete(doc(db, COLLECTIONS.DISCIPLINES, ids.dId)); for (const cDoc of (await getDocs(query(collection(db, COLLECTIONS.CHAPTERS), where("disciplineId", "==", ids.dId)))).docs) { batch.delete(cDoc.ref); for (const uDoc of (await getDocs(query(collection(db, COLLECTIONS.UNITS), where("chapterId", "==", cDoc.id)))).docs) { batch.delete(uDoc.ref); (await getDocs(query(collection(db, COLLECTIONS.TOPICS), where("unitId", "==", uDoc.id)))).forEach(t => batch.delete(t.ref)); } } } await batch.commit(); },
    
    getQuestions: async (currentUser?: User | null) => { if (!currentUser) return []; const snapshot = await getDocs(collection(db, COLLECTIONS.QUESTIONS)); return snapshot.docs.map(d => ({ ...(d.data() as any), id: d.id } as Question)).filter(item => isVisible(item, currentUser)); },
    getPendingQuestions: async () => { const snapshot = await getDocs(query(collection(db, COLLECTIONS.QUESTIONS), where("reviewStatus", "==", "PENDING"))); return snapshot.docs.map(d => ({ ...(d.data() as any), id: d.id } as Question)).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); },
    approveQuestion: async (id: string) => { await updateDoc(doc(db, COLLECTIONS.QUESTIONS, id), { reviewStatus: 'APPROVED', rejectionReason: null }); await logAuditAction('UPDATE', 'MODERATION', 'Questão aprovada', id); },
    rejectQuestion: async (id: string, reason: string) => { await updateDoc(doc(db, COLLECTIONS.QUESTIONS, id), { reviewStatus: 'REJECTED', rejectionReason: reason }); await logAuditAction('UPDATE', 'MODERATION', `Questão rejeitada: ${reason}`, id); },
    
    approveInstitutionalQuestion: async (id: string, managerId: string) => {
        const qDocRef = doc(db, COLLECTIONS.QUESTIONS, id);
        const qSnap = await getDoc(qDocRef);
        if (!qSnap.exists()) return;
        const qData = qSnap.data() as Question;
        const updates: Partial<Question> = { isInstitutional: true, institutionalApprovedById: managerId, reviewStatus: qData.visibility === 'PUBLIC' ? 'APPROVED' : qData.reviewStatus };
        await updateDoc(qDocRef, cleanPayload(updates));
        await logAuditAction('UPDATE', 'INSTITUTION', 'Questão aprovada para Banco Institucional', id);
    },

    removeInstitutionalSeal: async (id: string) => { await updateDoc(doc(db, COLLECTIONS.QUESTIONS, id), { isInstitutional: false, institutionalApprovedById: null }); await logAuditAction('UPDATE', 'INSTITUTION', 'Selo Institucional removido', id); },

    addQuestion: async (q: Question) => { 
        const data: any = cleanPayload(q); if (data.id) delete data.id; 
        const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, auth.currentUser!.uid));
        const userData = userDoc.data() as User;
        if (!data.authorId) data.authorId = auth.currentUser!.uid; 
        if (!data.institutionId && userData.institutionId) data.institutionId = userData.institutionId; 
        if (userData.role === UserRole.ADMIN || userData.role === UserRole.MANAGER) { data.reviewStatus = 'APPROVED'; if (userData.role === UserRole.MANAGER) data.isInstitutional = true; } else { data.reviewStatus = (data.visibility === 'PUBLIC') ? 'PENDING' : 'APPROVED'; }
        if (!data.visibility) data.visibility = 'PUBLIC'; 
        const docRef = await addDoc(collection(db, COLLECTIONS.QUESTIONS), data); return { ...q, id: docRef.id }; 
    },
    updateQuestion: async (q: Question) => { 
        const { id, ...rest } = q; 
        const data: any = cleanPayload(rest); 
        const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, auth.currentUser!.uid));
        const userData = userDoc.data() as User;
        if (data.visibility === 'PUBLIC' && userData.role !== UserRole.ADMIN && userData.role !== UserRole.MANAGER) { data.reviewStatus = 'PENDING'; }
        await updateDoc(doc(db, COLLECTIONS.QUESTIONS, id!), data); 
    },
    deleteQuestion: async (id: string) => { await deleteDoc(doc(db, COLLECTIONS.QUESTIONS, id)); },
    getExams: async (currentUser?: User | null) => { if (!currentUser) return []; const snapshot = await getDocs(collection(db, COLLECTIONS.EXAMS)); return snapshot.docs.map(d => ({ ...(d.data() as any), id: d.id } as Exam)).filter(item => isVisible(item, currentUser)); },
    getExamById: async (id: string) => { const snap = await getDoc(doc(db, COLLECTIONS.EXAMS, id)); if (snap.exists()) return { ...(snap.data() as any), id: snap.id } as Exam; return null; },
    saveExam: async (exam: Exam) => { 
        const data: any = cleanPayload(exam); const id = data.id; if (data.id) delete data.id; 
        if (!data.authorId && auth.currentUser) { data.authorId = auth.currentUser.uid; if (!data.institutionId) { const u = (await getDoc(doc(db, COLLECTIONS.USERS, auth.currentUser.uid))).data() as User; if (u.institutionId) data.institutionId = u.institutionId; } } 
        if (id) { await updateDoc(doc(db, COLLECTIONS.EXAMS, id), data); return { ...exam, id }; } else { const docRef = await addDoc(collection(db, COLLECTIONS.EXAMS), data); return { ...exam, id: docRef.id }; } 
    },
    deleteExam: async (id: string) => { await deleteDoc(doc(db, COLLECTIONS.EXAMS, id)); await logAuditAction('DELETE', 'EXAM', `Prova excluída`, id); },
    getPlans: async () => (await getDocs(collection(db, COLLECTIONS.PLANS))).docs.map(d => ({ ...(d.data() as any), id: d.id } as Plan)),
    savePlan: async (plan: Plan) => { const data: any = cleanPayload(plan); const id = data.id; if (data.id) delete data.id; if (id) { await updateDoc(doc(db, COLLECTIONS.PLANS, id), data); return { ...plan, id }; } else { const docRef = await addDoc(collection(db, COLLECTIONS.PLANS), data); return { ...plan, id: docRef.id }; } },
    deletePlan: async (id: string) => { await deleteDoc(doc(db, COLLECTIONS.PLANS, id)); },
    startAttempt: async (examId: string, studentName: string, studentIdentifier: string, totalQuestions: number, studentId?: string): Promise<ExamAttempt> => { const attempt: Partial<ExamAttempt> = { examId, studentName, studentIdentifier, studentId, totalQuestions, startedAt: new Date().toISOString(), answers: {}, score: 0, status: 'IN_PROGRESS' }; const docRef = await addDoc(collection(db, COLLECTIONS.ATTEMPTS), cleanPayload(attempt)); return { ...attempt, id: docRef.id } as ExamAttempt; },
    submitAttempt: async (id: string, answers: Record<string, string>, score: number, totalQuestions: number) => { await updateDoc(doc(db, COLLECTIONS.ATTEMPTS, id), { answers, score, totalQuestions, submittedAt: new Date().toISOString(), status: 'COMPLETED' }); },
    updateAttemptScore: async (id: string, score: number) => { await updateDoc(doc(db, COLLECTIONS.ATTEMPTS, id), { score }); await logAuditAction('UPDATE', 'ATTEMPT', `Nota alterada manualmente para ${score}`, id); },
    getStudentAttempts: async (examId: string, identifier: string) => (await getDocs(query(collection(db, COLLECTIONS.ATTEMPTS), where("examId", "==", examId), where("studentIdentifier", "==", identifier)))).docs.map(d => ({ ...(d.data() as any), id: d.id } as ExamAttempt)),
    getExamResults: async (examId: string) => (await getDocs(query(collection(db, COLLECTIONS.ATTEMPTS), where("examId", "==", examId)))).docs.map(d => ({ ...(d.data() as any), id: d.id } as ExamAttempt)),
    getFullHierarchyString: (q: Question, hierarchy: Discipline[]) => { const disc = hierarchy.find(d => d.id === q.disciplineId); const chap = disc?.chapters.find(c => c.id === q.chapterId); const unit = chap?.units.find(u => u.id === q.unitId); const topic = unit?.topics.find(t => t.id === q.topicId); return `${disc?.name || '?'} > ${chap?.name || '?'} > ${unit?.name || '?'} > ${topic?.name || '?'}`; }
};
