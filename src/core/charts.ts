// Interactive charts of measured values, rendered with Apache ECharts (tree-shaken, loaded with
// the first chart). The contract is the declarative Chart a plate publishes; the rules are the
// owner's dataviz method: one y-axis, categorical hues in a fixed order validated on these
// surfaces (white / gray-800), series past eight folded to a muted grey rather than a new hue,
// a legend from two series, direct labels up to four, a crosshair tooltip, recessive grid.
import { LineChart } from 'echarts/charts';
import { AriaComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import type { Chart, Theme } from './plate';

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, AriaComponent, CanvasRenderer]);

// validated with the dataviz validator against #ffffff (light) and #1e2939 (dark): adjacent CVD
// ΔE ≥ 9.1 / 8.4, normal-vision ΔE ≥ 19.6 / 19.3; three light slots sit below 3:1, relieved by
// direct labels and the table view
const SERIES: Record<Theme, string[]> = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
};
const INK: Record<Theme, { primary: string; secondary: string; grid: string; muted: string; surface: string }> = {
  light: { primary: '#111827', secondary: '#4b5563', grid: '#e5e7eb', muted: '#9ca3af', surface: '#ffffff' },
  dark: { primary: '#f9fafb', secondary: '#d1d5db', grid: '#374151', muted: '#6b7280', surface: '#1e2939' },
};

const fmt = (v: number) => (Math.abs(v) >= 1e5 || (Math.abs(v) > 0 && Math.abs(v) < 1e-2)
  ? v.toExponential(2) : v.toLocaleString('en-US', { maximumFractionDigits: 3 }));

export function renderChart(el: HTMLElement, c: Chart, theme: Theme): void {
  let chart = echarts.getInstanceByDom(el);
  if (!chart) {
    chart = echarts.init(el, undefined, { renderer: 'canvas' });
    new ResizeObserver(() => chart?.resize()).observe(el);
  }
  const ink = INK[theme];
  const many = c.series.length;
  const axis = (a: Chart['x'], name: string) => ({
    type: a.log ? 'log' as const : 'value' as const,
    name,
    nameLocation: 'middle' as const,
    nameGap: 28,
    nameTextStyle: { color: ink.secondary },
    axisLabel: { color: ink.secondary, formatter: (v: number) => fmt(v) },
    axisLine: { lineStyle: { color: ink.grid } },
    splitLine: { lineStyle: { color: ink.grid } },
    scale: !a.log,
  });
  chart.setOption({
    animation: false,
    aria: { enabled: true, label: { description: `${c.title}: ${c.y.label} against ${c.x.label}.` } },
    textStyle: { color: ink.primary, fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' },
    grid: { left: 56, right: many <= 4 ? 96 : 16, top: many >= 2 ? 40 : 16, bottom: 44, containLabel: false },
    legend: many >= 2 ? { type: 'scroll', top: 0, textStyle: { color: ink.secondary }, itemWidth: 14, itemHeight: 4 } : undefined,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross', label: { formatter: (p: { value: number }) => fmt(Number(p.value)) } },
      valueFormatter: (v: unknown) => fmt(Number(v)),
      backgroundColor: ink.surface,
      borderColor: ink.grid,
      textStyle: { color: ink.primary },
    },
    xAxis: { ...axis(c.x, c.x.label), nameGap: 26 },
    yAxis: { ...axis(c.y, c.y.label), nameGap: 44, nameRotate: 90 },
    series: c.series.map((s, i) => {
      const color = i < 8 ? SERIES[theme][i] : ink.muted;
      return {
        type: 'line',
        name: s.name,
        data: s.points.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y)
          && (!c.x.log || x > 0) && (!c.y.log || y > 0)),
        showSymbol: false,
        symbolSize: 8,
        lineStyle: { width: 2, color },
        itemStyle: { color },
        emphasis: { focus: 'series', lineStyle: { width: 3 } },
        endLabel: many <= 4 ? { show: true, formatter: '{a}', color: ink.secondary } : undefined,
      };
    }),
  }, { notMerge: true });
}

export function disposeChart(el: HTMLElement): void {
  echarts.getInstanceByDom(el)?.dispose();
}
