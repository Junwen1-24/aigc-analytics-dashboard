<template>
  <section class="map-card">
    <header class="map-card__header">
      <div>
        <h2 class="h5 mb-1">Pollution Transport Flows</h2>
        <p class="map-subhead mb-0">
          Deck.GL ArcLayer traces modeled pollutant drift from industrial hubs into nearby Los
          Angeles neighborhoods.
        </p>
      </div>
    </header>

    <div class="map-frame" aria-label="Mapbox with Deck.GL ArcLayer">
      <div ref="mapContainer" class="mapbox-surface"></div>
      <div v-if="legendItems.length" class="map-legend" aria-hidden="true">
        <p class="legend-title">Pollutant</p>
        <div v-for="item in legendItems" :key="item.pollutant" class="legend-item">
          <span class="legend-swatch" :style="{ backgroundColor: item.color }"></span>
          <span class="legend-label">{{ item.pollutant }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import mapboxgl from 'mapbox-gl';
import { MapboxOverlay } from '@deck.gl/mapbox/typed';
import { ArcLayer, ScatterplotLayer } from '@deck.gl/layers/typed';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken =
  'pk.eyJ1IjoianVud2VuMS0yNCIsImEiOiJjbWhhOTB0OXgxaHhoMmxwdWFuajg0dTg4In0._dlzG_ciC_aQKohMPH9MbA';

const mapContainer = ref(null);
const flows = ref([]);
const legendItems = ref([]);
const maxAnnualTons = ref(1);

let mapInstance;
let deckOverlay;
let resizeObserver;

const pollutantColors = {
  'NOₓ': [239, 68, 68],
  'PM2.5': [251, 191, 36],
  VOC: [59, 130, 246],
  'SO₂': [14, 165, 233],
  Methane: [16, 185, 129],
  Benzene: [147, 51, 234],
};

const getColor = (pollutant) => pollutantColors[pollutant] ?? [148, 163, 184];

const buildLegend = (data) => {
  const totals = data.reduce((acc, d) => {
    acc[d.pollutant] = (acc[d.pollutant] ?? 0) + (Number(d.annualTons) || 0);
    return acc;
  }, {});
  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .map(([pollutant]) => ({
      pollutant,
      color: `rgba(${getColor(pollutant).join(', ')}, 0.95)`,
    }));
};

const createArcLayer = () =>
  new ArcLayer({
    id: 'industrial-pollution-arcs',
    data: flows.value,
    pickable: true,
    autoHighlight: true,
    highlightColor: [255, 255, 255, 180],
    greatCircle: true,
    widthUnits: 'pixels',
    parameters: { depthTest: false },
    getSourcePosition: (d) => [d.sourceLon, d.sourceLat],
    getTargetPosition: (d) => [d.targetLon, d.targetLat],
    getSourceColor: (d) => [...getColor(d.pollutant), 220],
    getTargetColor: (d) => [...getColor(d.pollutant), 90],
    getWidth: (d) => {
      // map tonnage to stroke width in pixels
      const t = Math.max(0, Number(d.annualTons) || 0);
      return 2 + (6 * t) / Math.max(1, maxAnnualTons.value);
    },
    getTilt: 12
  });

const createEndpointLayer = () => {
  const pts = [];
  for (const d of flows.value) {
    pts.push({ lon: d.sourceLon, lat: d.sourceLat, role: 'source', pollutant: d.pollutant });
    pts.push({ lon: d.targetLon, lat: d.targetLat, role: 'target', pollutant: d.pollutant });
  }
  return new ScatterplotLayer({
    id: 'industrial-endpoints',
    data: pts,
    pickable: false,
    radiusUnits: 'pixels',
    parameters: { depthTest: false },
    getPosition: (d) => [d.lon, d.lat],
    getRadius: (d) => (d.role === 'source' ? 6 : 4),
    getFillColor: (d) => (d.role === 'source' ? [255, 255, 255, 180] : [...getColor(d.pollutant), 200]),
    stroked: true,
    getLineColor: [17, 24, 39, 200],
    lineWidthUnits: 'pixels',
    getLineWidth: 1
  });
};

const updateOverlay = () => {
  if (!deckOverlay) {
    return;
  }

  if (!flows.value.length) {
    deckOverlay.setProps({ layers: [] });
    return;
  }

  deckOverlay.setProps({
    layers: [createArcLayer(), createEndpointLayer()],
    getTooltip: ({ object }) =>
      object
        ? {
            text: `${object.source} → ${object.target}\n${object.pollutant} · ${Number(object.annualTons).toLocaleString()} t/yr`,
          }
        : null,
  });
};

watch(
  flows,
  (next) => {
    if (next.length) {
      legendItems.value = buildLegend(next);
      updateOverlay();
    }
  },
  { immediate: true }
);

const loadData = async () => {
  const url = new URL('../data/industrial-pollution-flows.json', import.meta.url);
  const response = await fetch(url);
  const raw = await response.json();
  flows.value = raw.map((d) => ({
    ...d,
    annualTons: Number(d.annualTons),
    sourceLat: Number(d.sourceLat),
    sourceLon: Number(d.sourceLon),
    targetLat: Number(d.targetLat),
    targetLon: Number(d.targetLon),
  }));
  maxAnnualTons.value = flows.value.reduce((m, d) => Math.max(m, d.annualTons || 0), 1);
};

const initMap = () => {
  if (!mapContainer.value) {
    return;
  }

  mapInstance = new mapboxgl.Map({
    container: mapContainer.value,
    style: 'mapbox://styles/mapbox/dark-v11',
    center: [-118.28, 34.0],
    zoom: 9.3,
    minZoom: 8.2,
    maxZoom: 13.5,
  });

  mapInstance.on('load', () => {
    try {
      const lons = flows.value.flatMap((d) => [d.sourceLon, d.targetLon]);
      const lats = flows.value.flatMap((d) => [d.sourceLat, d.targetLat]);
      if (lons.length && lats.length) {
        const minLng = Math.min(...lons);
        const maxLng = Math.max(...lons);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        mapInstance.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 40, duration: 500 });
      }
    } catch {}

    deckOverlay = new MapboxOverlay({
      layers: [],
      getTooltip: () => null,
    });
    mapInstance.addControl(deckOverlay);
    updateOverlay();
  });
};

onMounted(async () => {
  await loadData();
  initMap();

  if (mapContainer.value) {
    resizeObserver = new ResizeObserver(() => {
      if (mapInstance) {
        mapInstance.resize();
      }
    });
    resizeObserver.observe(mapContainer.value);
  }
});

onBeforeUnmount(() => {
  if (resizeObserver && mapContainer.value) {
    resizeObserver.unobserve(mapContainer.value);
  }
  if (mapInstance && deckOverlay) {
    mapInstance.removeControl(deckOverlay);
  }
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }
});
</script>

<style scoped>
.map-card {
  background: #0f1729;
  border-radius: 0.75rem;
  padding: 1.5rem;
  box-shadow: 0 1.5rem 3rem -1.5rem rgba(15, 23, 42, 0.45);
  color: #e2e8f0;
}

.map-card__header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1.25rem;
}

.map-subhead {
  color: rgba(226, 232, 240, 0.85);
  max-width: 34rem;
}

.map-frame {
  position: relative;
  width: 100%;
  min-height: 480px;
  border-radius: 0.75rem;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.25);
}

.mapbox-surface {
  position: absolute;
  inset: 0;
}

.map-legend {
  position: absolute;
  right: 1rem;
  top: 1rem;
  background: rgba(15, 23, 42, 0.9);
  color: #f8fafc;
  padding: 0.75rem;
  border-radius: 0.5rem;
  box-shadow: 0 1rem 2rem -1rem rgba(15, 23, 42, 0.55);
  font-size: 0.8rem;
  min-width: 150px;
  border: 1px solid rgba(148, 163, 184, 0.25);
}

.legend-title {
  margin: 0 0 0.35rem;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgba(226, 232, 240, 0.85);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.35rem;
}

.legend-item:first-of-type {
  margin-top: 0;
}

.legend-swatch {
  width: 0.9rem;
  height: 0.9rem;
  border-radius: 0.25rem;
  border: 1px solid rgba(15, 23, 42, 0.35);
  flex-shrink: 0;
}

.legend-label {
  color: rgba(226, 232, 240, 0.9);
}
</style>
