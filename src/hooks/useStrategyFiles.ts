import { useCallback } from 'react';
import { usePersisted } from './usePersisted';
import type { StrategyFile } from '../types';
import type { Notification } from '../types';

type ShowNotification = (type: Notification['type'], message: string) => void;

const DEFAULT_FILES: StrategyFile[] = [];

export function useStrategyFiles(showNotification: ShowNotification) {
  const [strategyFiles, setStrategyFiles] = usePersisted<StrategyFile[]>(
    'strategyFiles',
    DEFAULT_FILES,
  );
  const [activeFileName, setActiveFileName] = usePersisted<string>('activeFileName', '');

  const handleStrategyFileUpdate = useCallback(
    (fileName: string, newContent: string) => {
      setStrategyFiles((prev) =>
        prev.map((f) => (f.name === fileName ? { ...f, content: newContent } : f)),
      );
    },
    [setStrategyFiles],
  );

  const handleCreateFile = useCallback(
    (fileName: string) => {
      setStrategyFiles((prev) => {
        if (prev.some((f) => f.name === fileName)) {
          showNotification('ERROR', 'FILE ALREADY EXISTS');
          return prev;
        }
        const ext = fileName.split('.').pop() ?? '';
        let lang = 'plaintext';
        if (ext === 'py') lang = 'python';
        else if (ext === 'json') lang = 'json';
        else if (ext === 'js') lang = 'javascript';
        else if (ext === 'md') lang = 'markdown';
        showNotification('SUCCESS', `CREATED ${fileName}`);
        setActiveFileName(fileName);
        return [...prev, { name: fileName, content: '', language: lang }];
      });
    },
    [setStrategyFiles, setActiveFileName, showNotification],
  );

  const handleDeleteFile = useCallback(
    (fileName: string) => {
      setStrategyFiles((prev) => {
        const remaining = prev.filter((f) => f.name !== fileName);
        setActiveFileName(remaining[0]?.name ?? '');
        return remaining;
      });
      showNotification('INFO', `DELETED ${fileName}`);
    },
    [setStrategyFiles, setActiveFileName, showNotification],
  );

  return {
    strategyFiles,
    activeFileName,
    setActiveFileName,
    handleStrategyFileUpdate,
    handleCreateFile,
    handleDeleteFile,
  };
}
