import { useCallback, useEffect, useRef, useState } from 'react';
import { usePersisted } from './usePersisted';
import type { StrategyFile } from '../types';
import type { Notification } from '../types';
import * as strategyApi from '../services/strategy/strategyFileService';
import type { FileEntry } from '../services/strategy/strategyFileService';

type ShowNotification = (type: Notification['type'], message: string) => void;

const DEFAULT_FILES: StrategyFile[] = [];

/** Map file extension to Monaco language id. */
function extToLang(name: string): string {
  const ext = name.split('.').pop() ?? '';
  if (ext === 'py') return 'python';
  if (ext === 'json') return 'json';
  if (ext === 'js' || ext === 'ts') return 'javascript';
  if (ext === 'md') return 'markdown';
  return 'plaintext';
}

/**
 * Flatten a nested FileEntry tree into a flat StrategyFile list by loading
 * each file's content from the backend.
 */
async function loadFilesFromEntries(entries: FileEntry[]): Promise<StrategyFile[]> {
  const result: StrategyFile[] = [];

  async function walk(nodes: FileEntry[]) {
    for (const n of nodes) {
      if (n.type === 'file') {
        try {
          const { content } = await strategyApi.readFile(n.path);
          result.push({ name: n.path, language: extToLang(n.name), content });
        } catch {
          // skip unreadable files
        }
      }
      if (n.children) await walk(n.children);
    }
  }

  await walk(entries);
  return result;
}

export function useStrategyFiles(showNotification: ShowNotification) {
  // Keep localStorage as a fallback cache & offline store
  const [strategyFiles, setStrategyFiles] = usePersisted<StrategyFile[]>(
    'strategyFiles',
    DEFAULT_FILES,
  );
  const [activeFileName, setActiveFileName] = usePersisted<string>('activeFileName', '');
  const [fileTree, setFileTree] = useState<FileEntry[]>([]);
  const [backendOnline, setBackendOnline] = useState(false);
  const loadedRef = useRef(false);

  // On mount, try to load files from backend
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    (async () => {
      try {
        const { entries } = await strategyApi.listFiles();
        setFileTree(entries);
        const files = await loadFilesFromEntries(entries);
        if (files.length > 0) {
          setStrategyFiles(files);
          if (!files.some((f) => f.name === activeFileName) && files[0]) {
            setActiveFileName(files[0].name);
          }
        }
        setBackendOnline(true);
      } catch {
        setBackendOnline(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Refresh the file tree from the backend. */
  const refreshFileTree = useCallback(async () => {
    try {
      const { entries } = await strategyApi.listFiles();
      setFileTree(entries);
      const files = await loadFilesFromEntries(entries);
      if (files.length > 0) setStrategyFiles(files);
      setBackendOnline(true);
    } catch {
      setBackendOnline(false);
    }
  }, [setStrategyFiles]);

  const handleStrategyFileUpdate = useCallback(
    (fileName: string, newContent: string) => {
      setStrategyFiles((prev) =>
        prev.map((f) => (f.name === fileName ? { ...f, content: newContent } : f)),
      );
      // Persist to backend (fire-and-forget)
      if (backendOnline) {
        strategyApi.updateFile(fileName, newContent).catch(() => {});
      }
    },
    [setStrategyFiles, backendOnline],
  );

  const handleCreateFile = useCallback(
    async (fileName: string) => {
      if (strategyFiles.some((f) => f.name === fileName)) {
        showNotification('ERROR', 'FILE ALREADY EXISTS');
        return;
      }

      const lang = extToLang(fileName);

      if (backendOnline) {
        try {
          await strategyApi.createFile(fileName);
          showNotification('SUCCESS', `CREATED ${fileName}`);
        } catch (err: any) {
          showNotification('ERROR', err.message ?? 'CREATE FAILED');
          return;
        }
      }

      setStrategyFiles((prev) => [...prev, { name: fileName, content: '', language: lang }]);
      setActiveFileName(fileName);
      if (!backendOnline) showNotification('SUCCESS', `CREATED ${fileName}`);
    },
    [strategyFiles, setStrategyFiles, setActiveFileName, showNotification, backendOnline],
  );

  const handleDeleteFile = useCallback(
    async (fileName: string) => {
      if (backendOnline) {
        try {
          await strategyApi.deleteFile(fileName);
        } catch {
          // continue with local deletion even if backend fails
        }
      }
      setStrategyFiles((prev) => {
        const remaining = prev.filter((f) => f.name !== fileName);
        setActiveFileName(remaining[0]?.name ?? '');
        return remaining;
      });
      showNotification('INFO', `DELETED ${fileName}`);
    },
    [setStrategyFiles, setActiveFileName, showNotification, backendOnline],
  );

  const handleRenameFile = useCallback(
    async (oldName: string, newName: string) => {
      if (strategyFiles.some((f) => f.name === newName)) {
        showNotification('ERROR', 'FILE ALREADY EXISTS');
        return;
      }
      if (backendOnline) {
        try {
          await strategyApi.renameFile(oldName, newName);
        } catch (err: any) {
          showNotification('ERROR', err.message ?? 'RENAME FAILED');
          return;
        }
      }
      setStrategyFiles((prev) =>
        prev.map((f) =>
          f.name === oldName
            ? { ...f, name: newName, language: extToLang(newName) }
            : f,
        ),
      );
      if (activeFileName === oldName) setActiveFileName(newName);
      showNotification('SUCCESS', `RENAMED → ${newName}`);
    },
    [strategyFiles, setStrategyFiles, activeFileName, setActiveFileName, showNotification, backendOnline],
  );

  return {
    strategyFiles,
    activeFileName,
    setActiveFileName,
    handleStrategyFileUpdate,
    handleCreateFile,
    handleDeleteFile,
    handleRenameFile,
    fileTree,
    backendOnline,
    refreshFileTree,
  };
}
