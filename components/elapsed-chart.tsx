'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMinutes } from '@/lib/parsers';

export type ChartPoint = {
  date: string;
  minutes: number;
};

export function ElapsedChart({ data }: { data: ChartPoint[] }) {
  return (
    <div className="h-[320px] w-full rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 20, right: 12, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="elapsedFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#67d4ff" stopOpacity={0.6} />
              <stop offset="95%" stopColor="#67d4ff" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" strokeDasharray="4 6" vertical={false} />
          <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={10} stroke="#94a3b8" fontSize={12} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            stroke="#94a3b8"
            fontSize={12}
            tickFormatter={(value) => `${Math.round(Number(value) / 60)}h`}
          />
          <Tooltip
            cursor={{ fill: 'rgba(103, 212, 255, 0.08)' }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) {
                return null;
              }

              const value = Number(payload[0].value || 0);
              return (
                <div className="rounded-2xl border border-white/10 bg-slate-950/95 px-3 py-2 text-sm text-slate-100 shadow-2xl">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</div>
                  <div className="mt-1 font-semibold text-white">{formatMinutes(value).short}</div>
                </div>
              );
            }}
          />
          <Area type="monotone" dataKey="minutes" stroke="#67d4ff" strokeWidth={3} fill="url(#elapsedFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
