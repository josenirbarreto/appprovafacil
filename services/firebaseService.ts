
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
    limit
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
import { User, UserRole, Discipline, Question, Exam, Institution, SchoolClass, Chapter, Unit, Topic, ExamAttempt, Plan, Payment, Campaign, AuditLog, Ticket, TicketMessage } from '../types';

const COLLECTIONS = {
    USERS: 'users',
    INSTITUTIONS: 'institutions',
    CLASSES: 'classes',
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
    AUDIT_LOGS: 'audit_logs',
    TICKETS: 'tickets', // NOVO
    TICKET_MESSAGES: 'ticket_messages' // NOVO
};

const safeLog = (message: string, error: any) => {
    console.error(message, error?.code || error?.message || String(error));
};

// Função para limpar dados antes de enviar ao Firestore
// Remove undefined e previne erro de referência circular
const cleanPayload = (data: any): any => {
    const seen = new WeakSet();
    
    const process = (obj: any): any => {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return obj.toISOString();
        
        // Evita objetos complexos do DOM ou React que causam erro de ciclo
        if (obj.constructor && (obj.constructor.name === 'SyntheticBaseEvent' || obj.nodeType)) {
            return null;
        }

        if (seen.has(obj)) {
            // Se encontrar ciclo, ignora ou retorna null
            return null;
        }
        seen.add(obj);

        if (Array.isArray(obj)) {
            return obj.map(process).filter(v => v !== undefined);
        }

        const newObj: any = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const value = obj[key];
                if (value !== undefined && typeof value !== 'function') {
                    // Evita recursão em propriedades internas do Firebase ou objetos desconhecidos
                    if (key.startsWith('_') || key === 'auth' || key === 'firestore' || key === 'app') {
                        continue;
                    }
                    newObj[key] = process(value);
                }
            }
        }
        return newObj;
    };

    return process(data);
};

// Função de Visibilidade Centralizada
const isVisible = (item: any, user: User | null | undefined) => {
    if (!user) return false;
    
    // 1. ADMIN vê tudo
    if (user.role === UserRole.ADMIN) return true;
    
    // 2. DONO sempre vê seus itens (regra suprema)
    if (item.authorId === user.id) return true;

    // --- NOVA REGRA: FILTRO DE MATÉRIA PARA PROFESSOR ---
    // Se for Professor e tiver subjects definidos, e o item tiver disciplineId,
    // verifica se a disciplina do item está nas subjects permitidas.
    // (Ignora se for o dono, pois já passou no check 2)
    if (user.role === UserRole.TEACHER && user.subjects && user.subjects.length > 0) {
        // Verifica se é um item que possui vínculo com disciplina (Questão, Prova, etc)
        if ('disciplineId' in item && item.disciplineId) {
            if (!user.subjects.includes(item.disciplineId)) {
                return false;
            }
        }
    }
    // ----------------------------------------------------

    // 3. Lógica para MANAGER (Vê itens dos seus professores/instituição)
    const sameInstitution = user.institutionId && item.institutionId === user.institutionId;
    if (user.role === UserRole.MANAGER && sameInstitution) {
        return true;
    }
    
    // 4. Lógica Específica para QUESTÕES
    if ('enunciado' in item || 'visibility' in item) { 
        const q = item as Question;
        if (!q.visibility) return false; 
        if (q.visibility === 'PRIVATE') return false; 
        if (q.visibility === 'INSTITUTION') return sameInstitution || false;
        if (q.visibility === 'PUBLIC') {
            const userGrants = user.accessGrants || [];
            if (q.disciplineId && userGrants.includes(q.disciplineId)) return true;
            return false;
        }
    }

    if (item.authorId && item.authorId !== user.id) return false;
    if (!item.authorId) return true;
    
    return false;
};

// --- HELPER: REGISTRO DE AUDITORIA INTERNO ---
const logAuditAction = async (
    action: AuditLog['action'], 
    resource: string, 
    details: string, 
    targetId?: string,
    metadata?: any
) => {
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) return; // Só loga ações de usuários autenticados

        // Busca dados extras do usuário (role, name)
        // Otimização: Se já tivermos o User object na sessão, usaríamos, mas aqui garantimos consistência
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

        // Aplica cleanPayload no objeto inteiro para remover chaves com valor undefined
        const cleanedLogEntry = cleanPayload(logEntry);

        await addDoc(collection(db, COLLECTIONS.AUDIT_LOGS), cleanedLogEntry);
    } catch (e) {
        // Falha silenciosa no log para não bloquear a ação principal, mas log no console
        console.error("Failed to write audit log:", e);
    }
};

export const FirebaseService = {
    // --- SUPPORT / TICKETS (NOVO) ---
    getTickets: async (currentUser: User) => {
        try {
            let q;
            if (currentUser.role === UserRole.ADMIN) {
                // Admin vê todos, ordenado por data de atualização (mais recente primeiro)
                q = query(collection(db, COLLECTIONS.TICKETS), orderBy("updatedAt", "desc"));
            } else {
                // Usuário vê apenas os seus
                q = query(
                    collection(db, COLLECTIONS.TICKETS), 
                    where("authorId", "==", currentUser.id),
                    orderBy("updatedAt", "desc")
                );
            }
            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Ticket));
        } catch (error) {
            safeLog("Erro ao buscar tickets:", error);
            // Fallback sem orderBy se índice não existir
            try {
                const qFallback = query(collection(db, COLLECTIONS.TICKETS), where("authorId", "==", currentUser.id));
                const snap = await getDocs(qFallback);
                return snap.docs.map(d => ({ ...d.data(), id: d.id } as Ticket));
            } catch (e) {
                return [];
            }
        }
    },

    getAdminOpenTicketsCount: async () => {
        try {
            // Conta rápida para o badge do menu
            const q = query(
                collection(db, COLLECTIONS.TICKETS), 
                where("status", "==", "OPEN")
            );
            const snapshot = await getDocs(q);
            return snapshot.size;
        } catch (error) {
            return 0;
        }
    },

    createTicket: async (data: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt'>) => {
        try {
            const ticketData = {
                ...cleanPayload(data),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                lastMessageAt: new Date().toISOString()
            };
            const docRef = await addDoc(collection(db, COLLECTIONS.TICKETS), ticketData);
            
            await logAuditAction('CREATE', 'TICKET', `Novo chamado aberto: ${data.subject}`, docRef.id);
            return docRef.id;
        } catch (error) {
            safeLog("Erro ao criar ticket:", error);
            throw error;
        }
    },

    addTicketMessage: async (ticketId: string, authorId: string, authorName: string, message: string, isAdminReply: boolean) => {
        try {
            const msgData: Omit<TicketMessage, 'id'> = {
                ticketId,
                authorId,
                authorName,
                message,
                createdAt: new Date().toISOString(),
                isAdminReply
            };
            
            await addDoc(collection(db, COLLECTIONS.TICKET_MESSAGES), cleanPayload(msgData));
            
            // Atualiza timestamp do ticket para subir na lista
            const updateData: any = { updatedAt: new Date().toISOString() };
            
            // Se Admin responder, status muda para IN_PROGRESS automaticamente se estiver OPEN
            if (isAdminReply) {
                // Check current status first ideally, but blind update is acceptable for MVP
                // Optional: updateData.status = 'IN_PROGRESS';
            } else {
                // Se usuário responder, reabre se estiver RESOLVED? (Regra de negócio opcional)
            }

            await updateDoc(doc(db, COLLECTIONS.TICKETS, ticketId), updateData);

        } catch (error) {
            safeLog("Erro ao enviar mensagem:", error);
            throw error;
        }
    },

    getTicketMessages: async (ticketId: string) => {
        try {
            const q = query(
                collection(db, COLLECTIONS.TICKET_MESSAGES), 
                where("ticketId", "==", ticketId),
                orderBy("createdAt", "asc")
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as TicketMessage));
        } catch (error) {
            safeLog("Erro ao buscar mensagens:", error);
            return [];
        }
    },

    updateTicketStatus: async (ticketId: string, status: Ticket['status']) => {
        try {
            await updateDoc(doc(db, COLLECTIONS.TICKETS, ticketId), { 
                status,
                updatedAt: new Date().toISOString()
            });
            await logAuditAction('UPDATE', 'TICKET', `Status alterado para ${status}`, ticketId);
        } catch (error) {
            safeLog("Erro ao atualizar status:", error);
            throw error;
        }
    },

    // --- AUDIT LOGS (NOVO) ---
    getAuditLogs: async () => {
        try {
            // Busca os últimos 100 logs
            const q = query(
                collection(db, COLLECTIONS.AUDIT_LOGS), 
                orderBy("timestamp", "desc"), 
                limit(100)
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as AuditLog));
        } catch (error) {
            safeLog("Erro ao buscar logs:", error);
            return [];
        }
    },

    // --- AUTENTICAÇÃO ---
    register: async (email: string, pass: string, name: string, role: UserRole) => {
        const userCred = await createUserWithEmailAndPassword(auth, email, pass);
        const user = userCred.user;
        
        try {
            await updateProfile(user, { displayName: name });
            const userData: User = {
                id: user.uid,
                name,
                email,
                role,
                status: 'ACTIVE',
                plan: 'BASIC',
                subscriptionEnd: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
                accessGrants: [],
                subjects: []
            };

            await setDoc(doc(db, COLLECTIONS.USERS, user.uid), userData);
            
            // LOG REGISTRO
            await logAuditAction('CREATE', 'USER', `Novo usuário registrado: ${email}`, user.uid);
            
            return userData;
        } catch (error: any) {
            safeLog("Erro no cadastro Firestore:", error);
            if (error?.code === 'permission-denied') {
                throw new Error("Erro de Permissão: O banco de dados recusou a gravação.");
            }
            try { await deleteUser(user); } catch(e) { }
            throw error;
        }
    },

    createSubUser: async (manager: User, data: { name: string, email: string, role: UserRole, subjects?: string[], password?: string }) => {
        // TÉCNICA DE APP SECUNDÁRIO
        const secondaryApp = initializeApp(firebaseConfig, "SecondaryAppCreation");
        const secondaryAuth = getAuth(secondaryApp);

        try {
            const tempPassword = data.password || Math.random().toString(36).slice(-8); 
            const userCred = await createUserWithEmailAndPassword(secondaryAuth, data.email, tempPassword);
            const newUserAuth = userCred.user;

            await updateProfile(newUserAuth, { displayName: data.name });

            // CRIAÇÃO DO DOCUMENTO COM FLAG DE TROCA DE SENHA
            const newUserDoc: any = {
                id: newUserAuth.uid,
                name: data.name,
                email: data.email,
                role: data.role,
                status: 'ACTIVE',
                plan: manager.plan,
                subscriptionEnd: manager.subscriptionEnd,
                ownerId: manager.id,
                accessGrants: [],
                subjects: data.subjects || [],
                requiresPasswordChange: true // FORÇA A TROCA NO PRIMEIRO LOGIN
            };
            
            if (manager.institutionId) {
                newUserDoc.institutionId = manager.institutionId;
            }

            await setDoc(doc(db, COLLECTIONS.USERS, newUserAuth.uid), newUserDoc);
            
            // LOG CRIAÇÃO SUBUSER
            await logAuditAction('CREATE', 'USER', `Gestor criou sub-usuário: ${data.email}`, newUserAuth.uid, { createdBy: manager.id });

            await signOut(secondaryAuth);
            
            return newUserDoc as User;

        } catch (error: any) {
            console.error("Erro ao criar sub-usuário:", error);
            throw error;
        } finally {
            await deleteApp(secondaryApp);
        }
    },

    login: async (email: string, pass: string) => {
        try {
            const cred = await signInWithEmailAndPassword(auth, email, pass);
            // LOG LOGIN (INSTRUMENTADO)
            await logAuditAction('LOGIN', 'SESSION', `Login realizado com sucesso`, cred.user.uid);
            return await FirebaseService.getCurrentUserData();
        } catch (error) {
            safeLog("Erro no login:", error);
            throw error;
        }
    },

    logout: async () => {
        await signOut(auth);
    },

    // Nova função para trocar senha e remover a flag
    changeUserPassword: async (newPassword: string) => {
        const user = auth.currentUser;
        if (!user) throw new Error("Usuário não autenticado.");

        try {
            await updatePassword(user, newPassword);
            // Atualiza Firestore para não pedir mais
            await updateDoc(doc(db, COLLECTIONS.USERS, user.uid), { requiresPasswordChange: false });
            await logAuditAction('UPDATE', 'USER', 'Senha alterada pelo usuário', user.uid);
            return true;
        } catch (error) {
            safeLog("Erro ao trocar senha:", error);
            throw error;
        }
    },

    resetPassword: async (email: string) => {
        try {
            await sendPasswordResetEmail(auth, email);
            await logAuditAction('SECURITY', 'USER', `Solicitação de reset de senha para ${email}`);
        } catch (error) {
            safeLog("Erro ao enviar email de redefinição:", error);
            throw error;
        }
    },

    adminSetManualPassword: async (uid: string, newPassword: string) => {
        console.warn("Alteração de senha manual para usuário existente não suportada via Client SDK por segurança.");
        return false;
    },

    getCurrentUserData: async () => {
        const user = auth.currentUser;
        if (!user) return null;

        const docRef = doc(db, COLLECTIONS.USERS, user.uid);
        
        try {
            const userDoc = await getDoc(docRef);
            if (userDoc.exists()) {
                return userDoc.data() as User;
            } else {
                console.warn("Usuário sem dados no Firestore. Recriando perfil automaticamente...");
                const recoveredUser: User = {
                    id: user.uid,
                    name: user.displayName || 'Usuário',
                    email: user.email || '',
                    role: UserRole.TEACHER,
                    status: 'ACTIVE',
                    plan: 'BASIC',
                    subscriptionEnd: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
                    accessGrants: []
                };
                await setDoc(docRef, recoveredUser);
                return recoveredUser;
            }
        } catch (error) {
            safeLog("Erro crítico ao recuperar dados do usuário:", error);
            return null;
        }
    },

    getUserByEmail: async (email: string) => {
        try {
            const q = query(collection(db, COLLECTIONS.USERS), where("email", "==", email));
            const snapshot = await getDocs(q);
            if (snapshot.empty) return null;
            return snapshot.docs[0].data() as User;
        } catch (error) {
            safeLog("Erro ao buscar usuário por email:", error);
            return null;
        }
    },

    updateUser: async (uid: string, data: Partial<User>) => {
        try {
            const docRef = doc(db, COLLECTIONS.USERS, uid);
            const clean = cleanPayload(data);
            await updateDoc(docRef, clean);
            
            if (auth.currentUser && auth.currentUser.uid === uid) {
                const profileUpdates: any = {};
                if (data.name) profileUpdates.displayName = data.name;
                if (data.photoUrl && !data.photoUrl.startsWith('data:')) {
                     profileUpdates.photoURL = data.photoUrl;
                }
                if (Object.keys(profileUpdates).length > 0) {
                     await updateProfile(auth.currentUser, profileUpdates);
                }
            }
            
            // LOG UPDATE
            if (Object.keys(data).length > 0) {
                await logAuditAction('UPDATE', 'USER', `Perfil de usuário atualizado`, uid, { fields: Object.keys(data) });
            }

        } catch (error) {
            safeLog("Erro ao atualizar usuário:", error);
            throw error;
        }
    },
    
    deleteUserDocument: async (uid: string) => {
        try {
            await deleteDoc(doc(db, COLLECTIONS.USERS, uid));
            // LOG DELETE USER (INSTRUMENTADO)
            await logAuditAction('DELETE', 'USER', `Usuário excluído do sistema`, uid);
        } catch (error) {
            safeLog("Erro ao excluir documento de usuário:", error);
            throw error;
        }
    },

    getUsers: async (currentUser?: User | null) => {
        if (!currentUser) return [];

        const q = query(collection(db, COLLECTIONS.USERS));
        const snapshot = await getDocs(q);
        const allUsers = snapshot.docs.map(d => d.data() as User);

        if (currentUser.role === UserRole.ADMIN) return allUsers;

        if (currentUser.role === UserRole.MANAGER) {
            return allUsers.filter(u => u.ownerId === currentUser.id || (currentUser.institutionId && u.institutionId === currentUser.institutionId));
        }

        return []; 
    },

    // --- PAGAMENTOS ---
    addPayment: async (paymentData: Omit<Payment, 'id' | 'date'>) => {
        try {
            const payload = cleanPayload(paymentData);
            const paymentRef = await addDoc(collection(db, COLLECTIONS.PAYMENTS), {
                ...payload,
                date: new Date().toISOString()
            });

            const userDocRef = doc(db, COLLECTIONS.USERS, paymentData.userId);
            const userSnap = await getDoc(userDocRef);
            
            if (userSnap.exists()) {
                const user = userSnap.data() as User;
                const today = new Date();
                const currentEnd = new Date(user.subscriptionEnd);
                let baseDate = currentEnd > today ? currentEnd : today;
                const newEnd = new Date(baseDate);
                newEnd.setMonth(newEnd.getMonth() + paymentData.periodMonths);
                
                await updateDoc(userDocRef, {
                    subscriptionEnd: newEnd.toISOString().split('T')[0],
                    plan: paymentData.planName,
                    status: 'ACTIVE'
                });
            }
            
            // LOG PAGAMENTO
            await logAuditAction('UPDATE', 'FINANCE', `Pagamento registrado: R$ ${paymentData.amount}`, paymentData.userId);

            return paymentRef.id;
        } catch (error) {
            safeLog("Erro ao adicionar pagamento:", error);
            throw error;
        }
    },

    getPayments: async (userId: string) => {
        const q = query(
            collection(db, COLLECTIONS.PAYMENTS), 
            where("userId", "==", userId)
        );
        const snapshot = await getDocs(q);
        const payments = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Payment));
        return payments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },

    // NOVO: Busca TODOS os pagamentos para o Dashboard Financeiro
    getAllPayments: async () => {
        try {
            const q = query(collection(db, COLLECTIONS.PAYMENTS), orderBy("date", "desc"));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Payment));
        } catch (error) {
            safeLog("Erro ao buscar todos pagamentos:", error);
            return [];
        }
    },

    // --- MARKETING (CAMPAIGNS) ---
    getCampaigns: async () => {
        try {
            const q = query(collection(db, COLLECTIONS.CAMPAIGNS));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Campaign))
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        } catch (error) {
            safeLog("Erro ao buscar campanhas:", error);
            return [];
        }
    },

    addCampaign: async (campaign: Omit<Campaign, 'id'>) => {
        try {
            const data = cleanPayload(campaign);
            const docRef = await addDoc(collection(db, COLLECTIONS.CAMPAIGNS), data);
            return { ...campaign, id: docRef.id };
        } catch (error) {
            safeLog("Erro ao criar campanha:", error);
            throw error;
        }
    },

    updateCampaign: async (id: string, data: Partial<Campaign>) => {
        try {
            const docRef = doc(db, COLLECTIONS.CAMPAIGNS, id);
            await updateDoc(docRef, cleanPayload(data));
        } catch (error) {
            safeLog("Erro ao atualizar campanha:", error);
            throw error;
        }
    },

    // --- INSTITUIÇÕES, TURMAS, HIERARQUIA, QUESTÕES, PROVAS, PLANS, ATTEMPTS... 
    getInstitutions: async (currentUser?: User | null) => {
        if (!currentUser) return [];
        const snapshot = await getDocs(collection(db, COLLECTIONS.INSTITUTIONS));
        return snapshot.docs
            .map(d => ({ ...d.data(), id: d.id } as Institution))
            .filter(item => {
                if (currentUser.institutionId && item.id === currentUser.institutionId) return true;
                return isVisible(item, currentUser);
            });
    },
    
    addInstitution: async (data: Institution) => { 
        const { id, ...rest } = data; 
        const payload: any = cleanPayload(rest); 
        if (auth.currentUser?.uid) payload.authorId = auth.currentUser.uid; 
        const docRef = await addDoc(collection(db, COLLECTIONS.INSTITUTIONS), payload); 
        if (auth.currentUser) { 
            const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, auth.currentUser.uid)); 
            const userData = userDoc.data() as User; 
            if (userData.role === UserRole.MANAGER && !userData.institutionId) { 
                await updateDoc(doc(db, COLLECTIONS.USERS, auth.currentUser.uid), { institutionId: docRef.id }); 
            } 
        } 
        return { ...data, id: docRef.id }; 
    },
    
    updateInstitution: async (data: Institution) => { 
        const docRef = doc(db, COLLECTIONS.INSTITUTIONS, data.id); 
        const clean = cleanPayload(data); 
        await updateDoc(docRef, clean); 
        return data; 
    },
    
    deleteInstitution: async (id: string) => { await deleteDoc(doc(db, COLLECTIONS.INSTITUTIONS, id)); },
    
    getClasses: async (currentUser?: User | null) => { if (!currentUser) return []; const snapshot = await getDocs(collection(db, COLLECTIONS.CLASSES)); return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as SchoolClass)).filter(item => { if (currentUser.role === UserRole.TEACHER && currentUser.institutionId && item.institutionId === currentUser.institutionId) { return true; } return isVisible(item, currentUser); }); },
    
    addClass: async (data: SchoolClass) => { 
        const { id, ...rest } = data; 
        const payload: any = cleanPayload(rest); 
        if (auth.currentUser?.uid) payload.authorId = auth.currentUser.uid; 
        const docRef = await addDoc(collection(db, COLLECTIONS.CLASSES), payload); 
        return { ...data, id: docRef.id }; 
    },
    
    updateClass: async (data: SchoolClass) => { 
        const docRef = doc(db, COLLECTIONS.CLASSES, data.id); 
        const clean = cleanPayload(data); 
        await updateDoc(docRef, clean); 
        return data; 
    },
    
    deleteClass: async (id: string) => { await deleteDoc(doc(db, COLLECTIONS.CLASSES, id)); },
    
    getHierarchy: async (currentUser?: User | null): Promise<Discipline[]> => { 
        try { 
            const [dSnap, cSnap, uSnap, tSnap] = await Promise.all([
                getDocs(collection(db, COLLECTIONS.DISCIPLINES)), 
                getDocs(collection(db, COLLECTIONS.CHAPTERS)), 
                getDocs(collection(db, COLLECTIONS.UNITS)), 
                getDocs(collection(db, COLLECTIONS.TOPICS))
            ]); 
            
            const sortByCreated = (a: any, b: any) => { 
                if (!a.createdAt && !b.createdAt) return 0; 
                if (!a.createdAt) return -1; 
                if (!b.createdAt) return 1; 
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); 
            }; 

            let disciplines = dSnap.docs.map(d => ({ ...d.data() as any, id: d.id, chapters: [] } as Discipline)).sort(sortByCreated); 
            const chapters = cSnap.docs.map(c => ({ ...c.data() as any, id: c.id, units: [] } as Chapter)).sort(sortByCreated); 
            const units = uSnap.docs.map(u => ({ ...u.data() as any, id: u.id, topics: [] } as Unit)).sort(sortByCreated); 
            const topics = tSnap.docs.map(t => ({ ...t.data() as any, id: t.id } as Topic)).sort(sortByCreated); 
            
            units.forEach(u => { u.topics = topics.filter(t => t.unitId === u.id); }); 
            chapters.forEach(c => { c.units = units.filter(u => u.chapterId === c.id); }); 
            disciplines.forEach(d => { d.chapters = chapters.filter(c => c.disciplineId === d.id); }); 
            
            // --- FILTRO ESPECÍFICO PARA PROFESSOR ---
            // Se for professor, retorna apenas as disciplinas atribuídas (subjects)
            if (currentUser?.role === UserRole.TEACHER) {
                if (currentUser.subjects && currentUser.subjects.length > 0) {
                    return disciplines.filter(d => currentUser.subjects!.includes(d.id));
                }
                // Se não tiver disciplinas atribuídas, não vê nada
                return [];
            }

            return disciplines; 
        } catch (e) { 
            safeLog("Erro ao buscar hierarquia:", e); 
            return []; 
        } 
    },
    
    addDiscipline: async (name: string) => { const payload: any = { name, createdAt: new Date().toISOString() }; if (auth.currentUser?.uid) payload.authorId = auth.currentUser.uid; await addDoc(collection(db, COLLECTIONS.DISCIPLINES), payload); },
    addChapter: async (disciplineId: string, name: string) => { const payload: any = { disciplineId, name, createdAt: new Date().toISOString() }; if (auth.currentUser?.uid) payload.authorId = auth.currentUser.uid; await addDoc(collection(db, COLLECTIONS.CHAPTERS), payload); },
    addUnit: async (disciplineId: string, chapterId: string, name: string) => { const payload: any = { chapterId, name, createdAt: new Date().toISOString() }; if (auth.currentUser?.uid) payload.authorId = auth.currentUser.uid; await addDoc(collection(db, COLLECTIONS.UNITS), payload); },
    addTopic: async (disciplineId: string, chapterId: string, unitId: string, name: string) => { const payload: any = { unitId, name, createdAt: new Date().toISOString() }; if (auth.currentUser?.uid) payload.authorId = auth.currentUser.uid; await addDoc(collection(db, COLLECTIONS.TOPICS), payload); },
    updateHierarchyItem: async (type: 'discipline'|'chapter'|'unit'|'topic', id: string, newName: string) => { let col = COLLECTIONS.DISCIPLINES; if (type === 'chapter') col = COLLECTIONS.CHAPTERS; if (type === 'unit') col = COLLECTIONS.UNITS; if (type === 'topic') col = COLLECTIONS.TOPICS; const docRef = doc(db, col, id); await updateDoc(docRef, { name: newName }); },
    deleteItem: async (type: 'discipline'|'chapter'|'unit'|'topic', ids: {dId?: string, cId?: string, uId?: string, tId?: string}) => { const batch = writeBatch(db); try { if (type === 'topic' && ids.tId) { batch.delete(doc(db, COLLECTIONS.TOPICS, ids.tId)); } else if (type === 'unit' && ids.uId) { batch.delete(doc(db, COLLECTIONS.UNITS, ids.uId)); const qT = query(collection(db, COLLECTIONS.TOPICS), where("unitId", "==", ids.uId)); const snapT = await getDocs(qT); snapT.forEach(d => batch.delete(d.ref)); } else if (type === 'chapter' && ids.cId) { batch.delete(doc(db, COLLECTIONS.CHAPTERS, ids.cId)); const qU = query(collection(db, COLLECTIONS.UNITS), where("chapterId", "==", ids.cId)); const snapU = await getDocs(qU); for (const uDoc of snapU.docs) { batch.delete(uDoc.ref); const qT = query(collection(db, COLLECTIONS.TOPICS), where("unitId", "==", uDoc.id)); const snapT = await getDocs(qT); snapT.forEach(t => batch.delete(t.ref)); } } else if (type === 'discipline' && ids.dId) { batch.delete(doc(db, COLLECTIONS.DISCIPLINES, ids.dId)); const qC = query(collection(db, COLLECTIONS.CHAPTERS), where("disciplineId", "==", ids.dId)); const snapC = await getDocs(qC); for (const cDoc of snapC.docs) { batch.delete(cDoc.ref); const qU = query(collection(db, COLLECTIONS.UNITS), where("chapterId", "==", cDoc.id)); const snapU = await getDocs(qU); for (const uDoc of snapU.docs) { batch.delete(uDoc.ref); const qT = query(collection(db, COLLECTIONS.TOPICS), where("unitId", "==", uDoc.id)); const snapT = await getDocs(qT); snapT.forEach(t => batch.delete(t.ref)); } } } await batch.commit(); } catch (error) { safeLog("Erro crítico no deleteItem:", error); throw error; } },
    
    getQuestions: async (currentUser?: User | null) => { if (!currentUser) return []; const snapshot = await getDocs(collection(db, COLLECTIONS.QUESTIONS)); return snapshot.docs.map(d => { const data = d.data() as any; data.id = d.id; return data as Question; }).filter(item => isVisible(item, currentUser)); },
    
    addQuestion: async (q: Question) => { 
        const data: any = cleanPayload(q); 
        if (data.id) delete data.id; 
        if (auth.currentUser) { 
            if (!data.authorId) data.authorId = auth.currentUser.uid; 
            if (!data.institutionId) { 
                const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, auth.currentUser.uid)); 
                const u = userDoc.data() as User; 
                if (u.institutionId) data.institutionId = u.institutionId; 
            } 
        } 
        if (!data.visibility) data.visibility = 'PUBLIC'; 
        const docRef = await addDoc(collection(db, COLLECTIONS.QUESTIONS), data); 
        return { ...q, id: docRef.id }; 
    },
    
    updateQuestion: async (q: Question) => { 
        const { id, ...rest } = q; 
        if (!id) throw new Error("ID da questão obrigatório"); 
        const clean = cleanPayload(rest); 
        await updateDoc(doc(db, COLLECTIONS.QUESTIONS, id), clean); 
    },
    
    deleteQuestion: async (id: string) => { await deleteDoc(doc(db, COLLECTIONS.QUESTIONS, id)); },
    
    getExams: async (currentUser?: User | null) => { if (!currentUser) return []; const snapshot = await getDocs(collection(db, COLLECTIONS.EXAMS)); return snapshot.docs.map(d => { const data = d.data() as any; data.id = d.id; return data as Exam; }).filter(item => isVisible(item, currentUser)); },
    
    getExamById: async (id: string) => { const docRef = doc(db, COLLECTIONS.EXAMS, id); const snap = await getDoc(docRef); if (snap.exists()) { const data = snap.data() as any; data.id = snap.id; return data as Exam; } return null; },
    
    saveExam: async (exam: Exam) => { 
        const data: any = cleanPayload(exam); 
        const id = data.id; 
        if (data.id) delete data.id; 
        if (!data.authorId && auth.currentUser) { 
            data.authorId = auth.currentUser.uid; 
            if (!data.institutionId) { 
                const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, auth.currentUser.uid)); 
                const u = userDoc.data() as User; 
                if (u.institutionId) data.institutionId = u.institutionId; 
            } 
        } 
        if (id) { 
            await updateDoc(doc(db, COLLECTIONS.EXAMS, id), data); 
            return { ...exam, id }; 
        } else { 
            const docRef = await addDoc(collection(db, COLLECTIONS.EXAMS), data); 
            return { ...exam, id: docRef.id }; 
        } 
    },
    
    deleteExam: async (id: string) => { 
        try {
            await deleteDoc(doc(db, COLLECTIONS.EXAMS, id)); 
            // LOG EXCLUSÃO DE PROVA (INSTRUMENTADO)
            await logAuditAction('DELETE', 'EXAM', `Prova excluída`, id);
        } catch (error) {
            safeLog("Erro ao excluir prova:", error);
            throw error;
        }
    },
    
    getPlans: async () => { const snapshot = await getDocs(collection(db, COLLECTIONS.PLANS)); return snapshot.docs.map(d => { const data = d.data() as any; data.id = d.id; return data as Plan; }); },
    
    savePlan: async (plan: Plan) => { 
        const data: any = cleanPayload(plan); 
        const id = data.id; 
        if (data.id) delete data.id; 
        if (id) { 
            await updateDoc(doc(db, COLLECTIONS.PLANS, id), data); 
            return { ...plan, id }; 
        } else { 
            const docRef = await addDoc(collection(db, COLLECTIONS.PLANS), data); 
            return { ...plan, id: docRef.id }; 
        } 
    },
    
    deletePlan: async (id: string) => { await deleteDoc(doc(db, COLLECTIONS.PLANS, id)); },
    
    startAttempt: async (examId: string, studentName: string, studentIdentifier: string): Promise<ExamAttempt> => { const attempt: Partial<ExamAttempt> = { examId, studentName, studentIdentifier, startedAt: new Date().toISOString(), answers: {}, score: 0, status: 'IN_PROGRESS' }; const docRef = await addDoc(collection(db, COLLECTIONS.ATTEMPTS), attempt); return { ...attempt, id: docRef.id } as ExamAttempt; },
    
    submitAttempt: async (id: string, answers: Record<string, string>, score: number, totalQuestions: number) => { const docRef = doc(db, COLLECTIONS.ATTEMPTS, id); await updateDoc(docRef, { answers, score, totalQuestions, submittedAt: new Date().toISOString(), status: 'COMPLETED' }); },
    
    updateAttemptScore: async (id: string, score: number) => { 
        try {
            const docRef = doc(db, COLLECTIONS.ATTEMPTS, id); 
            await updateDoc(docRef, { score }); 
            // LOG ALTERAÇÃO DE NOTA (INSTRUMENTADO - CRÍTICO)
            await logAuditAction('UPDATE', 'ATTEMPT', `Nota alterada manualmente para ${score}`, id);
        } catch (error) {
            safeLog("Erro ao atualizar nota:", error);
            throw error;
        }
    },
    
    getStudentAttempts: async (examId: string, identifier: string) => { const q = query(collection(db, COLLECTIONS.ATTEMPTS), where("examId", "==", examId), where("studentIdentifier", "==", identifier)); const snapshot = await getDocs(q); return snapshot.docs.map(d => { const data = d.data() as any; data.id = d.id; return data as ExamAttempt; }); },
    getExamResults: async (examId: string) => { const q = query(collection(db, COLLECTIONS.ATTEMPTS), where("examId", "==", examId)); const snapshot = await getDocs(q); return snapshot.docs.map(d => { const data = d.data() as any; data.id = d.id; return data as ExamAttempt; }); },
    getFullHierarchyString: (q: Question, hierarchy: Discipline[]) => { const disc = hierarchy.find(d => d.id === q.disciplineId); const chap = disc?.chapters.find(c => c.id === q.chapterId); const unit = chap?.units.find(u => u.id === q.unitId); const topic = unit?.topics.find(t => t.id === q.topicId); return `${disc?.name || '?'} > ${chap?.name || '?'} > ${unit?.name || '?'} > ${topic?.name || '?'}`; }
};
