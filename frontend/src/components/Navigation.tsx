import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  IconButton,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Divider,
  CircularProgress,
  Chip,
  Collapse,
  Tooltip,
  Paper,
  Alert,
  Grid,
  RadioGroup,
  Radio,
  Checkbox
} from '@mui/material';
import DirectionsIcon from '@mui/icons-material/Directions';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import SaveIcon from '@mui/icons-material/Save';
import { BikeRoute } from '../firebase/routes';
import L from 'leaflet';

// Interface für die Props der Navigationskomponente
interface NavigationProps {
  routes: BikeRoute[];
  mapRef: React.MutableRefObject<L.Map | null>;
  onCalculateRoute: (start: L.LatLng, end: L.LatLng, options: RouteOptions) => void;
  onClose: () => void;
  isCalculating: boolean;
  calculatedRouteInfo?: {
    distance: number;
    estimatedTime: number;
    routeType: string;
  };
  onSetStartPoint?: (point: L.LatLng | null) => void;
  onSetEndPoint?: (point: L.LatLng | null) => void;
  routeFound?: boolean;
  onSaveRoute?: () => void;
}

// Interface für die Routenoptionen
export interface RouteOptions {
  routeType: 'fastest' | 'flattest' | 'best_rated';
  avoidSteepSlopes: boolean;
}

// Funktion zum Umrechnen einer Zeit in Minuten zu einem lesbaren Format
const formatTime = (minutes: number): string => {
  if (minutes < 60) {
    return `${Math.round(minutes)} Min.`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  return `${hours} Std. ${remainingMinutes} Min.`;
};

// Hauptkomponente für die Navigation
const Navigation: React.FC<NavigationProps> = ({ 
  routes, 
  mapRef, 
  onCalculateRoute, 
  onClose,
  isCalculating,
  calculatedRouteInfo,
  onSetStartPoint,
  onSetEndPoint,
  routeFound,
  onSaveRoute
}) => {
  // Zustände für die Start- und Zieleingabe
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');
  
  // Zustände für Start- und Zielkoordinaten
  const [startLocation, setStartLocation] = useState<L.LatLng | null>(null);
  const [endLocation, setEndLocation] = useState<L.LatLng | null>(null);
  
  // Zustände für die Suchergebnisse
  const [startResults, setStartResults] = useState<any[]>([]);
  const [endResults, setEndResults] = useState<any[]>([]);
  
  // Zustand, ob die erweiterten Optionen angezeigt werden
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  
  // Zustände für die Routenoptionen
  const [routeType, setRouteType] = useState<'fastest' | 'flattest' | 'best_rated'>('fastest');
  const [avoidSteepSlopes, setAvoidSteepSlopes] = useState(false);
  
  // Suchaktivität verfolgen
  const [isSearchingStart, setIsSearchingStart] = useState(false);
  const [isSearchingEnd, setIsSearchingEnd] = useState(false);
  
  // Zustand für den aktiven Modus (Startpunkt oder Zielpunkt per Klick setzen)
  const [mapClickMode, setMapClickMode] = useState<'start' | 'end' | null>(null);
  
  // Marker-Referenzen für Start und Ziel
  const [startMarker, setStartMarker] = useState<L.Marker | null>(null);
  const [endMarker, setEndMarker] = useState<L.Marker | null>(null);

  // Zustand für Fehlermeldungen
  const [error, setError] = useState<string | null>(null);

  // Effekt, um Benutzerstandort zu setzen, wenn verfügbar
  useEffect(() => {
    // Versuche, den aktuellen Standort des Benutzers zu ermitteln
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // Setze den aktuellen Standort als Startpunkt
          const { latitude, longitude } = position.coords;
          setStartLocation(new L.LatLng(latitude, longitude));
          setStartInput('Mein Standort');
          
          // Marker für den Startpunkt setzen
          updateLocationMarker(new L.LatLng(latitude, longitude), true);
        },
        (error) => {
          console.error('Geolocation error:', error);
        }
      );
    }
    
    // Cleanup-Funktion
    return () => {
      // Entferne alle Map-Click-Handler
      if (mapRef.current) {
        mapRef.current.off('click');
      }
      
      // Entferne Marker
      if (startMarker) startMarker.remove();
      if (endMarker) endMarker.remove();
    };
  }, []);
  
  // Effekt für den Map-Click-Modus
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    
    // Entferne vorherige Click-Handler
    map.off('click');
    
    // Wenn ein Modus aktiv ist, füge einen Click-Handler hinzu
    if (mapClickMode) {
      // Ändere den Cursor, um anzuzeigen, dass ein Klick erwartet wird
      document.getElementById('map')?.classList.add('map-click-mode');
      
      // Füge den Click-Handler hinzu
      map.on('click', (e: L.LeafletMouseEvent) => {
        const clickedLocation = e.latlng;
        
        // Setze den Standort basierend auf dem Modus
        if (mapClickMode === 'start') {
          setStartLocation(clickedLocation);
          setStartInput(`${clickedLocation.lat.toFixed(5)}, ${clickedLocation.lng.toFixed(5)}`);
          updateLocationMarker(clickedLocation, true);
        } else {
          setEndLocation(clickedLocation);
          setEndInput(`${clickedLocation.lat.toFixed(5)}, ${clickedLocation.lng.toFixed(5)}`);
          updateLocationMarker(clickedLocation, false);
        }
        
        // Deaktiviere den Modus nach dem Klick
        setMapClickMode(null);
      });
    } else {
      // Entferne die Cursor-Klasse
      document.getElementById('map')?.classList.remove('map-click-mode');
    }
    
    // Cleanup-Funktion
    return () => {
      map.off('click');
      document.getElementById('map')?.classList.remove('map-click-mode');
    };
  }, [mapClickMode, mapRef]);
  
  // Funktion zum Aktualisieren der Marker auf der Karte
  const updateLocationMarker = (location: L.LatLng, isStart: boolean) => {
    const map = mapRef.current;
    if (!map) return;
    
    // Erstelle ein benutzerdefiniertes Icon
    const customIcon = L.divIcon({
      className: 'custom-div-icon',
      html: `<div style="background-color: ${isStart ? 'green' : 'red'}; width: 24px; height: 24px; border-radius: 50%; display: flex; justify-content: center; align-items: center; color: white; font-weight: bold; border: 2px solid white;">${isStart ? 'S' : 'Z'}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });
    
    // Entferne den vorherigen Marker, falls vorhanden
    if (isStart && startMarker) {
      startMarker.remove();
    } else if (!isStart && endMarker) {
      endMarker.remove();
    }
    
    // Erstelle einen neuen Marker
    const newMarker = L.marker(location, { icon: customIcon })
      .addTo(map)
      .bindPopup(isStart ? 'Startpunkt' : 'Zielpunkt');
    
    // Speichere die Marker-Referenz
    if (isStart) {
      setStartMarker(newMarker);
    } else {
      setEndMarker(newMarker);
    }
  };

  // Funktion zum Suchen eines Ortes mit der Nominatim API
  const searchLocation = async (query: string, isStart: boolean) => {
    if (!query.trim() || query === 'Mein Standort') {
      if (isStart) {
        setStartResults([]);
      } else {
        setEndResults([]);
      }
      return;
    }

    if (isStart) {
      setIsSearchingStart(true);
    } else {
      setIsSearchingEnd(true);
    }

    try {
      // Verwende ein alternatives CORS-Proxy
      // Der vorherige Proxy (corsproxy.io) verursachte 400-Fehler
      const proxyUrl = 'https://api.allorigins.win/raw?url=';
      const apiUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=3`;
      
      // Füge einen Cache-Buster hinzu, um Caching-Probleme zu vermeiden
      const cacheBuster = `&_=${new Date().getTime()}`;
      
      const response = await fetch(`${proxyUrl}${encodeURIComponent(apiUrl + cacheBuster)}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error(`Fehler bei der Ortssuche: Status ${response.status}`);
        throw new Error('Fehler bei der Ortssuche');
      }
      
      const data = await response.json();
      
      if (isStart) {
        setStartResults(data);
        setIsSearchingStart(false);
      } else {
        setEndResults(data);
        setIsSearchingEnd(false);
      }
    } catch (error) {
      console.error('Error searching for location:', error);
      if (isStart) {
        setStartResults([]);
        setIsSearchingStart(false);
      } else {
        setEndResults([]);
        setIsSearchingEnd(false);
      }
    }
  };

  // Funktion zum Verarbeiten der Ortseingabe-Änderungen
  const handleLocationInputChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    isStart: boolean
  ) => {
    const value = event.target.value;
    
    if (isStart) {
      setStartInput(value);
      // Wenn "Mein Standort" gelöscht wird, auch die Koordinaten zurücksetzen
      if (value === '' && startInput === 'Mein Standort') {
        setStartLocation(null);
        if (startMarker) startMarker.remove();
      }
    } else {
      setEndInput(value);
    }
    
    // Debounce: Nur alle 500ms suchen
    const debounceTimer = setTimeout(() => {
      searchLocation(value, isStart);
    }, 500);
    
    return () => clearTimeout(debounceTimer);
  };

  // Funktion zum Auswählen eines Suchergebnisses
  const handleSelectLocation = (result: any, isStart: boolean) => {
    const location = new L.LatLng(parseFloat(result.lat), parseFloat(result.lon));
    
    if (isStart) {
      setStartLocation(location);
      setStartInput(result.display_name);
      setStartResults([]);
      updateLocationMarker(location, true);
    } else {
      setEndLocation(location);
      setEndInput(result.display_name);
      setEndResults([]);
      updateLocationMarker(location, false);
    }
    
    // Karte auf den ausgewählten Ort zoomen
    if (mapRef.current) {
      mapRef.current.setView(location, 15);
    }
  };

  // Funktion zum Umschalten von Start und Ziel
  const handleSwapLocations = () => {
    // Tausche Eingaben
    const tempInput = startInput;
    setStartInput(endInput);
    setEndInput(tempInput);
    
    // Tausche Koordinaten
    const tempLocation = startLocation;
    setStartLocation(endLocation);
    setEndLocation(tempLocation);
    
    // Leere Suchergebnisse
    setStartResults([]);
    setEndResults([]);
    
    // Aktualisiere Marker, falls vorhanden
    if (startLocation && endLocation) {
      updateLocationMarker(endLocation, true);
      updateLocationMarker(startLocation, false);
    }
  };

  // Funktion zum Setzen des aktuellen Standorts
  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const location = new L.LatLng(latitude, longitude);
          setStartLocation(location);
          setStartInput('Mein Standort');
          setStartResults([]);
          
          // Aktualisiere den Marker
          updateLocationMarker(location, true);
          
          // Karte auf den aktuellen Standort zoomen
          if (mapRef.current) {
            mapRef.current.setView([latitude, longitude], 15);
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
        }
      );
    }
  };

  // Funktion zur Routenberechnung
  const handleCalculateRoute = async () => {
    if (!startLocation || !endLocation) {
      // Zeige einen Fehler an, wenn Start oder Ziel fehlt
      setError('Bitte geben Sie einen Start- und Zielpunkt an');
      return;
    }
    
    console.log('Berechne Route mit Optionen:', routeType, avoidSteepSlopes);
    
    // Konvertiere die Positionen in Leaflet LatLng Objekte
    const startLatLng = L.latLng(startLocation.lat, startLocation.lng);
    const endLatLng = L.latLng(endLocation.lat, endLocation.lng);
    
    try {
      // Rufe die Routenberechnungsfunktion auf
      await onCalculateRoute(startLatLng, endLatLng, {
        routeType,
        avoidSteepSlopes
      });
      
      // Wenn keine Ausnahme geworfen wurde, setze den Fehler zurück
      setError(null);
    } catch (err) {
      console.error('Fehler bei der Routenberechnung:', err);
      setError('Fehler bei der Routenberechnung. Bitte versuchen Sie es erneut.');
    }
  };
  
  // Funktion zum Aktivieren des Map-Click-Modus
  const activateMapClickMode = (mode: 'start' | 'end') => {
    setMapClickMode(mode);
  };

  // Füge CSS für den Map-Click-Modus hinzu
  useEffect(() => {
    // Füge CSS für den Cursor im Map-Click-Modus hinzu
    const style = document.createElement('style');
    style.innerHTML = `
      .map-click-mode {
        cursor: crosshair !important;
      }
    `;
    document.head.appendChild(style);
    
    // Cleanup
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <Paper
      sx={{
        position: 'absolute',
        top: 10,
        left: 10,
        zIndex: 1000,
        width: 350,
        padding: 2,
        borderRadius: 2,
        boxShadow: 3
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" component="h2">Navigation</Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Informationstext aktualisieren */}
      <Typography variant="body2" sx={{ mb: 2, fontStyle: 'italic', color: 'text.secondary' }}>
        Diese Navigation nutzt von Benutzern gezeichnete Fahrradwege für die Berechnung. Wenn mehrere vorhandene Wege einen Pfad zum Ziel bilden können, werden diese für die Navigation verbunden.
      </Typography>

      {/* Start- und Zieleingabe */}
      <Box sx={{ display: 'flex', mb: 1 }}>
        <TextField
          fullWidth
          size="small"
          label="Startpunkt"
          value={startInput}
          onChange={(e) => handleLocationInputChange(e as React.ChangeEvent<HTMLInputElement>, true)}
          InputProps={{
            startAdornment: (
              <MyLocationIcon color="primary" fontSize="small" sx={{ mr: 1 }} />
            ),
            endAdornment: (
              <Tooltip title="Auf Karte auswählen">
                <IconButton 
                  size="small" 
                  onClick={() => activateMapClickMode('start')}
                  sx={{ color: mapClickMode === 'start' ? 'primary.main' : 'inherit' }}
                >
                  <LocationOnIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )
          }}
        />
      </Box>

      <Box sx={{ display: 'flex', mb: 1 }}>
        <TextField
          fullWidth
          size="small"
          label="Zielpunkt"
          value={endInput}
          onChange={(e) => handleLocationInputChange(e as React.ChangeEvent<HTMLInputElement>, false)}
          InputProps={{
            startAdornment: (
              <LocationOnIcon color="error" fontSize="small" sx={{ mr: 1 }} />
            ),
            endAdornment: (
              <Tooltip title="Auf Karte auswählen">
                <IconButton 
                  size="small" 
                  onClick={() => activateMapClickMode('end')}
                  sx={{ color: mapClickMode === 'end' ? 'primary.main' : 'inherit' }}
                >
                  <LocationOnIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )
          }}
        />
      </Box>

      {/* Routenoptionen */}
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>Routenoptionen</Typography>
        
        <FormControl component="fieldset" sx={{ mt: 1 }}>
          <RadioGroup
            aria-label="route-type"
            name="route-type"
            value={routeType}
            onChange={(e) => setRouteType(e.target.value as 'fastest' | 'flattest' | 'best_rated')}
          >
            <FormControlLabel value="fastest" control={<Radio />} label="Schnellste Route" />
            <FormControlLabel value="best_rated" control={<Radio />} label="Beste Bewertung" />
            <FormControlLabel value="flattest" control={<Radio />} label="Flachste Route" />
          </RadioGroup>
        </FormControl>
        
        <FormControlLabel
          control={
            <Checkbox
              checked={avoidSteepSlopes}
              onChange={(e) => setAvoidSteepSlopes(e.target.checked)}
              name="avoid-steep-slopes"
            />
          }
          label="Steile Strecken vermeiden"
          sx={{ mt: 1 }}
        />
      </Box>

      {/* Fehlermeldung anzeigen, falls vorhanden */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Berechnete Routeninformationen anzeigen */}
      {calculatedRouteInfo && (
        <Box sx={{ mt: 2, p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>Routeninformationen</Typography>
          <Grid container spacing={1}>
            <Grid item xs={6}>
              <Typography variant="body2">
                <strong>Distanz:</strong> {calculatedRouteInfo.distance.toFixed(2)} km
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2">
                <strong>Zeit:</strong> ca. {Math.round(calculatedRouteInfo.estimatedTime)} min
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body2">
                <strong>Typ:</strong> {calculatedRouteInfo.routeType === 'fastest' ? 'Schnellste' : calculatedRouteInfo.routeType === 'flattest' ? 'Flachste' : 'Bestbewertete'}
              </Typography>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Navigationsbutton und Speichern-Button nebeneinander */}
      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
        <Button
          variant="contained"
          fullWidth
          disabled={!startLocation || !endLocation || isCalculating}
          onClick={handleCalculateRoute}
          startIcon={isCalculating ? <CircularProgress size={20} color="inherit" /> : <DirectionsIcon />}
        >
          {isCalculating ? 'Berechne...' : 'Route berechnen'}
        </Button>

        {/* Save-Button */}
        {onSaveRoute && (
          <Button
            variant="contained"
            fullWidth
            disabled={!routeFound}
            onClick={onSaveRoute}
            startIcon={<SaveIcon />}
            color="secondary"
            sx={{ minWidth: '140px' }}
          >
            Speichern
          </Button>
        )}
      </Box>
    </Paper>
  );
};

export default Navigation; 