import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { LucideSparkles, LucideCopy, LucideSearch, LucideBookOpen, LucideSend, LucideLoader2, LucideWand2, LucideX, LucideImage, LucideExternalLink, LucideMaximize2, LucideMinimize2, LucideAlignJustify } from "lucide-react";

// --- Types ---
interface GeneratedPost {
  title: string;
  angle: string;
  imageKeyword: string;
  content: string;
}

interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

// Quick presets for the rewrite feature
const REWRITE_PRESETS = [
  "小红书风 (Emoji+种草)", 
  "幽默搞笑", 
  "情感细腻 (走心)", 
  "极简高冷", 
  "震惊体标题党",
  "温柔邻家"
];

// --- Tencent Cloud API Helpers (Browser Compatible) ---
// 实现腾讯云 V3 签名算法
async function sha256Hex(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmac(key: Uint8Array | string, msg: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const keyData = typeof key === 'string' ? encoder.encode(key) : key;
  const msgData = encoder.encode(msg);
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  return new Uint8Array(signature);
}

async function callTencentHunyuan(systemPrompt: string, userPrompt: string) {
  // 辅助函数：尝试读取不同前缀的环境变量
  const getEnvVar = (key: string) => {
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key] || 
             process.env[`NEXT_PUBLIC_${key}`] || 
             process.env[`VITE_${key}`] || 
             process.env[`REACT_APP_${key}`];
    }
    return undefined;
  };

  // 1. 尝试从环境变量读取
  const envId = getEnvVar('TENCENT_SECRET_ID');
  const envKey = getEnvVar('TENCENT_SECRET_KEY');

  // 2. 兜底 Key (注意：生产环境请务必使用后端转发，不要暴露 Key)
  const secretId = envId || "AKIDWzLftR9nMsUahwCPUREuushXI8qPvJfs";
  const secretKey = envKey || "7X0R1kaZTFA0jhnmdLakniUB6wc7VwFR";
  
  if (!secretId || !secretKey) {
    throw new Error("Missing Tencent Cloud Credentials. Please check your keys.");
  }

  const endpoint = "hunyuan.tencentcloudapi.com";
  const service = "hunyuan";
  const region = ""; 
  const action = "ChatCompletions";
  const version = "2023-09-01";
  
  // Construct Payload
  const payload = {
    Model: "hunyuan-standard", 
    Messages: [
      { Role: "system", Content: systemPrompt },
      { Role: "user", Content: userPrompt }
    ],
    Temperature: 0.7
  };
  const payloadStr = JSON.stringify(payload);

  // 1. Timestamp variables
  const now = new Date();
  const timestamp = Math.floor(now.getTime() / 1000);
  const date = now.toISOString().slice(0, 10); // YYYY-MM-DD

  // 2. Canonical Request
  const httpRequestMethod = "POST";
  const canonicalUri = "/";
  const canonicalQueryString = "";
  
  // Critical: 只签名 content-type，不签名 Host。
  // 这样无论请求是发给 Proxy 还是直接发给腾讯云，签名都是有效的。
  const canonicalHeaders = "content-type:application/json\n";
  const signedHeaders = "content-type";
  
  const hashedRequestPayload = await sha256Hex(payloadStr);
  const canonicalRequest = `${httpRequestMethod}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${hashedRequestPayload}`;

  // 3. String to Sign
  const algorithm = "TC3-HMAC-SHA256";
  const credentialScope = `${date}/${service}/tc3_request`;
  const hashedCanonicalRequest = await sha256Hex(canonicalRequest);
  const stringToSign = `${algorithm}\n${timestamp}\n${credentialScope}\n${hashedCanonicalRequest}`;

  // 4. Calculate Signature
  const kSecret = "TC3" + secretKey;
  const kDate = await hmac(kSecret, date);
  const kService = await hmac(kDate, service);
  const kSigning = await hmac(kService, "tc3_request");
  const signatureRaw = await hmac(kSigning, stringToSign);
  const signatureHex = Array.from(signatureRaw).map(b => b.toString(16).padStart(2, '0')).join('');

  // 5. Authorization Header
  const authorization = `${algorithm} Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signatureHex}`;

  // Headers object
  const headers = {
    "Content-Type": "application/json",
    "Authorization": authorization,
    "X-TC-Action": action,
    "X-TC-Version": version,
    "X-TC-Timestamp": timestamp.toString(),
  };

  // --- 双重请求策略 ---
  // 策略 A: 尝试使用 CORS Proxy (默认)
  try {
    const proxyUrl = "https://corsproxy.io/?";
    // 编码目标 URL，防止特殊字符导致代理解析错误
    const targetUrl = encodeURIComponent(`https://${endpoint}`);
    
    const response = await fetch(`${proxyUrl}${targetUrl}`, {
      method: "POST",
      headers,
      body: payloadStr
    });

    if (!response.ok) {
      const errText = await response.text();
      // 如果是鉴权错误(401/403)，大概率是 Key 有问题，代理是通的，直接抛出
      if (response.status === 401 || response.status === 403) {
         throw new Error(`Tencent API Auth Error (${response.status}): ${errText}`);
      }
      // 其他错误(如500)可能是代理问题，抛出错误以触发 Catch 进入降级策略
      throw new Error(`Proxy Request Failed: ${response.status}`);
    }

    const data = await response.json();
    if (data.Response.Error) {
      throw new Error(`Tencent API Error: ${data.Response.Error.Message}`);
    }
    return data.Response.Choices?.[0]?.Message?.Content || "";

  } catch (proxyError: any) {
    console.warn("Proxy attempt failed, falling back to direct connection...", proxyError);
    
    // 如果是鉴权错误，不需要重试，直接抛出
    if (proxyError.message && proxyError.message.includes("Auth Error")) {
      throw proxyError;
    }

    // 策略 B: 尝试直连 (用户可能安装了 Allow CORS 插件)
    try {
      const response = await fetch(`https://${endpoint}`, {
        method: "POST",
        headers,
        body: payloadStr
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Direct Request Error (${response.status}): ${errText}`);
      }

      const data = await response.json();
      if (data.Response.Error) {
        throw new Error(`Tencent API Error: ${data.Response.Error.Message}`);
      }
      return data.Response.Choices?.[0]?.Message?.Content || "";

    } catch (directError: any) {
      // 两个策略都失败了，给出详细指导
      let errorMessage = "网络请求失败 (Failed to fetch)。\n\n";
      errorMessage += "原因：浏览器阻止了跨域请求 (CORS)，且公共代理暂时不可用。\n\n";
      errorMessage += "解决方案 (二选一)：\n";
      errorMessage += "1. 安装 'Allow CORS: Access-Control-Allow-Origin' 浏览器插件并开启 (推荐本地测试使用)。\n";
      errorMessage += "2. 检查您的网络是否屏蔽了 corsproxy.io。\n";
      
      throw new Error(errorMessage);
    }
  }
}

// --- Main Component ---
const App = () => {
  const [topic, setTopic] = useState("");
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [posts, setPosts] = useState<GeneratedPost[]>([]);
  const [sources, setSources] = useState<GroundingChunk[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Rewrite State
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [customStyle, setCustomStyle] = useState("");
  const [lengthPreference, setLengthPreference] = useState<'default' | 'expand' | 'shorten'>('default');
  const [rewriting, setRewriting] = useState(false);

  // --- Initial Generation ---
  const handleGenerate = async () => {
    if (!topic.trim()) return;

    setLoading(true);
    setError(null);
    setPosts([]);
    setSources([]);
    setEditingIndex(null); // Reset any open editors

    try {
      const systemPrompt = `You are a senior editor for a popular content platform. Target Audience: Mass market users. Core Value: Utility (有用) & Efficiency (高效).`;
      
      const userPrompt = `
        **Task:**
        1. Search for practical knowledge regarding: "${topic}".
        2. Generate 4 distinct, distinct articles that **TEACH** the user something specific.
        3. Context: "${context || "Focus on practical skills, safety tips, or efficiency."}"
        
        **Content Strategy (Default: Practical/Dry Goods):**
        - Teach specific methods (e.g., how to delete folders, how to claim insurance).
        - Be objective, clear, and helpful.

        **Strict Article Structure:**
        1.  **Opening**: Quick hook.
        2.  **Body**: Concise points.
        3.  **Conclusion**: Quick summary.
        4.  **Length**: **SHORT**. ~300-400 Chinese characters.

        **Output Requirements:**
        - **Variations**: 4 practical angles.
        - **Titles**: **STRICTLY UNDER 15 CHINESE CHARACTERS**.
        - **Angle Label**: Chinese, 2-4 chars (e.g. 实操教学).
        - **Image Keyword**: A short, descriptive ENGLISH keyword or phrase for finding a relevant stock photo (e.g. "messy desk", "smartphone security").
        - **Format**: 
        $$$TITLE$$$ [Title]
        $$$ANGLE$$$ [Angle]
        $$$IMAGE_KEYWORD$$$ [English Keyword]
        $$$CONTENT$$$
        [Body]
        ---POST_DIVIDER---
      `;

      // Call Tencent API
      const text = await callTencentHunyuan(systemPrompt, userPrompt);

      // Note: Hunyuan does not return grounding chunks in standard chat response easily like Gemini
      // So sources will be empty unless we parse them from text if the model includes links.
      setSources([]);

      const parsed = parseResponse(text);
      setPosts(parsed);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "生成失败，请重试。");
    } finally {
      setLoading(false);
    }
  };

  // --- Rewrite Specific Post ---
  const handleRewrite = async (index: number) => {
    if (!customStyle.trim()) return;
    
    setRewriting(true);
    const targetPost = posts[index];

    // Determine length instruction
    let lengthInstruction = "Length: Keep it short (~300-400 chars).";
    if (lengthPreference === 'expand') {
      lengthInstruction = "Length: EXPAND the content significantly. Add specific examples, step-by-step details, and deeper explanation. Target: 600-800 characters.";
    } else if (lengthPreference === 'shorten') {
      lengthInstruction = "Length: CONDENSE the content. Remove filler words. Be extremely concise and punchy. Target: < 200 characters.";
    }

    try {
      const systemPrompt = "Role: Expert Content Editor & Stylist.";
      const userPrompt = `
        **Task**: Rewrite the provided article to strictly match the **User's Desired Style** and **Length Preference**.
        
        **Original Article**:
        Title: ${targetPost.title}
        Content: ${targetPost.content}

        **Target Style Instruction**: "${customStyle}"
        (If "Xiaohongshu/小红书", use many emojis, bullet points, and enthusiastic tone. If "Emotional", focus on feelings.)

        **Target Length Instruction**: "${lengthInstruction}"

        **Constraints**:
        1. Keep the core useful information/facts.
        2. Change the Tone, Structure, and Title to fit the new style.
        3. **Title**: Under 15 chars, fitting the new style.
        4. **Image Keyword**: Update the English keyword if the tone changes significantly (e.g., from "office" to "cozy reading corner").

        **Output Format**:
        $$$TITLE$$$ [New Title]
        $$$ANGLE$$$ [New Style Label]
        $$$IMAGE_KEYWORD$$$ [New English Keyword]
        $$$CONTENT$$$
        [New Content]
      `;

      const text = await callTencentHunyuan(systemPrompt, userPrompt);
      
      // Parse single post result
      const titleMatch = text.match(/\$\$\$TITLE\$\$\$\s*(.+)/);
      const angleMatch = text.match(/\$\$\$ANGLE\$\$\$\s*(.+)/);
      const imageMatch = text.match(/\$\$\$IMAGE_KEYWORD\$\$\$\s*(.+)/);
      
      const contentSplit = text.split("$$$CONTENT$$$");
      let contentBody = contentSplit.length > 1 ? contentSplit[1].trim() : text.trim();
      contentBody = contentBody.replace(/\*\*/g, "").replace(/\*/g, "").replace(/---POST_DIVIDER---/g, "");

      const newPost: GeneratedPost = {
        title: titleMatch ? titleMatch[1].trim() : targetPost.title,
        angle: angleMatch ? angleMatch[1].trim() : "新风格",
        imageKeyword: imageMatch ? imageMatch[1].trim() : targetPost.imageKeyword,
        content: contentBody
      };

      // Update state
      const newPosts = [...posts];
      newPosts[index] = newPost;
      setPosts(newPosts);
      setEditingIndex(null); // Close editor
      setCustomStyle("");
      setLengthPreference('default');

    } catch (err: any) {
      alert("改写失败: " + err.message);
    } finally {
      setRewriting(false);
    }
  };

  // Helper to parse the multi-post response
  const parseResponse = (text: string): GeneratedPost[] => {
    // Basic cleanup
    const cleanText = text.replace(/```/g, ''); 
    
    const rawPosts = cleanText.split("---POST_DIVIDER---").filter(p => p.trim().length > 20);
    return rawPosts.map((raw) => {
      const titleMatch = raw.match(/\$\$\$TITLE\$\$\$\s*(.+)/);
      const angleMatch = raw.match(/\$\$\$ANGLE\$\$\$\s*(.+)/);
      const imageMatch = raw.match(/\$\$\$IMAGE_KEYWORD\$\$\$\s*(.+)/);
      
      const contentSplit = raw.split("$$$CONTENT$$$");
      let contentBody = contentSplit.length > 1 ? contentSplit[1].trim() : (raw.trim());
      contentBody = contentBody.replace(/\*\*/g, "").replace(/\*/g, "");
      return {
        title: titleMatch ? titleMatch[1].trim() : "未命名标题",
        angle: angleMatch ? angleMatch[1].trim() : "实用干货",
        imageKeyword: imageMatch ? imageMatch[1].trim() : "office",
        content: contentBody
      };
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const openEditor = (idx: number) => {
    if (editingIndex === idx) {
      setEditingIndex(null);
    } else {
      setEditingIndex(idx);
      setCustomStyle("");
      setLengthPreference('default');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-5xl font-black tracking-tight mb-4">
          <span className="gradient-text">TrendWeaver</span> 爆款推文
        </h1>
        <p className="text-slate-500 text-lg max-w-2xl mx-auto">
          输入主题，<b>腾讯混元 AI</b> 自动生成<b>实用、硬核</b>的科普短文，并自动匹配素材。
          <br />
          <span className="text-sm opacity-80">生成后可<b>自定义文风</b>及<b>篇幅长短</b></span>
        </p>
      </div>

      {/* Input Section */}
      <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 mb-12 border border-slate-100 max-w-3xl mx-auto">
        <div className="space-y-6">
          
          {/* Topic Input */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
              <LucideSearch className="w-4 h-4 text-indigo-500" />
              核心主题 (必填)
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="例如：快递单隐私保护、社保卡隐藏功能..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-lg"
            />
          </div>

          {/* Context Input */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
              <LucideBookOpen className="w-4 h-4 text-indigo-500" />
              知识点 / 侧重方向 (选填)
            </label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="例如：重点讲讲如何涂改二维码..."
              rows={2}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none"
            />
          </div>

          {/* Action Button */}
          <button
            onClick={handleGenerate}
            disabled={loading || !topic.trim()}
            className={`w-full py-4 rounded-xl font-bold text-white text-lg flex items-center justify-center gap-2 transition-all transform active:scale-[0.98]
              ${loading || !topic.trim() 
                ? 'bg-slate-300 cursor-not-allowed' 
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-lg hover:shadow-indigo-200'
              }`}
          >
            {loading ? (
              <>
                <LucideLoader2 className="w-6 h-6 animate-spin" />
                正在调用混元模型...
              </>
            ) : (
              <>
                <LucideSparkles className="w-6 h-6" />
                立即生成
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-8 text-center border border-red-100 whitespace-pre-wrap">
          {error}
        </div>
      )}

      {/* Results Grid */}
      {posts.length > 0 && (
        <div className="grid md:grid-cols-2 gap-6 animate-fade-in">
          {posts.map((post, idx) => (
            <div key={idx} className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border border-slate-100 overflow-hidden flex flex-col relative group">
              
              {/* Image Section (Freepik Link) */}
              <div className="relative h-48 bg-slate-100 overflow-hidden group/image">
                 {/* Visual Placeholder (Pollinations) */}
                 <img 
                   src={`https://image.pollinations.ai/prompt/${encodeURIComponent(post.imageKeyword)}?width=800&height=400&nologo=true`} 
                   alt={post.imageKeyword}
                   className="w-full h-full object-cover opacity-90 transition-transform duration-700 group-hover/image:scale-105"
                   onError={(e) => {
                     (e.target as HTMLImageElement).src = "https://placehold.co/800x400?text=No+Preview";
                   }}
                 />
                 
                 {/* Overlay Button for Freepik */}
                 <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                    <a 
                      href={`https://www.freepik.com/search?format=search&query=${encodeURIComponent(post.imageKeyword)}&license=free`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="bg-white text-slate-800 px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 shadow-lg hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                    >
                      <LucideImage className="w-4 h-4" />
                      Freepik 免费配图
                      <LucideExternalLink className="w-3 h-3 text-slate-400" />
                    </a>
                 </div>
                 
                 {/* Hint Label */}
                 <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] px-2 py-1 rounded backdrop-blur-sm">
                   关键词: {post.imageKeyword}
                 </div>
              </div>

              {/* Card Header */}
              <div className="p-5 border-b border-slate-50 bg-slate-50/50">
                <div className="flex justify-between items-start gap-4">
                  <h3 className="text-xl font-black text-slate-800 leading-tight">
                    {post.title}
                  </h3>
                  <span className="shrink-0 px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full whitespace-nowrap">
                    {post.angle}
                  </span>
                </div>
              </div>

              {/* Card Content */}
              <div className="p-5 flex-grow">
                <div className="prose prose-sm prose-slate max-w-none whitespace-pre-wrap text-slate-600 leading-relaxed font-medium">
                  {post.content}
                </div>
              </div>

              {/* Toolbar */}
              <div className="p-3 border-t border-slate-50 bg-slate-50/30 flex justify-between items-center">
                 <button
                  onClick={() => openEditor(idx)}
                  className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg transition-colors
                    ${editingIndex === idx 
                      ? 'bg-indigo-100 text-indigo-700' 
                      : 'text-slate-500 hover:bg-slate-100 hover:text-indigo-600'
                    }`}
                >
                  <LucideWand2 className="w-4 h-4" />
                  {editingIndex === idx ? "取消改写" : "AI 改写风格"}
                </button>

                <button
                  onClick={() => copyToClipboard(`${post.title}\n\n${post.content}`)}
                  className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors px-3 py-2"
                >
                  <LucideCopy className="w-4 h-4" />
                  复制
                </button>
              </div>

              {/* Rewrite Panel (Expandable) */}
              {editingIndex === idx && (
                <div className="p-4 bg-indigo-50/50 border-t border-indigo-100 animate-fade-in">
                  
                  {/* Style Selection */}
                  <div className="mb-4">
                    <label className="text-xs font-bold text-indigo-900 mb-2 block">1. 选择或输入风格</label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {REWRITE_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          onClick={() => setCustomStyle(preset)}
                          className="text-xs bg-white border border-indigo-200 text-indigo-600 px-2 py-1 rounded-md hover:bg-indigo-600 hover:text-white transition-colors"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={customStyle}
                        onChange={(e) => setCustomStyle(e.target.value)}
                        placeholder="输入自定义风格，例如：严谨新闻、脱口秀段子..."
                        className="w-full text-sm p-3 pr-10 rounded-lg border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        autoFocus
                      />
                      {customStyle && (
                         <button 
                           onClick={() => setCustomStyle("")}
                           className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600"
                         >
                           <LucideX className="w-4 h-4" />
                         </button>
                      )}
                    </div>
                  </div>

                  {/* Length Selection */}
                  <div className="mb-4">
                    <label className="text-xs font-bold text-indigo-900 mb-2 block">2. 内容篇幅调整</label>
                    <div className="grid grid-cols-3 gap-2">
                       <button
                         onClick={() => setLengthPreference('default')}
                         className={`py-2 rounded-lg text-xs font-bold flex flex-col items-center justify-center gap-1 border transition-all
                           ${lengthPreference === 'default' 
                             ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                             : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'}`}
                       >
                         <LucideAlignJustify className="w-4 h-4" />
                         保持原长
                       </button>
                       <button
                         onClick={() => setLengthPreference('expand')}
                         className={`py-2 rounded-lg text-xs font-bold flex flex-col items-center justify-center gap-1 border transition-all
                           ${lengthPreference === 'expand' 
                             ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                             : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'}`}
                       >
                         <LucideMaximize2 className="w-4 h-4" />
                         扩充细节
                       </button>
                       <button
                         onClick={() => setLengthPreference('shorten')}
                         className={`py-2 rounded-lg text-xs font-bold flex flex-col items-center justify-center gap-1 border transition-all
                           ${lengthPreference === 'shorten' 
                             ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                             : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'}`}
                       >
                         <LucideMinimize2 className="w-4 h-4" />
                         精简压缩
                       </button>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={() => handleRewrite(idx)}
                    disabled={rewriting || !customStyle.trim()}
                    className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg text-sm font-bold shadow-sm hover:shadow-md hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 transition-all"
                  >
                    {rewriting ? <LucideLoader2 className="w-4 h-4 animate-spin" /> : <LucideSparkles className="w-4 h-4" />}
                    {rewriting ? "正在改写中..." : "确认改写"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Note about Sources (Hunyuan does not provide search grounding in this mode easily) */}
      <div className="mt-16 pt-8 border-t border-slate-200 text-center text-slate-400 text-xs">
         Power by Tencent Cloud Hunyuan
      </div>

    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
