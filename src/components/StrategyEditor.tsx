
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Save, Bot, Loader2, Bug, Square, Folder, File, Plus, Trash2, ChevronRight, ChevronDown, Terminal, Server, Package, Zap, StopCircle, Activity, RefreshCw, Edit3, FolderPlus } from 'lucide-react';
import Editor, { loader } from '@monaco-editor/react';
import { generateStrategyCode } from '../services/ai/aiChatService';
import type { AISettings, StrategyFile } from '../types';
import { executeStrategy } from '../services/strategy/strategyFileService';

interface StrategyEditorProps {
  files: StrategyFile[];
  activeFileName: string;
  onSelectFile: (name: string) => void;
  onUpdateFile: (name: string, content: string) => void;
  onCreateFile: (name: string) => void;
  onDeleteFile: (name: string) => void;
  onRenameFile?: (oldName: string, newName: string) => void;
  aiSettings: AISettings;
  onRun: () => void;
}

// Pre-configure Monaco loader to use a reliable CDN
loader.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' } });

const PYTHON_BACKEND_URL = 'http://localhost:5000';

type PythonStatus = 'connected' | 'disconnected' | 'connecting';
type ConsoleTab = 'output' | 'variables' | 'packages';

const StrategyEditor: React.FC<StrategyEditorProps> = ({ 
  files, 
  activeFileName, 
  onSelectFile, 
  onUpdateFile, 
  onCreateFile, 
  onDeleteFile,
  onRenameFile,
  aiSettings,
  onRun 
}) => {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [showNewFile, setShowNewFile] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Python environment state
  const [pythonStatus, setPythonStatus] = useState<PythonStatus>('disconnected');
  const [isRunning, setIsRunning] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([
    '[SYS] QuantCore Strategy IDE initialized.',
    '[SYS] Waiting for Python backend connection...',
  ]);
  const [consoleTab, setConsoleTab] = useState<ConsoleTab>('output');
  const [pythonVariables, setPythonVariables] = useState<{ name: string; type: string; value: string }[]>([]);
  const [installedPackages] = useState<string[]>(['numpy', 'pandas', 'scipy', 'matplotlib', 'ta-lib']);
  const [newPackage, setNewPackage] = useState('');
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Computed
  const activeFile = files.find(f => f.name === activeFileName);

  // Build folder tree from flat file list
  const fileTree = React.useMemo(() => {
    interface TreeNode {
      name: string;
      path: string;
      type: 'file' | 'folder';
      children: TreeNode[];
    }
    const root: TreeNode = { name: '', path: '', type: 'folder', children: [] };

    const sortedFiles = [...files].sort((a, b) => a.name.localeCompare(b.name));
    for (const file of sortedFiles) {
      const parts = file.name.split('/');
      let current = root;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const partPath = parts.slice(0, i + 1).join('/');
        if (i === parts.length - 1) {
          current.children.push({ name: part, path: file.name, type: 'file', children: [] });
        } else {
          let folder = current.children.find(c => c.name === part && c.type === 'folder');
          if (!folder) {
            folder = { name: part, path: partPath, type: 'folder', children: [] };
            current.children.push(folder);
          }
          current = folder;
        }
      }
    }

    // Sort: folders first, then files
    const sortTree = (node: TreeNode) => {
      node.children.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      node.children.forEach(sortTree);
    };
    sortTree(root);
    return root.children;
  }, [files]);

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  // Check Python backend status
  useEffect(() => {
    const checkStatus = async () => {
      setPythonStatus('connecting');
      try {
        const res = await fetch(`${PYTHON_BACKEND_URL}/health`);
        if (res.ok) {
          setPythonStatus('connected');
          setConsoleOutput(prev => [...prev, '[SYS] Python backend connected ✓']);
        } else {
          setPythonStatus('disconnected');
        }
      } catch {
        setPythonStatus('disconnected');
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll console
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [consoleOutput]);

  const handleAiGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    const generated = await generateStrategyCode(prompt, aiSettings);
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

  const createNewFolder = () => {
    if (newFolderName.trim()) {
      onCreateFile(newFolderName.trim() + '/.gitkeep');
      setNewFolderName('');
      setShowNewFolder(false);
    }
  };

  const handleRename = (fileName: string) => {
    if (renameValue.trim() && renameValue !== fileName && onRenameFile) {
      onRenameFile(fileName, renameValue.trim());
    }
    setRenamingFile(null);
    setRenameValue('');
  };

  const handleRunPython = useCallback(async () => {
    if (pythonStatus !== 'connected' || !activeFile) return;
    setIsRunning(true);
    setConsoleOutput(prev => [
      ...prev,
      '',
      `[RUN] python3 ${activeFileName}`,
      `[SYS] Executing in Python environment...`,
    ]);

    try {
      const result = await executeStrategy({ code: activeFile.content });
      if (result.stdout) {
        setConsoleOutput(prev => [...prev, ...result.stdout.split('\n')]);
      }
      if (result.stderr) {
        setConsoleOutput(prev => [...prev, `[ERR] ${result.stderr}`]);
      }
      if (result.variables) {
        setPythonVariables(result.variables);
      }
      setConsoleOutput(prev => [
        ...prev,
        result.success ? '[SYS] Execution complete.' : '[ERR] Execution failed.',
      ]);
    } catch (err) {
      setConsoleOutput(prev => [
        ...prev,
        `[ERR] ${err instanceof Error ? err.message : 'Execution failed'}`,
      ]);
    }
    setIsRunning(false);
  }, [pythonStatus, activeFile, activeFileName]);

  const handleStopPython = useCallback(() => {
    setIsRunning(false);
    setConsoleOutput(prev => [...prev, '[SYS] Execution stopped.']);
  }, []);

  const statusColor = pythonStatus === 'connected' ? 'text-terminal-success' : pythonStatus === 'connecting' ? 'text-yellow-400' : 'text-terminal-error';
  const statusText = pythonStatus === 'connected'
    ? t('STRATEGY_PYTHON_CONNECTED' as any)
    : pythonStatus === 'connecting'
      ? t('STRATEGY_PYTHON_CONNECTING' as any)
      : t('STRATEGY_PYTHON_DISCONNECTED' as any);

  // Render file tree recursively
  const renderTreeNode = (node: { name: string; path: string; type: 'file' | 'folder'; children: any[] }, depth: number = 0) => {
    if (node.type === 'folder') {
      const isExpanded = expandedFolders.has(node.path);
      return (
        <div key={node.path}>
          <div
            className="flex items-center group px-2 py-1 cursor-pointer text-gray-400 hover:bg-[#2a2d2e]"
            style={{ paddingLeft: `${8 + depth * 12}px` }}
            onClick={() => toggleFolder(node.path)}
          >
            {isExpanded ? <ChevronDown size={12} className="mr-1" /> : <ChevronRight size={12} className="mr-1" />}
            <Folder size={12} className="mr-2 text-yellow-500" />
            <span className="flex-1 truncate">{node.name}</span>
          </div>
          {isExpanded && node.children.map((child: any) => renderTreeNode(child, depth + 1))}
        </div>
      );
    }

    const isActive = node.path === activeFileName;
    const isRenaming = renamingFile === node.path;

    return (
      <div
        key={node.path}
        className={`flex items-center group px-2 py-1 cursor-pointer border-l-2 ${isActive ? 'bg-[#37373d] text-white border-terminal-accent' : 'text-gray-400 border-transparent hover:bg-[#2a2d2e]'}`}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        onClick={() => !isRenaming && onSelectFile(node.path)}
        onDoubleClick={() => {
          if (onRenameFile) {
            setRenamingFile(node.path);
            setRenameValue(node.name);
          }
        }}
      >
        <File size={12} className={`mr-2 ${node.name.endsWith('.py') ? 'text-blue-400' : node.name.endsWith('.json') ? 'text-yellow-400' : 'text-gray-400'}`} />
        {isRenaming ? (
          <input
            className="bg-[#3c3c3c] border border-blue-500 text-white flex-1 px-1 outline-none text-xs"
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleRename(node.path); if (e.key === 'Escape') { setRenamingFile(null); setRenameValue(''); } }}
            onClick={e => e.stopPropagation()}
            autoFocus
          />
        ) : (
          <span className="flex-1 truncate">{node.name}</span>
        )}
        {!isRenaming && (
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
            {onRenameFile && (
              <Edit3
                size={10}
                className="hover:text-blue-400"
                onClick={(e) => { e.stopPropagation(); setRenamingFile(node.path); setRenameValue(node.name); }}
              />
            )}
            {node.name !== 'main.py' && (
              <Trash2
                size={10}
                className="hover:text-red-400"
                onClick={(e) => { e.stopPropagation(); onDeleteFile(node.path); }}
              />
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full bg-[#1e1e1e] text-gray-300 font-sans text-xs">
      
      {/* LEFT: Explorer + Python Environment */}
      <div className="w-52 bg-[#252526] flex flex-col border-r border-[#333]">
         {/* Explorer header */}
         <div className="p-2 text-[10px] font-bold tracking-wider text-gray-500 uppercase flex justify-between items-center">
            <span>EXPLORER</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setShowNewFolder(true)} className="hover:text-white" title="New Folder"><FolderPlus size={12}/></button>
              <button onClick={() => setShowNewFile(true)} className="hover:text-white" title="New File"><Plus size={12}/></button>
            </div>
         </div>
         <div className="flex-1 overflow-y-auto">
            <div className="px-2 py-1 flex items-center text-gray-400 font-bold text-[10px]">
               <ChevronDown size={12} className="mr-1"/> QUANT-PROJECT
            </div>
            <div className="pl-2">
               {fileTree.map(node => renderTreeNode(node))}
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
               {showNewFolder && (
                  <div className="px-2 py-1 flex items-center">
                     <Folder size={12} className="mr-2 text-yellow-500" />
                     <input
                        className="bg-[#3c3c3c] border border-blue-500 text-white w-full px-1 outline-none"
                        value={newFolderName}
                        onChange={e => setNewFolderName(e.target.value)}
                        onKeyDown={e => { if(e.key === 'Enter') createNewFolder(); if(e.key==='Escape') setShowNewFolder(false); }}
                        autoFocus
                        placeholder="folder name"
                     />
                  </div>
               )}
            </div>
         </div>

         {/* Python Environment Panel */}
         <div className="border-t border-[#333]">
           <div className="p-2 text-[10px] font-bold tracking-wider text-gray-500 uppercase flex items-center gap-1.5">
             <Server size={10} />
             {t('STRATEGY_PYTHON_ENV' as any)}
           </div>
           <div className="px-2 pb-2 space-y-2">
             {/* Status indicator */}
             <div className="flex items-center justify-between">
               <span className="text-[9px] text-gray-500">{t('STRATEGY_PYTHON_STATUS' as any)}</span>
               <span className={`text-[9px] font-bold flex items-center gap-1 ${statusColor}`}>
                 <span className={`w-1.5 h-1.5 rounded-full ${pythonStatus === 'connected' ? 'bg-terminal-success' : pythonStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' : 'bg-terminal-error'}`} />
                 {statusText}
               </span>
             </div>
             {/* Quick actions */}
             {pythonStatus === 'connected' && (
               <div className="flex gap-1">
                 <button
                   onClick={isRunning ? handleStopPython : handleRunPython}
                   className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[9px] font-bold uppercase rounded-sm transition-colors ${
                     isRunning
                       ? 'bg-red-900/40 border border-red-700/50 text-red-400 hover:bg-red-900/60'
                       : 'bg-green-900/40 border border-green-700/50 text-green-400 hover:bg-green-900/60'
                   }`}
                   title={isRunning ? t('STRATEGY_STOP_PYTHON' as any) : t('STRATEGY_RUN_HINT' as any)}
                 >
                   {isRunning ? <Square size={8} /> : <Play size={8} />}
                   {isRunning ? t('STRATEGY_STOP_PYTHON' as any) : t('STRATEGY_RUN_PYTHON' as any)}
                 </button>
               </div>
             )}
             {pythonStatus === 'disconnected' && (
               <div className="text-[9px] text-gray-600 bg-[#1a1a1a] p-1.5 border border-[#333]">
                 <code className="text-yellow-400/60">cd python && python main.py</code>
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
             <div className="flex items-center gap-2 text-gray-500 text-[10px]">
                {activeFileName} &bull; {activeFile?.content.length} chars
                {isRunning && (
                  <span className="flex items-center gap-1 text-green-400 animate-pulse">
                    <Activity size={9} /> {t('STRATEGY_RUN_PYTHON' as any)}...
                  </span>
                )}
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
                 onClick={handleRunPython}
                 disabled={pythonStatus !== 'connected' || isRunning}
                 className="flex items-center space-x-1 px-3 py-1 bg-blue-700 hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed text-white text-[10px] uppercase font-bold rounded-sm transition-colors"
                 title={t('STRATEGY_RUN_HINT' as any)}
               >
                 {isRunning ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />}
                 <span>{t('STRATEGY_RUN_PYTHON' as any)}</span>
               </button>
               <button 
                 onClick={onRun}
                 className="flex items-center space-x-1 px-3 py-1 bg-green-700 hover:bg-green-600 text-white text-[10px] uppercase font-bold rounded-sm transition-colors"
               >
                 <Zap size={10} />
                 <span>{t('STRATEGY_BACKTEST' as any)}</span>
               </button>
             </div>
         </div>

         {/* AI Panel */}
         {aiPanelOpen && (
           <div className="bg-[#252526] p-3 border-b border-terminal-accent animate-in slide-in-from-top-2 duration-200 shrink-0">
             <div className="flex space-x-3">
               <div className="text-terminal-accent pt-1.5"><Bot size={18} /></div>
               <div className="flex-1 space-y-2">
                 <div className="flex justify-between items-center gap-2">
                   <div className="flex items-center gap-2">
                     <span className="text-[10px] font-bold text-terminal-accent tracking-wider">AI STRATEGY GENERATOR</span>
                     <span className="px-2 py-0.5 text-[9px] border border-[#333] text-gray-400 uppercase tracking-widest">
                       {aiSettings.provider}
                     </span>
                   </div>
                   {isGenerating && <span className="text-[10px] text-gray-400 animate-pulse">Processing...</span>}
                 </div>
                 <div className="relative">
                   <input 
                     type="text" 
                     value={prompt}
                     onChange={(e) => setPrompt(e.target.value)}
                     placeholder={`Describe your strategy (${aiSettings.provider === 'gemini' ? 'Gemini' : 'free-claude-code'} generator)...`}
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
               path={activeFileName}
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

         {/* Bottom Console with tabs */}
         <div className="h-40 bg-[#1e1e1e] border-t border-[#333] flex flex-col">
            <div className="flex items-center bg-[#252526] border-b border-[#333] text-[10px] text-gray-400 shrink-0">
              <button
                onClick={() => setConsoleTab('output')}
                className={`flex items-center gap-1.5 px-3 py-1 uppercase tracking-wider border-b-2 transition-colors ${
                  consoleTab === 'output' ? 'text-terminal-accent border-terminal-accent bg-[#1e1e1e]' : 'border-transparent hover:text-gray-300'
                }`}
              >
                <Terminal size={10} /> {t('STRATEGY_OUTPUT' as any)}
              </button>
              <button
                onClick={() => setConsoleTab('variables')}
                className={`flex items-center gap-1.5 px-3 py-1 uppercase tracking-wider border-b-2 transition-colors ${
                  consoleTab === 'variables' ? 'text-terminal-accent border-terminal-accent bg-[#1e1e1e]' : 'border-transparent hover:text-gray-300'
                }`}
              >
                <Bug size={10} /> {t('STRATEGY_VARIABLES' as any)}
              </button>
              <button
                onClick={() => setConsoleTab('packages')}
                className={`flex items-center gap-1.5 px-3 py-1 uppercase tracking-wider border-b-2 transition-colors ${
                  consoleTab === 'packages' ? 'text-terminal-accent border-terminal-accent bg-[#1e1e1e]' : 'border-transparent hover:text-gray-300'
                }`}
              >
                <Package size={10} /> {t('STRATEGY_PACKAGES' as any)}
              </button>
              <div className="flex-1" />
              <button
                onClick={() => setConsoleOutput([])}
                className="px-2 py-1 text-gray-600 hover:text-gray-300"
                title="Clear"
              >
                <Trash2 size={9} />
              </button>
            </div>

            {/* Console content */}
            {consoleTab === 'output' && (
              <div className="flex-1 p-2 font-mono text-[10px] text-gray-400 overflow-y-auto custom-scrollbar">
                {consoleOutput.map((line, i) => (
                  <div
                    key={i}
                    className={
                      line.startsWith('[ERR]') ? 'text-red-400' :
                      line.startsWith('[SYS]') ? 'text-gray-500' :
                      line.startsWith('[RUN]') ? 'text-green-400' :
                      'text-gray-300'
                    }
                  >
                    {line}
                  </div>
                ))}
                {isRunning && <span className="text-green-400 animate-pulse">▌</span>}
                <div ref={consoleEndRef} />
              </div>
            )}

            {consoleTab === 'variables' && (
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {pythonVariables.length > 0 ? (
                  <table className="w-full text-[10px] font-mono">
                    <thead className="bg-[#252526] text-gray-500 sticky top-0">
                      <tr>
                        <th className="px-2 py-1 text-left">Name</th>
                        <th className="px-2 py-1 text-left">Type</th>
                        <th className="px-2 py-1 text-left">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pythonVariables.map((v, i) => (
                        <tr key={i} className="border-t border-[#2a2a2a] hover:bg-[#252526]">
                          <td className="px-2 py-1 text-terminal-accent">{v.name}</td>
                          <td className="px-2 py-1 text-blue-400">{v.type}</td>
                          <td className="px-2 py-1 text-gray-300 truncate max-w-[200px]">{v.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-600 text-[10px]">
                    {t('STRATEGY_RUN_HINT' as any)}
                  </div>
                )}
              </div>
            )}

            {consoleTab === 'packages' && (
              <div className="flex-1 p-2 overflow-y-auto custom-scrollbar">
                <div className="flex gap-1 mb-2">
                  <input
                    type="text"
                    value={newPackage}
                    onChange={(e) => setNewPackage(e.target.value)}
                    placeholder={t('STRATEGY_PKG_PLACEHOLDER' as any)}
                    className="flex-1 bg-[#3c3c3c] border border-[#444] text-white text-[10px] px-2 py-1 focus:outline-none focus:border-terminal-accent font-mono"
                  />
                  <button
                    className="px-2 py-1 bg-[#333] text-[9px] text-gray-300 hover:bg-[#444] font-bold uppercase"
                    onClick={() => {
                      if (newPackage.trim()) {
                        setConsoleOutput(prev => [...prev, `[SYS] pip install ${newPackage}...`]);
                        setNewPackage('');
                      }
                    }}
                  >
                    {t('STRATEGY_INSTALL_PKG' as any)}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {installedPackages.map(pkg => (
                    <span key={pkg} className="px-2 py-0.5 bg-[#2a2a2a] border border-[#3a3a3a] text-[9px] text-gray-400 font-mono">
                      {pkg}
                    </span>
                  ))}
                </div>
              </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default StrategyEditor;
