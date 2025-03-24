import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText,
  Divider,
  IconButton,
  Collapse,
  Tooltip
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import DirectionsBikeIcon from '@mui/icons-material/DirectionsBike';
import LocalParkingIcon from '@mui/icons-material/LocalParking';
import BuildIcon from '@mui/icons-material/Build';
import BatteryChargingFullIcon from '@mui/icons-material/BatteryChargingFull';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import RouteIcon from '@mui/icons-material/Route';

interface MapLegendProps {
  showRoutes?: boolean;
  showNextbike?: boolean;
  showBikeStands?: boolean;
  showRepairStations?: boolean;
  showChargingStations?: boolean;
  showPois?: boolean;
}

/**
 * Komponente zur Anzeige einer Legende für die Kartensymbole
 */
const MapLegend: React.FC<MapLegendProps> = ({
  showRoutes = true,
  showNextbike = true,
  showBikeStands = true,
  showRepairStations = true,
  showChargingStations = true,
  showPois = true
}) => {
  const [expanded, setExpanded] = useState(true);

  const handleToggle = () => {
    setExpanded(!expanded);
  };

  return (
    <Paper
      sx={{
        position: 'absolute',
        bottom: 20,
        left: 10,
        zIndex: 1000,
        maxWidth: 250,
        borderRadius: 2,
        overflow: 'hidden',
        boxShadow: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.95)'
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 1,
          bgcolor: 'primary.main',
          color: 'white'
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
          <HelpOutlineIcon fontSize="small" sx={{ mr: 0.5 }} />
          Kartenlegende
        </Typography>
        <IconButton size="small" onClick={handleToggle} sx={{ color: 'white' }}>
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <List dense disablePadding>
          {showRoutes && (
            <ListItem>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <RouteIcon style={{ color: '#2196f3' }} fontSize="small" />
              </ListItemIcon>
              <ListItemText 
                primary="Fahrradwege" 
                secondary="Eingezeichnete Fahrradrouten"
                primaryTypographyProps={{ variant: 'body2' }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
            </ListItem>
          )}

          {showBikeStands && (
            <ListItem>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Box 
                  sx={{ 
                    width: 12, 
                    height: 12, 
                    borderRadius: '50%', 
                    bgcolor: '#ff6b6b', 
                    border: '2px solid white',
                    boxShadow: '0 0 0 1px #ff6b6b',
                    ml: 1
                  }} 
                />
              </ListItemIcon>
              <ListItemText 
                primary="Fahrradständer" 
                secondary="Abstellplätze für Fahrräder"
                primaryTypographyProps={{ variant: 'body2' }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
            </ListItem>
          )}

          {showNextbike && (
            <ListItem>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Box 
                  sx={{ 
                    width: 12, 
                    height: 12, 
                    borderRadius: '50%', 
                    bgcolor: '#4caf50', 
                    border: '2px solid white',
                    boxShadow: '0 0 0 1px #4caf50',
                    ml: 1,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center'
                  }} 
                >
                  <DirectionsBikeIcon style={{ color: 'white', fontSize: 8 }} />
                </Box>
              </ListItemIcon>
              <ListItemText 
                primary="Nextbike-Stationen" 
                secondary="Leihfahrradstationen"
                primaryTypographyProps={{ variant: 'body2' }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
            </ListItem>
          )}

          {showRepairStations && (
            <ListItem>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Box 
                  sx={{ 
                    width: 12, 
                    height: 12, 
                    borderRadius: '50%', 
                    bgcolor: '#ff9800', 
                    border: '2px solid white',
                    boxShadow: '0 0 0 1px #ff9800',
                    ml: 1,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center'
                  }} 
                >
                  <BuildIcon style={{ color: 'white', fontSize: 8 }} />
                </Box>
              </ListItemIcon>
              <ListItemText 
                primary="Reparaturstationen" 
                secondary="Für kleinere Reparaturen"
                primaryTypographyProps={{ variant: 'body2' }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
            </ListItem>
          )}

          {showChargingStations && (
            <ListItem>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Box 
                  sx={{ 
                    width: 12, 
                    height: 12, 
                    borderRadius: '50%', 
                    bgcolor: '#9c27b0', 
                    border: '2px solid white',
                    boxShadow: '0 0 0 1px #9c27b0',
                    ml: 1,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center'
                  }} 
                >
                  <BatteryChargingFullIcon style={{ color: 'white', fontSize: 8 }} />
                </Box>
              </ListItemIcon>
              <ListItemText 
                primary="E-Bike-Ladestationen" 
                secondary="Aufladepunkte für E-Bikes"
                primaryTypographyProps={{ variant: 'body2' }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
            </ListItem>
          )}

          {showPois && (
            <ListItem>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Box 
                  sx={{ 
                    width: 12, 
                    height: 12, 
                    borderRadius: '50%', 
                    bgcolor: '#f44336', 
                    border: '2px solid white',
                    boxShadow: '0 0 0 1px #f44336',
                    ml: 1,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center'
                  }} 
                >
                  <LocationOnIcon style={{ color: 'white', fontSize: 8 }} />
                </Box>
              </ListItemIcon>
              <ListItemText 
                primary="Sonstige POIs" 
                secondary="Weitere interessante Orte"
                primaryTypographyProps={{ variant: 'body2' }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
            </ListItem>
          )}
        </List>

        <Box sx={{ p: 1, bgcolor: '#f5f5f5' }}>
          <Typography variant="caption" color="text.secondary">
            Klicke auf ein Symbol für weitere Informationen.
          </Typography>
        </Box>
      </Collapse>
    </Paper>
  );
};

export default MapLegend; 