import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  Button,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Card,
  CardContent,
  CardActions,
  Grid,
  Rating,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Fab,
  Zoom,
  Tabs,
  Tab
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DirectionsBikeIcon from '@mui/icons-material/DirectionsBike';
import PedalBikeIcon from '@mui/icons-material/PedalBike';
import { getUnapprovedRoutes, approveRoute, BikeRoute, deleteRoute, getAllApprovedRoutes } from '../firebase/routes';
import { BikeStand, getUnapprovedBikeStands, approveBikeStand, deleteBikeStand, getAllBikeStands } from '../firebase/bikestands';
import { User } from 'firebase/auth';
import L from 'leaflet';
import RouteRating from './RouteRating';

interface AdminPanelProps {
  user: User | null;
  mapRef: React.RefObject<any>;
  onClose: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ user, mapRef, onClose }) => {
  const [unapprovedRoutes, setUnapprovedRoutes] = useState<BikeRoute[]>([]);
  const [approvedRoutes, setApprovedRoutes] = useState<BikeRoute[]>([]);
  const [unapprovedBikeStands, setUnapprovedBikeStands] = useState<BikeStand[]>([]);
  const [approvedBikeStands, setApprovedBikeStands] = useState<BikeStand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'unapproved' | 'approved'>('unapproved');
  const [activeItemType, setActiveItemType] = useState<'routes' | 'bikeStands'>('routes');
  const [selectedRoute, setSelectedRoute] = useState<BikeRoute | null>(null);
  const [selectedBikeStand, setSelectedBikeStand] = useState<BikeStand | null>(null);
  const [processingItemId, setProcessingItemId] = useState<string | null>(null);
  // Zustand, ob das Panel sichtbar ist oder nur die Aktions-Buttons
  const [showFullPanel, setShowFullPanel] = useState(true);

  // Überprüfen, ob der aktuelle Benutzer der Admin ist
  const isAdmin = user?.email === 'pfistererfalk@gmail.com';

  useEffect(() => {
    // Wenn kein Admin, Panel schließen
    if (!isAdmin) {
      onClose();
      return;
    }

    // Daten laden
    fetchUnapprovedRoutes();
    fetchApprovedRoutes();
    fetchUnapprovedBikeStands();
    fetchApprovedBikeStands();
  }, [isAdmin, onClose]);

  const fetchUnapprovedRoutes = async () => {
    try {
      setLoading(true);
      const routes = await getUnapprovedRoutes();
      setUnapprovedRoutes(routes);
      setError(null);
    } catch (err) {
      console.error('Error fetching unapproved routes:', err);
      setError('Fehler beim Laden der nicht genehmigten Routen');
    } finally {
      setLoading(false);
    }
  };

  // Genehmigte Routen abrufen
  const fetchApprovedRoutes = async () => {
    try {
      setLoading(true);
      const routes = await getAllApprovedRoutes();
      setApprovedRoutes(routes);
      setError(null);
    } catch (err) {
      console.error('Error fetching approved routes:', err);
      setError('Fehler beim Laden der genehmigten Routen');
    } finally {
      setLoading(false);
    }
  };

  // Nicht genehmigte Fahrradständer abrufen
  const fetchUnapprovedBikeStands = async () => {
    try {
      setLoading(true);
      const bikeStands = await getUnapprovedBikeStands();
      setUnapprovedBikeStands(bikeStands);
      setError(null);
    } catch (err) {
      console.error('Error fetching unapproved bike stands:', err);
      setError('Fehler beim Laden der nicht genehmigten Fahrradständer');
    } finally {
      setLoading(false);
    }
  };

  // Genehmigte Fahrradständer abrufen
  const fetchApprovedBikeStands = async () => {
    try {
      setLoading(true);
      const bikeStands = await getAllBikeStands();
      setApprovedBikeStands(bikeStands);
      setError(null);
    } catch (err) {
      console.error('Error fetching approved bike stands:', err);
      setError('Fehler beim Laden der genehmigten Fahrradständer');
    } finally {
      setLoading(false);
    }
  };

  // Zur Route auf der Karte zoomen und Panel ausblenden
  const zoomToRoute = (route: BikeRoute) => {
    if (!mapRef.current || !route.points || route.points.length === 0) return;

    // Route auswählen und auf der Karte anzeigen
    setSelectedRoute(route);

    // Berechne die Grenzen der Route für den Zoom
    const bounds = route.points.reduce(
      (bounds, point) => {
        bounds.extend([point.lat, point.lng]);
        return bounds;
      },
      new L.LatLngBounds([route.points[0].lat, route.points[0].lng], [route.points[0].lat, route.points[0].lng])
    );

    // Zur Route zoomen
    mapRef.current.zoomToRoute(bounds);
    
    // Route temporär auf der Karte anzeigen
    mapRef.current.displayRouteForReview(route);
    
    // Panel ausblenden, nur Aktions-Buttons anzeigen
    setShowFullPanel(false);
  };

  // Zum Fahrradständer auf der Karte zoomen
  const zoomToBikeStand = (bikeStand: BikeStand) => {
    if (!mapRef.current) return;

    // Fahrradständer auswählen und auf der Karte anzeigen
    setSelectedBikeStand(bikeStand);

    // Zur Position des Fahrradständers zoomen
    const position = L.latLng(bikeStand.position.lat, bikeStand.position.lng);
    mapRef.current.setView(position, 18); // Zoom-Level 18 für Nahansicht
    
    // Temporären Marker für den Fahrradständer anzeigen
    mapRef.current.displayBikeStandForReview(bikeStand);
    
    // Panel ausblenden, nur Aktions-Buttons anzeigen
    setShowFullPanel(false);
  };

  // Zurück zum Admin-Panel
  const backToPanel = () => {
    setShowFullPanel(true);
    
    // Temporäre Anzeigen entfernen
    if (mapRef.current) {
      mapRef.current.clearReviewRoute();
      mapRef.current.clearReviewBikeStand();
    }
    
    setSelectedRoute(null);
    setSelectedBikeStand(null);
  };

  // Route genehmigen oder ablehnen
  const handleRouteApproval = async (routeId: string, approved: boolean) => {
    if (!routeId) return;

    try {
      setProcessingItemId(routeId);
      await approveRoute(routeId, approved);
      
      // Liste aktualisieren
      setUnapprovedRoutes(prevRoutes => 
        prevRoutes.filter(route => route.id !== routeId)
      );

      // Wenn die Route genehmigt wurde, die Karte aktualisieren
      if (approved && mapRef.current) {
        await mapRef.current.refreshRoutes();
      }
      
      // Temporäre Anzeige entfernen
      if (mapRef.current) {
        mapRef.current.clearReviewRoute();
      }
      
      // Zurück zum Admin-Panel
      setShowFullPanel(true);
      setSelectedRoute(null);
    } catch (err) {
      console.error('Error approving/rejecting route:', err);
      setError(`Fehler beim ${approved ? 'Genehmigen' : 'Ablehnen'} der Route`);
    } finally {
      setProcessingItemId(null);
    }
  };

  // Fahrradständer genehmigen oder ablehnen
  const handleBikeStandApproval = async (bikeStandId: string, approved: boolean) => {
    if (!bikeStandId) return;

    try {
      setProcessingItemId(bikeStandId);
      await approveBikeStand(bikeStandId, approved);
      
      // Liste aktualisieren
      setUnapprovedBikeStands(prevStands => 
        prevStands.filter(stand => stand.id !== bikeStandId)
      );

      // Wenn der Fahrradständer genehmigt wurde, die Karte aktualisieren
      if (approved && mapRef.current) {
        await mapRef.current.refreshBikeStands();
      }
      
      // Temporäre Anzeige entfernen
      if (mapRef.current) {
        mapRef.current.clearReviewBikeStand();
      }
      
      // Zurück zum Admin-Panel
      setShowFullPanel(true);
      setSelectedBikeStand(null);
    } catch (err) {
      console.error('Error approving/rejecting bike stand:', err);
      setError(`Fehler beim ${approved ? 'Genehmigen' : 'Ablehnen'} des Fahrradständers`);
    } finally {
      setProcessingItemId(null);
    }
  };

  // Route löschen
  const handleDeleteRoute = async (routeId: string) => {
    if (!routeId || !user) return;

    // Bestätigung vom Benutzer einholen
    if (!window.confirm('Möchtest du diese Route wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) {
      return;
    }

    try {
      setProcessingItemId(routeId);
      // Der Admin kann jede Route löschen, daher geben wir isAdmin=true mit
      await deleteRoute(routeId, user.uid, isAdmin);
      
      // Listen aktualisieren
      setApprovedRoutes(prevRoutes => 
        prevRoutes.filter(route => route.id !== routeId)
      );

      // Karte aktualisieren
      if (mapRef.current) {
        await mapRef.current.refreshRoutes();
        mapRef.current.clearReviewRoute();
      }
    } catch (err) {
      console.error('Error deleting route:', err);
      setError('Fehler beim Löschen der Route');
    } finally {
      setProcessingItemId(null);
    }
  };

  // Fahrradständer löschen
  const handleDeleteBikeStand = async (bikeStandId: string) => {
    if (!bikeStandId) return;

    // Bestätigung vom Benutzer einholen
    if (!window.confirm('Möchtest du diesen Fahrradständer wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) {
      return;
    }

    try {
      setProcessingItemId(bikeStandId);
      await deleteBikeStand(bikeStandId);
      
      // Listen aktualisieren
      setApprovedBikeStands(prevStands => 
        prevStands.filter(stand => stand.id !== bikeStandId)
      );

      // Karte aktualisieren
      if (mapRef.current) {
        await mapRef.current.refreshBikeStands();
        mapRef.current.clearReviewBikeStand();
      }
    } catch (err) {
      console.error('Error deleting bike stand:', err);
      setError('Fehler beim Löschen des Fahrradständers');
    } finally {
      setProcessingItemId(null);
    }
  };

  // Wenn der Tab gewechselt wird, die temporäre Anzeige entfernen
  const handleTabChange = (tab: 'unapproved' | 'approved') => {
    setActiveTab(tab);
    if (mapRef.current) {
      mapRef.current.clearReviewRoute();
      mapRef.current.clearReviewBikeStand();
    }
  };

  // Wechsel zwischen Routen und Fahrradständern
  const handleItemTypeChange = (type: 'routes' | 'bikeStands') => {
    setActiveItemType(type);
    if (mapRef.current) {
      mapRef.current.clearReviewRoute();
      mapRef.current.clearReviewBikeStand();
    }
  };

  // Beim Schließen des Panels die temporäre Anzeige entfernen
  const handleClose = () => {
    if (mapRef.current) {
      mapRef.current.clearReviewRoute();
      mapRef.current.clearReviewBikeStand();
    }
    onClose();
  };

  // Wenn der Benutzer kein Admin ist, nichts anzeigen
  if (!isAdmin) {
    return null;
  }
  
  // Wenn wir eine Route prüfen, zeigen wir nur die Aktions-Buttons an
  if (!showFullPanel && selectedRoute) {
    return (
      <Box 
        sx={{ 
          position: 'fixed',
          zIndex: 1200,
          left: '50%',
          transform: 'translateX(-50%)',
          bottom: 40,
          display: 'flex', 
          flexDirection: 'column', 
          gap: 2,
          background: 'rgba(255, 255, 255, 0.9)',
          padding: 3,
          borderRadius: 2,
          backdropFilter: 'blur(5px)',
          boxShadow: 3,
          width: 'auto',
          maxWidth: '90%',
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1, textAlign: 'center' }}>
          Route: {selectedRoute.name}
        </Typography>
        
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
          <Tooltip title="Zurück zur Übersicht">
            <IconButton 
              color="default" 
              onClick={backToPanel}
              disabled={processingItemId !== null}
              size="medium"
            >
              <ArrowBackIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Route ablehnen">
            <IconButton 
              color="error" 
              onClick={() => handleRouteApproval(selectedRoute.id!, false)}
              disabled={processingItemId !== null}
              size="medium"
            >
              <CancelIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Route genehmigen">
            <IconButton 
              color="success" 
              onClick={() => handleRouteApproval(selectedRoute.id!, true)}
              disabled={processingItemId !== null}
              size="medium"
            >
              <CheckCircleIcon />
            </IconButton>
          </Tooltip>
        </Box>
        
        {/* Loading-Indikator */}
        {processingItemId && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
            <CircularProgress size={24} />
          </Box>
        )}
      </Box>
    );
  }

  // Wenn wir einen Fahrradständer prüfen, zeigen wir nur die Aktions-Buttons an
  if (!showFullPanel && selectedBikeStand) {
    return (
      <Box 
        sx={{ 
          position: 'fixed',
          zIndex: 1200,
          left: '50%',
          transform: 'translateX(-50%)',
          bottom: 40,
          display: 'flex', 
          flexDirection: 'column', 
          gap: 2,
          background: 'rgba(255, 255, 255, 0.9)',
          padding: 3,
          borderRadius: 2,
          backdropFilter: 'blur(5px)',
          boxShadow: 3,
          width: 'auto',
          maxWidth: '90%',
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1, textAlign: 'center' }}>
          Fahrradständer prüfen
        </Typography>
        
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
          <Tooltip title="Zurück zur Übersicht">
            <IconButton 
              color="default" 
              onClick={backToPanel}
              disabled={processingItemId !== null}
              size="medium"
            >
              <ArrowBackIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Fahrradständer ablehnen">
            <IconButton 
              color="error" 
              onClick={() => handleBikeStandApproval(selectedBikeStand.id!, false)}
              disabled={processingItemId !== null}
              size="medium"
            >
              <CancelIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Fahrradständer genehmigen">
            <IconButton 
              color="success" 
              onClick={() => handleBikeStandApproval(selectedBikeStand.id!, true)}
              disabled={processingItemId !== null}
              size="medium"
            >
              <CheckCircleIcon />
            </IconButton>
          </Tooltip>
        </Box>
        
        {/* Loading-Indikator */}
        {processingItemId && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
            <CircularProgress size={24} />
          </Box>
        )}
      </Box>
    );
  }
  
  return (
    <Paper 
      sx={{ 
        position: 'fixed',
        top: 80,
        right: 20,
        width: 380,
        maxWidth: '90vw',
        maxHeight: 'calc(100vh - 100px)',
        zIndex: 1100,
        overflow: 'auto',
        p: 3,
        borderRadius: 2,
        boxShadow: 3
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" component="h2">
          Admin-Panel
        </Typography>
        <Button 
          variant="outlined" 
          size="small" 
          color="primary"
          onClick={handleClose}
        >
          Schließen
        </Button>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Tabs für Itemtyp (Route oder Fahrradständer) */}
      <Box sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={activeItemType}
          onChange={(_, newValue) => handleItemTypeChange(newValue)}
          aria-label="Element-Typ"
        >
          <Tab 
            label="Fahrradwege" 
            value="routes" 
            icon={<DirectionsBikeIcon />} 
            iconPosition="start"
          />
          <Tab 
            label="Fahrradständer" 
            value="bikeStands" 
            icon={<PedalBikeIcon />} 
            iconPosition="start"
          />
        </Tabs>
      </Box>

      {activeItemType === 'routes' && (
        <>
          {/* Tabs für Status (genehmigt/nicht genehmigt) */}
          <Box sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Tabs
              value={activeTab}
              onChange={(_, newValue) => handleTabChange(newValue)}
              aria-label="Genehmigungsstatus"
            >
              <Tab label="Zu prüfen" value="unapproved" />
              <Tab label="Genehmigt" value="approved" />
            </Tabs>
          </Box>

          {/* Route-Inhalte basierend auf Tab */}
          {activeTab === 'unapproved' ? (
            <>
              <Typography variant="h6" component="h3" sx={{ mb: 2 }}>
                Nicht genehmigte Routen ({unapprovedRoutes.length})
              </Typography>
              
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
                  <CircularProgress />
                </Box>
              ) : unapprovedRoutes.length === 0 ? (
                <Alert severity="info">Keine Routen zur Überprüfung vorhanden.</Alert>
              ) : (
                <Grid container spacing={2}>
                  {unapprovedRoutes.map((route) => (
                    <Grid item xs={12} key={route.id}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" component="h3">
                            {route.name}
                          </Typography>
                          
                          {route.description && (
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                              {route.description}
                            </Typography>
                          )}
                          
                          <Typography variant="body2" color="text.secondary">
                            Erstellt am: {route.createdAt.toLocaleDateString()}
                          </Typography>
                          
                          {route.distance && (
                            <Typography variant="body2">
                              Strecke: {(route.distance / 1000).toFixed(2)} km
                            </Typography>
                          )}
                          
                          {route.roadQuality && (
                            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                              <Typography variant="body2" sx={{ mr: 1 }}>
                                Streckenqualität:
                              </Typography>
                              <Rating 
                                value={6 - route.roadQuality} 
                                readOnly 
                                size="small"
                              />
                            </Box>
                          )}
                          
                          {route.traffic && (
                            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                              <Typography variant="body2" sx={{ mr: 1 }}>
                                Verkehr:
                              </Typography>
                              <Rating 
                                value={6 - route.traffic} 
                                readOnly 
                                size="small"
                              />
                            </Box>
                          )}
                          
                          {route.scenery && (
                            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                              <Typography variant="body2" sx={{ mr: 1 }}>
                                Landschaft:
                              </Typography>
                              <Rating 
                                value={route.scenery} 
                                readOnly 
                                size="small"
                              />
                            </Box>
                          )}
                          
                          {route.tags && route.tags.length > 0 && (
                            <Box sx={{ mt: 1 }}>
                              {route.tags.map(tag => (
                                <Chip 
                                  key={tag} 
                                  label={tag} 
                                  size="small" 
                                  sx={{ mr: 0.5, mb: 0.5 }} 
                                />
                              ))}
                            </Box>
                          )}
                          
                          {route.slope && (
                            <Chip 
                              label={`Steigung: ${route.slope}`} 
                              size="small" 
                              sx={{ mr: 1, mb: 1 }} 
                            />
                          )}
                          
                          <Typography variant="body2">
                            Anzahl der Punkte: {route.points.length}
                          </Typography>
                        </CardContent>
                        
                        <CardActions>
                          <Tooltip title="Auf Karte anzeigen">
                            <IconButton 
                              color="primary" 
                              onClick={() => zoomToRoute(route)}
                            >
                              <LocationOnIcon />
                            </IconButton>
                          </Tooltip>
                          
                          <Box sx={{ flexGrow: 1 }} />
                          
                          <Tooltip title="Route ablehnen">
                            <IconButton 
                              color="error"
                              onClick={() => handleRouteApproval(route.id!, false)}
                              disabled={processingItemId === route.id}
                            >
                              <CancelIcon />
                            </IconButton>
                          </Tooltip>
                          
                          <Tooltip title="Route genehmigen">
                            <IconButton 
                              color="success"
                              onClick={() => handleRouteApproval(route.id!, true)}
                              disabled={processingItemId === route.id}
                            >
                              <CheckCircleIcon />
                            </IconButton>
                          </Tooltip>
                          
                          {processingItemId === route.id && (
                            <CircularProgress size={24} sx={{ ml: 1 }} />
                          )}
                        </CardActions>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </>
          ) : (
            <>
              <Typography variant="h6" component="h3" sx={{ mb: 2 }}>
                Genehmigte Routen ({approvedRoutes.length})
              </Typography>
              
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
                  <CircularProgress />
                </Box>
              ) : approvedRoutes.length === 0 ? (
                <Alert severity="info">Keine genehmigten Routen vorhanden.</Alert>
              ) : (
                <Grid container spacing={2}>
                  {approvedRoutes.map((route) => (
                    <Grid item xs={12} key={route.id}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" component="h3">
                            {route.name}
                          </Typography>
                          
                          {route.description && (
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                              {route.description}
                            </Typography>
                          )}
                          
                          <Typography variant="body2" color="text.secondary">
                            Erstellt am: {route.createdAt.toLocaleDateString()}
                          </Typography>
                          
                          {route.distance && (
                            <Typography variant="body2">
                              Strecke: {(route.distance / 1000).toFixed(2)} km
                            </Typography>
                          )}
                        </CardContent>
                        
                        <CardActions>
                          <Tooltip title="Auf Karte anzeigen">
                            <IconButton 
                              color="primary" 
                              onClick={() => zoomToRoute(route)}
                            >
                              <LocationOnIcon />
                            </IconButton>
                          </Tooltip>
                          
                          <Box sx={{ flexGrow: 1 }} />
                          
                          <Tooltip title="Route löschen">
                            <IconButton 
                              color="error"
                              onClick={() => handleDeleteRoute(route.id!)}
                              disabled={processingItemId === route.id}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                          
                          {processingItemId === route.id && (
                            <CircularProgress size={24} sx={{ ml: 1 }} />
                          )}
                        </CardActions>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </>
          )}
        </>
      )}

      {activeItemType === 'bikeStands' && (
        <>
          {/* Tabs für Status (genehmigt/nicht genehmigt) */}
          <Box sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Tabs
              value={activeTab}
              onChange={(_, newValue) => handleTabChange(newValue)}
              aria-label="Genehmigungsstatus"
            >
              <Tab label="Zu prüfen" value="unapproved" />
              <Tab label="Genehmigt" value="approved" />
            </Tabs>
          </Box>

          {/* Fahrradständer-Inhalte basierend auf Tab */}
          {activeTab === 'unapproved' ? (
            <>
              <Typography variant="h6" component="h3" sx={{ mb: 2 }}>
                Nicht genehmigte Fahrradständer ({unapprovedBikeStands.length})
              </Typography>
              
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
                  <CircularProgress />
                </Box>
              ) : unapprovedBikeStands.length === 0 ? (
                <Alert severity="info">Keine Fahrradständer zur Überprüfung vorhanden.</Alert>
              ) : (
                <Grid container spacing={2}>
                  {unapprovedBikeStands.map((bikeStand) => (
                    <Grid item xs={12} key={bikeStand.id}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" component="h3">
                            Fahrradständer
                          </Typography>
                          
                          {bikeStand.description && (
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                              {bikeStand.description}
                            </Typography>
                          )}
                          
                          <Typography variant="body2" color="text.secondary">
                            Erstellt am: {bikeStand.createdAt.toLocaleDateString()}
                          </Typography>
                          
                          {bikeStand.capacity && (
                            <Typography variant="body2">
                              Kapazität: {bikeStand.capacity} Fahrräder
                            </Typography>
                          )}
                          
                          <Box sx={{ mt: 1 }}>
                            {bikeStand.isRoofed && (
                              <Chip 
                                label="Überdacht" 
                                size="small" 
                                sx={{ mr: 0.5, mb: 0.5 }} 
                              />
                            )}
                            {bikeStand.isFree && (
                              <Chip 
                                label="Kostenlos" 
                                size="small" 
                                sx={{ mr: 0.5, mb: 0.5 }} 
                              />
                            )}
                            {bikeStand.isLighted && (
                              <Chip 
                                label="Beleuchtet" 
                                size="small" 
                                sx={{ mr: 0.5, mb: 0.5 }} 
                              />
                            )}
                          </Box>
                        </CardContent>
                        
                        <CardActions>
                          <Tooltip title="Auf Karte anzeigen">
                            <IconButton 
                              color="primary" 
                              onClick={() => zoomToBikeStand(bikeStand)}
                            >
                              <LocationOnIcon />
                            </IconButton>
                          </Tooltip>
                          
                          <Box sx={{ flexGrow: 1 }} />
                          
                          <Tooltip title="Fahrradständer ablehnen">
                            <IconButton 
                              color="error"
                              onClick={() => handleBikeStandApproval(bikeStand.id!, false)}
                              disabled={processingItemId === bikeStand.id}
                            >
                              <CancelIcon />
                            </IconButton>
                          </Tooltip>
                          
                          <Tooltip title="Fahrradständer genehmigen">
                            <IconButton 
                              color="success"
                              onClick={() => handleBikeStandApproval(bikeStand.id!, true)}
                              disabled={processingItemId === bikeStand.id}
                            >
                              <CheckCircleIcon />
                            </IconButton>
                          </Tooltip>
                          
                          {processingItemId === bikeStand.id && (
                            <CircularProgress size={24} sx={{ ml: 1 }} />
                          )}
                        </CardActions>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </>
          ) : (
            <>
              <Typography variant="h6" component="h3" sx={{ mb: 2 }}>
                Genehmigte Fahrradständer ({approvedBikeStands.length})
              </Typography>
              
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
                  <CircularProgress />
                </Box>
              ) : approvedBikeStands.length === 0 ? (
                <Alert severity="info">Keine genehmigten Fahrradständer vorhanden.</Alert>
              ) : (
                <Grid container spacing={2}>
                  {approvedBikeStands.map((bikeStand) => (
                    <Grid item xs={12} key={bikeStand.id}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" component="h3">
                            Fahrradständer
                          </Typography>
                          
                          {bikeStand.description && (
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                              {bikeStand.description}
                            </Typography>
                          )}
                          
                          <Typography variant="body2" color="text.secondary">
                            Erstellt am: {bikeStand.createdAt.toLocaleDateString()}
                          </Typography>
                          
                          {bikeStand.capacity && (
                            <Typography variant="body2">
                              Kapazität: {bikeStand.capacity} Fahrräder
                            </Typography>
                          )}
                          
                          <Box sx={{ mt: 1 }}>
                            {bikeStand.isRoofed && (
                              <Chip 
                                label="Überdacht" 
                                size="small" 
                                sx={{ mr: 0.5, mb: 0.5 }} 
                              />
                            )}
                            {bikeStand.isFree && (
                              <Chip 
                                label="Kostenlos" 
                                size="small" 
                                sx={{ mr: 0.5, mb: 0.5 }} 
                              />
                            )}
                            {bikeStand.isLighted && (
                              <Chip 
                                label="Beleuchtet" 
                                size="small" 
                                sx={{ mr: 0.5, mb: 0.5 }} 
                              />
                            )}
                          </Box>
                        </CardContent>
                        
                        <CardActions>
                          <Tooltip title="Auf Karte anzeigen">
                            <IconButton 
                              color="primary" 
                              onClick={() => zoomToBikeStand(bikeStand)}
                            >
                              <LocationOnIcon />
                            </IconButton>
                          </Tooltip>
                          
                          <Box sx={{ flexGrow: 1 }} />
                          
                          <Tooltip title="Fahrradständer löschen">
                            <IconButton 
                              color="error"
                              onClick={() => handleDeleteBikeStand(bikeStand.id!)}
                              disabled={processingItemId === bikeStand.id}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                          
                          {processingItemId === bikeStand.id && (
                            <CircularProgress size={24} sx={{ ml: 1 }} />
                          )}
                        </CardActions>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </>
          )}
        </>
      )}
    </Paper>
  );
};

export default AdminPanel; 