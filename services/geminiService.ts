
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
                    temperature: 0.4 
                }
            });

            // TRACK USAGE
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
                    temperature: 0.1 
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

    gradeExamImage: async (imageBase64: string, totalQuestions: number): Promise<{ studentName: string, answers: Record<string, string> } | null> => {
        try {
            const ai = getClient();
            const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");

            const prompt = `
                AJA COMO UM SCANNER DE GABARITO DE ALTA PRECISÃO.
                Esta imagem contém um Cartão-Resposta formatado com:
                1. Quatro marcadores pretos sólidos nos cantos (âncoras de orientação).
                2. Uma grade de bolhas organizada em 3 COLUNAS VERTICAIS.
                
                SUA TAREFA:
                1. Oriente a imagem usando os 4 quadrados pretos nos cantos.
                2. Detecte o NOME do aluno escrito no campo superior esquerdo.
                3. Examine cada linha de questão de 1 a ${totalQuestions}. 
                4. Identifique qual letra (A, B, C, D ou E) está preenchida/pintada com caneta escura.
                
                REGRAS DE LEITURA:
                - As questões estão dispostas em colunas: Coluna 1 (1-10), Coluna 2 (11-20), etc (dependendo do total).
                - Considere marcada a bolha que tiver o maior preenchimento escuro.
                - Se houver dúvida ou vazio, retorne null para aquela questão.
                
                Retorne APENAS um JSON:
                {
                    "studentName": "Nome do Aluno ou string vazia",
                    "answers": {
                        "1": "A",
                        "2": "D",
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
                        description: "Dicionário onde a chave é o número da questão e o valor é a letra preenchida (A, B, C, D, E ou null)"
                    }
                },
                required: ["answers"]
            };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [
                    { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
                    { text: prompt }
                ],
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
