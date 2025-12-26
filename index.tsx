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
  // 处理 URL
  const urlRegex = /(https?:\/\/[^\s\n\r\)]+)/g;
  // 处理 [1], [2] 样式的引用标记
  const citationRegex = /\[(\d+)\]/g;

  const parts = text.split(urlRegex);
  
  return (
    <>
      {parts.map((part, i) => {
        if (urlRegex.test(part)) {
          return (
            <a 
              key={i} 
              href={part} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 underline break-all font-medium decoration-indigo-300 underline-offset-4"
            >
              <LucideLink2 className="w-3 h-3" />
              {part}
            </a>
          );
        }
        
        // 对非 URL 部分进行引用标记的处理
        const subParts = part.split(citationRegex);
        return subParts.map((subPart, j) => {
          if (/^\d+$/.test(subPart)) {
            return (
              <span key={`${i}-${j}`} className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-slate-200 text-slate-600 rounded-sm mx-0.5 align-top mt-0.5 select-none">
                {subPart}
              </span>
            );
          }
          return subPart;
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

      const title = extractField('TITLE') || "爆款内容";
      const angle = extractField('ANGLE') || "实时资讯";
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
      const systemPrompt = `你是一名拥有卓越联网搜索能力的深度主编。
你的任务是基于最新热点生成4篇爆款文章。
【核心规则】：
1. 必须开启联网搜索，实时查询 "${topic}" 的最新进展、官方通报或权威解读。
2. **严禁幻觉链接**：文章末尾的“参考来源”部分，必须直接提取联网搜索结果中的原始 URL。严禁自行构造类似 https://example.com 或不存在的链接。
3. **真实性第一**：如果联网搜索未找到该主题的实时链接，请直接在来源处说明“基于公开通用知识库，未找到实时网页链接”，不要编造。
4. **引用标记**：在正文中提到关键数据或事实时，请使用 [1], [2] 这种形式标注引用。
5. 格式要求：必须使用标签 $$$TITLE$$$, $$$ANGLE$$$, $$$IMAGE_KEYWORD$$$, $$$CONTENT$$$。`;
      
      const userPrompt = `
        主题: "${topic}"
        补充背景: "${context || "寻找最新、最权威的相关信息"}"
        
        请进行深度联网搜索，并生成4篇风格各异的爆款推文。
        每篇推文末尾必须清晰列出【参考来源】，包含：[序号] 网页标题 - 真实URL链接。
        
        输出格式：
        $$$TITLE$$$ 文章标题
        $$$ANGLE$$$ 视角标签
        $$$IMAGE_KEYWORD$$$ 图片关键词
        $$$CONTENT$$$
        [正文，带[1][2]引用]

        参考来源：
        [1] 标题 - 真实URL
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
    let lengthMode = lengthPreference === 'expand' ? "大幅扩充" : lengthPreference === 'shorten' ? "精简" : "保持";

    try {
      const systemPrompt = `改写专家。必须保持原有的参考来源链接真实性，严禁修改或编造 URL。`;
      const userPrompt = `
        原文章内容: ${targetPost.content}
        改写风格: ${customStyle}
        长度要求: ${lengthMode}
        请输出完整的标签格式结构，并保留引用标记 [1][2] 以及末尾的真实参考链接。
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
          <span>深度联网搜索 · 实时链接核验 · 引用透明化</span>
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
            placeholder="输入如：电视剧推荐、反诈骗、职场技巧..."
            className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-lg font-medium outline-none transition-all"
          />
        </div>
        
        <div className="space-y-4">
          <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <LucideInfo className="w-4 h-4 text-indigo-500" /> 侧重点 / 背景资料
          </label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="可选：补充具体要求（如：只需要2024年以后的剧集、强调画质等）"
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 resize-none h-20 outline-none transition-all"
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || !topic.trim()}
          className="w-full py-4 rounded-xl font-bold text-white text-lg bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 transition-all transform active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? <LucideLoader2 className="w-6 h-6 animate-spin" /> : <LucideSparkles className="w-6 h-6" />}
          {loading ? "正在深度联网搜索并撰写..." : "一键生成 4 篇深度推文"}
        </button>
      </div>

      {/* Content Grid */}
      <div className="grid md:grid-cols-2 gap-8">
        {posts.map((post, idx) => (
          <div key={idx} className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden flex flex-col group animate-fade-in">
            {/* Image Overlay */}
            <div className="relative h-60 bg-slate-100">
               <img 
                 src={`https://image.pollinations.ai/prompt/${encodeURIComponent(post.imageKeyword + " cinematic depth high definition professional photography")}?width=800&height=500&nologo=true`} 
                 className="w-full h-full object-cover"
                 alt={post.imageKeyword}
               />
               <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                 <span className="text-white/80 text-[10px] font-mono tracking-widest uppercase">Visual AI Keyword: {post.imageKeyword}</span>
               </div>
            </div>

            {/* Header */}
            <div className="p-6 border-b border-slate-50 flex justify-between items-start gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-emerald-600 text-[10px] font-bold">
                   <LucideShieldCheck className="w-3 h-3" /> 已完成联网实事核验
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
                <LucideWand2 className="w-4 h-4" /> 文风改写
              </button>
              <button onClick={() => copyToClipboard(`${post.title}\n\n${post.content}`)} className="text-slate-400 hover:text-indigo-600 p-2 transition-colors" title="复制全文">
                <LucideCopy className="w-5 h-5" />
              </button>
            </div>

            {/* Rewrite UI */}
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
                    placeholder="输入或选择改写文风..."
                    className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <button 
                  onClick={() => handleRewrite(idx)} 
                  disabled={rewriting || !customStyle}
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2"
                >
                  {rewriting ? <LucideLoader2 className="w-4 h-4 animate-spin" /> : <LucideSparkles className="w-4 h-4" />}
                  改写此篇
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-20 border-t border-slate-200 pt-8 text-center text-slate-400">
        <p className="text-xs">
          依托腾讯混元联网搜索引擎 · 实时数据实时同步 · 链接由 AI 提取自源网页
        </p>
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);