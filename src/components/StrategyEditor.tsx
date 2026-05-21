
import React, { useState, useEffect } from 'react';
import { Play, Save, Bot, Loader2, Bug, Square, Folder, File, Plus, Trash2, ChevronRight, ChevronDown, Terminal } from 'lucide-react';
import Editor, { loader } from '@monaco-editor/react';
import { generateStrategyCode } from '../services/ai/geminiService';
import { StrategyFile } from '../types';

interface StrategyEditorProps {
  files: StrategyFile[];
  activeFileName: string;
  onSelectFile: (name: string) => void;
  onUpdateFile: (name: string, content: string) => void;
  onCreateFile: (name: string) => void;
  onDeleteFile: (name: string) => void;
  onRun: () => void;
}

// Pre-configure Monaco loader to use a reliable CDN
loader.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' } });

const StrategyEditor: React.FC<StrategyEditorProps> = ({ 
  files, 
  activeFileName, 
  onSelectFile, 
  onUpdateFile, 
  onCreateFile, 
  onDeleteFile,
  onRun 
}) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [showNewFile, setShowNewFile] = useState(false);

  // Computed
  const activeFile = files.find(f => f.name === activeFileName);

  const handleAiGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    const generated = await generateStrategyCode(prompt);
    // Append or replace active file content
    if (activeFile) {
       onUpdateFile(activeFileName, generated);
    }
    setIsGenerating(false);
    setAiPanelOpen(false);
  };

  const createNewFile = () => {
     if (newFileName.trim()) {
        onCreateFile(newFileName.trim());
        setNewFileName('');
        setShowNewFile(false);
     }
  };

  return (
    <div className="flex h-full bg-[#1e1e1e] text-gray-300 font-sans text-xs">
      
      {/* LEFT: Explorer */}
      <div className="w-48 bg-[#252526] flex flex-col border-r border-[#333]">
         <div className="p-2 text-[10px] font-bold tracking-wider text-gray-500 uppercase flex justify-between items-center">
            <span>EXPLORER</span>
            <button onClick={() => setShowNewFile(true)} className="hover:text-white"><Plus size={12}/></button>
         </div>
         <div className="flex-1 overflow-y-auto">
            <div className="px-2 py-1 flex items-center text-gray-400 font-bold text-[10px]">
               <ChevronDown size={12} className="mr-1"/> QUANT-PROJECT
            </div>
            <div className="pl-2">
               {files.map(file => (
                  <div 
                     key={file.name}
                     className={`flex items-center group px-2 py-1 cursor-pointer border-l-2 ${file.name === activeFileName ? 'bg-[#37373d] text-white border-terminal-accent' : 'text-gray-400 border-transparent hover:bg-[#2a2d2e]'}`}
                     onClick={() => onSelectFile(file.name)}
                  >
                     <File size={12} className={`mr-2 ${file.name.endsWith('py') ? 'text-blue-400' : file.name.endsWith('json') ? 'text-yellow-400' : 'text-gray-400'}`} />
                     <span className="flex-1 truncate">{file.name}</span>
                     {file.name !== 'main.py' && (
                        <Trash2 
                           size={12} 
                           className="opacity-0 group-hover:opacity-100 hover:text-red-400"
                           onClick={(e) => { e.stopPropagation(); onDeleteFile(file.name); }}
                        />
                     )}
                  </div>
               ))}
               {showNewFile && (
                  <div className="px-2 py-1 flex items-center">
                     <File size={12} className="mr-2 text-gray-500" />
                     <input 
                        className="bg-[#3c3c3c] border border-blue-500 text-white w-full px-1 outline-none"
                        value={newFileName}
                        onChange={e => setNewFileName(e.target.value)}
                        onKeyDown={e => { if(e.key === 'Enter') createNewFile(); if(e.key==='Escape') setShowNewFile(false); }}
                        autoFocus
                        placeholder="filename.py"
                     />
                  </div>
               )}
            </div>
         </div>
      </div>

      {/* RIGHT: Main Editor Area */}
      <div className="flex-1 flex flex-col min-w-0">
         
         {/* Top Tabs */}
         <div className="flex bg-[#2d2d2d] overflow-x-auto no-scrollbar">
            {files.map(file => (
               <div 
                  key={file.name}
                  className={`flex items-center px-3 py-2 cursor-pointer min-w-[100px] border-r border-[#1e1e1e] ${file.name === activeFileName ? 'bg-[#1e1e1e] text-white border-t-2 border-t-terminal-accent' : 'bg-[#2d2d2d] text-gray-500 hover:bg-[#252526]'}`}
                  onClick={() => onSelectFile(file.name)}
               >
                  <span className={`mr-2 ${file.name.endsWith('py') ? 'text-blue-400' : 'text-yellow-400'}`}>{file.name.endsWith('py') ? '🐍' : '{}'}</span>
                  <span className="truncate">{file.name}</span>
                  <span 
                    className="ml-2 hover:text-white hover:bg-gray-700 rounded-full p-0.5"
                    onClick={(e) => { e.stopPropagation(); if(files.length > 1) onDeleteFile(file.name); }}
                  >×</span>
               </div>
            ))}
         </div>

         {/* Toolbar */}
         <div className="flex items-center justify-between px-2 py-1 bg-[#1e1e1e] border-b border-[#333] shrink-0">
             <div className="flex items-center text-gray-500 text-[10px]">
                {activeFileName} &bull; {activeFile?.content.length} chars
             </div>
             <div className="flex items-center space-x-2">
               <button 
                 onClick={() => setAiPanelOpen(!aiPanelOpen)}
                 className={`flex items-center space-x-1 px-2 py-1 hover:bg-[#333] rounded text-[10px] ${aiPanelOpen ? 'text-terminal-accent bg-[#333]' : 'text-gray-400'}`}
                 title="AI Copilot"
               >
                 <Bot size={12} />
                 <span>COPILOT</span>
               </button>
               <div className="w-px h-3 bg-[#444]"></div>
               <button className="p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded transition-colors" title="Save">
                 <Save size={14} />
               </button>
               <button 
                 onClick={onRun}
                 className="flex items-center space-x-1 px-3 py-1 bg-green-700 hover:bg-green-600 text-white text-[10px] uppercase font-bold rounded-sm transition-colors"
               >
                 <Play size={10} />
                 <span>Run Backtest</span>
               </button>
             </div>
         </div>

         {/* AI Panel */}
         {aiPanelOpen && (
           <div className="bg-[#252526] p-3 border-b border-terminal-accent animate-in slide-in-from-top-2 duration-200 shrink-0">
             <div className="flex space-x-3">
               <div className="text-terminal-accent pt-1.5"><Bot size={18} /></div>
               <div className="flex-1 space-y-2">
                 <div className="flex justify-between items-center">
                   <span className="text-[10px] font-bold text-terminal-accent tracking-wider">GEMINI STRATEGY GENERATOR</span>
                   {isGenerating && <span className="text-[10px] text-gray-400 animate-pulse">Processing...</span>}
                 </div>
                 <div className="relative">
                   <input 
                     type="text" 
                     value={prompt}
                     onChange={(e) => setPrompt(e.target.value)}
                     placeholder="Describe your strategy (e.g., 'Mean reversion on Bollinger Bands with RSI filter')..."
                     className="w-full bg-[#3c3c3c] border border-[#333] text-white text-xs px-3 py-2 focus:outline-none focus:border-terminal-accent focus:ring-1 focus:ring-terminal-accent placeholder-gray-500 font-sans"
                     onKeyDown={(e) => e.key === 'Enter' && handleAiGenerate()}
                     disabled={isGenerating}
                     autoFocus
                   />
                   {isGenerating && (
                     <div className="absolute right-2 top-2">
                        <Loader2 size={14} className="animate-spin text-terminal-accent" />
                     </div>
                   )}
                 </div>
               </div>
             </div>
           </div>
         )}

         {/* Monaco Editor */}
         <div className="flex-1 overflow-hidden relative">
            <Editor
               height="100%"
               path={activeFileName} // Important for Monaco to treat different files as different models
               language={activeFile?.language || 'python'}
               value={activeFile?.content || ''}
               onChange={(value) => onUpdateFile(activeFileName, value || '')}
               theme="vs-dark"
               options={{
                  fontSize: 12,
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  cursorBlinking: "smooth",
                  renderLineHighlight: "all",
                  padding: { top: 12, bottom: 12 },
                  automaticLayout: true,
               }}
            />
         </div>

         {/* Bottom Console */}
         <div className="h-32 bg-[#1e1e1e] border-t border-[#333] flex flex-col">
            <div className="flex items-center px-2 py-1 bg-[#252526] border-b border-[#333] text-[10px] text-gray-400 uppercase tracking-wider gap-2">
               <Terminal size={10} /> Output Console
            </div>
            <div className="flex-1 p-2 font-mono text-[10px] text-gray-400 overflow-y-auto custom-scrollbar">
               <div className="text-green-500">➜  quant-project git:(main) python3 {activeFileName}</div>
               <div>[SYS] Environment initialized.</div>
               <div>[SYS] Loading market data... OK.</div>
               {activeFileName === 'main.py' ? (
                  <div className="text-gray-500">Ready to execute strategy logic.</div>
               ) : (
                  <div className="text-gray-500">File loaded.</div>
               )}
               <span className="animate-pulse">_</span>
            </div>
         </div>
      </div>
    </div>
  );
};

export default StrategyEditor;
