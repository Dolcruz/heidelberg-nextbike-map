import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Drawer,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  IconButton,
  Button,
  CircularProgress,
  Collapse,
  ListItemButton,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Rating,
  Chip,
  Tooltip,
  Badge,
  Tabs,
  Tab,
  TextField,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  SelectChangeEvent
} from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import CommentIcon from '@mui/icons-material/Comment';
import DirectionsIcon from '@mui/icons-material/Directions';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import PedalBikeIcon from '@mui/icons-material/PedalBike';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import DirectionsBikeIcon from '@mui/icons-material/DirectionsBike';
import MapIcon from '@mui/icons-material/Map';
import RouteIcon from '@mui/icons-material/Route';
import PublicIcon from '@mui/icons-material/Public';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import EditIcon from '@mui/icons-material/Edit';
import { auth } from '../firebase/index';
import { BikeRoute, getUserRoutes, deleteRoute, getAllApprovedRoutes, markRouteAsCompleted, markRouteAsAborted, updateBikePath } from '../firebase/routes';
import { getUserStats, calculateEnvironmentalFacts, UserStats } from '../firebase/userStats';
import RouteRating from './RouteRating';

const Sidebar: React.FC = () => {
  const [drawerWidth, setDrawerWidth] = useState(340); // Modifiziert, um die Breite anpassbar zu machen
  const [isDragging, setIsDragging] = useState(false);
  const minDrawerWidth = 280;
  const maxDrawerWidth = 600;
  
  const [routes, setRoutes] = useState<BikeRoute[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [openRouteId, setOpenRouteId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [routeToDelete, setRouteToDelete] = useState<string | null>(null);
  const ADMIN_EMAIL = "pfistererfalk@gmail.com";
  const [publicRoutes, setPublicRoutes] = useState<BikeRoute[]>([]);
  const [viewingPublicRoutes, setViewingPublicRoutes] = useState(false);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [routeToUpdateStatus, setRouteToUpdateStatus] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);
  
  // Neue Zustandsvariablen für Navigationsrouten und Tab
  const [navRoutes, setNavRoutes] = useState<BikeRoute[]>([]);
  const [currentTab, setCurrentTab] = useState<'bikePaths' | 'navRoutes' | 'public'>('bikePaths');

  // Zustand für aktuell angezeigte Navigationsroute
  const [visibleNavRouteId, setVisibleNavRouteId] = useState<string | null>(null);

  // Zustand für Bearbeitungsdialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingBikePath, setEditingBikePath] = useState<BikeRoute | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    roadQuality: 0,
    traffic: 0,
    scenery: 0,
    tags: [] as string[]
  });
  const [newTag, setNewTag] = useState('');

  // Funktion zum Starten des Größenänderungsvorgangs
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', handleResizeEnd);
  };
  
  // Funktion zum Beenden des Größenänderungsvorgangs
  const handleResizeEnd = () => {
    setIsDragging(false);
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', handleResizeEnd);
  };
  
  // Funktion zum Ändern der Sidebar-Breite während des Ziehens
  const handleResize = useCallback((e: MouseEvent) => {
    // Wichtig: window.innerWidth - e.clientX berechnet die Sidebar-Breite vom rechten Rand
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth >= minDrawerWidth && newWidth <= maxDrawerWidth) {
      setDrawerWidth(newWidth);
    }
  }, [minDrawerWidth, maxDrawerWidth]);

  // Gibt die Farbe für die Steigung zurück
  const getSlopeColor = (slope?: string | null) => {
    if (!slope) return "default";
    switch (slope) {
      case "flach": return "success";
      case "leicht": return "info";
      case "mittel": return "warning";
      case "steil": return "error";
      default: return "default";
    }
  };

  // Benutzer-Status überwachen
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
      if (user) {
        fetchUserRoutes(user.uid);
        fetchUserStats(user);
        fetchNavRoutes(user.uid); // Navigationsrouten laden
        
        // Immer öffentliche Fahrradwege laden, unabhängig vom Benutzer
        fetchPublicRoutes();
      } else {
        setRoutes([]);
        setNavRoutes([]); // Navigationsrouten zurücksetzen
        setUserStats(null);
        // Für nicht eingeloggte Benutzer trotzdem öffentliche Fahrradwege anzeigen
        fetchPublicRoutes();
      }
    });
    
    // Event-Listener für das Speichern von Navigationsrouten
    const handleNavigationRouteSaved = (event: any) => {
      const { userId } = event.detail;
      if (userId && auth.currentUser?.uid === userId) {
        // Aktualisiere nur den Navigationsrouten-Tab
        fetchNavRoutes(userId);
        // Falls Statistiken betroffen sind, aktualisiere auch diese
        fetchUserStats(auth.currentUser);
        // Setze den Tab automatisch auf "Meine Routen"
        setCurrentTab('navRoutes');
      }
    };
    
    // Event-Listener für das Bearbeiten von Routen aus der Karte heraus
    const handleEditRoute = (event: any) => {
      const { routeId } = event.detail;
      console.log('Route bearbeiten angefordert:', routeId);
      
      // Finde die Route in allen möglichen Routen-Listen
      const route = [...routes, ...navRoutes, ...publicRoutes].find(r => r.id === routeId);
      
      if (route) {
        // Öffne den Bearbeitungs-Dialog mit der gefundenen Route
        openEditDialog(route);
      } else {
        console.error('Route nicht gefunden:', routeId);
      }
    };
    
    // Registriere die Event-Listener
    window.addEventListener('navigationRouteSaved', handleNavigationRouteSaved);
    window.addEventListener('editRoute', handleEditRoute);
    
    return () => {
      unsubscribe();
      // Event-Listener entfernen
      window.removeEventListener('navigationRouteSaved', handleNavigationRouteSaved);
      window.removeEventListener('editRoute', handleEditRoute);
    };
  }, [routes, navRoutes, publicRoutes]); // Abhängigkeiten aktualisiert

  // Fahrradwege des Benutzers abrufen
  const fetchUserRoutes = async (userId: string) => {
    setLoading(true);
    try {
      const userRoutes = await getUserRoutes(userId);
      // Filtere Navigationsrouten aus - zeige nur echte Fahrradwege
      const bikePathsOnly = userRoutes.filter(route => 
        route.type !== 'navigation' && 
        !route.status // keine Routen mit Status (die sind für den Navigations-Tab)
      );
      // Sortiere Fahrradwege nach Erstellungsdatum (neueste zuerst)
      bikePathsOnly.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setRoutes(bikePathsOnly);
    } catch (error) {
      console.error('Error fetching bike paths:', error);
    } finally {
      setLoading(false);
    }
  };

  // Öffentliche Fahrradwege abrufen
  const fetchPublicRoutes = async () => {
    try {
      const approvedRoutes = await getAllApprovedRoutes();
      // Sortiere nach Bewertung und dann nach Datum
      approvedRoutes.sort((a, b) => {
        if (b.rating && a.rating) return b.rating - a.rating;
        if (b.rating) return 1;
        if (a.rating) return -1;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
      setPublicRoutes(approvedRoutes);
    } catch (error) {
      console.error('Error fetching public bike paths:', error);
    }
  };

  // Navigationsrouten des Benutzers abrufen
  const fetchNavRoutes = async (userId: string) => {
    try {
      const userRoutes = await getUserRoutes(userId);
      // Filtere Navigation Routes
      const navigationRoutesOnly = userRoutes.filter(route => 
        route.type === 'navigation' && 
        (route.status === 'planned' || route.status === 'completed' || route.status === 'aborted')
      );
      // Sortiere nach Erstellungsdatum (neueste zuerst)
      navigationRoutesOnly.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setNavRoutes(navigationRoutesOnly);

      // Stelle sicher, dass alle Routen bei Seitenstart ausgeblendet sind
      navigationRoutesOnly.forEach(route => {
        if (route.id) {
          // Triggere das hideNavRoute-Event für alle Routen beim ersten Laden
          window.dispatchEvent(new CustomEvent('hideNavRoute', {
            detail: { routeId: route.id }
          }));
        }
      });
      
      setVisibleNavRouteId(null); // Setze den sichtbaren Zustand auf null
    } catch (error) {
      console.error('Error fetching navigation routes:', error);
    }
  };

  // Benutzerstatistiken abrufen
  const fetchUserStats = async (user: any) => {
    try {
      const stats = await getUserStats(user);
      setUserStats(stats);
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  };

  // Fahrradweg löschen
  const handleDeleteRoute = async () => {
    if (!routeToDelete || !user) return;
    
    try {
      // Übergebe die UserId des Benutzers, damit er nur seine eigenen Routen löschen kann
      await deleteRoute(routeToDelete, user.uid, false);
      // Aktualisiere die Fahrradwege-Liste
      if (user) {
        fetchUserRoutes(user.uid);
      }
      setDeleteDialogOpen(false);
      setRouteToDelete(null);
    } catch (error) {
      console.error('Error deleting bike path:', error);
    }
  };

  // Öffnet den Bestätigungsdialog zum Löschen
  const confirmDeleteRoute = (routeId: string) => {
    setRouteToDelete(routeId);
    setDeleteDialogOpen(true);
  };

  // Berechnet die Länge eines Fahrradwegs in Kilometern
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

  // Toggle für Fahrradweg-Details
  const handleToggleRoute = (routeId: string) => {
    setOpenRouteId(openRouteId === routeId ? null : routeId);
  };

  // Toggle zwischen eigenen und öffentlichen Fahrradwegen
  const handleToggleViewMode = () => {
    setViewingPublicRoutes(!viewingPublicRoutes);
  };

  // Handler für den Tab-Wechsel
  const handleTabChange = (event: React.SyntheticEvent, newValue: 'bikePaths' | 'navRoutes' | 'public') => {
    setCurrentTab(newValue);
  };

  // Öffnet den Dialog zum Aktualisieren des Fahrradweg-Status
  const openStatusDialog = (routeId: string) => {
    setRouteToUpdateStatus(routeId);
    setStatusDialogOpen(true);
  };

  // Markiert einen Fahrradweg als abgeschlossen
  const handleMarkAsCompleted = async () => {
    if (!routeToUpdateStatus || !user) return;
    
    try {
      await markRouteAsCompleted(routeToUpdateStatus, user);
      // Aktualisiere die Fahrradwege-Liste und Statistiken
      fetchUserRoutes(user.uid);
      fetchUserStats(user);
      setStatusDialogOpen(false);
      setRouteToUpdateStatus(null);
    } catch (error) {
      console.error('Error marking bike path as completed:', error);
    }
  };

  // Markiert einen Fahrradweg als abgebrochen
  const handleMarkAsAborted = async () => {
    if (!routeToUpdateStatus || !user) return;
    
    try {
      await markRouteAsAborted(routeToUpdateStatus, user);
      // Aktualisiere die Fahrradwege-Liste und Statistiken
      fetchUserRoutes(user.uid);
      fetchUserStats(user);
      setStatusDialogOpen(false);
      setRouteToUpdateStatus(null);
    } catch (error) {
      console.error('Error marking bike path as aborted:', error);
    }
  };

  // Gibt die Farbe für den Status zurück
  const getStatusColor = (status?: string) => {
    if (!status) return "default";
    switch (status) {
      case "completed": return "success";
      case "aborted": return "error";
      case "planned": return "info";
      default: return "default";
    }
  };

  // Gibt den Text für den Status zurück
  const getStatusText = (status?: string) => {
    if (!status) return "Geplant";
    switch (status) {
      case "completed": return "Abgeschlossen";
      case "aborted": return "Abgebrochen";
      case "planned": return "Geplant";
      default: return "Geplant";
    }
  };

  // Toggle für Statistikanzeige
  const toggleStats = () => {
    setShowStats(!showStats);
  };

  // Funktion zum Anzeigen einer Navigationsroute auf der Karte
  const handleToggleNavRouteVisibility = (routeId: string) => {
    // Toggle: wenn die Route bereits angezeigt wird, verstecken
    if (visibleNavRouteId === routeId) {
      // Löse ein Event aus, um die Route in der Map-Komponente zu verstecken
      // Übergebe die Route-ID, damit die Map-Komponente genau weiß, welche Route zu verstecken ist
      window.dispatchEvent(new CustomEvent('hideNavRoute', {
        detail: { routeId }
      }));
      setVisibleNavRouteId(null);
    } else {
      // Löse ein Event aus, um die Route in der Map-Komponente anzuzeigen
      const route = navRoutes.find(r => r.id === routeId);
      if (route && route.points) {
        window.dispatchEvent(new CustomEvent('showNavRoute', {
          detail: { 
            routeId, 
            points: route.points,
            name: route.name
          }
        }));
        setVisibleNavRouteId(routeId);
      }
    }
  };

  // Funktion zum Öffnen des Bearbeitungsdialogs
  const openEditDialog = (route: BikeRoute) => {
    setEditingBikePath(route);
    setEditFormData({
      name: route.name || '',
      description: route.description || '',
      roadQuality: route.roadQuality || 0,
      traffic: route.traffic || 0,
      scenery: route.scenery || 0,
      tags: route.tags || []
    });
    setEditDialogOpen(true);
  };

  // Funktion zum Schließen des Bearbeitungsdialogs
  const closeEditDialog = () => {
    setEditDialogOpen(false);
    setEditingBikePath(null);
    setNewTag('');
  };

  // Handler für Formularänderungen
  const handleEditFormChange = (field: string, value: string | number | string[]) => {
    setEditFormData({
      ...editFormData,
      [field]: value
    });
  };

  // Tag hinzufügen
  const handleAddTag = () => {
    if (newTag.trim() && !editFormData.tags.includes(newTag.trim())) {
      setEditFormData({
        ...editFormData,
        tags: [...editFormData.tags, newTag.trim()]
      });
      setNewTag('');
    }
  };

  // Tag entfernen
  const handleRemoveTag = (tagToRemove: string) => {
    setEditFormData({
      ...editFormData,
      tags: editFormData.tags.filter(tag => tag !== tagToRemove)
    });
  };

  // Funktion zum Speichern der Änderungen
  const saveChanges = async () => {
    if (!editingBikePath || !editingBikePath.id) return;
    
    try {
      const success = await updateBikePath(editingBikePath.id, {
        name: editFormData.name,
        description: editFormData.description,
        roadQuality: editFormData.roadQuality,
        traffic: editFormData.traffic,
        scenery: editFormData.scenery,
        tags: editFormData.tags
      });
      
      if (success) {
        // UI aktualisieren: Fahrradweg in der Liste aktualisieren
        setRoutes(prevRoutes => 
          prevRoutes.map(route => 
            route.id === editingBikePath.id 
              ? { ...route, ...editFormData } 
              : route
          )
        );
      }
      
      closeEditDialog();
    } catch (error) {
      console.error('Error saving changes:', error);
    }
  };

  // Die anzuzeigenden Fahrradwege basierend auf dem aktuellen Modus
  const displayedRoutes = (() => {
    switch (currentTab) {
      case 'bikePaths':
        return routes;
      case 'navRoutes':
        return navRoutes;
      case 'public':
        return publicRoutes;
      default:
        return routes;
    }
  })();

  return (
    <>
      <Drawer
        variant="permanent"
        anchor="right"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          height: '100%',
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            position: 'relative',
            height: '100%', // Feste Höhe für die Drawer-Komponente
            maxHeight: '100vh', // Maximale Höhe auf Viewport-Höhe begrenzen
            overflow: 'hidden', // Verhindert das Scrollen des gesamten Drawers
          },
        }}
      >
        {/* Resizer-Balken für die Sidebar-Breite */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: '5px',
            backgroundColor: isDragging ? 'primary.main' : 'transparent',
            cursor: 'ew-resize',
            zIndex: 1300,
            '&:hover': {
              backgroundColor: 'rgba(25, 118, 210, 0.2)',
            },
          }}
          onMouseDown={handleResizeStart}
        />

        <Box 
          sx={{ 
            overflowY: 'auto', // Ermöglicht vertikales Scrollen
            height: '100%', // Nutzt die volle Höhe des Containers
            p: 2, 
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>
              {(() => {
                switch (currentTab) {
                  case 'bikePaths':
                    return 'Meine Fahrradwege';
                  case 'navRoutes':
                    return 'Meine Navigationsrouten';
                  case 'public':
                    return 'Öffentliche Fahrradwege';
                  default:
                    return 'Fahrradnavigation';
                }
              })()}
            </Typography>
          </Box>
          
          {/* Tab-Navigation */}
          <Box sx={{ display: 'flex', width: '100%', mb: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Box 
              onClick={() => user && handleTabChange({} as any, 'bikePaths')}
              sx={{ 
                flex: 1, 
                textAlign: 'center', 
                py: 1.5,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                borderBottom: currentTab === 'bikePaths' ? 2 : 0,
                borderColor: 'primary.main',
                color: currentTab === 'bikePaths' ? 'primary.main' : user ? 'text.primary' : 'text.disabled',
                cursor: user ? 'pointer' : 'default',
                '&:hover': user ? { bgcolor: 'action.hover' } : {},
                opacity: user ? 1 : 0.5,
              }}
            >
              <MapIcon sx={{ mb: 0.75 }} />
              <Typography 
                variant="caption" 
                sx={{ 
                  fontSize: '0.75rem', 
                  textTransform: 'uppercase', 
                  lineHeight: 1.2,
                  display: 'block',
                  whiteSpace: 'nowrap',
                  overflow: 'visible',
                  width: '100%',
                  textAlign: 'center',
                  fontWeight: currentTab === 'bikePaths' ? 'medium' : 'normal'
                }}
              >
                Übersicht
              </Typography>
            </Box>
            
            <Box 
              onClick={() => user && handleTabChange({} as any, 'navRoutes')}
              sx={{ 
                flex: 1, 
                textAlign: 'center', 
                py: 1.5,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                borderBottom: currentTab === 'navRoutes' ? 2 : 0,
                borderColor: 'primary.main',
                color: currentTab === 'navRoutes' ? 'primary.main' : user ? 'text.primary' : 'text.disabled',
                cursor: user ? 'pointer' : 'default',
                '&:hover': user ? { bgcolor: 'action.hover' } : {},
                opacity: user ? 1 : 0.5,
              }}
            >
              <RouteIcon sx={{ mb: 0.75 }} />
              <Typography 
                variant="caption" 
                sx={{ 
                  fontSize: '0.75rem', 
                  textTransform: 'uppercase', 
                  lineHeight: 1.2,
                  display: 'block',
                  whiteSpace: 'nowrap',
                  overflow: 'visible',
                  width: '100%',
                  textAlign: 'center',
                  fontWeight: currentTab === 'navRoutes' ? 'medium' : 'normal'
                }}
              >
                Routen
              </Typography>
            </Box>
            
            <Box 
              onClick={() => handleTabChange({} as any, 'public')}
              sx={{ 
                flex: 1, 
                textAlign: 'center', 
                py: 1.5,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                borderBottom: currentTab === 'public' ? 2 : 0,
                borderColor: 'primary.main',
                color: currentTab === 'public' ? 'primary.main' : 'text.primary',
                cursor: 'pointer',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <PublicIcon sx={{ mb: 0.75 }} />
              <Typography 
                variant="caption" 
                sx={{ 
                  fontSize: '0.75rem', 
                  textTransform: 'uppercase', 
                  lineHeight: 1.2,
                  display: 'block',
                  whiteSpace: 'nowrap',
                  overflow: 'visible',
                  width: '100%',
                  textAlign: 'center',
                  fontWeight: currentTab === 'public' ? 'medium' : 'normal'
                }}
              >
                Öffentlich
              </Typography>
            </Box>
          </Box>
          
          {/* Benutzerstatistiken anzeigen, wenn eingeloggt */}
          {user && userStats && (currentTab === 'navRoutes') && (
            <>
              <Box 
                sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  mb: 1,
                  cursor: 'pointer',
                  bgcolor: 'background.paper',
                  p: 1,
                  borderRadius: 1,
                  '&:hover': { bgcolor: 'action.hover' }
                }}
                onClick={toggleStats}
              >
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <DirectionsBikeIcon color="success" sx={{ mr: 1 }} />
                  <Typography variant="subtitle1">Meine Umweltstatistiken</Typography>
                </Box>
                {showStats ? <ExpandLess /> : <ExpandMore />}
              </Box>
              
              <Collapse in={showStats} timeout="auto">
                <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <Typography variant="h6" color="primary">{userStats.totalDistance.toFixed(1)} km</Typography>
                      <Typography variant="body2" color="text.secondary">Gesamtstrecke</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <Typography variant="h6" color="success.main">{userStats.co2Saved.toFixed(1)} kg</Typography>
                      <Typography variant="body2" color="text.secondary">CO₂ gespart</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <Typography variant="h6" color="info.main">{userStats.totalRoutes}</Typography>
                      <Typography variant="body2" color="text.secondary">Fahrten</Typography>
                    </Box>
                  </Box>
                  
                  {userStats.co2Saved > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>Das entspricht:</Typography>
                      <List dense>
                        {Object.entries(calculateEnvironmentalFacts(userStats.co2Saved)).map(([key, value]) => (
                          <ListItem key={key} sx={{ py: 0 }}>
                            <ListItemIcon sx={{ minWidth: 36 }}>
                              <DirectionsBikeIcon fontSize="small" color="success" />
                            </ListItemIcon>
                            <ListItemText primary={value} />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  )}
                  
                  {userStats.streakDays > 0 && (
                    <Box sx={{ mt: 1, display: 'flex', alignItems: 'center' }}>
                      <DirectionsBikeIcon color="primary" sx={{ mr: 1 }} />
                      <Typography variant="body2">
                        {userStats.streakDays === 1 
                          ? 'Heute gefahren!' 
                          : `${userStats.streakDays} Tage in Folge gefahren!`}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Collapse>
            </>
          )}
          
          <Divider sx={{ mb: 2 }} />
          
          {!user && currentTab !== 'public' ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
              Bitte melde dich an, um deine gespeicherten Fahrradwege und Routen zu sehen.
            </Typography>
          ) : loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <CircularProgress size={40} />
            </Box>
          ) : displayedRoutes.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
              {currentTab === 'public' 
                ? 'Es sind noch keine öffentlichen Fahrradwege verfügbar.'
                : currentTab === 'navRoutes'
                  ? 'Du hast noch keine Navigationsrouten gespeichert. Nutze die Navigation, um eine Route zu planen und zu speichern.'
                  : 'Du hast noch keine Fahrradwege gespeichert. Klicke auf "Karte bearbeiten" in der Navigationsleiste, um einen neuen Fahrradweg zu erstellen.'}
            </Typography>
          ) : (
            <List>
              {displayedRoutes.map((route) => (
                <React.Fragment key={route.id}>
                  <ListItemButton 
                    onClick={() => handleToggleRoute(route.id!)}
                    sx={{ 
                      position: 'relative',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      pr: 2, // Platz für die Aktions-Buttons
                      pb: 2 // Zusätzlicher Platz unten für die Aktionsbuttons
                    }}
                  >
                    <Box sx={{ 
                      display: 'flex', 
                      width: '100%',
                      mb: 1 // Abstand zwischen Hauptinhalt und Aktionsbuttons
                    }}>
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        {route.status === 'completed' ? (
                          <Badge color="success" variant="dot">
                            <PedalBikeIcon />
                          </Badge>
                        ) : route.status === 'aborted' ? (
                          <Badge color="error" variant="dot">
                            <PedalBikeIcon />
                          </Badge>
                        ) : (
                          <PedalBikeIcon />
                        )}
                      </ListItemIcon>
                      <ListItemText 
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography component="span" noWrap>
                              {route.name}
                            </Typography>
                            {/* Rating für öffentliche Routen direkt in der Liste anzeigen */}
                            {currentTab === 'public' && (
                              <RouteRating 
                                routeId={route.id!} 
                                averageRating={route.rating}
                                ratingCount={route.ratingCount}
                                user={user}
                                onRatingChange={() => fetchPublicRoutes()}
                                size="small"
                                readOnly={true}
                                showCount={true}
                              />
                            )}
                          </Box>
                        }
                        secondary={
                          <Typography variant="body2" component="span">
                            {route.description || 'Keine Beschreibung'} 
                            {route.distance && ` • ${route.distance.toFixed(2)} km`}
                            {route.status && ` • ${getStatusText(route.status)}`}
                            {currentTab === 'public' && route.ratingCount ? ` • ${route.ratingCount} Bewertung${route.ratingCount !== 1 ? 'en' : ''}` : ''}
                          </Typography>
                        }
                        primaryTypographyProps={{ noWrap: true, component: 'div' }}
                        secondaryTypographyProps={{ noWrap: true }}
                        sx={{ 
                          overflow: 'hidden',
                          flexGrow: 1
                        }}
                      />
                      {/* Expand/Collapse Icon - neben dem Text */}
                      <Box sx={{ ml: 1 }}>
                        {openRouteId === route.id ? <ExpandLess /> : <ExpandMore />}
                      </Box>
                    </Box>
                      
                    {/* Aktionen für die Route - unterhalb des Texts */}
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      position: 'absolute',
                      bottom: 2,
                      right: 16
                    }}>
                      {/* Für Navigationsrouten füge ein Auge-Symbol hinzu */}
                      {currentTab === 'navRoutes' && (
                        <Tooltip title={visibleNavRouteId === route.id ? "Route ausblenden" : "Auf Karte anzeigen"}>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation(); // Verhindere das Öffnen/Schließen des Route-Details
                              handleToggleNavRouteVisibility(route.id!);
                            }}
                            sx={{ color: visibleNavRouteId === route.id ? 'primary.main' : 'text.secondary' }}
                          >
                            {visibleNavRouteId === route.id ? <VisibilityIcon /> : <VisibilityOffIcon />}
                          </IconButton>
                        </Tooltip>
                      )}
                      
                      {/* Status-Button nur im "Meine Routen"-Tab anzeigen */}
                      {currentTab === 'navRoutes' && user && route.userId === user.uid && (!route.status || route.status === 'planned') && (
                        <Tooltip title="Route als abgeschlossen oder abgebrochen markieren">
                          <IconButton 
                            size="small"
                            aria-label="status"
                            onClick={(e) => {
                              e.stopPropagation();
                              openStatusDialog(route.id!);
                            }}
                          >
                            <CheckCircleIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      
                      {/* Lösch-Button */}
                      {user && route.userId === user.uid && (
                        <Tooltip title={currentTab === 'navRoutes' ? "Route löschen" : "Fahrradweg löschen"}>
                          <IconButton 
                            size="small"
                            aria-label="delete"
                            onClick={(e) => {
                              e.stopPropagation();
                              confirmDeleteRoute(route.id!);
                            }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      
                      {/* Edit-Button */}
                      {user && route.userId === user.uid && (
                        <Tooltip title="Route bearbeiten">
                          <IconButton 
                            size="small"
                            aria-label="edit"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditDialog(route);
                            }}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </ListItemButton>
                  <Collapse in={openRouteId === route.id} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                      <ListItem sx={{ pl: 4 }}>
                        <ListItemIcon>
                          <DirectionsIcon />
                        </ListItemIcon>
                        <ListItemText 
                          primary="Streckenlänge" 
                          secondary={`${calculateRouteLength(route.points).toFixed(2)} km`} 
                        />
                      </ListItem>
                      {route.slope && (
                        <ListItem sx={{ pl: 4 }}>
                          <ListItemIcon>
                            <TrendingUpIcon />
                          </ListItemIcon>
                          <ListItemText 
                            primary="Steigung" 
                            secondary={
                              <Chip 
                                label={route.slope} 
                                size="small" 
                                color={getSlopeColor(route.slope) as any} 
                                sx={{ mt: 0.5 }}
                              />
                            } 
                          />
                        </ListItem>
                      )}
                      {/* Bewertungskomponente hinzufügen */}
                      <ListItem sx={{ pl: 4 }}>
                        <ListItemIcon>
                          <StarIcon />
                        </ListItemIcon>
                        <ListItemText 
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography component="span">Bewertung</Typography>
                              {(route.ratingCount ?? 0) > 0 && (
                                <Typography variant="body2" component="span" color="text.secondary">
                                  ({route.ratingCount ?? 0} Bewertung{(route.ratingCount ?? 0) !== 1 ? 'en' : ''})
                                </Typography>
                              )}
                            </Box>
                          }
                          secondary={
                            <RouteRating 
                              routeId={route.id!} 
                              averageRating={route.rating}
                              ratingCount={route.ratingCount || 0}
                              user={user}
                              onRatingChange={() => fetchPublicRoutes()}
                              size="small"
                              readOnly={currentTab !== 'public'} // Nur für öffentliche Routen Bewertungen erlauben
                              showCount={true}
                            />
                          } 
                        />
                      </ListItem>
                      <ListItem sx={{ pl: 4 }}>
                        <ListItemIcon>
                          <CommentIcon />
                        </ListItemIcon>
                        <ListItemText 
                          primary="Beschreibung" 
                          secondary={route.description || "Keine Beschreibung"} 
                        />
                      </ListItem>
                      {route.status === 'completed' && route.completedAt && (
                        <ListItem sx={{ pl: 4 }}>
                          <ListItemIcon>
                            <CheckCircleIcon color="success" />
                          </ListItemIcon>
                          <ListItemText 
                            primary="Abgeschlossen am" 
                            secondary={new Date(route.completedAt).toLocaleDateString()} 
                          />
                        </ListItem>
                      )}
                      {route.status === 'completed' && route.distance && (
                        <ListItem sx={{ pl: 4 }}>
                          <ListItemIcon>
                            <DirectionsBikeIcon color="success" />
                          </ListItemIcon>
                          <ListItemText 
                            primary="CO₂ Einsparung" 
                            secondary={`${(route.distance * 0.15).toFixed(2)} kg CO₂ (im Vergleich zum Auto)`} 
                          />
                        </ListItem>
                      )}
                    </List>
                  </Collapse>
                  <Divider />
                </React.Fragment>
              ))}
            </List>
          )}
        </Box>
      </Drawer>

      {/* Bestätigungsdialog zum Löschen eines Fahrradwegs oder einer Route */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>{currentTab === 'navRoutes' ? 'Route löschen' : 'Fahrradweg löschen'}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {currentTab === 'navRoutes' 
              ? 'Bist du sicher, dass du diese Route löschen möchtest? Diese Aktion kann nicht rückgängig gemacht werden.'
              : 'Bist du sicher, dass du diesen Fahrradweg löschen möchtest? Diese Aktion kann nicht rückgängig gemacht werden.'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Abbrechen</Button>
          <Button onClick={handleDeleteRoute} color="error" autoFocus>
            Löschen
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog zum Aktualisieren des Fahrradweg-Status */}
      <Dialog
        open={statusDialogOpen}
        onClose={() => setStatusDialogOpen(false)}
      >
        <DialogTitle>Routenstatus aktualisieren</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Bist du diese Route gefahren? Markiere sie als abgeschlossen, um deine Umweltstatistiken zu aktualisieren.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialogOpen(false)} color="inherit">
            Abbrechen
          </Button>
          <Button onClick={handleMarkAsAborted} color="error">
            Nicht gefahren
          </Button>
          <Button onClick={handleMarkAsCompleted} color="success" autoFocus>
            Gefahren
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bearbeitungsdialog */}
      <Dialog
        open={editDialogOpen}
        onClose={closeEditDialog}
      >
        <DialogTitle>Fahrradweg bearbeiten</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            id="name"
            label="Name"
            type="text"
            fullWidth
            value={editFormData.name}
            onChange={(e) => handleEditFormChange('name', e.target.value)}
          />
          <TextField
            margin="dense"
            id="description"
            label="Beschreibung"
            type="text"
            fullWidth
            value={editFormData.description}
            onChange={(e) => handleEditFormChange('description', e.target.value)}
          />
          <FormControl fullWidth margin="dense">
            <InputLabel id="road-quality-label">Straßenqualität</InputLabel>
            <Select
              labelId="road-quality-label"
              id="road-quality"
              value={editFormData.roadQuality}
              label="Straßenqualität"
              onChange={(e) => handleEditFormChange('roadQuality', Number(e.target.value))}
            >
              <MenuItem value={0}>Keine Angabe</MenuItem>
              <MenuItem value={1}>Sehr gut</MenuItem>
              <MenuItem value={2}>Gut</MenuItem>
              <MenuItem value={3}>Durchschnittlich</MenuItem>
              <MenuItem value={4}>Schlecht</MenuItem>
              <MenuItem value={5}>Sehr schlecht</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="dense">
            <InputLabel id="traffic-label">Verkehrsdichte</InputLabel>
            <Select
              labelId="traffic-label"
              id="traffic"
              value={editFormData.traffic}
              label="Verkehrsdichte"
              onChange={(e) => handleEditFormChange('traffic', Number(e.target.value))}
            >
              <MenuItem value={0}>Keine Angabe</MenuItem>
              <MenuItem value={1}>Sehr gering</MenuItem>
              <MenuItem value={2}>Gering</MenuItem>
              <MenuItem value={3}>Mittel</MenuItem>
              <MenuItem value={4}>Hoch</MenuItem>
              <MenuItem value={5}>Sehr hoch</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="dense">
            <InputLabel id="scenery-label">Landschaft</InputLabel>
            <Select
              labelId="scenery-label"
              id="scenery"
              value={editFormData.scenery}
              label="Landschaft"
              onChange={(e) => handleEditFormChange('scenery', Number(e.target.value))}
            >
              <MenuItem value={0}>Keine Angabe</MenuItem>
              <MenuItem value={1}>Stadt</MenuItem>
              <MenuItem value={2}>Land</MenuItem>
              <MenuItem value={3}>Wald</MenuItem>
              <MenuItem value={4}>Berg</MenuItem>
              <MenuItem value={5}>Meer</MenuItem>
            </Select>
          </FormControl>
          
          {/* Tags-Bereich */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2">Tags</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <TextField
                size="small"
                id="new-tag"
                label="Neuer Tag"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                sx={{ mr: 1, flexGrow: 1 }}
              />
              <Button 
                variant="outlined" 
                size="small" 
                onClick={handleAddTag}
                disabled={!newTag.trim()}
              >
                Hinzufügen
              </Button>
            </Box>
            
            {/* Anzeige der aktuellen Tags */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {editFormData.tags.map((tag, index) => (
                <Chip
                  key={index}
                  label={tag}
                  onDelete={() => handleRemoveTag(tag)}
                  color="primary"
                  variant="outlined"
                />
              ))}
              {editFormData.tags.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  Keine Tags vorhanden
                </Typography>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEditDialog} color="inherit">
            Abbrechen
          </Button>
          <Button onClick={saveChanges} color="success" autoFocus>
            Speichern
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default Sidebar; 