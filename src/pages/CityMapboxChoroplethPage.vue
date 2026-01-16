<template>
  <div class="container">
    <header class="mb-4">
      <h1 class="h3 fw-semibold mb-1">Mapbox Neighborhood Choropleth</h1>
      <p class="text-muted mb-0">
        Interactive Mapbox GL choropleth shading Los Angeles neighborhoods by the volume of 2024
        environmental complaints.
      </p>
    </header>

    <MapboxNeighborhoodChoropleth />
  </div>
</template>

<script setup>
import MapboxNeighborhoodChoropleth from '../components/MapboxNeighborhoodChoropleth.vue';
</script>
