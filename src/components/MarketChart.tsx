import React, { useEffect, useRef, useCallback } from 'react';
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

const MarketChart: React.FC<MarketChartProps> = ({ data, symbol }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const maRefs = useRef<Record<MaPeriod, ISeriesApi<'Line'> | null>>({ 7: null, 25: null, 99: null });

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

  // Push data updates
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

  // Scroll to latest when symbol changes
  useEffect(() => {
    chartRef.current?.timeScale().scrollToRealTime();
  }, [symbol]);

  const jumpToLatest = useCallback(() => {
    chartRef.current?.timeScale().scrollToRealTime();
  }, []);

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
