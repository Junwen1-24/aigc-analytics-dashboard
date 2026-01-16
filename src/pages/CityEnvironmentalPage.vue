<template>
  <div class="container">
    <header class="mb-4">
      <h1 class="h3 fw-semibold mb-1">City Environmental Activity</h1>
      <p class="text-muted mb-0">
        Explore recent 311 environmental complaints across Los Angeles neighborhoods with category
        filtering and hover details.
      </p>
    </header>

    <section class="row g-4">
      <div class="col-12 col-xl-6">
        <CityEnvironmentalDotMap />
      </div>
      <div class="col-12 col-xl-6">
        <LATimesNeighborhoodMap />
      </div>
    </section>
  </div>
</template>

<script setup>
import CityEnvironmentalDotMap from '../components/CityEnvironmentalDotMap.vue';
import LATimesNeighborhoodMap from '../components/LATimesNeighborhoodMap.vue';
</script>
