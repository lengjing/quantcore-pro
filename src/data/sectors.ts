import type { MarketTicker } from '../types';

// ── Interfaces ──────────────────────────────────────────────────────────────────

export interface SectorDef {
  id: string;
  /** Display name (Chinese for CN_STOCK, English for CRYPTO) */
  name: string;
  nameEn: string;
  color: string;
  symbols: string[];
}

export interface SectorStats {
  def: SectorDef;
  components: MarketTicker[];
  avgChange: number;
  totalVolume: number;
  advancing: number;
  declining: number;
}

export interface SectorSnapshot {
  ts: number;
  sectorStats: SectorStats[];
}

// ── Color palette ───────────────────────────────────────────────────────────────

export const SECTOR_PALETTE = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
  '#ec4899', // pink
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#a855f7', // purple
];

// ── Crypto sectors ──────────────────────────────────────────────────────────────

export const CRYPTO_SECTORS: SectorDef[] = [
  {
    id: 'layer1',
    name: 'Layer 1',
    nameEn: 'Layer 1',
    color: SECTOR_PALETTE[0],
    symbols: [
      'BTC-USDT', 'ETH-USDT', 'BNB-USDT', 'SOL-USDT', 'ADA-USDT',
      'AVAX-USDT', 'DOT-USDT', 'ATOM-USDT', 'NEAR-USDT', 'TRX-USDT',
      'APT-USDT', 'SUI-USDT', 'TON-USDT',
    ],
  },
  {
    id: 'defi',
    name: 'DeFi',
    nameEn: 'DeFi',
    color: SECTOR_PALETTE[1],
    symbols: [
      'UNI-USDT', 'AAVE-USDT', 'COMP-USDT', 'MKR-USDT', 'CRV-USDT',
      'SUSHI-USDT', 'YFI-USDT', '1INCH-USDT', 'SNX-USDT', 'GMX-USDT',
      'JUP-USDT', 'PENDLE-USDT', 'LDO-USDT',
    ],
  },
  {
    id: 'layer2',
    name: 'Layer 2',
    nameEn: 'Layer 2',
    color: SECTOR_PALETTE[2],
    symbols: [
      'MATIC-USDT', 'ARB-USDT', 'OP-USDT', 'IMX-USDT', 'STRK-USDT',
      'LRC-USDT', 'ZK-USDT', 'METIS-USDT', 'MANTA-USDT', 'BLAST-USDT',
    ],
  },
  {
    id: 'ai_data',
    name: 'AI & Data',
    nameEn: 'AI & Data',
    color: SECTOR_PALETTE[3],
    symbols: [
      'FET-USDT', 'RNDR-USDT', 'TAO-USDT', 'GRT-USDT', 'OCEAN-USDT',
      'LPT-USDT', 'AGIX-USDT', 'WLD-USDT', 'NMR-USDT', 'IO-USDT',
      'ARKM-USDT',
    ],
  },
  {
    id: 'gaming_nft',
    name: 'Gaming / NFT',
    nameEn: 'Gaming / NFT',
    color: SECTOR_PALETTE[4],
    symbols: [
      'AXS-USDT', 'SAND-USDT', 'MANA-USDT', 'ENJ-USDT', 'GALA-USDT',
      'FLOW-USDT', 'CHZ-USDT', 'RON-USDT', 'PIXEL-USDT', 'BEAM-USDT',
    ],
  },
  {
    id: 'exchange',
    name: 'Exchange',
    nameEn: 'Exchange',
    color: SECTOR_PALETTE[5],
    symbols: [
      'BNB-USDT', 'OKB-USDT', 'CRO-USDT', 'GT-USDT', 'HT-USDT',
      'DYDX-USDT', 'KCS-USDT',
    ],
  },
  {
    id: 'privacy',
    name: 'Privacy',
    nameEn: 'Privacy',
    color: SECTOR_PALETTE[6],
    symbols: ['XMR-USDT', 'ZEC-USDT', 'DASH-USDT', 'SCRT-USDT', 'ROSE-USDT'],
  },
  {
    id: 'meme',
    name: 'Meme',
    nameEn: 'Meme',
    color: SECTOR_PALETTE[7],
    symbols: [
      'DOGE-USDT', 'SHIB-USDT', 'PEPE-USDT', 'FLOKI-USDT', 'BONK-USDT',
      'WIF-USDT', 'BOME-USDT', 'NOT-USDT', 'NEIRO-USDT',
    ],
  },
  {
    id: 'infra',
    name: 'Infrastructure',
    nameEn: 'Infrastructure',
    color: SECTOR_PALETTE[8],
    symbols: [
      'LINK-USDT', 'BAND-USDT', 'API3-USDT', 'TIA-USDT', 'INJ-USDT',
      'SEI-USDT', 'PYTH-USDT', 'JTO-USDT', 'ENA-USDT',
    ],
  },
  {
    id: 'payments',
    name: 'Payments',
    nameEn: 'Payments',
    color: SECTOR_PALETTE[9],
    symbols: [
      'XRP-USDT', 'XLM-USDT', 'LTC-USDT', 'BCH-USDT', 'TRX-USDT',
      'ALGO-USDT', 'XDC-USDT', 'HBAR-USDT',
    ],
  },
];

// ── A-share sectors ─────────────────────────────────────────────────────────────

export const CN_SECTORS: SectorDef[] = [
  {
    id: 'bank',
    name: '银行',
    nameEn: 'Banks',
    color: SECTOR_PALETTE[0],
    symbols: [
      'sh601398', 'sh601939', 'sh600036', 'sh601328', 'sh600016',
      'sh600000', 'sh601288', 'sh601818', 'sh601166', 'sh601009',
    ],
  },
  {
    id: 'insurance',
    name: '保险',
    nameEn: 'Insurance',
    color: SECTOR_PALETTE[1],
    symbols: ['sh601318', 'sh601601', 'sh601336', 'sh601319', 'sh601628'],
  },
  {
    id: 'securities',
    name: '证券',
    nameEn: 'Securities',
    color: SECTOR_PALETTE[2],
    symbols: [
      'sh600030', 'sh601688', 'sz000776', 'sh601211', 'sh601878',
      'sz002736', 'sh601066', 'sh600999', 'sh601198',
    ],
  },
  {
    id: 'semiconductor',
    name: '半导体',
    nameEn: 'Semiconductor',
    color: SECTOR_PALETTE[3],
    symbols: [
      'sh688981', 'sh688256', 'sh688012', 'sz002415', 'sh688041',
      'sz300454', 'sh688099', 'sz002049', 'sh688111', 'sh688008',
    ],
  },
  {
    id: 'software',
    name: '软件/互联网',
    nameEn: 'Software/Internet',
    color: SECTOR_PALETTE[4],
    symbols: [
      'sz002230', 'sz300033', 'sh600745', 'sh688588', 'sz002400',
      'sh600570', 'sz300136', 'sz300274',
    ],
  },
  {
    id: 'consumer',
    name: '消费',
    nameEn: 'Consumer',
    color: SECTOR_PALETTE[5],
    symbols: [
      'sh600519', 'sh600887', 'sz000858', 'sh601888', 'sh603288',
      'sh600132', 'sz002304', 'sh600606', 'sz000568',
    ],
  },
  {
    id: 'pharma',
    name: '医药生物',
    nameEn: 'Pharma & Biotech',
    color: SECTOR_PALETTE[6],
    symbols: [
      'sh600276', 'sz300760', 'sz300015', 'sz300347', 'sh688180',
      'sz000661', 'sh600196', 'sz300776', 'sh688363',
    ],
  },
  {
    id: 'energy',
    name: '能源',
    nameEn: 'Energy',
    color: SECTOR_PALETTE[7],
    symbols: [
      'sh601857', 'sh600028', 'sh601985', 'sh601088', 'sh601225',
      'sh600938', 'sh601898',
    ],
  },
  {
    id: 'realestate',
    name: '地产',
    nameEn: 'Real Estate',
    color: SECTOR_PALETTE[8],
    symbols: [
      'sh600048', 'sz000002', 'sh601155', 'sz001979', 'sh600466',
      'sz000069', 'sh600606',
    ],
  },
  {
    id: 'materials',
    name: '材料',
    nameEn: 'Materials',
    color: SECTOR_PALETTE[9],
    symbols: [
      'sh600019', 'sh601899', 'sh600585', 'sh601600', 'sh603993',
      'sh600809', 'sh600547',
    ],
  },
  {
    id: 'auto_ev',
    name: '汽车/新能源',
    nameEn: 'Auto & New Energy',
    color: SECTOR_PALETTE[10],
    symbols: [
      'sz002594', 'sh600104', 'sh601238', 'sz300750', 'sz002460',
      'sz002271', 'sh601127',
    ],
  },
  {
    id: 'defense',
    name: '军工',
    nameEn: 'Defense',
    color: SECTOR_PALETTE[11],
    symbols: [
      'sh600760', 'sh600316', 'sh601989', 'sh600118', 'sh600893',
      'sh600190', 'sh600372',
    ],
  },
];

// ── Helper ──────────────────────────────────────────────────────────────────────

export function computeSectorStats(
  tickers: MarketTicker[],
  sectors: SectorDef[],
): SectorStats[] {
  const tickerMap = new Map<string, MarketTicker>(tickers.map((t) => [t.symbol, t]));

  return sectors.map((def) => {
    const components = def.symbols
      .map((s) => tickerMap.get(s))
      .filter((t): t is MarketTicker => t !== undefined);

    const avgChange =
      components.length > 0
        ? components.reduce((s, t) => s + t.changePercent, 0) / components.length
        : 0;
    const totalVolume = components.reduce((s, t) => s + t.volume, 0);
    const advancing = components.filter((t) => t.changePercent > 0).length;
    const declining = components.filter((t) => t.changePercent < 0).length;

    return { def, components, avgChange, totalVolume, advancing, declining };
  });
}
