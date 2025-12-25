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

const REWRITE_PRESETS = [
  "小红书风 (Emoji+种草)", 
  "幽默搞笑", 
  "情感细腻 (走心)", 
  "极简高冷", 
  "震惊体标题党",
  "温柔邻家"
];

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

  // --- 核心修复：更强健的标签切片解析器 ---
  const parseResponse = (text: string): GeneratedPost[] => {
    // 清除 Markdown 代码块干扰
    let clean = text.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '');

    // 使用分割符切分多篇文章
    const chunks = clean.split('---POST_DIVIDER---').filter(c => c.trim().length > 20);
    
    return chunks.map(chunk => {
      const extractField = (tagName: string) => {
        const startTag = `$$$${tagName}$$$`;
        const startIndex = chunk.indexOf(startTag);
        if (startIndex === -1) return "";
        
        const contentStart = startIndex + startTag.length;
        // 寻找下一个标签作为终点，或者到字符串末尾
        const nextTagMatch = chunk.slice(contentStart).match(/\$\$\$\w+\$\$\$/);
        const endIndex = nextTagMatch ? contentStart + nextTagMatch.index! : chunk.length;
        
        // 移除前导冒号、空格等噪音
        return chunk.substring(contentStart, endIndex).replace(/^[\s:：]+/, '').trim();
      };

      const title = extractField('TITLE') || "爆款深度推文";
      const angle = extractField('ANGLE') || "实用干货";
      const imageKeyword = extractField('IMAGE_KEYWORD') || "tech";
      const content = extractField('CONTENT') || chunk; // 如果没匹配到 CONTENT 标签，回退到原始块

      return { title, angle, imageKeyword, content };
    });
  };

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setPosts([]);
    try {
      const systemPrompt = `你是一名资深的深度内容主编。
你的任务是根据用户主题，生成4篇结构清晰、具有爆款潜力的独立文章。
必须严格遵守以下格式规范：
1. 严禁使用任何 LaTeX 数学符号（禁止 $$, \\begin 等）。
2. 每篇文章必须且仅能包含以下标签：$$$TITLE$$$, $$$ANGLE$$$, $$$IMAGE_KEYWORD$$$, $$$CONTENT$$$。
3. 严禁在 $$$CONTENT$$$ 内部重复出现标签名称。
4. 使用 ---POST_DIVIDER--- 作为文章之间的唯一分隔符。`;
      
      const userPrompt = `
        主题: "${topic}"。背景倾向: "${context || "权威实用的官方指南"}"。
        请参考以下参考链接的风格特征（权威、深度、实用）：https://nutty.qq.com/nutty/ssr/26692.html 等。
        
        输出示例格式：
        $$$TITLE$$$ 爆款文章标题
        $$$ANGLE$$$ 深度科普
        $$$IMAGE_KEYWORD$$$ 1-2个英文搜索词
        $$$CONTENT$$$
        [文章正文内容，末尾必须包含参考来源]
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
    let lengthMode = lengthPreference === 'expand' ? "大幅扩充字数至800-1000字" : lengthPreference === 'shorten' ? "极简缩短至150字" : "保持原字数";

    try {
      const systemPrompt = `文案改写专家。请根据目标风格和篇幅要求改写内容。
必须严格输出以下标签且不得在正文内重复显示标签名：$$$TITLE$$$, $$$ANGLE$$$, $$$IMAGE_KEYWORD$$$, $$$CONTENT$$$。`;
      
      const userPrompt = `
        原文章: ${targetPost.title}
        目标风格: ${customStyle}
        篇幅要求: ${lengthMode}
        原正文内容: ${targetPost.content}
        
        请严格按此格式返回：
        $$$TITLE$$$ [新标题]
        $$$ANGLE$$$ [风格标签]
        $$$IMAGE_KEYWORD$$$ [最简英文词]
        $$$CONTENT$$$
        [改写后的正文内容]
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
          <span>权威来源 · 实时核验 · 精准结构化输出</span>
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
            placeholder="输入如：手机内存清理、反诈骗、职场技巧..."
            className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-lg font-medium outline-none transition-all"
          />
        </div>
        
        <div className="space-y-4">
          <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <LucideInfo className="w-4 h-4 text-indigo-500" /> 背景或特定参考
          </label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="例如：优先参考百度官方权威指南..."
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 resize-none h-20 outline-none transition-all"
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || !topic.trim()}
          className="w-full py-4 rounded-xl font-bold text-white text-lg bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 transition-all transform active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? <LucideLoader2 className="w-6 h-6 animate-spin" /> : <LucideSparkles className="w-6 h-6" />}
          {loading ? "深度分析中..." : "一键生成 4 篇爆款推文"}
        </button>
      </div>

      {/* Content Grid */}
      <div className="grid md:grid-cols-2 gap-8">
        {posts.map((post, idx) => (
          <div key={idx} className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden flex flex-col group animate-fade-in">
            {/* Dynamic Image Overlay */}
            <div className="relative h-60 bg-slate-100">
               <img 
                 src={`https://image.pollinations.ai/prompt/${encodeURIComponent(post.imageKeyword + " professional photography style high contrast clean background")}?width=800&height=500&nologo=true`} 
                 className="w-full h-full object-cover"
                 alt={post.imageKeyword}
               />
               <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                  <a href={`https://www.freepik.com/search?query=${encodeURIComponent(post.imageKeyword)}`} target="_blank" className="bg-white px-5 py-2.5 rounded-full font-bold text-sm flex items-center gap-2 shadow-xl hover:scale-105 transition-transform">
                    <LucideImage className="w-4 h-4" /> Freepik 搜同款
                  </a>
               </div>
               <div className="absolute bottom-3 left-3 text-[10px] font-mono bg-black/40 text-white px-2 py-1 rounded backdrop-blur-sm">
                 KW: {post.imageKeyword}
               </div>
            </div>

            {/* Header with Extracted Title */}
            <div className="p-6 border-b border-slate-50 flex justify-between items-start gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-emerald-600 text-[10px] font-bold">
                   <LucideShieldCheck className="w-3 h-3" /> 官方核验资料
                </div>
                <h3 className="text-2xl font-black text-slate-800 leading-tight">
                  {post.title}
                </h3>
              </div>
              <span className="bg-indigo-50 text-indigo-600 text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider whitespace-nowrap">
                {post.angle}
              </span>
            </div>

            {/* Clean Content Area */}
            <div className="p-6 flex-grow">
              <div className="prose prose-slate max-w-none whitespace-pre-wrap text-slate-600 text-sm leading-relaxed">
                {post.content}
              </div>
            </div>

            {/* Action Bar */}
            <div className="p-4 bg-slate-50 border-t flex justify-between items-center">
              <button 
                onClick={() => setEditingIndex(editingIndex === idx ? null : idx)} 
                className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg transition-all ${editingIndex === idx ? 'bg-indigo-600 text-white shadow-md' : 'text-indigo-600 hover:bg-white border border-transparent hover:border-indigo-100'}`}
              >
                <LucideWand2 className="w-4 h-4" /> 改写文风/篇幅
              </button>
              <button onClick={() => copyToClipboard(`${post.title}\n\n${post.content}`)} className="text-slate-400 hover:text-indigo-600 p-2 transition-colors" title="复制全文">
                <LucideCopy className="w-5 h-5" />
              </button>
            </div>

            {/* Rewrite UI Panel */}
            {editingIndex === idx && (
              <div className="p-5 bg-indigo-50 border-t space-y-4 animate-fade-in">
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-indigo-900/60 uppercase">1. 文风预设</p>
                  <div className="flex flex-wrap gap-2">
                    {REWRITE_PRESETS.map(p => (
                      <button 
                        key={p} 
                        onClick={() => setCustomStyle(p)} 
                        className={`text-[10px] px-2 py-1 rounded-md border transition-all ${customStyle === p ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-indigo-600 border-indigo-200 hover:border-indigo-400'}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-indigo-900/60 uppercase">2. 篇幅微调</p>
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => setLengthPreference('default')} className={`py-2 rounded-lg text-xs font-bold border flex items-center justify-center gap-1 transition-all ${lengthPreference === 'default' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white border-slate-200 text-slate-500'}`}><LucideAlignJustify className="w-3 h-3" /> 保持</button>
                    <button onClick={() => setLengthPreference('expand')} className={`py-2 rounded-lg text-xs font-bold border flex items-center justify-center gap-1 transition-all ${lengthPreference === 'expand' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white border-slate-200 text-slate-500'}`}><LucideMaximize2 className="w-3 h-3" /> 增长</button>
                    <button onClick={() => setLengthPreference('shorten')} className={`py-2 rounded-lg text-xs font-bold border flex items-center justify-center gap-1 transition-all ${lengthPreference === 'shorten' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white border-slate-200 text-slate-500'}`}><LucideMinimize2 className="w-3 h-3" /> 缩短</button>
                  </div>
                </div>

                <button 
                  onClick={() => handleRewrite(idx)} 
                  disabled={rewriting || !customStyle}
                  className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 transform active:scale-[0.97] transition-all disabled:opacity-50"
                >
                  {rewriting ? <LucideLoader2 className="w-4 h-4 animate-spin" /> : <LucideSparkles className="w-4 h-4" />}
                  {rewriting ? "正在重塑内容..." : "确认改写并应用"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-20 border-t border-slate-200 pt-8 text-center text-slate-400">
        <p className="text-xs">
          内容采集自百度公开权威资料库 · TrendWeaver 智能编辑系统 · 严禁用于非法用途
        </p>
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
