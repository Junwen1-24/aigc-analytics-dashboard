# Environmental Data Dashboard

A comprehensive Vue.js dashboard for visualizing environmental data including air quality, emissions, renewable energy, and pollution flows across cities and countries.

## Features

- **World Maps**: D3 choropleth map for CO2 emissions and proportional bubble map for renewable energy data
- **City Maps**: 
  - D3 dot map for environmental complaints
  - Vega-Embed choropleth map for neighborhood data
  - Mapbox interactive neighborhood choropleth
- **Advanced Visualizations**: 
  - Mapbox + DeckGL arc layer for flight flow patterns
  - Mapbox + DeckGL heatmap for PM2.5 air quality data
- **Interactive UI**: Multi-page Vue app with Bootstrap responsive layout

## Technologies

- **Frontend**: Vue 3, Vite
- **Mapping**: D3.js, Vega-Embed, Mapbox GL, DeckGL
- **Data Format**: GeoJSON, CSV, JSON

## Getting Started

### Installation

```bash
npm install
```

### Running the Development Server

```bash
npm run dev
```

The dashboard will be available at `http://localhost:5173`

### Building for Production

```bash
npm run build
```

## Project Structure

```
src/
├── components/       # Vue map components
├── pages/           # Dashboard pages
├── data/            # GeoJSON, CSV, and JSON data files
└── App.vue          # Main application component
```

## Data Sources

- Air quality data from LA environmental sensors
- Flight flow data from LAX
- Renewable energy indicators from country-level datasets
- Neighborhood boundaries from LA Times

## Navigation

The dashboard includes 5 main pages accessible via navigation:

1. **Overview** - Global environmental statistics
2. **City Environmental Data** - LA-specific environmental metrics
3. **City Air Hotspots** - Detailed air quality visualization
4. **City Deck Flows** - Flight and pollution flow patterns
5. **Neighborhood Choropleth** - Detailed neighborhood-level data
