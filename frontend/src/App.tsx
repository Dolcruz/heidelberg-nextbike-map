import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import { 
  Snackbar, 
  Alert, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions,
  Button,
  TextField,
  Rating,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Switch,
  FormControlLabel
} from '@mui/material';
import { User } from 'firebase/auth';
import Navbar from './components/Navbar';
import Map, { MapHandle } from './components/Map';
import Sidebar from './components/Sidebar';
import { saveRoute, BikeRoute, updateRoute, getUserRoutes } from './firebase/routes';
import { saveBikeStand } from './firebase/bikestands';
import { auth } from './firebase/index';
import BikeStandDialog from './components/BikeStandDialog';
import EditSidebar, { EditMode } from './components/EditSidebar';
import POIDialog from './components/POIDialog';
import AdminPanel from './components/AdminPanel';

// Create a theme instance
const theme = createTheme({
  palette: {
    primary: {
      main: '#2196f3', // A nice blue color for our bike-themed app
    },
    secondary: {
      main: '#4caf50', // Green for environmental aspects
    },
  },
});

const App: React.FC = () => {
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [isBikeStandMode, setIsBikeStandMode] = useState(false);
  const [isNextBikeMode, setIsNextBikeMode] = useState(false);
  const [isRepairStationMode, setIsRepairStationMode] = useState(false);
  const [isChargingStationMode, setIsChargingStationMode] = useState(false);
  const [isPoiMode, setIsPoiMode] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<'success' | 'error' | 'info'>('info');
  const [user, setUser] = useState<User | null>(null);
  const [routeCount, setRouteCount] = useState(0); // To keep track of route count for naming
  
  // Neue State-Variablen für die Bearbeitungssidebar
  const [editSidebarOpen, setEditSidebarOpen] = useState(false);
  const [currentEditMode, setCurrentEditMode] = useState<EditMode | null>(null);
  
  // Zustand für den gesuchten Ort
  const [searchedLocation, setSearchedLocation] = useState<{
    display_name: string;
    lat: number;
    lon: number;
  } | undefined>(undefined);
  
  // Dialog für Fahrradwegdetails
  const [openDialog, setOpenDialog] = useState(false);
  const [routeToSave, setRouteToSave] = useState<L.LatLng[] | null>(null);
  const [routeName, setRouteName] = useState('');
  const [routeDescription, setRouteDescription] = useState('');
  const [routeRating, setRouteRating] = useState<number | null>(null);
  const [routeSlope, setRouteSlope] = useState('');

  // Dialog für Fahrradständerdetails
  const [openBikeStandDialog, setOpenBikeStandDialog] = useState(false);
  const [bikeStandPosition, setBikeStandPosition] = useState<L.LatLng | null>(null);
  const [bikeStandCapacity, setBikeStandCapacity] = useState<number | undefined>(undefined);
  const [bikeStandDescription, setBikeStandDescription] = useState('');
  const [bikeStandIsRoofed, setBikeStandIsRoofed] = useState(false);
  const [bikeStandIsFree, setBikeStandIsFree] = useState(true);
  const [bikeStandIsLighted, setBikeStandIsLighted] = useState(false);
  const [bikeStandRating, setBikeStandRating] = useState<number | null>(null);

  // Create a ref to the Map component to access its methods
  const mapRef = useRef<MapHandle>(null);

  const [newRoute, setNewRoute] = useState<L.LatLng[]>([]);
  const [createBikeStandDialogOpen, setCreateBikeStandDialogOpen] = useState(false);
  const [newBikeStandPosition, setNewBikeStandPosition] = useState<L.LatLng | null>(null);
  
  // Neue State-Variablen für den POI-Dialog
  const [createPOIDialogOpen, setCreatePOIDialogOpen] = useState(false);
  const [newPOIPosition, setNewPOIPosition] = useState<L.LatLng | null>(null);
  const [newPOIType, setNewPOIType] = useState<EditMode | null>(null);

  // State für Snackbar-Nachrichten
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'info' | 'warning' | 'error'>('info');

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
      // Fetch user routes to get the count when user logs in
      if (user) {
        fetchUserRoutesCount(user.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  // Funktion zum Abrufen der Anzahl der Fahrradwege des Benutzers
  const fetchUserRoutesCount = async (userId: string) => {
    try {
      const userRoutes = await getUserRoutes(userId);
      setRouteCount(userRoutes.length);
    } catch (error) {
      console.error('Error fetching bike path count:', error);
    }
  };

  // Handler für die Auswahl eines Bearbeitungsmodus
  const handleEditModeSelect = (mode: EditMode) => {
    // Wenn der gleiche Modus nochmal geklickt wird, dann deaktivieren wir ihn
    if (currentEditMode === mode) {
      // Deaktiviere den aktuellen Modus
      setCurrentEditMode(null);
      setIsDrawingMode(false);
      setIsBikeStandMode(false);
      setIsNextBikeMode(false);
      setIsRepairStationMode(false);
      setIsChargingStationMode(false);
      setIsPoiMode(false);
      return;
    }
    
    // Setze aktuellen Bearbeitungsmodus
    setCurrentEditMode(mode);
    
    // Deaktiviere alle Modi
    setIsDrawingMode(false);
    setIsBikeStandMode(false);
    setIsNextBikeMode(false);
    setIsRepairStationMode(false);
    setIsChargingStationMode(false);
    setIsPoiMode(false);
    
    // Aktiviere den ausgewählten Modus
    switch (mode) {
      case 'bikePath':
        setIsDrawingMode(true);
        break;
      case 'bikeStand':
        setIsBikeStandMode(true);
        break;
      case 'nextBike':
        setIsNextBikeMode(true);
        break;
      case 'repairStation':
        setIsRepairStationMode(true);
        break;
      case 'chargingStation':
        setIsChargingStationMode(true);
        break;
      case 'poi':
        setIsPoiMode(true);
        break;
      default:
        // Für zukünftige Modi
        setSnackbarMessage(`Funktion "${mode}" wird in Kürze verfügbar sein!`);
        setSnackbarSeverity('info');
        setSnackbarOpen(true);
    }
  };

  // Toggle für die Bearbeitungssidebar
  const toggleEditSidebar = () => {
    // Wenn die Sidebar geöffnet wird, setzen wir nichts zurück
    // Wenn die Sidebar geschlossen wird und ein Modus aktiv ist, setzen wir diesen zurück
    if (editSidebarOpen && (isDrawingMode || isBikeStandMode || isNextBikeMode || 
                             isRepairStationMode || isChargingStationMode || isPoiMode)) {
      // Alle Modi deaktivieren
      setIsDrawingMode(false);
      setIsBikeStandMode(false);
      setIsNextBikeMode(false);
      setIsRepairStationMode(false);
      setIsChargingStationMode(false);
      setIsPoiMode(false);
      setCurrentEditMode(null);
    }
    
    // Sidebar umschalten
    setEditSidebarOpen(!editSidebarOpen);
  };

  const handleRouteComplete = async (route: L.LatLng[]) => {
    console.log('Route complete handler called with points:', route.length);
    
    if (!user) {
      setMessage('Please log in to save routes');
      setSeverity('error');
      setShowMessage(true);
      return;
    }

    if (route.length < 2) {
      setMessage('A route must have at least 2 points');
      setSeverity('error');
      setShowMessage(true);
      return;
    }

    // Statt direktem Speichern öffnen wir den Dialog
    setRouteToSave(route);
    // Setze den Namen auf "Fahrradweg [Nummer]" anstatt "Route [Datum]"
    setRouteName(`Fahrradweg ${routeCount + 1}`);
    setRouteDescription('');
    setRouteRating(null);
    setRouteSlope('');
    setOpenDialog(true);
  };

  // Toggle für den Zeichnungsmodus
  const toggleDrawingMode = () => {
    // Wenn der Zeichnungsmodus aktiviert wird
    if (!isDrawingMode) {
      setCurrentEditMode('bikePath');
      setIsBikeStandMode(false);
    } else {
      setCurrentEditMode(null);
    }
    setIsDrawingMode(!isDrawingMode);
  };
  
  // Toggle für den Fahrradständer-Modus
  const toggleBikeStandMode = () => {
    // Wenn der Fahrradständer-Modus aktiviert wird
    if (!isBikeStandMode) {
      setCurrentEditMode('bikeStand');
      setIsDrawingMode(false);
    } else {
      setCurrentEditMode(null);
    }
    setIsBikeStandMode(!isBikeStandMode);
  };

  // Füge einen neuen Fahrradständer hinzu
  const handleAddBikeStand = async (position: L.LatLng) => {
    if (!user) {
      setSnackbarMessage('Du musst eingeloggt sein, um Fahrradständer hinzuzufügen');
      setSnackbarSeverity('warning');
      setSnackbarOpen(true);
      return;
    }
    
    // Öffne den Dialog zum Hinzufügen eines Fahrradständers
    setCreateBikeStandDialogOpen(true);
    setNewBikeStandPosition(position);
  };

  const handleSaveRouteWithDetails = async () => {
    if (!routeToSave || !user) return;

    try {
      await saveRoute(
        routeToSave, 
        user, 
        routeName, 
        routeDescription, 
        routeRating === null ? undefined : routeRating, 
        routeSlope === '' ? undefined : routeSlope
      );
      setMessage('Fahrradweg successfully saved! You can view it in the Fahrradwege section.');
      setSeverity('success');
      setShowMessage(true);
      setOpenDialog(false);
      
      // Erhöhe den Zähler für den nächsten Fahrradweg
      setRouteCount(routeCount + 1);
      
      // Refresh the map routes to show the newly saved bike path
      if (mapRef.current) {
        await mapRef.current.refreshRoutes();
      }
      
      // Beende den Zeichnungsmodus nach dem Speichern
      setIsDrawingMode(false);
      setCurrentEditMode(null);
    } catch (error) {
      console.error('Error saving bike path with details:', error);
      setMessage('Failed to save bike path. Please try again.');
      setSeverity('error');
      setShowMessage(true);
    }
  };

  // Callback, wenn ein Fahrradständer gespeichert wurde
  const handleSaveBikeStand = () => {
    // Aktualisiere die Karte, um den neuen Fahrradständer anzuzeigen
    if (mapRef.current) {
      mapRef.current.refreshBikeStands();
    }
    
    // Erfolgsmeldung anzeigen
    setSnackbarMessage('Fahrradständer erfolgreich hinzugefügt');
    setSnackbarSeverity('success');
    setSnackbarOpen(true);
    
    // Beende den Fahrradständer-Modus
    setIsBikeStandMode(false);
    setCurrentEditMode(null);
  };

  const handleDialogClose = () => {
    setOpenDialog(false);
  };

  const handleBikeStandDialogClose = () => {
    setOpenBikeStandDialog(false);
  };

  // Handler für die Ortsuche
  const handleLocationSearch = (location: {
    display_name: string;
    lat: number;
    lon: number;
  }) => {
    setSearchedLocation(location);
    
    // Optional: Zeige eine Nachricht an
    setMessage(`Karte wurde auf "${location.display_name.split(',')[0]}" zentriert`);
    setSeverity('info');
    setShowMessage(true);
  };

  // Funktion zum Anzeigen von Nachrichten
  const showNotification = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(text);
    setSeverity(type);
    setShowMessage(true);
  };

  // Funktion zum Anzeigen der Snackbar
  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  // Füge einen neuen POI hinzu
  const handleAddPOI = async (position: L.LatLng, poiType: string) => {
    if (!user) {
      setSnackbarMessage('Du musst eingeloggt sein, um POIs hinzuzufügen');
      setSnackbarSeverity('warning');
      setSnackbarOpen(true);
      return;
    }
    
    // Öffne den Dialog zum Hinzufügen eines POI
    setCreatePOIDialogOpen(true);
    setNewPOIPosition(position);
    setNewPOIType(poiType as EditMode);
  };

  // Callback, wenn ein POI gespeichert wurde
  const handleSavePOI = () => {
    // Aktualisiere die Karte, um den neuen POI anzuzeigen
    if (mapRef.current) {
      mapRef.current.refreshPOIs();
    }
    
    // Erfolgsmeldung anzeigen
    setSnackbarMessage('POI erfolgreich hinzugefügt');
    setSnackbarSeverity('success');
    setSnackbarOpen(true);
    
    // Beende den POI-Modus
    setCurrentEditMode(null);
    setIsNextBikeMode(false);
    setIsRepairStationMode(false);
    setIsChargingStationMode(false);
    setIsPoiMode(false);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
          <Navbar 
            onDrawingModeToggle={toggleEditSidebar}
            isDrawingMode={isDrawingMode || isBikeStandMode || isNextBikeMode || isRepairStationMode || isChargingStationMode || isPoiMode}
            onBikeStandModeToggle={toggleBikeStandMode}
            isBikeStandMode={isBikeStandMode}
            onSearchLocation={handleLocationSearch}
            onAdminPanelToggle={() => setIsAdminPanelOpen(!isAdminPanelOpen)}
            user={user}
          />
          <Box sx={{ display: 'flex', flex: 1, position: 'relative', overflow: 'hidden' }}>
            <Map 
              ref={mapRef}
              isDrawingMode={isDrawingMode}
              isBikeStandMode={isBikeStandMode}
              isNextBikeMode={isNextBikeMode}
              isRepairStationMode={isRepairStationMode}
              isChargingStationMode={isChargingStationMode}
              isPoiMode={isPoiMode}
              onRouteComplete={handleRouteComplete}
              onAddBikeStand={handleAddBikeStand}
              onAddPOI={handleAddPOI}
              searchLocation={searchedLocation}
            />
            <Sidebar />
          </Box>
          <Snackbar 
            open={showMessage} 
            autoHideDuration={6000} 
            onClose={() => setShowMessage(false)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert onClose={() => setShowMessage(false)} severity={severity}>
              {message}
            </Alert>
          </Snackbar>

          {/* Dialog für Fahrradwegdetails */}
          <Dialog open={openDialog} onClose={handleDialogClose} maxWidth="sm" fullWidth>
            <DialogTitle>Fahrradweg-Details</DialogTitle>
            <DialogContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                <TextField
                  label="Name des Fahrradwegs"
                  value={routeName}
                  onChange={(e) => setRouteName(e.target.value)}
                  fullWidth
                  variant="outlined"
                />
                
                <TextField
                  label="Beschreibung"
                  value={routeDescription}
                  onChange={(e) => setRouteDescription(e.target.value)}
                  fullWidth
                  multiline
                  rows={3}
                  variant="outlined"
                />
                
                <Box>
                  <Typography component="legend">Bewertung</Typography>
                  <Rating
                    name="route-rating"
                    value={routeRating}
                    onChange={(event, newValue) => {
                      setRouteRating(newValue);
                    }}
                    precision={0.5}
                  />
                </Box>
                
                <FormControl fullWidth>
                  <InputLabel>Steigung</InputLabel>
                  <Select
                    value={routeSlope}
                    label="Steigung"
                    onChange={(e) => setRouteSlope(e.target.value)}
                  >
                    <MenuItem value="flach">Flach</MenuItem>
                    <MenuItem value="leicht">Leichte Steigung</MenuItem>
                    <MenuItem value="mittel">Mittlere Steigung</MenuItem>
                    <MenuItem value="steil">Starke Steigung</MenuItem>
                    <MenuItem value="varierend">Variiert</MenuItem>
                  </Select>
                </FormControl>
                
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  <strong>Hinweis:</strong> Du kannst Fahrradwege miteinander verbinden, indem du im Zeichenmodus auf einen bestehenden Fahrradwegpunkt klickst und von dort aus weiterzeichnest.
                </Typography>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleDialogClose}>Abbrechen</Button>
              <Button onClick={handleSaveRouteWithDetails} variant="contained" color="primary">
                Speichern
              </Button>
            </DialogActions>
          </Dialog>

          {/* Dialog für Fahrradständerdetails */}
          <Dialog open={openBikeStandDialog} onClose={handleBikeStandDialogClose} maxWidth="sm" fullWidth>
            <DialogTitle>Fahrradständer-Details</DialogTitle>
            <DialogContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                <TextField
                  label="Kapazität (Anzahl der Fahrräder)"
                  type="number"
                  value={bikeStandCapacity === undefined ? '' : bikeStandCapacity}
                  onChange={(e) => setBikeStandCapacity(e.target.value === '' ? undefined : parseInt(e.target.value, 10))}
                  fullWidth
                  variant="outlined"
                  InputProps={{ inputProps: { min: 1 } }}
                />
                
                <TextField
                  label="Beschreibung (optional)"
                  value={bikeStandDescription}
                  onChange={(e) => setBikeStandDescription(e.target.value)}
                  fullWidth
                  multiline
                  rows={2}
                  variant="outlined"
                />
                
                <Box>
                  <Typography component="legend">Bewertung</Typography>
                  <Rating
                    name="bikestand-rating"
                    value={bikeStandRating}
                    onChange={(event, newValue) => {
                      setBikeStandRating(newValue);
                    }}
                    precision={0.5}
                  />
                </Box>
                
                <FormControlLabel
                  control={
                    <Switch 
                      checked={bikeStandIsRoofed} 
                      onChange={(e) => setBikeStandIsRoofed(e.target.checked)} 
                    />
                  }
                  label="Überdacht"
                />
                
                <FormControlLabel
                  control={
                    <Switch 
                      checked={bikeStandIsFree} 
                      onChange={(e) => setBikeStandIsFree(e.target.checked)} 
                    />
                  }
                  label="Kostenlos"
                />
                
                <FormControlLabel
                  control={
                    <Switch 
                      checked={bikeStandIsLighted} 
                      onChange={(e) => setBikeStandIsLighted(e.target.checked)} 
                    />
                  }
                  label="Beleuchtet"
                />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleBikeStandDialogClose}>Abbrechen</Button>
              <Button onClick={handleSaveBikeStand} variant="contained" color="primary">
                Speichern
              </Button>
            </DialogActions>
          </Dialog>

          {/* Fahrradständer hinzufügen Dialog */}
          <BikeStandDialog
            open={createBikeStandDialogOpen}
            onClose={() => setCreateBikeStandDialogOpen(false)}
            onSave={handleSaveBikeStand}
            position={newBikeStandPosition}
          />

          {/* POI hinzufügen Dialog */}
          <POIDialog
            open={createPOIDialogOpen}
            onClose={() => setCreatePOIDialogOpen(false)}
            onSave={handleSavePOI}
            position={newPOIPosition}
            poiType={newPOIType}
          />

          {/* Sidebar für Bearbeitungsmodi */}
          <EditSidebar
            open={editSidebarOpen}
            onClose={() => setEditSidebarOpen(false)}
            onModeSelect={handleEditModeSelect}
            currentMode={currentEditMode}
          />

          {/* Snackbar für Benachrichtigungen */}
          <Snackbar
            open={snackbarOpen}
            autoHideDuration={6000}
            onClose={handleSnackbarClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} sx={{ width: '100%' }}>
              {snackbarMessage}
            </Alert>
          </Snackbar>

          {/* Admin-Panel ohne Dialog-Container, damit die Karte nicht blockiert wird */}
          {isAdminPanelOpen && user?.email === 'pfistererfalk@gmail.com' && (
            <AdminPanel 
              user={user} 
              mapRef={mapRef} 
              onClose={() => setIsAdminPanelOpen(false)} 
            />
          )}
        </Box>
      </Router>
    </ThemeProvider>
  );
};

export default App;
