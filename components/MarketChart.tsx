
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { CandleData } from '../types';
import { Search, ZoomIn, ZoomOut, Move } from 'lucide-react';

interface MarketChartProps {
  data: CandleData[];
  symbol: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    // payload[0] is usually the volume bar or one of the lines. 
    // We need to find the main price data which might be passed in differently depending on chart config.
    // However, usually payload contains the full data object in `payload[0].payload`.
    const data = payload[0].payload;
    return (
      <div className="bg-[#050505]/95 border border-terminal-border p-2 shadow-xl backdrop-blur-sm font-mono text-[10px] min-w-[140px] z-50 pointer-events-none">
        <div className="flex justify-between border-b border-[#333] pb-1 mb-1">
           <span className="text-gray-400 font-bold">{label ? label.substring(0, 10) + ' ' + label.substring(11, 16) : ''}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <span className="text-gray-500">OPEN</span> <span className="text-terminal-accent text-right">{data.open.toFixed(2)}</span>
          <span className="text-gray-500">HIGH</span> <span className="text-terminal-success text-right">{data.high.toFixed(2)}</span>
          <span className="text-gray-500">LOW</span> <span className="text-terminal-error text-right">{data.low.toFixed(2)}</span>
          <span className="text-gray-500">CLOSE</span> <span className="text-white text-right">{data.close.toFixed(2)}</span>
          <span className="text-gray-500">VOL</span> <span className="text-gray-300 text-right">{data.volume.toLocaleString()}</span>
        </div>
        {(data.ma7 || data.ma25 || data.ma99) && (
           <div className="mt-2 pt-1 border-t border-[#333] grid grid-cols-2 gap-x-4 gap-y-1">
              {data.ma7 && <><span className="text-[#ffff00]">MA7</span> <span className="text-[#ffff00] text-right">{data.ma7.toFixed(2)}</span></>}
              {data.ma25 && <><span className="text-[#ff00ff]">MA25</span> <span className="text-[#ff00ff] text-right">{data.ma25.toFixed(2)}</span></>}
              {data.ma99 && <><span className="text-[#00ffff]">MA99</span> <span className="text-[#00ffff] text-right">{data.ma99.toFixed(2)}</span></>}
           </div>
        )}
      </div>
    );
  }
  return null;
};

const MarketChart: React.FC<MarketChartProps> = ({ data, symbol }) => {
  // --- Zoom & Pan State ---
  // visibleWindow: How many candles to show at once (Zoom level)
  const [visibleWindow, setVisibleWindow] = useState(50);
  
  // offset: How many candles from the RIGHT end of the data we are shifted (Pan)
  // 0 means we are at the latest live data. Positive number means looking back.
  const [offset, setOffset] = useState(0);
  
  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [initialDragOffset, setInitialDragOffset] = useState(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Constant Y-Axis width to offset calculations
  const Y_AXIS_WIDTH = 50; 

  // Reset view when symbol changes
  useEffect(() => {
    setOffset(0);
    setVisibleWindow(50);
  }, [symbol]);

  // Calculate the slice of data to render
  const visibleData = useMemo(() => {
    if (data.length === 0) return [];
    
    // Total available candles
    const total = data.length;
    
    // Calculate end index (from the right)
    // If offset is 0, end is total. If offset is 10, end is total - 10.
    let endIndex = total - offset;
    
    // Calculate start index
    let startIndex = endIndex - visibleWindow;
    
    // Bounds checking
    if (endIndex > total) endIndex = total;
    if (startIndex < 0) startIndex = 0;
    if (endIndex < startIndex) endIndex = startIndex + 1; // Sanity check

    return data.slice(startIndex, endIndex);
  }, [data, visibleWindow, offset]);

  // Handle Mouse Wheel (Zoom)
  const handleWheel = (e: React.WheelEvent) => {
    if (data.length === 0 || !containerRef.current) return;

    // 1. Calculate Mouse Position Ratio
    // We must account for the Y-Axis width on the right side
    const rect = containerRef.current.getBoundingClientRect();
    const chartWidth = rect.width - Y_AXIS_WIDTH;
    const x = e.clientX - rect.left;
    
    // If mouse is over the Y-axis, don't zoom or clamp it to end
    if (x > chartWidth) return;

    const mouseRatio = Math.max(0, Math.min(1, x / chartWidth));

    // 2. Determine Zoom Delta
    // Dynamic sensitivity based on current window size
    const sensitivity = 0.15;
    let zoomDelta = Math.round(visibleWindow * sensitivity);
    if (zoomDelta < 1) zoomDelta = 1;

    // e.deltaY < 0 (Scroll Up) -> Zoom In -> Decrease Window
    // e.deltaY > 0 (Scroll Down) -> Zoom Out -> Increase Window
    if (e.deltaY < 0) {
      zoomDelta = -zoomDelta;
    }

    let newWindow = visibleWindow + zoomDelta;

    // 3. Clamp Window Size
    const MIN_WINDOW = 10;
    const MAX_WINDOW = Math.min(data.length, 2000); 
    
    if (newWindow < MIN_WINDOW) newWindow = MIN_WINDOW;
    if (newWindow > MAX_WINDOW) newWindow = MAX_WINDOW;

    // If no change, exit
    if (newWindow === visibleWindow) return;

    // 4. Calculate New Offset to Keep Mouse Focused
    // Formula: newOffset = oldOffset + (oldWindow - newWindow) * (1 - mouseRatio)
    const windowDiff = visibleWindow - newWindow;
    const offsetChange = windowDiff * (1 - mouseRatio);
    let newOffset = offset + offsetChange;

    // 5. Clamp Offset
    if (newOffset < 0) newOffset = 0; // Can't see future
    const maxOffset = data.length - newWindow;
    if (newOffset > maxOffset) newOffset = maxOffset; // Can't see before history

    setVisibleWindow(Math.round(newWindow));
    setOffset(Math.round(newOffset));
  };

  // Handle Dragging (Pan)
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag if not clicking tooltip or other interactive elements (simplified check)
    setIsDragging(true);
    setDragStartX(e.clientX);
    setInitialDragOffset(offset);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const chartWidth = rect.width - Y_AXIS_WIDTH;
    const deltaX = e.clientX - dragStartX;
    
    // Exact mapping: How many pixels per candle?
    // pixelsPerCandle = chartWidth / visibleWindow
    // deltaCandles = deltaX / pixelsPerCandle = deltaX * (visibleWindow / chartWidth)
    
    // Drag Right (+deltaX) -> Viewport Moves Left -> Looking at older data -> Increase Offset
    // Drag Left (-deltaX) -> Viewport Moves Right -> Looking at newer data -> Decrease Offset
    const deltaCandles = deltaX * (visibleWindow / chartWidth);
    
    let newOffset = initialDragOffset + deltaCandles;
    
    // Bounds Check
    if (newOffset < 0) newOffset = 0; // Can't go past live
    if (newOffset > data.length - visibleWindow) newOffset = data.length - visibleWindow;

    setOffset(Math.round(newOffset));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  return (
    <div 
      ref={containerRef}
      className={`w-full h-full bg-[#050505] flex flex-col relative select-none ${isDragging ? 'cursor-grabbing' : 'cursor-crosshair'}`}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* Watermark */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-5">
         <span className="text-8xl font-black tracking-tighter">QUANTCORE</span>
      </div>

      <div className="absolute top-2 left-2 z-10 flex flex-col pointer-events-none">
        <span className="text-4xl font-bold text-white/10 font-sans tracking-tighter">{symbol}</span>
      </div>

      {/* Controls Overlay Hint */}
      <div className="absolute top-2 right-2 z-10 flex gap-2 pointer-events-none opacity-30">
        <div className="bg-[#111] p-1 rounded border border-[#333] flex items-center gap-1 text-[9px] text-gray-400">
          <ZoomIn size={10} /> <span>SCROLL</span>
        </div>
        <div className="bg-[#111] p-1 rounded border border-[#333] flex items-center gap-1 text-[9px] text-gray-400">
          <Move size={10} /> <span>DRAG</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={visibleData} margin={{ top: 10, right: 0, bottom: 0, left: 0 }}>
          <defs>
             <linearGradient id="volGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#333" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#333" stopOpacity={0}/>
             </linearGradient>
          </defs>
          <CartesianGrid stroke="#1a1a1a" strokeDasharray="2 2" vertical={true} horizontal={true} />
          <XAxis 
            dataKey="time" 
            tick={{ fontSize: 9, fill: '#666', fontFamily: 'JetBrains Mono' }} 
            axisLine={{ stroke: '#333' }}
            tickLine={{ stroke: '#333' }}
            minTickGap={50}
            tickFormatter={(str) => {
                if (!str) return '';
                // Dynamic formatter based on visible window
                if (visibleWindow < 50) return str.substring(11, 19); // HH:MM:SS
                return str.substring(11, 16); // HH:MM
            }}
            height={20}
          />
          <YAxis 
            domain={['auto', 'auto']} // Auto scale based on visible slice
            orientation="right" 
            tick={{ fontSize: 9, fill: '#888', fontFamily: 'JetBrains Mono' }} 
            axisLine={{ stroke: '#333' }}
            tickLine={{ stroke: '#333' }}
            tickFormatter={(val) => val.toFixed(2)}
            width={Y_AXIS_WIDTH} // Matches our constant
            mirror={false}
            allowDataOverflow={true} // Important for zooming
          />
          <Tooltip 
            content={<CustomTooltip />} 
            cursor={{ stroke: '#666', strokeWidth: 1, strokeDasharray: '4 4' }}
            isAnimationActive={false}
          />
          
          {/* Volume Area */}
          <Bar dataKey="volume" barSize={visibleWindow > 100 ? 1 : 4} fill="#222" yAxisId={0} isAnimationActive={false} />

          {/* Technical Indicators */}
          <Line type="monotone" dataKey="ma7" stroke="#ffff00" strokeWidth={1} dot={false} isAnimationActive={false} connectNulls />
          <Line type="monotone" dataKey="ma25" stroke="#ff00ff" strokeWidth={1} dot={false} isAnimationActive={false} connectNulls />
          <Line type="monotone" dataKey="ma99" stroke="#00ffff" strokeWidth={1} dot={false} isAnimationActive={false} connectNulls />

          {/* Main Price Line */}
          <Line 
            type="monotone" 
            dataKey="close" 
            stroke="#e0e0e0" 
            strokeWidth={1.5} 
            dot={false} 
            activeDot={{ r: 4, fill: '#fff', stroke: '#00ccff' }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
      
      {/* History Warning */}
      {offset > 0 && (
         <div className="absolute bottom-6 right-14 bg-blue-900/80 text-white text-[9px] px-2 py-0.5 rounded border border-blue-500 animate-pulse pointer-events-none">
            HISTORICAL VIEW
         </div>
      )}
    </div>
  );
};

export default MarketChart;
