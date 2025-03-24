import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

const Map: React.FC = () => {
  const mapRef = useRef<L.Map | null>(null);
  const navRouteVisibilityRef = useRef<Record<string, boolean>>({});
  const poiLayerGroupRef = useRef<L.LayerGroup>(L.layerGroup());
  const bikeStandLayerGroupRef = useRef<L.LayerGroup>(L.layerGroup());
  const repairStationLayerGroupRef = useRef<L.LayerGroup>(L.layerGroup());
  const chargingStationLayerGroupRef = useRef<L.LayerGroup>(L.layerGroup());
  const nextbikeLayerGroupRef = useRef<L.LayerGroup>(L.layerGroup());
  const routePointLayerGroupRef = useRef<L.LayerGroup>(L.layerGroup());

  const MIN_ZOOM_LEVEL_NEXTBIKE = 13;

  const setCurrentZoom = (zoom: number) => {
    // Implementation of setCurrentZoom
  };

  const updateLayerVisibility = (zoom: number) => {
    // Implementation of updateLayerVisibility
  };

  const fetchAndDisplayNextbikeStations = () => {
    // Implementation of fetchAndDisplayNextbikeStations
  };

  const fetchAndDisplayBikeStands = () => {
    // Implementation of fetchAndDisplayBikeStands
  };

  const fetchAndDisplayRepairStations = () => {
    // Implementation of fetchAndDisplayRepairStations
  };

  const fetchAndDisplayChargingStations = () => {
    // Implementation of fetchAndDisplayChargingStations
  };

  const fetchAndDisplayPOIs = () => {
    // Implementation of fetchAndDisplayPOIs
  };

  useEffect(() => {
    console.log('Initialisiere Map');
    if (!mapRef.current) {
      console.log('Erstelle neue Map-Instanz');
      const newMap = L.map('map', {
        center: [52.520008, 13.404954],
        zoom: 13,
        layers: [
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
          })
        ]
      });
      
      mapRef.current = newMap;

      navRouteVisibilityRef.current = {};

      poiLayerGroupRef.current = L.layerGroup();
      bikeStandLayerGroupRef.current = L.layerGroup();
      repairStationLayerGroupRef.current = L.layerGroup();
      chargingStationLayerGroupRef.current = L.layerGroup();
      nextbikeLayerGroupRef.current = L.layerGroup();
      routePointLayerGroupRef.current = L.layerGroup();
      
      setCurrentZoom(newMap.getZoom());
      
      newMap.on('zoomend', () => {
        const newZoom = newMap.getZoom();
        setCurrentZoom(newZoom);
        
        updateLayerVisibility(newZoom);
      });
      
      updateLayerVisibility(newMap.getZoom());
      
      const NextbikeUpdateControl = L.Control.extend({
        options: {
          position: 'topright'
        },
        onAdd: function() {
          const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
          const button = L.DomUtil.create('a', 'nextbike-update-button', container);
          button.href = '#';
          button.title = 'Nextbike-Stationen im aktuellen Bereich laden';
          button.innerHTML = '<div style="width: 30px; height: 30px; display: flex; justify-content: center; align-items: center; font-weight: bold; font-size: 14px; background-color: #3f51b5; color: white; border-radius: 4px;">NB</div>';
          
          L.DomEvent.disableClickPropagation(button);
          L.DomEvent.on(button, 'click', function() {
            const zoom = newMap.getZoom();
            if (zoom < MIN_ZOOM_LEVEL_NEXTBIKE) {
              alert(`Bitte zoomen Sie näher heran (mind. Zoom-Level ${MIN_ZOOM_LEVEL_NEXTBIKE}), um Nextbike-Stationen zu laden.`);
              return;
            }
            console.log('Nextbike-Stationen im aktuellen Bereich werden geladen...');
            fetchAndDisplayNextbikeStations();
          });
          
          return container;
        }
      });
      
      newMap.addControl(new NextbikeUpdateControl());
    }
  }, []);

  useEffect(() => {
    fetchAndDisplayBikeStands();
    fetchAndDisplayRepairStations();
    fetchAndDisplayChargingStations();
    fetchAndDisplayPOIs();
    
    const updateOnZoomChange = () => {
      if (mapRef.current) {
        const zoom = mapRef.current.getZoom();
        console.log('Zoom changed to:', zoom);
        updateLayerVisibility(zoom);
      }
    };
    
    if (mapRef.current) {
      mapRef.current.on('zoomend', updateOnZoomChange);
      updateOnZoomChange();
    }
    
    return () => {
      if (mapRef.current) {
        mapRef.current.off('zoomend', updateOnZoomChange);
      }
    };
  }, [updateLayerVisibility]);

  return (
    <div id="map" style={{ width: '100%', height: '300px' }} />
  );
};

export default Map; 