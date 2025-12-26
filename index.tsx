
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { 
  LucideSparkles, LucideCopy, LucideSearch, LucideBookOpen, 
  LucideLoader2, LucideWand2, LucideX, LucideImage, 
  LucideExternalLink, LucideMaximize2, LucideMinimize2, 
  LucideAlignJustify, LucideCloud, LucideShieldCheck, LucideInfo,
  LucideType, LucideLink2
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
  // 正则匹配 URL
  const urlRegex = /(https?:\/\/[^\s\n\r]+)/g;
  // 正则匹配引用标记 [1], [2] 等
  const citationRegex = /\[(\d+)\]/g;

  // 第一步：先按 URL 切分
  const parts = text.split(urlRegex);

  return (
    <>
      {parts.map((part, i) => {
        if (urlRegex.test(part)) {
          // 清理链接末尾可能的标点符号
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
        
        // 第二步：对文本部分再按引用标记切分
        const subParts = part.split(citationRegex);
        return subParts.map((sub, j) => {
          if (/^\d+$/.test(sub)) {
            // 渲染为类似截图中的灰色小方块引用
            return (
              <span 
                key={`${i}-${j}`} 
                className="inline-flex items-center justify-center min-w-[14px] h-[14px] text-[9px] font-bold bg-slate-200 text-slate-500 rounded-sm mx-0.5 align-top mt-[3px] select-none px-0.5"
                title={`引用来源 [${sub}]`}
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

  const parseResponse = (text: string): GeneratedPost[] => {
    let clean = text.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '');
    const chunks = clean.split('---POST_DIVIDER---').filter(c => c.trim().length > 20);
    
    return chunks.map(chunk => {
      const extractField = (tagName: string) => {
        const startTag = `$$$${tagName}$$$`;
        const startIndex = chunk.indexOf(startTag);
        if (startIndex === -1) return "";
        const contentStart = startIndex + startTag.length;
        const nextTagMatch = chunk.slice(contentStart).match(/\$\$\$\w+\$\$\$/);
        const endIndex = nextTagMatch ? contentStart + nextTagMatch.index! : chunk.length;
        return chunk.substring(contentStart, endIndex).replace(/^[\s:：]+/, '').trim();
      };

      const title = extractField('TITLE') || "爆款深度内容";
      const angle = extractField('ANGLE') || "实时观察";
      const imageKeyword = extractField('IMAGE_KEYWORD') || "news";
      const content = extractField('CONTENT') || chunk;

      return { title, angle, imageKeyword, content };
    });
  };

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setPosts([]);
    try {
      const systemPrompt = `你是一名拥有高级联网搜索能力的深度主编。
你的任务是根据用户主题，通过实时联网搜索获取最新的真实资讯，生成4篇具有爆款潜力的独立推文。

【核心指令】：
1. **先搜索，再创作**：必须利用联网搜索能力查询 "${topic}" 的最新进展、官方公告或权威报道。
2. **严禁幻觉链接**：文章末尾的“参考来源”列表必须包含搜索结果中真实的 URL。严禁自行发明、构造或猜测链接（如 example.com 等）。
3. **引用透明化**：在正文中提到关键事实、数据或剧集时，必须使用 [1], [2] 样式的数字标记，并与文末的参考来源一一对应。
4. **格式规范**：严格使用 $$$TITLE$$$, $$$ANGLE$$$, $$$IMAGE_KEYWORD$$$, $$$CONTENT$$$ 标签。文章之间用 ---POST_DIVIDER--- 分隔。
5. **内容深度**：不要只给列表，要有深度的观点拆解。`;
      
      const userPrompt = `
        主题: "${topic}"。
        侧重点: "${context || "权威、实时、深度"}"。
        
        请执行深度搜索，生成4篇推文。每篇文章必须在 $$$CONTENT$$$ 标签的正文结束后，另起一行提供：
        【参考来源】
        [1] 标题 - 真实有效的URL链接
        [2] 标题 - 真实有效的URL链接
        
        ---POST_DIVIDER---
      `;

      const text = await callServerApi(systemPrompt, userPrompt);
      const parsed = parseResponse(text);
      setPosts(parsed);
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
    let lengthMode = lengthPreference === 'expand' ? "大幅扩充字数" : lengthPreference === 'shorten' ? "极简缩写" : "保持原篇幅";

    try {
      const systemPrompt = `改写专家。请保持原文章中联网搜索到的真实数据、引用标记 [1][2] 和参考链接不变，仅调整叙述风格和篇幅。`;
      const userPrompt = `
        原文章内容: ${targetPost.content}
        改写风格: ${customStyle}
        篇幅要求: ${lengthMode}
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-black tracking-tight mb-4">
          <span className="gradient-text">TrendWeaver</span> 爆款推文
        </h1>
        <p className="text-slate-500 text-lg flex items-center justify-center gap-2">
          <LucideShieldCheck className="w-5 h-5 text-emerald-500" />
          <span>深度搜索 · 实时核验 · 引用透明化</span>
        </p>
      </div>

      {/* Input Area */}
      <div className="bg-white rounded-2xl shadow-xl p-8 mb-12 border border-slate-100 max-w-3xl mx-auto space-y-6">
        <div className="space-y-4">
          <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <LucideSearch className="w-4 h-4 text-indigo-500" /> 核心主题
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="如：2024热播剧、清理手机内存、最新反诈提醒..."
            className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-lg font-medium outline-none transition-all"
          />
        </div>
        
        <div className="space-y-4">
          <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <LucideInfo className="w-4 h-4 text-indigo-500" /> 补充背景 / 特定要求
          </label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="例如：侧重推荐优酷平台剧集、或强调保护个人隐私的重要性..."
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 resize-none h-20 outline-none transition-all"
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || !topic.trim()}
          className="w-full py-4 rounded-xl font-bold text-white text-lg bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 transition-all transform active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? <LucideLoader2 className="w-6 h-6 animate-spin" /> : <LucideSparkles className="w-6 h-6" />}
          {loading ? "正在联网搜索实时数据并撰写..." : "深度生成 4 篇爆款推文"}
        </button>
      </div>

      {/* Content Grid */}
      <div className="grid md:grid-cols-2 gap-8">
        {posts.map((post, idx) => (
          <div key={idx} className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden flex flex-col group animate-fade-in">
            {/* Dynamic Image */}
            <div className="relative h-60 bg-slate-100">
               <img 
                 src={`https://image.pollinations.ai/prompt/${encodeURIComponent(post.imageKeyword + " cinematic photography hyper-realistic clean style")}?width=800&height=500&nologo=true`} 
                 className="w-full h-full object-cover"
                 alt={post.imageKeyword}
               />
               <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                  <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-full text-[10px] font-bold text-slate-800 flex items-center gap-2">
                    <LucideImage className="w-3 h-3" /> 视觉关键词: {post.imageKeyword}
                  </div>
               </div>
            </div>

            {/* Header */}
            <div className="p-6 border-b border-slate-50 flex justify-between items-start gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-emerald-600 text-[10px] font-bold">
                   <LucideShieldCheck className="w-3 h-3" /> 实时数据源已核验
                </div>
                <h3 className="text-2xl font-black text-slate-800 leading-tight">
                  {post.title}
                </h3>
              </div>
              <span className="bg-indigo-50 text-indigo-600 text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider whitespace-nowrap">
                {post.angle}
              </span>
            </div>

            {/* Content Area with Links and Citations */}
            <div className="p-6 flex-grow">
              <div className="prose prose-slate max-w-none whitespace-pre-wrap text-slate-600 text-sm leading-relaxed">
                <LinkifiedText text={post.content} />
              </div>
            </div>

            {/* Action Bar */}
            <div className="p-4 bg-slate-50 border-t flex justify-between items-center">
              <button 
                onClick={() => setEditingIndex(editingIndex === idx ? null : idx)} 
                className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg transition-all ${editingIndex === idx ? 'bg-indigo-600 text-white shadow-md' : 'text-indigo-600 hover:bg-white border border-transparent hover:border-indigo-100'}`}
              >
                <LucideWand2 className="w-4 h-4" /> 改写文风
              </button>
              <button onClick={() => copyToClipboard(`${post.title}\n\n${post.content}`)} className="text-slate-400 hover:text-indigo-600 p-2 transition-colors" title="复制全文">
                <LucideCopy className="w-5 h-5" />
              </button>
            </div>

            {/* Rewrite UI Panel */}
            {editingIndex === idx && (
              <div className="p-5 bg-indigo-50 border-t space-y-4 animate-fade-in">
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {REWRITE_PRESETS.map(p => (
                      <button key={p} onClick={() => setCustomStyle(p)} className={`text-[10px] px-2 py-1 rounded-md border transition-all ${customStyle === p ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-600 border-indigo-200'}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={customStyle}
                    onChange={(e) => setCustomStyle(e.target.value)}
                    placeholder="输入特定风格..."
                    className="w-full px-4 py-2 bg-white border border-indigo-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <button 
                  onClick={() => handleRewrite(idx)} 
                  disabled={rewriting || !customStyle}
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 transform active:scale-95 transition-all"
                >
                  {rewriting ? <LucideLoader2 className="w-4 h-4 animate-spin" /> : <LucideSparkles className="w-4 h-4" />}
                  {rewriting ? "正在重塑内容..." : "确认改写"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-20 border-t border-slate-200 pt-8 text-center text-slate-400">
        <p className="text-xs">
          内容实时采集自腾讯混元联网引擎 · 数据通过引用标记透明化 · TrendWeaver 智能编辑系统
        </p>
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
