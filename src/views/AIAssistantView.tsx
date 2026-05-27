/**
 * AIAssistantView
 *
 * Full-screen AI chat interface.
 *
 * Redesigned to work without a Python backend — Claude Code will be
 * integrated as the AI engine in a future release.  The chat UI is
 * retained for continuity, but all Python/backend-specific status
 * checks and warnings have been removed.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bot,
  Send,
  Loader,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  BookmarkPlus,
  LayoutGrid,
  AlertCircle,
  Trash2,
  Zap,
  Sparkles,
  MessageSquare,
  Search,
  TrendingUp,
  Database,
  BrainCircuit,
} from 'lucide-react';

import type { ChatMessage, AIAction, ToolUseEvent, Notification } from '../types';
import type { CustomSectorDef } from '../data/sectors';
import type { ResourceKey, LangKey } from '../i18n';
import { nextCustomColor, newCustomSectorId } from '../data/sectors';
import { sendAIMessage } from '../services/ai/aiChatService';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Collapsible block that shows what a single tool call returned. */
const ToolBlock = ({ event, t }: { event: ToolUseEvent; t: (key: ResourceKey) => string }) => {
  const [open, setOpen] = useState(false);

  const toolLabel: Record<string, string> = {
    search_stocks: t('AI_TOOL_SEARCH'),
    add_sector: t('AI_TOOL_SECTOR'),
    add_to_watchlist: t('AI_TOOL_WATCHLIST'),
    get_sectors: t('AI_TOOL_GET_SECTORS'),
  };

  const summary =
    event.tool === 'search_stocks'
      ? `关键词: "${(event.input as { keyword?: string }).keyword ?? ''}"  →  ${
          (event.output as { stocks?: unknown[] })?.stocks?.length ?? 0
        } 只股票`
      : event.tool === 'add_sector'
        ? `「${(event.input as { name?: string }).name ?? ''}」  ${
            (event.input as { symbols?: unknown[] }).symbols?.length ?? 0
          } 只股票`
        : event.tool === 'add_to_watchlist'
          ? `${(event.input as { symbols?: string[] }).symbols?.join(', ') ?? ''}`
          : '';

  return (
    <div className="mt-1 border border-[#222] bg-[#0d0d0d] text-[10px] font-mono">
      <button
        className="w-full flex items-center gap-1.5 px-2 py-1 text-left text-gray-500 hover:text-gray-400"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
        <span className="text-[#888]">{toolLabel[event.tool] ?? event.tool}</span>
        {summary && <span className="text-gray-600 ml-1 truncate">{summary}</span>}
      </button>
      {open && (
        <div className="px-2 pb-2 pt-0.5 border-t border-[#1a1a1a] overflow-x-auto">
          <pre className="text-[9px] text-gray-600 whitespace-pre-wrap break-all">
            {JSON.stringify(event.output, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

/** Card shown inline in assistant messages when an action was applied. */
const ActionCard = ({ action, t }: { action: AIAction; t: (key: ResourceKey) => string }) => {
  if (action.type === 'ADD_SECTOR') {
    return (
      <div className="mt-2 flex items-start gap-2 p-2 bg-terminal-accent/10 border border-terminal-accent/30 text-[10px] font-mono">
        <LayoutGrid size={12} className="text-terminal-accent mt-0.5 shrink-0" />
        <div>
          <div className="text-terminal-accent font-bold">{t('AI_SECTOR_CREATED')}</div>
          <div className="text-gray-400 mt-0.5">
            {action.payload.name}
            {action.payload.nameEn && action.payload.nameEn !== action.payload.name
              ? ` / ${action.payload.nameEn}`
              : ''}
          </div>
          <div className="text-gray-600 mt-0.5">
            {action.payload.symbols.length} {t('AI_STOCKS_SUFFIX')} ·{' '}
            {action.payload.symbols.slice(0, 5).join(', ')}
            {action.payload.symbols.length > 5 ? ` ... +${action.payload.symbols.length - 5}` : ''}
          </div>
        </div>
        <CheckCircle size={12} className="text-terminal-success ml-auto mt-0.5 shrink-0" />
      </div>
    );
  }

  if (action.type === 'ADD_TO_WATCHLIST') {
    return (
      <div className="mt-2 flex items-start gap-2 p-2 bg-blue-900/20 border border-blue-700/30 text-[10px] font-mono">
        <BookmarkPlus size={12} className="text-blue-400 mt-0.5 shrink-0" />
        <div>
          <div className="text-blue-400 font-bold">{t('AI_ADDED_TO_WATCHLIST')}</div>
          <div className="text-gray-500 mt-0.5">
            {action.payload.symbols.join(', ')}
          </div>
        </div>
        <CheckCircle size={12} className="text-terminal-success ml-auto mt-0.5 shrink-0" />
      </div>
    );
  }

  return null;
};

/** Single chat message bubble. */
const MessageBubble = ({ msg, t }: { msg: ChatMessage; t: (key: ResourceKey) => string }) => {
  const isUser = msg.role === 'user';

  if (msg.isLoading) {
    return (
      <div className="flex gap-2 items-start">
        <div className="w-5 h-5 rounded-sm bg-[#1a1a1a] flex items-center justify-center shrink-0 mt-0.5">
          <Bot size={11} className="text-terminal-accent" />
        </div>
        <div className="flex-1 bg-[#0d0d0d] border border-[#1e1e1e] px-3 py-2 text-[11px] font-mono">
          <div className="flex items-center gap-2 text-gray-500">
            <Loader size={10} className="animate-spin" />
            <span>{t('AI_THINKING')}</span>
          </div>
        </div>
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="flex gap-2 items-start flex-row-reverse">
        <div className="w-5 h-5 rounded-sm bg-terminal-accent/20 border border-terminal-accent/30 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-[8px] text-terminal-accent font-bold">YOU</span>
        </div>
        <div className="max-w-[75%] bg-terminal-accent/5 border border-terminal-accent/20 px-3 py-2 text-[11px] font-mono text-gray-200 whitespace-pre-wrap">
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 items-start">
      <div className="w-5 h-5 rounded-sm bg-[#1a1a1a] flex items-center justify-center shrink-0 mt-0.5">
        <Bot size={11} className="text-terminal-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="bg-[#0d0d0d] border border-[#1e1e1e] px-3 py-2 text-[11px] font-mono text-gray-200 whitespace-pre-wrap">
          {msg.content}
        </div>
        {msg.toolUse && msg.toolUse.length > 0 && (
          <div className="mt-1">
            {msg.toolUse.map((ev, i) => (
              <ToolBlock key={i} event={ev} t={t} />
            ))}
          </div>
        )}
        {msg.actions && msg.actions.length > 0 && (
          <div>
            {msg.actions.map((action, i) => (
              <ActionCard key={i} action={action} t={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Suggested prompts
// ---------------------------------------------------------------------------

const getSuggestions = (t: (key: ResourceKey) => string) => [
  t('AI_SUGGESTION_1'),
  t('AI_SUGGESTION_2'),
  t('AI_SUGGESTION_3'),
  t('AI_SUGGESTION_4'),
];

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

interface AIAssistantViewProps {
  customSectors: CustomSectorDef[];
  setCustomSectors: (fn: (prev: CustomSectorDef[]) => CustomSectorDef[]) => void;
  stockWatchlist: string[];
  addToWatchlist: (symbol: string) => void;
  showNotification: (type: Notification['type'], message: string) => void;
  lang: LangKey;
  t: (key: ResourceKey) => string;
}

export const AIAssistantView = ({
  customSectors,
  setCustomSectors,
  stockWatchlist,
  addToWatchlist,
  showNotification,
  lang,
  t,
}: AIAssistantViewProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Auto-scroll to bottom ────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Apply AI actions to app state ────────────────────────────────────────
  const applyActions = useCallback(
    (actions: AIAction[]) => {
      for (const action of actions) {
        if (action.type === 'ADD_SECTOR') {
          const { name, nameEn, symbols } = action.payload;
          setCustomSectors((prev) => {
            if (prev.some((s) => s.name === name)) return prev;
            const newSector: CustomSectorDef = {
              id: newCustomSectorId(),
              name,
              nameEn: nameEn || name,
              color: nextCustomColor(prev),
              symbols,
              isCustom: true,
            };
            return [...prev, newSector];
          });
          showNotification('SUCCESS', `${t('AI_NOTIFICATION_SECTOR')} ${name}`);
        } else if (action.type === 'ADD_TO_WATCHLIST') {
          for (const sym of action.payload.symbols) {
            addToWatchlist(sym);
          }
        }
      }
    },
    [setCustomSectors, addToWatchlist, showNotification, t],
  );

  // ── Send message ─────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    const loadingMsg: ChatMessage = {
      id: 'loading',
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isLoading: true,
    };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setInput('');
    setIsLoading(true);

    abortRef.current = new AbortController();

    // Build API message list (exclude loading placeholder)
    const apiMessages = [
      ...messages
        .filter((m) => !m.isLoading)
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: text },
    ];

    try {
      const result = await sendAIMessage(
        apiMessages,
        { customSectors, stockWatchlist },
        abortRef.current.signal,
      );

      applyActions(result.actions ?? []);

      const assistantMsg: ChatMessage = {
        id: `a_${Date.now()}`,
        role: 'assistant',
        content: result.message,
        toolUse: result.toolUse,
        actions: result.actions,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev.filter((m) => m.id !== 'loading'), assistantMsg]);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      const errorMsg: ChatMessage = {
        id: `e_${Date.now()}`,
        role: 'assistant',
        content: `⚠ ${t('AI_ERROR')}：${err instanceof Error ? err.message : t('UNKNOWN_ERROR')}\n\n${t('AI_ERROR_HINT')}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev.filter((m) => m.id !== 'loading'), errorMsg]);
    } finally {
      setIsLoading(false);
      abortRef.current = null;
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, isLoading, messages, customSectors, stockWatchlist, applyActions, t]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = (s: string) => {
    setInput(s);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleClear = () => {
    setMessages([]);
    setInput('');
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-full flex-col bg-black font-mono">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between px-3 py-1.5 bg-[#0a0a0a] border-b border-terminal-border">
        <div className="flex items-center gap-2">
          <Bot size={14} className="text-terminal-accent" />
          <span className="text-terminal-accent font-bold text-xs tracking-widest uppercase">
            {t('AI_ASSISTANT')}
          </span>
          <span className="text-[9px] text-gray-600 ml-1 flex items-center gap-1">
            <BrainCircuit size={9} />
            {t('AI_POWERED_BY')}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Claude Code integration badge */}
          <div className="flex items-center gap-1.5 text-[9px] text-gray-500 border border-[#222] px-2 py-0.5">
            <Sparkles size={9} className="text-terminal-accent/60" />
            {t('AI_CLAUDE_CODE_COMING' as any)}
          </div>
          {messages.length > 0 && (
            <button
              onClick={handleClear}
              className="flex items-center gap-1 text-[9px] text-gray-600 hover:text-gray-300 px-1.5 py-0.5 border border-[#222] hover:border-[#444]"
              title={t('AI_CLEAR_TITLE')}
            >
              <Trash2 size={9} />
              {t('AI_CLEAR')}
            </button>
          )}
        </div>
      </div>

      {/* ── Messages area ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-3 space-y-3 min-h-0">
        {isEmpty && (
          <div className="h-full flex flex-col items-center justify-center gap-5 text-center">
            <div className="w-14 h-14 border border-terminal-accent/30 rounded-sm flex items-center justify-center bg-terminal-accent/5">
              <Bot size={28} className="text-terminal-accent/60" />
            </div>
            <div>
              <div className="text-terminal-accent text-sm font-bold tracking-widest mb-1">
                {t('AI_MARKET_ASSISTANT')}
              </div>
              <div className="text-gray-600 text-[11px] max-w-sm">
                {t('AI_DESCRIPTION')}
              </div>
            </div>

            {/* Capabilities overview */}
            <div className="grid grid-cols-3 gap-3 mt-2 max-w-md w-full">
              <div className="border border-[#222] bg-[#0a0a0a] p-3 text-center">
                <Search size={16} className="text-terminal-accent/60 mx-auto mb-1.5" />
                <div className="text-[10px] text-gray-400 font-bold uppercase">{t('AI_CAP_RESEARCH' as any)}</div>
                <div className="text-[9px] text-gray-600 mt-1">{t('AI_CAP_RESEARCH_DESC' as any)}</div>
              </div>
              <div className="border border-[#222] bg-[#0a0a0a] p-3 text-center">
                <TrendingUp size={16} className="text-terminal-accent/60 mx-auto mb-1.5" />
                <div className="text-[10px] text-gray-400 font-bold uppercase">{t('AI_CAP_ANALYSIS' as any)}</div>
                <div className="text-[9px] text-gray-600 mt-1">{t('AI_CAP_ANALYSIS_DESC' as any)}</div>
              </div>
              <div className="border border-[#222] bg-[#0a0a0a] p-3 text-center">
                <Database size={16} className="text-terminal-accent/60 mx-auto mb-1.5" />
                <div className="text-[10px] text-gray-400 font-bold uppercase">{t('AI_CAP_MANAGE' as any)}</div>
                <div className="text-[9px] text-gray-600 mt-1">{t('AI_CAP_MANAGE_DESC' as any)}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 mt-2 max-w-md w-full">
              {getSuggestions(t).map((s) => (
                <button
                  key={s}
                  onClick={() => handleSuggestion(s)}
                  className="text-[10px] text-gray-400 border border-[#222] hover:border-terminal-accent/40 hover:text-terminal-accent px-3 py-2 text-left flex items-center gap-1.5 transition-colors"
                >
                  <Zap size={9} className="text-terminal-accent/60 shrink-0" />
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {!isEmpty &&
          messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} t={t} />
          ))}

        <div ref={bottomRef} />
      </div>

      {/* ── Input area ──────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-terminal-border bg-[#0a0a0a] px-3 py-2">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder={t('AI_INPUT_PLACEHOLDER')}
            className="flex-1 bg-[#111] border border-[#333] focus:border-terminal-accent/60 outline-none resize-none text-[11px] font-mono text-gray-200 placeholder-gray-700 px-2 py-1.5 min-h-[36px] max-h-[120px] custom-scrollbar"
            rows={1}
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="px-3 py-1.5 bg-terminal-accent text-black font-bold text-[10px] hover:bg-yellow-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0"
          >
            {isLoading ? <Loader size={11} className="animate-spin" /> : <Send size={11} />}
            {isLoading ? t('AI_PROCESSING') : t('AI_SEND')}
          </button>
        </div>
        <div className="mt-1 text-[9px] text-gray-700">
          {t('AI_HINT')}
        </div>
      </div>

    </div>
  );
};
