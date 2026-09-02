const fs = require('fs');

// 1. AppLayout.tsx
let appLayout = fs.readFileSync('src/components/layout/AppLayout.tsx', 'utf8');

// Disable in menuItems array
appLayout = appLayout.replace(
  "{ id: 'gis-map', label: 'Bản đồ thiết bị', icon: <MapPin className=\"w-4 h-4\" />, path: '/gis-map' },",
  "// { id: 'gis-map', label: 'Bản đồ thiết bị', icon: <MapPin className=\"w-4 h-4\" />, path: '/gis-map' },"
);

// Disable in mobile menu
appLayout = appLayout.replace(
  "{ id: 'gis-map', label: 'Bản đồ thiết bị', path: '/gis-map' }",
  "// { id: 'gis-map', label: 'Bản đồ thiết bị', path: '/gis-map' }"
);

fs.writeFileSync('src/components/layout/AppLayout.tsx', appLayout);

// 2. App.tsx
let app = fs.readFileSync('src/App.tsx', 'utf8');

// Disable import MapPage
app = app.replace(
  "import { MapPage } from './pages/MapPage';",
  "// import { MapPage } from './pages/MapPage';"
);

// Disable route case
app = app.replace(
  "      case '/gis-map':\n        return (\n          <MapPage\n            onNavigateToDetail={(id) => navigateTo(`/equipment/detail/${id}`)}\n          />\n        );",
  "      // case '/gis-map':\n      //   return (\n      //     <MapPage\n      //       onNavigateToDetail={(id) => navigateTo(`/equipment/detail/${id}`)}\n      //     />\n      //   );"
);

fs.writeFileSync('src/App.tsx', app);
