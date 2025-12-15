
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
    orderBy
} from "firebase/firestore";
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    updateProfile, 
    deleteUser,
    sendPasswordResetEmail
} from "firebase/auth";
import { db, auth } from "../firebaseConfig";
import { User, UserRole, Discipline, Question, Exam, Institution, SchoolClass, Chapter, Unit, Topic, ExamAttempt, Plan, Payment } from '../types';

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
    PAYMENTS: 'payments'
};

const safeLog = (message: string, error: any) => {
    console.error(message, error?.code || error?.message || String(error));
};

// Função de Visibilidade Centralizada
const isVisible = (item: any, user: User | null | undefined) => {
    if (!user) return false;
    
    // 1. ADMIN vê tudo
    if (user.role === UserRole.ADMIN) return true;
    
    // 2. DONO sempre vê seus itens (regra suprema)
    if (item.authorId === user.id) return true;

    // 3. Lógica para MANAGER (Vê itens dos seus professores/instituição)
    const sameInstitution = user.institutionId && item.institutionId === user.institutionId;
    if (user.role === UserRole.MANAGER && sameInstitution) {
        return true;
    }
    
    // 4. Lógica Específica para QUESTÕES (Visibility Scopes)
    // Verifica se o objeto parece ser uma questão (tem disciplina ou enunciado)
    if ('enunciado' in item || 'visibility' in item) { 
        const q = item as Question;
        
        // Se não tiver visibility definida (Legado), assumimos PRIVATE para segurança,
        // a menos que o admin queira rodar um script para atualizar tudo.
        // Isso resolve o problema de o professor de Física ver coisas antigas de Química.
        if (!q.visibility) return false; 
        
        if (q.visibility === 'PRIVATE') return false; 
        
        // INSTITUCIONAL: Visível para todos da mesma instituição
        if (q.visibility === 'INSTITUTION') {
            return sameInstitution || false;
        }

        // PÚBLICA (Banco Global): Visível APENAS SE o usuário tiver GRANT para a Disciplina
        if (q.visibility === 'PUBLIC') {
            // Se não for o autor, PRECISA ter o grant da disciplina.
            const userGrants = user.accessGrants || [];
            if (q.disciplineId && userGrants.includes(q.disciplineId)) {
                return true;
            }
            // Se não tiver grant, NÃO VÊ, mesmo que seja pública.
            return false;
        }
    }

    // 5. Fallback para outros itens (não questões)
    // Se tiver authorId e não caiu nas regras acima, é privado.
    if (item.authorId && item.authorId !== user.id) return false;
    
    // Itens de sistema legado sem dono (ex: disciplinas base) são públicos
    if (!item.authorId) return true;
    
    return false;
};

export const FirebaseService = {
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
                accessGrants: [] 
            };

            await setDoc(doc(db, COLLECTIONS.USERS, user.uid), userData);
            return userData;
        } catch (error: any) {
            safeLog("Erro no cadastro Firestore:", error);
            if (error?.code === 'permission-denied') {
                throw new Error("Erro de Permissão: O banco de dados recusou a gravação. Verifique as Regras no Firebase Console.");
            }
            try { await deleteUser(user); } catch(e) { }
            throw error;
        }
    },

    createSubUser: async (manager: User, data: { name: string, email: string, role: UserRole }) => {
        const fakeId = `user-${Date.now()}`;
        const newUser: any = {
            id: fakeId,
            name: data.name,
            email: data.email,
            role: data.role,
            status: 'ACTIVE',
            plan: manager.plan,
            subscriptionEnd: manager.subscriptionEnd,
            ownerId: manager.id,
            accessGrants: []
        };
        
        if (manager.institutionId) {
            newUser.institutionId = manager.institutionId;
        }

        await setDoc(doc(db, COLLECTIONS.USERS, fakeId), newUser);
        return newUser as User;
    },

    login: async (email: string, pass: string) => {
        try {
            await signInWithEmailAndPassword(auth, email, pass);
            return await FirebaseService.getCurrentUserData();
        } catch (error) {
            safeLog("Erro no login:", error);
            throw error;
        }
    },

    logout: async () => {
        await signOut(auth);
    },

    resetPassword: async (email: string) => {
        try {
            await sendPasswordResetEmail(auth, email);
        } catch (error) {
            safeLog("Erro ao enviar email de redefinição:", error);
            throw error;
        }
    },

    adminSetManualPassword: async (uid: string, newPassword: string) => {
        console.log(`[SIMULAÇÃO] Senha alterada para o usuário ${uid}: ${newPassword}`);
        return true;
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
            const cleanData = JSON.parse(JSON.stringify(data));
            await updateDoc(docRef, cleanData);
            
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
        } catch (error) {
            safeLog("Erro ao atualizar usuário:", error);
            throw error;
        }
    },
    
    deleteUserDocument: async (uid: string) => {
        try {
            await deleteDoc(doc(db, COLLECTIONS.USERS, uid));
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
            const paymentRef = await addDoc(collection(db, COLLECTIONS.PAYMENTS), {
                ...paymentData,
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

    // --- INSTITUIÇÕES ---
    getInstitutions: async (currentUser?: User | null) => {
        if (!currentUser) return [];
        const snapshot = await getDocs(collection(db, COLLECTIONS.INSTITUTIONS));
        return snapshot.docs
            .map(d => {
                const data = d.data() as any;
                return { ...data, id: d.id } as Institution;
            })
            .filter(item => {
                if (currentUser.institutionId && item.id === currentUser.institutionId) return true;
                return isVisible(item, currentUser);
            });
    },

    addInstitution: async (data: Institution) => {
        const { id, ...rest } = data;
        const payload: any = { ...rest };
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
        const cleanData = JSON.parse(JSON.stringify(data));
        await updateDoc(docRef, cleanData);
        return data;
    },

    deleteInstitution: async (id: string) => {
        await deleteDoc(doc(db, COLLECTIONS.INSTITUTIONS, id));
    },

    // --- TURMAS ---
    getClasses: async (currentUser?: User | null) => {
        if (!currentUser) return [];
        const snapshot = await getDocs(collection(db, COLLECTIONS.CLASSES));
        return snapshot.docs
            .map(d => {
                const data = d.data() as any;
                return { ...data, id: d.id } as SchoolClass;
            })
            .filter(item => {
                if (currentUser.role === UserRole.TEACHER && currentUser.institutionId && item.institutionId === currentUser.institutionId) {
                    return true;
                }
                return isVisible(item, currentUser);
            });
    },

    addClass: async (data: SchoolClass) => {
        const { id, ...rest } = data;
        const payload: any = { ...rest };
        if (auth.currentUser?.uid) payload.authorId = auth.currentUser.uid;
        const docRef = await addDoc(collection(db, COLLECTIONS.CLASSES), payload);
        return { ...data, id: docRef.id };
    },

    updateClass: async (data: SchoolClass) => {
        const docRef = doc(db, COLLECTIONS.CLASSES, data.id);
        const cleanData = JSON.parse(JSON.stringify(data));
        await updateDoc(docRef, cleanData);
        return data;
    },

    deleteClass: async (id: string) => {
        await deleteDoc(doc(db, COLLECTIONS.CLASSES, id));
    },

    // --- HIERARQUIA ---
    getHierarchy: async (currentUser?: User | null): Promise<Discipline[]> => {
        // Se user for null (ex: uso interno sem sessão), retorna tudo ou vazio.
        // Aqui assumimos que para 'admin' listar checkboxes, ele precisa ver tudo.
        // Se 'currentUser' for passado, aplicamos filtro. Se não (ex: public exam), cuidado.
        
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

            const disciplines = dSnap.docs.map(d => ({ ...d.data() as any, id: d.id, chapters: [] } as Discipline)).sort(sortByCreated);
            const chapters = cSnap.docs.map(c => ({ ...c.data() as any, id: c.id, units: [] } as Chapter)).sort(sortByCreated);
            const units = uSnap.docs.map(u => ({ ...u.data() as any, id: u.id, topics: [] } as Unit)).sort(sortByCreated);
            const topics = tSnap.docs.map(t => ({ ...t.data() as any, id: t.id } as Topic)).sort(sortByCreated);

            // Reconstrói a árvore
            units.forEach(u => { u.topics = topics.filter(t => t.unitId === u.id); });
            chapters.forEach(c => { c.units = units.filter(u => u.chapterId === c.id); });
            disciplines.forEach(d => { d.chapters = chapters.filter(c => c.disciplineId === d.id); });

            // Se tiver currentUser, filtra (Admin vê tudo, Teacher só vê se for 'visível' -> hierarquia geralmente é pública na leitura, mas podemos restringir escrita)
            // Por simplificação, a estrutura curricular é "Pública" para leitura de todos os autenticados
            return disciplines;
        } catch (e) {
            safeLog("Erro ao buscar hierarquia:", e);
            return [];
        }
    },

    addDiscipline: async (name: string) => {
        const payload: any = { name, createdAt: new Date().toISOString() };
        if (auth.currentUser?.uid) payload.authorId = auth.currentUser.uid;
        await addDoc(collection(db, COLLECTIONS.DISCIPLINES), payload);
    },

    addChapter: async (disciplineId: string, name: string) => {
        const payload: any = { disciplineId, name, createdAt: new Date().toISOString() };
        if (auth.currentUser?.uid) payload.authorId = auth.currentUser.uid;
        await addDoc(collection(db, COLLECTIONS.CHAPTERS), payload);
    },

    addUnit: async (disciplineId: string, chapterId: string, name: string) => {
        const payload: any = { chapterId, name, createdAt: new Date().toISOString() };
        if (auth.currentUser?.uid) payload.authorId = auth.currentUser.uid;
        await addDoc(collection(db, COLLECTIONS.UNITS), payload);
    },

    addTopic: async (disciplineId: string, chapterId: string, unitId: string, name: string) => {
        const payload: any = { unitId, name, createdAt: new Date().toISOString() };
        if (auth.currentUser?.uid) payload.authorId = auth.currentUser.uid;
        await addDoc(collection(db, COLLECTIONS.TOPICS), payload);
    },

    updateHierarchyItem: async (type: 'discipline'|'chapter'|'unit'|'topic', id: string, newName: string) => {
        let col = COLLECTIONS.DISCIPLINES;
        if (type === 'chapter') col = COLLECTIONS.CHAPTERS;
        if (type === 'unit') col = COLLECTIONS.UNITS;
        if (type === 'topic') col = COLLECTIONS.TOPICS;
        const docRef = doc(db, col, id);
        await updateDoc(docRef, { name: newName });
    },

    deleteItem: async (type: 'discipline'|'chapter'|'unit'|'topic', ids: {dId?: string, cId?: string, uId?: string, tId?: string}) => {
        const batch = writeBatch(db);
        try {
            if (type === 'topic' && ids.tId) {
                batch.delete(doc(db, COLLECTIONS.TOPICS, ids.tId));
            }
            // ... (restante da lógica de delete hierarquico mantida igual)
            else if (type === 'unit' && ids.uId) {
                batch.delete(doc(db, COLLECTIONS.UNITS, ids.uId));
                const qT = query(collection(db, COLLECTIONS.TOPICS), where("unitId", "==", ids.uId));
                const snapT = await getDocs(qT);
                snapT.forEach(d => batch.delete(d.ref));
            }
            else if (type === 'chapter' && ids.cId) {
                batch.delete(doc(db, COLLECTIONS.CHAPTERS, ids.cId));
                const qU = query(collection(db, COLLECTIONS.UNITS), where("chapterId", "==", ids.cId));
                const snapU = await getDocs(qU);
                for (const uDoc of snapU.docs) {
                    batch.delete(uDoc.ref);
                    const qT = query(collection(db, COLLECTIONS.TOPICS), where("unitId", "==", uDoc.id));
                    const snapT = await getDocs(qT);
                    snapT.forEach(t => batch.delete(t.ref));
                }
            }
            else if (type === 'discipline' && ids.dId) {
                batch.delete(doc(db, COLLECTIONS.DISCIPLINES, ids.dId));
                const qC = query(collection(db, COLLECTIONS.CHAPTERS), where("disciplineId", "==", ids.dId));
                const snapC = await getDocs(qC);
                for (const cDoc of snapC.docs) {
                    batch.delete(cDoc.ref);
                    const qU = query(collection(db, COLLECTIONS.UNITS), where("chapterId", "==", cDoc.id));
                    const snapU = await getDocs(qU);
                    for (const uDoc of snapU.docs) {
                        batch.delete(uDoc.ref);
                        const qT = query(collection(db, COLLECTIONS.TOPICS), where("unitId", "==", uDoc.id));
                        const snapT = await getDocs(qT);
                        snapT.forEach(t => batch.delete(t.ref));
                    }
                }
            }
            await batch.commit();
        } catch (error) {
            safeLog("Erro crítico no deleteItem:", error);
            throw error;
        }
    },

    // --- QUESTÕES ---
    getQuestions: async (currentUser?: User | null) => {
        if (!currentUser) return [];
        const snapshot = await getDocs(collection(db, COLLECTIONS.QUESTIONS));
        return snapshot.docs
            .map(d => {
                const data = d.data() as any;
                data.id = d.id;
                return data as Question;
            })
            .filter(item => isVisible(item, currentUser));
    },

    addQuestion: async (q: Question) => {
        const data: any = JSON.parse(JSON.stringify(q));
        if (data.id) delete data.id;
        
        if (auth.currentUser) {
            if (!data.authorId) data.authorId = auth.currentUser.uid;
            
            // Auto-vincula à instituição do usuário se disponível
            if (!data.institutionId) {
                const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, auth.currentUser.uid));
                const u = userDoc.data() as User;
                if (u.institutionId) data.institutionId = u.institutionId;
            }
        }
        
        // Default Visibility if not set
        if (!data.visibility) data.visibility = 'PUBLIC'; // DEFAULT PÚBLICO (SaaS)

        const docRef = await addDoc(collection(db, COLLECTIONS.QUESTIONS), data);
        return { ...q, id: docRef.id };
    },

    updateQuestion: async (q: Question) => {
        const { id, ...rest } = q;
        if (!id) throw new Error("ID da questão obrigatório");
        const cleanData = JSON.parse(JSON.stringify(rest));
        await updateDoc(doc(db, COLLECTIONS.QUESTIONS, id), cleanData);
    },

    deleteQuestion: async (id: string) => {
        await deleteDoc(doc(db, COLLECTIONS.QUESTIONS, id));
    },

    // --- PROVAS ---
    getExams: async (currentUser?: User | null) => {
        if (!currentUser) return [];
        const snapshot = await getDocs(collection(db, COLLECTIONS.EXAMS));
        return snapshot.docs
            .map(d => {
                const data = d.data() as any;
                data.id = d.id;
                return data as Exam;
            })
            .filter(item => isVisible(item, currentUser));
    },

    getExamById: async (id: string) => {
        const docRef = doc(db, COLLECTIONS.EXAMS, id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const data = snap.data() as any;
            data.id = snap.id;
            return data as Exam;
        }
        return null;
    },

    saveExam: async (exam: Exam) => {
        const data: any = JSON.parse(JSON.stringify(exam));
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
        await deleteDoc(doc(db, COLLECTIONS.EXAMS, id));
    },

    // --- PLANS ---
    getPlans: async () => {
        const snapshot = await getDocs(collection(db, COLLECTIONS.PLANS));
        return snapshot.docs.map(d => {
            const data = d.data() as any;
            data.id = d.id;
            return data as Plan;
        });
    },

    savePlan: async (plan: Plan) => {
        const data: any = JSON.parse(JSON.stringify(plan));
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

    deletePlan: async (id: string) => {
        await deleteDoc(doc(db, COLLECTIONS.PLANS, id));
    },

    // --- ONLINE EXAMS ---
    startAttempt: async (examId: string, studentName: string, studentIdentifier: string): Promise<ExamAttempt> => {
        const attempt: Partial<ExamAttempt> = {
            examId,
            studentName,
            studentIdentifier,
            startedAt: new Date().toISOString(),
            answers: {},
            score: 0,
            status: 'IN_PROGRESS'
        };
        const docRef = await addDoc(collection(db, COLLECTIONS.ATTEMPTS), attempt);
        return { ...attempt, id: docRef.id } as ExamAttempt;
    },

    submitAttempt: async (id: string, answers: Record<string, string>, score: number, totalQuestions: number) => {
        const docRef = doc(db, COLLECTIONS.ATTEMPTS, id);
        await updateDoc(docRef, {
            answers,
            score,
            totalQuestions,
            submittedAt: new Date().toISOString(),
            status: 'COMPLETED'
        });
    },
    
    updateAttemptScore: async (id: string, score: number) => {
        const docRef = doc(db, COLLECTIONS.ATTEMPTS, id);
        await updateDoc(docRef, { score });
    },

    getStudentAttempts: async (examId: string, identifier: string) => {
        const q = query(
            collection(db, COLLECTIONS.ATTEMPTS), 
            where("examId", "==", examId), 
            where("studentIdentifier", "==", identifier)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => {
            const data = d.data() as any;
            data.id = d.id;
            return data as ExamAttempt;
        });
    },

    getExamResults: async (examId: string) => {
        const q = query(collection(db, COLLECTIONS.ATTEMPTS), where("examId", "==", examId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => {
            const data = d.data() as any;
            data.id = d.id;
            return data as ExamAttempt;
        });
    },

    getFullHierarchyString: (q: Question, hierarchy: Discipline[]) => {
        const disc = hierarchy.find(d => d.id === q.disciplineId);
        const chap = disc?.chapters.find(c => c.id === q.chapterId);
        const unit = chap?.units.find(u => u.id === q.unitId);
        const topic = unit?.topics.find(t => t.id === q.topicId);
        return `${disc?.name || '?'} > ${chap?.name || '?'} > ${unit?.name || '?'} > ${topic?.name || '?'}`;
    }
};
