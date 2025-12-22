
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
            
            let prompt = `Crie uma questão acadêmica rigorosa sobre o tema "${topicName}". Dificuldade: ${difficulty}. `;
            
            if (type === QuestionType.MULTIPLE_CHOICE) {
                prompt += `Tipo: Múltipla Escolha. Forneça 5 alternativas, uma única correta. `;
            } else if (type === QuestionType.TRUE_FALSE) {
                prompt += `Tipo: Verdadeiro ou Falso. `;
            } else if (type === QuestionType.SHORT_ANSWER) {
                prompt += `Tipo: Dissertativa/Aberta. `;
            }

            const schema = {
                type: Type.OBJECT,
                properties: {
                    enunciado: { type: Type.STRING, description: "O comando da questão em HTML formatado. PROIBIDO listar as alternativas aqui." },
                    options: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                text: { type: Type.STRING, description: "Apenas o texto da opção, sem a letra (A, B, C)." },
                                isCorrect: { type: Type.BOOLEAN }
                            }
                        }
                    },
                    gabaritoSugerido: { type: Type.STRING, description: "Resposta padrão ou critérios de avaliação." }
                },
                required: ["enunciado"]
            };

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: schema,
                    systemInstruction: `Você é um avaliador pedagógico. REGRAS CRÍTICAS:
1. O campo 'enunciado' contém APENAS o texto da pergunta.
2. NUNCA coloque as alternativas (A, B, C...) dentro do enunciado.
3. As alternativas devem residir EXCLUSIVAMENTE no array 'options'.
4. Use HTML básico (<p>, <b>, <i>) para formatar o enunciado.`,
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
                        enunciado: { type: Type.STRING, description: "Comando da questão limpo. REMOVA qualquer lista de alternativas (A, B, C...) que estiver no texto original." },
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
                Extraia as questões do texto abaixo de forma estruturada.
                
                REGRAS DE OURO PARA SEPARAÇÃO:
                1. IDENTIFIQUE o comando da questão (texto principal) e coloque no campo 'enunciado'.
                2. IDENTIFIQUE as alternativas (geralmente começam com A), B), C)...).
                3. REMOVA as alternativas do texto do enunciado.
                4. COLOQUE as alternativas limpas no array 'options'.
                5. Se o texto for apenas uma pergunta sem alternativas, use 'SHORT_ANSWER'.
                
                TEXTO DO PDF:
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
                    systemInstruction: "Sua função é sanitizar enunciados. Você deve remover as alternativas de dentro do corpo do enunciado para que os campos fiquem separados no banco de dados.",
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

    checkSimilarity: async (enunciado: string, candidates: Question[]): Promise<any> => {
        try {
            if (candidates.length === 0) return { isDuplicate: false, score: 0 };
            const ai = getClient();
            const schema = {
                type: Type.OBJECT,
                properties: {
                    isDuplicate: { type: Type.BOOLEAN },
                    score: { type: Type.NUMBER },
                    reason: { type: Type.STRING },
                    matchId: { type: Type.STRING }
                },
                required: ["isDuplicate", "score", "reason"]
            };

            const candidateTexts = candidates.slice(0, 20).map(c => ({ id: c.id, text: c.enunciado.replace(/<[^>]*>?/gm, '').substring(0, 500) }));
            const prompt = `Avalie duplicidade semântica.\nQUESTÃO NOVA: "${enunciado.replace(/<[^>]*>?/gm, '')}"\nCANDIDATOS: ${JSON.stringify(candidateTexts)}`;

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.1 }
            });

            FirebaseService.trackAiUsage();
            if (response.text) return JSON.parse(response.text);
            return { isDuplicate: false, score: 0, reason: "Inconclusivo" };
        } catch (error) {
            return { isDuplicate: false, score: 0, reason: "Erro" };
        }
    }
};
