import { useState, useEffect, useCallback, useRef } from 'react';
import sectorBoardService from '../services/stock/sectorBoardService';
import type { BoardItem, BoardStock, BoardCategory } from '../services/stock/sectorBoardService';

const BOARD_POLL_MS = 30_000; // refresh every 30s

export function useSectorBoards() {
  const [category, setCategory] = useState<BoardCategory>('concept');
  const [boards, setBoards] = useState<BoardItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Board detail drill-down
  const [selectedBoard, setSelectedBoard] = useState<BoardItem | null>(null);
  const [boardStocks, setBoardStocks] = useState<BoardStock[]>([]);
  const [isBoardStocksLoading, setIsBoardStocksLoading] = useState(false);

  const mountedRef = useRef(true);

  // Fetch board list
  const fetchBoards = useCallback(async (cat: BoardCategory = category) => {
    setIsLoading(true);
    try {
      const result = await sectorBoardService.fetchBoards(cat, 1, 80);
      if (mountedRef.current) {
        setBoards(result.boards);
        setTotal(result.total);
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
      const result = await sectorBoardService.fetchBoardStocks(boardCode, 1, 30);
      if (mountedRef.current) {
        setBoardStocks(result.stocks);
      }
    } catch (e) {
      console.error('useSectorBoards fetchBoardStocks:', e);
    } finally {
      if (mountedRef.current) setIsBoardStocksLoading(false);
    }
  }, []);

  // Select a board for detail view
  const selectBoard = useCallback((board: BoardItem | null) => {
    setSelectedBoard(board);
    if (board) {
      fetchBoardStocks(board.code);
    } else {
      setBoardStocks([]);
    }
  }, [fetchBoardStocks]);

  // Switch category
  const switchCategory = useCallback((cat: BoardCategory) => {
    setCategory(cat);
    setSelectedBoard(null);
    setBoardStocks([]);
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
    selectedBoard,
    selectBoard,
    boardStocks,
    isBoardStocksLoading,
    refreshBoards: fetchBoards,
  };
}
