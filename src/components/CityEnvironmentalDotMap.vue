<template>
  <section class="map-card">
    <header class="map-card__header">
      <div>
        <h2 class="h5 mb-1">Los Angeles City Boundary</h2>
        <p class="text-muted mb-0">
          Basemap of the Los Angeles city boundary rendered with D3.
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
const complaints = ref([]);

let resizeObserver;
const dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });

const drawChart = () => {
  if (!chartRef.value || !neighborhoods.value || !complaints.value.length) {
    return;
  }

  const container = chartRef.value;
  const width = container.clientWidth;
  if (!width) {
    // Defer rendering until the container receives a real layout size.
    return;
  }
  const computedHeight = Math.round(width * 0.65);
  const height = Math.max(1, Math.min(520, computedHeight));

  d3.select(container).selectAll('*').remove();

  const svg = d3
    .select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('role', 'img')
    .attr('aria-label', 'Los Angeles city boundary with complaint dots');

  const projection = d3.geoMercator().fitSize([width, height], neighborhoods.value);
  const path = d3.geoPath(projection);

  svg
    .append('g')
    .selectAll('path')
    .data(neighborhoods.value.features)
    .join('path')
    .attr('d', path)
    .attr('fill', '#f1f5f9')
    .attr('stroke', '#94a3b8')
    .attr('stroke-width', 0.6);

  // Overlay: city outline (stroke-only)
  svg
    .append('g')
    .attr('class', 'city-outline')
    .selectAll('path')
    .data(neighborhoods.value.features)
    .join('path')
    .attr('d', path)
    .attr('fill', 'none')
    .attr('stroke', '#334155')        // darker slate
    .attr('stroke-width', 1.6)
    .attr('stroke-linejoin', 'round')
    .attr('stroke-linecap', 'round');

  const tooltip = d3
    .select(container)
    .append('div')
    .attr('class', 'tooltip')
    .style('opacity', 0);

  const dotData = complaints.value.filter(
    (d) => Number.isFinite(d.longitude) && Number.isFinite(d.latitude)
  );
  const categories = Array.from(new Set(dotData.map((d) => d.category))).sort();
  const categoryScale = d3
    .scaleOrdinal()
    .domain(categories)
    .range(d3.schemeTableau10.slice(0, categories.length));

  svg
    .append('g')
    .attr('class', 'complaint-dots')
    .attr('aria-label', 'Complaint locations')
    .selectAll('circle')
    .data(dotData, (d) => d.id ?? `${d.longitude}-${d.latitude}`)
    .join('circle')
    .attr('cx', (d) => {
      const point = projection([d.longitude, d.latitude]);
      return point ? point[0] : null;
    })
    .attr('cy', (d) => {
      const point = projection([d.longitude, d.latitude]);
      return point ? point[1] : null;
    })
    .attr('r', 3)
    .attr('fill', (d) => categoryScale(d.category))
    .attr('stroke', '#0f172a')
    .attr('stroke-width', 0.5)
    .attr('aria-label', (d) => {
      const dateLabel = d.date ? dateFormatter.format(d.date) : 'unknown date';
      return `${d.category} complaint in ${d.neighborhood ?? 'Los Angeles'} on ${dateLabel}`;
    })
    .attr('tabindex', 0)
    .on('mouseenter focus', function (event, d) {
      const circle = d3.select(this);
      circle.raise().transition().duration(150).attr('r', 5).attr('stroke-width', 1.5);

      const [x, y] = projection([d.longitude, d.latitude]) ?? [0, 0];
      tooltip
        .style('opacity', 1)
        .style('left', `${x + 12}px`)
        .style('top', `${y + 12}px`)
        .html(
          `<strong>${d.category}</strong><br/>${d.neighborhood ?? 'Los Angeles'}<br/>${
            d.date ? dateFormatter.format(d.date) : 'Unknown date'
          }`
        );
    })
    .on('mouseleave blur', function () {
      const circle = d3.select(this);
      circle.transition().duration(150).attr('r', 3).attr('stroke-width', 0.5);
      tooltip.transition().duration(150).style('opacity', 0);
    });

  const legend = svg
    .append('g')
    .attr('class', 'complaint-legend')
    .attr('aria-label', 'Complaint categories legend')
    .attr(
      'transform',
      `translate(${Math.min(24, width * 0.05)}, ${Math.min(24, height * 0.05)})`
    );

  const legendItems = legend
    .selectAll('g')
    .data(categories)
    .join('g')
    .attr('transform', (_, i) => `translate(0, ${i * 20})`);

  legendItems
    .append('circle')
    .attr('cx', 0)
    .attr('cy', 0)
    .attr('r', 5)
    .attr('fill', (d) => categoryScale(d))
    .attr('stroke', '#0f172a')
    .attr('stroke-width', 0.5);

  legendItems
    .append('text')
    .attr('x', 12)
    .attr('y', 4)
    .attr('fill', '#1f2937')
    .attr('font-size', 12)
    .text((d) => d);
};

onMounted(async () => {
  try {
    const boundaryUrl = new URL('../data/City_Boundary_wgs84.geojson', import.meta.url);
    const complaintsUrl = new URL('../data/complaints.csv', import.meta.url);

    const [boundaryGeojson, complaintRows] = await Promise.all([
      fetch(boundaryUrl).then((res) => res.json()),
      d3.csv(complaintsUrl, (row) => {
        const latitude = Number.parseFloat(row.latitude);
        const longitude = Number.parseFloat(row.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          return null;
        }
        return {
          id: row.id,
          category: row.category,
          neighborhood: row.neighborhood,
          latitude,
          longitude,
          date: row.date ? new Date(row.date) : null,
        };
      }).then((rows) => rows.filter(Boolean)),
    ]);

    neighborhoods.value = boundaryGeojson;
    complaints.value = complaintRows;
    drawChart();
    if (chartRef.value) {
      resizeObserver = new ResizeObserver(() => drawChart());
      resizeObserver.observe(chartRef.value);
    }
  } catch (err) {
    console.error('Failed to load map data:', err);
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

.filter-group {
  display: flex;
  gap: 0.5rem;
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
