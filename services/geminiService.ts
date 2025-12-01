import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Question, QuestionType } from "../types";

const getClient = () => {
    const apiKey = process.env.API_KEY || ''; // In a real app, handle missing key gracefully
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
                prompt += `Type: Short Answer (provide a suggested answer key).`;
            }

            // Define Schema based on type
            const schema: Schema = {
                type: Type.OBJECT,
                properties: {
                    enunciado: { type: Type.STRING, description: "The question text/statement" },
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
                    systemInstruction: "You are an assistant for teachers creating exams. Respond in Portuguese.",
                    temperature: 0.7
                }
            });

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
    }
};
