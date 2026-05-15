import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Cpu, Loader2 } from 'lucide-react';

export default function AIInsightsVisualizer({ aiInsights, isAiProcessing, runAiAnalysis }: { aiInsights: any, isAiProcessing: boolean, runAiAnalysis: () => void }) {
  return (
    <div className="border border-[#141414] bg-white p-6 sm:p-12 mt-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8 sm:mb-12">
        <div>
          <h3 className="text-2xl sm:text-4xl font-bold tracking-tighter uppercase mb-2 flex items-center gap-4">
             <Cpu size={32} className="text-red-500 shrink-0" />
             AI Synthesis Results
          </h3>
          <p className="font-mono text-[8px] sm:text-[10px] uppercase opacity-50 tracking-widest">Deep-learning pattern recognition</p>
        </div>
        <button 
            onClick={runAiAnalysis}
            disabled={isAiProcessing}
            className="flex items-center justify-center gap-2 bg-[#141414] text-[#E4E3E0] px-6 py-3 font-mono text-xs hover:bg-yellow-400 hover:text-[#141414] transition-all disabled:opacity-50 w-full sm:w-auto shrink-0"
        >
            {isAiProcessing ? <><Loader2 size={14} className="animate-spin" /> Synthesizing...</> : "Run Full Pattern Analysis"}
        </button>
      </div>

      {aiInsights ? (
        <div className="space-y-12">
           <p className="text-lg sm:text-xl font-serif italic text-[#141414]/80 border-l-4 border-yellow-400 pl-4 sm:pl-6 py-2">
              "{aiInsights.summary}"
           </p>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12">
              {/* Patterns Chart */}
              <div className="space-y-6">
                 <h4 className="font-bold text-sm uppercase tracking-widest border-b border-[#141414]/10 pb-2">Top Digit Patterns</h4>
                 <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={aiInsights.patterns} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="value" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#141414' }} />
                        <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={{ borderRadius: 0, border: '1px solid #141414' }} />
                        <Bar dataKey="count" fill="#141414" barSize={20} radius={[0, 4, 4, 0]}>
                           {aiInsights.patterns && aiInsights.patterns.map((entry: any, index: number) => (
                              <Cell key={`cell-pattern-${index}`} fill={index === 0 ? '#ef4444' : '#141414'} />
                           ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                 </div>
              </div>

              {/* Sequences Chart */}
              <div className="space-y-6">
                 <h4 className="font-bold text-sm uppercase tracking-widest border-b border-[#141414]/10 pb-2">Common Sequences</h4>
                 <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={aiInsights.sequences} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="value" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#141414' }} />
                        <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={{ borderRadius: 0, border: '1px solid #141414' }} />
                        <Bar dataKey="count" fill="#141414" barSize={20} radius={[0, 4, 4, 0]}>
                           {aiInsights.sequences && aiInsights.sequences.map((entry: any, index: number) => (
                              <Cell key={`cell-seq-${index}`} fill={index === 0 ? '#3b82f6' : '#141414'} />
                           ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                 </div>
              </div>

              {/* Biases Chart */}
              <div className="space-y-6">
                 <h4 className="font-bold text-sm uppercase tracking-widest border-b border-[#141414]/10 pb-2">Systemic Biases</h4>
                 <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={aiInsights.biases} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="value" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#141414' }} />
                        <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={{ borderRadius: 0, border: '1px solid #141414' }} />
                        <Bar dataKey="count" fill="#141414" barSize={20} radius={[0, 4, 4, 0]}>
                           {aiInsights.biases && aiInsights.biases.map((entry: any, index: number) => (
                              <Cell key={`cell-bias-${index}`} fill={index === 0 ? '#eab308' : '#141414'} />
                           ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                 </div>
              </div>
           </div>
        </div>
      ) : (
        <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-[#141414]/20 space-y-4">
           {isAiProcessing ? (
               <><Loader2 size={32} className="animate-spin opacity-50" /><p className="font-mono text-[10px] uppercase opacity-50 tracking-widest text-center">Mining Historical Archives...</p></>
           ) : (
               <><Cpu size={32} className="opacity-20" /><p className="font-mono text-[10px] uppercase opacity-30 tracking-widest text-center">Awaiting Processing Request</p></>
           )}
        </div>
      )}
    </div>
  );
}
