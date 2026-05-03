import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';

export default function TerminalDigitsVisualizer({ results }: { results: any[] }) {
  const { topSequences, digitFrequencies } = useMemo(() => {
    const seqCounts: Record<string, number> = {};
    const digitCounts: Record<string, number> = { '0':0, '1':0, '2':0, '3':0, '4':0, '5':0, '6':0, '7':0, '8':0, '9':0 };

    results.forEach(r => {
      let l4 = r.last4;
      if (!l4 && r.number) {
        l4 = r.number.toString().slice(-4);
      }
      if (l4 && l4.length === 4) {
        seqCounts[l4] = (seqCounts[l4] || 0) + 1;
        for (const char of l4) {
          if (digitCounts[char] !== undefined) {
             digitCounts[char]++;
          }
        }
      }
    });

    const topSequences = Object.entries(seqCounts)
      .map(([sequence, count]) => ({ sequence, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    const digitFrequencies = Object.entries(digitCounts)
      .map(([digit, count]) => ({ digit, count }))
      .sort((a, b) => parseInt(a.digit) - parseInt(b.digit));

    return { topSequences, digitFrequencies };
  }, [results]);

  const maxSeqCount = topSequences.length > 0 ? topSequences[0].count : 1;
  const maxDigCount = Math.max(...digitFrequencies.map(d => d.count), 1);

  return (
    <div className="border border-[#141414] bg-white p-6 sm:p-12 mb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
        <div>
          <h3 className="text-2xl sm:text-4xl font-bold tracking-tighter uppercase mb-2 text-[#141414]">Terminal Digits Analysis</h3>
          <p className="font-mono text-[8px] sm:text-[10px] uppercase opacity-50 tracking-widest text-[#141414]">Analysis of the last 4 digits (Terminal Sequences & Individual Frequencies)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        
        {/* Terminal Sequences Bar Chart */}
        <div className="space-y-6 border border-[#141414]/10 p-6 bg-gray-50/50">
           <h4 className="font-bold text-sm uppercase tracking-widest border-b border-[#141414]/10 pb-2">Top 15 Terminal Sequences</h4>
           <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topSequences} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#141414" opacity={0.1} />
                  <XAxis dataKey="sequence" tick={{ fontSize: 9, fill: '#141414', fontWeight: 'bold' }} axisLine={false} tickLine={false} dy={10} angle={-35} textAnchor="end" />
                  <YAxis hide />
                  <Tooltip 
                    cursor={{fill: '#e5e7eb'}} 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-[#141414] text-white p-3 font-mono text-[10px] uppercase shadow-2xl border border-white/10">
                            <p className="mb-1 opacity-50">Terminal Sequence: {payload[0].payload.sequence}</p>
                            <p className="text-yellow-400 font-bold text-lg">Occurrences: {payload[0].payload.count}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                    {topSequences.map((entry, index) => (
                      <Cell key={`seq-${index}`} fill={index < 3 ? '#ef4444' : '#141414'} opacity={0.8 + (entry.count / maxSeqCount) * 0.2} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* Individual Digit Frequency Heatmap-style Bar Chart */}
        <div className="space-y-6 border border-[#141414]/10 p-6 bg-gray-50/50">
           <h4 className="font-bold text-sm uppercase tracking-widest border-b border-[#141414]/10 pb-2">Single Digit Frequency (Terminal Only)</h4>
           <div className="h-64 flex flex-col justify-between">
              <div className="flex-1 w-full mt-4">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={digitFrequencies} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#141414" opacity={0.1} />
                      <XAxis dataKey="digit" tick={{ fontSize: 12, fill: '#141414', fontWeight: 'bold' }} axisLine={false} tickLine={false} dy={5} />
                      <YAxis hide />
                      <Tooltip 
                        cursor={{fill: '#e5e7eb'}} 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-[#141414] text-white p-3 font-mono text-[10px] uppercase shadow-2xl border border-white/10">
                                <p className="mb-1 opacity-50">Digit: {payload[0].payload.digit}</p>
                                <p className="text-yellow-400 font-bold text-lg">Occurrences: {payload[0].payload.count}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                        {digitFrequencies.map((entry, index) => (
                          <Cell key={`dig-${index}`} fill={'#141414'} opacity={0.3 + (entry.count / maxDigCount) * 0.7} />
                        ))}
                      </Bar>
                    </BarChart>
                 </ResponsiveContainer>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
}
