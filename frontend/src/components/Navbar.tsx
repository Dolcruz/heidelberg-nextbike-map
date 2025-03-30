import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Box,
  Menu,
  MenuItem,
  Avatar,
  Tooltip,
  TextField,
  InputAdornment,
  Paper,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Popper,
  ClickAwayListener,
  ListItemIcon,
  Divider
} from '@mui/material';
import DirectionsBikeIcon from '@mui/icons-material/DirectionsBike';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { auth, googleProvider } from '../firebase/index';
import ProfileCard from './ProfileCard';

interface NavbarProps {
  onDrawingModeToggle: () => void;
  isDrawingMode: boolean;
  onBikeStandModeToggle: () => void;
  isBikeStandMode: boolean;
  onSearchLocation?: (location: { display_name: string; lat: number; lon: number }) => void;
  onAdminPanelToggle?: () => void;
  user?: User | null;
}

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
  place_id: number;
}

const Navbar: React.FC<NavbarProps> = ({ onDrawingModeToggle, isDrawingMode, onBikeStandModeToggle, isBikeStandMode, onSearchLocation, onAdminPanelToggle, user: userProp }) => {
  const [user, setUser] = useState<User | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchAnchorEl, setSearchAnchorEl] = useState<HTMLElement | null>(null);
  const [showResults, setShowResults] = useState(false);

  // Profil-Dialog-Status
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    // Wenn ein User-Prop übergeben wurde, verwenden wir diesen
    if (userProp !== undefined) {
      setUser(userProp);
      return;
    }

    // Ansonsten verwenden wir den Auth-Listener
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, [userProp]);

  const handleProfileClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      handleClose();
    } catch (error) {
      console.error('Error signing in with Google:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      handleClose();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleRouteClick = () => {
    // TODO: Implement route creation mode
    console.log('Route creation mode');
  };

  const handlePoiClick = () => {
    // TODO: Implement POI creation mode
    console.log('POI creation mode');
  };

  // Suche nach einem Ort mit verschiedenen Geocoding APIs
  const searchLocation = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setLoading(true);
    try {
      // Direkter Ansatz mit einem anderen Geocoding-Service, der CORS erlaubt
      // https://geocode.maps.co/ erlaubt CORS-Anfragen und ist kostenlos 
      const apiUrl = `https://geocode.maps.co/search?q=${encodeURIComponent(query)}&limit=5`;
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Fehler bei der Ortssuche: Status ${response.status}`);
      }
      
      const data = await response.json();
      setSearchResults(data);
      setShowResults(data.length > 0);
    } catch (error) {
      console.error('Error searching for location:', error);
      
      // Fallback mit hardcoded Ergebnissen für häufig gesuchte Städte
      handleFallbackResults(query);
    } finally {
      setLoading(false);
    }
  };
  
  // Hilfsfunktion für Fallback-Ergebnisse
  const handleFallbackResults = (query: string) => {
    const lowerQuery = query.toLowerCase();
    let fallbackResults: SearchResult[] = [];
    
    if (lowerQuery.includes('heidelberg')) {
      fallbackResults = [{
        display_name: 'Heidelberg, Baden-Württemberg, Deutschland',
        lat: '49.4093582',
        lon: '8.467236',
        place_id: 12345
      }];
    } else if (lowerQuery.includes('mannheim')) {
      fallbackResults = [{
        display_name: 'Mannheim, Baden-Württemberg, Deutschland',
        lat: '49.489591',
        lon: '8.467236',
        place_id: 23456
      }];
    } else if (lowerQuery.includes('berlin')) {
      fallbackResults = [{
        display_name: 'Berlin, Deutschland',
        lat: '52.520008',
        lon: '13.404954',
        place_id: 34567
      }];
    } else if (lowerQuery.includes('münchen') || lowerQuery.includes('munich')) {
      fallbackResults = [{
        display_name: 'München, Bayern, Deutschland',
        lat: '48.137154',
        lon: '11.576124',
        place_id: 45678
      }];
    } else if (lowerQuery.includes('frankfurt')) {
      fallbackResults = [{
        display_name: 'Frankfurt am Main, Hessen, Deutschland',
        lat: '50.110924',
        lon: '8.682127',
        place_id: 56789
      }];
    }
    
    if (fallbackResults.length > 0) {
      setSearchResults(fallbackResults);
      setShowResults(true);
    } else {
      setSearchResults([]);
    }
  };

  // Behandelt die Änderung des Suchfelds
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value;
    setSearchTerm(query);
    
    // Speichere das Eingabefeld-Element für das Popup
    if (!searchAnchorEl && event.currentTarget) {
      setSearchAnchorEl(event.currentTarget);
    }
    
    // Debounce: Nur alle 500ms suchen, um zu viele API-Anfragen zu vermeiden
    const debounceTimer = setTimeout(() => {
      searchLocation(query);
    }, 500);
    
    return () => clearTimeout(debounceTimer);
  };

  // Wenn ein Suchergebnis ausgewählt wird
  const handleLocationSelect = (location: SearchResult) => {
    // Schließe die Ergebnisliste
    setShowResults(false);
    setSearchTerm(location.display_name);
    
    // Rufe den Callback auf, um die Karte auf den ausgewählten Ort zu zoomen
    if (onSearchLocation) {
      onSearchLocation({
        display_name: location.display_name,
        lat: parseFloat(location.lat),
        lon: parseFloat(location.lon)
      });
    }
  };

  // Profil-Dialog öffnen
  const handleOpenProfile = () => {
    setProfileOpen(true);
    setAnchorEl(null); // Menü schließen
  };

  // Profil-Dialog schließen
  const handleCloseProfile = () => {
    setProfileOpen(false);
  };

  // Überprüfen, ob der aktuelle Benutzer der Admin ist
  const isAdmin = user?.email === 'pfistererfalk@gmail.com';

  return (
    <AppBar position="static" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
      <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
        {/* Logo and App Name - Left Section */}
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton
            size="large"
            edge="start"
            color="inherit"
            aria-label="menu"
            sx={{ mr: 2 }}
          >
            <img 
              src={`${process.env.PUBLIC_URL}/android-chrome-512x512.png`} 
              alt="Bike Route App Logo" 
              style={{ width: 32, height: 32 }}
            />
          </IconButton>
          <Typography variant="h6" component="div">
            Bike Route Mapper
          </Typography>
        </Box>

        {/* Suchfeld - Center Section */}
        <Box sx={{ flexGrow: 1, maxWidth: '500px', mx: 2, position: 'relative' }}>
          <TextField
            placeholder="Ort suchen..."
            variant="outlined"
            size="small"
            fullWidth
            value={searchTerm}
            onChange={handleSearchChange}
            onClick={(e) => {
              if (searchResults.length > 0) {
                setShowResults(true);
                setSearchAnchorEl(e.currentTarget);
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: loading && (
                <InputAdornment position="end">
                  <CircularProgress color="inherit" size={20} />
                </InputAdornment>
              ),
            }}
          />
          <Popper 
            open={showResults} 
            anchorEl={searchAnchorEl} 
            placement="bottom-start" 
            style={{ zIndex: 1300, width: searchAnchorEl?.offsetWidth }}
          >
            <ClickAwayListener onClickAway={() => setShowResults(false)}>
              <Paper elevation={3} sx={{ mt: 1, maxHeight: 300, overflow: 'auto' }}>
                <List dense>
                  {searchResults.map((result) => (
                    <ListItem 
                      key={result.place_id}
                      onClick={() => handleLocationSelect(result)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <ListItemText 
                        primary={result.display_name.split(',')[0]} 
                        secondary={result.display_name.split(',').slice(1).join(',')}
                        secondaryTypographyProps={{ noWrap: true }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </ClickAwayListener>
          </Popper>
        </Box>

        {/* Right Section - Action Buttons + User */}
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {/* Einziger Bearbeitungs-Button */}
          <Tooltip title={isDrawingMode ? "Bearbeitungsmodus aktiv" : "Karte bearbeiten"}>
            <IconButton
              color={isDrawingMode ? "secondary" : "inherit"}
              onClick={onDrawingModeToggle}
              sx={{ mr: 1 }}
            >
              <EditIcon />
            </IconButton>
          </Tooltip>

          {/* Benutzer-Dropdown mit Icon und Namen */}
          {user ? (
            <div>
              <IconButton
                onClick={handleProfileClick}
                size="small"
                color="inherit"
                aria-label="account of current user"
                aria-controls="menu-appbar"
                aria-haspopup="true"
              >
                <Avatar 
                  alt={user.displayName || ''} 
                  src={user.photoURL || ''}
                  sx={{ width: 32, height: 32 }}
                />
              </IconButton>
              <Menu
                id="menu-appbar"
                anchorEl={anchorEl}
                keepMounted
                open={Boolean(anchorEl)}
                onClose={handleClose}
              >
                {/* Benutzerinfo anzeigen */}
                <MenuItem disabled>
                  <ListItemIcon>
                    <AccountCircleIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary={user.displayName || user.email} />
                </MenuItem>
                <Divider />
                
                {/* Profil-Button hinzufügen */}
                <MenuItem onClick={handleOpenProfile}>
                  <ListItemIcon>
                    <PersonIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Mein Profil" />
                </MenuItem>
                
                {/* Logout-Button */}
                <MenuItem onClick={handleLogout}>
                  <ListItemIcon>
                    <LogoutIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Logout" />
                </MenuItem>
              </Menu>
            </div>
          ) : (
            <Button color="inherit" onClick={handleLogin}>Login</Button>
          )}

          {/* Admin Panel Button - nur für Admin sichtbar */}
          {isAdmin && onAdminPanelToggle && (
            <Tooltip title="Admin-Panel: Routen-Genehmigung">
              <Button 
                color="inherit" 
                onClick={onAdminPanelToggle}
                startIcon={<AdminPanelSettingsIcon />}
                sx={{ ml: 1 }}
              >
                Admin
              </Button>
            </Tooltip>
          )}
        </Box>
      </Toolbar>

      {/* Profil-Dialog */}
      <ProfileCard 
        open={profileOpen} 
        onClose={handleCloseProfile} 
        user={user} 
      />
    </AppBar>
  );
};

export default Navbar; 