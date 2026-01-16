<template>
  <section class="map-card">
    <header class="map-card__header">
      <div>
        <h2 class="h5 mb-1">Global CO₂ Emissions</h2>
        <p class="text-muted mb-0">
          Per-capita CO₂ emissions with renewable energy share highlights for focus countries.
        </p>
      </div>
      <div class="legend">
        <span>Lower</span>
        <div class="legend__gradient"></div>
        <span>Higher</span>
      </div>
    </header>
    <div ref="chartEl" class="map-container"></div>
  </section>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
import * as d3 from 'd3';
import { feature, mesh } from 'topojson-client';
import worldData from 'world-atlas/countries-110m.json';

const chartEl = ref(null);
let resizeObserver;
let indicators = [];

const render = () => {
  if (!chartEl.value || indicators.length === 0) {
    return;
  }

  const container = chartEl.value;

  const width = container.clientWidth || 960;
  const height = Math.min(520, Math.round(width * 0.55));

  d3.select(container).selectAll('*').remove();

  const svg = d3
    .select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  const tooltip = d3
    .select(container)
    .append('div')
    .attr('class', 'tooltip')
    .style('opacity', 0);

  const countries = feature(worldData, worldData.objects.countries).features;
  const borders = mesh(worldData, worldData.objects.countries, (a, b) => a !== b);

  const projection = d3.geoNaturalEarth1().fitSize([width, height], { type: 'Sphere' });
  const path = d3.geoPath(projection);

  const dataByIso = new Map(indicators.map((d) => [Number(d.isoNumeric), d]));
  const co2Values = indicators.map((d) => d.co2MtPerCapita);

  const colorScale = d3
    .scaleSequential()
    .domain([d3.max(co2Values), d3.min(co2Values)])
    .interpolator(d3.interpolateYlOrRd);

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
    .attr('fill', (d) => {
      const indicator = dataByIso.get(Number(d.id));
      if (!indicator) {
        return '#e5e7eb';
      }
      return colorScale(indicator.co2MtPerCapita);
    })
    .attr('stroke', '#94a3b8')
    .attr('stroke-width', 0.6)
    .attr('cursor', (d) => (dataByIso.has(Number(d.id)) ? 'pointer' : 'default'))
    .on('mouseenter', (event, d) => {
      const indicator = dataByIso.get(Number(d.id));
      if (!indicator) {
        return;
      }

      d3.select(event.currentTarget).attr('stroke-width', 1.2);
      tooltip
        .style('opacity', 1)
        .html(
          `<strong>${indicator.country}</strong><br/>
           CO₂: ${indicator.co2MtPerCapita.toFixed(1)} t per capita<br/>
           Renewable: ${indicator.renewableShare.toFixed(1)}%<br/>
           Avg PM2.5: ${indicator.avgPm25.toFixed(1)} μg/m³`
        );
    })
    .on('mousemove', (event) => {
      tooltip
        .style('left', `${event.offsetX + 14}px`)
        .style('top', `${event.offsetY + 14}px`);
    })
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).attr('stroke-width', 0.6);
      tooltip.style('opacity', 0);
    });

  svg
    .append('path')
    .datum(borders)
    .attr('class', 'border')
    .attr('d', path);
};

onMounted(() => {
  fetch(new URL('../data/country-indicators.json', import.meta.url))
    .then((response) => response.json())
    .then((data) => {
      indicators = data;
      render();
      if (chartEl.value) {
        resizeObserver = new ResizeObserver(() => render());
        resizeObserver.observe(chartEl.value);
      }
    });
});

onBeforeUnmount(() => {
  if (resizeObserver && chartEl.value) {
    resizeObserver.unobserve(chartEl.value);
  }
});
</script>

<style scoped>
.map-card {
  background: #ffffff;
  border-radius: 0.75rem;
  padding: 1.5rem;
  box-shadow: 0 1.5rem 3rem -1.5rem rgba(15, 23, 42, 0.35);
}

.map-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1.25rem;
}

.legend {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  color: #475569;
}

.legend__gradient {
  width: 120px;
  height: 12px;
  border-radius: 8px;
  background: linear-gradient(90deg, #fef3c7 0%, #e11d48 100%);
  border: 1px solid #e2e8f0;
}

.map-container {
  position: relative;
  width: 100%;
  min-height: 360px;
}

svg {
  width: 100%;
  height: 100%;
}

.sphere {
  fill: #eff6ff;
}

.border {
  fill: none;
  stroke: #94a3b8;
  stroke-width: 0.4;
  pointer-events: none;
}

.tooltip {
  position: absolute;
  padding: 10px 12px;
  background: rgba(15, 23, 42, 0.86);
  color: #f8fafc;
  border-radius: 10px;
  font-size: 0.85rem;
  line-height: 1.3;
  pointer-events: none;
  transform: translate(-50%, -50%);
  white-space: nowrap;
}

@media (max-width: 768px) {
  .map-card__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .legend {
    order: -1;
  }
}
</style>
