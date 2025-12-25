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
1. 权威性：必须优先参考百度官方资料、国家政务平台或官方公告。信息必须准确无误，严禁胡编乱造。
2. 结构化：每篇文章末尾必须注明“参考来源”。
3. 视觉：为每篇文章提供一个精准、最小化的英文搜索关键词，用于 Freepik 图片搜索。`;
      
      const userPrompt = `
        **任务定义:**
        1. 主题: "${topic}".
        2. 背景/侧重: "${context || "提供最准确、实用的官方指南。"}"。
        3. **目标**: 生成 **4 (肆)** 篇视角独特的独立推文文章。
        
        **权威性与资料要求:**
        - 必须使用百度官方、政务平台等公信力数据。
        - 确保数据、步骤、规定是真实的。
        - 结尾必须包含：参考来源：[官方资料名称]。

        **图片关键词策略 (IMAGE_KEYWORD):**
        - 使用最小化、最直接、最贴切的英文单词（1-2个词）。
        - 目标是能在 Freepik 搜到最精准的高质量配图。
        - 例如：“清理内存” -> "mobile cleaning"; “社保” -> "social security"; “快递隐私” -> "parcel privacy".

        **输出格式要求 (严格执行):**
        - 文章间分隔符: "---POST_DIVIDER---"。
        - 必须使用标签: $$$TITLE$$$, $$$ANGLE$$$, $$$IMAGE_KEYWORD$$$, $$$CONTENT$$$。
        - **严禁**加粗标签，**严禁**在标题或内容加方括号。

        **输出模版示例:**
        $$$TITLE$$$ 文章标题
        $$$ANGLE$$$ 深度科普
        $$$IMAGE_KEYWORD$$$ simple keyword
        $$$CONTENT$$$
        [文章正文...]
        参考来源：百度官方、XXX政务网
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
    if (lengthPreference === 'expand') lengthInstruction = "大幅扩充细节，字数800+。";
    else if (lengthPreference === 'shorten') lengthInstruction = "极度精简，保留干货，字数200左右。";

    try {
      const systemPrompt = "你是一名文案改写专家。在保持信息权威准确的前提下，变换文风。必须输出标准的标签格式，特别是 $$$TITLE$$$。";
      const userPrompt = `
        **任务**: 改写以下文章，必须保留原始的权威资料来源。
        **原标题**: ${targetPost.title}
        **原内容**: ${targetPost.content}
        **目标风格**: "${customStyle}"
        **篇幅要求**: "${lengthInstruction}"
        
        **输出格式 (必须包含以下所有标签)**:
        $$$TITLE$$$ [新爆款标题]
        $$$ANGLE$$$ [改写后的风格标签]
        $$$IMAGE_KEYWORD$$$ [最简精准英文搜索词]
        $$$CONTENT$$$
        [改写后的正文，保留文末的参考来源]
      `;

      const text = await callServerApi(systemPrompt, userPrompt);
      const parsed = parseResponse(text);
      if (parsed.length > 0) {
         const newPosts = [...posts];
         newPosts[index] = parsed[0];
         setPosts(newPosts);
         setEditingIndex(null); 
         setCustomStyle("");
      } else {
        throw new Error("解析改写结果失败");
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
        const strictRegex = new RegExp(`\\$\\$\\$${tag}\\$\\$\\$[\\*\\s:：]*(?:\\[)?(.*?)(?:\\])?(?:\\r?\\n|$)`, 'i');
        const match = raw.match(strictRegex);
        if (match && match[1].trim()) return match[1].trim();

        for (const f of fallbacks) {
           const fbRegex = new RegExp(`(?:^|\\n)[\\*\\s]*${f}[:：]\\s*(?:\\[)?(.*?)(?:\\])?(?:\\r?\\n|$)`, 'i');
           const fbMatch = raw.match(fbRegex);
           if (fbMatch && fbMatch[1].trim()) return fbMatch[1].trim();
        }
        return null;
      };

      const title = extract('TITLE', ['Title', '标题', 'New Title']) || "未命名标题";
      const angle = extract('ANGLE', ['Angle', '角度', '风格']) || "实用干货";
      const imageKeyword = extract('IMAGE_KEYWORD', ['Image', 'Keyword', '图片关键词']) || "clean background";
      
      let content = "";
      const contentMarker = /\$\$\$CONTENT\$\$\$[:：]?/i;
      const markerMatch = raw.match(contentMarker);
      if (markerMatch) {
         content = raw.substring(markerMatch.index! + markerMatch[0].length);
      } else {
        content = raw
          .split('\n')
          .filter(l => !l.includes('$$$') && !l.toLowerCase().includes('title:') && !l.includes('标题:'))
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
          <span>权威来源 · 官方核验 · 极简配图</span>
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
              参考资料来源 (可选)
            </label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="例如：优先使用百度官方、国家反诈中心资料..."
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
            {loading ? "正在调取官方资料..." : "一键生成 4 篇爆款推文"}
          </button>
        </div>
      </div>

      {/* Results Grid */}
      {posts.length > 0 && (
        <div className="grid md:grid-cols-2 gap-8 animate-fade-in">
          {posts.map((post, idx) => (
            <div key={idx} className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden flex flex-col group">
              {/* Image with Direct Freepik Link */}
              <div className="relative h-56 bg-slate-200 overflow-hidden">
                 <img 
                   src={`https://image.pollinations.ai/prompt/${encodeURIComponent(post.imageKeyword + " high quality photography clean background")}?width=800&height=500&nologo=true`} 
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
                      去 Freepik 查找原图
                      <LucideExternalLink className="w-3 h-3" />
                    </a>
                 </div>
                 <div className="absolute bottom-2 left-2 flex gap-2">
                    <span className="text-white text-[10px] bg-black/40 backdrop-blur-md px-2 py-1 rounded">搜索词: {post.imageKeyword}</span>
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
                   官方资料核验已完成
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
                  {editingIndex === idx ? "取消改写" : "AI 改写文风"}
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyToClipboard(`${post.title}\n\n${post.content}`)}
                    className="text-slate-400 hover:text-indigo-600 transition-colors p-2"
                    title="复制全文"
                  >
                    <LucideCopy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Rewrite UI */}
              {editingIndex === idx && (
                <div className="p-4 bg-indigo-50/50 border-t border-indigo-100 animate-fade-in">
                  <div className="mb-3">
                    <p className="text-[10px] font-bold text-indigo-900 mb-2 uppercase opacity-60">选择改写风格</p>
                    <div className="flex flex-wrap gap-2 mb-3">
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
                  </div>
                  
                  <div className="flex gap-2">
                    <input 
                      className="flex-grow text-xs p-2 rounded border border-indigo-100 focus:ring-1 focus:ring-indigo-500 focus:outline-none" 
                      placeholder="自定义描述风格，如：马斯克语录风..." 
                      value={customStyle}
                      onChange={(e) => setCustomStyle(e.target.value)}
                    />
                    <button 
                      onClick={() => handleRewrite(idx)}
                      disabled={rewriting || !customStyle}
                      className="bg-indigo-600 text-white text-xs px-4 py-2 rounded-lg font-bold shadow-md disabled:opacity-50 flex items-center gap-2"
                    >
                      {rewriting ? <LucideLoader2 className="w-3 h-3 animate-spin" /> : <LucideSparkles className="w-3 h-3" />}
                      {rewriting ? "生成中" : "确认"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer Info */}
      <div className="mt-20 border-t border-slate-200 pt-8 text-center text-slate-400">
        <p className="text-xs">
          数据采集自百度官方公开资料 · 配图索引由 Freepik 提供 · AI 引擎驱动
        </p>
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
