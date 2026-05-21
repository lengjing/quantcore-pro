import { useState } from 'react';
import type { StrategyFile } from '../types';
import type { Notification } from '../types';

type ShowNotification = (type: Notification['type'], message: string) => void;

export function useStrategyFiles(showNotification: ShowNotification) {
  const [strategyFiles, setStrategyFiles] = useState<StrategyFile[]>([]);
  const [activeFileName, setActiveFileName] = useState('');

  const handleStrategyFileUpdate = (fileName: string, newContent: string) => {
    setStrategyFiles((prev) =>
      prev.map((f) => (f.name === fileName ? { ...f, content: newContent } : f)),
    );
  };

  const handleCreateFile = (fileName: string) => {
    if (strategyFiles.some((f) => f.name === fileName)) {
      showNotification('ERROR', 'FILE ALREADY EXISTS');
      return;
    }
    const ext = fileName.split('.').pop() ?? '';
    let lang = 'plaintext';
    if (ext === 'py') lang = 'python';
    else if (ext === 'json') lang = 'json';
    else if (ext === 'js') lang = 'javascript';
    else if (ext === 'md') lang = 'markdown';

    setStrategyFiles((prev) => [...prev, { name: fileName, content: '', language: lang }]);
    setActiveFileName(fileName);
    showNotification('SUCCESS', `CREATED ${fileName}`);
  };

  const handleDeleteFile = (fileName: string) => {
    setStrategyFiles((prev) => {
      const remaining = prev.filter((f) => f.name !== fileName);
      if (activeFileName === fileName) {
        setActiveFileName(remaining[0]?.name ?? '');
      }
      return remaining;
    });
    showNotification('INFO', `DELETED ${fileName}`);
  };

  return {
    strategyFiles,
    activeFileName,
    setActiveFileName,
    handleStrategyFileUpdate,
    handleCreateFile,
    handleDeleteFile,
  };
}
