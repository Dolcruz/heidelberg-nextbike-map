import React, { useState } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  TextField, 
  FormControlLabel, 
  Checkbox,
  Switch,
  Typography,
  Box,
  Rating,
  Grid,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  FormHelperText
} from '@mui/material';
import L from 'leaflet';
import { auth } from '../firebase/index';
import { 
  addPoi, 
  addNextbikeStation, 
  addRepairStation, 
  addChargingStation
} from '../services/poiService';
import { EditMode } from './EditSidebar';

// Props für den POIDialog
interface POIDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  position: L.LatLng | null;
  poiType: EditMode | null;
}

/**
 * Dialog-Komponente zum Hinzufügen verschiedener POI-Typen
 */
const POIDialog: React.FC<POIDialogProps> = ({ 
  open, 
  onClose, 
  onSave, 
  position, 
  poiType 
}) => {
  // Allgemeine Felder für alle POI-Typen
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [error, setError] = useState('');

  // Spezifische Felder für Nextbike-Stationen
  const [bikeCapacity, setBikeCapacity] = useState<number | ''>('');
  const [provider, setProvider] = useState('nextbike');
  const [isActive, setIsActive] = useState(true);

  // Spezifische Felder für Reparaturstationen
  const [hasAirPump, setHasAirPump] = useState(false);
  const [hasTools, setHasTools] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [openingHours, setOpeningHours] = useState('');

  // Spezifische Felder für E-Bike-Ladestationen
  const [plugType, setPlugType] = useState('');
  const [chargeSpeed, setChargeSpeed] = useState('medium');
  const [isChargingPublic, setIsChargingPublic] = useState(true);
  const [price, setPrice] = useState('free');
  const [chargingOpeningHours, setChargingOpeningHours] = useState('');

  // Spezifische Felder für allgemeine POIs
  const [category, setCategory] = useState('');
  const [website, setWebsite] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [poiOpeningHours, setPoiOpeningHours] = useState('');

  // Dialog-Titel basierend auf dem POI-Typ
  const getDialogTitle = () => {
    switch (poiType) {
      case 'repairStation':
        return 'Reparatur-Station hinzufügen';
      case 'chargingStation':
        return 'E-Bike-Ladestation hinzufügen';
      case 'poi':
        return 'Interessanten Ort hinzufügen';
      default:
        return 'POI hinzufügen';
    }
  };

  // Zurücksetzen aller Felder beim Öffnen des Dialogs
  const handleEnter = () => {
    // Allgemeine Felder zurücksetzen
    setName('');
    setDescription('');
    setRating(null);
    setError('');

    // Spezifische Felder zurücksetzen je nach POI-Typ
    if (poiType === 'repairStation') {
      setHasAirPump(false);
      setHasTools(false);
      setIsPublic(true);
      setOpeningHours('');
    } else if (poiType === 'chargingStation') {
      setPlugType('');
      setChargeSpeed('medium');
      setIsChargingPublic(true);
      setPrice('free');
      setChargingOpeningHours('');
    } else if (poiType === 'poi') {
      setCategory('');
      setWebsite('');
      setPhoneNumber('');
      setPoiOpeningHours('');
    }
  };

  // POI speichern
  const handleSave = async () => {
    try {
      // Prüfe, ob Position und Benutzer vorhanden sind
      if (!position) {
        setError('Keine Positionsdaten verfügbar');
        return;
      }

      const user = auth.currentUser;
      if (!user) {
        setError('Du musst eingeloggt sein, um einen POI hinzuzufügen');
        return;
      }

      // Basisfelder für alle POI-Typen
      const basePoi = {
        position: {
          lat: position.lat,
          lng: position.lng
        },
        createdBy: user.uid,
        name: name.trim() === '' ? undefined : name,
        description: description.trim() === '' ? undefined : description,
        rating: rating === null ? undefined : rating
      };

      // Je nach POI-Typ den entsprechenden Service aufrufen
      if (poiType === 'repairStation') {
        await addRepairStation({
          ...basePoi,
          hasAirPump,
          hasTools,
          isPublic,
          openingHours: openingHours.trim() === '' ? undefined : openingHours
        });
      } else if (poiType === 'chargingStation') {
        await addChargingStation({
          ...basePoi,
          plugType: plugType.trim() === '' ? undefined : plugType,
          chargeSpeed,
          isPublic: isChargingPublic,
          price,
          openingHours: chargingOpeningHours.trim() === '' ? undefined : chargingOpeningHours
        });
      } else if (poiType === 'poi') {
        await addPoi({
          ...basePoi,
          category: category.trim() === '' ? undefined : category,
          website: website.trim() === '' ? undefined : website,
          phoneNumber: phoneNumber.trim() === '' ? undefined : phoneNumber,
          openingHours: poiOpeningHours.trim() === '' ? undefined : poiOpeningHours
        });
      } else {
        setError('Ungültiger POI-Typ');
        return;
      }

      // Dialog schließen und Callback aufrufen
      onClose();
      onSave();
    } catch (error) {
      console.error('Fehler beim Speichern des POI:', error);
      setError('Fehler beim Speichern des POI');
    }
  };

  // Rendere spezifische Felder je nach POI-Typ
  const renderSpecificFields = () => {
    switch (poiType) {
      case 'repairStation':
        return (
          <>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Checkbox 
                    checked={hasAirPump}
                    onChange={(e) => setHasAirPump(e.target.checked)}
                  />
                }
                label="Mit Luftpumpe"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Checkbox 
                    checked={hasTools}
                    onChange={(e) => setHasTools(e.target.checked)}
                  />
                }
                label="Mit Werkzeug"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch 
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                  />
                }
                label="Öffentlich zugänglich"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Öffnungszeiten"
                value={openingHours}
                onChange={(e) => setOpeningHours(e.target.value)}
                fullWidth
                placeholder="z.B. '24/7' oder 'Mo-Fr: 8-18 Uhr'"
                helperText="Leer lassen, wenn rund um die Uhr zugänglich"
              />
            </Grid>
          </>
        );

      case 'chargingStation':
        return (
          <>
            <Grid item xs={12}>
              <TextField
                label="Steckertyp"
                value={plugType}
                onChange={(e) => setPlugType(e.target.value)}
                fullWidth
                placeholder="z.B. 'Schuko', 'Typ 2'"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Ladegeschwindigkeit</InputLabel>
                <Select
                  value={chargeSpeed}
                  label="Ladegeschwindigkeit"
                  onChange={(e) => setChargeSpeed(e.target.value)}
                >
                  <MenuItem value="slow">Langsam (bis 3,7 kW)</MenuItem>
                  <MenuItem value="medium">Mittel (3,7-11 kW)</MenuItem>
                  <MenuItem value="fast">Schnell (über 11 kW)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch 
                    checked={isChargingPublic}
                    onChange={(e) => setIsChargingPublic(e.target.checked)}
                  />
                }
                label="Öffentlich zugänglich"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Kosten</InputLabel>
                <Select
                  value={price}
                  label="Kosten"
                  onChange={(e) => setPrice(e.target.value)}
                >
                  <MenuItem value="free">Kostenlos</MenuItem>
                  <MenuItem value="paid">Kostenpflichtig</MenuItem>
                  <MenuItem value="subscription">Mit Abo/Karte</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Öffnungszeiten"
                value={chargingOpeningHours}
                onChange={(e) => setChargingOpeningHours(e.target.value)}
                fullWidth
                placeholder="z.B. '24/7' oder 'Mo-Fr: 8-18 Uhr'"
                helperText="Leer lassen, wenn rund um die Uhr zugänglich"
              />
            </Grid>
          </>
        );

      case 'poi':
        return (
          <>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Kategorie</InputLabel>
                <Select
                  value={category}
                  label="Kategorie"
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <MenuItem value="bike_shop">Fahrradladen</MenuItem>
                  <MenuItem value="cafe">Café / Restaurant</MenuItem>
                  <MenuItem value="viewpoint">Aussichtspunkt</MenuItem>
                  <MenuItem value="warning">Gefahrenstelle</MenuItem>
                  <MenuItem value="parking">Parkmöglichkeit</MenuItem>
                  <MenuItem value="other">Sonstiges</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                fullWidth
                placeholder="z.B. 'https://example.com'"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Telefonnummer"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Öffnungszeiten"
                value={poiOpeningHours}
                onChange={(e) => setPoiOpeningHours(e.target.value)}
                fullWidth
                placeholder="z.B. 'Mo-Fr: 8-18 Uhr, Sa: 9-14 Uhr'"
              />
            </Grid>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      TransitionProps={{ onEnter: handleEnter }}
    >
      <DialogTitle>{getDialogTitle()}</DialogTitle>
      <DialogContent>
        {error && (
          <Typography color="error" variant="body2" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}

        <Grid container spacing={2} sx={{ mt: 1 }}>
          {/* Allgemeine Felder für alle POI-Typen */}
          <Grid item xs={12}>
            <TextField
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              placeholder={`Name des ${getDialogTitle().split(' ')[0]}`}
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              label="Beschreibung"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              rows={2}
              placeholder="Zusätzliche Informationen"
            />
          </Grid>
          
          {/* Rating */}
          <Grid item xs={12}>
            <Typography component="legend">Bewertung</Typography>
            <Rating
              name="poi-rating"
              value={rating}
              onChange={(event, newValue) => {
                setRating(newValue);
              }}
              precision={0.5}
            />
          </Grid>
          
          {/* Spezifische Felder je nach POI-Typ */}
          {renderSpecificFields()}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Abbrechen</Button>
        <Button onClick={handleSave} color="primary" variant="contained">
          Speichern
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default POIDialog; 