
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
    writeBatch
} from "firebase/firestore";
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    updateProfile,
    deleteUser
} from "firebase/auth";
import { db, auth } from "../firebaseConfig";
import { User, UserRole, Discipline, Question, Exam, Institution, SchoolClass, Chapter, Unit, Topic } from '../types';

const COLLECTIONS = {
    USERS: 'users',
    INSTITUTIONS: 'institutions',
    CLASSES: 'classes',
    QUESTIONS: 'questions',
    EXAMS: 'exams',
    DISCIPLINES: 'disciplines',
    CHAPTERS: 'chapters',
    UNITS: 'units',
    TOPICS: 'topics'
};

const safeLog = (message: string, error: any) => {
    // Avoid logging full Firestore error objects which may contain circular references (e.g. Query objects)
    console.error(message, error?.code || error?.message || String(error));
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
                subscriptionEnd: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]
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
                    subscriptionEnd: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]
                };
                await setDoc(docRef, recoveredUser);
                return recoveredUser;
            }
        } catch (error) {
            safeLog("Erro crítico ao recuperar dados do usuário:", error);
            return null;
        }
    },

    updateUser: async (uid: string, data: Partial<User>) => {
        try {
            // Atualiza no Firestore (Source of Truth principal do App)
            const docRef = doc(db, COLLECTIONS.USERS, uid);
            await updateDoc(docRef, data);

            // Tenta atualizar no Auth para sincronizar sessão, se possível
            if (auth.currentUser) {
                const profileUpdates: any = {};
                if (data.name) profileUpdates.displayName = data.name;
                
                // Só atualiza photoURL no Auth se NÃO for Base64 (data URI), 
                // pois o Firebase Auth tem limite restrito de caracteres para URL.
                // Se for Base64, a imagem fica salva apenas no Firestore e carregada via getCurrentUserData.
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

    getUsers: async () => {
        const q = query(collection(db, COLLECTIONS.USERS));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => d.data() as User);
    },

    // --- INSTITUIÇÕES ---
    getInstitutions: async () => {
        const snapshot = await getDocs(collection(db, COLLECTIONS.INSTITUTIONS));
        return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Institution));
    },

    addInstitution: async (data: Institution) => {
        const { id, ...rest } = data;
        const docRef = await addDoc(collection(db, COLLECTIONS.INSTITUTIONS), rest);
        return { ...data, id: docRef.id };
    },

    updateInstitution: async (data: Institution) => {
        const docRef = doc(db, COLLECTIONS.INSTITUTIONS, data.id);
        await updateDoc(docRef, { ...data });
        return data;
    },

    deleteInstitution: async (id: string) => {
        await deleteDoc(doc(db, COLLECTIONS.INSTITUTIONS, id));
    },

    // --- TURMAS ---
    getClasses: async () => {
        const snapshot = await getDocs(collection(db, COLLECTIONS.CLASSES));
        return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as SchoolClass));
    },

    addClass: async (data: SchoolClass) => {
        const { id, ...rest } = data;
        const docRef = await addDoc(collection(db, COLLECTIONS.CLASSES), rest);
        return { ...data, id: docRef.id };
    },

    updateClass: async (data: SchoolClass) => {
        const docRef = doc(db, COLLECTIONS.CLASSES, data.id);
        await updateDoc(docRef, { ...data });
        return data;
    },

    deleteClass: async (id: string) => {
        await deleteDoc(doc(db, COLLECTIONS.CLASSES, id));
    },

    // --- HIERARQUIA (CRUD RELACIONAL) ---
    getHierarchy: async (): Promise<Discipline[]> => {
        try {
            const [dSnap, cSnap, uSnap, tSnap] = await Promise.all([
                getDocs(collection(db, COLLECTIONS.DISCIPLINES)),
                getDocs(collection(db, COLLECTIONS.CHAPTERS)),
                getDocs(collection(db, COLLECTIONS.UNITS)),
                getDocs(collection(db, COLLECTIONS.TOPICS))
            ]);

            // Função para ordenar por data de criação
            const sortByCreated = (a: any, b: any) => {
                if (!a.createdAt && !b.createdAt) return 0;
                if (!a.createdAt) return -1; // Itens sem data aparecem primeiro (ou último, dependendo da preferência)
                if (!b.createdAt) return 1;
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            };

            const disciplines = dSnap.docs.map(d => ({ ...d.data(), id: d.id, chapters: [] } as Discipline)).sort(sortByCreated);
            const chapters = cSnap.docs.map(c => ({ ...c.data(), id: c.id, units: [] } as Chapter)).sort(sortByCreated);
            const units = uSnap.docs.map(u => ({ ...u.data(), id: u.id, topics: [] } as Unit)).sort(sortByCreated);
            const topics = tSnap.docs.map(t => ({ ...t.data(), id: t.id } as Topic)).sort(sortByCreated);

            units.forEach(u => {
                u.topics = topics.filter(t => t.unitId === u.id);
            });
            chapters.forEach(c => {
                c.units = units.filter(u => u.chapterId === c.id);
            });
            disciplines.forEach(d => {
                d.chapters = chapters.filter(c => c.disciplineId === d.id);
            });

            return disciplines;
        } catch (e) {
            safeLog("Erro ao buscar hierarquia:", e);
            return [];
        }
    },

    addDiscipline: async (name: string) => {
        await addDoc(collection(db, COLLECTIONS.DISCIPLINES), { name, createdAt: new Date().toISOString() });
    },

    addChapter: async (disciplineId: string, name: string) => {
        await addDoc(collection(db, COLLECTIONS.CHAPTERS), { disciplineId, name, createdAt: new Date().toISOString() });
    },

    addUnit: async (disciplineId: string, chapterId: string, name: string) => {
        await addDoc(collection(db, COLLECTIONS.UNITS), { chapterId, name, createdAt: new Date().toISOString() });
    },

    addTopic: async (disciplineId: string, chapterId: string, unitId: string, name: string) => {
        await addDoc(collection(db, COLLECTIONS.TOPICS), { unitId, name, createdAt: new Date().toISOString() });
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
        console.log("Iniciando exclusão:", type);
        const batch = writeBatch(db);

        try {
            if (type === 'topic' && ids.tId) {
                batch.delete(doc(db, COLLECTIONS.TOPICS, ids.tId));
            }

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
    getQuestions: async () => {
        const snapshot = await getDocs(collection(db, COLLECTIONS.QUESTIONS));
        return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Question));
    },

    addQuestion: async (q: Question) => {
        const { id, ...rest } = q;
        const docRef = await addDoc(collection(db, COLLECTIONS.QUESTIONS), rest);
        return { ...q, id: docRef.id };
    },

    updateQuestion: async (q: Question) => {
        const { id, ...rest } = q;
        if (!id) throw new Error("ID da questão obrigatório para atualização");
        await updateDoc(doc(db, COLLECTIONS.QUESTIONS, id), rest);
    },

    deleteQuestion: async (id: string) => {
        await deleteDoc(doc(db, COLLECTIONS.QUESTIONS, id));
    },

    // --- PROVAS ---
    getExams: async () => {
        const snapshot = await getDocs(collection(db, COLLECTIONS.EXAMS));
        return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Exam));
    },

    saveExam: async (exam: Exam) => {
        const { id, ...rest } = exam;
        if (id) {
            await updateDoc(doc(db, COLLECTIONS.EXAMS, id), rest);
            return exam;
        } else {
            const docRef = await addDoc(collection(db, COLLECTIONS.EXAMS), rest);
            return { ...exam, id: docRef.id };
        }
    },

    deleteExam: async (id: string) => {
        await deleteDoc(doc(db, COLLECTIONS.EXAMS, id));
    },

    getFullHierarchyString: (q: Question, hierarchy: Discipline[]) => {
        const disc = hierarchy.find(d => d.id === q.disciplineId);
        const chap = disc?.chapters.find(c => c.id === q.chapterId);
        const unit = chap?.units.find(u => u.id === q.unitId);
        const topic = unit?.topics.find(t => t.id === q.topicId);
        return `${disc?.name || '?'} > ${chap?.name || '?'} > ${unit?.name || '?'} > ${topic?.name || '?'}`;
    }
};
