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
import type { SectorStats, SectorSnapshot } from '../data/sectors';

// ── Types ──────────────────────────────────────────────────────────────────────

export type SectorChartType = 'BAR' | 'HEATMAP' | 'LINE';

interface SectorChartsProps {
  chartType: SectorChartType;
  liveSectorStats: SectorStats[];
  snapshots: SectorSnapshot[];
  selectedSectorId: string | null;
  onSelectSector: (id: string | null) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmtVol = (v: number): string => {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(0);
};

const fmtTime = (ts: number): string => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Map change% to a CSS background color interpolated between red and green. */
const changeColor = (pct: number): string => {
  const clamped = Math.max(-5, Math.min(5, pct));
  if (clamped >= 0) {
    const intensity = Math.min(1, clamped / 5);
    const g = Math.round(80 + intensity * 120);
    return `rgba(0,${g},50,${0.25 + intensity * 0.55})`;
  } else {
    const intensity = Math.min(1, -clamped / 5);
    const r = Math.round(80 + intensity * 120);
    return `rgba(${r},0,20,${0.25 + intensity * 0.55})`;
  }
};

// ── Chart sub-components ───────────────────────────────────────────────────────

/**
 * Horizontal bar chart — one bar per sector, sorted by avg change%.
 * Uses recharts BarChart with a custom cell per bar.
 */
const SectorBarChart = ({
  stats,
  selectedSectorId,
  onSelectSector,
}: {
  stats: SectorStats[];
  selectedSectorId: string | null;
  onSelectSector: (id: string | null) => void;
}) => {
  const data = useMemo(
    () =>
      [...stats]
        .sort((a, b) => b.avgChange - a.avgChange)
        .map((s) => ({
          id: s.def.id,
          name: s.def.name,
          nameEn: s.def.nameEn,
          change: parseFloat(s.avgChange.toFixed(2)),
          color: s.def.color,
          volume: s.totalVolume,
          advancing: s.advancing,
          declining: s.declining,
          total: s.components.length,
        })),
    [stats],
  );

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-[10px] font-mono">
        LOADING SECTOR DATA…
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 56, left: 8, bottom: 4 }}
        barCategoryGap="22%"
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
          formatter={(value, _name, props: { payload?: { advancing?: number; declining?: number; total?: number; volume?: number } }) => {
            const v = Number(value ?? 0);
            const p = props.payload ?? {};
            return [
              <span key="v">
                <span style={{ color: v >= 0 ? '#00cc66' : '#ff3333', fontWeight: 700 }}>
                  {v >= 0 ? '+' : ''}{v}%
                </span>
                <span style={{ color: '#555' }}>
                  {' '}· {p.advancing ?? 0}↑{p.declining ?? 0}↓ · Vol {fmtVol(p.volume ?? 0)}
                </span>
              </span>,
              '',
            ];
          }}
          labelFormatter={(label) => <span style={{ color: '#e0e0e0' }}>{label}</span>}
        />
        <ReferenceLine x={0} stroke="#333" strokeWidth={1} />
        <Bar dataKey="change" radius={0} onClick={(d: { id?: string }) => onSelectSector(d?.id === selectedSectorId ? null : (d?.id ?? null))}>
          {data.map((entry) => (
            <Cell
              key={entry.id}
              fill={entry.color}
              fillOpacity={selectedSectorId && selectedSectorId !== entry.id ? 0.25 : 0.85}
              stroke={selectedSectorId === entry.id ? '#fff' : 'transparent'}
              strokeWidth={1}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

// ── Heatmap ────────────────────────────────────────────────────────────────────

/**
 * Custom div-based heatmap where each sector tile is sized proportional to its
 * trading volume and colored by its avg change %.
 */
const SectorHeatmap = ({
  stats,
  selectedSectorId,
  onSelectSector,
}: {
  stats: SectorStats[];
  selectedSectorId: string | null;
  onSelectSector: (id: string | null) => void;
}) => {
  const totalVol = useMemo(() => stats.reduce((s, x) => s + x.totalVolume, 0), [stats]);

  if (stats.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-[10px] font-mono">
        LOADING SECTOR DATA…
      </div>
    );
  }

  return (
    <div className="h-full p-1 overflow-hidden">
      <div className="flex flex-wrap gap-0.5 h-full content-start">
        {[...stats]
          .sort((a, b) => b.totalVolume - a.totalVolume)
          .map((s) => {
            const volPct = totalVol > 0 ? s.totalVolume / totalVol : 1 / stats.length;
            // Minimum 6% width to keep tiles legible
            const widthPct = Math.max(6, volPct * 100);
            const isSelected = selectedSectorId === s.def.id;
            const isUp = s.avgChange >= 0;

            return (
              <div
                key={s.def.id}
                onClick={() => onSelectSector(isSelected ? null : s.def.id)}
                className="flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden font-mono select-none"
                style={{
                  width: `calc(${widthPct}% - 2px)`,
                  minWidth: 52,
                  height: 72,
                  background: changeColor(s.avgChange),
                  border: isSelected ? '1px solid #fff' : `1px solid ${s.def.color}30`,
                  boxShadow: isSelected ? `0 0 8px ${s.def.color}60` : undefined,
                  opacity: selectedSectorId && !isSelected ? 0.6 : 1,
                }}
              >
                <div
                  className="w-1.5 h-1.5 rounded-sm mb-0.5"
                  style={{ background: s.def.color }}
                />
                <div className="text-[8px] text-white/90 font-bold text-center px-0.5 leading-tight truncate w-full text-center">
                  {s.def.name}
                </div>
                <div
                  className={`text-[10px] font-bold mt-0.5 ${isUp ? 'text-green-400' : 'text-red-400'}`}
                >
                  {isUp ? '+' : ''}{s.avgChange.toFixed(2)}%
                </div>
                <div className="text-[7px] text-white/40 mt-0.5">
                  {s.advancing}↑ {s.declining}↓
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};

// ── Line / trend chart ─────────────────────────────────────────────────────────

/**
 * Multi-line trend chart with one line per sector using historical snapshots
 * plus the current live data point.
 */
const SectorLineChart = ({
  stats,
  snapshots,
  selectedSectorId,
  onSelectSector,
}: {
  stats: SectorStats[];
  snapshots: SectorSnapshot[];
  selectedSectorId: string | null;
  onSelectSector: (id: string | null) => void;
}) => {
  const { lineData, sectorDefs } = useMemo(() => {
    const defs = stats.map((s) => ({ id: s.def.id, name: s.def.name, color: s.def.color }));

    // Build a time-series: each snapshot is one row, plus the current live point
    const rows: Record<string, string | number>[] = snapshots.map((snap) => {
      const row: Record<string, string | number> = { time: fmtTime(snap.ts) };
      snap.sectorStats.forEach((ss) => {
        row[ss.def.id] = parseFloat(ss.avgChange.toFixed(2));
      });
      return row;
    });

    // Append live data
    if (stats.length > 0) {
      const liveRow: Record<string, string | number> = { time: 'LIVE' };
      stats.forEach((s) => {
        liveRow[s.def.id] = parseFloat(s.avgChange.toFixed(2));
      });
      rows.push(liveRow);
    }

    return { lineData: rows, sectorDefs: defs };
  }, [stats, snapshots]);

  if (sectorDefs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-[10px] font-mono">
        LOADING SECTOR DATA…
      </div>
    );
  }

  if (lineData.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-600 text-[10px] font-mono">
        <span>INSUFFICIENT HISTORY FOR TREND VIEW</span>
        <span className="text-gray-700">Data is sampled every 5 minutes — check back shortly.</span>
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
            const def = sectorDefs.find((d) => d.id === String(name));
            return [
              <span key={String(name)} style={{ color: v >= 0 ? '#00cc66' : '#ff3333', fontWeight: 700 }}>
                {v >= 0 ? '+' : ''}{v}%
              </span>,
              def?.name ?? String(name),
            ];
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 9, fontFamily: 'monospace', color: '#666', paddingTop: 4 }}
          onClick={(e) => {
            const id = e.dataKey as string;
            onSelectSector(selectedSectorId === id ? null : id);
          }}
          formatter={(value) => {
            const def = sectorDefs.find((d) => d.id === value);
            return def?.name ?? value;
          }}
        />
        <ReferenceLine y={0} stroke="#333" strokeDasharray="4 4" />
        {sectorDefs.map((def) => (
          <Line
            key={def.id}
            type="monotone"
            dataKey={def.id}
            stroke={def.color}
            strokeWidth={selectedSectorId === def.id ? 2 : 1}
            strokeOpacity={selectedSectorId && selectedSectorId !== def.id ? 0.2 : 1}
            dot={false}
            activeDot={{ r: 3 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
};

// ── Main export ────────────────────────────────────────────────────────────────

export const SectorCharts = ({
  chartType,
  liveSectorStats,
  snapshots,
  selectedSectorId,
  onSelectSector,
}: SectorChartsProps) => {
  if (chartType === 'BAR') {
    return (
      <SectorBarChart
        stats={liveSectorStats}
        selectedSectorId={selectedSectorId}
        onSelectSector={onSelectSector}
      />
    );
  }

  if (chartType === 'HEATMAP') {
    return (
      <SectorHeatmap
        stats={liveSectorStats}
        selectedSectorId={selectedSectorId}
        onSelectSector={onSelectSector}
      />
    );
  }

  return (
    <SectorLineChart
      stats={liveSectorStats}
      snapshots={snapshots}
      selectedSectorId={selectedSectorId}
      onSelectSector={onSelectSector}
    />
  );
};
