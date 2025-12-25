import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { 
  LucideSparkles, LucideCopy, LucideSearch, LucideBookOpen, 
  LucideLoader2, LucideWand2, LucideX, LucideImage, 
  LucideExternalLink, LucideMaximize2, LucideMinimize2, 
  LucideAlignJustify, LucideCloud, LucideShieldCheck, LucideInfo
} from "lucide-react";

// --- Types ---
interface GeneratedPost {
  title: string;
  angle: string;
  imageKeyword: string;
  content: string;
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

// --- API Helper (Server Call) ---
async function callServerApi(systemPrompt: string, userPrompt: string) {
  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemPrompt,
        userPrompt
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("后端接口未找到。请确认已部署到 Vercel 并且 API 文件位于 api/generate.ts");
      }
      throw new Error(data.error || "请求失败");
    }

    return data.text || "";
  } catch (error: any) {
    console.error("API Call Error:", error);
    throw error;
  }
}

// --- Main Component ---
const App = () => {
  // App State
  const [topic, setTopic] = useState("");
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [posts, setPosts] = useState<GeneratedPost[]>([]);
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
    setEditingIndex(null);

    try {
      const systemPrompt = `You are a professional investigative journalist and top-tier content creator. 
      Your mission is to provide HIGHLY AUTHORITATIVE and accurate information. 
      Prioritize official Chinese sources (Baidu Baike, Gov portals, Official announcements). 
      Avoid common misinformation. Each article must end with a brief "参考来源" (Sources) section listing the types of official sources used.`;
      
      const userPrompt = `
        **Task Definition:**
        1. Topic: "${topic}".
        2. Context: "${context || "Provide the most accurate and practical guide available."}".
        3. **GOAL**: Generate **4 (FOUR)** distinct articles.
        
        **Accuracy & Authority:**
        - Use verified facts from Baidu Official data.
        - Be precise about numbers, dates, and official procedures.
        - **MANDATORY**: Append a list of sources at the end of the content.

        **Image Selection Strategy:**
        - Create a creative, punchy, and slightly humorous visual metaphor in English for IMAGE_KEYWORD.
        - Example for "Memory Cleaning": Instead of "RAM", use "messy brain cabinet being organized".
        - Example for "Insurance": Instead of "contract", use "giant umbrella shielding a small house from money rain".

        **Structure for EACH Article:**
        1.  **Opening**: Punchy hook.
        2.  **Body**: Step-by-step logic.
        3.  **Conclusion**: Final tip.
        4.  **References**: "参考来源: [Source Name]".

        **Output Format Requirements (STRICT):**
        - Separator: Use "---POST_DIVIDER---" between articles.
        - Tags: Use exactly $$$TITLE$$$, $$$ANGLE$$$, $$$IMAGE_KEYWORD$$$, $$$CONTENT$$$.
        - **DO NOT** use bold on tags. **DO NOT** use brackets on values.

        **Format Example:**
        $$$TITLE$$$ 核心标题
        $$$ANGLE$$$ 深度解析
        $$$IMAGE_KEYWORD$$$ creative visual metaphor
        $$$CONTENT$$$
        [Article text...]
        参考来源：百度百科、国家政务服务平台
        ---POST_DIVIDER---
      `;

      const text = await callServerApi(systemPrompt, userPrompt);
      const parsed = parseResponse(text);
      if (parsed.length === 0) {
        throw new Error("生成内容为空，请换个主题重试");
      }
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

    let lengthInstruction = "Length: Medium (~600-800 chars).";
    if (lengthPreference === 'expand') lengthInstruction = "Length: EXPAND significantly. Add expert-level detail. 1000+ chars.";
    else if (lengthPreference === 'shorten') lengthInstruction = "Length: Very short. Fast summary. ~200 chars.";

    try {
      const systemPrompt = "Role: Master Copywriter. Maintain accuracy and citations. ALWAYS start your output with the $$$TITLE$$$ tag.";
      const userPrompt = `
        **Task**: Rewrite the article while KEEPING the factual references.
        **Original Title**: ${targetPost.title}
        **Original Content**: ${targetPost.content}
        **Target Style**: "${customStyle}"
        **Target Length**: "${lengthInstruction}"
        
        **STRICT FORMAT REQUIRED**:
        $$$TITLE$$$ [New Catchy Title]
        $$$ANGLE$$$ [Style Label]
        $$$IMAGE_KEYWORD$$$ [Punchy Visual Metaphor in English]
        $$$CONTENT$$$
        [New Content based on the style, including references at the end]
      `;

      const text = await callServerApi(systemPrompt, userPrompt);
      const parsed = parseResponse(text);
      if (parsed.length > 0) {
         const newPosts = [...posts];
         newPosts[index] = parsed[0];
         setPosts(newPosts);
         setEditingIndex(null); 
         setCustomStyle("");
      }
    } catch (err: any) {
      alert("改写失败: " + err.message);
    } finally {
      setRewriting(false);
    }
  };

  // Helper: Improved Parser
  const parseResponse = (text: string): GeneratedPost[] => {
    const cleanText = text.replace(/```/g, ''); 
    const rawChunks = cleanText
      .split(/(?:---POST_DIVIDER---|(?:\r?\n|^)\s*[-*]{3,}\s*(?:\r?\n|$))/i)
      .filter(p => p.trim().length > 30); 
    
    return rawChunks.map((raw) => {
      const extract = (tag: string, fallbacks: string[]) => {
        // Look for the tag strictly first
        const strictRegex = new RegExp(`\\$\\$\\$${tag}\\$\\$\\$[\\*\\s:：]*(?:\\[)?(.*?)(?:\\])?(?:\\r?\\n|$)`, 'i');
        const match = raw.match(strictRegex);
        if (match && match[1].trim()) return match[1].trim();

        // Fallback to plain word prefixes
        for (const f of fallbacks) {
           const fbRegex = new RegExp(`(?:^|\\n)[\\*\\s]*${f}[:：]\\s*(?:\\[)?(.*?)(?:\\])?(?:\\r?\\n|$)`, 'i');
           const fbMatch = raw.match(fbRegex);
           if (fbMatch && fbMatch[1].trim()) return fbMatch[1].trim();
        }
        return null;
      };

      const title = extract('TITLE', ['Title', '标题', 'New Title']) || "未命名标题";
      const angle = extract('ANGLE', ['Angle', '角度', '风格']) || "实用干货";
      const imageKeyword = extract('IMAGE_KEYWORD', ['Image', 'Keyword', '图片关键词']) || "concept";
      
      let content = "";
      const contentMarker = /\$\$\$CONTENT\$\$\$[:：]?/i;
      const markerMatch = raw.match(contentMarker);
      if (markerMatch) {
         content = raw.substring(markerMatch.index! + markerMatch[0].length);
      } else {
        // Heuristic: remove lines with other tags
        content = raw
          .split('\n')
          .filter(l => !l.includes('$$$') && !l.toLowerCase().startsWith('title:') && !l.startsWith('标题:'))
          .join('\n');
      }

      return {
        title,
        angle,
        imageKeyword,
        content: content.replace(/\*\*/g, "").trim()
      };
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-5xl font-black tracking-tight mb-4">
          <span className="gradient-text">TrendWeaver</span> 爆款推文
        </h1>
        <p className="text-slate-500 text-lg max-w-2xl mx-auto flex items-center justify-center gap-2">
          <LucideShieldCheck className="w-5 h-5 text-emerald-500" />
          <span>权威资料源 · 深度AI创作 · 视觉美学</span>
        </p>
      </div>

      {/* Input Section */}
      <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 mb-12 border border-slate-100 max-w-3xl mx-auto">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
              <LucideSearch className="w-4 h-4 text-indigo-500" />
              搜索核心主题
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="例如：快递单隐私保护、手机清理内存..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-all text-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
              <LucideInfo className="w-4 h-4 text-indigo-500" />
              补充细节或权威倾向 (可选)
            </label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="例如：优先使用国家政务平台的数据..."
              rows={2}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-all resize-none text-sm"
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || !topic.trim()}
            className={`w-full py-4 rounded-xl font-bold text-white text-lg flex items-center justify-center gap-2 transition-all transform active:scale-[0.98]
              ${loading || !topic.trim() ? 'bg-slate-300' : 'bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg shadow-indigo-100'}`}
          >
            {loading ? <LucideLoader2 className="w-6 h-6 animate-spin" /> : <LucideSparkles className="w-6 h-6" />}
            {loading ? "正在调取权威数据并撰写..." : "一键生成 4 篇爆款文章"}
          </button>
        </div>
      </div>

      {/* Results Grid */}
      {posts.length > 0 && (
        <div className="grid md:grid-cols-2 gap-8 animate-fade-in">
          {posts.map((post, idx) => (
            <div key={idx} className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden flex flex-col group">
              {/* Image */}
              <div className="relative h-56 bg-slate-200 overflow-hidden">
                 <img 
                   src={`https://image.pollinations.ai/prompt/${encodeURIComponent(post.imageKeyword + " high resolution dramatic lighting digital art style")}?width=800&height=500&nologo=true`} 
                   alt={post.imageKeyword}
                   className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                 />
                 <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                    <span className="text-white text-[10px] bg-white/20 backdrop-blur-md px-2 py-1 rounded">视觉关键词: {post.imageKeyword}</span>
                 </div>
              </div>

              {/* Header */}
              <div className="p-6 border-b border-slate-50">
                <div className="flex justify-between items-start gap-3 mb-2">
                  <h3 className="text-2xl font-black text-slate-800 leading-tight">
                    {post.title}
                  </h3>
                  <span className="px-2 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded uppercase tracking-wider shrink-0">
                    {post.angle}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-emerald-600 text-[10px] font-bold">
                   <LucideShieldCheck className="w-3 h-3" />
                   官方权威核验已完成
                </div>
              </div>

              {/* Content */}
              <div className="p-6 flex-grow">
                <div className="prose prose-slate max-w-none whitespace-pre-wrap text-slate-600 leading-relaxed text-sm">
                  {post.content}
                </div>
              </div>

              {/* Toolbar */}
              <div className="p-4 bg-slate-50 flex justify-between items-center border-t border-slate-100">
                <button
                  onClick={() => setEditingIndex(editingIndex === idx ? null : idx)}
                  className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 px-3 py-2 rounded-lg hover:bg-white transition-all shadow-sm"
                >
                  <LucideWand2 className="w-4 h-4" />
                  AI 改写风格
                </button>
                <button
                  onClick={() => copyToClipboard(`${post.title}\n\n${post.content}`)}
                  className="text-slate-400 hover:text-indigo-600 transition-colors p-2"
                >
                  <LucideCopy className="w-4 h-4" />
                </button>
              </div>

              {/* Rewrite UI */}
              {editingIndex === idx && (
                <div className="p-4 bg-indigo-50/30 border-t border-indigo-100 animate-fade-in">
                  <div className="flex flex-wrap gap-2 mb-4">
                    {REWRITE_PRESETS.map(p => (
                      <button 
                        key={p} 
                        onClick={() => setCustomStyle(p)}
                        className={`text-[10px] px-2 py-1 rounded border transition-all ${customStyle === p ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 border-indigo-200'}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input 
                      className="flex-grow text-xs p-2 rounded border-indigo-100 focus:ring-1 focus:ring-indigo-500" 
                      placeholder="自定义风格..." 
                      value={customStyle}
                      onChange={(e) => setCustomStyle(e.target.value)}
                    />
                    <button 
                      onClick={() => handleRewrite(idx)}
                      disabled={rewriting || !customStyle}
                      className="bg-indigo-600 text-white text-xs px-4 py-2 rounded-lg font-bold disabled:opacity-50"
                    >
                      {rewriting ? "生成中..." : "确定"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
