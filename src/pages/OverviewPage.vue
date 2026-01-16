<template>
  <div class="container">
    <section class="hero-card rounded-4 shadow-lg p-4 p-lg-5 mb-4">
      <div class="row gy-4 align-items-center">
        <div class="col-lg-6">
          <p class="hero-kicker text-uppercase small fw-semibold mb-2">
            Environmental Insights Dashboard
          </p>
          <h1 class="hero-headline display-5 fw-semibold mb-3">
            Global climate signals and urban air quality context
          </h1>
          <p class="hero-subhead lead mb-0">
            Track CO₂ emissions, renewable adoption, and Los Angeles air sensor networks to inform
            environmental decision-making.
          </p>
        </div>
        <div class="col-lg-6">
          <div class="row g-3">
            <div class="col-6" v-for="metric in metrics" :key="metric.label">
              <div class="card metric-card border-0 text-white">
                <div class="card-body">
                  <p class="metric-label text-uppercase small mb-1">{{ metric.label }}</p>
                  <h3 class="metric-value h2 mb-1">{{ metric.value }}</h3>
                  <p class="metric-caption small mb-0">{{ metric.caption }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="row g-4">
      <div class="col-12 col-xl-6">
        <WorldCO2Map />
      </div>
      <div class="col-12 col-xl-6">
        <WorldRenewablesBubbleMap />
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import WorldCO2Map from '../components/WorldCO2Map.vue';
import WorldRenewablesBubbleMap from '../components/WorldRenewablesBubbleMap.vue';

const metrics = ref([
  { label: 'Avg CO₂ per capita', value: '—', caption: 'Across focus countries' },
  { label: 'Median renewable share', value: '—', caption: 'Electricity generation mix' },
  { label: 'Highest PM2.5 sensor', value: '—', caption: 'Los Angeles monitoring network' },
  { label: 'LAX flight footprint', value: '—', caption: 'Annual CO₂ estimate' },
]);

onMounted(async () => {
  const [countries, sensors, flights] = await Promise.all([
    fetch(new URL('../data/country-indicators.json', import.meta.url)).then((res) => res.json()),
    fetch(new URL('../data/la-sensors.json', import.meta.url)).then((res) => res.json()),
    fetch(new URL('../data/lax-flight-flows.json', import.meta.url)).then((res) => res.json()),
  ]);

  const averageCo2 =
    countries.reduce((sum, d) => sum + d.co2MtPerCapita, 0) / countries.length;
  const sortedRenewables = [...countries.map((d) => d.renewableShare)].sort((a, b) => a - b);
  const mid = Math.floor(sortedRenewables.length / 2);
  const medianRenewable =
    sortedRenewables.length % 2 === 0
      ? (sortedRenewables[mid - 1] + sortedRenewables[mid]) / 2
      : sortedRenewables[mid];
  const highestSensor = sensors.reduce((prev, cur) => (cur.pm25 > prev.pm25 ? cur : prev), sensors[0]);
  const totalFlightCo2 = flights.reduce((sum, d) => sum + d.co2Tons, 0);

  metrics.value = [
    {
      label: 'Avg CO₂ per capita',
      value: `${averageCo2.toFixed(1)} t`,
      caption: 'Across focus countries',
    },
    {
      label: 'Median renewable share',
      value: `${medianRenewable.toFixed(1)}%`,
      caption: 'Electricity generation mix',
    },
    {
      label: 'Highest PM2.5 sensor',
      value: `${highestSensor.pm25.toFixed(1)} μg/m³`,
      caption: highestSensor.name,
    },
    {
      label: 'LAX flight footprint',
      value: `${totalFlightCo2.toLocaleString()} t`,
      caption: 'Annual CO₂ estimate',
    },
  ];
});
</script>

<style scoped>
.hero-card {
  position: relative;
  color: #111827;
  background: linear-gradient(135deg, rgba(14, 116, 144, 0.1) 0%, rgba(59, 130, 246, 0.18) 45%, rgba(14, 165, 233, 0.24) 100%);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(15, 23, 42, 0.08);
}

.hero-card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(120deg, rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.45));
  z-index: 0;
}

.hero-card > .row {
  position: relative;
  z-index: 1;
}

.hero-headline {
  color: rgba(17, 24, 39, 0.88);
  letter-spacing: -0.01em;
}

.hero-subhead {
  color: rgba(31, 41, 55, 0.74);
}

.hero-kicker {
  color: rgba(37, 99, 235, 0.7);
  letter-spacing: 0.08em;
}

.metric-card {
  background: rgba(15, 23, 42, 0.92);
  box-shadow: 0 1rem 2.5rem -1.5rem rgba(15, 23, 42, 0.75);
}

.metric-label {
  color: rgba(226, 232, 240, 0.75);
}

.metric-value {
  color: #f8fafc;
}

.metric-caption {
  color: rgba(226, 232, 240, 0.65);
}
</style>
