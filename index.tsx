import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { 
  LucideSparkles, LucideCopy, LucideSearch, LucideBookOpen, 
  LucideLoader2, LucideWand2, LucideX, LucideImage, 
  LucideExternalLink, LucideMaximize2, LucideMinimize2, 
  LucideAlignJustify, LucideCloud
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
      const systemPrompt = `You are a senior editor for a popular content platform. Target Audience: Mass market users. Core Value: Utility (有用) & Efficiency (高效).`;
      
      const userPrompt = `
        **Task:**
        1. Search for practical knowledge regarding: "${topic}".
        2. Generate 4 distinct articles that **TEACH** the user something specific.
        3. Context: "${context || "Focus on practical skills, safety tips, or efficiency."}"
        
        **Strict Article Structure:**
        1.  **Opening**: Quick hook (1-2 sentences).
        2.  **Body**: Detailed points. Must include specific steps, methods, or examples.
        3.  **Conclusion**: Quick summary.
        4.  **Length**: **MEDIUM**. ~600-800 Chinese characters. (Content must be substantial but language should remain concise/punchy. No filler words.)

        **Output Requirements (CRITICAL):**
        - **Variations**: Generate exactly 4 different articles.
        - **Separator**: Use "---POST_DIVIDER---" to separate articles.
        - **Tags**: Use the EXACT tags provided below. **DO NOT TRANSLATE THE TAGS INTO CHINESE**.
        - **Titles**: **STRICTLY UNDER 15 CHINESE CHARACTERS**.
        - **Angle Label**: Chinese, 2-4 chars (e.g. 实操教学).
        - **Image Keyword**: A short, descriptive ENGLISH keyword or phrase for finding a relevant stock photo (e.g. "messy desk", "smartphone security").
        
        **Strict Output Format:**
        $$$TITLE$$$ [Title]
        $$$ANGLE$$$ [Angle]
        $$$IMAGE_KEYWORD$$$ [English Keyword]
        $$$CONTENT$$$
        [Body content here...]
        ---POST_DIVIDER---
      `;

      // Call Backend API
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

    let lengthInstruction = "Length: Medium (~600-800 chars). Keep it informative but concise.";
    if (lengthPreference === 'expand') {
      lengthInstruction = "Length: EXPAND the content significantly. Add more examples and details. Target: 800-1000+ characters.";
    } else if (lengthPreference === 'shorten') {
      lengthInstruction = "Length: CONDENSE the content. Remove filler. Target: ~300 characters.";
    }

    try {
      const systemPrompt = "Role: Expert Content Editor & Stylist.";
      const userPrompt = `
        **Task**: Rewrite the provided article.
        **Original**: Title: ${targetPost.title}, Content: ${targetPost.content}
        **Target Style**: "${customStyle}"
        **Target Length**: "${lengthInstruction}"
        **Format Requirement**: DO NOT TRANSLATE TAGS. Use $$$TITLE$$$, $$$CONTENT$$$ etc.
        
        **Output Format**:
        $$$TITLE$$$ [New Title]
        $$$ANGLE$$$ [New Style Label]
        $$$IMAGE_KEYWORD$$$ [New English Keyword]
        $$$CONTENT$$$
        [New Content]
      `;

      const text = await callServerApi(systemPrompt, userPrompt);
      
      const parsed = parseResponse(text); // Reuse robust parser
      if (parsed.length > 0) {
         const newPosts = [...posts];
         newPosts[index] = parsed[0];
         setPosts(newPosts);
         setEditingIndex(null); 
         setCustomStyle("");
         setLengthPreference('default');
      }

    } catch (err: any) {
      alert("改写失败: " + err.message);
    } finally {
      setRewriting(false);
    }
  };

  // Helper: Robust Parser
  const parseResponse = (text: string): GeneratedPost[] => {
    const cleanText = text.replace(/```/g, ''); 
    // Handle split. Model might forget newline before divider.
    const rawPosts = cleanText.split(/---POST_DIVIDER---/i).filter(p => p.trim().length > 20);
    
    return rawPosts.map((raw) => {
      // Regex to handle:
      // 1. English ($$$TITLE$$$) OR Chinese ($$$标题$$$) tags
      // 2. Optional colons (: or ：)
      // 3. Optional whitespace
      
      const titleMatch = raw.match(/\$\$\$(?:TITLE|标题)\$\$\$[:：]?\s*(.+)/i);
      const angleMatch = raw.match(/\$\$\$(?:ANGLE|角度)\$\$\$[:：]?\s*(.+)/i);
      const imageMatch = raw.match(/\$\$\$(?:IMAGE_KEYWORD|图片关键词)\$\$\$[:：]?\s*(.+)/i);
      
      // Split content. Support both English and Chinese tag
      let contentBody = "";
      const contentSplit = raw.split(/\$\$\$(?:CONTENT|内容)\$\$\$[:：]?/i);
      
      if (contentSplit.length > 1) {
        contentBody = contentSplit[1].trim();
      } else {
        // Fallback: if no content tag found, try to strip the header lines and take the rest
        contentBody = raw
          .replace(/\$\$\$(?:TITLE|标题)\$\$\$.+/i, '')
          .replace(/\$\$\$(?:ANGLE|角度)\$\$\$.+/i, '')
          .replace(/\$\$\$(?:IMAGE_KEYWORD|图片关键词)\$\$\$.+/i, '')
          .trim();
      }

      // Cleanup markup
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
        <p className="text-slate-500 text-lg max-w-2xl mx-auto flex items-center justify-center gap-2">
          <span>AI 驱动的爆款内容生成器</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-bold border border-slate-200 flex items-center gap-1">
            <LucideCloud className="w-3 h-3" /> Vercel Serverless
          </span>
        </p>
      </div>

      {/* Input Section */}
      <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 mb-12 border border-slate-100 max-w-3xl mx-auto">
        <div className="space-y-6">
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
                正在生成...
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
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-8 text-center border border-red-100 whitespace-pre-wrap text-sm">
          <p className="font-bold mb-1">请求出错</p>
          {error}
        </div>
      )}

      {/* Results Grid */}
      {posts.length > 0 && (
        <div className="grid md:grid-cols-2 gap-6 animate-fade-in">
          {posts.map((post, idx) => (
            <div key={idx} className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border border-slate-100 overflow-hidden flex flex-col relative group">
              
              {/* Image Section */}
              <div className="relative h-48 bg-slate-100 overflow-hidden group/image">
                 <img 
                   src={`https://image.pollinations.ai/prompt/${encodeURIComponent(post.imageKeyword)}?width=800&height=400&nologo=true`} 
                   alt={post.imageKeyword}
                   className="w-full h-full object-cover opacity-90 transition-transform duration-700 group-hover/image:scale-105"
                   onError={(e) => {
                     (e.target as HTMLImageElement).src = "https://placehold.co/800x400?text=No+Preview";
                   }}
                 />
                 <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                    <a 
                      href={`https://www.freepik.com/search?format=search&query=${encodeURIComponent(post.imageKeyword)}&license=free`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="bg-white text-slate-800 px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 shadow-lg hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                    >
                      <LucideImage className="w-4 h-4" />
                      Freepik 配图
                      <LucideExternalLink className="w-3 h-3 text-slate-400" />
                    </a>
                 </div>
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

              {/* Rewrite Panel */}
              {editingIndex === idx && (
                <div className="p-4 bg-indigo-50/50 border-t border-indigo-100 animate-fade-in">
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
                        placeholder="输入自定义风格..."
                        className="w-full text-sm p-3 pr-10 rounded-lg border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        autoFocus
                      />
                      {customStyle && (
                         <button onClick={() => setCustomStyle("")} className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600">
                           <LucideX className="w-4 h-4" />
                         </button>
                      )}
                    </div>
                  </div>

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
      
      <div className="mt-16 pt-8 border-t border-slate-200 text-center text-slate-400 text-xs">
         Deployment: Vercel Serverless
      </div>

    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
