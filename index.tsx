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

  // --- 解析逻辑升级：更强健的片段匹配 ---
  const parseResponse = (text: string): GeneratedPost[] => {
    // 1. 全局清理：移除所有 LaTeX 环境、数学符号、代码块标识
    let clean = text
      .replace(/\\begin\{.*?\}/gi, '')
      .replace(/\\end\{.*?\}/gi, '')
      .replace(/\\\[|\\\]|\\\(|\\\)/g, '')
      .replace(/\$/g, '')
      .replace(/```[a-z]*\n?/gi, '')
      .replace(/```/g, '');

    // 2. 分割文章
    const chunks = clean.split('---POST_DIVIDER---').filter(c => c.trim().length > 10);
    
    return chunks.map(chunk => {
      // 提取函数：匹配 $$$TAG$$$ 后到下一个 $$$ 或结尾的内容
      const getPart = (tag: string) => {
        const regex = new RegExp(`\\$\\$\\$${tag}\\$\\$\\$[\\s:：]*([^$]+)`, 'i');
        const match = chunk.match(regex);
        if (match && match[1].trim()) {
           // 再次清理可能残留的括号或引号
           return match[1].split('$$$')[0].replace(/[\[\]]/g, '').trim();
        }
        return null;
      };

      const title = getPart('TITLE') || "爆款深度推文";
      const angle = getPart('ANGLE') || "专家建议";
      const imageKeyword = getPart('IMAGE_KEYWORD') || "modern life";
      
      // 提取正文：匹配 $$$CONTENT$$$ 之后的所有剩余内容
      const contentRegex = /\$\$\$CONTENT\$\$\$[\s:：]*([\s\S]*)/i;
      const contentMatch = chunk.match(contentRegex);
      let content = contentMatch ? contentMatch[1].trim() : chunk;

      // 如果正文中还残留了标签名（说明 AI 格式乱了），进行二次剔除
      content = content
        .replace(/\$\$\$TITLE\$\$\$.*?(\n|$)/gi, '')
        .replace(/\$\$\$ANGLE\$\$\$.*?(\n|$)/gi, '')
        .replace(/\$\$\$IMAGE_KEYWORD\$\$\$.*?(\n|$)/gi, '')
        .replace(/\$\$\$CONTENT\$\$\$/gi, '')
        .trim();

      return { title, angle, imageKeyword, content };
    });
  };

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setPosts([]);
    try {
      const systemPrompt = `你是一名资深的深度内容主编。
1. 权威性：必须优先参考百度官方、国家政务平台数据。
2. 格式：严禁使用任何 LaTeX 数学符号（禁止 $$, \\begin 等）。直接输出纯文本。
3. 结构：必须使用 $$$TITLE$$$, $$$ANGLE$$$, $$$IMAGE_KEYWORD$$$, $$$CONTENT$$$ 标签标记内容。`;
      
      const userPrompt = `
        主题: "${topic}"。背景: "${context || "权威实用的官方指南"}"。
        请生成 4 篇独立文章，每篇末尾注明“参考来源”。
        图片关键词使用 1-2 个最简精准英文单词。
        格式示例：
        $$$TITLE$$$ 标题内容
        $$$ANGLE$$$ 视角
        $$$IMAGE_KEYWORD$$$ keyword
        $$$CONTENT$$$ 文章正文...
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
    let lengthMode = lengthPreference === 'expand' ? "字数扩充至800字" : lengthPreference === 'shorten' ? "字数缩减至200字" : "保持原篇幅";

    try {
      const systemPrompt = `文案改写专家。禁止输出数学符号，必须以 $$$TITLE$$$ 标签开头输出内容。`;
      const userPrompt = `
        改写这篇文章。
        风格: ${customStyle}。篇幅: ${lengthMode}。
        原内容: ${targetPost.content}
        
        必须按此格式输出：
        $$$TITLE$$$ [新标题]
        $$$ANGLE$$$ [新风格]
        $$$IMAGE_KEYWORD$$$ [最简英文词]
        $$$CONTENT$$$ [改写内容，保留参考来源]
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
          <span>官方核验资料 · 纯净格式输出 · 极简配图</span>
        </p>
      </div>

      {/* Input Area */}
      <div className="bg-white rounded-2xl shadow-xl p-8 mb-12 border border-slate-100 max-w-3xl mx-auto space-y-6">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="输入核心主题，如：手机内存清理..."
          className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-lg font-medium"
        />
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="补充资料倾向或背景（可选）"
          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 resize-none h-20"
        />
        <button
          onClick={handleGenerate}
          disabled={loading || !topic.trim()}
          className="w-full py-4 rounded-xl font-bold text-white text-lg bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
        >
          {loading ? <LucideLoader2 className="w-6 h-6 animate-spin" /> : <LucideSparkles className="w-6 h-6" />}
          {loading ? "正在生成..." : "一键生成 4 篇爆款推文"}
        </button>
      </div>

      {/* Grid */}
      <div className="grid md:grid-cols-2 gap-8">
        {posts.map((post, idx) => (
          <div key={idx} className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden flex flex-col group animate-fade-in">
            <div className="relative h-56 bg-slate-100">
               <img 
                 src={`https://image.pollinations.ai/prompt/${encodeURIComponent(post.imageKeyword + " photography style clean background high resolution")}?width=800&height=500&nologo=true`} 
                 className="w-full h-full object-cover"
               />
               <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <a href={`https://www.freepik.com/search?query=${encodeURIComponent(post.imageKeyword)}`} target="_blank" className="bg-white px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2">
                    <LucideImage className="w-4 h-4" /> Freepik 搜图
                  </a>
               </div>
               <div className="absolute bottom-2 left-2 text-[10px] bg-black/30 text-white px-2 py-1 rounded">Keyword: {post.imageKeyword}</div>
            </div>

            <div className="p-6 border-b border-slate-50 flex justify-between items-start gap-4">
              <h3 className="text-2xl font-black text-slate-800 leading-tight">{post.title}</h3>
              <span className="bg-indigo-50 text-indigo-600 text-[10px] font-bold px-2 py-1 rounded whitespace-nowrap">{post.angle}</span>
            </div>

            <div className="p-6 flex-grow prose prose-slate max-w-none whitespace-pre-wrap text-slate-600 text-sm leading-relaxed">
              {post.content}
            </div>

            <div className="p-4 bg-slate-50 border-t flex justify-between items-center">
              <button onClick={() => setEditingIndex(editingIndex === idx ? null : idx)} className="text-indigo-600 font-bold text-xs flex items-center gap-1">
                <LucideWand2 className="w-4 h-4" /> 改写文风/篇幅
              </button>
              <button onClick={() => copyToClipboard(`${post.title}\n\n${post.content}`)} className="text-slate-400 hover:text-indigo-600 p-2">
                <LucideCopy className="w-4 h-4" />
              </button>
            </div>

            {editingIndex === idx && (
              <div className="p-5 bg-indigo-50 border-t space-y-4 animate-fade-in">
                <div className="flex flex-wrap gap-2">
                  {REWRITE_PRESETS.map(p => (
                    <button key={p} onClick={() => setCustomStyle(p)} className={`text-[10px] px-2 py-1 rounded border ${customStyle === p ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 border-indigo-200'}`}>{p}</button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => setLengthPreference('default')} className={`py-2 rounded-lg text-xs font-bold border ${lengthPreference === 'default' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200'}`}>保持原长</button>
                  <button onClick={() => setLengthPreference('expand')} className={`py-2 rounded-lg text-xs font-bold border ${lengthPreference === 'expand' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200'}`}>大幅增长</button>
                  <button onClick={() => setLengthPreference('shorten')} className={`py-2 rounded-lg text-xs font-bold border ${lengthPreference === 'shorten' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200'}`}>极简缩短</button>
                </div>
                <button 
                  onClick={() => handleRewrite(idx)} 
                  disabled={rewriting || !customStyle}
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                >
                  {rewriting ? <LucideLoader2 className="w-4 h-4 animate-spin" /> : "确认改写"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
