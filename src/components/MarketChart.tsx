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
import { RotateCcw } from 'lucide-react';

interface MarketChartProps {
  data: CandleData[];
  symbol: string;
  /** Live forming bar from WebSocket — updated via series.update() without full redraw. */
  liveCandle?: CandleData | null;
}

interface OhlcvInfo {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const toTs = (timeStr: string): UTCTimestamp =>
  Math.floor(new Date(timeStr).getTime() / 1000) as UTCTimestamp;

const C = {
  bg: '#050505',
  grid: '#1a1a1a',
  border: '#333',
  text: '#888',
  up: '#00cc66',
  down: '#ff3333',
  ma7: '#ffff00',
  ma25: '#ff00ff',
  ma99: '#00ffff',
};

type MaPeriod = 7 | 25 | 99;
const MA_COLORS: Record<MaPeriod, string> = { 7: C.ma7, 25: C.ma25, 99: C.ma99 };
const MA_PERIODS: MaPeriod[] = [7, 25, 99];
const LINE_WIDTH = 1 as const;

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtVol = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : n.toFixed(0);

const MarketChart: React.FC<MarketChartProps> = ({ data, symbol, liveCandle }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const maRefs = useRef<Record<MaPeriod, ISeriesApi<'Line'> | null>>({ 7: null, 25: null, 99: null });

  const [hoveredBar, setHoveredBar] = useState<OhlcvInfo | null>(null);

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
        vertLine: { color: '#555', width: 1, style: 3, labelBackgroundColor: '#333' },
        horzLine: { color: '#555', width: 1, style: 3, labelBackgroundColor: '#333' },
      },
      rightPriceScale: {
        borderColor: C.border,
        textColor: C.text,
        scaleMargins: { top: 0.08, bottom: 0.22 },
      },
      timeScale: {
        borderColor: C.border,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 8,
        fixLeftEdge: false,
        fixRightEdge: false,
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
      scaleMargins: { top: 0.8, bottom: 0 },
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
        color: d.close >= d.open ? `${C.up}55` : `${C.down}55`,
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
      color: liveCandle.close >= liveCandle.open ? `${C.up}55` : `${C.down}55`,
    });
  }, [liveCandle]);

  // Scroll to latest when symbol changes
  useEffect(() => {
    chartRef.current?.timeScale().scrollToRealTime();
  }, [symbol]);

  const jumpToLatest = useCallback(() => {
    chartRef.current?.timeScale().scrollToRealTime();
  }, []);

  const isUp = hoveredBar ? hoveredBar.close >= hoveredBar.open : true;

  return (
    <div className="w-full h-full relative bg-[#050505] select-none overflow-hidden">
      {/* Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 opacity-[0.04]">
        <span className="text-8xl font-black tracking-tighter text-white">QUANTCORE</span>
      </div>

      {/* Symbol watermark */}
      <div className="absolute top-2 left-2 pointer-events-none z-0">
        <span className="text-4xl font-bold text-white/10 tracking-tighter select-none">{symbol}</span>
      </div>

      {/* OHLCV crosshair info bar */}
      <div className="absolute top-2 left-2 z-10 font-mono text-[9px] pointer-events-none flex items-center gap-3 mt-10">
        {hoveredBar ? (
          <>
            <span className="text-gray-500">O <span className={isUp ? 'text-terminal-success' : 'text-terminal-error'}>{fmt(hoveredBar.open)}</span></span>
            <span className="text-gray-500">H <span className={isUp ? 'text-terminal-success' : 'text-terminal-error'}>{fmt(hoveredBar.high)}</span></span>
            <span className="text-gray-500">L <span className={isUp ? 'text-terminal-success' : 'text-terminal-error'}>{fmt(hoveredBar.low)}</span></span>
            <span className="text-gray-500">C <span className={isUp ? 'text-terminal-success' : 'text-terminal-error'}>{fmt(hoveredBar.close)}</span></span>
            <span className="text-gray-500">V <span className="text-gray-300">{fmtVol(hoveredBar.volume)}</span></span>
          </>
        ) : liveCandle ? (
          <span className={`animate-pulse ${liveCandle.close >= liveCandle.open ? 'text-terminal-success' : 'text-terminal-error'}`}>
            ● LIVE  {fmt(liveCandle.close)}
          </span>
        ) : null}
      </div>

      {/* MA Legend */}
      <div className="absolute top-2 right-14 flex items-center gap-3 pointer-events-none z-10 font-mono text-[9px]">
        {MA_PERIODS.map((p) => (
          <span key={p} style={{ color: MA_COLORS[p] }}>MA{p}</span>
        ))}
      </div>

      {/* Chart */}
      <div ref={containerRef} className="w-full h-full z-10 relative" />

      {/* Jump to latest */}
      <button
        onClick={jumpToLatest}
        className="absolute bottom-8 right-14 z-20 bg-[#111] hover:bg-[#2a2a2a] border border-[#444] text-gray-400 hover:text-white font-mono text-[9px] px-2 py-1 flex items-center gap-1 transition-colors"
        title="Scroll to latest bar"
      >
        <RotateCcw size={9} /> LATEST
      </button>
    </div>
  );
};

export default MarketChart;

