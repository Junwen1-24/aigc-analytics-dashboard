import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'overview',
    component: () => import('../pages/OverviewPage.vue'),
  },
  {
    path: '/city-environment',
    name: 'city-environment',
    component: () => import('../pages/CityEnvironmentalPage.vue'),
  },
  {
    path: '/city-mapbox',
    name: 'city-mapbox',
    component: () => import('../pages/CityMapboxChoroplethPage.vue'),
  },
  {
    path: '/city-flows',
    name: 'city-flows',
    component: () => import('../pages/CityDeckFlowsPage.vue'),
  },
  {
    path: '/city-air-hotspots',
    name: 'city-air-hotspots',
    component: () => import('../pages/CityAirHotspotsPage.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});

export default router;
