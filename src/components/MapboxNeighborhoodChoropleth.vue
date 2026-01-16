<template>
  <section class="map-card">
    <header class="map-card__header">
      <div>
        <h2 class="h5 mb-1">Mapbox Choropleth · LA Neighborhood Complaints</h2>
        <p class="text-muted mb-0">
          Neighborhoods shaded by 2024 LA 311 environmental complaints. Hover a polygon for totals.
        </p>
      </div>
    </header>
    <div class="map-frame" aria-label="Mapbox choropleth map">
      <div ref="mapContainer" class="mapbox-surface"></div>
      <div v-if="legendItems.length" class="map-legend" aria-hidden="true">
        <p class="legend-title">Complaints</p>
        <div v-for="item in legendItems" :key="item.label" class="legend-item">
          <span class="legend-swatch" :style="{ backgroundColor: item.color }"></span>
          <span class="legend-label">{{ item.label }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
import * as d3 from 'd3';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken =
  'pk.eyJ1IjoianVud2VuMS0yNCIsImEiOiJjbWhhOTB0OXgxaHhoMmxwdWFuajg0dTg4In0._dlzG_ciC_aQKohMPH9MbA';

const mapContainer = ref(null);
const legendItems = ref([]);
let mapInstance;
let resizeObserver;

const sanitizeNeighborhoods = (collection) => {
  const areaThreshold = 10;
  return {
    ...collection,
    features: collection.features
      .map((feature) => {
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
      })
      .filter(Boolean),
  };
};

const loadComplaintCounts = (rows) => {
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

const createColorRamp = (counts) => {
  const positive = counts.filter((value) => value > 0).sort((a, b) => a - b);
  const palette = d3.schemeYlOrRd[6];

  if (!positive.length) {
    const color = '#e2e8f0';
    return {
      expression: null,
      legend: [{ label: '0', color }],
    };
  }

  const bucketCount = Math.min(palette.length - 1, positive.length);
  const thresholds = [];
  for (let i = 1; i <= bucketCount; i += 1) {
    const quantile = d3.quantile(positive, i / (bucketCount + 1));
    if (quantile && quantile > 0) {
      thresholds.push(Math.round(quantile));
    }
  }

  const dedupedThresholds = Array.from(new Set(thresholds))
    .filter((value) => value > 0)
    .sort((a, b) => a - b);

  const expression = ['step', ['get', 'complaints'], palette[0]];
  const legend = [{ label: '0', color: palette[0] }];

  if (!dedupedThresholds.length) {
    const fallbackThreshold = Math.max(1, positive[0]);
    expression.push(fallbackThreshold, palette[1]);
    legend.push({ label: `≥ ${fallbackThreshold}`, color: palette[1] });
    return { expression, legend };
  }

  dedupedThresholds.forEach((threshold, index) => {
    const color = palette[Math.min(index + 1, palette.length - 1)];
    expression.push(threshold, color);
    legend.push({ label: `≥ ${threshold}`, color });
  });

  return { expression, legend };
};

const initMap = async () => {
  if (!mapContainer.value) {
    return;
  }

  const neighborhoodsUrl = new URL(
    '../data/LA_Times_Neighborhood_Boundaries.geojson',
    import.meta.url
  );
  const complaintsUrl = new URL('../data/complaints.csv', import.meta.url);

  const [neighborhoods, complaintRows] = await Promise.all([
    fetch(neighborhoodsUrl).then((res) => res.json()),
    d3.csv(complaintsUrl, (row) => ({
      neighborhood: row.neighborhood ? row.neighborhood.trim() : '',
    })),
  ]);

  const complaintCounts = loadComplaintCounts(complaintRows);
  const sanitized = sanitizeNeighborhoods(neighborhoods);
  const counts = [];

  sanitized.features = sanitized.features.map((feature) => {
    const name = feature.properties?.name ?? '';
    const count = complaintCounts.get(name) ?? 0;
    counts.push(count);
    return {
      ...feature,
      properties: {
        ...feature.properties,
        complaints: count,
      },
    };
  });

  mapInstance = new mapboxgl.Map({
    container: mapContainer.value,
    style: 'mapbox://styles/mapbox/light-v11',
    center: [-118.27, 34.01],
    zoom: 9.4,
    minZoom: 8.5,
    maxZoom: 13,
  });

  mapInstance.on('load', () => {
    const { expression: fillExpression, legend } = createColorRamp(counts);
    legendItems.value = legend;

    mapInstance.addSource('la-neighborhoods', {
      type: 'geojson',
      data: sanitized,
      promoteId: 'OBJECTID',
    });

    mapInstance.addLayer({
      id: 'la-neighborhoods-fill',
      type: 'fill',
      source: 'la-neighborhoods',
      paint: {
        'fill-color': fillExpression ?? '#e2e8f0',
        'fill-opacity': 0.85,
      },
    });

    mapInstance.addLayer({
      id: 'la-neighborhoods-outline',
      type: 'line',
      source: 'la-neighborhoods',
      paint: {
        'line-color': '#1f2937',
        'line-width': 0.6,
      },
    });

    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
    });

    mapInstance.on('mousemove', 'la-neighborhoods-fill', (event) => {
      mapInstance.getCanvas().style.cursor = 'pointer';
      const feature = event.features?.[0];
      if (!feature) {
        popup.remove();
        return;
      }
      const { name, complaints } = feature.properties ?? {};
      const description = `<strong>${name ?? 'Neighborhood'}</strong><br/>Complaints: ${
        complaints ?? 0
      }`;
      popup.setLngLat(event.lngLat).setHTML(description).addTo(mapInstance);
    });

    mapInstance.on('mouseleave', 'la-neighborhoods-fill', () => {
      mapInstance.getCanvas().style.cursor = '';
      popup.remove();
    });
  });
};

onMounted(async () => {
  await initMap();
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
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
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
  min-height: 460px;
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
  bottom: 1rem;
  background: rgba(15, 23, 42, 0.82);
  color: #f8fafc;
  padding: 0.75rem;
  border-radius: 0.5rem;
  box-shadow: 0 1rem 2rem -1rem rgba(15, 23, 42, 0.5);
  font-size: 0.8rem;
  min-width: 140px;
}

.legend-title {
  margin: 0 0 0.25rem;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgba(248, 250, 252, 0.85);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.3rem;
}

.legend-item:first-of-type {
  margin-top: 0;
}

.legend-swatch {
  width: 0.9rem;
  height: 0.9rem;
  border-radius: 0.2rem;
  border: 1px solid rgba(15, 23, 42, 0.4);
  flex-shrink: 0;
}

.legend-label {
  color: rgba(248, 250, 252, 0.9);
}
</style>
