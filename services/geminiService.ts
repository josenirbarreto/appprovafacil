
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Question, QuestionType } from "../types";
import { FirebaseService } from "./firebaseService";

const getClient = () => {
    const apiKey = process.env.API_KEY || ''; 
    return new GoogleGenAI({ apiKey });
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

            // Define Schema based on type
            const schema: Schema = {
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
                model: 'gemini-2.5-flash',
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
            
            // Schema para retornar uma lista de questões
            const schema: Schema = {
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
                (O texto foi truncado se for muito longo).
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: schema,
                    systemInstruction: "Você é um especialista em estruturar dados de provas escolares. Extraia as questões com precisão.",
                    temperature: 0.4 // Temperatura baixa para ser mais fiel ao texto
                }
            });

            // TRACK USAGE
            FirebaseService.trackAiUsage();

            if (response.text) {
                const data = JSON.parse(response.text);
                // Adiciona IDs temporários
                return data.map((q: any) => ({
                    ...q,
                    difficulty: 'Medium', // Padrão
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
                text: c.enunciado.replace(/<[^>]*>?/gm, '').substring(0, 300) // Strip HTML e trunca
            }));

            const prompt = `
                Analise se a "NOVA QUESTÃO" é semanticamente duplicada ou muito parecida com alguma das "CANDIDATAS".
                
                NOVA QUESTÃO: "${newQuestionText.replace(/<[^>]*>?/gm, '')}"
                
                CANDIDATAS:
                ${JSON.stringify(candidatesJson)}
                
                Critérios:
                - Se for a mesma pergunta com palavras levemente diferentes -> Duplicada.
                - Se for sobre o mesmo assunto mas pergunta diferente -> Não duplicada.
                
                Responda APENAS o JSON.
            `;

            const schema: Schema = {
                type: Type.OBJECT,
                properties: {
                    isDuplicate: { type: Type.BOOLEAN },
                    matchId: { type: Type.STRING, nullable: true },
                    score: { type: Type.NUMBER, description: "Similarity score from 0 to 100" },
                    reason: { type: Type.STRING, description: "Why it is considered duplicate" }
                },
                required: ["isDuplicate", "score"]
            };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: schema,
                    temperature: 0.1 // Baixa criatividade para ser analítico
                }
            });

            // TRACK USAGE
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

    // --- NOVA FUNÇÃO DE CORREÇÃO POR IMAGEM ---
    gradeExamImage: async (imageBase64: string, totalQuestions: number): Promise<{ studentName: string, answers: Record<string, string> } | null> => {
        try {
            const ai = getClient();
            
            // Remove prefixo data:image/png;base64, se existir
            const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");

            const prompt = `
                Analise esta imagem de um Cartão-Resposta (Gabarito) de prova escolar.
                
                Tarefas:
                1. Tente identificar o NOME do aluno se estiver escrito à mão no topo (campo "Aluno"). Se ilegível ou vazio, retorne string vazia.
                2. Para cada questão de 1 a ${totalQuestions}, identifique qual bolha (A, B, C, D ou E) está preenchida.
                
                Regras:
                - Se uma bolha estiver claramente pintada ou marcada com X, considere como resposta.
                - Se houver rasura ou múltiplas marcas na mesma linha, considere como null.
                - Se a linha estiver vazia, considere como null.
                
                Retorne APENAS um JSON no formato:
                {
                    "studentName": "Nome Detectado",
                    "answers": {
                        "1": "A",
                        "2": "C",
                        "3": null
                        ... até ${totalQuestions}
                    }
                }
            `;

            const schema: Schema = {
                type: Type.OBJECT,
                properties: {
                    studentName: { type: Type.STRING, nullable: true },
                    answers: {
                        type: Type.OBJECT,
                        nullable: false,
                        description: "Map of question index (string) to selected option (A, B, C, D, E or null)"
                    }
                },
                required: ["answers"]
            };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [
                    { 
                        inlineData: { 
                            mimeType: 'image/jpeg', 
                            data: cleanBase64 
                        } 
                    },
                    { text: prompt }
                ],
                config: {
                    responseMimeType: "application/json",
                    responseSchema: schema,
                    temperature: 0.1 // Baixa temperatura para ser preciso na leitura
                }
            });

            // TRACK USAGE
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
