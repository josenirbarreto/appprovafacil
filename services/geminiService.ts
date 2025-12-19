
import { GoogleGenAI, Type } from "@google/genai";
import { Question, QuestionType } from "../types";
import { FirebaseService } from "./firebaseService";

const getClient = () => {
    // Fix: Using process.env.API_KEY directly as per guidelines
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
}

export const GeminiService = {
    generateQuestion: async (
        topicName: string, 
        type: QuestionType, 
        difficulty: string
    ): Promise<Partial<Question> | null> => {
        try {
            const ai = getClient();
            
            let prompt = `Create a rigorous academic question about "${topicName}". Difficulty: ${difficulty}. `;
            
            if (type === QuestionType.MULTIPLE_CHOICE) {
                prompt += `Type: Multiple Choice. Provide 4 options, one correct.`;
            } else if (type === QuestionType.TRUE_FALSE) {
                prompt += `Type: True/False statement.`;
            } else if (type === QuestionType.SHORT_ANSWER) {
                prompt += `Type: Short Answer. Provide the expected answer key text.`;
            } else if (type === QuestionType.NUMERIC) {
                prompt += `Type: Numeric Problem. The answer must be a number. Provide the correct number as the answer key.`;
            } else if (type === QuestionType.ASSOCIATION) {
                prompt += `Type: Association/Matching. Provide pairs to match (e.g. Term A - Definition B).`;
            }

            // Fix: responseSchema uses Type enum and object structure directly, removed Schema type import
            const schema = {
                type: Type.OBJECT,
                properties: {
                    enunciado: { type: Type.STRING, description: "The question text/statement (in Portuguese)" },
                    options: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                text: { type: Type.STRING },
                                isCorrect: { type: Type.BOOLEAN }
                            }
                        }
                    }
                },
                required: ["enunciado", "options"]
            };

            const response = await ai.models.generateContent({
                // Fix: Using recommended gemini-3-flash-preview model
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: schema,
                    systemInstruction: "You are an assistant for teachers creating exams in Brazil. Respond strictly in Portuguese.",
                    temperature: 0.7
                }
            });

            // TRACK USAGE
            FirebaseService.trackAiUsage();

            if (response.text) {
                const data = JSON.parse(response.text);
                return {
                    enunciado: data.enunciado,
                    type: type,
                    difficulty: difficulty as any,
                    options: data.options?.map((opt: any, idx: number) => ({
                        id: `gen-${Date.now()}-${idx}`,
                        text: opt.text,
                        isCorrect: opt.isCorrect
                    })) || []
                };
            }
            return null;

        } catch (error) {
            console.error("Gemini Generation Error:", error);
            return null;
        }
    },

    parseQuestionsFromText: async (text: string): Promise<Partial<Question>[]> => {
        try {
            const ai = getClient();
            
            const schema = {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        enunciado: { type: Type.STRING },
                        type: { type: Type.STRING, enum: [QuestionType.MULTIPLE_CHOICE, QuestionType.TRUE_FALSE, QuestionType.SHORT_ANSWER, QuestionType.NUMERIC] },
                        options: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    text: { type: Type.STRING },
                                    isCorrect: { type: Type.BOOLEAN }
                                }
                            }
                        }
                    },
                    required: ["enunciado", "type", "options"]
                }
            };

            const prompt = `
                Analise o texto abaixo extraído de um arquivo PDF de prova.
                Identifique todas as questões, suas alternativas e, se possível, a resposta correta (gabarito).
                Se não encontrar a resposta correta explicitamente, marque todas as isCorrect como false.
                Tente inferir o tipo da questão (MULTIPLE_CHOICE, TRUE_FALSE, SHORT_ANSWER).
                
                Texto do PDF:
                """
                ${text.substring(0, 30000)} 
                """
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: schema,
                    systemInstruction: "Você é um especialista em estruturar dados de provas escolares. Extraia as questões com precisão.",
                    temperature: 0.4 
                }
            });

            FirebaseService.trackAiUsage();

            if (response.text) {
                const data = JSON.parse(response.text);
                return data.map((q: any) => ({
                    ...q,
                    difficulty: 'Medium', 
                    options: q.options?.map((opt: any, idx: number) => ({
                        id: `imp-${Date.now()}-${Math.random()}-${idx}`,
                        text: opt.text,
                        isCorrect: opt.isCorrect
                    })) || []
                }));
            }
            return [];

        } catch (error) {
            console.error("Gemini Parse Error:", error);
            return [];
        }
    },

    checkSimilarity: async (newQuestionText: string, candidates: Question[]): Promise<{ isDuplicate: boolean, score: number, matchId?: string, reason?: string }> => {
        try {
            if (candidates.length === 0) return { isDuplicate: false, score: 0 };
            const ai = getClient();
            
            const candidatesJson = candidates.map(c => ({
                id: c.id,
                text: c.enunciado.replace(/<[^>]*>?/gm, '').substring(0, 300) 
            }));

            const prompt = `
                Analise se a "NOVA QUESTÃO" é semanticamente duplicada ou muito parecida com alguma das "CANDIDATAS".
                
                NOVA QUESTÃO: "${newQuestionText.replace(/<[^>]*>?/gm, '')}"
                
                CANDIDATAS:
                ${JSON.stringify(candidatesJson)}
                
                Responda APENAS o JSON.
            `;

            const schema = {
                type: Type.OBJECT,
                properties: {
                    isDuplicate: { type: Type.BOOLEAN },
                    matchId: { type: Type.STRING, nullable: true },
                    score: { type: Type.NUMBER },
                    reason: { type: Type.STRING }
                },
                required: ["isDuplicate", "score"]
            };

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: schema,
                    temperature: 0.1 
                }
            });

            FirebaseService.trackAiUsage();

            if (response.text) {
                return JSON.parse(response.text);
            }
            return { isDuplicate: false, score: 0 };

        } catch (error) {
            console.error("Similarity Check Error:", error);
            return { isDuplicate: false, score: 0 };
        }
    },

    gradeExamImage: async (imageBase64: string, totalQuestions: number): Promise<{ studentName: string, answers: Record<string, string> } | null> => {
        try {
            const ai = getClient();
            const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");

            const prompt = `
                VOCÊ É UM SCANNER DE GABARITOS DE ALTA PRECISÃO.
                
                ESTRUTURA DA IMAGEM:
                1. Quatro quadrados pretos nos cantos (âncoras). Use-os para alinhar a perspectiva.
                2. Layout de questões em 2 COLUNAS VERTICAIS (Lado a Lado).
                3. Algumas linhas de questão podem conter o texto '[ DISSERTATIVA ]' em vez de bolhas de marcação.
                
                SUA MISSÃO:
                1. Identificar o NOME do aluno escrito no campo superior.
                2. Para cada questão de 1 até ${totalQuestions}:
                   - Se houver bolhas (A, B, C, D, E), identifique qual está pintada.
                   - Se a linha contiver '[ DISSERTATIVA ]', retorne null para essa resposta.
                   - Ignore borrões e considere o preenchimento mais escuro e centralizado.
                
                Retorne APENAS um JSON:
                {
                    "studentName": "Nome Extraído",
                    "answers": {
                        "1": "A",
                        "2": null,
                        "3": "C"
                        ... (até ${totalQuestions})
                    }
                }
            `;

            const schema = {
                type: Type.OBJECT,
                properties: {
                    studentName: { type: Type.STRING },
                    answers: {
                        type: Type.OBJECT,
                        description: "Chave é o número da questão, valor é a letra (A, B, C, D, E) ou null"
                    }
                },
                required: ["answers"]
            };

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                // Fix: Corrected multi-part contents structure to use { parts: [...] }
                contents: {
                    parts: [
                        { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
                        { text: prompt }
                    ]
                },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: schema,
                    temperature: 0.1
                }
            });

            FirebaseService.trackAiUsage();

            if (response.text) {
                return JSON.parse(response.text);
            }
            return null;

        } catch (error) {
            console.error("Gemini Vision Grading Error:", error);
            return null;
        }
    }
};
