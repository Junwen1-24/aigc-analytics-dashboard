<template>
  <section class="map-card">
    <header class="map-card__header">
      <div>
        <h2 class="h5 mb-1">Air Quality Hotspots</h2>
        <p class="map-subhead mb-0">
          Deck.GL Heatmap blends 311 environmental complaints with sensor readings to reveal
          persistent pollution hubs across Los Angeles. Toggle pollutant weightings to interrogate
          different patterns.
        </p>
      </div>
      <div class="toggle-group" role="group" aria-label="Heatmap pollutant weighting">
        <button
          v-for="option in pollutantOptions"
          :key="option.id"
          type="button"
          class="btn btn-sm"
          :class="[
            'btn-toggle',
            option.id === activePollutant ? 'btn-primary' : 'btn-outline-light text-white',
          ]"
          :title="`切换至 ${option.label} 权重`"
          @click="setPollutant(option.id)"
        >
          {{ option.label }}
        </button>
      </div>
      <button
        type="button"
        class="btn btn-sm btn-outline-light text-white reset-view"
        title="重置地图视角"
        @click="resetView"
      >
        Reset View
      </button>
    </header>

    <div class="map-frame" aria-label="Mapbox heatmap of pollution hotspots">
      <div ref="mapContainer" class="mapbox-surface"></div>
      <div class="map-legend" aria-hidden="true">
        <p class="legend-title">Relative Intensity</p>
        <p class="legend-subtitle">Weighting: {{ activePollutantMeta.label }}</p>
        <div class="gradient-bar"></div>
        <div class="legend-scale">
          <span>lower</span>
          <span>higher</span>
        </div>
        <p class="legend-note">Sensors · AQ network 2024 · LA 311 complaints</p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import * as d3 from 'd3';
import mapboxgl from 'mapbox-gl';
import { MapboxOverlay } from '@deck.gl/mapbox/typed';
import { HeatmapLayer } from '@deck.gl/aggregation-layers/typed';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken =
  'pk.eyJ1IjoianVud2VuMS0yNCIsImEiOiJjbWhhOTB0OXgxaHhoMmxwdWFuajg0dTg4In0._dlzG_ciC_aQKohMPH9MbA';

const mapContainer = ref(null);
const heatmapPoints = ref([]);
const activePollutant = ref('pm25');

const pollutantOptions = [
  { id: 'pm25', label: 'PM₂.₅', description: 'Fine particulate matter' },
  { id: 'nox', label: 'NOₓ', description: 'Nitrogen oxides' },
  { id: 'ozone', label: 'O₃', description: 'Ground-level ozone' },
];

const SENSOR_MULTIPLIER = {
  pm25: 3.8,
  nox: 4.6,
  ozone: 4.2,
};

const RADIUS_BY_POLLUTANT = {
  pm25: 70,
  nox: 55,
  ozone: 48,
};

const DEFAULT_VIEW = {
  center: [-118.28, 34.0],
  zoom: 9.5,
};

const POLLUTANT_UNIT = {
  pm25: 'µg/m³',
  nox: 'ppb',
  ozone: 'ppb',
};

const activePollutantMeta = computed(
  () => pollutantOptions.find((option) => option.id === activePollutant.value) ?? pollutantOptions[0]
);

const setPollutant = (id) => {
  if (activePollutant.value !== id) {
    activePollutant.value = id;
    updateOverlay();
  }
};

const resetView = () => {
  if (!mapInstance) {
    return;
  }
  mapInstance.easeTo({
    center: DEFAULT_VIEW.center,
    zoom: DEFAULT_VIEW.zoom,
    bearing: 0,
    pitch: 0,
    duration: 1200,
  });
};

let mapInstance;
let deckOverlay;
let resizeObserver;

const normalize = (value, min, max) => {
  if (!Number.isFinite(value)) return 0;
  if (max === min) return 0;
  return (value - min) / (max - min);
};

const loadPoints = async () => {
  const complaintsUrl = new URL('../data/complaints.csv', import.meta.url);
  const sensorsUrl = new URL('../data/la-sensors.json', import.meta.url);

  const [complaintRows, sensors] = await Promise.all([
    d3.csv(complaintsUrl, (row) => {
      const latitude = Number.parseFloat(row.latitude);
      const longitude = Number.parseFloat(row.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return null;
      }
      return {
        latitude,
        longitude,
        baseWeight: 1,
        source: 'Complaint',
        label: row.category ?? 'Complaint',
      };
    }).then((rows) => rows.filter(Boolean)),
    fetch(sensorsUrl).then((res) => res.json()),
  ]);

  const pmValues = sensors.map((sensor) => Number(sensor.pm25 ?? 0)).filter(Number.isFinite);
  const noxValues = sensors.map((sensor) => Number(sensor.nox ?? sensor.no2 ?? 0)).filter(Number.isFinite);
  const ozoneValues = sensors.map((sensor) => Number(sensor.ozone ?? 0)).filter(Number.isFinite);

  const pmExtent = d3.extent(pmValues.length ? pmValues : [0, 1]);
  const noxExtent = d3.extent(noxValues.length ? noxValues : [0, 1]);
  const ozoneExtent = d3.extent(ozoneValues.length ? ozoneValues : [0, 1]);

  const sensorPoints = sensors
    .map((sensor) => ({
      latitude: Number(sensor.latitude),
      longitude: Number(sensor.longitude),
      rawPm25: Number(sensor.pm25 ?? 0),
      rawNox: Number(sensor.nox ?? sensor.no2 ?? 0),
      rawOzone: Number(sensor.ozone ?? 0),
      pm25: normalize(Number(sensor.pm25 ?? 0), pmExtent[0], pmExtent[1]),
      nox: normalize(Number(sensor.nox ?? sensor.no2 ?? 0), noxExtent[0], noxExtent[1]),
      ozone: normalize(Number(sensor.ozone ?? 0), ozoneExtent[0], ozoneExtent[1]),
      source: 'Sensor',
      label: `${sensor.name}\nPM₂.₅ ${sensor.pm25?.toFixed?.(1) ?? '--'} μg/m³ · NOₓ ${
        sensor.nox ?? '--'
      } ppb · O₃ ${sensor.ozone ?? '--'} ppb`,
    }))
    .filter((d) => Number.isFinite(d.latitude) && Number.isFinite(d.longitude));

  heatmapPoints.value = [...complaintRows, ...sensorPoints];
};

const computeWeight = (point) => {
  if (point.source === 'Complaint') {
    const complaintWeights = {
      pm25: 0.25,
      nox: 0.06,
      ozone: 0.08,
    };
    return (complaintWeights[activePollutant.value] ?? 0.2) * (point.baseWeight ?? 1);
  }

  if (point.source === 'Sensor') {
    const pollutantKey = activePollutant.value;
    const value = point[pollutantKey] ?? 0;
    return value * (SENSOR_MULTIPLIER[pollutantKey] ?? 3.5);
  }

  return 0;
};

const createHeatmapLayer = () =>
  new HeatmapLayer({
    id: 'la-air-quality-heatmap',
    data: heatmapPoints.value,
    getPosition: (d) => [d.longitude, d.latitude],
    getWeight: (d) => computeWeight(d),
    radiusPixels: RADIUS_BY_POLLUTANT[activePollutant.value] ?? 55,
    intensity: 1.25,
    threshold: 0.08,
    aggregation: 'MEAN',
    colorRange: [
      [30, 64, 175, 0],
      [37, 99, 235, 80],
      [59, 130, 246, 140],
      [45, 197, 116, 180],
      [250, 204, 21, 210],
      [239, 68, 68, 240],
    ],
  });

const updateOverlay = () => {
  if (!deckOverlay) {
    return;
  }

  if (!heatmapPoints.value.length) {
    deckOverlay.setProps({ layers: [] });
    return;
  }

  const pollutantLabel =
    { pm25: 'PM₂.₅', nox: 'NOₓ', ozone: 'O₃' }[activePollutant.value] ?? 'Pollutant';

  deckOverlay.setProps({
    layers: [createHeatmapLayer()],
    getTooltip: ({ object }) => {
      if (!object) {
        return null;
      }
      const { position, colorValue } = object;
      const points = object.points ?? [];
      const complaintCount = points.filter((d) => d.source === 'Complaint').length;
      const sensors = points.filter((d) => d.source === 'Sensor');
      const rawKey =
        activePollutant.value === 'pm25'
          ? 'rawPm25'
          : activePollutant.value === 'nox'
          ? 'rawNox'
          : 'rawOzone';
      const unit = POLLUTANT_UNIT[activePollutant.value] ?? '';
      let sensorLine = 'No sensor nearby';
      if (sensors.length) {
        const avgValue =
          sensors.reduce((sum, sensor) => sum + (sensor[rawKey] ?? 0), 0) / sensors.length;
        sensorLine = `Sensor avg: ${avgValue.toFixed(1)} ${unit}`;
      }

      return {
        text: `${pollutantLabel} hotspot: ${colorValue.toFixed(2)}\n${sensorLine}\nComplaints: ${
          complaintCount || '0'
        }\nLon ${position[0].toFixed(3)}, Lat ${position[1].toFixed(3)}`,
      };
    },
  });
};

const initMap = () => {
  if (!mapContainer.value) {
    return;
  }

  mapInstance = new mapboxgl.Map({
    container: mapContainer.value,
    style: 'mapbox://styles/mapbox/dark-v11',
    center: DEFAULT_VIEW.center,
    zoom: DEFAULT_VIEW.zoom,
    minZoom: 8.4,
    maxZoom: 13.5,
  });

  mapInstance.on('load', () => {
    deckOverlay = new MapboxOverlay({
      layers: [],
    });
    mapInstance.addControl(deckOverlay);
    updateOverlay();
  });
};

watch(heatmapPoints, () => updateOverlay(), { deep: false });
watch(activePollutant, () => updateOverlay());

onMounted(async () => {
  await loadPoints();
  initMap();
  updateOverlay();

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
  align-items: center;
  margin-bottom: 1.25rem;
}

.map-subhead {
  color: rgba(226, 232, 240, 0.82);
  max-width: 36rem;
}

.toggle-group {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.btn-toggle {
  border-radius: 999px;
  border-width: 1px;
  padding-inline: 0.85rem;
  padding-block: 0.35rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.reset-view {
  border-radius: 999px;
  border-width: 1px;
  font-weight: 600;
}

.map-frame {
  position: relative;
  width: 100%;
  min-height: 480px;
  border-radius: 0.75rem;
  overflow: hidden;
}

.mapbox-surface {
  position: absolute;
  inset: 0;
}

.map-legend {
  position: absolute;
  right: 1rem;
  top: 1rem;
  background: rgba(15, 23, 42, 0.85);
  color: #f8fafc;
  padding: 0.75rem 0.9rem;
  border-radius: 0.5rem;
  box-shadow: 0 1rem 2rem -1rem rgba(15, 23, 42, 0.55);
  font-size: 0.8rem;
  min-width: 160px;
}

.legend-title {
  margin: 0 0 0.35rem;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgba(226, 232, 240, 0.85);
}

.legend-subtitle {
  margin: 0 0 0.4rem;
  font-size: 0.75rem;
  color: rgba(226, 232, 240, 0.7);
}

.gradient-bar {
  width: 100%;
  height: 0.85rem;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    rgba(30, 64, 175, 0.2) 0%,
    rgba(30, 128, 240, 0.5) 25%,
    rgba(34, 197, 94, 0.65) 50%,
    rgba(250, 204, 21, 0.85) 75%,
    rgba(239, 68, 68, 1) 100%
  );
  border: 1px solid rgba(15, 23, 42, 0.35);
}

.legend-scale {
  display: flex;
  justify-content: space-between;
  font-size: 0.7rem;
  margin-top: 0.35rem;
  color: rgba(226, 232, 240, 0.65);
}

.legend-note {
  margin: 0.5rem 0 0;
  font-size: 0.7rem;
  color: rgba(226, 232, 240, 0.55);
}
</style>
