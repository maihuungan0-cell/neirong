
import { GoogleGenAI } from "@google/genai";

// Types for Vercel Serverless Functions
type VercelRequest = any; 
type VercelResponse = any;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { systemPrompt, userPrompt } = req.body;
        
        // ------------------------------------------------------------------
        // Strategy 1: DeepSeek API (deepseek-reasoner)
        // ------------------------------------------------------------------
        const deepseekKey = process.env.DEEPSEEK_API_KEY;

        if (deepseekKey) {
            const response = await fetch("https://api.deepseek.com/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${deepseekKey}`
                },
                body: JSON.stringify({
                    model: "deepseek-reasoner",
                    messages: [
                        { role: "system", content: systemPrompt || "你是一名资深的内容编辑。" },
                        { role: "user", content: userPrompt }
                    ],
                    stream: false
                })
            });

            const data = await response.json();
            
            if (data.error) {
                throw new Error(`DeepSeek API Error: ${data.error.message || JSON.stringify(data.error)}`);
            }

            const text = data.choices?.[0]?.message?.content;
            return res.status(200).json({ text: text || "" });
        }
        
        // ------------------------------------------------------------------
        // Strategy 2: Fallback (Gemini)
        // ------------------------------------------------------------------
        const googleKey = process.env.API_KEY;
        if (googleKey) {
            const ai = new GoogleGenAI({ apiKey: googleKey });
            const response = await ai.models.generateContent({
                model: 'gemini-3-pro-preview',
                contents: userPrompt,
                config: { systemInstruction: systemPrompt },
            });
            return res.status(200).json({ text: response.text || "" });
        }

        throw new Error("No API Keys configured. Please set DEEPSEEK_API_KEY or API_KEY in environment variables.");

    } catch (error: any) {
        console.error("API Error:", error);
        return res.status(500).json({ error: error.message || "Internal Server Error" });
    }
}
