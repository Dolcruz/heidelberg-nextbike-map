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
  Zoom
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { getUnapprovedRoutes, approveRoute, BikeRoute, deleteRoute, getAllApprovedRoutes } from '../firebase/routes';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'unapproved' | 'approved'>('unapproved');
  const [selectedRoute, setSelectedRoute] = useState<BikeRoute | null>(null);
  const [processingRouteId, setProcessingRouteId] = useState<string | null>(null);
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

    // Nicht genehmigte Routen laden
    fetchUnapprovedRoutes();
    // Genehmigte Routen laden
    fetchApprovedRoutes();
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

  // Zurück zum Admin-Panel
  const backToPanel = () => {
    setShowFullPanel(true);
    
    // Temporäre Routenanzeige entfernen
    if (mapRef.current) {
      mapRef.current.clearReviewRoute();
    }
    
    setSelectedRoute(null);
  };

  // Route genehmigen oder ablehnen
  const handleRouteApproval = async (routeId: string, approved: boolean) => {
    if (!routeId) return;

    try {
      setProcessingRouteId(routeId);
      await approveRoute(routeId, approved);
      
      // Liste aktualisieren
      setUnapprovedRoutes(prevRoutes => 
        prevRoutes.filter(route => route.id !== routeId)
      );

      // Wenn die Route genehmigt wurde, die Karte aktualisieren
      if (approved && mapRef.current) {
        await mapRef.current.refreshRoutes();
      }
      
      // Temporäre Routenanzeige entfernen
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
      setProcessingRouteId(null);
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
      setProcessingRouteId(routeId);
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
      setProcessingRouteId(null);
    }
  };

  // Wenn der Tab gewechselt wird, die temporäre Routenanzeige entfernen
  const handleTabChange = (tab: 'unapproved' | 'approved') => {
    setActiveTab(tab);
    if (mapRef.current) {
      mapRef.current.clearReviewRoute();
    }
  };

  // Beim Schließen des Panels die temporäre Routenanzeige entfernen
  const handleClose = () => {
    if (mapRef.current) {
      mapRef.current.clearReviewRoute();
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
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
          {/* Zurück-Button */}
          <Zoom in={true}>
            <Tooltip title="Zurück zur Übersicht">
              <Fab 
                color="default" 
                onClick={backToPanel}
                disabled={processingRouteId !== null}
                size="medium"
              >
                <ArrowBackIcon />
              </Fab>
            </Tooltip>
          </Zoom>
          
          {/* Ablehnen-Button */}
          <Zoom in={true} style={{ transitionDelay: '100ms' }}>
            <Tooltip title="Route ablehnen">
              <Fab 
                color="error" 
                onClick={() => handleRouteApproval(selectedRoute.id!, false)}
                disabled={processingRouteId !== null}
                size="medium"
              >
                <CancelIcon />
              </Fab>
            </Tooltip>
          </Zoom>
          
          {/* Genehmigen-Button */}
          <Zoom in={true} style={{ transitionDelay: '200ms' }}>
            <Tooltip title="Route genehmigen">
              <Fab 
                color="success" 
                onClick={() => handleRouteApproval(selectedRoute.id!, true)}
                disabled={processingRouteId !== null}
                size="medium"
              >
                <CheckCircleIcon />
              </Fab>
            </Tooltip>
          </Zoom>
        </Box>
        
        {/* Loading-Indikator */}
        {processingRouteId && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
            <CircularProgress size={24} />
          </Box>
        )}
      </Box>
    );
  }

  // Hauptansicht des Admin-Panels
  return (
    <Paper 
      elevation={3} 
      sx={{ 
        position: 'absolute',
        top: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'auto',
        maxWidth: '80%',
        maxHeight: 'calc(100vh - 120px)',
        overflow: 'auto',
        p: 2,
        zIndex: 1000,
        borderRadius: 2
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" component="h2">
          Admin-Panel: Routen-Verwaltung
        </Typography>
        <Button onClick={handleClose} color="primary" variant="outlined">
          Schließen
        </Button>
      </Box>

      {/* Tab-Navigation hinzufügen */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Button 
          variant={activeTab === 'unapproved' ? 'contained' : 'text'} 
          onClick={() => handleTabChange('unapproved')}
          sx={{ mr: 1 }}
        >
          Zu genehmigen
        </Button>
        <Button 
          variant={activeTab === 'approved' ? 'contained' : 'text'} 
          onClick={() => handleTabChange('approved')}
        >
          Genehmigte Routen
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : activeTab === 'unapproved' ? (
        // Nicht genehmigte Routen anzeigen
        unapprovedRoutes.length === 0 ? (
          <Alert severity="info">
            Keine Routen zur Genehmigung vorhanden.
          </Alert>
        ) : (
          <Grid container spacing={2}>
            {unapprovedRoutes.map((route) => (
              <Grid item xs={12} key={route.id}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" component="div">
                      {route.name}
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Erstellt am: {route.createdAt.toLocaleDateString()}
                    </Typography>
                    
                    {route.description && (
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        {route.description}
                      </Typography>
                    )}
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      {route.rating !== undefined && route.rating !== null && (
                        <>
                          <Typography variant="body2">Bewertung:</Typography>
                          <RouteRating 
                            routeId={route.id!}
                            averageRating={route.rating}
                            ratingCount={route.ratingCount || 0}
                            user={user}
                            readOnly={true}
                            size="small"
                          />
                        </>
                      )}
                    </Box>
                    
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
                        disabled={processingRouteId === route.id}
                      >
                        <CancelIcon />
                      </IconButton>
                    </Tooltip>
                    
                    <Tooltip title="Route genehmigen">
                      <IconButton 
                        color="success"
                        onClick={() => handleRouteApproval(route.id!, true)}
                        disabled={processingRouteId === route.id}
                      >
                        <CheckCircleIcon />
                      </IconButton>
                    </Tooltip>
                    
                    {processingRouteId === route.id && (
                      <CircularProgress size={24} sx={{ ml: 1 }} />
                    )}
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )
      ) : (
        // Genehmigte Routen anzeigen
        approvedRoutes.length === 0 ? (
          <Alert severity="info">
            Keine genehmigten Routen vorhanden.
          </Alert>
        ) : (
          <Grid container spacing={2}>
            {approvedRoutes.map((route) => (
              <Grid item xs={12} key={route.id}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" component="div">
                      {route.name}
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Erstellt am: {route.createdAt.toLocaleDateString()}
                    </Typography>
                    
                    {route.description && (
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        {route.description}
                      </Typography>
                    )}
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      {route.rating !== undefined && route.rating !== null && (
                        <>
                          <Typography variant="body2">Bewertung:</Typography>
                          <RouteRating 
                            routeId={route.id!}
                            averageRating={route.rating}
                            ratingCount={route.ratingCount || 0}
                            user={user}
                            readOnly={true}
                            size="small"
                          />
                        </>
                      )}
                    </Box>
                    
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
                    
                    <Tooltip title="Route löschen">
                      <IconButton 
                        color="error"
                        onClick={() => handleDeleteRoute(route.id!)}
                        disabled={processingRouteId === route.id}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                    
                    {processingRouteId === route.id && (
                      <CircularProgress size={24} sx={{ ml: 1 }} />
                    )}
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )
      )}
    </Paper>
  );
};

export default AdminPanel; 