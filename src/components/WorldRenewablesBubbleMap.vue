<template>
  <section class="map-card">
    <header class="map-card__header">
      <div>
        <h2 class="h5 mb-1">Renewable Share Bubbles</h2>
        <p class="text-muted mb-0">
          D3 proportional symbols sized by renewable electricity share and colored by CO₂ intensity.
        </p>
      </div>
      <div class="d-flex align-items-center gap-2 small text-muted">
        <span>High CO₂</span>
        <span class="legend-swatch legend-swatch--high"></span>
        <span class="legend-swatch legend-swatch--low"></span>
        <span>Low CO₂</span>
      </div>
    </header>
    <div ref="chartRef" class="map-frame"></div>
  </section>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
import * as d3 from 'd3';
import { feature } from 'topojson-client';
import worldData from 'world-atlas/countries-110m.json';

const chartRef = ref(null);
let resizeObserver;
let indicators = [];

const drawChart = () => {
  if (!chartRef.value || indicators.length === 0) {
    return;
  }

  const container = chartRef.value;
  const width = container.clientWidth || 960;
  const height = Math.min(520, Math.round(width * 0.55));

  d3.select(container).selectAll('*').remove();

  const svg = d3
    .select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  const projection = d3.geoNaturalEarth1().fitSize([width, height], { type: 'Sphere' });
  const path = d3.geoPath(projection);

  const countries = feature(worldData, worldData.objects.countries).features;

  svg
    .append('path')
    .datum({ type: 'Sphere' })
    .attr('class', 'sphere')
    .attr('d', path);

  svg
    .append('g')
    .selectAll('path')
    .data(countries)
    .join('path')
    .attr('d', path)
    .attr('fill', '#e2e8f0')
    .attr('stroke', '#cbd5f5')
    .attr('stroke-width', 0.4);

  const maxShare = d3.max(indicators, (d) => d.renewableShare);
  const radius = d3.scaleSqrt().domain([0, maxShare]).range([6, 32]);

  const color = d3
    .scaleSequential()
    .domain(d3.extent(indicators, (d) => d.co2MtPerCapita))
    .interpolator(d3.interpolateWarm);

  const tooltip = d3
    .select(container)
    .append('div')
    .attr('class', 'tooltip')
    .style('opacity', 0);

  svg
    .append('g')
    .selectAll('circle')
    .data(indicators)
    .join('circle')
    .attr('cx', (d) => projection([d.longitude, d.latitude])[0])
    .attr('cy', (d) => projection([d.longitude, d.latitude])[1])
    .attr('r', (d) => radius(d.renewableShare))
    .attr('fill', (d) => color(d.co2MtPerCapita))
    .attr('fill-opacity', 0.85)
    .attr('stroke', '#0f172a')
    .attr('stroke-width', 0.6)
    .on('mouseenter', (event, d) => {
      tooltip
        .style('opacity', 1)
        .html(
          `<strong>${d.country}</strong><br/>Renewable: ${d.renewableShare.toFixed(
            1
          )}%<br/>CO₂ per capita: ${d.co2MtPerCapita.toFixed(1)} t`
        );
      d3.select(event.currentTarget).attr('stroke-width', 1.4);
    })
    .on('mousemove', (event) => {
      tooltip
        .style('left', `${event.offsetX + 16}px`)
        .style('top', `${event.offsetY + 16}px`);
    })
    .on('mouseleave', (event) => {
      tooltip.style('opacity', 0);
      d3.select(event.currentTarget).attr('stroke-width', 0.6);
    });
};

onMounted(() => {
  fetch(new URL('../data/country-indicators.json', import.meta.url))
    .then((response) => response.json())
    .then((data) => {
      indicators = data;
      drawChart();
      if (chartRef.value) {
        resizeObserver = new ResizeObserver(() => drawChart());
        resizeObserver.observe(chartRef.value);
      }
    });
});

onBeforeUnmount(() => {
  if (resizeObserver && chartRef.value) {
    resizeObserver.unobserve(chartRef.value);
  }
});
</script>

<style scoped>
.map-card {
  background: #fff;
  border-radius: 0.75rem;
  padding: 1.5rem;
  box-shadow: 0 1.5rem 3rem -1.5rem rgba(15, 23, 42, 0.35);
}

.map-card__header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1.25rem;
}

.map-frame {
  position: relative;
  width: 100%;
  min-height: 360px;
}

.sphere {
  fill: #eff6ff;
}

.tooltip {
  position: absolute;
  background: rgba(15, 23, 42, 0.88);
  color: #f8fafc;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.85rem;
  pointer-events: none;
  white-space: nowrap;
}

.legend-swatch {
  width: 18px;
  height: 12px;
  border-radius: 999px;
  display: inline-block;
}

.legend-swatch--high {
  background: #b91c1c;
}

.legend-swatch--low {
  background: #fde68a;
}
</style>

