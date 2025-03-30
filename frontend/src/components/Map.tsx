import React, { useEffect, useState, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Box, Tooltip, Fab, Dialog, DialogTitle, DialogContent, DialogContentText, TextField, DialogActions, Button, Snackbar, Alert } from '@mui/material';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';
import { getUserRoutes, BikeRoute, getAllApprovedRoutes, deleteRoute, saveRoute, saveNavigationRoute, updateRoute } from '../firebase/routes';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/index';
import Navigation, { RouteOptions } from './Navigation';
import DirectionsIcon from '@mui/icons-material/Directions';
import { getAllBikeStands, deleteBikeStand } from '../firebase/bikestands';
import { fetchNextbikeStations } from '../services/nextbikeService';
import { 
  getAllNextbikeStations, 
  getAllRepairStations, 
  getAllChargingStations, 
  getAllPois,
  NextbikeStation,
  RepairStation,
  ChargingStation,
  POI,
  deletePoi,
  deleteRepairStation,
  deleteChargingStation,
  deleteNextbikeStation
} from '../services/poiService';
import MapLegend from './MapLegend';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import EditIcon from '@mui/icons-material/Edit';
import LayersIcon from '@mui/icons-material/Layers';
import AddLocationIcon from '@mui/icons-material/AddLocation';
import LocalParkingIcon from '@mui/icons-material/LocalParking';
import RefreshIcon from '@mui/icons-material/Refresh';

// Fix for the default marker icon issue in Leaflet with webpack
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Konstanten für die Zoom-Level-Abhängigkeit
const MIN_ZOOM_LEVEL_POIS = 14;
const MIN_ZOOM_LEVEL_BIKE_STANDS = 14;
const MIN_ZOOM_LEVEL_REPAIR_STATIONS = 14;
const MIN_ZOOM_LEVEL_CHARGING_STATIONS = 14;
const MIN_ZOOM_LEVEL_NEXTBIKE = 14; // Changed from 11 to 14 to make Nextbike stations visible only at higher zoom levels
const MIN_ZOOM_LEVEL_ROUTE_POINTS = 14; // Routenpunkte werden erst ab Zoom-Level 14 angezeigt

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: '', // Schatten entfernen
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

// Kleinerer, zusätzlicher Icon für Routenpunkte
let RoutePointIcon = L.icon({
  iconUrl: icon,
  shadowUrl: '', // Schatten entfernen
  iconSize: [15, 25],
  iconAnchor: [7, 25]
});

// Icon für neue Routenpunkte, die auf bestehende Routen hinzugefügt werden können
let AddPointIcon = L.divIcon({
  className: 'add-point-icon',
  html: `<div style="background-color: #2196f3; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; display: flex; justify-content: center; align-items: center;">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="white">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
        </div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Farben für verschiedene Routen
const ROUTE_COLORS = [
  '#3388ff', // Standard Blau
  '#ff3333', // Rot
  '#33cc33', // Grün
  '#9933ff', // Lila
  '#ff9900', // Orange
  '#00ccff', // Türkis
];

// Hilfsfunktion, um für alle Fahrradwege dieselbe Farbe zu erhalten
const getRouteColor = (routeId: string | undefined): string => {
  // Alle normalen Fahrradwege erhalten dieselbe Farbe: ein einheitliches Blau
  return '#2196f3'; // Einheitliches Blau für alle Fahrradwege
};

// Formatiert die Bewertung für die Anzeige
const formatRating = (rating: number | null | undefined, ratingCount?: number): string => {
  if (rating === null || rating === undefined) return 'Keine Bewertung';
  
  // Wenn wir auch die Anzahl der Bewertungen haben, zeigen wir sie an
  if (ratingCount !== undefined && ratingCount > 0) {
    return `${rating.toFixed(1)} Sterne (${ratingCount} Bewertungen)`;
  }
  
  return `${rating.toFixed(1)} Sterne`;
};

// Formatiert die Steigung für die Anzeige
const formatSlope = (slope: string | null | undefined): string => {
  if (!slope) return 'Keine Angabe';
  return slope.charAt(0).toUpperCase() + slope.slice(1); // Kapitalisiere den ersten Buchstaben
};

// BikeStand Schnittstelle für die Typisierung
export interface BikeStand {
  id: string;
  position: {
    lat: number;
    lng: number;
  };
  createdAt: Date;
  createdBy: string;
  description?: string;
  capacity?: number;
  isRoofed?: boolean;
  isFree?: boolean;
  isLighted?: boolean;
  rating?: number;
}

// Expose refreshRoutes method to parent components
export interface MapHandle {
  refreshRoutes: () => Promise<void>;
  refreshBikeStands: () => Promise<void>;
  refreshPOIs: () => Promise<void>;
  zoomToRoute: (bounds: L.LatLngBounds) => void;
  displayRouteForReview: (route: BikeRoute) => void;
  clearReviewRoute: () => void;
}

interface MapProps {
  isDrawingMode: boolean;
  isBikeStandMode?: boolean;
  isNextBikeMode?: boolean;
  isRepairStationMode?: boolean;
  isChargingStationMode?: boolean;
  isPoiMode?: boolean;
  onRouteComplete?: (route: L.LatLng[]) => void;
  onAddBikeStand?: (position: L.LatLng) => void;
  onAddPOI?: (position: L.LatLng, poiType: string) => void;
  searchLocation?: { display_name: string; lat: number; lon: number };
}

const Map = forwardRef<MapHandle, MapProps>(({ 
  isDrawingMode, 
  isBikeStandMode = false,
  isNextBikeMode = false,
  isRepairStationMode = false,
  isChargingStationMode = false,
  isPoiMode = false,
  onRouteComplete, 
  onAddBikeStand,
  onAddPOI,
  searchLocation 
}, ref) => {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const polylineRef = useRef<L.Polyline | null>(null);
  const pointsRef = useRef<L.LatLng[]>([]);
  const drawnRoutesRef = useRef<{ [id: string]: L.Polyline }>({});
  const routeMarkersRef = useRef<{ [id: string]: L.Marker[] }>({});
  const tempRouteRef = useRef<L.Polyline | null>(null);
  const selectedRouteRef = useRef<string | null>(null);
  
  // Neue Refs für die Anzeige von zu überprüfenden Routen
  const reviewRouteRef = useRef<L.Polyline | null>(null);
  const reviewStartMarkerRef = useRef<L.Marker | null>(null);
  const reviewEndMarkerRef = useRef<L.Marker | null>(null);
  
  // Layer-Gruppen für POIs und andere Marker
  const poiLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const bikeStandLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const repairStationLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const chargingStationLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const nextbikeLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const routePointLayerGroupRef = useRef<L.LayerGroup | null>(null); // Neue Layer-Gruppe für Routenpunkte
  
  const [points, setPoints] = useState<L.LatLng[]>([]);
  const [currentZoom, setCurrentZoom] = useState(13); // Standard-Zoom-Level
  const [savedRoutes, setSavedRoutes] = useState<BikeRoute[]>([]);
  const savedRoutesLayersRef = useRef<{[id: string]: L.Polyline}>({});
  // Referenz für Routenpunkt-Marker
  const routePointMarkersRef = useRef<L.Marker[]>([]);
  const ADMIN_EMAIL = "pfistererfalk@gmail.com";
  const [isAdminAccount, setIsAdminAccount] = useState(false);
  // Status, ob der Benutzer auf einen bestehenden Routenpunkt geklickt hat
  const [connectingFromExistingPoint, setConnectingFromExistingPoint] = useState(false);

  // Speichert den vorherigen Wert von isDrawingMode
  const prevDrawingModeRef = useRef<boolean>(isDrawingMode);
  
  // Neue Zustände für die Navigation
  const [showNavigation, setShowNavigation] = useState(false);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [calculatedRouteInfo, setCalculatedRouteInfo] = useState<{
    distance: number;
    estimatedTime: number;
    routeType: string;
  } | undefined>(undefined);
  const navigationRouteRef = useRef<L.Polyline | null>(null);
  const navigationMarkersRef = useRef<L.Marker[]>([]);

  // Füge State für die Fahrradständer hinzu
  const [bikeStands, setBikeStands] = useState<BikeStand[]>([]);
  const bikeStandMarkersRef = useRef<L.Marker[]>([]);
  
  // Neue State-Variablen für die verschiedenen POI-Typen
  const [nextbikeStations, setNextbikeStations] = useState<NextbikeStation[]>([]);
  const nextbikeMarkersRef = useRef<L.Marker[]>([]);
  
  const [repairStations, setRepairStations] = useState<RepairStation[]>([]);
  const repairStationMarkersRef = useRef<L.Marker[]>([]);
  
  const [chargingStations, setChargingStations] = useState<ChargingStation[]>([]);
  const chargingStationMarkersRef = useRef<L.Marker[]>([]);
  
  const [pois, setPois] = useState<POI[]>([]);
  const poiMarkersRef = useRef<L.Marker[]>([]);
  
  // State für die Sichtbarkeit der Legende
  const [showLegend, setShowLegend] = useState(true);

  // Einfache Notification-Funktion für Feedback
  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    // Hier könnte später eine echte Benachrichtigung eingebunden werden
    console.log(`[${type.toUpperCase()}] ${message}`);
    // Wenn eine Alert-Komponente verfügbar ist, könnte sie hier aktiviert werden
  };

  // Löscht die aktuelle Route und setzt alles zurück
  const clearRoute = React.useCallback(() => {
    // Entferne alle Marker
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Entferne die Polyline
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    // Setze die Punkte zurück
    setPoints([]);
    
    // Reset Verbindungs-Status
    setConnectingFromExistingPoint(false);
  }, []);

  // Berechnet die Entfernung zwischen zwei Punkten in Kilometern
  const calculateDistance = (p1: L.LatLng, p2: L.LatLng): number => {
    const R = 6371; // Erdradius in km
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLon = (p2.lng - p1.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Überprüft, ob zwei Punkte innerhalb einer bestimmten Entfernung zueinander sind
  const isWithinDistance = (p1: L.LatLng, p2: L.LatLng, maxDistanceKm: number): boolean => {
    return calculateDistance(p1, p2) <= maxDistanceKm;
  };

  // Hilfsfunktion: Berechnet die Gesamtdistanz zwischen einer Liste von Punkten in Kilometern
  const calculateTotalDistance = (points: L.LatLng[]): number => {
    let distance = 0;
    for (let i = 0; i < points.length - 1; i++) {
      distance += calculateDistance(points[i], points[i + 1]);
    }
    return distance;
  };

  // Findet den nächsten Routenpunkt zu einem gegebenen Punkt
  const findNearestRoutePoint = (point: L.LatLng): {
    point: L.LatLng;
    routeId: string;
    index: number;
    distance: number;
  } | null => {
    let nearestPoint = null;
    let nearestDistance = Infinity;
    let nearestRouteId = '';
    let nearestIndex = -1;
    
    // Durchlaufe alle gespeicherten Routen und finde den nächsten Punkt
    savedRoutes.forEach(route => {
      if (!route.points || route.points.length === 0) return;
      
      route.points.forEach((routePoint, index) => {
        // Erstelle einen L.LatLng für den Routenpunkt
        const latLng = L.latLng(routePoint.lat, routePoint.lng);
        const distance = calculateDistance(point, latLng);
        
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestPoint = latLng;
          nearestRouteId = route.id!;
          nearestIndex = index;
        }
      });
    });
    
    if (!nearestPoint) return null;
    
    return {
      point: nearestPoint,
      routeId: nearestRouteId,
      index: nearestIndex,
      distance: nearestDistance
    };
  };
  
  // Handler für Klick auf einen bestehenden Routenpunkt
  const handleExistingPointClick = React.useCallback((point: L.LatLng) => {
    console.log('Handling existing point click:', point);
    
    const map = mapRef.current;
    if (!map) return;
    
    // Wenn wir bereits Punkte haben, behandle als Endpunkt
    if (points.length > 0) {
      console.log('Using existing point as endpoint because we already have points:', points.length);
      
      // Füge den genauen Punkt aus der bestehenden Route hinzu
      const newPoints = [...points, point];
      setPoints(newPoints);
      
      // Füge einen Marker für diesen Punkt hinzu
      const marker = L.marker(point).addTo(map);
      markersRef.current.push(marker);
      
      // Aktualisiere die Polyline
      if (polylineRef.current) {
        polylineRef.current.remove();
      }
      
      const polyline = L.polyline(newPoints, {
        color: 'blue',
        weight: 4,
        opacity: 0.7
      }).addTo(map);
      
      polylineRef.current = polyline;
      
      // Wenn die Route mindestens 2 Punkte hat, kann sie abgeschlossen werden
      if (onRouteComplete && newPoints.length >= 2) {
        onRouteComplete(newPoints);
        
        // Bereinige die Karte nach dem Speichern der Route
        clearRoute();
      }
    } else {
      // Wenn wir noch keine Punkte haben, beginne eine neue Route von diesem Punkt
      console.log('Starting new route from existing point');
      
      // Setze den Status, damit wir wissen, dass wir von einem bestehenden Punkt zeichnen
      setConnectingFromExistingPoint(true);
      
      // Lösche vorherige Zeichnung falls vorhanden
      clearRoute();
      
      // Starte neue Route mit diesem Punkt
      setPoints([point]);
      
      // Füge einen Marker für diesen Punkt hinzu
      const marker = L.marker(point).addTo(map);
      markersRef.current.push(marker);
    }
  }, [clearRoute, points, onRouteComplete]);

  // Funktion zum Hinzufügen eines neuen Punktes zu einem bestehenden Fahrradweg
  const addPointToExistingRoute = async (routeId: string, insertIndex: number, newPoint: L.LatLng) => {
    // Finde die Route in den gespeicherten Routen
    const routeToUpdate = savedRoutes.find(route => route.id === routeId);
    if (!routeToUpdate || !routeToUpdate.id) {
      showNotification('Fahrradweg konnte nicht gefunden werden', 'error');
      return;
    }
    
    // Prüfe, ob der Benutzer der Eigentümer der Route ist
    if (routeToUpdate.userId !== auth.currentUser?.uid) {
      showNotification('Du kannst nur deine eigenen Fahrradwege bearbeiten', 'error');
      return;
    }
    
    try {
      // Kopiere die Punkte der Route
      const updatedPoints = [...routeToUpdate.points];
      
      // Füge den neuen Punkt an der richtigen Position ein
      updatedPoints.splice(insertIndex, 0, {
        lat: newPoint.lat,
        lng: newPoint.lng
      });
      
      // Aktualisiere die Route in Firebase
      await updateRoute(routeId, { points: updatedPoints });
      
      // Aktualisiere die Routen auf der Karte
      if (auth.currentUser) {
        await fetchUserRoutes(auth.currentUser.uid);
      }
      
      showNotification('Routenpunkt erfolgreich hinzugefügt', 'success');
    } catch (error) {
      console.error('Fehler beim Hinzufügen des Routenpunkts:', error);
      showNotification('Fehler beim Hinzufügen des Routenpunkts', 'error');
    }
  };

  // Handle map clicks
  function handleMapClick(e: L.LeafletMouseEvent) {
    const map = mapRef.current;
    if (!map) return;
    
    // Prüfe, ob der Klick von einem UI-Element (wie dem Speichern-Button) stammt
    // Wenn das Event ein originalEvent enthält und dieses eine "button"-Eigenschaft hat,
    // dann ist es höchstwahrscheinlich ein Klick auf ein UI-Element
    const eventTarget = e.originalEvent?.target as HTMLElement;
    if (eventTarget && (
      eventTarget.tagName === 'BUTTON' || 
      eventTarget.closest('button') || 
      eventTarget.classList.contains('MuiFab-root') ||
      eventTarget.closest('.MuiFab-root')
    )) {
      console.log('Klick auf Button erkannt, ignoriere für Routenpunkte');
      return;
    }
    
    const newPoint = e.latlng;
    console.log('Map clicked at:', newPoint);
    
    // Im Zeichenmodus
    if (isDrawingMode) {
      // Überprüfe, ob in der Nähe eines bestehenden Routenpunkts geklickt wurde
      const nearestPoint = findNearestRoutePoint(newPoint);
      
      // Wenn wir in der Nähe eines bestehenden Punkts geklickt haben (innerhalb von 2 Metern)
      // Reduzierter Radius von 0.05km (50m) auf 0.002km (2m), damit nur direkte Klicks auf den Pin erkannt werden
      if (nearestPoint && nearestPoint.distance < 0.002) {
        console.log('Clicked near existing point, distance:', nearestPoint.distance);
        
        // Die handleExistingPointClick-Funktion kümmert sich jetzt sowohl um Start- als auch Endpunkte
        handleExistingPointClick(nearestPoint.point);
        return;
      }
      
      // Überprüfe, ob in der Nähe eines Routensegments geklickt wurde
      const nearestSegment = findNearestRouteSegment(newPoint);
      
      // Wenn wir in der Nähe eines Routensegments geklickt haben (innerhalb von 10 Metern)
      // Erhöhter Radius von 0.005km (5m) auf 0.01km (10m) für bessere Benutzbarkeit
      if (nearestSegment && nearestSegment.distance < 0.01) {
        console.log('Clicked near route segment, distance:', nearestSegment.distance);
        
        // Berechne den genauen Punkt auf dem Segment (Projektion des Klickpunkts)
        const segment = nearestSegment.segment;
        const projectionPoint = calculateProjectionPoint(newPoint, segment[0], segment[1]);
        
        // Zeige den Marker an der projizierten Position statt der Klickposition
        const addPointMarker = L.marker(projectionPoint, { 
          icon: AddPointIcon,
          opacity: 0.9
        }).addTo(map);
        
        // Füge das Popup mit beiden Optionen hinzu
        addPointMarker.bindPopup(`
          <div style="text-align: center; min-width: 220px;">
            <h4 style="margin: 5px 0;">Routenpunkt Optionen</h4>
            <p style="margin: 5px 0; font-size: 13px;">Was möchtest du an dieser Stelle tun?</p>
            <div style="display: flex; justify-content: space-between; margin-top: 10px;">
              <button id="add-segment-point-btn" style="background-color: #2196f3; color: white; border: none; border-radius: 4px; padding: 5px 8px; margin: 3px; cursor: pointer; flex: 1; font-size: 12px;">
                Punkt zur Route hinzufügen
              </button>
              <button id="connect-route-btn" style="background-color: #4CAF50; color: white; border: none; border-radius: 4px; padding: 5px 8px; margin: 3px; cursor: pointer; flex: 1; font-size: 12px;">
                Route hier verbinden
              </button>
            </div>
          </div>
        `).openPopup();
        
        // Event-Handler für die Buttons im Popup
        setTimeout(() => {
          // Handler für "Punkt zur Route hinzufügen"
          const addButton = document.getElementById('add-segment-point-btn');
          if (addButton) {
            addButton.addEventListener('click', async () => {
              // Stelle sicher, dass nearestSegment nicht null ist
              if (nearestSegment) {
                // Füge den Punkt zur Route hinzu
                await addPointToExistingRoute(
                  nearestSegment.routeId,
                  nearestSegment.insertIndex,
                  projectionPoint
                );
                
                // Entferne den Marker und schließe das Popup
                addPointMarker.remove();
                map.closePopup();
              }
            });
          }
          
          // Handler für "Route hier verbinden"
          const connectButton = document.getElementById('connect-route-btn');
          if (connectButton) {
            connectButton.addEventListener('click', () => {
              // Verbinde die aktuelle Route mit diesem Punkt
              handleRouteSegmentConnection(projectionPoint);
              
              // Entferne den Marker und schließe das Popup
              addPointMarker.remove();
              map.closePopup();
            });
          }
        }, 10);
        
        return;
      }
      
      // Normal case: Add a new point
      const newPoints = [...points, newPoint];
      setPoints(newPoints);

      // Remove existing polyline
      if (polylineRef.current) {
        polylineRef.current.remove();
      }

      // Draw new polyline
      const polyline = L.polyline(newPoints, {
        color: 'blue',
        weight: 4,
        opacity: 0.7
      }).addTo(map);

      polylineRef.current = polyline;

      // Add marker for each point
      const marker = L.marker(newPoint).addTo(map);
      markersRef.current.push(marker);
    }
  }

  // Hook to register and clean up click handler
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    
    // Clean up previous click handler to avoid duplicates
    map.off('click', handleMapClick);
    
    // Add click handler only when in drawing mode
    if (isDrawingMode) {
      map.on('click', handleMapClick);
      console.log("Drawing mode activated - map click handler added");
    }
    
    return () => {
      map.off('click', handleMapClick);
    };
  }, [isDrawingMode, points, handleExistingPointClick]);

  // Function called when drawing mode is deactivated
  const handleDrawingComplete = React.useCallback(() => {
    // Nur fortfahren, wenn wir mindestens 2 Punkte haben
    if (points.length < 2) {
      clearRoute();
      return;
    }

    // Rufe die Callback-Funktion mit den Punkten auf
    if (onRouteComplete) {
      onRouteComplete([...points]);
    }

    // Räume auf nach dem Speichern
    clearRoute();
  }, [clearRoute, onRouteComplete, points]);

  // Initialize map in the first useEffect
  useEffect(() => {
    // Initialize the map
    const map = L.map('map').setView([51.505, -0.09], 13);
    mapRef.current = map;

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    // Request user's location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        map.setView([latitude, longitude], 13);
      });
    }

    // Layer-Gruppen initialisieren - nicht direkt zur Karte hinzufügen
    poiLayerGroupRef.current = L.layerGroup();
    bikeStandLayerGroupRef.current = L.layerGroup();
    repairStationLayerGroupRef.current = L.layerGroup();
    chargingStationLayerGroupRef.current = L.layerGroup();
    nextbikeLayerGroupRef.current = L.layerGroup();
    routePointLayerGroupRef.current = L.layerGroup();
    
    // Initialen Zoom-Level setzen
    setCurrentZoom(map.getZoom());
    console.log("Initial POI visibility set for zoom level:", map.getZoom());
    
    // Event-Handler für Zoom-Änderungen
    map.on('zoomend', () => {
      const newZoom = map.getZoom();
      setCurrentZoom(newZoom);
      console.log("Updating layer visibility for zoom level:", newZoom);
      
      // Sichtbarkeit der Layer basierend auf Zoom-Level aktualisieren
      updateLayerVisibility(newZoom);
    });
    
    // Initialisiere die Sichtbarkeit basierend auf dem Start-Zoom-Level
    updateLayerVisibility(map.getZoom());

    // Benutzer-Status überwachen
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Prüfe, ob der Benutzer der Admin ist
        setIsAdminAccount(user.email === ADMIN_EMAIL);
        
        // Lade die Routen des Benutzers
        fetchUserRoutes(user.uid);
        
        // Lade immer alle freigegebenen Routen, unabhängig vom Benutzer
        fetchPublicRoutes();
      } else {
        setSavedRoutes([]);
        // Für nicht eingeloggte Benutzer, nur öffentliche Routen laden
        fetchPublicRoutes();
        // Lösche alle Routen von der Karte
        clearAllRoutesFromMap();
      }
    });

    // Füge Tastatur-Handler hinzu für Escape (Abbrechen) und Enter (Speichern)
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDrawingMode) {
        clearRoute();
      } else if (e.key === 'Enter' && isDrawingMode && points.length >= 2) {
        handleDrawingComplete();
      }
    };
    document.addEventListener('keydown', handleKeyPress);

    // Cleanup function
    return () => {
      map.remove();
      unsubscribe();
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, []);

  // Überwache Änderungen des Drawing-Modus
  useEffect(() => {
    // Wenn der Zeichenmodus deaktiviert wurde und vorher aktiviert war
    if (!isDrawingMode && prevDrawingModeRef.current) {
      handleDrawingComplete();
    }
    
    // Aktualisiere die Referenz auf den vorherigen Zustand
    prevDrawingModeRef.current = isDrawingMode;
  }, [isDrawingMode, handleDrawingComplete]);

  // Hilfsfunktion zum Löschen aller Routen von der Karte
  const clearAllRoutesFromMap = () => {
    // Lösche Polylines
    Object.values(savedRoutesLayersRef.current).forEach(layer => {
      layer.remove();
    });
    savedRoutesLayersRef.current = {};
    
    // Lösche Routenpunkt-Marker
    routePointMarkersRef.current.forEach(marker => {
      marker.remove();
    });
    routePointMarkersRef.current = [];
  };

  // Lade die Routen des Benutzers
  const fetchUserRoutes = async (userId: string) => {
    try {
      const routes = await getUserRoutes(userId);
      setSavedRoutes(prevRoutes => [...prevRoutes, ...routes]);
      displaySavedRoutes(routes);
    } catch (error) {
      console.error('Error fetching routes for map display:', error);
    }
  };

  // Lade öffentliche/freigegebene Routen
  const fetchPublicRoutes = async () => {
    try {
      const routes = await getAllApprovedRoutes();
      setSavedRoutes(prevRoutes => {
        // Vermeide Duplikate basierend auf route.id
        const existingIds = new Set(prevRoutes.map(r => r.id));
        const newRoutes = routes.filter(r => r.id && !existingIds.has(r.id));
        return [...prevRoutes, ...newRoutes];
      });
      displaySavedRoutes(routes);
    } catch (error) {
      console.error('Error fetching public routes for map display:', error);
    }
  };

  // Zeige gespeicherte Fahrradwege auf der Karte an
  const displaySavedRoutes = (routes: BikeRoute[]) => {
    const map = mapRef.current;
    if (!map) return;

    // Füge jeden Fahrradweg als Polyline hinzu
    routes.forEach((route) => {
      if (route.points && route.points.length >= 2) {
        const latlngs = route.points.map(point => 
          new L.LatLng(point.lat, point.lng)
        );
        
        // Bestimme eine konsistente Farbe basierend auf der Route-ID
        const color = getRouteColor(route.id);
        
        // Nur eine Polyline hinzufügen, wenn es noch keine für diesen Fahrradweg gibt
        if (!route.id || !savedRoutesLayersRef.current[route.id]) {
          const polyline = L.polyline(latlngs, {
            color,
            weight: 4, // Dünnere Linie für normale Fahrradwege
            opacity: 0.7
          }).addTo(map);
          
          // Speichere den Layer mit der Route-ID
          if (route.id) {
            savedRoutesLayersRef.current[route.id] = polyline;
          }
          
          // Erstelle ein erweitertes Popup mit Bewertung und Steigung
          const ratingStars = route.rating ? '★'.repeat(Math.floor(route.rating)) + (route.rating % 1 ? '½' : '') : '';
          
          // HTML für das Popup mit verbesserten Informationen und Lösch-Button
          const popupContent = `
            <div style="min-width: 200px;">
              <h3 style="margin: 0 0 10px 0; color: ${color};">${route.name || 'Unbenannter Fahrradweg'}</h3>
              ${route.description ? `<p style="margin: 5px 0;">${route.description}</p>` : '<p style="margin: 5px 0; color: #888;">Keine Beschreibung</p>'}
              <hr style="border: 0; border-top: 1px solid #eee; margin: 8px 0;">
              <div style="display: flex; justify-content: space-between; font-size: 13px;">
                <span><strong>Länge:</strong> ${calculateRouteLength(route.points).toFixed(2)} km</span>
              </div>
                <div style="margin-top: 8px; font-size: 13px;">
                  <strong>Bewertung:</strong> 
                ${route.rating ? `
                  <span style="color: orange; font-size: 14px;">${ratingStars}</span> 
                  <span>(${route.rating})</span>
                  ${route.ratingCount ? `<span> - ${route.ratingCount} Bewertung${route.ratingCount !== 1 ? 'en' : ''}</span>` : ''}
                ` : '<span style="color: #888;">Noch nicht bewertet</span>'}
              </div>
              
              <!-- Direkte Bewertungsmöglichkeit -->
              <div style="margin-top: 10px; display: flex; align-items: center; justify-content: center;">
                <div class="rating-stars" style="display: inline-flex; cursor: pointer;">
                  <span id="rate-1-${route.id}" style="font-size: 18px; color: #ccc; margin-right: 2px;">★</span>
                  <span id="rate-2-${route.id}" style="font-size: 18px; color: #ccc; margin-right: 2px;">★</span>
                  <span id="rate-3-${route.id}" style="font-size: 18px; color: #ccc; margin-right: 2px;">★</span>
                  <span id="rate-4-${route.id}" style="font-size: 18px; color: #ccc; margin-right: 2px;">★</span>
                  <span id="rate-5-${route.id}" style="font-size: 18px; color: #ccc; margin-right: 2px;">★</span>
                </div>
                <span id="rating-feedback-${route.id}" style="margin-left: 10px; font-size: 12px;"></span>
              </div>
              
              ${route.slope ? `
                <div style="margin-top: 5px; font-size: 13px;">
                  <strong>Steigung:</strong> 
                  <span style="padding: 2px 8px; border-radius: 10px; background-color: ${getSlopeColor(route.slope)}; color: white; font-size: 12px;">
                    ${formatSlope(route.slope)}
                  </span>
                </div>` : ''}
              
              <!-- Verkehrsdichte anzeigen -->
              ${route.traffic ? `
                <div style="margin-top: 5px; font-size: 13px;">
                  <strong>Verkehrsdichte:</strong> 
                  <span style="padding: 2px 8px; border-radius: 10px; background-color: ${
                    route.traffic <= 1 ? '#4CAF50' :
                    route.traffic <= 2 ? '#8BC34A' : 
                    route.traffic <= 3 ? '#FFC107' : 
                    route.traffic <= 4 ? '#FF9800' : '#FF5722'
                  }; color: white; font-size: 12px;">
                    ${
                      route.traffic <= 1 ? 'Sehr gering' :
                      route.traffic <= 2 ? 'Gering' : 
                      route.traffic <= 3 ? 'Mittel' : 
                      route.traffic <= 4 ? 'Hoch' : 'Sehr hoch'
                    }
                  </span>
                </div>` : ''}
              
              <!-- Straßenqualität anzeigen -->
              ${route.roadQuality ? `
                <div style="margin-top: 5px; font-size: 13px;">
                  <strong>Straßenqualität:</strong> 
                  <span style="padding: 2px 8px; border-radius: 10px; background-color: ${
                    route.roadQuality <= 1 ? '#4CAF50' :
                    route.roadQuality <= 2 ? '#8BC34A' : 
                    route.roadQuality <= 3 ? '#FFC107' : 
                    route.roadQuality <= 4 ? '#FF9800' : '#FF5722'
                  }; color: white; font-size: 12px;">
                    ${
                      route.roadQuality <= 1 ? 'Sehr gut' :
                      route.roadQuality <= 2 ? 'Gut' : 
                      route.roadQuality <= 3 ? 'Durchschnittlich' : 
                      route.roadQuality <= 4 ? 'Schlecht' : 'Sehr schlecht'
                    }
                  </span>
                </div>` : ''}
              
              <!-- Umgebung/Landschaft anzeigen -->
              ${route.scenery ? `
                <div style="margin-top: 5px; font-size: 13px;">
                  <strong>Umgebung:</strong> 
                  <span style="padding: 2px 8px; border-radius: 10px; background-color: ${
                    route.scenery === 1 ? '#4CAF50' :
                    route.scenery === 2 ? '#8BC34A' : 
                    route.scenery === 3 ? '#FFC107' : 
                    route.scenery === 4 ? '#FF9800' : '#FF5722'
                  }; color: white; font-size: 12px;">
                    ${
                      route.scenery === 1 ? 'Stadt' :
                      route.scenery === 2 ? 'Land' : 
                      route.scenery === 3 ? 'Wald' : 
                      route.scenery === 4 ? 'Berg' : 'Meer'
                    }
                  </span>
                </div>` : ''}
              
              <!-- Tags anzeigen -->
              ${route.tags ? `
                <div style="margin-top: 5px; font-size: 13px;">
                  <strong>Tags:</strong> 
                  <div style="display: flex; flex-wrap: wrap; gap: 5px; margin-top: 3px;">
                    ${route.tags.map(tag => `
                      <span style="background-color: #e0e0e0; padding: 2px 6px; border-radius: 10px; font-size: 11px;">
                        ${tag}
                      </span>
                    `).join('')}
                  </div>
                </div>` : ''}
                
                <hr style="border: 0; border-top: 1px solid #eee; margin: 8px 0;">
              <div style="margin-top: 10px; display: flex; justify-content: ${route.userId === auth.currentUser?.uid ? 'space-between' : 'center'};">
                <!-- Bearbeiten-Button für alle Benutzer -->
                <button id="edit-route-${route.id}" style="background-color: #1976d2; color: white; border: none; border-radius: 4px; padding: 5px 12px; cursor: pointer; font-size: 12px;">
                  Bearbeiten
                </button>
                
                ${route.userId === auth.currentUser?.uid ? `
                  <!-- Löschen-Button nur für Eigentümer -->
                  <button id="delete-route-${route.id}" style="background-color: #ff4d4f; color: white; border: none; border-radius: 4px; padding: 5px 12px; cursor: pointer; font-size: 12px;">
                    Löschen
                  </button>
              ` : ''}
              </div>
            </div>
          `;
          
          // Zeige Popup mit erweiterten Infos beim Klick an, aber nur wenn nicht im Zeichenmodus
          if (!isDrawingMode) {
            polyline.bindPopup(popupContent);
          } else {
            // Im Zeichenmodus klickbar machen für die Verbindungsfunktion
            polyline.on('click', (e) => {
              if (isDrawingMode) {
                // Verhindere Standard-Popup und Propagation zur Karte
                L.DomEvent.stopPropagation(e);
                
                // Berechne den nächsten Punkt auf der Polylinie (Projektion)
                const clickPoint = e.latlng;
                let minDistance = Infinity;
                let nearestSegment: {
                  routeId: string;
                  segment: [L.LatLng, L.LatLng];
                  insertIndex: number;
                  distance: number;
                } | null = null;
                
                // Finde das nächstgelegene Segment auf dieser Polyline
                for (let i = 0; i < latlngs.length - 1; i++) {
                  const segmentStart = latlngs[i];
                  const segmentEnd = latlngs[i + 1];
                  const distance = distanceToSegment(clickPoint, segmentStart, segmentEnd);
                  
                  if (distance < minDistance) {
                    minDistance = distance;
                    nearestSegment = {
                      routeId: route.id!,
                      segment: [segmentStart, segmentEnd] as [L.LatLng, L.LatLng],
                      insertIndex: i + 1,
                      distance: distance
                    };
                  }
                }
                
                // Beim Klick auf eine Polyline sollten wir immer ein nächstes Segment haben
                if (nearestSegment) { // Entferne Distanzprüfung hier, wir sind auf der Polyline!
                  // Berechne den genauen Projektionspunkt
                  const projectionPoint = calculateProjectionPoint(clickPoint, nearestSegment.segment[0], nearestSegment.segment[1]);
                  
                  // Zeige den Add-Point-Marker an der projizierten Position
                  const addPointMarker = L.marker(projectionPoint, { 
                    icon: AddPointIcon,
                    opacity: 0.9
                  }).addTo(map);
                  
                  // Füge das Popup mit beiden Optionen hinzu
                  addPointMarker.bindPopup(`
                    <div style="text-align: center; min-width: 220px;">
                      <h4 style="margin: 5px 0;">Routenpunkt Optionen</h4>
                      <p style="margin: 5px 0; font-size: 13px;">Was möchtest du an dieser Stelle tun?</p>
                      <div style="display: flex; justify-content: space-between; margin-top: 10px;">
                        <button id="add-segment-point-btn" style="background-color: #2196f3; color: white; border: none; border-radius: 4px; padding: 5px 8px; margin: 3px; cursor: pointer; flex: 1; font-size: 12px;">
                          Punkt zur Route hinzufügen
                        </button>
                        <button id="connect-route-btn" style="background-color: #4CAF50; color: white; border: none; border-radius: 4px; padding: 5px 8px; margin: 3px; cursor: pointer; flex: 1; font-size: 12px;">
                          Route hier verbinden
                        </button>
                      </div>
                    </div>
                  `).openPopup();
                  
                  // Event-Handler für die Buttons im Popup
                  setTimeout(() => {
                    // Handler für "Punkt zur Route hinzufügen"
                    const addButton = document.getElementById('add-segment-point-btn');
                    if (addButton) {
                      addButton.addEventListener('click', async () => {
                        // Stelle sicher, dass nearestSegment nicht null ist
                        if (nearestSegment) {
                          // Füge den Punkt zur Route hinzu
                          await addPointToExistingRoute(
                            nearestSegment.routeId,
                            nearestSegment.insertIndex,
                            projectionPoint
                          );
                          
                          // Entferne den Marker und schließe das Popup
                          addPointMarker.remove();
                          map.closePopup();
                        }
                      });
                    }
                    
                    // Handler für "Route hier verbinden"
                    const connectButton = document.getElementById('connect-route-btn');
                    if (connectButton) {
                      connectButton.addEventListener('click', () => {
                        // Verbinde die aktuelle Route mit diesem Punkt
                        handleRouteSegmentConnection(projectionPoint);
                        
                        // Entferne den Marker und schließe das Popup
                        addPointMarker.remove();
                        map.closePopup();
                      });
                    }
                  }, 10);
                }
              }
            });
          }
          
          // Event-Handler zum Löschen eines Fahrradwegs hinzufügen
          if (route.id && !isDrawingMode) {
            polyline.on('popupopen', () => {
              // Button erst dann suchen, wenn das Popup geöffnet wurde
              setTimeout(() => {
                // Event-Handler für Löschbutton (nur wenn Nutzer der Ersteller ist)
                if (route.userId === auth.currentUser?.uid) {
                const deleteButton = document.getElementById(`delete-route-${route.id}`);
                if (deleteButton) {
                  deleteButton.addEventListener('click', async () => {
                    try {
                      // Fahrradweg aus der Datenbank löschen
                        await deleteRoute(route.id!, auth.currentUser?.uid, auth.currentUser?.email === 'pfistererfalk@gmail.com');
                      
                      // Fahrradweg von der Karte entfernen
                      if (savedRoutesLayersRef.current[route.id!]) {
                        savedRoutesLayersRef.current[route.id!].remove();
                        delete savedRoutesLayersRef.current[route.id!];
                      }
                      
                      // Liste der gespeicherten Routen aktualisieren
                      if (auth.currentUser) {
                        fetchUserRoutes(auth.currentUser.uid);
                      }
                      
                      // Popup schließen
                      mapRef.current?.closePopup();
                      
                      // Erfolgsbenachrichtigung anzeigen
                      showNotification('Fahrradweg wurde gelöscht', 'success');
                    } catch (error) {
                      console.error('Fehler beim Löschen des Fahrradwegs:', error);
                      showNotification('Fehler beim Löschen des Fahrradwegs', 'error');
                      }
                    });
                  }
                }
                
                // Event-Handler für Bearbeiten-Button
                const editButton = document.getElementById(`edit-route-${route.id}`);
                if (editButton) {
                  editButton.addEventListener('click', () => {
                    try {
                      // Popup schließen
                      mapRef.current?.closePopup();
                      
                      // Eigenes Event auslösen, das von der übergeordneten Komponente abgefangen werden kann
                      window.dispatchEvent(new CustomEvent('editRoute', { 
                        detail: { 
                          routeId: route.id
                        }
                      }));
                      
                      showNotification('Bearbeite Straßeneigenschaften...', 'info');
                    } catch (error) {
                      console.error('Fehler beim Öffnen des Bearbeitungsdialogs:', error);
                      showNotification('Fehler beim Öffnen des Dialogs', 'error');
                    }
                  });
                }
                
                // Bewertungssterne mit Interaktivität versehen
                const ratingStars = [1, 2, 3, 4, 5].map(rating => {
                  return document.getElementById(`rate-${rating}-${route.id}`);
                }) as (HTMLElement | null)[];
                
                // Feedback-Element
                const feedbackElement = document.getElementById(`rating-feedback-${route.id}`);
                
                // Aktuelle Bewertung hervorheben, falls vorhanden
                if (route.rating !== undefined && route.rating !== null) {
                  // Highlight stars based on the route's rating
                  const ratingElements = document.querySelectorAll(`#route-${route.id} .rating-star`);
                  const fullStars = Math.floor(route.rating);
                  for (let i = 0; i < fullStars; i++) {
                    const star = ratingElements[i] as HTMLElement;
                    if (star) star.style.color = 'orange';
                  }
                } else {
                  // Keine Bewertung vorhanden, alle Sterne zurücksetzen
                  const ratingElements = document.querySelectorAll(`#route-${route.id} .rating-star`);
                  for (let i = 0; i < 5; i++) {
                    const star = ratingElements[i] as HTMLElement;
                    if (star) star.style.color = '#ccc';
                  }
                }
                
                // Event-Handler für die Sterne
                ratingStars.forEach((star, index) => {
                  if (!star) return;
                  
                  // Mouse-Over-Effekt
                  star.addEventListener('mouseover', () => {
                    // Setze alle Sterne bis zum aktuellen auf gelb
                    for (let i = 0; i <= index; i++) {
                      const starEl = ratingStars[i] as HTMLElement | null;
                      if (starEl) starEl.style.color = 'orange';
                    }
                    // Setze alle Sterne nach dem aktuellen auf grau
                    for (let i = index + 1; i < 5; i++) {
                      const starEl = ratingStars[i] as HTMLElement | null;
                      if (starEl) starEl.style.color = '#ccc';
                    }
                  });
                  
                  // Klick-Event
                  star.addEventListener('click', async () => {
                    const ratingValue = index + 1;
                    
                    try {
                      // Hier Logik für das Speichern der Bewertung einfügen
                      // Da es keine direkte Funktion gibt, erstellen wir ein CustomEvent
                      window.dispatchEvent(new CustomEvent('rateRoute', { 
                        detail: { 
                          routeId: route.id,
                          rating: ratingValue
                        }
                      }));
                      
                      if (feedbackElement) {
                        feedbackElement.textContent = 'Bewertung gespeichert!';
                        feedbackElement.style.color = 'green';
                        
                        // Feedback nach kurzer Zeit ausblenden
                        setTimeout(() => {
                          if (feedbackElement) feedbackElement.textContent = '';
                        }, 3000);
                      }
                    } catch (error) {
                      console.error('Fehler beim Speichern der Bewertung:', error);
                      if (feedbackElement) {
                        feedbackElement.textContent = 'Fehler!';
                        feedbackElement.style.color = 'red';
                      }
                    }
                  });
                });
                
                // Mouse-Leave-Effekt für den gesamten Sternbereich
                const ratingContainer = document.querySelector('.rating-stars');
                if (ratingContainer) {
                  ratingContainer.addEventListener('mouseleave', () => {
                    // Zurücksetzen auf die tatsächliche Bewertung
                    if (route.rating !== undefined && route.rating !== null) {
                      // Highlight stars based on the route's rating
                      const ratingStars = document.querySelectorAll(`#route-${route.id} .rating-star`);
                      const fullStars = Math.floor(route.rating);
                      for (let i = 0; i < 5; i++) {
                        const star = ratingStars[i] as HTMLElement;
                        if (star) star.style.color = i < fullStars ? 'orange' : '#ccc';
                      }
                    } else {
                      // Keine Bewertung vorhanden, alle Sterne zurücksetzen
                      const ratingStars = document.querySelectorAll(`#route-${route.id} .rating-star`);
                      for (let i = 0; i < 5; i++) {
                        const star = ratingStars[i] as HTMLElement;
                        if (star) star.style.color = '#ccc';
                      }
                    }
                  });
                }
              }, 100); // Kurze Verzögerung, um sicherzustellen, dass das DOM aktualisiert wurde
            });
          }
          
          // Füge für jeden Punkt der Route einen klickbaren Marker hinzu
          latlngs.forEach((point, pointIndex) => {
            // Nur den ersten und letzten Punkt oder alle 5 Punkte dazwischen
            if (pointIndex === 0 || pointIndex === latlngs.length - 1 || pointIndex % 5 === 0) {
              const marker = L.marker(point, { 
                icon: RoutePointIcon,
                opacity: 0.7
              });
              
              // Zeige Tooltip an, wenn der Benutzer im Zeichenmodus ist
              marker.bindTooltip("Klicke, um eine Route von hier zu starten", {
                direction: 'top',
                opacity: 0.8,
                className: 'route-point-tooltip'
              });
              
              // Füge Klick-Handler hinzu, wenn der Benutzer im Zeichenmodus ist
              marker.on('click', (e) => {
                // Verhindere Standardverhalten (Propagation zur Karte)
                L.DomEvent.stopPropagation(e);
                
                // Diese Marker werden nur im Zeichenmodus angezeigt und dienen nur
                // zum Verbinden von Routenpunkten. Niemals Popups anzeigen.
                handleExistingPointClick(point);
              });
              
              // Marker nur zeigen, wenn Zeichenmodus aktiv ist
              if (isDrawingMode) {
                marker.addTo(map);
                routePointMarkersRef.current.push(marker);
              }
            }
          });
        }
      }
    });
  };

  // Berechnet die Länge einer Route in Kilometern
  const calculateRouteLength = (points: Array<{lat: number; lng: number}>): number => {
    let length = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      // Haversine-Formel zur Berechnung der Entfernung zwischen zwei Punkten
      const R = 6371; // Erdradius in km
      const dLat = (p2.lat - p1.lat) * Math.PI / 180;
      const dLon = (p2.lng - p1.lng) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      length += R * c;
    }
    return length;
  };

  // Gibt die Farbe für die Steigung zurück
  const getSlopeColor = (slope?: string | null): string => {
    if (!slope) return "#888";
    switch (slope) {
      case "flach": return "#4caf50"; // Grün
      case "leicht": return "#2196f3"; // Blau
      case "mittel": return "#ff9800"; // Orange
      case "steil": return "#f44336"; // Rot
      case "varierend": return "#9c27b0"; // Lila
      default: return "#888"; // Grau für unbekannt
    }
  };

  // Überwacht Änderungen am isDrawingMode-Status
  useEffect(() => {
    // Wenn der Zeichenmodus von true auf false wechselt und wir Punkte haben, speichern wir die Route
    if (prevDrawingModeRef.current && !isDrawingMode && points.length >= 2) {
      console.log('Saving route via button click');
      onRouteComplete?.(points);
      clearRoute();
    }
    
    // Zeige Routenpunkte nur im Zeichenmodus
    if (isDrawingMode) {
      displayRoutePoints();
    } else {
      // Entferne alle Routenpunkt-Marker
      routePointMarkersRef.current.forEach(marker => {
        marker.remove();
      });
      routePointMarkersRef.current = [];
      
      // Reset Verbindungs-Status
      setConnectingFromExistingPoint(false);
    }

    // Aktualisiere den Referenzwert
    prevDrawingModeRef.current = isDrawingMode;
  }, [isDrawingMode, points, onRouteComplete]);

  // Zeigt alle Routenpunkte an, von denen aus verbunden werden kann
  const displayRoutePoints = () => {
    const map = mapRef.current;
    if (!map) return;
    
    // Entferne alte Punkte
    routePointMarkersRef.current.forEach(marker => {
      marker.remove();
    });
    routePointMarkersRef.current = [];
    
    // Aktualisiere oder erstelle die Layer-Gruppe für Routenpunkte
    if (routePointLayerGroupRef.current) {
      routePointLayerGroupRef.current.clearLayers();
    } else {
      routePointLayerGroupRef.current = L.layerGroup();
      
      // Nur hinzufügen, wenn der Zoom-Level ausreichend ist
      if (map.getZoom() >= MIN_ZOOM_LEVEL_ROUTE_POINTS) {
        routePointLayerGroupRef.current.addTo(map);
      }
    }
    
    // Füge für jede Route die Verbindungspunkte hinzu
    savedRoutes.forEach((route) => {
      if (route.points && route.points.length >= 2) {
        const latlngs = route.points.map(point => 
          new L.LatLng(point.lat, point.lng)
        );
        
        latlngs.forEach((point, pointIndex) => {
          // Nur den ersten und letzten Punkt oder alle 5 Punkte dazwischen
          if (pointIndex === 0 || pointIndex === latlngs.length - 1 || pointIndex % 5 === 0) {
            const marker = L.marker(point, { 
              icon: RoutePointIcon,
              opacity: 0.7
            });
            
            marker.bindTooltip("Klicke, um eine Route von hier zu starten", {
              direction: 'top',
              opacity: 0.8,
              className: 'route-point-tooltip'
            });
            
            marker.on('click', (e) => {
              // Verhindere Standardverhalten (Propagation zur Karte)
              L.DomEvent.stopPropagation(e);
              
              // Setze diesen Punkt als ersten Punkt der neuen Route
              handleExistingPointClick(point);
            });
            
            // Füge den Marker zur Layer-Gruppe hinzu, nicht direkt zur Karte
            if (routePointLayerGroupRef.current) {
              marker.addTo(routePointLayerGroupRef.current);
            }
            
            routePointMarkersRef.current.push(marker);
          }
        });
      }
    });
  };

  // Aktualisiere die Anzeige, wenn sich die gespeicherten Routen ändern
  useEffect(() => {
    // Wenn Zeichenmodus aktiv ist, zeige Routenpunkte
    if (isDrawingMode) {
      displayRoutePoints();
    }
  }, [savedRoutes, isDrawingMode]);

  // Reagieren auf Änderungen des searchLocation-Props
  useEffect(() => {
    if (searchLocation && mapRef.current) {
      // Auf die gesuchte Position zoomen
      mapRef.current.setView(
        [searchLocation.lat, searchLocation.lon], 
        15,  // Zoom-Level auf 15 setzen (höherer Wert = nähere Ansicht)
        { animate: true }
      );
      
      // Optional: Marker für den gesuchten Ort setzen
      const searchMarker = L.marker([searchLocation.lat, searchLocation.lon])
        .addTo(mapRef.current)
        .bindPopup(`<b>${searchLocation.display_name.split(',')[0]}</b>`)
        .openPopup();
      
      // Nach 8 Sekunden den Marker automatisch entfernen
      setTimeout(() => {
        if (mapRef.current) {
          searchMarker.remove();
        }
      }, 8000);
    }
  }, [searchLocation]);

  // Entfernt alle Navigationsrouten und -marker von der Karte
  const clearNavigationFromMap = () => {
    // Entferne vorherige Navigationsroute, falls vorhanden
    if (navigationRouteRef.current) {
      navigationRouteRef.current.remove();
      navigationRouteRef.current = null;
    }
    
    // Entferne vorherige Navigationsmarker
    navigationMarkersRef.current.forEach(marker => marker.remove());
    navigationMarkersRef.current = [];
  };
  
  // Verbessere die Routenberechnung, um die Optionen (best_rated, flattest, fastest) stärker zu berücksichtigen
  const calculateRoute = async (start: L.LatLng, end: L.LatLng, options: RouteOptions) => {
    if (!mapRef.current) return;
    
    try {
      // Bestimme, welche Routenfunktion basierend auf den Optionen zu verwenden ist
      let routePoints: L.LatLng[];
      
      // Vorerst verwenden wir die lokale Routenberechnung für alle Typen
      // In Zukunft könnte hier eine Unterscheidung nach routeType erfolgen
      routePoints = await calculateLocalRoute(start, end, options);
      
      if (!routePoints || routePoints.length < 2) {
        showNotification('Keine Route gefunden.', 'error');
        return;
      }
      
      // Speichere die Routenpunkte für spätere Verwendung (z.B. zum Speichern der Route)
      currentRoutePoints.current = routePoints;
      
      // Setze den routeFound-Status auf true, damit der Speichern-Button angezeigt wird
      setRouteFound(true);
      
      // Berechne die Entfernung und Dauer
      const distance = calculateTotalDistance(routePoints);
      setRouteDistance(parseFloat(distance.toFixed(2)));
      
      // Geschätzte Dauer (15 km/h durchschnittliche Fahrradgeschwindigkeit)
      const duration = (distance / 15) * 60; // in Minuten
      setRouteDuration(Math.round(duration));
      
      // Lösche vorherige Navigationsroute, falls vorhanden
      clearNavigationFromMap();
      
      // Füge Marker für Start und Ziel hinzu
      const startMarker = L.marker(start, {
        icon: L.divIcon({
          className: 'custom-div-icon',
          html: '<div style="background-color: green; width: 24px; height: 24px; border-radius: 50%; display: flex; justify-content: center; align-items: center; color: white; font-weight: bold; border: 2px solid white;">S</div>',
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        })
      }).addTo(mapRef.current);
      
      const endMarker = L.marker(end, {
        icon: L.divIcon({
          className: 'custom-div-icon',
          html: '<div style="background-color: red; width: 24px; height: 24px; border-radius: 50%; display: flex; justify-content: center; align-items: center; color: white; font-weight: bold; border: 2px solid white;">Z</div>',
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        })
      }).addTo(mapRef.current);
      
      // Speichere die Marker für späteres Entfernen
      navigationMarkersRef.current = [startMarker, endMarker];
      
      console.log('Berechne Route mit lokaler Methode zwischen:', start, end, 'mit Optionen:', options.routeType);
      
      // Berechne die Route mit vorhandenen Fahrradwegen
      const routePolyline = L.polyline(routePoints, {
        color: '#FF4500', // Leuchtendes Rot-Orange für Navigationsrouten (Standard)
        weight: 6, // Dickere Linie für Navigationsrouten
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
        dashArray: '10, 5', // Gestrichelte Linie für Navigationsrouten
        className: 'navigation-path'
      }).addTo(mapRef.current);
      
      // Speichere die Referenz für späteres Entfernen
      navigationRouteRef.current = routePolyline;
      
      // Berechne die geschätzte Zeit (vereinfacht: 15 km/h Durchschnittsgeschwindigkeit)
      const averageSpeed = 15; // km/h
      const estimatedTime = (distance / averageSpeed) * 60; // in Minuten
      
      // Setze die Routeninformationen
      setCalculatedRouteInfo({
        distance,
        estimatedTime,
        routeType: options.routeType
      });
      
      // Passe die Kartenansicht an, um die gesamte Route zu zeigen
      if (mapRef.current) {
        mapRef.current.fitBounds(routePolyline.getBounds(), {
          padding: [50, 50]
        });
      }
      
      return {
        distance,
        estimatedTime,
        routeType: options.routeType
      };
    } catch (error) {
      console.error('Fehler bei der Routenberechnung:', error);
    } finally {
      setIsCalculatingRoute(false);
    }
  };
  
  // Füge eine neue Funktion hinzu, um OSM-Routing zwischen zwei Punkten zu verwenden
  const getOSMRoute = async (start: L.LatLng, end: L.LatLng): Promise<L.LatLng[]> => {
    try {
      console.log('Berechne OSM-Route zwischen:', start, end);
      
      // OSRM-API für Fahrradrouting verwenden
      // Wir nutzen den öffentlichen OSRM-Dienst für Fahrradrouten
      const apiUrl = `https://router.project-osrm.org/route/v1/bicycle/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
      
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`OSM Routing API Fehler: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Prüfe, ob eine Route gefunden wurde
      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        console.warn('Keine OSM-Route gefunden, verwende direkte Linie');
        return [start, end];
      }
      
      // Extrahiere die Routenpunkte aus der Antwort
      const coordinates = data.routes[0].geometry.coordinates;
      
      // Konvertiere die Koordinaten in L.LatLng-Objekte
      // OSRM gibt Koordinaten als [lng, lat] zurück, Leaflet erwartet [lat, lng]
      const routePoints = coordinates.map((coord: [number, number]) => 
        L.latLng(coord[1], coord[0])
      );
      
      console.log(`OSM-Route gefunden mit ${routePoints.length} Punkten`);
      return routePoints;
    } catch (error) {
      console.error('Fehler beim Abrufen der OSM-Route:', error);
      // Fallback: direkte Linie
      return [start, end];
    }
  };
  
  // Aktualisiere die calculateLocalRoute-Funktion, um OSM-Routing für Start- und Endpunkte zu verwenden
  const calculateLocalRoute = async (
    start: L.LatLng, 
    end: L.LatLng, 
    options: RouteOptions
  ): Promise<L.LatLng[]> => {
    console.log('Berechne lokale Route mit Benutzerrouten und OSM-Routing, Modus:', options.routeType);
    
    // Finde die nächsten Punkte auf den gespeicherten Routen
    const startNearestPoint = findNearestRoutePoint(start);
    const endNearestPoint = findNearestRoutePoint(end);
    
    let routePoints: L.LatLng[] = [];
    
    // Definiere einen maximalen Abstand in Metern, ab dem wir Punkte als "zu weit entfernt" betrachten
    const MAX_DISTANCE_TO_ROUTE = 2000; // 2000 Meter (2km)
    
    // Wenn Start- oder Endpunkt zu weit von einer Route entfernt sind, verwenden wir eine direkte OSM-Route
    const useDirectPath = 
      !startNearestPoint || 
      !endNearestPoint || 
      startNearestPoint.distance > MAX_DISTANCE_TO_ROUTE / 1000 || // Konvertiere von m zu km
      endNearestPoint.distance > MAX_DISTANCE_TO_ROUTE / 1000;
    
    if (useDirectPath) {
      console.log('Start- oder Endpunkt zu weit von bestehenden Routen entfernt, verwende direkte OSM-Route');
      // Vollständige OSM-Route zwischen Start und Ziel
      return await getOSMRoute(start, end);
    }
    
    console.log('Nahe Routenpunkte gefunden, berechne Route über bestehende Fahrradwege');
    
    // Sammle alle verfügbaren Routenpunkte für den Graph-Algorithmus
    const allRoutePoints: Array<{
      point: L.LatLng;
      routeId: string;
      index: number;
      routeName?: string;   // Name der Route für Debug-Zwecke
      rating?: number;      // Bewertung der Route
      slope?: string;       // Steigung der Route
    }> = [];
    
    // Erfasse Informationen über jede Route
    const routeInfos: { 
      [id: string]: { 
        points: L.LatLng[], 
        name?: string, 
        connections: string[],
        rating?: number,
        slope?: string
      } 
    } = {};
    
    // Sammle alle Routen und speichere ihre Punkte
    savedRoutes.forEach(route => {
      if (!route.points || !route.id) return;
      
      // Initialisiere Routeninformationen
      routeInfos[route.id] = {
        points: route.points.map(p => new L.LatLng(p.lat, p.lng)),
        name: route.name,
        connections: [],
        rating: route.rating || undefined,
        slope: route.slope || undefined
      };
      
      // Speichere wichtige Punkte in der allRoutePoints-Liste
      route.points.forEach((point, index) => {
        // Speichere Start, Ende und jeden 5. Punkt
        if (index === 0 || index === route.points!.length - 1 || index % 5 === 0) {
          allRoutePoints.push({
            point: new L.LatLng(point.lat, point.lng),
            routeId: route.id!,
            index,
            routeName: route.name,
            rating: route.rating || undefined,
            slope: route.slope || undefined
          });
        }
      });
    });
    
    // Finde Verbindungen zwischen Routen (Punkte, die nahe beieinander liegen)
    const MAX_CONNECTION_DISTANCE = 150; // 150 Meter für Verbindungen
    
    // Finde Verbindungen zwischen verschiedenen Routen
    allRoutePoints.forEach(pointA => {
      allRoutePoints.forEach(pointB => {
        // Prüfe nur Punkte von verschiedenen Routen
        if (pointA.routeId !== pointB.routeId) {
          const distanceMeters = calculateDistance(pointA.point, pointB.point) * 1000; // in Metern
          
          if (distanceMeters < MAX_CONNECTION_DISTANCE) {
            // Verbindung zwischen den Routen gefunden
            // Stelle sicher, dass beide Richtungen existieren
            if (!routeInfos[pointA.routeId].connections.includes(pointB.routeId)) {
              routeInfos[pointA.routeId].connections.push(pointB.routeId);
            }
            if (!routeInfos[pointB.routeId].connections.includes(pointA.routeId)) {
              routeInfos[pointB.routeId].connections.push(pointA.routeId);
            }
          }
        }
      });
    });
    
    // 1. OSM-Route vom Startpunkt zum nächsten Punkt auf einem Fahrradweg
    if (calculateDistance(start, startNearestPoint.point) > 0.05) { // Wenn mehr als 50m entfernt
      console.log('Berechne OSM-Route vom Startpunkt zum nächsten Fahrradweg');
      const startToRoutePoints = await getOSMRoute(start, startNearestPoint.point);
      routePoints = routePoints.concat(startToRoutePoints);
    } else {
      // Wenn sehr nah, einfach direkte Verbindung
      routePoints.push(start);
      routePoints.push(startNearestPoint.point);
    }
    
    // Prüfe, ob Start und Ziel auf derselben Route liegen
    if (startNearestPoint.routeId === endNearestPoint.routeId) {
      console.log('Start und Ziel liegen auf derselben Route');
      
      // Hole die Route
      const route = savedRoutes.find(r => r.id === startNearestPoint.routeId);
      
      if (route && route.points) {
        // Bestimme Start- und Endindex
        const startIdx = startNearestPoint.index;
        const endIdx = endNearestPoint.index;
        
        // Extrahiere den Teilpfad
        const routeSection = route.points
          .slice(Math.min(startIdx, endIdx), Math.max(startIdx, endIdx) + 1)
          .map(p => new L.LatLng(p.lat, p.lng));
        
        // Füge die Punkte in der richtigen Reihenfolge hinzu
        if (startIdx <= endIdx) {
          routePoints = routePoints.concat(routeSection.slice(1)); // Überspringe den ersten Punkt, da er bereits hinzugefügt wurde
        } else {
          routePoints = routePoints.concat(routeSection.slice(1).reverse()); // Überspringe den ersten Punkt und kehre um
        }
      }
    } else {
      // Start und Ziel auf unterschiedlichen Routen
      console.log('Start und Ziel auf unterschiedlichen Routen, suche Verbindung');
      
      // Versuche, einen Pfad zwischen den Routen zu finden
      const connectionPath = findPathBetweenRoutes(
        startNearestPoint.routeId,
        endNearestPoint.routeId,
        routeInfos,
        options
      );
      
      if (connectionPath && connectionPath.length > 0) {
        console.log('Pfad zwischen den Routen gefunden:', connectionPath.map(id => routeInfos[id].name || id).join(' -> '));
        
        // Füge für jede Route im Pfad die entsprechenden Punkte hinzu
        for (let i = 0; i < connectionPath.length - 1; i++) {
          const currentRouteId = connectionPath[i];
          const nextRouteId = connectionPath[i + 1];
          
          // Finde die beste Verbindung zwischen diesen beiden Routen
          const connection = findBestConnection(
            currentRouteId,
            nextRouteId,
            routeInfos,
            i === 0 ? startNearestPoint.index : 0
          );
          
          if (connection) {
            const currentRoute = routeInfos[currentRouteId];
            
            // Wenn es die erste Route im Pfad ist, beginne am Startpunkt auf der Route
            if (i === 0) {
              // Füge Punkte von der Route hinzu, vom Startindex bis zum Verbindungspunkt
              const startIdx = startNearestPoint.index;
              const endIdx = connection.fromIndex;
              
              if (startIdx < endIdx) {
                // Vorwärts durch die Route
                for (let j = startIdx + 1; j <= endIdx; j++) {
                  routePoints.push(currentRoute.points[j]);
                }
              } else {
                // Rückwärts durch die Route
                for (let j = startIdx - 1; j >= endIdx; j--) {
                  routePoints.push(currentRoute.points[j]);
                }
              }
            } else {
              // Für alle anderen Routen im Pfad, beginne am Anfang oder Ende
              const fromRoute = routeInfos[currentRouteId];
              
              // Füge Punkte vom Anfang/Ende der Route bis zum Verbindungspunkt hinzu
              if (connection.fromIndex < fromRoute.points.length / 2) {
                // Näher am Anfang der Route
                for (let j = 0; j <= connection.fromIndex; j++) {
                  routePoints.push(fromRoute.points[j]);
                }
              } else {
                // Näher am Ende der Route
                for (let j = fromRoute.points.length - 1; j >= connection.fromIndex; j--) {
                  routePoints.push(fromRoute.points[j]);
                }
              }
            }
            
            // Füge den Verbindungspunkt zur nächsten Route hinzu
            const nextRoute = routeInfos[nextRouteId];
            
            // Wenn es die letzte Route im Pfad ist (die Zielroute)
            if (i === connectionPath.length - 2) {
              // Verbinde mit dem Zielpunkt auf der Route
              const toIdx = connection.toIndex;
              const endIdx = endNearestPoint.index;
              
              if (toIdx < endIdx) {
                // Vorwärts durch die Route
                for (let j = toIdx; j <= endIdx; j++) {
                  routePoints.push(nextRoute.points[j]);
                }
              } else {
                // Rückwärts durch die Route
                for (let j = toIdx; j >= endIdx; j--) {
                  routePoints.push(nextRoute.points[j]);
                }
              }
            } else {
              // Für Zwischenrouten, füge Punkte bis zum Ende der Route hinzu
              if (connection.toIndex < nextRoute.points.length / 2) {
                // Näher am Anfang der Route
                for (let j = connection.toIndex; j < nextRoute.points.length; j++) {
                  routePoints.push(nextRoute.points[j]);
                }
              } else {
                // Näher am Ende der Route
                for (let j = connection.toIndex; j >= 0; j--) {
                  routePoints.push(nextRoute.points[j]);
                }
              }
            }
          }
        }
      } else {
        console.log('Kein Pfad zwischen den Routen gefunden, verwende Greedy-Algorithmus');
        
        // Fallback: Greedy-Algorithmus
        // Dieser Code ähnelt der bestehenden Implementierung
        let currentPoint = startNearestPoint.point;
        const visitedRouteIds = new Set<string>();
        visitedRouteIds.add(startNearestPoint.routeId);
        
        // Maximale Anzahl von Schritten
        const maxSteps = 100;
        let steps = 0;
        
        while (!isWithinDistance(currentPoint, endNearestPoint.point, 0.1) && steps < maxSteps) {
          steps++;
          
          // Finde den nächsten besten Punkt basierend auf den Optionen
          let bestNextPoint: {
            point: L.LatLng;
            routeId: string;
            index: number;
            score: number;
          } | null = null;
          
          allRoutePoints.forEach(routePoint => {
            // Überspringe Punkte, die zu weit entfernt sind
            if (calculateDistance(currentPoint, routePoint.point) > 5) return;
            
            // Berechne Score basierend auf den Optionen
            let score = 0;
            
            // Distanz zum Ziel (niedriger ist besser)
            const distanceToEnd = calculateDistance(routePoint.point, endNearestPoint.point);
            score -= distanceToEnd * 2;
            
            // Distanz vom aktuellen Punkt (niedriger ist besser)
            const distanceFromCurrent = calculateDistance(currentPoint, routePoint.point);
            score -= distanceFromCurrent;
            
            // Bonus für Punkte auf der gleichen Route (Kontinuität)
            if (visitedRouteIds.has(routePoint.routeId)) {
              score += 3;
            }
            
            // Berücksichtige Routenoptionen
            const route = savedRoutes.find(r => r.id === routePoint.routeId);
            if (route) {
              // Für "best_rated" Option - stark gewichtet
              if (options.routeType === 'best_rated' && route.rating) {
                // Exponentieller Bonus für höhere Bewertungen
                score += Math.pow(route.rating, 3) * 10; // Kubische Gewichtung für noch stärkeren Einfluss
              }
              
              // Für "flattest" Option - stark gewichtet
              if (options.routeType === 'flattest') {
                if (route.slope === 'flach') score += 50;       // Extrem hoher Bonus für flache Strecken
                else if (route.slope === 'leicht') score += 25; // Sehr hoher Bonus für leichte Steigungen
                else if (route.slope === 'mittel') score -= 10;  // Abzug für mittlere Steigungen
                else if (route.slope === 'steil') score -= 100;  // Sehr starker Abzug für steile Strecken
                else if (route.slope === 'varierend') score -= 25; // Höherer Abzug für variierende Steigungen
              }
              
              // Für "fastest" Option - kürzeste Strecke bevorzugen
              if (options.routeType === 'fastest') {
                // Bonus für kürzere Strecken zum Ziel
                score -= distanceToEnd * 8; // Stärkere Gewichtung der Distanz zum Ziel
                
                // Steile Strecken verlangsamen, daher vermeiden
                if (route.slope === 'steil') score -= 25;
              }
              
              // Für "avoidSteepSlopes" Option
              if (options.avoidSteepSlopes && route.slope === 'steil') {
                score -= 100; // Sehr starker Abzug für steile Strecken
              }
            }
            
            // Aktualisiere den besten Punkt
            if (!bestNextPoint || score > bestNextPoint.score) {
              bestNextPoint = {
                ...routePoint,
                score
              };
            }
          });
          
          // Wenn kein nächster Punkt gefunden wurde, breche ab
          if (!bestNextPoint) {
            console.log('Kein nächster Punkt gefunden, breche Routenberechnung ab');
            break;
          }
          
          // Füge den besten nächsten Punkt zur Route hinzu
          const typedNextPoint = bestNextPoint as {
            point: L.LatLng;
            routeId: string;
            index: number;
            score: number;
          };
          routePoints.push(typedNextPoint.point);
          currentPoint = typedNextPoint.point;
          visitedRouteIds.add(typedNextPoint.routeId);
        }
      }
    }
    
    // 3. OSM-Route vom letzten Punkt auf dem Fahrradweg zum Zielpunkt
    if (calculateDistance(routePoints[routePoints.length - 1], end) > 0.05) { // Wenn mehr als 50m entfernt
      console.log('Berechne OSM-Route vom letzten Fahrradwegpunkt zum Zielpunkt');
      const routeToEndPoints = await getOSMRoute(routePoints[routePoints.length - 1], end);
      
      // Überspringe den ersten Punkt, da er bereits in routePoints enthalten ist
      if (routeToEndPoints.length > 1) {
        routePoints = routePoints.concat(routeToEndPoints.slice(1));
      }
    } else {
      // Wenn sehr nah, einfach direkte Verbindung
      routePoints.push(end);
    }
    
    // Entferne Duplikate und nahe beieinander liegende Punkte
    return removeRedundantPoints(routePoints);
  };
  
  // Hilfsfunktion: Entfernt redundante Punkte aus einer Route
  const removeRedundantPoints = (points: L.LatLng[]): L.LatLng[] => {
    if (points.length <= 2) return points;
    
    const result: L.LatLng[] = [points[0]];
    const MIN_DISTANCE = 0.01; // 10 Meter
    
    for (let i = 1; i < points.length - 1; i++) {
      const lastPoint = result[result.length - 1];
      if (!isWithinDistance(lastPoint, points[i], MIN_DISTANCE)) {
        result.push(points[i]);
      }
    }
    
    // Stelle sicher, dass der Endpunkt immer enthalten ist
    result.push(points[points.length - 1]);
    
    return result;
  };
  
  // Hilfsfunktion: Findet einen Pfad zwischen zwei Routen
  const findPathBetweenRoutes = (
    startRouteId: string,
    endRouteId: string,
    routeInfos: { 
      [id: string]: { 
        points: L.LatLng[], 
        name?: string, 
        connections: string[],
        rating?: number,
        slope?: string
      } 
    },
    options: RouteOptions
  ): string[] | null => {
    // Wenn Start und Ziel identisch sind
    if (startRouteId === endRouteId) {
      return [startRouteId];
    }
    
    // Für best_rated und flattest verwenden wir einen angepassten Algorithmus
    if (options.routeType === 'best_rated' || options.routeType === 'flattest') {
      return findOptimizedPath(startRouteId, endRouteId, routeInfos, options);
    }
    
    // Standard-Breitensuche (BFS) für den kürzesten Pfad
    const queue: { routeId: string; path: string[] }[] = [
      { routeId: startRouteId, path: [startRouteId] }
    ];
    const visited = new Set<string>([startRouteId]);
    
    while (queue.length > 0) {
      const { routeId, path } = queue.shift()!;
      
      // Prüfe alle verbundenen Routen
      const connections = routeInfos[routeId]?.connections || [];
      
      for (const nextRouteId of connections) {
        if (nextRouteId === endRouteId) {
          // Pfad gefunden
          return [...path, nextRouteId];
        }
        
        if (!visited.has(nextRouteId)) {
          visited.add(nextRouteId);
          queue.push({
            routeId: nextRouteId,
            path: [...path, nextRouteId]
          });
        }
      }
    }
    
    return null; // Kein Pfad gefunden
  };

  // Hilfsfunktion: Findet einen optimierten Pfad basierend auf Routenoptionen
  const findOptimizedPath = (
    startRouteId: string,
    endRouteId: string,
    routeInfos: { 
      [id: string]: { 
        points: L.LatLng[], 
        name?: string, 
        connections: string[],
        rating?: number,
        slope?: string
      } 
    },
    options: RouteOptions
  ): string[] | null => {
    // Dijkstra-Algorithmus mit angepassten Gewichten
    
    // Initialisiere Distanzen und Vorgänger
    const distances: { [id: string]: number } = {};
    const previous: { [id: string]: string | null } = {};
    const unvisited = new Set<string>();
    
    // Fülle die Datenstrukturen
    Object.keys(routeInfos).forEach(id => {
      distances[id] = id === startRouteId ? 0 : Infinity;
      previous[id] = null;
      unvisited.add(id);
    });
    
    // Hauptschleife des Dijkstra-Algorithmus
    while (unvisited.size > 0) {
      // Finde den Knoten mit der kleinsten Distanz
      let current: string | null = null;
      let minDistance = Infinity;
      
      unvisited.forEach(id => {
        if (distances[id] < minDistance) {
          minDistance = distances[id];
          current = id;
        }
      });
      
      // Wenn kein Knoten gefunden wurde oder das Ziel erreicht ist, breche ab
      if (current === null || current === endRouteId || minDistance === Infinity) {
        break;
      }
      
      // Entferne den aktuellen Knoten aus der unbesuchten Menge
      unvisited.delete(current);
      
      // Prüfe alle Nachbarn des aktuellen Knotens
      const connections = routeInfos[current]?.connections || [];
      
      for (const neighbor of connections) {
        if (!unvisited.has(neighbor)) continue;
        
        // Berechne das Gewicht der Kante basierend auf den Optionen
        let weight = 1; // Standardgewicht
        
        // Für best_rated: Bevorzuge Routen mit höherer Bewertung
        if (options.routeType === 'best_rated') {
          const rating = routeInfos[neighbor]?.rating;
          if (rating) {
            // Extrem starke Gewichtung für Bewertungen
            // Umkehren, da Dijkstra den kürzesten Pfad findet (niedrigere Werte bevorzugt)
            weight = 1 / (Math.pow(rating, 3)); // Kubische Gewichtung für noch stärkeren Einfluss
          } else {
            weight = 20; // Sehr hohe Kosten für unbewertete Routen
          }
        }
        // Für flattest: Bevorzuge flache Routen
        else if (options.routeType === 'flattest') {
          const slope = routeInfos[neighbor]?.slope;
          if (slope === 'flach') weight = 0.01;      // Extrem niedrige Kosten für flache Strecken
          else if (slope === 'leicht') weight = 0.2; // Sehr niedrige Kosten für leichte Steigungen
          else if (slope === 'mittel') weight = 5;   // Mittlere Kosten
          else if (slope === 'steil') weight = 100;  // Extrem hohe Kosten für steile Strecken
          else if (slope === 'varierend') weight = 10; // Hohe Kosten für variierende Steigungen
          else weight = 8; // Standardkosten für unbekannte Steigung
        }
        
        // Zusätzliche Option: avoidSteepSlopes
        if (options.avoidSteepSlopes && routeInfos[neighbor]?.slope === 'steil') {
          weight *= 10; // Multipliziere das Gewicht für steile Routen stark
        }
        
        // Berechne die neue Distanz
        const newDistance = distances[current] + weight;
        
        // Wenn die neue Distanz kleiner ist, aktualisiere die Distanz und den Vorgänger
        if (newDistance < distances[neighbor]) {
          distances[neighbor] = newDistance;
          previous[neighbor] = current;
        }
      }
    }
    
    // Rekonstruiere den Pfad
    if (previous[endRouteId] === null) {
      return null; // Kein Pfad gefunden
    }
    
    const path: string[] = [];
    let current: string | null = endRouteId;
    
    while (current !== null) {
      path.unshift(current);
      current = previous[current];
    }
    
    return path;
  };
  
  // Hilfsfunktion: Findet die beste Verbindung zwischen zwei Routen
  const findBestConnection = (
    fromRouteId: string,
    toRouteId: string,
    routeInfos: { [id: string]: { points: L.LatLng[], name?: string, connections: string[] } },
    startIndex: number = 0
  ): { fromIndex: number; toIndex: number; distance: number } | null => {
    const fromRoute = routeInfos[fromRouteId];
    const toRoute = routeInfos[toRouteId];
    
    if (!fromRoute || !toRoute) return null;
    
    let minDistance = Infinity;
    let bestConnection = null;
    
    // Durchsuche alle Punkte beginnend ab startIndex
    for (let i = startIndex; i < fromRoute.points.length; i++) {
      for (let j = 0; j < toRoute.points.length; j++) {
        const distance = calculateDistance(fromRoute.points[i], toRoute.points[j]);
        
        if (distance < minDistance) {
          minDistance = distance;
          bestConnection = {
            fromIndex: i,
            toIndex: j,
            distance
          };
        }
      }
    }
    
    return bestConnection;
  };

  // Toggle für die Navigationsansicht
  const toggleNavigation = () => {
    setShowNavigation(!showNavigation);
    
    // Wenn die Navigation geschlossen wird, entferne die berechnete Route
    if (showNavigation) {
      if (navigationRouteRef.current) {
        navigationRouteRef.current.remove();
        navigationRouteRef.current = null;
      }
      
      navigationMarkersRef.current.forEach(marker => marker.remove());
      navigationMarkersRef.current = [];
      
      setCalculatedRouteInfo(undefined);
    }
  };

  // Neuer Handler für Klicks im Fahrradständer-Modus
  const handleBikeStandClick = (e: L.LeafletMouseEvent) => {
    if (!isBikeStandMode) return;
    
    console.log('Adding bike stand at:', e.latlng);
    if (onAddBikeStand) {
      onAddBikeStand(e.latlng);
    }
  };

  // Füge useEffect für den Fahrradständer-Modus hinzu
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    
    // Clean up previous click handler to avoid duplicates
    map.off('click', handleBikeStandClick);
    
    // Add click handler only when in bike stand mode
    if (isBikeStandMode) {
      map.on('click', handleBikeStandClick);
      console.log("Bike stand mode activated - map click handler added");
    }
    
    return () => {
      map.off('click', handleBikeStandClick);
    };
  }, [isBikeStandMode]);
  
  // Funktion zum Abrufen und Anzeigen von Fahrradständern
  const fetchAndDisplayBikeStands = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    
    try {
      // Entferne bestehende Marker
      bikeStandMarkersRef.current.forEach(marker => marker.remove());
      bikeStandMarkersRef.current = [];
      
      // Layer-Gruppe aktualisieren oder erstellen
      if (bikeStandLayerGroupRef.current) {
        bikeStandLayerGroupRef.current.clearLayers();
      } else {
        bikeStandLayerGroupRef.current = L.layerGroup();
        
        // Nur hinzufügen, wenn der Zoom-Level ausreichend ist
        if (currentZoom >= MIN_ZOOM_LEVEL_BIKE_STANDS) {
          bikeStandLayerGroupRef.current.addTo(map);
        }
      }
      
      // Hole alle Fahrradständer
      const allBikeStands = await getAllBikeStands();
      setBikeStands(allBikeStands);
      
      // Zeige die Fahrradständer auf der Karte an
      allBikeStands.forEach((bikeStand) => {
        const position = L.latLng(bikeStand.position.lat, bikeStand.position.lng);
        
        // Custom Icon für Fahrradständer
        const bikeStandIcon = L.divIcon({
          className: 'custom-div-icon',
          html: `<div style="background-color: #4CAF50; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; display: flex; justify-content: center; align-items: center;">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14px" height="14px" fill="white">
                    <path d="M15.5,5.5c1.1,0,2-0.9,2-2s-0.9-2-2-2s-2,0.9-2,2S14.4,5.5,15.5,5.5z M5,12c-2.8,0-5,2.2-5,5s2.2,5,5,5s5-2.2,5-5 S7.8,12,5,12z M5,20.5c-1.9,0-3.5-1.6-3.5-3.5s1.6-3.5,3.5-3.5s3.5,1.6,3.5,3.5S6.9,20.5,5,20.5z M19,12c-2.8,0-5,2.2-5,5 s2.2,5,5,5s5-2.2,5-5S21.8,12,19,12z M19,20.5c-1.9,0-3.5-1.6-3.5-3.5s1.6-3.5,3.5-3.5s3.5,1.6,3.5,3.5S20.9,20.5,19,20.5z M12,10h-2v2H9v-2H7v2H6v-2H4v2H3V8h2V6h2v2h2V6h2v2h2v8h-1V10z"/>
                  </svg>
                </div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });
        
        // Erstelle den Marker und füge ihn zur Layer-Gruppe hinzu
        const marker = L.marker(position, { icon: bikeStandIcon });
        
        if (bikeStandLayerGroupRef.current) {
          marker.addTo(bikeStandLayerGroupRef.current);
        }
        
        // Popup-Inhalt erstellen
        let popupContent = `
          <div style="min-width: 180px;">
            <h4 style="margin: 0 0 5px 0; color: #4CAF50;">Fahrradständer</h4>
        `;
        
        if (bikeStand.description) {
          popupContent += `<p>${bikeStand.description}</p>`;
        }
        
        if (bikeStand.capacity) {
          popupContent += `<p><strong>Kapazität:</strong> ${bikeStand.capacity} Fahrräder</p>`;
        }
        
        // Eigenschaften anzeigen
        let propertiesHtml = '';
        if (bikeStand.isRoofed) propertiesHtml += '<span style="margin-right: 10px;"><i class="material-icons" style="font-size: 16px; vertical-align: middle;">umbrella</i> Überdacht</span>';
        if (bikeStand.isFree) propertiesHtml += '<span style="margin-right: 10px;"><i class="material-icons" style="font-size: 16px; vertical-align: middle;">euro_symbol</i> Kostenlos</span>';
        if (bikeStand.isLighted) propertiesHtml += '<span><i class="material-icons" style="font-size: 16px; vertical-align: middle;">lightbulb</i> Beleuchtet</span>';
        
        if (propertiesHtml) {
          popupContent += `
            <div style="margin: 8px 0;">
              ${propertiesHtml}
            </div>
          `;
        }
        
        // Bewertung anzeigen, falls vorhanden
        if (bikeStand.rating) {
          const ratingStars = '★'.repeat(Math.floor(bikeStand.rating)) + (bikeStand.rating % 1 ? '½' : '');
          popupContent += `
            <div style="font-size: 12px; margin-top: 4px;">
              <strong>Bewertung:</strong> 
              <span style="color: orange; font-size: 13px;">${ratingStars}</span>
            </div>
          `;
        }
        
        // Füge Lösch-Button hinzu, wenn der aktuelle Benutzer der Ersteller ist oder ein Admin
        const currentUser = auth.currentUser;
        if (currentUser && (currentUser.uid === bikeStand.createdBy || currentUser.email === ADMIN_EMAIL)) {
          popupContent += `
            <div style="text-align: right; margin-top: 10px;">
              <button 
                class="bikestand-delete-button" 
                style="background-color: #f44336; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;"
                data-bikestand-id="${bikeStand.id}">
                Löschen${currentUser.email === ADMIN_EMAIL && currentUser.uid !== bikeStand.createdBy ? ' (Admin)' : ''}
              </button>
            </div>
          `;
        }
        
        popupContent += '</div>';
        
        // Popup hinzufügen
        marker.bindPopup(popupContent);
        
        // Event-Listener für den Lösch-Button (wird nach Popup-Öffnung hinzugefügt)
        marker.on('popupopen', () => {
          const deleteButton = document.querySelector(`.bikestand-delete-button[data-bikestand-id="${bikeStand.id}"]`);
          if (deleteButton) {
            deleteButton.addEventListener('click', async () => {
              if (window.confirm('Möchtest du diesen Fahrradständer wirklich löschen?')) {
                try {
                  // Hier wird die Funktion zum Löschen des Fahrradständers aufgerufen
                  await deleteBikeStand(bikeStand.id);
                  
                  // Schließe das Popup und entferne den Marker
                  marker.closePopup();
                  marker.remove();
                  
                  // Entferne den Marker aus der Referenzliste
                  bikeStandMarkersRef.current = bikeStandMarkersRef.current.filter(m => m !== marker);
                  
                  // Erfolgsmeldung anzeigen
                  window.dispatchEvent(new CustomEvent('showNotification', { 
                    detail: { 
                      message: 'Fahrradständer erfolgreich gelöscht', 
                      severity: 'success' 
                    } 
                  }));
                } catch (error) {
                  console.error('Fehler beim Löschen des Fahrradständers:', error);
                  window.dispatchEvent(new CustomEvent('showNotification', { 
                    detail: { 
                      message: 'Fehler beim Löschen des Fahrradständers', 
                      severity: 'error' 
                    } 
                  }));
                }
              }
            });
          }
        });
        
        // Speichere den Marker für späteres Entfernen
        bikeStandMarkersRef.current.push(marker);
      });
    } catch (error) {
      console.error('Error fetching and displaying bike stands:', error);
    }
  }, [currentZoom]); // Abhängigkeit vom aktuellen Zoom-Level
  
  // Lade Fahrradständer beim Komponentenaufbau
  useEffect(() => {
    if (mapRef.current) {
      fetchAndDisplayBikeStands();
    }
  }, [fetchAndDisplayBikeStands]);
  
  // Funktion zum Abrufen und Anzeigen von Nextbike-Stationen
  const fetchAndDisplayNextbikeStations = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    
    try {
      // Entferne bestehende Marker
      nextbikeMarkersRef.current.forEach(marker => marker.remove());
      nextbikeMarkersRef.current = [];
      
      // Layer-Gruppe aktualisieren oder erstellen
      if (nextbikeLayerGroupRef.current) {
        nextbikeLayerGroupRef.current.clearLayers();
      } else {
        nextbikeLayerGroupRef.current = L.layerGroup();
      }
        
        // Nur hinzufügen, wenn der Zoom-Level ausreichend ist
      const currentZoom = map.getZoom();
      
      if (currentZoom >= MIN_ZOOM_LEVEL_NEXTBIKE) {
          nextbikeLayerGroupRef.current.addTo(map);
        
        // Get current map bounds to filter stations
        const mapBounds = map.getBounds();
        
        // Hole nur Nextbike-Stationen im sichtbaren Bereich
        const visibleNextbikeStations = await fetchNextbikeStations(mapBounds);
        
        setNextbikeStations(visibleNextbikeStations);
        
        // Reset markers array before adding new markers
        nextbikeMarkersRef.current = [];
      
      // Zeige die Nextbike-Stationen auf der Karte an
        visibleNextbikeStations.forEach((station: NextbikeStation) => {
        const position = L.latLng(station.position.lat, station.position.lng);
        
          // Verbesserte Icon-Darstellung für Nextbike-Stationen
          const markerHtmlStyles = `
            position: relative;
            background-color: ${station.isActive ? '#4CAF50' : '#F44336'};
            width: 2.5rem;
            height: 2.5rem;
            display: flex;
            justify-content: center;
            align-items: center;
            border-radius: 50%;
            border: 2px solid #FFFFFF;
            box-shadow: 0 0 5px rgba(0,0,0,0.3);
          `;

          const iconHtml = `
            <div style="${markerHtmlStyles}">
              <span style="color: white; font-weight: bold; font-size: 0.9rem; font-family: Arial;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M4 4.5a.5.5 0 0 1 .5-.5H6a.5.5 0 0 1 0 1v.5h4.14l.386-1.158A.5.5 0 0 1 11 4h1a.5.5 0 0 1 0 1h-.64l-.311.935.807 1.29a3 3 0 1 1-.848.53l-.508-.812-2.076 3.322A.5.5 0 0 1 8 10.5H5.959a3 3 0 1 1-1.815-3.274L5 5.856V5h-.5a.5.5 0 0 1-.5-.5zm1.5 2.443-.508.814c.5.444.85 1.054.967 1.743h1.139L5.5 6.943zM8 9.057 9.598 6.5H6.402L8 9.057zM4.937 9.5a1.997 1.997 0 0 0-.487-.877l-.548.877h1.035zM3.603 8.092A2 2 0 1 0 4.937 10.5H3a.5.5 0 0 1-.424-.765l1.027-1.643zm7.947.53a2 2 0 1 0 .848-.53l1.026 1.643a.5.5 0 1 1-.848.53L11.55 8.623z"/>
                  </svg>
              </span>
              <div style="position: absolute; top: -10px; right: -10px; background-color: #3f51b5; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; justify-content: center; align-items: center; font-size: 0.7rem; font-weight: bold; border: 1px solid white;">
                ${station.bikeCapacity || '?'}
              </div>
            </div>
          `;

          const icon = L.divIcon({
            className: "nextbike-marker-icon",
            iconAnchor: [20, 20],
            popupAnchor: [0, -20],
            html: iconHtml
          });

          // Erstelle den Marker und füge ihn zur Karte hinzu
          const marker = L.marker(position, { icon }).addTo(nextbikeLayerGroupRef.current!);
          
          // Popup mit Informationen zur Nextbike-Station
          const popupContent = `
            <div>
              <h3>${station.name || 'Nextbike Station'}</h3>
              <p>${station.description || ''}</p>
              <p>Bikes: ${station.bikeCapacity || 'N/A'}</p>
              <p>Status: ${station.isActive ? 'Active' : 'Inactive'}</p>
              <p>Last updated: ${station.createdAt.toLocaleString()}</p>
            </div>
          `;
          
          marker.bindPopup(popupContent);
          
          // Event-Listener für den Lösch-Button (falls Admin oder Ersteller)
          marker.on('popupopen', () => {
            // Füge Lösch-Button im Popup hinzu, wenn der aktuelle Benutzer der Ersteller ist oder ein Admin
            const currentUser = auth.currentUser;
            if (currentUser && (currentUser.uid === station.createdBy || currentUser.email === ADMIN_EMAIL)) {
              // Finde den Popup-Container
              const popupContainer = document.querySelector('.leaflet-popup-content');
              if (popupContainer) {
                // Prüfe, ob bereits ein Löschbutton vorhanden ist
                if (!popupContainer.querySelector('.nextbike-delete-button')) {
                  // Erstelle den Löschbutton
                  const deleteButtonDiv = document.createElement('div');
                  deleteButtonDiv.style.textAlign = 'right';
                  deleteButtonDiv.style.marginTop = '10px';
                  
                  const deleteButton = document.createElement('button');
                  deleteButton.className = 'nextbike-delete-button';
                  deleteButton.setAttribute('data-nextbike-id', station.id);
                  deleteButton.style.backgroundColor = '#f44336';
                  deleteButton.style.color = 'white';
                  deleteButton.style.border = 'none';
                  deleteButton.style.padding = '5px 10px';
                  deleteButton.style.borderRadius = '4px';
                  deleteButton.style.cursor = 'pointer';
                  deleteButton.innerText = `Löschen${currentUser.email === ADMIN_EMAIL && currentUser.uid !== station.createdBy ? ' (Admin)' : ''}`;
                  
                  // Füge den Button zum Container hinzu
                  deleteButtonDiv.appendChild(deleteButton);
                  popupContainer.appendChild(deleteButtonDiv);
                  
                  // Event-Listener für den Löschbutton
                  deleteButton.addEventListener('click', async () => {
                    if (window.confirm('Möchtest du diese Nextbike-Station wirklich löschen?')) {
                      try {
                        // Lösche die Nextbike-Station aus der Datenbank
                        await deleteNextbikeStation(station.id);
                        
                        // Schließe das Popup und entferne den Marker sofort
                        marker.closePopup();
                        marker.remove();
                        
                        // Entferne den Marker aus der Referenzliste
                        nextbikeMarkersRef.current = nextbikeMarkersRef.current.filter(m => m !== marker);
                        
                        // Entferne die Station aus dem State
                        setNextbikeStations(currentStations => currentStations.filter(s => s.id !== station.id));
                        
                        // Erfolgsmeldung anzeigen
                        window.dispatchEvent(new CustomEvent('showNotification', { 
                          detail: { 
                            message: 'Nextbike-Station erfolgreich gelöscht', 
                            severity: 'success' 
                          } 
                        }));
                      } catch (error) {
                        console.error('Fehler beim Löschen der Nextbike-Station:', error);
                        window.dispatchEvent(new CustomEvent('showNotification', { 
                          detail: { 
                            message: 'Fehler beim Löschen der Nextbike-Station', 
                            severity: 'error' 
                          } 
                        }));
                      }
                    }
                  });
                }
              }
            }
          });
          
          // Add marker to the reference array
        nextbikeMarkersRef.current.push(marker);
      });
      }
    } catch (error) {
      console.error('Error fetching and displaying nextbike stations:', error);
    }
  }, [fetchNextbikeStations]);

  // Funktion zum Abrufen und Anzeigen von Reparaturstationen
  const fetchAndDisplayRepairStations = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    
    try {
      // Entferne bestehende Marker
      repairStationMarkersRef.current.forEach(marker => marker.remove());
      repairStationMarkersRef.current = [];
      
      // Layer-Gruppe aktualisieren oder erstellen
      if (repairStationLayerGroupRef.current) {
        repairStationLayerGroupRef.current.clearLayers();
      } else {
        repairStationLayerGroupRef.current = L.layerGroup();
        
        // Nur hinzufügen, wenn der Zoom-Level ausreichend ist
        if (map.getZoom() >= MIN_ZOOM_LEVEL_REPAIR_STATIONS) {
          repairStationLayerGroupRef.current.addTo(map);
        }
      }
      
      // Hole alle Reparaturstationen
      const allRepairStations = await getAllRepairStations();
      setRepairStations(allRepairStations);
      
      // Zeige die Reparaturstationen auf der Karte an
      allRepairStations.forEach((station) => {
        const position = L.latLng(station.position.lat, station.position.lng);
        
        // Erstelle ein benutzerdefiniertes Icon für die Reparaturstation
        const repairIcon = L.divIcon({
          className: 'repair-icon',
          html: `<div style="background-color: #ff9800; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; display: flex; justify-content: center; align-items: center;">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14px" height="14px" fill="white">
                    <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>
                  </svg>
                </div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });
        
        // Erstelle den Marker mit dem benutzerdefinierten Icon
        // Füge den Marker zur Layer-Gruppe hinzu, nicht direkt zur Karte
        const marker = L.marker(position, { icon: repairIcon });
        
        if (repairStationLayerGroupRef.current) {
          marker.addTo(repairStationLayerGroupRef.current);
        }
        
        // Popup-Inhalt erstellen
        let popupContent = `
          <div style="min-width: 180px;">
            <h4 style="margin: 0 0 5px 0; color: #ff9800;">${station.name || 'Reparaturstation'}</h4>
        `;
        
        if (station.description) {
          popupContent += `<p><strong>Beschreibung:</strong> ${station.description}</p>`;
        }
        
        // Zeige die Eigenschaften an
        const features = [];
        if (station.hasAirPump) features.push('Luftpumpe');
        if (station.hasTools) features.push('Werkzeug');
        
        if (features.length > 0) {
          popupContent += `<p><strong>Ausstattung:</strong> ${features.join(', ')}</p>`;
        }
        
        // Öffnungszeiten anzeigen, falls vorhanden
        if (station.openingHours) {
          popupContent += `<p><strong>Öffnungszeiten:</strong> ${station.openingHours}</p>`;
        }
        
        // Erstellt von
        const createdByText = station.createdBy === 'admin' ? 'Administrator' : 'Benutzer';
        popupContent += `<p style="font-size: 0.8em; color: #666;">Hinzugefügt von ${createdByText}</p>`;
        
        // Löschbutton hinzufügen, wenn der aktuelle Benutzer der Ersteller ist oder ein Admin
        const currentUser = auth.currentUser;
        if (currentUser && (currentUser.uid === station.createdBy || currentUser.email === ADMIN_EMAIL)) {
          popupContent += `
            <div style="text-align: right; margin-top: 10px;">
              <button 
                class="repair-delete-button" 
                style="background-color: #f44336; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;"
                data-repair-id="${station.id}">
                Löschen${currentUser.email === ADMIN_EMAIL && currentUser.uid !== station.createdBy ? ' (Admin)' : ''}
              </button>
            </div>
          `;
        }
        
        popupContent += '</div>';
        
        // Füge das Popup hinzu
        marker.bindPopup(popupContent);
        
        // Event-Listener für den Lösch-Button hinzufügen, wenn das Popup geöffnet wird
        marker.on('popupopen', () => {
          const deleteButton = document.querySelector(`.repair-delete-button[data-repair-id="${station.id}"]`);
          if (deleteButton) {
            deleteButton.addEventListener('click', async () => {
              if (window.confirm('Möchtest du diese Reparaturstation wirklich löschen?')) {
                try {
                  // Lösche die Reparaturstation aus der Datenbank
                  await deleteRepairStation(station.id);
                  
                  // Schließe das Popup und entferne den Marker sofort
                  marker.closePopup();
                  marker.remove();
                  
                  // Entferne den Marker aus der Referenzliste
                  repairStationMarkersRef.current = repairStationMarkersRef.current.filter(m => m !== marker);
                  
                  // Entferne die Station aus dem State
                  setRepairStations(currentStations => currentStations.filter(s => s.id !== station.id));
                  
                  // Erfolgsmeldung anzeigen
                  window.dispatchEvent(new CustomEvent('showNotification', { 
                    detail: { 
                      message: 'Reparaturstation erfolgreich gelöscht', 
                      severity: 'success' 
                    } 
                  }));
                } catch (error) {
                  console.error('Fehler beim Löschen der Reparaturstation:', error);
                  window.dispatchEvent(new CustomEvent('showNotification', { 
                    detail: { 
                      message: 'Fehler beim Löschen der Reparaturstation', 
                      severity: 'error' 
                    } 
                  }));
                }
              }
            });
          }
        });
        
        // Speichere den Marker für späteres Entfernen
        repairStationMarkersRef.current.push(marker);
      });
      
    } catch (error) {
      console.error('Error fetching and displaying repair stations:', error);
    }
  }, []); // Die Abhängigkeit von currentZoom haben wir entfernt, da wir direkt map.getZoom() verwenden

  // Funktion zum Abrufen und Anzeigen von E-Bike-Ladestationen
  const fetchAndDisplayChargingStations = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    
    try {
      // Entferne bestehende Marker
      chargingStationMarkersRef.current.forEach(marker => marker.remove());
      chargingStationMarkersRef.current = [];
      
      // Layer-Gruppe aktualisieren oder erstellen
      if (chargingStationLayerGroupRef.current) {
        chargingStationLayerGroupRef.current.clearLayers();
      } else {
        chargingStationLayerGroupRef.current = L.layerGroup();
        
        // Nur hinzufügen, wenn der Zoom-Level ausreichend ist
        if (map.getZoom() >= MIN_ZOOM_LEVEL_CHARGING_STATIONS) {
          chargingStationLayerGroupRef.current.addTo(map);
        }
      }
      
      // Hole alle E-Bike-Ladestationen
      const allChargingStations = await getAllChargingStations();
      setChargingStations(allChargingStations);
      
      // Zeige die E-Bike-Ladestationen auf der Karte an
      allChargingStations.forEach((station) => {
        const position = L.latLng(station.position.lat, station.position.lng);
        
        // Erstelle ein benutzerdefiniertes Icon für die E-Bike-Ladestation
        const chargingIcon = L.divIcon({
          className: 'charging-icon',
          html: `<div style="background-color: #9c27b0; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; display: flex; justify-content: center; align-items: center;">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14px" height="14px" fill="white">
                    <path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4zM11 20v-5.5H9L13 7v5.5h2L11 20z"/>
                  </svg>
                </div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });
        
        // Erstelle den Marker mit dem benutzerdefinierten Icon
        // Füge den Marker zur Layer-Gruppe hinzu, nicht direkt zur Karte
        const marker = L.marker(position, { icon: chargingIcon });
        
        if (chargingStationLayerGroupRef.current) {
          marker.addTo(chargingStationLayerGroupRef.current);
        }
        
        // Popup-Inhalt erstellen
        let popupContent = `
          <div style="min-width: 180px;">
            <h4 style="margin: 0 0 5px 0; color: #9c27b0;">${station.name || 'E-Bike-Ladestation'}</h4>
        `;
        
        if (station.description) {
          popupContent += `<p><strong>Beschreibung:</strong> ${station.description}</p>`;
        }
        
        if (station.plugType) {
          popupContent += `<p><strong>Steckertyp:</strong> ${station.plugType}</p>`;
        }
        
        if (station.chargeSpeed) {
          let speedText = '';
          switch (station.chargeSpeed) {
            case 'slow': speedText = 'Langsam (bis 3,7 kW)'; break;
            case 'medium': speedText = 'Mittel (3,7-11 kW)'; break;
            case 'fast': speedText = 'Schnell (über 11 kW)'; break;
            default: speedText = station.chargeSpeed;
          }
          popupContent += `<p><strong>Ladegeschwindigkeit:</strong> ${speedText}</p>`;
        }
        
        if (station.price) {
          let priceText = '';
          switch (station.price) {
            case 'free': priceText = 'Kostenlos'; break;
            case 'paid': priceText = 'Kostenpflichtig'; break;
            case 'subscription': priceText = 'Mit Abo/Karte'; break;
            default: priceText = station.price;
          }
          popupContent += `<p><strong>Kosten:</strong> ${priceText}</p>`;
        }
        
        if (station.isPublic !== undefined) {
          popupContent += `<p><strong>Zugang:</strong> ${station.isPublic ? 'Öffentlich' : 'Privat'}</p>`;
        }
        
        if (station.openingHours) {
          popupContent += `<p><strong>Öffnungszeiten:</strong> ${station.openingHours}</p>`;
        }
        
        if (station.rating) {
          const ratingStars = '★'.repeat(Math.floor(station.rating)) + (station.rating % 1 ? '½' : '');
          popupContent += `
            <div style="font-size: 12px; margin-bottom: 4px;">
              <strong>Bewertung:</strong> 
              <span style="color: orange; font-size: 13px;">${ratingStars}</span>
            </div>
          `;
        }
        
        // Füge Lösch-Button hinzu, wenn der aktuelle Benutzer der Ersteller ist oder ein Admin
        const currentUser = auth.currentUser;
        if (currentUser && (currentUser.uid === station.createdBy || currentUser.email === ADMIN_EMAIL)) {
        popupContent += `
            <div style="text-align: right; margin-top: 10px;">
              <button 
                class="charging-delete-button" 
                style="background-color: #f44336; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;"
                data-charging-id="${station.id}">
                Löschen${currentUser.email === ADMIN_EMAIL && currentUser.uid !== station.createdBy ? ' (Admin)' : ''}
              </button>
          </div>
        `;
        }
        
        popupContent += '</div>';
        
        // Füge das Popup hinzu
        marker.bindPopup(popupContent);
        
        // Event-Listener für den Lösch-Button
        marker.on('popupopen', () => {
          const deleteButton = document.querySelector(`.charging-delete-button[data-charging-id="${station.id}"]`);
          if (deleteButton) {
            deleteButton.addEventListener('click', async () => {
              if (window.confirm('Möchtest du diese Ladestation wirklich löschen?')) {
                try {
                  // Lösche die Ladestation aus der Datenbank
                  await deleteChargingStation(station.id);
                  
                  // Schließe das Popup und entferne den Marker sofort
                  marker.closePopup();
                  marker.remove();
                  
                  // Entferne den Marker aus der Referenzliste
                  chargingStationMarkersRef.current = chargingStationMarkersRef.current.filter(m => m !== marker);
                  
                  // Entferne die Station aus dem State
                  setChargingStations(currentStations => currentStations.filter(s => s.id !== station.id));
                  
                  // Erfolgsmeldung anzeigen
                  window.dispatchEvent(new CustomEvent('showNotification', { 
                    detail: { 
                      message: 'Ladestation erfolgreich gelöscht', 
                      severity: 'success' 
                    } 
                  }));
                } catch (error) {
                  console.error('Fehler beim Löschen der Ladestation:', error);
                  window.dispatchEvent(new CustomEvent('showNotification', { 
                    detail: { 
                      message: 'Fehler beim Löschen der Ladestation', 
                      severity: 'error' 
                    } 
                  }));
                }
              }
            });
          }
        });
        
        // Speichere den Marker für späteres Entfernen
        chargingStationMarkersRef.current.push(marker);
      });
      
    } catch (error) {
      console.error('Error fetching and displaying charging stations:', error);
    }
  }, []); // Die Abhängigkeit von currentZoom haben wir entfernt, da wir direkt map.getZoom() verwenden

  // Definiere updateLayerVisibility als useCallback
  const updateLayerVisibility = useCallback((zoomLevel: number) => {
    // Stelle sicher, dass die Map-Referenz existiert
    if (!mapRef.current) return;
    
    console.log("Updating layer visibility for zoom level:", zoomLevel);
    
    // POI Layer-Gruppe
    if (poiLayerGroupRef.current) {
      try {
        // Zeige POIs nur basierend auf dem Zoom-Level
        if (zoomLevel >= MIN_ZOOM_LEVEL_POIS) {
          if (!mapRef.current.hasLayer(poiLayerGroupRef.current)) {
            console.log("Adding POI layer - zoom:", zoomLevel);
            mapRef.current.addLayer(poiLayerGroupRef.current);
          }
        } else {
          if (mapRef.current.hasLayer(poiLayerGroupRef.current)) {
            console.log("Removing POI layer - zoom:", zoomLevel);
            mapRef.current.removeLayer(poiLayerGroupRef.current);
          }
        }
      } catch (error) {
        console.error("Fehler beim Aktualisieren der POI-Layer-Sichtbarkeit:", error);
      }
    }
    
    // Fahrradständer Layer-Gruppe
    if (bikeStandLayerGroupRef.current) {
      try {
        // Zeige Fahrradständer nur basierend auf dem Zoom-Level
        if (zoomLevel >= MIN_ZOOM_LEVEL_BIKE_STANDS) {
          if (!mapRef.current.hasLayer(bikeStandLayerGroupRef.current)) {
            console.log("Adding BikeStand layer - zoom:", zoomLevel);
            mapRef.current.addLayer(bikeStandLayerGroupRef.current);
          }
        } else {
          if (mapRef.current.hasLayer(bikeStandLayerGroupRef.current)) {
            console.log("Removing BikeStand layer - zoom:", zoomLevel);
            mapRef.current.removeLayer(bikeStandLayerGroupRef.current);
          }
        }
      } catch (error) {
        console.error("Fehler beim Aktualisieren der Fahrradständer-Layer-Sichtbarkeit:", error);
      }
    }
    
    // Reparaturstation Layer-Gruppe
    if (repairStationLayerGroupRef.current) {
      try {
        // Zeige Reparaturstationen nur basierend auf dem Zoom-Level
        if (zoomLevel >= MIN_ZOOM_LEVEL_REPAIR_STATIONS) {
          if (!mapRef.current.hasLayer(repairStationLayerGroupRef.current)) {
            console.log("Adding RepairStation layer - zoom:", zoomLevel);
            mapRef.current.addLayer(repairStationLayerGroupRef.current);
          }
        } else {
          if (mapRef.current.hasLayer(repairStationLayerGroupRef.current)) {
            console.log("Removing RepairStation layer - zoom:", zoomLevel);
            mapRef.current.removeLayer(repairStationLayerGroupRef.current);
          }
        }
      } catch (error) {
        console.error("Fehler beim Aktualisieren der Reparaturstation-Layer-Sichtbarkeit:", error);
      }
    }
    
    // Ladestation Layer-Gruppe
    if (chargingStationLayerGroupRef.current) {
      try {
        // Zeige Ladestationen nur basierend auf dem Zoom-Level
        if (zoomLevel >= MIN_ZOOM_LEVEL_CHARGING_STATIONS) {
          if (!mapRef.current.hasLayer(chargingStationLayerGroupRef.current)) {
            console.log("Adding ChargingStation layer - zoom:", zoomLevel);
            mapRef.current.addLayer(chargingStationLayerGroupRef.current);
          }
        } else {
          if (mapRef.current.hasLayer(chargingStationLayerGroupRef.current)) {
            console.log("Removing ChargingStation layer - zoom:", zoomLevel);
            mapRef.current.removeLayer(chargingStationLayerGroupRef.current);
          }
        }
      } catch (error) {
        console.error("Fehler beim Aktualisieren der Ladestation-Layer-Sichtbarkeit:", error);
      }
    }
    
    // Nextbike Layer-Gruppe
    if (nextbikeLayerGroupRef.current) {
      try {
        // Zeige Nextbike-Stationen nur basierend auf dem Zoom-Level
        if (zoomLevel >= MIN_ZOOM_LEVEL_NEXTBIKE) {
          if (!mapRef.current.hasLayer(nextbikeLayerGroupRef.current)) {
            console.log("Adding Nextbike layer - zoom:", zoomLevel);
            mapRef.current.addLayer(nextbikeLayerGroupRef.current);
            // Reaktiviere die automatische Aktualisierung bei Zoom-Änderungen
            fetchAndDisplayNextbikeStations();
          }
        } else {
          if (mapRef.current.hasLayer(nextbikeLayerGroupRef.current)) {
            console.log("Removing Nextbike layer - zoom:", zoomLevel);
            mapRef.current.removeLayer(nextbikeLayerGroupRef.current);
          }
        }
      } catch (error) {
        console.error("Fehler beim Aktualisieren der Nextbike-Layer-Sichtbarkeit:", error);
      }
    }

    // Routenpunkte Layer-Gruppe - nur diese bleibt vom Editiermodus abhängig
    if (routePointLayerGroupRef.current) {
      try {
        // Zeige Routenpunkte nur an, wenn der Zeichnungsmodus aktiv ist UND der Zoom-Level ausreichend ist
        if (zoomLevel >= MIN_ZOOM_LEVEL_ROUTE_POINTS && isDrawingMode) {
          if (!mapRef.current.hasLayer(routePointLayerGroupRef.current)) {
            console.log("Adding RoutePoints layer - zoom:", zoomLevel, "mode:", isDrawingMode);
            mapRef.current.addLayer(routePointLayerGroupRef.current);
          }
        } else {
          if (mapRef.current.hasLayer(routePointLayerGroupRef.current)) {
            console.log("Removing RoutePoints layer - zoom:", zoomLevel, "mode:", isDrawingMode);
            mapRef.current.removeLayer(routePointLayerGroupRef.current);
          }
        }
      } catch (error) {
        console.error("Fehler beim Aktualisieren der Routenpunkte-Layer-Sichtbarkeit:", error);
      }
    }
  }, [isDrawingMode, fetchAndDisplayNextbikeStations]);

  // Modifiziere die fetchAndDisplayPOIs-Funktion
  const fetchAndDisplayPOIs = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    
    try {
      // Lösche bestehende Marker und Layer
      poiMarkersRef.current.forEach(marker => marker.remove());
      poiMarkersRef.current = [];
      
      if (poiLayerGroupRef.current) {
        poiLayerGroupRef.current.clearLayers();
      } else {
        poiLayerGroupRef.current = L.layerGroup();
        
        // Nur hinzufügen, wenn der Zoom-Level ausreichend ist
        if (currentZoom >= MIN_ZOOM_LEVEL_POIS) {
          poiLayerGroupRef.current.addTo(map);
        }
      }
      
      // Hole alle POIs
      const allPOIs = await getAllPois();
      setPois(allPOIs);
      
      // Zeige die POIs auf der Karte an
      allPOIs.forEach((poi) => {
        const position = L.latLng(poi.position.lat, poi.position.lng);
        
        // Erstelle ein benutzerdefiniertes Icon für den POI
        const poiIcon = L.divIcon({
          className: 'poi-icon',
          html: `<div style="background-color: #f44336; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; display: flex; justify-content: center; align-items: center;">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14px" height="14px" fill="white">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  </svg>
                </div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });
        
        // Erstelle den Marker mit dem benutzerdefinierten Icon
        const marker = L.marker(position, { icon: poiIcon });
        
        // Den Marker zur passenden Layer-Gruppe hinzufügen
        if (poiLayerGroupRef.current) {
          marker.addTo(poiLayerGroupRef.current);
        }
        
        // Speichere den Marker für späteres Entfernen
        poiMarkersRef.current.push(marker);
        
        // Popup-Inhalt erstellen
        let popupContent = `
          <div style="min-width: 180px;">
            <h4 style="margin: 0 0 5px 0; color: #f44336;">${poi.name || 'Interessanter Ort'}</h4>
        `;
        
        if (poi.description) {
          popupContent += `<p><strong>Beschreibung:</strong> ${poi.description}</p>`;
        }
        
        if (poi.category) {
          popupContent += `<p><strong>Kategorie:</strong> ${poi.category}</p>`;
        }
        
        if (poi.website) {
          popupContent += `<p><strong>Website:</strong> <a href="${poi.website}" target="_blank">${poi.website}</a></p>`;
        }
        
        if (poi.phoneNumber) {
          popupContent += `<p><strong>Telefon:</strong> ${poi.phoneNumber}</p>`;
        }
        
        if (poi.openingHours) {
          popupContent += `<p><strong>Öffnungszeiten:</strong> ${poi.openingHours}</p>`;
        }
        
        if (poi.rating) {
          const ratingStars = '★'.repeat(Math.floor(poi.rating)) + (poi.rating % 1 ? '½' : '');
          popupContent += `
            <div style="font-size: 12px; margin-bottom: 4px;">
              <strong>Bewertung:</strong> 
              <span style="color: orange; font-size: 13px;">${ratingStars}</span>
            </div>
          `;
        }
        
        // Füge Lösch-Button hinzu, wenn der aktuelle Benutzer der Ersteller ist oder ein Admin
        const currentUser = auth.currentUser;
        if (currentUser && (currentUser.uid === poi.createdBy || currentUser.email === ADMIN_EMAIL)) {
          popupContent += `
            <div style="text-align: right; margin-top: 10px;">
              <button 
                class="poi-delete-button" 
                style="background-color: #f44336; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;"
                data-poi-id="${poi.id}">
                Löschen${currentUser.email === ADMIN_EMAIL && currentUser.uid !== poi.createdBy ? ' (Admin)' : ''}
              </button>
            </div>
          `;
        }
        
        popupContent += '</div>';
        
        // Füge das Popup hinzu
        marker.bindPopup(popupContent);
        
        // Event-Listener für den Lösch-Button
        marker.on('popupopen', () => {
          const deleteButton = document.querySelector(`.poi-delete-button[data-poi-id="${poi.id}"]`);
          if (deleteButton) {
            deleteButton.addEventListener('click', async () => {
              if (window.confirm('Möchtest du diesen POI wirklich löschen?')) {
                try {
                  // Lösche den POI aus der Datenbank
                  await deletePoi(poi.id);
                  
                  // Schließe das Popup und entferne den Marker sofort
                  marker.closePopup();
                  marker.remove();
                  
                  // Entferne den Marker aus der Referenzliste
                  poiMarkersRef.current = poiMarkersRef.current.filter(m => m !== marker);
                  
                  // Entferne den POI aus dem State
                  setPois(currentPois => currentPois.filter(p => p.id !== poi.id));
                  
                  // Erfolgsmeldung anzeigen
                  window.dispatchEvent(new CustomEvent('showNotification', { 
                    detail: { 
                      message: 'POI erfolgreich gelöscht', 
                      severity: 'success' 
                    } 
                  }));
                } catch (error) {
                  console.error('Fehler beim Löschen des POI:', error);
                  window.dispatchEvent(new CustomEvent('showNotification', { 
                    detail: { 
                      message: 'Fehler beim Löschen des POI', 
                      severity: 'error' 
                    } 
                  }));
                }
              }
            });
          }
        });
      });
    } catch (error) {
      console.error('Error fetching and displaying POIs:', error);
    }
  }, [currentZoom]);

  // Funktion zum Abrufen und Anzeigen aller POI-Typen
  const fetchAndDisplayAllPOIs = useCallback(async () => {
    await Promise.all([
      fetchAndDisplayBikeStands(),
      fetchAndDisplayNextbikeStations(),
      fetchAndDisplayRepairStations(),
      fetchAndDisplayChargingStations(),
      fetchAndDisplayPOIs()
    ]);
  }, [
    fetchAndDisplayBikeStands,
    fetchAndDisplayNextbikeStations,
    fetchAndDisplayRepairStations,
    fetchAndDisplayChargingStations,
    fetchAndDisplayPOIs
  ]);

  // Expose methods for parent component
  useImperativeHandle(ref, () => ({
    refreshRoutes: async () => {
      const currentUser = auth.currentUser;
      if (currentUser) {
        await fetchUserRoutes(currentUser.uid);
        }
        await fetchPublicRoutes();
    },
    refreshBikeStands: async () => {
        await fetchAndDisplayBikeStands();
    },
    refreshPOIs: async () => {
        await fetchAndDisplayAllPOIs();
    },
    zoomToRoute: (bounds: L.LatLngBounds) => {
      if (mapRef.current) {
        mapRef.current.fitBounds(bounds);
      }
    },
    displayRouteForReview: (route: BikeRoute) => {
      // Entferne vorherige temporäre Routen (falls vorhanden)
      if (reviewRouteRef.current) {
        reviewRouteRef.current.remove();
        reviewRouteRef.current = null;
      }
      
      if (reviewStartMarkerRef.current) {
        reviewStartMarkerRef.current.remove();
        reviewStartMarkerRef.current = null;
      }
      
      if (reviewEndMarkerRef.current) {
        reviewEndMarkerRef.current.remove();
        reviewEndMarkerRef.current = null;
      }
      
      // Nur fortfahren, wenn die Map existiert
      if (!mapRef.current) return;
      
      // Konvertiere Routen-Punkte in L.LatLng-Format
      const latLngs = route.points.map(point => new L.LatLng(point.lat, point.lng));
      
      // Erstelle eine spezielle Darstellung für die zu überprüfende Route
      // Erzeugen eines mehrfarbigen Linienverlaufs für bessere Sichtbarkeit
      reviewRouteRef.current = L.polyline(latLngs, {
        color: '#FF4500', // Orangerot als Basis
        weight: 6,        // Breitere Linie für bessere Sichtbarkeit
        opacity: 0.9,     // Höhere Opazität
        dashArray: '10, 5', // Gestrichelter Linienstil
        // Füge einen Gloweffekt hinzu
        className: 'review-route-highlight',
      }).addTo(mapRef.current);

      // Gloweffekt mit CSS dynamisch hinzufügen
      const style = document.createElement('style');
      style.setAttribute('data-review-style', 'true');
      style.innerHTML = `
        .review-route-highlight {
          filter: drop-shadow(0 0 5px rgba(255, 69, 0, 0.7));
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0% { opacity: 0.7; }
          50% { opacity: 1; }
          100% { opacity: 0.7; }
        }
      `;
      document.head.appendChild(style);
      
      // Füge Start- und Endpunkt-Marker hinzu
      reviewStartMarkerRef.current = L.marker(latLngs[0], {
        icon: L.divIcon({
          className: 'review-start-marker',
          html: `<div style="
            background-color: #FF4500; 
            width: 16px; 
            height: 16px; 
            border-radius: 50%; 
            border: 3px solid white;
            box-shadow: 0 0 8px rgba(0, 0, 0, 0.5);
            position: relative;
          ">
            <div style="
              position: absolute;
              top: -8px;
              left: 16px;
              white-space: nowrap;
              padding: 2px 4px;
              background: rgba(255, 255, 255, 0.8);
              border-radius: 3px;
              font-weight: bold;
              font-size: 11px;
            ">Start</div>
          </div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        })
      }).addTo(mapRef.current);
      
      reviewEndMarkerRef.current = L.marker(latLngs[latLngs.length - 1], {
        icon: L.divIcon({
          className: 'review-end-marker',
          html: `<div style="
            background-color: #FF4500; 
            width: 16px; 
            height: 16px; 
            border-radius: 50%; 
            border: 3px solid white;
            box-shadow: 0 0 8px rgba(0, 0, 0, 0.5);
            position: relative;
          ">
            <div style="
              position: absolute;
              top: -8px;
              left: 16px;
              white-space: nowrap;
              padding: 2px 4px;
              background: rgba(255, 255, 255, 0.8);
              border-radius: 3px;
              font-weight: bold;
              font-size: 11px;
            ">Ziel</div>
          </div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        })
      }).addTo(mapRef.current);
      
      // Popup mit Routeninformationen
      const popupContent = `
        <div style="font-family: Arial, sans-serif; max-width: 250px;">
          <h3 style="margin: 0 0 8px 0; color: #FF4500;">${route.name}</h3>
          ${route.description ? `<p style="margin: 0 0 5px 0;">${route.description}</p>` : ''}
          ${route.rating ? `<p style="margin: 0 0 5px 0;"><strong>Bewertung:</strong> ${route.rating} Sterne</p>` : ''}
          ${route.slope ? `<p style="margin: 0 0 5px 0;"><strong>Steigung:</strong> ${route.slope}</p>` : ''}
          <p style="margin: 5px 0 0 0; font-style: italic; font-size: 12px; color: #666;">Route wird überprüft</p>
        </div>
      `;
      
      reviewRouteRef.current.bindPopup(popupContent).openPopup();
    },
    clearReviewRoute: () => {
      // Entferne temporäre Routen und Marker
      if (reviewRouteRef.current) {
        reviewRouteRef.current.remove();
        reviewRouteRef.current = null;
      }
      
      if (reviewStartMarkerRef.current) {
        reviewStartMarkerRef.current.remove();
        reviewStartMarkerRef.current = null;
      }
      
      if (reviewEndMarkerRef.current) {
        reviewEndMarkerRef.current.remove();
        reviewEndMarkerRef.current = null;
      }
      
      // Entferne dynamisch hinzugefügte CSS-Styles
      const reviewStyles = document.querySelectorAll('style[data-review-style]');
      reviewStyles.forEach(style => style.remove());
    }
  }));

  // Neuer Handler für Klicks im Nextbike-Modus
  const handleNextbikeClick = (e: L.LeafletMouseEvent) => {
    // Nextbike-Funktionalität wurde entfernt
    return;
  };

  // Neuer Handler für Klicks im Reparaturstations-Modus
  const handleRepairStationClick = (e: L.LeafletMouseEvent) => {
    if (!isRepairStationMode) return;
    
    console.log('Adding repair station at:', e.latlng);
    if (onAddPOI) {
      onAddPOI(e.latlng, 'repairStation');
    }
  };

  // Neuer Handler für Klicks im Ladestations-Modus
  const handleChargingStationClick = (e: L.LeafletMouseEvent) => {
    if (!isChargingStationMode) return;
    
    console.log('Adding charging station at:', e.latlng);
    if (onAddPOI) {
      onAddPOI(e.latlng, 'chargingStation');
    }
  };

  // Neuer Handler für Klicks im POI-Modus
  const handlePoiClick = (e: L.LeafletMouseEvent) => {
    if (!isPoiMode) return;
    
    console.log('Adding POI at:', e.latlng);
    if (onAddPOI) {
      onAddPOI(e.latlng, 'poi');
    }
  };

  // Füge useEffect für die verschiedenen POI-Modi hinzu
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    
    // Clean up previous click handlers to avoid duplicates
    map.off('click', handleNextbikeClick);
    map.off('click', handleRepairStationClick);
    map.off('click', handleChargingStationClick);
    map.off('click', handlePoiClick);
    
    // Add click handlers only when in the respective mode
    if (isNextBikeMode) {
      map.on('click', handleNextbikeClick);
      console.log("Nextbike mode activated - map click handler added");
    } else if (isRepairStationMode) {
      map.on('click', handleRepairStationClick);
      console.log("Repair station mode activated - map click handler added");
    } else if (isChargingStationMode) {
      map.on('click', handleChargingStationClick);
      console.log("Charging station mode activated - map click handler added");
    } else if (isPoiMode) {
      map.on('click', handlePoiClick);
      console.log("POI mode activated - map click handler added");
    }
    
    return () => {
      map.off('click', handleNextbikeClick);
      map.off('click', handleRepairStationClick);
      map.off('click', handleChargingStationClick);
      map.off('click', handlePoiClick);
    };
  }, [isNextBikeMode, isRepairStationMode, isChargingStationMode, isPoiMode]);

  // Lade alle POIs beim Komponentenaufbau
  useEffect(() => {
    if (mapRef.current) {
      fetchAndDisplayAllPOIs();
    }
  }, [fetchAndDisplayAllPOIs]);

  const [routeFound, setRouteFound] = useState(false);
  const [routeDistance, setRouteDistance] = useState(0);
  const [routeDuration, setRouteDuration] = useState(0);
  
  // States für das Speichern von Navigationsrouten
  const [saveNavRouteDialogOpen, setSaveNavRouteDialogOpen] = useState(false);
  const [navRouteName, setNavRouteName] = useState("Meine Navigationsroute");
  const [navRouteDescription, setNavRouteDescription] = useState("");

  // Neuer Handler für das Speichern einer Navigationsroute
  const handleSaveNavigationRoute = async () => {
    // Prüfen, ob der Benutzer eingeloggt ist
    if (!auth.currentUser) {
      console.error('Benutzer ist nicht eingeloggt.');
      setSnackbarMessage('Du musst eingeloggt sein, um eine Route zu speichern');
      setSnackbarSeverity('warning');
      setSnackbarOpen(true);
      return;
    }
    
    // Prüfen, ob eine Route berechnet wurde
    if (!routeFound) {
      console.error('Keine Route zum Speichern gefunden.');
      setSnackbarMessage('Es wurde keine Route gefunden, die gespeichert werden kann');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }
    
    try {
      // Die aktuelle Route aus den berechneten Punkten extrahieren
      // Wenn wir routePoints haben (gespeichert während der Routenberechnung), nutzen wir diese
      const routePointsArray = currentRoutePoints.current || [];
      
      if (routePointsArray.length < 2) {
        console.error('Nicht genügend Punkte für eine gültige Route');
        setSnackbarMessage('Die Route enthält zu wenige Punkte');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
        return;
      }
      
      // Konvertiere LatLng-Objekte in einfache { lat, lng } Objekte
      const routePoints = routePointsArray.map(point => ({
        lat: point.lat,
        lng: point.lng
      }));
      
      // Speichere die Navigationsroute in Firebase
      const routeId = await saveNavigationRoute(
        auth.currentUser.uid,
        routePoints,
        navRouteName,
        navRouteDescription
      );
      
      console.log('Navigationsroute erfolgreich gespeichert:', routeId);
      
      // Löse ein benutzerdefiniertes Event aus, um die Sidebar zu aktualisieren
      const event = new CustomEvent('navigationRouteSaved', {
        detail: { userId: auth.currentUser.uid }
      });
      window.dispatchEvent(event);
      
      // Feedback und Dialog schließen
      setSnackbarMessage('Route erfolgreich gespeichert!');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      setSaveNavRouteDialogOpen(false);
      
      // Optional: Setze die Felder zurück
      setNavRouteName("Meine Navigationsroute");
      setNavRouteDescription("");
    } catch (error) {
      console.error('Fehler beim Speichern der Navigationsroute:', error);
      setSnackbarMessage('Fehler beim Speichern der Route.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };
  
  // States für Snackbar-Benachrichtigungen
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'warning' | 'info'>('success');

  // State und Refs für die Navigation
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigationStartPoint, setNavigationStartPoint] = useState<L.LatLng | null>(null);
  const [navigationEndPoint, setNavigationEndPoint] = useState<L.LatLng | null>(null);
  const navigationRouteLayer = useRef<L.LayerGroup | null>(null);
  const routePointMarkers = useRef<L.Marker[]>([]);
  const currentRoutePoints = useRef<L.LatLng[]>([]);

  // Referenz für die Sichtbarkeit von Navigationsrouten
  const navRouteVisibilityRef = useRef<{[key: string]: boolean}>({});

  // Zustand für aktuell angezeigte Navigationsroute
  const [visibleNavRoute, setVisibleNavRoute] = useState<{
    id: string;
    points: {lat: number; lng: number}[];
    name: string;
  } | null>(null);

  // Layer für die aktuell angezeigte Navigationsroute
  const navRouteLayerRef = useRef<L.Polyline | null>(null);
  
  // Event-Listener für das Anzeigen/Ausblenden von Navigationsrouten
  useEffect(() => {
    // Event-Handler für das Anzeigen einer Navigationsroute
    const handleShowNavRoute = (event: any) => {
      const { routeId, points, name } = event.detail;
      console.log('Zeige Navigationsroute an:', routeId);
      
      // Speichere, dass diese Navigationsroute sichtbar sein soll
      navRouteVisibilityRef.current[routeId] = true;
      
      // Aktiviere die Anzeige der Route
      setVisibleNavRoute({ id: routeId, points, name });
    };

    // Event-Handler für das Ausblenden einer Navigationsroute
    const handleHideNavRoute = (event: any) => {
      const routeId = event.detail?.routeId;
      console.log('Verstecke Navigationsroute:', routeId);
      
      // 1. navRouteLayer entfernen (für die speziell angezeigte Navigationsroute)
      if (navRouteLayerRef.current) {
        navRouteLayerRef.current.remove();
        navRouteLayerRef.current = null;
      }
      
      // 2. Wenn die Route auch als normaler Fahrradweg angezeigt wird, verstecken wir sie
      if (routeId && savedRoutesLayersRef.current[routeId]) {
        // Wir speichern die Sichtbarkeit, um sie später wiederherstellen zu können
        navRouteVisibilityRef.current[routeId] = false;
        
        // Entferne die Route von der Karte, behalte aber die Referenz
        const routeLayer = savedRoutesLayersRef.current[routeId];
        if (routeLayer && mapRef.current) {
          routeLayer.remove();
        }
      }
      
      setVisibleNavRoute(null);
    };

    // Event-Listener registrieren
    window.addEventListener('showNavRoute', handleShowNavRoute);
    window.addEventListener('hideNavRoute', handleHideNavRoute);

    // Event-Listener beim Aufräumen entfernen
    return () => {
      window.removeEventListener('showNavRoute', handleShowNavRoute);
      window.removeEventListener('hideNavRoute', handleHideNavRoute);
    };
  }, []);

  // Navigationsroute auf der Karte anzeigen oder ausblenden
  useEffect(() => {
    if (!mapRef.current) return;
    
    // Bestehende Route entfernen
    if (navRouteLayerRef.current) {
      navRouteLayerRef.current.remove();
      navRouteLayerRef.current = null;
    }
    
    // Wenn eine Route angezeigt werden soll, sie zeichnen
    if (visibleNavRoute && visibleNavRoute.points && visibleNavRoute.points.length > 0) {
      console.log('Zeichne Navigationsroute auf der Karte:', visibleNavRoute.id);
      
      const points = visibleNavRoute.points.map(point => [point.lat, point.lng] as [number, number]);
      
      // Route mit oranger Farbe zeichnen (wie berechnete Navigationsrouten)
      navRouteLayerRef.current = L.polyline(points, {
        color: '#FF9800', // Orange
        weight: 5,
        opacity: 0.7
      }).addTo(mapRef.current);
      
      // Popup mit dem Namen der Route
      if (visibleNavRoute.name) {
        navRouteLayerRef.current.bindPopup(`<b>${visibleNavRoute.name}</b>`);
      }
      
      // Karte auf die Route zentrieren
      mapRef.current.fitBounds(navRouteLayerRef.current.getBounds());
    } else {
      console.log('Keine Navigationsroute zum Anzeigen');
    }
  }, [visibleNavRoute]);

  // Initialisiere die Map nach dem ersten Rendering
  useEffect(() => {
    console.log('Initialisiere Map');
    if (!mapRef.current) {
      console.log('Erstelle neue Map-Instanz');
      // Hier erstellen wir eine neue Leaflet-Instanz, falls noch keine existiert
      const newMap = L.map('map', {
        center: [52.520008, 13.404954], // Berlin als Startpunkt
        zoom: 13,
        layers: [
          // OpenStreetMap-Layer als Standard
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
          })
        ]
      });
      
      // Map-Referenz speichern
      mapRef.current = newMap;

      // Initialisiere den Referenz-Wert für die Navigation-Routes Visibility
      // Alle Routen standardmäßig auf unsichtbar setzen
      navRouteVisibilityRef.current = {};

      // Layer-Gruppen initialisieren - nicht direkt zur Karte hinzufügen
      poiLayerGroupRef.current = L.layerGroup();
      bikeStandLayerGroupRef.current = L.layerGroup();
      repairStationLayerGroupRef.current = L.layerGroup();
      chargingStationLayerGroupRef.current = L.layerGroup();
      nextbikeLayerGroupRef.current = L.layerGroup();
      routePointLayerGroupRef.current = L.layerGroup();
      
      // Initialen Zoom-Level setzen
      setCurrentZoom(newMap.getZoom());
      
      // Event-Handler für Zoom-Änderungen
      newMap.on('zoomend', () => {
        const newZoom = newMap.getZoom();
        setCurrentZoom(newZoom);
        
        // Sichtbarkeit der Layer basierend auf Zoom-Level aktualisieren
        updateLayerVisibility(newZoom);
      });
      
      // Initialisiere die Sichtbarkeit basierend auf dem Start-Zoom-Level
      updateLayerVisibility(newMap.getZoom());
    }
  }, [updateLayerVisibility]);

  // Lade alle POIs beim Start
  useEffect(() => {
    fetchAndDisplayBikeStands();
    fetchAndDisplayNextbikeStations(); // Reaktiviere das automatische Laden beim Start
    fetchAndDisplayRepairStations();
    fetchAndDisplayChargingStations();
    fetchAndDisplayPOIs();
    
    // Set up zoom change handler to update layer visibility
    const updateOnZoomChange = () => {
      if (mapRef.current) {
        const zoom = mapRef.current.getZoom();
        console.log('Zoom changed to:', zoom);
        updateLayerVisibility(zoom);
      }
    };
    
    if (mapRef.current) {
      mapRef.current.on('zoomend', updateOnZoomChange);
      // Also trigger initial visibility update
      updateOnZoomChange();
    }
    
    return () => {
      if (mapRef.current) {
        mapRef.current.off('zoomend', updateOnZoomChange);
      }
    };
  }, [fetchAndDisplayBikeStands, fetchAndDisplayNextbikeStations, fetchAndDisplayRepairStations, fetchAndDisplayChargingStations, fetchAndDisplayPOIs, updateLayerVisibility]);

  // Finde das nächste Routensegment zum angeklickten Punkt
  const findNearestRouteSegment = (clickPoint: L.LatLng): {
    routeId: string;
    segment: [L.LatLng, L.LatLng];
    insertIndex: number;
    distance: number; // in km
  } | null => {
    let minDistance = Infinity;
    let result = null;
    
    // Durchlaufe alle gespeicherten Routen
    savedRoutes.forEach((route) => {
      if (!route.id || !route.points || route.points.length < 2) return;
      
      const latlngs = route.points.map(point => 
        new L.LatLng(point.lat, point.lng)
      );
      
      // Durchlaufe alle Segmente der Route
      for (let i = 0; i < latlngs.length - 1; i++) {
        const p1 = latlngs[i];
        const p2 = latlngs[i + 1];
        
        // Berechne den Abstand vom Klickpunkt zum Segment
        const distance = distanceToSegment(clickPoint, p1, p2);
        
        // Aktualisiere das Ergebnis, wenn ein näheres Segment gefunden wurde
        if (distance < minDistance) {
          minDistance = distance;
          result = {
            routeId: route.id,
            segment: [p1, p2] as [L.LatLng, L.LatLng],
            insertIndex: i + 1, // Der neue Punkt wird nach p1 eingefügt (Index i+1)
            distance: distance
          };
        }
      }
    });
    
    return result;
  };
  
  // Berechnet den Abstand eines Punkts zu einem Liniensegment
  const distanceToSegment = (point: L.LatLng, segmentStart: L.LatLng, segmentEnd: L.LatLng): number => {
    const p = point;
    const v = segmentStart;
    const w = segmentEnd;
    
    // Quadrat der Länge des Segments
    const l2 = Math.pow(calculateDistance(v, w), 2);
    
    if (l2 === 0) {
      // Segment ist ein Punkt
      return calculateDistance(p, v);
    }
    
    // Berechne Projektion des Punkts auf das Segment
    const t = ((p.lat - v.lat) * (w.lat - v.lat) + (p.lng - v.lng) * (w.lng - v.lng)) / l2;
    
    if (t < 0) {
      // Außerhalb des Segments, näher an v
      return calculateDistance(p, v);
    }
    
    if (t > 1) {
      // Außerhalb des Segments, näher an w
      return calculateDistance(p, w);
    }
    
    // Auf dem Segment, berechne den Abstand zum projizierten Punkt
    const projection = new L.LatLng(
      v.lat + t * (w.lat - v.lat),
      v.lng + t * (w.lng - v.lng)
    );
    
    return calculateDistance(p, projection);
  };

  // Aktualisiere die Routenpunkte, wenn sich das Zoom-Level ändert
  useEffect(() => {
    // Nur die Routenpunkte aktualisieren, wenn sich das Zoom-Level ändert
    if (mapRef.current) {
      // Prüfen, ob das Zoom-Level für Routenpunkte erreicht ist
      const currentZoomLevel = mapRef.current.getZoom();
      
      if (currentZoomLevel >= MIN_ZOOM_LEVEL_ROUTE_POINTS) {
        // Zeige die Routenpunkte an
        displayRoutePoints();
      } else {
        // Entferne die Routenpunkte, wenn das Zoom-Level zu niedrig ist
        if (routePointLayerGroupRef.current) {
          routePointLayerGroupRef.current.clearLayers();
        }
      }
    }
  }, [currentZoom]);

  // Bearbeitungsmodi-Änderungen erkennen und Layer-Sichtbarkeit aktualisieren
  useEffect(() => {
    // Stelle sicher, dass die Map-Referenz existiert
    if (mapRef.current) {
      // Aktualisiere die Sichtbarkeit basierend auf dem aktuellen Zoom-Level
      const currentZoomLevel = mapRef.current.getZoom();
      console.log("Edit mode changed - updating layer visibility with zoom:", currentZoomLevel);
      updateLayerVisibility(currentZoomLevel);
    }
  }, [updateLayerVisibility]); // updateLayerVisibility enthält bereits alle Modi-Abhängigkeiten

  // Zoom-Änderung erkennen und Layer-Sichtbarkeit aktualisieren
  useEffect(() => {
    if (!mapRef.current) return;
    
    // Funktion zum Verarbeiten von Zoom-Änderungen
    const handleZoomChange = () => {
      const newZoom = mapRef.current?.getZoom();
      if (newZoom) {
        setCurrentZoom(newZoom);
        // Aktualisiere die Layer-Sichtbarkeit basierend auf dem neuen Zoom-Level
        console.log("Zoom changed to:", newZoom);
        updateLayerVisibility(newZoom);
      }
    };
    
    // Event-Listener für Zoom-Änderungen hinzufügen
    mapRef.current.on('zoomend', handleZoomChange);
    
    // Initial die Layer-Sichtbarkeit setzen
    handleZoomChange();
    
    // Event-Listener entfernen, wenn die Komponente unmountet wird
    return () => {
      mapRef.current?.off('zoomend', handleZoomChange);
    };
  }, [mapRef.current, updateLayerVisibility, setCurrentZoom]);

  // Funktion zum Berechnen des Projektionspunkts auf einem Segment
  const calculateProjectionPoint = (point: L.LatLng, segmentStart: L.LatLng, segmentEnd: L.LatLng): L.LatLng => {
    const p = point;
    const v = segmentStart;
    const w = segmentEnd;
    
    // Quadrat der Länge des Segments
    const l2 = Math.pow(calculateDistance(v, w), 2);
    
    if (l2 === 0) {
      // Segment ist ein Punkt
      return v;
    }
    
    // Berechne Projektion des Punkts auf das Segment
    const t = ((p.lat - v.lat) * (w.lat - v.lat) + (p.lng - v.lng) * (w.lng - v.lng)) / l2;
    
    if (t < 0) {
      // Außerhalb des Segments, näher an v
      return v;
    }
    
    if (t > 1) {
      // Außerhalb des Segments, näher an w
      return w;
    }
    
    // Auf dem Segment, berechne den Projektionspunkt
    return new L.LatLng(
      v.lat + t * (w.lat - v.lat),
      v.lng + t * (w.lng - v.lng)
    );
  };

  // Handler für die Verbindung einer Route mit einem Segment
  const handleRouteSegmentConnection = (projectionPoint: L.LatLng) => {
    console.log('Connecting route at segment point:', projectionPoint);
    
    const map = mapRef.current;
    if (!map) return;
    
    // Wenn wir bereits Punkte haben, behandle als Endpunkt
    if (points.length > 0) {
      console.log('Using segment point as endpoint because we already have points:', points.length);
      
      // Füge den Projektion-Punkt zur Route hinzu
      const newPoints = [...points, projectionPoint];
      setPoints(newPoints);
      
      // Füge einen Marker für diesen Punkt hinzu
      const marker = L.marker(projectionPoint).addTo(map);
      markersRef.current.push(marker);
      
      // Aktualisiere die Polyline
      if (polylineRef.current) {
        polylineRef.current.remove();
      }
      
      const polyline = L.polyline(newPoints, {
        color: 'blue',
        weight: 4,
        opacity: 0.7
      }).addTo(map);
      
      polylineRef.current = polyline;
    } else {
      // Wenn wir noch keine Punkte haben, beginne eine neue Route von diesem Punkt
      console.log('Starting new route from segment point');
      
      // Setze den Status, damit wir wissen, dass wir von einem Segment zeichnen
      setConnectingFromExistingPoint(true);
      
      // Lösche vorherige Zeichnung falls vorhanden
      clearRoute();
      
      // Starte neue Route mit diesem Punkt
      setPoints([projectionPoint]);
      
      // Füge einen Marker für diesen Punkt hinzu
      const marker = L.marker(projectionPoint).addTo(map);
      markersRef.current.push(marker);
    }
  };

  return (
    <Box
      id="map"
      sx={{
        flex: 1,
        height: '100%',
        width: '100%',
        position: 'relative',
        '& .leaflet-container': {
          height: '100%',
          width: '100%',
        },
        '& .route-point-tooltip': {
          backgroundColor: '#2196f3',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          padding: '4px 8px',
          fontSize: '12px'
        },
        // CSS für Fahrradständer Icons
        '& .bike-stand-icon': {
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        },
        // CSS für Nextbike Icons
        '& .nextbike-icon': {
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        },
        // CSS für Reparaturstations Icons
        '& .repair-icon': {
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        },
        // CSS für Ladestations Icons
        '& .charging-icon': {
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        },
        // CSS für POI Icons
        '& .poi-icon': {
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }
      }}
    >
      {/* Nextbike Button zum manuellen Aktualisieren - entfernt */}
      
      {/* Navigations-Button */}
      {!isDrawingMode && (
        <Fab 
          color="primary" 
          aria-label="navigation"
          onClick={toggleNavigation}
          sx={{ 
            position: 'absolute', 
            bottom: 20, 
            right: 20, 
            zIndex: 1000 
          }}
        >
          <DirectionsIcon />
        </Fab>
      )}
      
      {/* Speichern- und Abbrechen-Buttons für den Zeichenmodus */}
      {isDrawingMode && points.length >= 2 && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 20,
            right: 20,
            zIndex: 1000,
            display: 'flex',
            gap: 2
          }}
        >
          <Tooltip title="Fahrradweg speichern">
            <Fab
              color="success"
              aria-label="save"
              onClick={(e) => {
                // Verhindert, dass der Klick an die Karte weitergeleitet wird
                e.stopPropagation();
                if (onRouteComplete) {
                  onRouteComplete([...points]);
                }
                clearRoute();
              }}
            >
              <SaveIcon />
            </Fab>
          </Tooltip>
          <Tooltip title="Zeichnung abbrechen">
            <Fab
              color="error"
              aria-label="cancel"
              onClick={(e) => {
                // Verhindert, dass der Klick an die Karte weitergeleitet wird
                e.stopPropagation();
                clearRoute();
              }}
            >
              <CancelIcon />
            </Fab>
          </Tooltip>
        </Box>
      )}
      
      {/* Navigationskomponente */}
      {showNavigation && (
        <Navigation 
          routes={savedRoutes}
          mapRef={mapRef}
          onCalculateRoute={calculateRoute}
          onClose={toggleNavigation}
          isCalculating={isCalculatingRoute}
          calculatedRouteInfo={calculatedRouteInfo}
          routeFound={routeFound}
          onSaveRoute={() => setSaveNavRouteDialogOpen(true)}
        />
      )}
      
      {/* Kartenlegende */}
      {showLegend && (
        <MapLegend 
          showRoutes={true}
          showBikeStands={true}
          showNextbike={nextbikeStations.length > 0}
          showRepairStations={repairStations.length > 0}
          showChargingStations={chargingStations.length > 0}
          showPois={pois.length > 0}
        />
      )}

      {/* Dialog zum Speichern einer Navigationsroute */}
      <Dialog
        open={saveNavRouteDialogOpen}
        onClose={() => setSaveNavRouteDialogOpen(false)}
      >
        <DialogTitle>Navigationsroute speichern</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Möchtest du diese berechnete Route für später speichern? Sie wird in deiner "Meine Routen"-Übersicht erscheinen.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="Routenname"
            type="text"
            fullWidth
            variant="standard"
            value={navRouteName}
            onChange={(e) => setNavRouteName(e.target.value)}
          />
          <TextField
            margin="dense"
            label="Beschreibung (optional)"
            type="text"
            fullWidth
            multiline
            rows={3}
            variant="standard"
            value={navRouteDescription}
            onChange={(e) => setNavRouteDescription(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveNavRouteDialogOpen(false)}>Abbrechen</Button>
          <Button onClick={handleSaveNavigationRoute} color="primary">
            Speichern
          </Button>
        </DialogActions>
      </Dialog>

      {/* Speichern-Button für Navigationsrouten NICHT mehr anzeigen, da er jetzt in der Navigationskomponente ist */}

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
});

Map.displayName = 'Map';

export default Map; 