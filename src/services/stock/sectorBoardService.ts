/**
 * Sector Board Service (概念/行业板块)
 *
 * Fetches real-time concept and industry board data from East Money's public API.
 * This is a FREE, browser-compatible API that provides:
 *   - Concept boards (概念板块): m:90+t:3
 *   - Industry boards (行业板块): m:90+t:2
 *   - Board component stocks
 *
 * Like broker apps (券商APP), boards are pre-configured by the API — no manual
 * setup needed. Users can also create custom boards via the existing custom
 * sector feature.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

/** A single board item returned by the EastMoney board list API. */
export interface BoardItem {
  /** Board code, e.g. "BK0493" */
  code: string;
  /** Board name (Chinese), e.g. "人工智能" */
  name: string;
  /** Current index value / average price */
  price: number;
  /** Change percent (%) */
  changePercent: number;
  /** Change amount */
  change: number;
  /** Turnover rate (%) */
  turnoverRate: number;
  /** Total market cap (CNY) */
  totalMarketCap: number;
  /** Number of advancing stocks */
  advancing: number;
  /** Number of declining stocks */
  declining: number;
  /** Main net inflow (主力净流入, CNY) */
  mainNetInflow: number;
  /** Leader stock name */
  leaderName: string;
  /** Leader stock change% */
  leaderChangePercent: number;
}

/** Category of board. */
export type BoardCategory = 'concept' | 'industry';

/** A stock within a board. */
export interface BoardStock {
  /** Symbol in sh/sz prefix format, e.g. "sh600519" */
  symbol: string;
  /** Stock name */
  name: string;
  /** Current price */
  price: number;
  /** Change percent (%) */
  changePercent: number;
  /** Change amount */
  change: number;
  /** Volume (lots) */
  volume: number;
  /** Turnover rate (%) */
  turnoverRate: number;
  /** Total market cap */
  totalMarketCap: number;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const PUSH2_BASE = 'https://push2.eastmoney.com';

/**
 * EastMoney filter strings for board categories.
 * m:90 = board market, t:3 = concept, t:2 = industry
 */
const CATEGORY_FILTER: Record<BoardCategory, string> = {
  concept: 'm:90+t:3',
  industry: 'm:90+t:2',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function toSymbol(code: string, market: number): string {
  return market === 1 ? `sh${code}` : `sz${code}`;
}

function fmtNum(v: unknown): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

// ── Service ────────────────────────────────────────────────────────────────────

class SectorBoardService {
  /**
   * Fetch the list of sector boards for a given category.
   *
   * @param category 'concept' or 'industry'
   * @param page     Page number (1-based)
   * @param pageSize Number of boards per page
   * @param sortField Sort field: 'changePercent' | 'turnoverRate' | 'mainNetInflow'
   * @param sortOrder 1 = descending, 0 = ascending
   */
  async fetchBoards(
    category: BoardCategory = 'concept',
    page: number = 1,
    pageSize: number = 50,
    sortField: string = 'f3',
    sortOrder: number = 1,
  ): Promise<{ boards: BoardItem[]; total: number }> {
    const fs = CATEGORY_FILTER[category];
    const fields = 'f1,f2,f3,f4,f5,f6,f7,f8,f12,f14,f15,f16,f17,f18,f20,f21,f24,f25,f62,f104,f105,f128,f136,f140,f141';

    try {
      const url =
        `${PUSH2_BASE}/api/qt/clist/get` +
        `?pn=${page}&pz=${pageSize}&po=${sortOrder}&np=1&fltt=2&invt=2` +
        `&fs=${encodeURIComponent(fs)}&fields=${fields}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const json = await response.json();
      const total = json?.data?.total ?? 0;
      const diffList: any[] = json?.data?.diff ?? [];

      const boards: BoardItem[] = diffList.map((item) => ({
        code: String(item.f12 ?? ''),
        name: String(item.f14 ?? ''),
        price: fmtNum(item.f2),
        changePercent: fmtNum(item.f3),
        change: fmtNum(item.f4),
        turnoverRate: fmtNum(item.f8),
        totalMarketCap: fmtNum(item.f20),
        advancing: fmtNum(item.f104),
        declining: fmtNum(item.f105),
        mainNetInflow: fmtNum(item.f62),
        leaderName: String(item.f140 ?? item.f128 ?? ''),
        leaderChangePercent: fmtNum(item.f136),
      }));

      return { boards, total };
    } catch (error) {
      console.error(`SectorBoardService fetchBoards error (${category}):`, error);
      return { boards: [], total: 0 };
    }
  }

  /**
   * Fetch component stocks of a specific board.
   *
   * @param boardCode Board code, e.g. "BK0493"
   * @param page      Page number (1-based)
   * @param pageSize  Number of stocks per page
   */
  async fetchBoardStocks(
    boardCode: string,
    page: number = 1,
    pageSize: number = 50,
  ): Promise<{ stocks: BoardStock[]; total: number }> {
    const fields = 'f1,f2,f3,f4,f5,f6,f7,f8,f12,f13,f14,f15,f16,f17,f18,f20';

    try {
      const url =
        `${PUSH2_BASE}/api/qt/clist/get` +
        `?pn=${page}&pz=${pageSize}&po=1&np=1&fltt=2&invt=2` +
        `&fs=b:${encodeURIComponent(boardCode)}&fields=${fields}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const json = await response.json();
      const total = json?.data?.total ?? 0;
      const diffList: any[] = json?.data?.diff ?? [];

      const stocks: BoardStock[] = diffList.map((item) => ({
        symbol: toSymbol(String(item.f12 ?? ''), fmtNum(item.f13)),
        name: String(item.f14 ?? ''),
        price: fmtNum(item.f2),
        changePercent: fmtNum(item.f3),
        change: fmtNum(item.f4),
        volume: fmtNum(item.f5),
        turnoverRate: fmtNum(item.f8),
        totalMarketCap: fmtNum(item.f20),
      }));

      return { stocks, total };
    } catch (error) {
      console.error(`SectorBoardService fetchBoardStocks error (${boardCode}):`, error);
      return { stocks: [], total: 0 };
    }
  }
}

// Singleton
const sectorBoardService = new SectorBoardService();
export default sectorBoardService;
