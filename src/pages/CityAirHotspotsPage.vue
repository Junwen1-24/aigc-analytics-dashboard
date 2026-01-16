<template>
  <div class="container">
    <header class="mb-4">
      <h1 class="h3 fw-semibold mb-1">Air Pollution Hotspots</h1>
      <p class="text-muted mb-0">
        Heatmap analysis layers 311 complaints with PM₂.₅ sensor readings to spotlight persistent
        air-quality trouble spots for mitigation planning.
      </p>
    </header>

    <MapboxDeckHeatmap />
  </div>
</template>

<script setup>
import MapboxDeckHeatmap from '../components/MapboxDeckHeatmap.vue';
</script>
