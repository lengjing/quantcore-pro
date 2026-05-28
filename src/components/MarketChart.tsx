import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import { CandleData } from '../types';
import { RotateCcw, Crosshair, TrendingUp, BarChart3, Maximize2, Minus } from 'lucide-react';

interface MarketChartProps {
  data: CandleData[];
  symbol: string;
  /** Live forming bar from WebSocket — updated via series.update() without full redraw. */
  liveCandle?: CandleData | null;
  /** Called when user clicks on a candle bar to show detail info. */
  onCandleClick?: (candle: CandleData) => void;
}

interface OhlcvInfo {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

type ChartStyle = 'candle' | 'line';

const toTs = (timeStr: string): UTCTimestamp =>
  Math.floor(new Date(timeStr).getTime() / 1000) as UTCTimestamp;

const C = {
  bg: '#050505',
  grid: '#111111',
  border: '#222',
  text: '#666',
  up: '#00cc66',
  down: '#ff3333',
  ma7: '#f5c842',
  ma25: '#e040fb',
  ma99: '#00bcd4',
};

type MaPeriod = 7 | 25 | 99;
const MA_COLORS: Record<MaPeriod, string> = { 7: C.ma7, 25: C.ma25, 99: C.ma99 };
const MA_PERIODS: MaPeriod[] = [7, 25, 99];
const LINE_WIDTH = 1 as const;

const fmt = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtVol = (n: number) =>
  n >= 1_000_000_000
    ? `${(n / 1_000_000_000).toFixed(2)}B`
    : n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(2)}M`
      : n >= 1_000
        ? `${(n / 1_000).toFixed(1)}K`
        : n.toFixed(0);

const pctChange = (o: number, c: number) => {
  if (o === 0) return '0.00';
  return (((c - o) / o) * 100).toFixed(2);
};

const MarketChart: React.FC<MarketChartProps> = ({ data, symbol, liveCandle, onCandleClick }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const maRefs = useRef<Record<MaPeriod, ISeriesApi<'Line'> | null>>({ 7: null, 25: null, 99: null });

  const [hoveredBar, setHoveredBar] = useState<OhlcvInfo | null>(null);
  const [showMA, setShowMA] = useState<Record<MaPeriod, boolean>>({ 7: true, 25: true, 99: true });
  const [showVolume, setShowVolume] = useState(true);
  const [crosshairMode, setCrosshairMode] = useState<'normal' | 'magnet'>('normal');

  // Refs for click handler (stable reference for chart subscription)
  const onCandleClickRef = useRef(onCandleClick);
  onCandleClickRef.current = onCandleClick;
  const dataRef = useRef(data);
  dataRef.current = data;

  // Latest bar for top stats
  const latestBar = data.length > 0 ? data[data.length - 1] : null;
  const currentBar = hoveredBar ?? (latestBar ? {
    open: latestBar.open,
    high: latestBar.high,
    low: latestBar.low,
    close: latestBar.close,
    volume: latestBar.volume,
  } : null);

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: C.bg },
        textColor: C.text,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: C.grid },
        horzLines: { color: C.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#444', width: 1, style: 3, labelBackgroundColor: '#1a1a1a' },
        horzLine: { color: '#444', width: 1, style: 3, labelBackgroundColor: '#1a1a1a' },
      },
      rightPriceScale: {
        borderColor: C.border,
        textColor: C.text,
        scaleMargins: { top: 0.05, bottom: 0.22 },
        entireTextOnly: true,
      },
      timeScale: {
        borderColor: C.border,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12,
        fixLeftEdge: false,
        fixRightEdge: false,
        barSpacing: 8,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: true,
      },
    });

    chartRef.current = chart;

    candleRef.current = chart.addSeries(CandlestickSeries, {
      upColor: C.up,
      downColor: C.down,
      borderUpColor: C.up,
      borderDownColor: C.down,
      wickUpColor: C.up,
      wickDownColor: C.down,
    });

    volRef.current = chart.addSeries(HistogramSeries, {
      color: '#1a1a1a',
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    });
    chart.priceScale('vol').applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    const sharedLineOpts = {
      lineWidth: LINE_WIDTH,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    };
    MA_PERIODS.forEach((p) => {
      maRefs.current[p] = chart.addSeries(LineSeries, { ...sharedLineOpts, color: MA_COLORS[p] });
    });

    // Crosshair OHLCV info
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !candleRef.current || !volRef.current) {
        setHoveredBar(null);
        return;
      }
      const candleData = param.seriesData.get(candleRef.current) as
        | { open: number; high: number; low: number; close: number }
        | undefined;
      const volData = param.seriesData.get(volRef.current) as { value: number } | undefined;
      if (candleData) {
        setHoveredBar({
          open: candleData.open,
          high: candleData.high,
          low: candleData.low,
          close: candleData.close,
          volume: volData?.value ?? 0,
        });
      } else {
        setHoveredBar(null);
      }
    });

    // Click handler for candle detail
    chart.subscribeClick((param) => {
      if (!param.time || !candleRef.current || !volRef.current) return;
      const candleData = param.seriesData.get(candleRef.current) as
        | { open: number; high: number; low: number; close: number }
        | undefined;
      const volData = param.seriesData.get(volRef.current) as { value: number } | undefined;
      if (candleData && onCandleClickRef.current) {
        // Find the matching candle from data to get full info including MAs
        const ts = param.time as number;
        const matchingCandle = dataRef.current.find((d) => Math.floor(new Date(d.time).getTime() / 1000) === ts);
        if (matchingCandle) {
          onCandleClickRef.current(matchingCandle);
        } else {
          onCandleClickRef.current({
            time: new Date(ts * 1000).toISOString(),
            open: candleData.open,
            high: candleData.high,
            low: candleData.low,
            close: candleData.close,
            volume: volData?.value ?? 0,
          });
        }
      }
    });

    // Responsive sizing
    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // Full history load — setData()
  useEffect(() => {
    if (!candleRef.current || data.length === 0) return;

    const sorted = [...data].sort((a, b) => toTs(a.time) - toTs(b.time));

    candleRef.current.setData(
      sorted.map((d) => ({
        time: toTs(d.time),
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      })),
    );

    volRef.current?.setData(
      sorted.map((d) => ({
        time: toTs(d.time),
        value: d.volume,
        color: d.close >= d.open ? `${C.up}33` : `${C.down}33`,
      })),
    );

    MA_PERIODS.forEach((p) => {
      const key = `ma${p}` as keyof CandleData;
      maRefs.current[p]?.setData(
        sorted
          .filter((d) => d[key] != null)
          .map((d) => ({ time: toTs(d.time), value: d[key] as number })),
      );
    });
  }, [data]);

  // Live bar update — update() only the current forming candle
  useEffect(() => {
    if (!candleRef.current || !liveCandle) return;

    const ts = toTs(liveCandle.time);
    candleRef.current.update({
      time: ts,
      open: liveCandle.open,
      high: liveCandle.high,
      low: liveCandle.low,
      close: liveCandle.close,
    });
    volRef.current?.update({
      time: ts,
      value: liveCandle.volume,
      color: liveCandle.close >= liveCandle.open ? `${C.up}33` : `${C.down}33`,
    });
  }, [liveCandle]);

  // Toggle MA visibility
  useEffect(() => {
    MA_PERIODS.forEach((p) => {
      maRefs.current[p]?.applyOptions({
        visible: showMA[p],
      });
    });
  }, [showMA]);

  // Toggle volume visibility
  useEffect(() => {
    volRef.current?.applyOptions({ visible: showVolume });
    if (chartRef.current) {
      chartRef.current.priceScale('vol').applyOptions({
        scaleMargins: { top: showVolume ? 0.82 : 1, bottom: 0 },
      });
    }
  }, [showVolume]);

  // Crosshair mode
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.applyOptions({
        crosshair: {
          mode: crosshairMode === 'magnet' ? CrosshairMode.Magnet : CrosshairMode.Normal,
        },
      });
    }
  }, [crosshairMode]);

  // Scroll to latest when symbol changes
  useEffect(() => {
    chartRef.current?.timeScale().scrollToRealTime();
  }, [symbol]);

  const jumpToLatest = useCallback(() => {
    chartRef.current?.timeScale().scrollToRealTime();
  }, []);

  const fitContent = useCallback(() => {
    chartRef.current?.timeScale().fitContent();
  }, []);

  const isUp = currentBar ? currentBar.close >= currentBar.open : true;
  const changeVal = currentBar ? (currentBar.close - currentBar.open) : 0;
  const changePct = currentBar ? pctChange(currentBar.open, currentBar.close) : '0.00';

  return (
    <div className="w-full h-full relative bg-[#050505] select-none overflow-hidden flex flex-col">
      {/* ── Top Info Bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-2 py-1 bg-[#080808] border-b border-[#1a1a1a] shrink-0 z-20">
        {/* Symbol + Price Info */}
        <div className="flex items-center gap-4 font-mono text-[10px]">
          <span className="text-sm font-bold text-white tracking-tight">{symbol}</span>
          {currentBar && (
            <>
              <div className="flex items-center gap-1">
                <span className={`text-sm font-bold ${isUp ? 'text-terminal-success' : 'text-terminal-error'}`}>
                  {fmt(currentBar.close)}
                </span>
                <span className={`text-[10px] ${isUp ? 'text-terminal-success' : 'text-terminal-error'}`}>
                  {changeVal >= 0 ? '+' : ''}{fmt(changeVal)} ({changePct}%)
                </span>
              </div>
              <div className="h-3 w-px bg-[#333]" />
              <span className="text-gray-500">O <span className="text-gray-300">{fmt(currentBar.open)}</span></span>
              <span className="text-gray-500">H <span className="text-gray-300">{fmt(currentBar.high)}</span></span>
              <span className="text-gray-500">L <span className="text-gray-300">{fmt(currentBar.low)}</span></span>
              <span className="text-gray-500">V <span className="text-gray-300">{fmtVol(currentBar.volume)}</span></span>
            </>
          )}
          {liveCandle && !hoveredBar && (
            <span className="text-terminal-success animate-pulse text-[9px]">● LIVE</span>
          )}
        </div>

        {/* MA Legend */}
        <div className="flex items-center gap-2 font-mono text-[9px]">
          {MA_PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setShowMA((prev) => ({ ...prev, [p]: !prev[p] }))}
              className={`flex items-center gap-0.5 px-1 py-0.5 rounded-sm transition-opacity ${showMA[p] ? 'opacity-100' : 'opacity-30'}`}
              title={`Toggle MA${p}`}
            >
              <span
                className="w-2 h-0.5 inline-block rounded-full"
                style={{ backgroundColor: MA_COLORS[p] }}
              />
              <span style={{ color: MA_COLORS[p] }}>MA{p}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Chart Body ──────────────────────────────────────────────────── */}
      <div className="flex-1 relative min-h-0">
        {/* Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 opacity-[0.03]">
          <span className="text-7xl font-black tracking-tighter text-white">QUANTCORE</span>
        </div>

        {/* Chart */}
        <div ref={containerRef} className="w-full h-full z-10 relative" />

        {/* ── Right Toolbar ────────────────────────────────────────────── */}
        <div className="absolute top-2 right-2 z-20 flex flex-col gap-1">
          <button
            onClick={() => setCrosshairMode((m) => (m === 'normal' ? 'magnet' : 'normal'))}
            className={`p-1.5 rounded-sm border transition-colors ${
              crosshairMode === 'magnet'
                ? 'bg-terminal-accent/20 border-terminal-accent/50 text-terminal-accent'
                : 'bg-[#111] border-[#333] text-gray-500 hover:text-white hover:border-[#555]'
            }`}
            title={`Crosshair: ${crosshairMode === 'magnet' ? 'Magnet' : 'Normal'}`}
          >
            <Crosshair size={11} />
          </button>
          <button
            onClick={() => setShowVolume((v) => !v)}
            className={`p-1.5 rounded-sm border transition-colors ${
              showVolume
                ? 'bg-blue-900/30 border-blue-700/50 text-blue-400'
                : 'bg-[#111] border-[#333] text-gray-500 hover:text-white hover:border-[#555]'
            }`}
            title="Toggle Volume"
          >
            <BarChart3 size={11} />
          </button>
          <div className="h-px bg-[#333] my-0.5" />
          <button
            onClick={fitContent}
            className="p-1.5 bg-[#111] rounded-sm border border-[#333] text-gray-500 hover:text-white hover:border-[#555] transition-colors"
            title="Fit All Data"
          >
            <Maximize2 size={11} />
          </button>
          <button
            onClick={jumpToLatest}
            className="p-1.5 bg-[#111] rounded-sm border border-[#333] text-gray-500 hover:text-white hover:border-[#555] transition-colors"
            title="Scroll to Latest"
          >
            <RotateCcw size={11} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MarketChart;
