
import * as crypto from 'crypto';
// Fix: Import Buffer to resolve 'Cannot find name Buffer' error in Node environment
import { Buffer } from 'buffer';
// Fix: Import GoogleGenAI from the official SDK
import { GoogleGenAI } from "@google/genai";

// Types for Vercel Serverless Functions
type VercelRequest = any; 
type VercelResponse = any;

// Tencent Cloud Configuration
const TENCENT_HOST = "hunyuan.tencentcloudapi.com";
const TENCENT_SERVICE = "hunyuan";
const TENCENT_REGION = "ap-guangzhou"; 
const TENCENT_ACTION = "ChatCompletions";
const TENCENT_VERSION = "2023-09-01";

// Helper: Hash
function getHash(message: string): string {
    const hash = crypto.createHash('sha256');
    return hash.update(message).digest('hex');
}

// Helper: Date String YYYY-MM-DD
function getDate(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    const year = date.getUTCFullYear();
    const month = ('0' + (date.getUTCMonth() + 1)).slice(-2);
    const day = ('0' + date.getUTCDate()).slice(-2);
    return `${year}-${month}-${day}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { systemPrompt, userPrompt } = req.body;
        
        // ------------------------------------------------------------------
        // Strategy 1: Tencent Cloud Hunyuan
        // ------------------------------------------------------------------
        const secretId = process.env.TENCENT_SECRET_ID;
        const secretKey = process.env.TENCENT_SECRET_KEY;

        if (secretId && secretKey) {
            const timestamp = Math.floor(Date.now() / 1000);
            const date = getDate(timestamp);

            // 严格遵循腾讯云 V3 协议的 JSON 类型要求
            const payloadObj = {
                Model: "hunyuan-pro",
                Messages: [
                    { Role: "system", Content: systemPrompt || "你是一名资深的深度内容主编。" },
                    { Role: "user", Content: userPrompt }
                ],
                // 修复：根据报错信息，SearchInfo 应直接为布尔值
                SearchInfo: true
            };
            const payload = JSON.stringify(payloadObj);

            // --- Tencent Cloud V3 Signature Process ---
            const hashedPayload = getHash(payload);
            const canonicalHeaders = `content-type:application/json\nhost:${TENCENT_HOST}\n`;
            const signedHeaders = "content-type;host";
            const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${hashedPayload}`;

            const credentialScope = `${date}/${TENCENT_SERVICE}/tc3_request`;
            const hashedCanonicalRequest = getHash(canonicalRequest);
            const stringToSign = `TC3-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${hashedCanonicalRequest}`;

            const secretDate = crypto.createHmac('sha256', "TC3" + secretKey).update(date).digest();
            const secretService = crypto.createHmac('sha256', secretDate).update(TENCENT_SERVICE).digest();
            const secretSigning = crypto.createHmac('sha256', secretService).update("tc3_request").digest();
            const signature = crypto.createHmac('sha256', secretSigning).update(stringToSign).digest('hex');

            const authorization = `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

            const response = await fetch(`https://${TENCENT_HOST}/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Host": TENCENT_HOST,
                    "X-TC-Action": TENCENT_ACTION,
                    "X-TC-Version": TENCENT_VERSION,
                    "X-TC-Timestamp": timestamp.toString(),
                    "X-TC-Region": TENCENT_REGION,
                    "Authorization": authorization
                },
                body: payload
            });

            const data = await response.json();
            
            if (data.Response && data.Response.Error) {
                throw new Error(`腾讯云报错: ${data.Response.Error.Message} (${data.Response.Error.Code})`);
            }

            const text = data.Response?.Choices?.[0]?.Message?.Content;
            if (!text) throw new Error("腾讯云返回内容为空");

            return res.status(200).json({ text });
        }
        
        // ------------------------------------------------------------------
        // Strategy 2: Google Gemini (Fallback)
        // ------------------------------------------------------------------
        const googleKey = process.env.API_KEY;
        if (googleKey) {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: 'gemini-3-pro-preview',
                contents: userPrompt,
                config: {
                    systemInstruction: systemPrompt,
                },
            });
            
            return res.status(200).json({ text: response.text || "" });
        }

        throw new Error("服务器配置错误: 未设置腾讯云或 Google API 密钥。");

    } catch (error: any) {
        console.error("API Error:", error);
        return res.status(500).json({ error: error.message || "Internal Server Error" });
    }
}
