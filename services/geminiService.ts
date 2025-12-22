
import { GoogleGenAI, Type } from "@google/genai";
import { Question, QuestionType } from "../types";
import { FirebaseService } from "./firebaseService";

const getClient = () => {
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
            
            let prompt = `Crie uma questão acadêmica rigorosa sobre "${topicName}". Dificuldade: ${difficulty}. `;
            
            if (type === QuestionType.MULTIPLE_CHOICE) {
                prompt += `Tipo: Múltipla Escolha. Forneça 4 ou 5 alternativas, uma correta.`;
            } else if (type === QuestionType.TRUE_FALSE) {
                prompt += `Tipo: Verdadeiro ou Falso.`;
            } else if (type === QuestionType.SHORT_ANSWER) {
                prompt += `Tipo: Dissertativa/Aberta. Não forneça alternativas, apenas o enunciado.`;
            }

            const schema = {
                type: Type.OBJECT,
                properties: {
                    enunciado: { type: Type.STRING, description: "O texto da questão em HTML formatado (pode usar <p>, <b>, <i>, <ul>, <li>)" },
                    options: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                text: { type: Type.STRING },
                                isCorrect: { type: Type.BOOLEAN }
                            }
                        },
                        description: "Obrigatório apenas para questões objetivas. Deixe vazio [] para dissertativas."
                    }
                },
                required: ["enunciado", "options"]
            };

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: schema,
                    systemInstruction: "Você é um assistente pedagógico de elite. Responda sempre em Português do Brasil.",
                    temperature: 0.7
                }
            });

            FirebaseService.trackAiUsage();

            if (response.text) {
                const data = JSON.parse(response.text);
                return {
                    enunciado: data.enunciado,
                    type: type,
                    difficulty: difficulty as any,
                    options: Array.isArray(data.options) ? data.options.map((opt: any, idx: number) => ({
                        id: `gen-${Date.now()}-${idx}`,
                        text: opt.text,
                        isCorrect: opt.isCorrect
                    })) : []
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
                        enunciado: { type: Type.STRING, description: "Texto completo da questão. Se houver comandos 'Assinale', inclua no enunciado." },
                        type: { type: Type.STRING, enum: ["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER"] },
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
                Analise o texto de uma prova e extraia TODAS as questões encontradas.
                
                REGRAS CRÍTICAS:
                1. Múltipla Escolha: Se houver letras (A, B, C...) seguidas de texto, identifique como MULTIPLE_CHOICE. Tente identificar a correta pelo contexto ou marque a primeira como false por padrão.
                2. Verdadeiro/Falso: Identifique como TRUE_FALSE.
                3. Dissertativa: Se não houver alternativas claras e for uma pergunta direta ou pedido de explicação, marque como SHORT_ANSWER e deixe options como [].
                4. Converta o enunciado para HTML básico (<p>, <b>, <i>).
                5. Se o texto estiver confuso, tente extrair o máximo possível que pareça uma pergunta acadêmica.
                
                Texto extraído do PDF:
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
                    systemInstruction: "Você é um especialista em OCR e estruturação de avaliações. Sua missão é não deixar nenhuma questão para trás.",
                    temperature: 0.1
                }
            });

            FirebaseService.trackAiUsage();

            if (response.text) {
                const data = JSON.parse(response.text);
                if (!Array.isArray(data)) return [];
                
                return data.map((q: any) => ({
                    ...q,
                    difficulty: 'Medium', 
                    options: (q.type === 'SHORT_ANSWER') ? [] : (Array.isArray(q.options) ? q.options.map((opt: any, idx: number) => ({
                        id: `imp-${Date.now()}-${Math.random()}-${idx}`,
                        text: opt.text,
                        isCorrect: opt.isCorrect || false
                    })) : [])
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
                SUA MISSÃO:
                1. Identificar o NOME do aluno escrito no campo superior.
                2. Para cada questão de 1 até ${totalQuestions}:
                   - Se houver bolhas (A, B, C, D, E), identifique qual está pintada.
                
                Retorne APENAS um JSON.
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
