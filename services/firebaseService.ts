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
import { User, UserRole, Discipline, Question, Exam, Institution, SchoolClass, Chapter, Unit, Topic, ExamAttempt } from '../types';

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
    TOPICS: 'topics'
};

const safeLog = (message: string, error: any) => {
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
            const docRef = doc(db, COLLECTIONS.USERS, uid);
            await updateDoc(docRef, data);
            if (auth.currentUser) {
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

    // --- HIERARQUIA ---
    getHierarchy: async (): Promise<Discipline[]> => {
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

    // --- QUESTÕES (DATA ISOLATION) ---
    getQuestions: async (currentUser?: User | null) => {
        let qRef;
        // Se for professor, só vê as suas. Se for Admin, vê tudo.
        if (currentUser && currentUser.role === UserRole.TEACHER) {
            qRef = query(collection(db, COLLECTIONS.QUESTIONS), where("authorId", "==", currentUser.id));
        } else {
            qRef = query(collection(db, COLLECTIONS.QUESTIONS)); // Admin vê tudo
        }

        const snapshot = await getDocs(qRef);
        return snapshot.docs.map(d => {
            const data = d.data();
            data.id = d.id;
            return data as Question;
        });
    },

    addQuestion: async (q: Question) => {
        // Usa variável explicitamente tipada como ANY para evitar erro de tipo "Property 'id' does not exist on type 'unknown'"
        const plainData: any = JSON.parse(JSON.stringify(q));
        delete plainData.id;
        
        // Garante que o authorId esteja preenchido se não estiver
        if (!plainData.authorId && auth.currentUser) {
            plainData.authorId = auth.currentUser.uid;
        }
        
        const docRef = await addDoc(collection(db, COLLECTIONS.QUESTIONS), plainData);
        
        plainData.id = docRef.id;
        return plainData as Question;
    },

    updateQuestion: async (q: Question) => {
        const { id, ...rest } = q;
        if (!id) throw new Error("ID da questão obrigatório");
        await updateDoc(doc(db, COLLECTIONS.QUESTIONS, id), rest);
    },

    deleteQuestion: async (id: string) => {
        await deleteDoc(doc(db, COLLECTIONS.QUESTIONS, id));
    },

    // --- PROVAS (DATA ISOLATION) ---
    getExams: async (currentUser?: User | null) => {
        let eRef;
        if (currentUser && currentUser.role === UserRole.TEACHER) {
            eRef = query(collection(db, COLLECTIONS.EXAMS), where("authorId", "==", currentUser.id));
        } else {
            eRef = query(collection(db, COLLECTIONS.EXAMS)); // Admin vê tudo
        }

        const snapshot = await getDocs(eRef);
        return snapshot.docs.map(d => {
            const data = d.data();
            data.id = d.id;
            return data as Exam;
        });
    },

    getExamById: async (id: string) => {
        const docRef = doc(db, COLLECTIONS.EXAMS, id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const data = snap.data();
            data.id = snap.id;
            return data as Exam;
        }
        return null;
    },

    saveExam: async (exam: Exam) => {
        // Usa variável explicitamente tipada como ANY para evitar erro de tipo "Property 'id' does not exist on type 'unknown'"
        const plainData: any = JSON.parse(JSON.stringify(exam));
        const id = plainData.id;
        delete plainData.id;
        
        // Garante authorId
        if (!plainData.authorId && auth.currentUser) {
            plainData.authorId = auth.currentUser.uid;
        }

        if (id) {
            await updateDoc(doc(db, COLLECTIONS.EXAMS, id), plainData);
            plainData.id = id;
            return plainData as Exam;
        } else {
            const docRef = await addDoc(collection(db, COLLECTIONS.EXAMS), plainData);
            plainData.id = docRef.id;
            return plainData as Exam;
        }
    },

    deleteExam: async (id: string) => {
        await deleteDoc(doc(db, COLLECTIONS.EXAMS, id));
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
            const data = d.data();
            data.id = d.id;
            return data as ExamAttempt;
        });
    },

    getExamResults: async (examId: string) => {
        const q = query(collection(db, COLLECTIONS.ATTEMPTS), where("examId", "==", examId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => {
            const data = d.data();
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
