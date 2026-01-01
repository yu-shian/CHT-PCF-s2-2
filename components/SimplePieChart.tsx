
import React from 'react';

interface Slice {
  name: string;
  value: number;
  color: string;
  percent: number;
}

interface SimplePieChartProps {
  data: Slice[];
}

const SimplePieChart: React.FC<SimplePieChartProps> = ({ data }) => {
  let cumulativePercent = 0;
  
  const getCoordinatesForPercent = (percent: number) => {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
  };

  const slices = data.map((slice, i) => {
    const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
    cumulativePercent += slice.percent;
    const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
    
    if (slice.percent > 0.999) {
      return <circle key={i} cx="0" cy="0" r="1" fill={slice.color} />;
    }
    
    const largeArcFlag = slice.percent > 0.5 ? 1 : 0;
    
    const pathData = [
      `M 0 0`,
      `L ${startX} ${startY}`,
      `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`,
      `L 0 0`,
    ].join(' ');

    return <path key={i} d={pathData} fill={slice.color} stroke="white" strokeWidth="0.01" />;
  });

  return (
    <div className="relative w-24 h-24 md:w-32 md:h-32">
      <svg viewBox="-1 -1 2 2" className="transform -rotate-90 w-full h-full drop-shadow-sm">
        {slices}
      </svg>
    </div>
  );
};

export default SimplePieChart;
