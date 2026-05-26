import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, ExternalLink } from 'lucide-react';
import type { NewsItem } from '../types';
import { Panel } from '../components/ui/Panel';
import { fetchMarketNews } from '../services/ai/geminiService';

interface NewsViewProps {}

export const NewsView = (_props: NewsViewProps) => {
  const { t } = useTranslation();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isNewsLoading, setIsNewsLoading] = useState(false);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);

  const refreshNews = async () => {
    setIsNewsLoading(true);
    try {
      const { items } = await fetchMarketNews();
      if (items.length > 0) setNews(items);
    } catch {
      // silently fail — no notification context here
    } finally {
      setIsNewsLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-12 h-full gap-1">
      <Panel title={t('PNL_NEWS')} className="col-span-4 h-full" onRefresh={refreshNews}>
        <div className="p-1 space-y-1">
          {news.map((n) => (
            <div
              key={n.id}
              className={`p-2 border border-[#333] hover:bg-[#222] cursor-pointer transition-colors ${selectedNews?.id === n.id ? 'bg-[#222] border-terminal-accent' : ''}`}
              onClick={() => setSelectedNews(n)}
            >
              <div className="flex justify-between text-[9px] text-gray-500 mb-1">
                <span>{n.time}</span>
                <span className="text-terminal-accent">{n.source}</span>
              </div>
              <div className="text-white text-xs leading-snug line-clamp-2">{n.headline}</div>
            </div>
          ))}
          {news.length === 0 && !isNewsLoading && (
            <div className="text-center py-10 text-gray-500">
              <p>{t('NO_NEWS_LOADED')}</p>
              <button onClick={refreshNews} className="mt-2 text-terminal-accent underline">{t('REFRESH_FEED')}</button>
            </div>
          )}
          {isNewsLoading && (
            <div className="flex justify-center py-10 text-terminal-accent">
              <Loader2 className="animate-spin" />
            </div>
          )}
        </div>
      </Panel>

      <Panel title={t('READER')} className="col-span-8 h-full bg-[#111]">
        {selectedNews ? (
          <div className="p-8 max-w-2xl mx-auto">
            <div className="text-2xl font-bold mb-4 font-sans">{selectedNews.headline}</div>
            <div className="flex items-center space-x-4 text-xs text-gray-400 mb-8 border-b border-[#333] pb-4">
              <span>{selectedNews.time}</span>
              <span>•</span>
              <span className="text-terminal-accent uppercase">{selectedNews.source}</span>
              <span>•</span>
              <span className={selectedNews.sentiment === 'POSITIVE' ? 'text-green-500' : 'text-red-500'}>{selectedNews.sentiment}</span>
            </div>
            <div className="text-gray-300 leading-relaxed font-serif text-lg">
              <p>
                (Summary) This article discusses market movements affecting{' '}
                {selectedNews.relatedSymbols?.join(', ') || 'general markets'}.
                Analysts suggest monitoring key levels.
              </p>
              <br />
              <p className="text-gray-500 italic">
                *Full content not available in terminal preview.
                {selectedNews.url && (
                  <a href={selectedNews.url} target="_blank" rel="noreferrer" className="text-terminal-accent ml-2 hover:underline inline-flex items-center gap-1">
                    READ ORIGINAL <ExternalLink size={12} />
                  </a>
                )}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-gray-600">
            {t('SELECT_ARTICLE')}
          </div>
        )}
      </Panel>
    </div>
  );
};
