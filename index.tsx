
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { 
  LucideSparkles, LucideCopy, LucideSearch, LucideBookOpen, 
  LucideLoader2, LucideWand2, LucideX, LucideImage, 
  LucideExternalLink, LucideMaximize2, LucideMinimize2, 
  LucideAlignJustify, LucideCloud, LucideShieldCheck, LucideInfo,
  LucideType, LucideLink2, LucideDownload
} from "lucide-react";

// --- Types ---
interface GeneratedPost {
  title: string;
  angle: string;
  imageKeyword: string;
  content: string;
}

const REWRITE_PRESETS = [
  "小红书风 (Emoji+种草)", 
  "幽默搞笑", 
  "情感细腻 (走心)", 
  "极简高冷", 
  "震惊体标题党",
  "温柔邻家"
];

// --- Helper: Linkify and Style Citations ---
const LinkifiedText = ({ text }: { text: string }) => {
  const urlRegex = /(https?:\/\/[^\s\n\r]+)/g;
  const citationRegex = /\[(\d+)\]/g;
  const parts = text.split(urlRegex);

  return (
    <>
      {parts.map((part, i) => {
        if (urlRegex.test(part)) {
          const cleanUrl = part.replace(/[，。！；]$/, '');
          return (
            <a 
              key={i} 
              href={cleanUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 underline break-all font-medium decoration-indigo-300 underline-offset-4"
            >
              <LucideLink2 className="w-3 h-3" />
              {cleanUrl}
            </a>
          );
        }
        
        const subParts = part.split(citationRegex);
        return subParts.map((sub, j) => {
          if (/^\d+$/.test(sub)) {
            return (
              <span 
                key={`${i}-${j}`} 
                className="inline-flex items-center justify-center min-w-[16px] h-[16px] text-[10px] font-bold bg-slate-200 text-slate-500 rounded-sm mx-0.5 align-top mt-[2px] select-none px-1"
              >
                {sub}
              </span>
            );
          }
          return sub;
        });
      })}
    </>
  );
};

// --- API Helper ---
async function callServerApi(systemPrompt: string, userPrompt: string) {
  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemPrompt, userPrompt }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "请求失败");
    return data.text || "";
  } catch (error: any) {
    console.error("API Call Error:", error);
    throw error;
  }
}

const App = () => {
  const [topic, setTopic] = useState("");
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [posts, setPosts] = useState<GeneratedPost[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [customStyle, setCustomStyle] = useState("");
  const [lengthPreference, setLengthPreference] = useState<'default' | 'expand' | 'shorten'>('default');
  const [rewriting, setRewriting] = useState(false);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert("内容已成功复制到剪贴板！");
    } catch (err) {
      console.error("复制失败:", err);
    }
  };

  const parseResponse = (text: string): GeneratedPost[] => {
    let clean = text.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '');
    
    // 逻辑 A: 尝试标准分割
    let chunks = clean.split(/---POST_DIVIDER---/i).map(c => c.trim()).filter(c => c.length > 50);
    
    // 逻辑 B: 若分割失败，按 TITLE 强行切分 4 份
    if (chunks.length <= 1) {
      const parts = clean.split(/\$\$\$TITLE\$\$\$/i).filter(p => p.trim().length > 30);
      chunks = parts.map(p => "$$$TITLE$$$" + p);
    }
    
    return chunks.slice(0, 4).map(chunk => {
      const extractField = (tagName: string) => {
        const startTag = `$$$${tagName}$$$`;
        const startIndex = chunk.indexOf(startTag);
        if (startIndex === -1) return "";
        const contentStart = startIndex + startTag.length;
        const nextTagMatch = chunk.slice(contentStart).match(/\$\$\$\w+\$\$\$/);
        const endIndex = nextTagMatch ? contentStart + nextTagMatch.index! : chunk.length;
        
        return chunk.substring(contentStart, endIndex)
          .replace(/^[\s:：=]+/, '')
          .replace(/[*#]/g, '')
          .trim();
      };

      return {
        title: extractField('TITLE') || "精选深度内容",
        angle: extractField('ANGLE') || "趋势透视",
        imageKeyword: extractField('IMAGE_KEYWORD') || "professional",
        content: extractField('CONTENT') || chunk.replace(/[*#]/g, '')
      };
    });
  };

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setPosts([]);
    try {
      const systemPrompt = `你是一名拥有极强深度思考与联网分析能力的资深主编。
你的任务是参考腾讯 Nutty (SSR) 平台内容的编辑逻辑：结构化、逻辑严谨、包含真实参考源。

【生成指标】：
你必须一次性生成且仅生成 4 篇完全独立的深度推文。严禁只写 1 篇，严禁合并。

【Nutty 深度内容参考模版】：
每一篇文章必须包含以下结构：
1. [标题]：直击痛点，如《如何彻底防范...》、《2025年最新趋势...》
2. [背景摘要]：100字以内的引言。
3. [核心要点]：使用 1. 2. 3. 序号清晰陈述事实或步骤。
4. [深度分析/对策]：提供专业建议或避雷指南。
5. [参考源]：必须包含 [1] 引用标记，并附上真实 URL。

【输出控制】：
严格重复以下结构 4 次，每篇之间必须用 ---POST_DIVIDER--- 隔开：

$$$TITLE$$$ 文章标题
$$$ANGLE$$$ 切入视角（如：防骗视角、技术视角等）
$$$IMAGE_KEYWORD$$$ 1-2个极其精准的英文名词
$$$CONTENT$$$ 文章正文内容（禁止使用 * 或 # 符号，保持纯净排版）
【参考来源】
1. 真实链接地址
---POST_DIVIDER---`;
      
      const userPrompt = `
        主题: "${topic}"
        要求: "${context}"
        请立即通过深度思考并分析，按上述 Nutty 深度内容标准，生成 4 篇风格和切入点迥异的推文。
      `;

      const text = await callServerApi(systemPrompt, userPrompt);
      const parsed = parseResponse(text);
      setPosts(parsed);
      
      if (parsed.length === 0) throw new Error("生成结果异常，请重试。");
    } catch (err: any) {
      alert("生成失败: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRewrite = async (index: number) => {
    if (!customStyle.trim()) return;
    setRewriting(true);
    const targetPost = posts[index];
    let lengthMode = lengthPreference === 'expand' ? "增加更多细节和深度分析" : lengthPreference === 'shorten' ? "极简重构" : "维持原有篇幅";

    try {
      const systemPrompt = `改写专家。严禁使用 * 和 #。保持原有的真实链接引用。`;
      const userPrompt = `
        原文章内容: ${targetPost.content}
        改写风格: ${customStyle}
        改写要求: ${lengthMode}
        请按 $$$TITLE$$$, $$$ANGLE$$$, $$$IMAGE_KEYWORD$$$, $$$CONTENT$$$ 格式返回。
      `;

      const text = await callServerApi(systemPrompt, userPrompt);
      const parsed = parseResponse(text);
      if (parsed.length > 0) {
         const newPosts = [...posts];
         newPosts[index] = parsed[0];
         setPosts(newPosts);
         setEditingIndex(null);
      }
    } catch (err: any) {
      alert("改写失败: " + err.message);
    } finally {
      setRewriting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="text-center mb-12 animate-fade-in">
        <h1 className="text-5xl font-black tracking-tight mb-4">
          <span className="gradient-text">TrendWeaver</span> 爆款推文
        </h1>
        <p className="text-slate-500 text-lg flex items-center justify-center gap-2 font-medium">
          <LucideShieldCheck className="w-5 h-5 text-emerald-500" />
          <span>DeepSeek-Reasoner 深度思考 · 纯净排版无乱码</span>
        </p>
      </div>

      {/* Input Section */}
      <div className="bg-white rounded-3xl shadow-xl p-8 mb-12 border border-slate-100 max-w-3xl mx-auto space-y-6">
        <div className="space-y-4">
          <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <LucideSearch className="w-4 h-4 text-indigo-500" /> 核心主题
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="如：如何防范快递单诈骗、手机内存深度清理、科技趋势..."
            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 text-lg font-medium outline-none transition-all placeholder:text-slate-300"
          />
        </div>
        
        <div className="space-y-4">
          <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <LucideInfo className="w-4 h-4 text-indigo-500" /> 侧重点 / 背景资料
          </label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="可选：输入特定的背景要求..."
            className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 resize-none h-24 outline-none transition-all placeholder:text-slate-300"
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || !topic.trim()}
          className="w-full py-4 rounded-2xl font-bold text-white text-lg bg-gradient-to-r from-indigo-600 to-indigo-500 shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 transition-all transform active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? <LucideLoader2 className="w-6 h-6 animate-spin" /> : <LucideSparkles className="w-6 h-6" />}
          {loading ? "DeepSeek 正在深度思考并撰写 4 篇文章..." : "一键生成 4 篇深度推文"}
        </button>
      </div>

      {/* Results Grid */}
      <div className="grid md:grid-cols-2 gap-10">
        {posts.map((post, idx) => (
          <div key={idx} className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col group animate-fade-in transition-all hover:shadow-xl hover:shadow-indigo-50/50">
            {/* Image & Stock Links */}
            <div className="relative h-64 bg-slate-100 overflow-hidden">
               <img 
                 src={`https://image.pollinations.ai/prompt/${encodeURIComponent(post.imageKeyword + " cinematic depth professional photography high-resolution")}?width=800&height=500&nologo=true`} 
                 className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                 alt={post.imageKeyword}
               />
               <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-6">
                 <div className="flex flex-col gap-2">
                    <div className="text-white/70 text-[10px] font-mono uppercase tracking-[0.2em] mb-1 flex items-center gap-2">
                       <LucideImage className="w-3 h-3" /> 素材关键词: {post.imageKeyword}
                    </div>
                    <div className="flex gap-2">
                      <a 
                        href={`https://www.freepik.com/search?format=search&query=${encodeURIComponent(post.imageKeyword)}`} 
                        target="_blank" 
                        className="bg-white/10 hover:bg-white/30 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1.5 rounded-lg border border-white/20 transition-all flex items-center gap-1"
                      >
                        Freepik <LucideExternalLink className="w-3 h-3" />
                      </a>
                      <a 
                        href={`https://pixabay.com/images/search/${encodeURIComponent(post.imageKeyword)}/`} 
                        target="_blank" 
                        className="bg-white/10 hover:bg-white/30 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1.5 rounded-lg border border-white/20 transition-all flex items-center gap-1"
                      >
                        Pixabay <LucideExternalLink className="w-3 h-3" />
                      </a>
                      <a 
                        href={`https://www.pexels.com/search/${encodeURIComponent(post.imageKeyword)}/`} 
                        target="_blank" 
                        className="bg-white/10 hover:bg-white/30 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1.5 rounded-lg border border-white/20 transition-all flex items-center gap-1"
                      >
                        Pexels <LucideExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                 </div>
               </div>
               <div className="absolute top-6 left-6">
                  <span className="bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-black text-indigo-600 flex items-center gap-2 shadow-sm">
                    <LucideCloud className="w-3 h-3" /> DeepSeek Reasoner
                  </span>
               </div>
            </div>

            {/* Header Area */}
            <div className="p-8 border-b border-slate-50">
              <div className="flex justify-between items-start gap-4 mb-3">
                <span className="bg-indigo-50 text-indigo-600 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                  {post.angle}
                </span>
                <button onClick={() => copyToClipboard(`${post.title}\n\n${post.content}`)} className="text-slate-300 hover:text-indigo-600 transition-colors" title="复制全文">
                  <LucideCopy className="w-5 h-5" />
                </button>
              </div>
              <h3 className="text-2xl font-black text-slate-800 leading-tight">
                {post.title}
              </h3>
            </div>

            {/* Content Area */}
            <div className="p-8 flex-grow">
              <div className="prose prose-slate max-w-none whitespace-pre-wrap text-slate-600 text-base leading-relaxed font-medium">
                <LinkifiedText text={post.content} />
              </div>
            </div>

            {/* Action Footer */}
            <div className="px-8 py-6 bg-slate-50/50 flex flex-col gap-4">
              <button 
                onClick={() => setEditingIndex(editingIndex === idx ? null : idx)} 
                className={`flex items-center gap-2 w-full justify-center py-3.5 rounded-xl font-bold text-sm transition-all ${editingIndex === idx ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-indigo-600 border border-indigo-100 shadow-sm hover:shadow-md'}`}
              >
                <LucideWand2 className="w-4 h-4" /> 文风改写与篇幅调整
              </button>

              {/* Editing Panel */}
              {editingIndex === idx && (
                <div className="space-y-4 animate-fade-in pt-4 border-t border-slate-100">
                  <div className="space-y-3">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">篇幅选择</div>
                    <div className="flex gap-2">
                      {[
                        { id: 'default', label: '保持篇幅' },
                        { id: 'expand', label: '深度扩写' },
                        { id: 'shorten', label: '精简重构' }
                      ].map(l => (
                        <button 
                          key={l.id} 
                          onClick={() => setLengthPreference(l.id as any)}
                          className={`flex-1 py-2 text-[10px] font-bold rounded-lg border transition-all ${lengthPreference === l.id ? 'bg-indigo-100 border-indigo-200 text-indigo-700 shadow-inner' : 'bg-white border-slate-100 text-slate-500 hover:border-indigo-100'}`}
                        >
                          {l.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">文风选择</div>
                    <div className="flex flex-wrap gap-2">
                      {REWRITE_PRESETS.map(p => (
                        <button 
                          key={p} 
                          onClick={() => setCustomStyle(p)} 
                          className={`text-[10px] px-3 py-1.5 rounded-lg border font-bold transition-all ${customStyle === p ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-indigo-500 border-indigo-100 hover:border-indigo-200'}`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <input
                    type="text"
                    value={customStyle}
                    onChange={(e) => setCustomStyle(e.target.value)}
                    placeholder="或输入自定义改写要求..."
                    className="w-full px-4 py-3 bg-white border border-indigo-100 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-400 font-medium"
                  />

                  <button 
                    onClick={() => handleRewrite(idx)} 
                    disabled={rewriting || !customStyle}
                    className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 transform active:scale-95 transition-all"
                  >
                    {rewriting ? <LucideLoader2 className="w-4 h-4 animate-spin" /> : <LucideSparkles className="w-4 h-4" />}
                    确认改写此篇文章
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-24 border-t border-slate-200 pt-10 text-center">
        <p className="text-[10px] text-slate-400 tracking-[0.3em] uppercase mb-1 font-bold">TrendWeaver Editorial Engine</p>
        <p className="text-xs text-slate-400 font-medium">
          DeepSeek-Reasoner 深度思考 · 基于腾讯 Nutty 风格标准 · 一键素材检索
        </p>
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
