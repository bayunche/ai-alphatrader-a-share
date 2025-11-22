
import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { useTranslation } from '../contexts/LanguageContext';

const MONO_PALETTE = [
  '#ffffff', // Pure White
  '#a3a3a3', // Neutral 400
  '#525252', // Neutral 600
  '#e5e5e5', // Neutral 200
  '#737373', // Neutral 500
  '#262626', // Neutral 800
  '#d4d4d4', // Neutral 300
  '#404040', // Neutral 700
];

interface EquityChartProps {
  data: any[];
  agents: { id: string, name: string, color?: string }[];
}

export const EquityChart: React.FC<EquityChartProps> = ({ data, agents }) => {
  const { language } = useTranslation();

  const formatYAxis = (val: number) => {
      if (language === 'zh') {
          return `¥${(val/10000).toFixed(0)}万`;
      }
      return `¥${(val/1000).toFixed(0)}k`;
  };

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis 
            dataKey="timestamp" 
            tick={{ fill: '#525252', fontSize: 10, fontWeight: 500 }} 
            tickFormatter={(str) => str.split('T')[1]?.split('.')[0] || str}
            axisLine={false}
            tickLine={false}
            minTickGap={40}
            dy={10}
          />
          <YAxis 
            domain={['auto', 'auto']} 
            tick={{ fill: '#525252', fontSize: 10, fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={formatYAxis}
            width={50}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'rgba(5,5,5,0.9)', 
              backdropFilter: 'blur(12px)',
              borderColor: 'rgba(255,255,255,0.1)', 
              color: '#f5f5f5',
              borderRadius: '16px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
              padding: '12px'
            }}
            itemStyle={{ fontSize: 12, padding: '2px 0' }}
            labelStyle={{ color: '#737373', marginBottom: 8, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}
            cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
            formatter={(value: number) => [`¥${value.toLocaleString(undefined, {minimumFractionDigits: 2})}`, '']}
          />
          <Legend 
            iconType="circle" 
            wrapperStyle={{ fontSize: '11px', paddingTop: '16px', opacity: 0.7 }} 
          />
          
          {agents.map((agent, index) => (
            <Line 
              key={agent.id}
              type="monotone" 
              dataKey={agent.id} // Use ID for data mapping
              name={agent.name}  // Use Name for Legend/Tooltip
              stroke={agent.color || MONO_PALETTE[index % MONO_PALETTE.length]} 
              strokeWidth={2} 
              dot={false} 
              activeDot={{ r: 5, strokeWidth: 2, fill: '#000', stroke: agent.color || '#fff' }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

interface StockTrendChartProps {
  data: number[];
  isPositive?: boolean;
}

export const StockTrendChart: React.FC<StockTrendChartProps> = ({ data, isPositive = true }) => {
  const chartData = data.map((val, idx) => ({ idx, val }));
  
  return (
    <div className="h-10 w-24 opacity-90">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line 
            type="monotone" 
            dataKey="val" 
            stroke={isPositive ? '#ffffff' : '#525252'} 
            strokeWidth={2} 
            dot={false} 
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
