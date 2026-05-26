import { useState, useEffect, useCallback, useRef } from 'react';
import sectorBoardService from '../services/stock/sectorBoardService';
import type { BoardItem, BoardStock, BoardCategory } from '../services/stock/sectorBoardService';
import type { BoardSnapshot } from '../components/BoardCharts';

const BOARD_POLL_MS = 30_000; // refresh every 30s
const SNAPSHOT_INTERVAL_MS = 30_000; // snapshot every 30s (matches poll)
const MAX_SNAPSHOTS = 24;
const MAX_BOARD_STOCKS = 50;

export function useSectorBoards() {
  const [category, setCategory] = useState<BoardCategory>('concept');
  const [boards, setBoards] = useState<BoardItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Snapshots for line chart history
  const [snapshots, setSnapshots] = useState<BoardSnapshot[]>([]);
  const lastSnapshotRef = useRef<number>(0);

  // Board detail drill-down
  const [selectedBoard, setSelectedBoard] = useState<BoardItem | null>(null);
  const [boardStocks, setBoardStocks] = useState<BoardStock[]>([]);
  const [isBoardStocksLoading, setIsBoardStocksLoading] = useState(false);

  const mountedRef = useRef(true);

  const boardsRef = useRef<BoardItem[]>([]);

  // Fetch board list
  const fetchBoards = useCallback(async (cat: BoardCategory = category) => {
    setIsLoading(true);
    try {
      const result = await sectorBoardService.fetchBoards(cat, 1, 200);
      if (mountedRef.current) {
        setBoards(result.boards);
        boardsRef.current = result.boards;
        setTotal(result.total);

        // Push snapshot for line chart history
        const now = Date.now();
        if (now - lastSnapshotRef.current >= SNAPSHOT_INTERVAL_MS && result.boards.length > 0) {
          lastSnapshotRef.current = now;
          setSnapshots((prev) => {
            const next = [...prev, { ts: now, boards: result.boards }];
            return next.slice(-MAX_SNAPSHOTS);
          });
        }
      }
    } catch (e) {
      console.error('useSectorBoards fetchBoards:', e);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [category]);

  // Fetch stocks in a board
  const fetchBoardStocks = useCallback(async (boardCode: string) => {
    setIsBoardStocksLoading(true);
    try {
      const result = await sectorBoardService.fetchBoardStocks(boardCode, 1, MAX_BOARD_STOCKS);
      if (mountedRef.current) {
        setBoardStocks(result.stocks);
      }
    } catch (e) {
      console.error('useSectorBoards fetchBoardStocks:', e);
    } finally {
      if (mountedRef.current) setIsBoardStocksLoading(false);
    }
  }, []);

  // Select a board for detail view (by BoardItem or by code string)
  const selectBoard = useCallback((boardOrCode: BoardItem | string | null) => {
    if (boardOrCode === null) {
      setSelectedBoard(null);
      setBoardStocks([]);
      return;
    }
    if (typeof boardOrCode === 'string') {
      const found = boardsRef.current.find((b) => b.code === boardOrCode) ?? null;
      setSelectedBoard(found);
      if (found) fetchBoardStocks(found.code);
      else setBoardStocks([]);
    } else {
      setSelectedBoard(boardOrCode);
      fetchBoardStocks(boardOrCode.code);
    }
  }, [fetchBoardStocks]);

  // Switch category
  const switchCategory = useCallback((cat: BoardCategory) => {
    setCategory(cat);
    setSelectedBoard(null);
    setBoardStocks([]);
    setSnapshots([]);
    lastSnapshotRef.current = 0;
    fetchBoards(cat);
  }, [fetchBoards]);

  // Initial load + polling
  useEffect(() => {
    mountedRef.current = true;
    fetchBoards();
    const interval = setInterval(() => fetchBoards(), BOARD_POLL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [category, fetchBoards]);

  // Refresh board stocks when selected board changes
  useEffect(() => {
    if (!selectedBoard) return;
    const interval = setInterval(() => fetchBoardStocks(selectedBoard.code), BOARD_POLL_MS);
    return () => clearInterval(interval);
  }, [selectedBoard, fetchBoardStocks]);

  return {
    category,
    switchCategory,
    boards,
    total,
    isLoading,
    snapshots,
    selectedBoard,
    selectBoard,
    boardStocks,
    isBoardStocksLoading,
    refreshBoards: fetchBoards,
  };
}
