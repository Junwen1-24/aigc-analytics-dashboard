<template>
  <section class="map-card">
    <header class="map-card__header">
      <div>
        <h2 class="h5 mb-1">Los Angeles Neighborhoods</h2>
        <p class="text-muted mb-0">
          LA Times neighborhood boundaries rendered with D3, highlighting community names on hover.
        </p>
      </div>
    </header>
    <div ref="chartRef" class="map-frame"></div>
  </section>
</template>
<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
import * as d3 from 'd3';

const chartRef = ref(null);
const neighborhoods = ref(null);
const complaintCounts = ref(new Map());
let resizeObserver;

const sanitizeFeatureCollection = (collection) => {
  const areaThreshold = 10; // steradians (~4π) identifies the artificial global shell polygon
  return {
    ...collection,
    features: collection.features.map((feature) => {
      if (feature.geometry?.type !== 'MultiPolygon') {
        return feature;
      }

      const filtered = feature.geometry.coordinates.filter((polygon) => {
        const geo = { type: 'Polygon', coordinates: polygon };
        return d3.geoArea(geo) < areaThreshold;
      });

      if (filtered.length && filtered.length !== feature.geometry.coordinates.length) {
        return {
          ...feature,
          geometry: {
            ...feature.geometry,
            coordinates: filtered,
          },
        };
      }

      return feature;
    }),
  };
};

const buildComplaintCounts = (rows) => {
  const counts = new Map();
  rows.forEach((row) => {
    const name = row.neighborhood ? row.neighborhood.trim() : '';
    if (!name) {
      return;
    }
    counts.set(name, (counts.get(name) ?? 0) + 1);
  });
  return counts;
};
const drawChart = () => {
  if (!chartRef.value || !neighborhoods.value) {
    return;
  }
  const container = chartRef.value;
  const width = container.clientWidth;
  if (!width) {
    return;
  }
  const height = Math.max(1, Math.min(520, Math.round(width * 0.75)));
  d3.select(container).selectAll('*').remove();
  const svg = d3
    .select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('role', 'img')
    .attr('aria-label', 'Map of Los Angeles neighborhood boundaries');
  const projection = d3.geoMercator().fitSize([width, height], neighborhoods.value);
  const path = d3.geoPath(projection);
  const features = neighborhoods.value.features ?? [];
  const countsMap = complaintCounts.value;
  const counts = features.map((feature) => {
    const name = feature.properties?.name ?? '';
    return countsMap.get(name) ?? 0;
  });
  const maxCount = d3.max(counts);
  const colorScale =
    maxCount && maxCount > 0
      ? d3.scaleSequential(d3.interpolateYlOrRd).domain([0, maxCount]).clamp(true)
      : null;
  const tooltip = d3
    .select(container)
    .append('div')
    .attr('class', 'tooltip')
    .style('opacity', 0);
  svg
    .append('g')
    .attr('class', 'neighborhoods')
    .selectAll('path')
    .data(features, (d) => d.properties?.OBJECTID ?? d.properties?.name)
    .join((enter) =>
      enter
        .append('path')
        .attr('d', path)
        .attr('fill', (d) => {
          const value = countsMap.get(d.properties?.name ?? '') ?? 0;
          if (!colorScale || value === 0) {
            return '#e2e8f0';
          }
          return colorScale(value);
        })
        .attr('stroke', '#1e3a8a')
        .attr('stroke-width', 0.6)
        .attr('aria-label', (d) => `${d.properties?.name ?? 'Neighborhood'} boundary`)
        .attr('tabindex', 0)
        .on('mouseenter focus', function (event, d) {
          const neighborhood = d3.select(this);
          neighborhood.raise().transition().duration(150).attr('stroke-width', 1.2);
          const [x, y] = path.centroid(d);
          const value = countsMap.get(d.properties?.name ?? '') ?? 0;
          tooltip
            .style('opacity', 1)
            .style('left', `${x + 12}px`)
            .style('top', `${y + 12}px`)
            .html(
              `<strong>${d.properties?.name ?? 'Neighborhood'}</strong><br/>Complaints: ${value}`
            );
        })
        .on('mouseleave blur', function () {
          const neighborhood = d3.select(this);
          neighborhood.transition().duration(150).attr('stroke-width', 0.6);
          tooltip.transition().duration(150).style('opacity', 0);
        })
    );
  svg
    .append('g')
    .attr('class', 'neighborhood-outline')
    .selectAll('path')
    .data(features)
    .join('path')
    .attr('d', path)
    .attr('fill', 'none')
    .attr('stroke', '#0f172a')
    .attr('stroke-width', 0.8)
    .attr('stroke-linejoin', 'round')
    .attr('stroke-linecap', 'round')
    .attr('pointer-events', 'none');

  if (colorScale) {
    const legendSteps = 5;
    const legendValues = d3.range(legendSteps).map((step) => {
      return (step / (legendSteps - 1)) * maxCount;
    });

    const legend = svg
      .append('g')
      .attr('class', 'choropleth-legend')
      .attr(
        'transform',
        `translate(${width - Math.min(140, width * 0.35)}, ${height - Math.min(
          160,
          height * 0.45
        )})`
      );

    legend
      .append('text')
      .attr('x', 0)
      .attr('y', 0)
      .attr('fill', '#1f2937')
      .attr('font-size', 12)
      .attr('font-weight', 600)
      .text('Complaints');

    const legendItem = legend
      .selectAll('g')
      .data(legendValues)
      .join('g')
      .attr('transform', (_, i) => `translate(0, ${i * 18 + 8})`);

    legendItem
      .append('rect')
      .attr('width', 12)
      .attr('height', 12)
      .attr('rx', 2)
      .attr('ry', 2)
      .attr('fill', (d) => colorScale(d));

    legendItem
      .append('text')
      .attr('x', 18)
      .attr('y', 10)
      .attr('fill', '#1f2937')
      .attr('font-size', 11)
      .text((d) => Math.round(d).toLocaleString());
  }
};
onMounted(async () => {
  try {
    const neighborhoodsUrl = new URL(
      '../data/LA_Times_Neighborhood_Boundaries.geojson',
      import.meta.url
    );
    const complaintsUrl = new URL('../data/complaints.csv', import.meta.url);

    const [neighborhoodGeojson, complaintRows] = await Promise.all([
      fetch(neighborhoodsUrl).then((res) => res.json()),
      d3.csv(complaintsUrl, (row) => ({
        neighborhood: row.neighborhood ? row.neighborhood.trim() : '',
      })),
    ]);

    neighborhoods.value = sanitizeFeatureCollection(neighborhoodGeojson);
    complaintCounts.value = buildComplaintCounts(complaintRows);
    drawChart();
    if (chartRef.value) {
      resizeObserver = new ResizeObserver(() => drawChart());
      resizeObserver.observe(chartRef.value);
    }
  } catch (err) {
    console.error('Failed to load LA Times neighborhood data:', err);
  }
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
</style>
