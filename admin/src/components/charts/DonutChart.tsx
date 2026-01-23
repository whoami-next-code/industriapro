'use client';

import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface DonutChartProps {
  title?: string;
  labels: string[];
  series: number[];
  height?: number;
  colors?: string[];
}

export default function DonutChart({ 
  title, 
  labels, 
  series, 
  height = 350,
  colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
}: DonutChartProps) {
  const hasData = Array.isArray(series) && series.some((v) => Number(v) > 0);
  const options: ApexOptions = {
    chart: {
      type: 'donut',
    },
    labels,
    colors,
    title: {
      text: title,
      align: 'left',
      style: {
        fontSize: '16px',
        fontWeight: 600,
      }
    },
    legend: {
      position: 'bottom',
      fontSize: '14px',
    },
    dataLabels: {
      enabled: true,
      formatter: function(val: number) {
        return val.toFixed(1) + '%';
      }
    },
    plotOptions: {
      pie: {
        donut: {
          size: '65%',
          labels: {
            show: true,
            name: {
              show: true,
              fontSize: '14px',
              fontWeight: 600,
            },
            value: {
              show: true,
              fontSize: '22px',
              fontWeight: 700,
              formatter: (val) => parseInt(val).toLocaleString()
            },
            total: {
              show: true,
              label: 'Total',
              fontSize: '14px',
              fontWeight: 600,
              formatter: function(w) {
                return w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0).toLocaleString();
              }
            }
          }
        }
      }
    },
    tooltip: {
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
          <Chart options={options} series={series} type="donut" height={height} />
        ) : (
          <div className="flex h-[350px] items-center justify-center text-sm text-[var(--text-muted)]">
            Sin datos para mostrar
          </div>
        )}
      </div>
    </div>
  );
}
