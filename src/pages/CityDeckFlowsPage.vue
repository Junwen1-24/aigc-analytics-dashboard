<template>
  <div class="container">
    <header class="mb-4">
      <h1 class="h3 fw-semibold mb-1">Industrial Pollution Flows</h1>
      <p class="text-muted mb-0">
        Deck.GL ArcLayer reveals the directional transport of emissions from key industrial hubs to
        nearby Los Angeles neighborhoods along prevailing wind corridors.
      </p>
    </header>

    <MapboxDeckArcLayer />
  </div>
</template>

<script setup>
import MapboxDeckArcLayer from '../components/MapboxDeckArcLayer.vue';
</script>
