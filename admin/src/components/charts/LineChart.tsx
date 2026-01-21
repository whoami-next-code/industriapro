'use client';

import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface LineChartProps {
  title?: string;
  data: {
    name: string;
    data: number[];
  }[];
  categories: string[];
  height?: number;
  colors?: string[];
}

export default function LineChart({ 
  title, 
  data, 
  categories, 
  height = 350,
  colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']
}: LineChartProps) {
  const options: ApexOptions = {
    chart: {
      type: 'line',
      toolbar: {
        show: true,
        tools: {
          download: true,
          selection: true,
          zoom: true,
          zoomin: true,
          zoomout: true,
          pan: true,
        }
      },
      zoom: {
        enabled: true
      }
    },
    colors,
    dataLabels: {
      enabled: false
    },
    stroke: {
      curve: 'smooth',
      width: 3
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
      strokeDashArray: 3,
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
        },
        formatter: (val) => val.toFixed(0)
      }
    },
    tooltip: {
      shared: true,
      intersect: false,
      y: {
        formatter: (val) => val.toLocaleString()
      }
    },
    legend: {
      position: 'top',
      horizontalAlign: 'right',
      fontSize: '14px',
      markers: {
        width: 10,
        height: 10,
        radius: 3
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
        <Chart options={options} series={data} type="line" height={height} />
      </div>
    </div>
  );
}
