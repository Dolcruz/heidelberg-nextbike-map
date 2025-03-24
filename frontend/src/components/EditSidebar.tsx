import React from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Drawer,
  IconButton,
  Divider,
  Typography,
  Collapse
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DirectionsBikeIcon from '@mui/icons-material/DirectionsBike';
import LocalParkingIcon from '@mui/icons-material/LocalParking';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import BuildIcon from '@mui/icons-material/Build';
import BatteryChargingFullIcon from '@mui/icons-material/BatteryChargingFull';
import ElectricBikeIcon from '@mui/icons-material/ElectricBike';
import CloseIcon from '@mui/icons-material/Close';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import PedalBikeIcon from '@mui/icons-material/PedalBike';
import MapIcon from '@mui/icons-material/Map';

interface EditSidebarProps {
  open: boolean;
  onClose: () => void;
  onModeSelect: (mode: EditMode) => void;
  currentMode: EditMode | null;
}

// Verschiedene Bearbeitungsmodi
export type EditMode = 
  | 'bikePath' 
  | 'bikeStand' 
  | 'poi' 
  | 'nextBike' 
  | 'repairStation' 
  | 'chargingStation';

/**
 * Sidebar-Komponente zum Auswählen verschiedener Bearbeitungsmodi
 */
const EditSidebar: React.FC<EditSidebarProps> = ({ 
  open, 
  onClose, 
  onModeSelect,
  currentMode
}) => {
  const [openSubmenu, setOpenSubmenu] = React.useState(false);

  // Toggle für das Untermenü
  const handleSubmenuToggle = () => {
    setOpenSubmenu(!openSubmenu);
  };

  // Funktion zum Schließen der Sidebar und Zurücksetzen des Modus
  const handleClose = () => {
    // Wenn ein Modus aktiv ist, diesen zurücksetzen
    if (currentMode) {
      onModeSelect(currentMode); // Dies deaktiviert den aktuellen Modus
    }
    onClose();
  };

  // Funktion zum Auswählen eines Modus
  const handleModeSelect = (mode: EditMode) => {
    onModeSelect(mode);
    onClose(); // Sidebar schließen nach Auswahl
  };

  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={handleClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: 300,
          boxSizing: 'border-box',
          top: '64px', // Anpassen an die Höhe der Navbar
          height: 'calc(100% - 64px)',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', padding: 2, justifyContent: 'space-between' }}>
        <Typography variant="h6">Karte bearbeiten</Typography>
        <IconButton onClick={handleClose}>
          <CloseIcon />
        </IconButton>
      </Box>
      
      <Divider />
      
      <List>
        <ListItem disablePadding>
          <ListItemButton 
            selected={currentMode === 'bikePath'} 
            onClick={() => handleModeSelect('bikePath')}
          >
            <ListItemIcon>
              <DirectionsBikeIcon color={currentMode === 'bikePath' ? 'primary' : 'inherit'} />
            </ListItemIcon>
            <ListItemText primary="Fahrradweg zeichnen" />
          </ListItemButton>
        </ListItem>
        
        <ListItem disablePadding>
          <ListItemButton 
            selected={currentMode === 'bikeStand'} 
            onClick={() => handleModeSelect('bikeStand')}
          >
            <ListItemIcon>
              <LocalParkingIcon color={currentMode === 'bikeStand' ? 'primary' : 'inherit'} />
            </ListItemIcon>
            <ListItemText primary="Fahrradständer hinzufügen" />
          </ListItemButton>
        </ListItem>

        <ListItem disablePadding>
          <ListItemButton 
            selected={currentMode === 'nextBike'} 
            onClick={() => handleModeSelect('nextBike')}
          >
            <ListItemIcon>
              <PedalBikeIcon color={currentMode === 'nextBike' ? 'primary' : 'inherit'} />
            </ListItemIcon>
            <ListItemText primary="Nextbike-Station hinzufügen" />
          </ListItemButton>
        </ListItem>

        <ListItem disablePadding>
          <ListItemButton 
            selected={currentMode === 'repairStation'} 
            onClick={() => handleModeSelect('repairStation')}
          >
            <ListItemIcon>
              <BuildIcon color={currentMode === 'repairStation' ? 'primary' : 'inherit'} />
            </ListItemIcon>
            <ListItemText primary="Reparaturstation hinzufügen" />
          </ListItemButton>
        </ListItem>

        <ListItem disablePadding>
          <ListItemButton 
            selected={currentMode === 'chargingStation'} 
            onClick={() => handleModeSelect('chargingStation')}
          >
            <ListItemIcon>
              <BatteryChargingFullIcon color={currentMode === 'chargingStation' ? 'primary' : 'inherit'} />
            </ListItemIcon>
            <ListItemText primary="Ladestation hinzufügen" />
          </ListItemButton>
        </ListItem>

        <ListItem disablePadding>
          <ListItemButton 
            selected={currentMode === 'poi'} 
            onClick={() => handleModeSelect('poi')}
          >
            <ListItemIcon>
              <MapIcon color={currentMode === 'poi' ? 'primary' : 'inherit'} />
            </ListItemIcon>
            <ListItemText primary="POI hinzufügen" />
          </ListItemButton>
        </ListItem>
      </List>
    </Drawer>
  );
};

export default EditSidebar; 