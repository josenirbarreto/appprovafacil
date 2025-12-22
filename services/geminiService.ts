
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
                prompt += `Tipo: Múltipla Escolha. Forneça 4 ou 5 alternativas, uma correta. NÃO inclua as letras das alternativas no enunciado.`;
            } else if (type === QuestionType.TRUE_FALSE) {
                prompt += `Tipo: Verdadeiro ou Falso.`;
            } else if (type === QuestionType.SHORT_ANSWER) {
                prompt += `Tipo: Dissertativa/Aberta. Forneça o enunciado e uma resposta esperada no campo de sugestão de gabarito.`;
            }

            const schema = {
                type: Type.OBJECT,
                properties: {
                    enunciado: { type: Type.STRING, description: "O texto da questão em HTML formatado. NÃO inclua as alternativas aqui." },
                    options: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                text: { type: Type.STRING },
                                isCorrect: { type: Type.BOOLEAN }
                            }
                        }
                    },
                    gabaritoSugerido: { type: Type.STRING, description: "Para dissertativas, a resposta correta esperada." }
                },
                required: ["enunciado"]
            };

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: schema,
                    systemInstruction: "Você é um assistente pedagógico de elite. Responda sempre em Português do Brasil. Mantenha enunciado e alternativas estritamente separados.",
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
                    })) : [],
                    // FIX: 'options_association' changed to 'pairs' which is a valid property of Question type
                    pairs: []
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
                        enunciado: { type: Type.STRING, description: "Texto do comando da questão em HTML. REMOVA as alternativas deste campo." },
                        type: { type: Type.STRING, enum: ["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER", "NUMERIC"] },
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
                    required: ["enunciado", "type"]
                }
            };

            const prompt = `
                Analise o texto de uma prova e extraia as questões.
                
                REGRAS DE OURO:
                1. O campo 'enunciado' deve conter APENAS o comando da pergunta. 
                2. NUNCA inclua as alternativas (A, B, C...) dentro do enunciado.
                3. Se encontrar alternativas no texto original, remova-as do enunciado e coloque-as estritamente no campo 'options'.
                4. Se não houver alternativas, marque como SHORT_ANSWER.
                5. Se a resposta for apenas um número, marque como NUMERIC.
                
                Texto:
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
                    systemInstruction: "Você é um especialista em estruturação de dados. Sua prioridade é separar o comando da questão de suas alternativas.",
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
                    options: (Array.isArray(q.options) ? q.options.map((opt: any, idx: number) => ({
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

    // FIX: Added missing 'checkSimilarity' method used in ModerationPage
    checkSimilarity: async (enunciado: string, candidates: Question[]): Promise<any> => {
        try {
            if (candidates.length === 0) return { isDuplicate: false, score: 0 };
            
            const ai = getClient();
            
            const schema = {
                type: Type.OBJECT,
                properties: {
                    isDuplicate: { type: Type.BOOLEAN, description: "Verdadeiro se houver alta similaridade semântica" },
                    score: { type: Type.NUMBER, description: "Probabilidade de 0 a 100 de ser a mesma questão" },
                    reason: { type: Type.STRING, description: "Explicação técnica da duplicidade" },
                    matchId: { type: Type.STRING, description: "ID da questão existente mais parecida" }
                },
                required: ["isDuplicate", "score", "reason"]
            };

            // Filtra candidatos para enviar apenas o texto plano para economizar tokens
            const candidateTexts = candidates.slice(0, 20).map(c => ({
                id: c.id,
                text: c.enunciado.replace(/<[^>]*>?/gm, '').substring(0, 500)
            }));

            const prompt = `
                Avalie se a questão abaixo é uma duplicata semântica de alguma das questões existentes no banco de dados.
                Ignore diferenças de formatação HTML ou pontuação menor.
                
                QUESTÃO NOVA:
                "${enunciado.replace(/<[^>]*>?/gm, '')}"
                
                BANCO DE CANDIDATOS:
                ${JSON.stringify(candidateTexts)}
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: schema,
                    systemInstruction: "Você é um auditor de integridade pedagógica. Sua função é impedir que questões repetidas entrem no acervo global.",
                    temperature: 0.1
                }
            });

            FirebaseService.trackAiUsage();

            if (response.text) {
                return JSON.parse(response.text);
            }
            return { isDuplicate: false, score: 0, reason: "Análise inconclusiva" };
        } catch (error) {
            console.error("Gemini Similarity Error:", error);
            return { isDuplicate: false, score: 0, reason: "Erro ao processar análise de similaridade" };
        }
    }
};
