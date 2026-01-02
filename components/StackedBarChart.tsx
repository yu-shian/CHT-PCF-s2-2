import React from 'react';

interface BarSegment {
    name: string;
    value: number;
    color: string;
    percent: number;
}

interface StackedBarChartProps {
    data: BarSegment[];
}

const StackedBarChart: React.FC<StackedBarChartProps> = ({ data }) => {
    // Filter out zero values to avoid empty segments taking up border space if we added borders
    const activeSegments = data.filter(d => d.percent > 0);

    return (
        <div className="w-full space-y-2">
            {/* Percentage Labels Row */}
            <div className="flex justify-between text-[10px] font-bold text-slate-400 px-0.5">
                {activeSegments.map((segment, idx) => (
                    segment.percent > 0.1 && ( // Only show label if segment is large enough
                        <span key={idx} style={{ color: segment.color }}>
                            {segment.name} {Math.round(segment.percent * 100)}%
                        </span>
                    )
                ))}
            </div>

            {/* The Stacked Bar */}
            <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex">
                {activeSegments.map((segment, idx) => (
                    <div
                        key={idx}
                        style={{ width: `${segment.percent * 100}%`, backgroundColor: segment.color }}
                        className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-500 ease-out hover:opacity-90 relative group"
                        title={`${segment.name}: ${segment.value} kgCO2e (${Math.round(segment.percent * 100)}%)`}
                    >
                    </div>
                ))}
            </div>
        </div>
    );
};

export default StackedBarChart;
