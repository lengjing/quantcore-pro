import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import type { BoardItem } from '../services/stock/sectorBoardService';
import type { ColorScheme } from '../types';
import type { LangKey, ResourceKey } from '../constants/resources';
import { RESOURCES } from '../constants/resources';
import { useColors } from '../hooks/useColors';

// ── Types ──────────────────────────────────────────────────────────────────────

export type BoardChartType = 'BAR' | 'HEATMAP' | 'LINE';

export interface BoardSnapshot {
  ts: number;
  boards: BoardItem[];
}

interface BoardChartsProps {
  chartType: BoardChartType;
  boards: BoardItem[];
  snapshots: BoardSnapshot[];
  selectedBoardCode: string | null;
  onSelectBoard: (code: string | null) => void;
  colorScheme: ColorScheme;
  lang: LangKey;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmtCNY = (v: number, lang: LangKey): string => {
  const abs = Math.abs(v);
  const yi = RESOURCES[lang].FMT_YI;
  const wan = RESOURCES[lang].FMT_WAN;
  if (abs >= 1e8) return `${(v / 1e8).toFixed(1)}${yi}`;
  if (abs >= 1e4) return `${(v / 1e4).toFixed(0)}${wan}`;
  return v.toFixed(0);
};

const fmtTime = (ts: number): string => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Map change% to a CSS background color interpolated between up/down colors. */
const changeColor = (pct: number, scheme: ColorScheme): string => {
  const clamped = Math.max(-5, Math.min(5, pct));
  const isUpGreen = scheme === 'greenUp';
  if (clamped >= 0) {
    const intensity = Math.min(1, clamped / 5);
    if (isUpGreen) {
      const g = Math.round(80 + intensity * 120);
      return `rgba(0,${g},50,${0.25 + intensity * 0.55})`;
    } else {
      const r = Math.round(80 + intensity * 120);
      return `rgba(${r},0,20,${0.25 + intensity * 0.55})`;
    }
  } else {
    const intensity = Math.min(1, -clamped / 5);
    if (isUpGreen) {
      const r = Math.round(80 + intensity * 120);
      return `rgba(${r},0,20,${0.25 + intensity * 0.55})`;
    } else {
      const g = Math.round(80 + intensity * 120);
      return `rgba(0,${g},50,${0.25 + intensity * 0.55})`;
    }
  }
};

// Board colors - cycle through a palette
const BOARD_PALETTE = [
  '#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6366f1',
  '#14b8a6', '#a855f7', '#e11d48', '#0ea5e9', '#22c55e',
];

// Display limits
const MAX_BARS = 40;
const MAX_HEATMAP_TILES = 60;
const MAX_LINE_SERIES = 12;

// ── BAR Chart ──────────────────────────────────────────────────────────────────

const BoardBarChart = ({
  boards,
  selectedBoardCode,
  onSelectBoard,
  colorScheme,
  lang,
}: {
  boards: BoardItem[];
  selectedBoardCode: string | null;
  onSelectBoard: (code: string | null) => void;
  colorScheme: ColorScheme;
  lang: LangKey;
}) => {
  const colors = useColors(colorScheme);
  const t = (key: ResourceKey): string => RESOURCES[lang][key];
  const data = useMemo(
    () =>
      [...boards]
        .sort((a, b) => b.changePercent - a.changePercent)
        .slice(0, MAX_BARS)
        .map((b, i) => ({
          code: b.code,
          name: b.name,
          change: parseFloat(b.changePercent.toFixed(2)),
          color: BOARD_PALETTE[i % BOARD_PALETTE.length],
          advancing: b.advancing,
          declining: b.declining,
          mainNetInflow: b.mainNetInflow,
          leaderName: b.leaderName,
        })),
    [boards],
  );

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-[10px] font-mono">
        {t('LOADING_BOARD_DATA')}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 56, left: 8, bottom: 4 }}
        barCategoryGap="18%"
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" horizontal={false} />
        <XAxis
          type="number"
          domain={['auto', 'auto']}
          tickFormatter={(v) => `${v > 0 ? '+' : ''}${v}%`}
          tick={{ fill: '#666', fontSize: 9, fontFamily: 'monospace' }}
          axisLine={{ stroke: '#333' }}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={72}
          tick={{ fill: '#888', fontSize: 9, fontFamily: 'monospace' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: 'rgba(255,255,255,0.03)' }}
          contentStyle={{
            background: '#0d0d0d',
            border: '1px solid #333',
            borderRadius: 0,
            fontFamily: 'monospace',
            fontSize: 10,
          }}
          labelStyle={{ color: '#ccc', marginBottom: 4 }}
          formatter={(value, _name, props: { payload?: { advancing?: number; declining?: number; mainNetInflow?: number; leaderName?: string } }) => {
            const v = Number(value ?? 0);
            const p = props.payload ?? {};
            return [
              <span key="v">
                <span style={{ color: colors.hex(v), fontWeight: 700 }}>
                  {v >= 0 ? '+' : ''}{v}%
                </span>
                <span style={{ color: '#555' }}>
                  {' '}· {p.advancing ?? 0}↑{p.declining ?? 0}↓ · {t('MAIN_INFLOW')} {fmtCNY(p.mainNetInflow ?? 0, lang)}
                </span>
                {p.leaderName && (
                  <span style={{ color: '#888' }}> · {t('LEADER')} {p.leaderName}</span>
                )}
              </span>,
              '',
            ];
          }}
          labelFormatter={(label) => <span style={{ color: '#e0e0e0' }}>{label}</span>}
        />
        <ReferenceLine x={0} stroke="#333" strokeWidth={1} />
        <Bar
          dataKey="change"
          radius={0}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onClick={(d: any) => onSelectBoard(d?.code === selectedBoardCode ? null : (d?.code ?? null))}
        >
          {data.map((entry, i) => (
            <Cell
              key={entry.code}
              fill={colors.hex(entry.change)}
              fillOpacity={selectedBoardCode && selectedBoardCode !== entry.code ? 0.25 : 0.75}
              stroke={selectedBoardCode === entry.code ? '#fff' : 'transparent'}
              strokeWidth={1}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

// ── HEATMAP ────────────────────────────────────────────────────────────────────

const BoardHeatmap = ({
  boards,
  selectedBoardCode,
  onSelectBoard,
  colorScheme,
  lang,
}: {
  boards: BoardItem[];
  selectedBoardCode: string | null;
  onSelectBoard: (code: string | null) => void;
  colorScheme: ColorScheme;
  lang: LangKey;
}) => {
  const colors = useColors(colorScheme);
  const t = (key: ResourceKey): string => RESOURCES[lang][key];
  const totalCap = useMemo(() => boards.reduce((s, b) => s + Math.abs(b.totalMarketCap), 0), [boards]);

  if (boards.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-[10px] font-mono">
        {t('LOADING_BOARD_DATA')}
      </div>
    );
  }

  return (
    <div className="h-full p-1 overflow-hidden">
      <div className="flex flex-wrap gap-0.5 h-full content-start">
        {[...boards]
          .sort((a, b) => Math.abs(b.totalMarketCap) - Math.abs(a.totalMarketCap))
          .slice(0, MAX_HEATMAP_TILES)
          .map((b) => {
            const capPct = totalCap > 0 ? Math.abs(b.totalMarketCap) / totalCap : 1 / boards.length;
            const widthPct = Math.max(6, capPct * 100);
            const isSelected = selectedBoardCode === b.code;
            const isUp = b.changePercent >= 0;

            return (
              <div
                key={b.code}
                onClick={() => onSelectBoard(isSelected ? null : b.code)}
                className="flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden font-mono select-none"
                style={{
                  width: `calc(${widthPct}% - 2px)`,
                  minWidth: 60,
                  height: 72,
                  background: changeColor(b.changePercent, colorScheme),
                  border: isSelected ? '1px solid #fff' : '1px solid rgba(255,255,255,0.05)',
                  boxShadow: isSelected ? '0 0 8px rgba(245,158,11,0.4)' : undefined,
                  opacity: selectedBoardCode && !isSelected ? 0.6 : 1,
                }}
              >
                <div className="text-[8px] text-white/90 font-bold text-center px-0.5 leading-tight truncate w-full">
                  {b.name}
                </div>
                <div className={`text-[10px] font-bold mt-0.5 ${colors.clsBold(b.changePercent)}`}>
                  {isUp ? '+' : ''}{b.changePercent.toFixed(2)}%
                </div>
                <div className="text-[7px] text-white/40 mt-0.5">
                  {b.advancing}↑ {b.declining}↓
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};

// ── LINE Chart ─────────────────────────────────────────────────────────────────

const BoardLineChart = ({
  boards,
  snapshots,
  selectedBoardCode,
  onSelectBoard,
  colorScheme,
  lang,
}: {
  boards: BoardItem[];
  snapshots: BoardSnapshot[];
  selectedBoardCode: string | null;
  onSelectBoard: (code: string | null) => void;
  colorScheme: ColorScheme;
  lang: LangKey;
}) => {
  const colors = useColors(colorScheme);
  const t = (key: ResourceKey): string => RESOURCES[lang][key];
  const { lineData, boardDefs } = useMemo(() => {
    // Use top 12 boards by absolute change for line chart clarity
    const topBoards = [...boards]
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
      .slice(0, MAX_LINE_SERIES);
    const topCodes = new Set(topBoards.map((b) => b.code));

    const defs = topBoards.map((b, i) => ({
      code: b.code,
      name: b.name,
      color: BOARD_PALETTE[i % BOARD_PALETTE.length],
    }));

    // Build time-series from snapshots
    const rows: Record<string, string | number>[] = snapshots.map((snap) => {
      const row: Record<string, string | number> = { time: fmtTime(snap.ts) };
      snap.boards.forEach((b) => {
        if (topCodes.has(b.code)) {
          row[b.code] = parseFloat(b.changePercent.toFixed(2));
        }
      });
      return row;
    });

    // Append live data
    if (topBoards.length > 0) {
      const liveRow: Record<string, string | number> = { time: 'LIVE' };
      topBoards.forEach((b) => {
        liveRow[b.code] = parseFloat(b.changePercent.toFixed(2));
      });
      rows.push(liveRow);
    }

    return { lineData: rows, boardDefs: defs };
  }, [boards, snapshots]);

  if (boardDefs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-[10px] font-mono">
        {t('LOADING_BOARD_DATA')}
      </div>
    );
  }

  if (lineData.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-600 text-[10px] font-mono">
        <span>{t('INSUFFICIENT_HISTORY')}</span>
        <span className="text-gray-700">{t('HISTORY_HINT_BOARD')}</span>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={lineData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
        <XAxis
          dataKey="time"
          tick={{ fill: '#666', fontSize: 9, fontFamily: 'monospace' }}
          axisLine={{ stroke: '#333' }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => `${v > 0 ? '+' : ''}${v}%`}
          tick={{ fill: '#666', fontSize: 9, fontFamily: 'monospace' }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip
          contentStyle={{
            background: '#0d0d0d',
            border: '1px solid #333',
            borderRadius: 0,
            fontFamily: 'monospace',
            fontSize: 10,
          }}
          labelStyle={{ color: '#aaa', marginBottom: 4 }}
          formatter={(value, name) => {
            const v = Number(value ?? 0);
            const def = boardDefs.find((d) => d.code === String(name));
            return [
              <span key={String(name)} style={{ color: colors.hex(v), fontWeight: 700 }}>
                {v >= 0 ? '+' : ''}{v}%
              </span>,
              def?.name ?? String(name),
            ];
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 9, fontFamily: 'monospace', color: '#666', paddingTop: 4 }}
          onClick={(e) => {
            const code = e.dataKey as string;
            onSelectBoard(selectedBoardCode === code ? null : code);
          }}
          formatter={(value) => {
            const def = boardDefs.find((d) => d.code === value);
            return def?.name ?? value;
          }}
        />
        <ReferenceLine y={0} stroke="#333" strokeDasharray="4 4" />
        {boardDefs.map((def) => (
          <Line
            key={def.code}
            type="monotone"
            dataKey={def.code}
            stroke={def.color}
            strokeWidth={selectedBoardCode === def.code ? 2 : 1}
            strokeOpacity={selectedBoardCode && selectedBoardCode !== def.code ? 0.2 : 1}
            dot={false}
            activeDot={{ r: 3 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
};

// ── Main export ────────────────────────────────────────────────────────────────

export const BoardCharts = ({
  chartType,
  boards,
  snapshots,
  selectedBoardCode,
  onSelectBoard,
  colorScheme,
  lang,
}: BoardChartsProps) => {
  if (chartType === 'BAR') {
    return (
      <BoardBarChart
        boards={boards}
        selectedBoardCode={selectedBoardCode}
        onSelectBoard={onSelectBoard}
        colorScheme={colorScheme}
        lang={lang}
      />
    );
  }

  if (chartType === 'HEATMAP') {
    return (
      <BoardHeatmap
        boards={boards}
        selectedBoardCode={selectedBoardCode}
        onSelectBoard={onSelectBoard}
        colorScheme={colorScheme}
        lang={lang}
      />
    );
  }

  return (
    <BoardLineChart
      boards={boards}
      snapshots={snapshots}
      selectedBoardCode={selectedBoardCode}
      onSelectBoard={onSelectBoard}
      colorScheme={colorScheme}
      lang={lang}
    />
  );
};
