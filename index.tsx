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
      const systemPrompt = `你是一名资深的深度内容主编。
核心要求：
1. 权威性：必须优先参考百度官方资料、国家政务平台或官方公告。信息必须准确无误。
2. 结构化：每篇文章末尾必须注明“参考来源”。
3. 禁止格式：严禁使用 LaTeX 数学公式符号（如 $$, \\begin{align} 等）。直接输出纯文本。
4. 视觉：为每篇文章提供一个精准、最小化的英文搜索关键词，用于 Freepik 图片搜索。`;
      
      const userPrompt = `
        **任务定义:**
        1. 主题: "${topic}".
        2. 背景/侧重: "${context || "提供最准确、实用的官方指南。"}"。
        3. **目标**: 生成 **4 (肆)** 篇独立推文文章。
        
        **权威性与资料要求:**
        - 必须使用百度官方、政务平台等公信力数据。
        - 确保步骤和规定真实。
        - 结尾必须包含：参考来源：[官方资料名称]。

        **图片关键词策略 (IMAGE_KEYWORD):**
        - 使用最小化、最直接的英文单词（1-2个词）。

        **输出格式要求 (必须包含标签):**
        - 分隔符: "---POST_DIVIDER---"。
        - 标签: $$$TITLE$$$, $$$ANGLE$$$, $$$IMAGE_KEYWORD$$$, $$$CONTENT$$$。
        - **严禁**在内容中使用 $$ 或 align 等数学环境。

        **输出模版示例:**
        $$$TITLE$$$ 标题内容
        $$$ANGLE$$$ 风格标签
        $$$IMAGE_KEYWORD$$$ keyword
        $$$CONTENT$$$
        文章内容...
        参考来源：百度官方
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

    let lengthInstruction = "篇幅保持原样。";
    if (lengthPreference === 'expand') lengthInstruction = "大幅扩充细节和案例（800-1000字）。";
    else if (lengthPreference === 'shorten') lengthInstruction = "极度精简（200字以内）。";

    try {
      const systemPrompt = `你是一名文案改写专家。
1. 严禁使用任何 LaTeX 或数学公式符号（禁止 $$, \\begin{align}, \\end{align} 等）。
2. 必须以文本形式完整输出 $$$TITLE$$$ 标签。
3. 确保输出内容的开头就是 $$$TITLE$$$ 标签，不要有任何前导说明。`;
      
      const userPrompt = `
        **任务**: 改写文章。
        **原标题**: ${targetPost.title}
        **原内容**: ${targetPost.content}
        **目标风格**: "${customStyle}"
        **篇幅要求**: "${lengthInstruction}"
        
        **输出格式要求**:
        $$$TITLE$$$ [新的吸引人的标题]
        $$$ANGLE$$$ [风格标签]
        $$$IMAGE_KEYWORD$$$ [1-2个最简英文关键词]
        $$$CONTENT$$$
        [改写后的正文内容，禁止使用数学公式符号，保留文末的参考来源]
      `;

      const text = await callServerApi(systemPrompt, userPrompt);
      const parsed = parseResponse(text);
      if (parsed.length > 0) {
         const newPosts = [...posts];
         newPosts[index] = parsed[0];
         setPosts(newPosts);
         setEditingIndex(null); 
         setCustomStyle("");
         setLengthPreference('default');
      } else {
        throw new Error("解析失败。请确保 AI 输出了正确的标签。");
      }
    } catch (err: any) {
      alert("改写失败: " + err.message);
    } finally {
      setRewriting(false);
    }
  };

  // Helper: Improved Parser to handle bold tags and LaTeX noise
  const parseResponse = (text: string): GeneratedPost[] => {
    // 移除所有可能干扰解析的 Markdown 代码块标识和数学公式标记
    const cleanText = text
      .replace(/```[a-z]*\n?/gi, '')
      .replace(/```/g, '')
      .replace(/\$\$/g, '')
      .replace(/\\begin\{[a-z]*\*?\}/gi, '')
      .replace(/\\end\{[a-z]*\*?\}/gi, ''); 
    
    const rawChunks = cleanText
      .split(/(?:---POST_DIVIDER---|(?:\r?\n|^)\s*[-*]{3,}\s*(?:\r?\n|$))/i)
      .filter(p => p.trim().length > 20); 
    
    return rawChunks.map((raw) => {
      // 提取函数：处理可选的加粗、括号和冒号
      const extract = (tag: string, fallbacks: string[]) => {
        // 匹配模式：[可选加粗] $$$TAG$$$ [可选加粗] [可选冒号/空格] [内容]
        const pattern = new RegExp(`(?:\\*\\*)?\\$\\$\\$${tag}\\$\\$\\$(?:\\*\\*)?[\\*\\s:：]*(?:\\[)?(.*?)(?:\\])?(?:\\r?\\n|$)`, 'i');
        const match = raw.match(pattern);
        if (match && match[1].trim()) return match[1].trim();

        // 备用匹配（防止 AI 漏掉 $$$）
        for (const f of fallbacks) {
           const fbPattern = new RegExp(`(?:^|\\n)[\\*\\s]*${f}[\\*\\s:：]*(?:\\[)?(.*?)(?:\\])?(?:\\r?\\n|$)`, 'i');
           const fbMatch = raw.match(fbPattern);
           if (fbMatch && fbMatch[1].trim()) return fbMatch[1].trim();
        }
        return null;
      };

      const title = extract('TITLE', ['Title', '标题', '新标题', '新标题内容']) || "爆款内容推文";
      const angle = extract('ANGLE', ['Angle', '角度', '风格']) || "专家建议";
      const imageKeyword = extract('IMAGE_KEYWORD', ['Image', 'Keyword', '关键词']) || "guide";
      
      let content = "";
      // 找到 CONTENT 标签后的所有内容
      const contentPattern = /(?:\\*\\*)?\\$\\$\\$CONTENT\\$\\$\\$(?:\\*\\*)?[\\*\\s:：]*/i;
      const markerMatch = raw.match(contentPattern);
      
      if (markerMatch) {
         content = raw.substring(markerMatch.index! + markerMatch[0].length);
      } else {
        // 如果没找到标签，尝试剔除已知的标签行
        content = raw
          .split('\n')
          .filter(l => !l.includes('$$$') && !l.toLowerCase().includes('title:') && !l.includes('标题:'))
          .join('\n');
      }

      // 二次清理内容中的公式噪音
      const finalizedContent = content
        .replace(/\$\$/g, '')
        .replace(/\\begin\{[a-z]*\*?\}/gi, '')
        .replace(/\\end\{[a-z]*\*?\}/gi, '')
        .replace(/\\[a-z]+\{.*?\}/gi, '') // 移除其他 LaTeX 指令
        .trim();

      return {
        title,
        angle,
        imageKeyword,
        content: finalizedContent
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
          <span>权威来源 · 实时核验 · 精准改写</span>
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
              placeholder="例如：手机内存清理、反诈骗指南..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-all text-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
              <LucideInfo className="w-4 h-4 text-indigo-500" />
              特别注明的资料源 (可选)
            </label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="例如：强调保护隐私的法律依据..."
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
            {loading ? "正在调取官方资料撰写中..." : "生成 4 篇爆款推文"}
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
                   src={`https://image.pollinations.ai/prompt/${encodeURIComponent(post.imageKeyword + " high quality modern photography")}?width=800&height=500&nologo=true`} 
                   alt={post.imageKeyword}
                   className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                 />
                 <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <a 
                      href={`https://www.freepik.com/search?format=search&query=${encodeURIComponent(post.imageKeyword)}&license=free`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="bg-white text-slate-800 px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 shadow-xl hover:bg-indigo-600 hover:text-white transition-all scale-90 group-hover:scale-100"
                    >
                      <LucideImage className="w-4 h-4" />
                      Freepik 精准搜图
                      <LucideExternalLink className="w-3 h-3" />
                    </a>
                 </div>
                 <div className="absolute bottom-2 left-2 flex gap-2">
                    <span className="text-white text-[10px] bg-black/40 backdrop-blur-md px-2 py-1 rounded">Search: {post.imageKeyword}</span>
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
                  className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg transition-all shadow-sm
                    ${editingIndex === idx ? 'bg-indigo-600 text-white' : 'text-indigo-600 hover:bg-white bg-slate-100'}`}
                >
                  <LucideWand2 className="w-4 h-4" />
                  {editingIndex === idx ? "取消改写" : "AI 改写风格/篇幅"}
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
                <div className="p-5 bg-indigo-50/50 border-t border-indigo-100 animate-fade-in space-y-4">
                  <div>
                    <p className="text-[10px] font-bold text-indigo-900 mb-2 uppercase opacity-60">1. 改写风格</p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {REWRITE_PRESETS.map(p => (
                        <button 
                          key={p} 
                          onClick={() => setCustomStyle(p)}
                          className={`text-[10px] px-2 py-1 rounded border transition-all ${customStyle === p ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-600 border-indigo-200 hover:border-indigo-400'}`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                    <input 
                      className="w-full text-xs p-2 rounded border border-indigo-100 focus:ring-1 focus:ring-indigo-500 outline-none" 
                      placeholder="手动描述风格..." 
                      value={customStyle}
                      onChange={(e) => setCustomStyle(e.target.value)}
                    />
                  </div>

                  <div>
                    <p className="text-[10px] font-bold text-indigo-900 mb-2 uppercase opacity-60">2. 篇幅长短</p>
                    <div className="grid grid-cols-3 gap-2">
                       <button
                         onClick={() => setLengthPreference('default')}
                         className={`py-2 rounded-lg text-xs font-bold flex flex-col items-center justify-center gap-1 border transition-all
                           ${lengthPreference === 'default' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'}`}
                       >
                         <LucideAlignJustify className="w-3 h-3" />
                         保持原长
                       </button>
                       <button
                         onClick={() => setLengthPreference('expand')}
                         className={`py-2 rounded-lg text-xs font-bold flex flex-col items-center justify-center gap-1 border transition-all
                           ${lengthPreference === 'expand' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'}`}
                       >
                         <LucideMaximize2 className="w-3 h-3" />
                         大幅增长
                       </button>
                       <button
                         onClick={() => setLengthPreference('shorten')}
                         className={`py-2 rounded-lg text-xs font-bold flex flex-col items-center justify-center gap-1 border transition-all
                           ${lengthPreference === 'shorten' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'}`}
                       >
                         <LucideMinimize2 className="w-3 h-3" />
                         极简缩短
                       </button>
                    </div>
                  </div>

                  <button 
                    onClick={() => handleRewrite(idx)}
                    disabled={rewriting || !customStyle}
                    className="w-full bg-indigo-600 text-white text-xs py-3 rounded-xl font-bold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 transform active:scale-95 transition-all"
                  >
                    {rewriting ? <LucideLoader2 className="w-4 h-4 animate-spin" /> : <LucideSparkles className="w-4 h-4" />}
                    {rewriting ? "正在努力重新撰写..." : "确认改写"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer Info */}
      <div className="mt-20 border-t border-slate-200 pt-8 text-center text-slate-400">
        <p className="text-xs">
          数据来源于百度公开资料 · 配图索引由 Freepik 提供 · TrendWeaver 内容实验室
        </p>
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
