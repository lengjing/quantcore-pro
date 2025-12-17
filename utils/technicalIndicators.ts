
import { CandleData } from '../types';

export const calculateSMA = (data: CandleData[], period: number): number[] => {
  const smaValues: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      smaValues.push(NaN); // Not enough data
      continue;
    }
    
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    smaValues.push(sum / period);
  }
  return smaValues;
};

export const enhanceCandlesWithIndicators = (data: CandleData[]): CandleData[] => {
  const ma7 = calculateSMA(data, 7);
  const ma25 = calculateSMA(data, 25);
  const ma99 = calculateSMA(data, 99);

  return data.map((candle, i) => ({
    ...candle,
    ma7: isNaN(ma7[i]) ? undefined : ma7[i],
    ma25: isNaN(ma25[i]) ? undefined : ma25[i],
    ma99: isNaN(ma99[i]) ? undefined : ma99[i],
  }));
};
