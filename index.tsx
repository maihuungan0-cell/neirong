import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI } from "@google/genai";
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
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const prompt = `
        Role: You are a senior editor for a popular content platform.
        
        **Target Audience**: Mass market users. 
        **Core Value**: **Utility (有用)** & **Efficiency (高效)**.

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

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      // Process Grounding Metadata
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      setSources(groundingChunks);

      // Process Text Content
      const text = response.text || "";
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
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `
        Role: Expert Content Editor & Stylist.
        
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

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const text = response.text || "";
      
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
    const rawPosts = text.split("---POST_DIVIDER---").filter(p => p.trim().length > 20);
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
          输入主题，AI 自动生成<b>实用、硬核</b>的科普短文，并自动匹配<b>Freepik素材图</b>。
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
                正在检索干货并生成...
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
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-8 text-center border border-red-100">
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

      {/* Sources Footer (Grounding) */}
      {sources.length > 0 && (
        <div className="mt-16 pt-8 border-t border-slate-200">
          <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">信息来源 & 参考</h4>
          <div className="flex flex-wrap gap-3">
            {sources.map((chunk, i) => chunk.web ? (
              <a 
                key={i} 
                href={chunk.web.uri} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-colors shadow-sm"
              >
                <span className="truncate max-w-[200px]">{chunk.web.title}</span>
              </a>
            ) : null)}
          </div>
        </div>
      )}

    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
