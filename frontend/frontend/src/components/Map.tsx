import React, { useEffect } from 'react';
import { Box } from '@mui/material';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const Map: React.FC = () => {
  useEffect(() => {
    const map: L.Map = L.map('map').setView([51.505, -0.09], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    return () => map.remove();
  }, []);

  return (
    <Box
      id="map"
      sx={{
        flex: 1,
        height: '100%',
        '& .leaflet-container': {
          height: '100%',
          width: '100%',
        },
      }}
    />
  );
};

export default Map; 