'use client';

import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface BarChartProps {
  title?: string;
  data: {
    name: string;
    data: number[];
  }[];
  categories: string[];
  height?: number;
  horizontal?: boolean;
  colors?: string[];
}

export default function BarChart({ 
  title, 
  data, 
  categories, 
  height = 350,
  horizontal = false,
  colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']
}: BarChartProps) {
  const hasData =
    Array.isArray(data) &&
    data.length > 0 &&
    data.some((series) => Array.isArray(series.data) && series.data.some((v) => Number(v) > 0));
  const options: ApexOptions = {
    chart: {
      type: 'bar',
      toolbar: {
        show: true
      }
    },
    plotOptions: {
      bar: {
        horizontal,
        borderRadius: 4,
        dataLabels: {
          position: 'top'
        }
      }
    },
    colors,
    dataLabels: {
      enabled: true,
      offsetY: horizontal ? 0 : -20,
      style: {
        fontSize: '12px',
        colors: ['#304758']
      }
    },
    title: {
      text: title,
      align: 'left',
      style: {
        fontSize: '16px',
        fontWeight: 600,
      }
    },
    grid: {
      borderColor: '#e5e7eb',
    },
    xaxis: {
      categories,
      labels: {
        style: {
          fontSize: '12px',
        }
      }
    },
    yaxis: {
      labels: {
        style: {
          fontSize: '12px',
        }
      }
    },
    legend: {
      position: 'top',
      horizontalAlign: 'right',
      fontSize: '14px',
    },
    tooltip: {
      shared: true,
      intersect: false,
      y: {
        formatter: (val) => val.toLocaleString()
      }
    },
    responsive: [{
      breakpoint: 768,
      options: {
        chart: {
          height: 300
        },
        legend: {
          position: 'bottom'
        }
      }
    }]
  };

  return (
    <div className="sp-card sp-card-static">
      <div className="sp-card-body">
        {hasData ? (
          <Chart options={options} series={data} type="bar" height={height} />
        ) : (
          <div className="flex h-[350px] items-center justify-center text-sm text-[var(--text-muted)]">
            Sin datos para mostrar
          </div>
        )}
      </div>
    </div>
  );
}
