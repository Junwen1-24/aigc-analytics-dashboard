<template>
  <div class="app-wrapper">
    <nav class="navbar navbar-dark bg-dark shadow-sm">
      <div class="container-fluid flex-wrap gap-3">
        <RouterLink class="navbar-brand fw-semibold" to="/">Enviro Atlas</RouterLink>
        <div class="d-flex flex-wrap gap-2">
          <RouterLink
            v-for="item in navItems"
            :key="item.to"
            class="btn btn-outline-light btn-sm"
            active-class="active"
            :to="item.to"
          >
            {{ item.label }}
          </RouterLink>
        </div>
      </div>
    </nav>

    <main class="py-4">
      <RouterView />
    </main>

    <footer class="bg-light py-3 border-top">
      <div class="container text-center text-muted small">
        Environmental Insights Dashboard · Built with Vue, D3, and TopoJSON
      </div>
    </footer>
  </div>
</template>

<script setup>
import { RouterLink, RouterView } from 'vue-router';

const navItems = [
  { to: '/', label: 'Overview' },
  { to: '/city-environment', label: 'City Environmental Activity' },
  { to: '/city-mapbox', label: 'Mapbox Choropleth' },
  { to: '/city-flows', label: 'DeckGL Pollution Flows' },
  { to: '/city-air-hotspots', label: 'DeckGL Heatmap' },
];
</script>

<style scoped>
.app-wrapper {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

main {
  flex: 1;
}

.btn.active {
  background-color: #f8fafc;
  color: #0f172a;
}
</style>
