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
  Typography,
  Rating,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid
} from '@mui/material';
import L from 'leaflet';
import { auth } from '../firebase/index';
import { addBikeStand } from '../services/bikeStandService';

// Eigenschaften für den BikeStandDialog
interface BikeStandDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  position: L.LatLng | null;
}

/**
 * Dialog-Komponente zum Hinzufügen eines neuen Fahrradständers
 */
const BikeStandDialog: React.FC<BikeStandDialogProps> = ({ open, onClose, onSave, position }) => {
  // State für die Fahrradständer-Eigenschaften
  const [description, setDescription] = useState('');
  const [capacity, setCapacity] = useState<number | ''>('');
  const [isRoofed, setIsRoofed] = useState(false);
  const [isFree, setIsFree] = useState(true);
  const [isLighted, setIsLighted] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [error, setError] = useState('');

  // Beim Öffnen des Dialogs den State zurücksetzen
  const handleEnter = () => {
    setDescription('');
    setCapacity('');
    setIsRoofed(false);
    setIsFree(true);
    setIsLighted(false);
    setRating(null);
    setError('');
  };

  // Fahrradständer speichern
  const handleSave = async () => {
    try {
      // Prüfe, ob alle erforderlichen Felder ausgefüllt sind
      if (!position) {
        setError('No position data available');
        return;
      }

      const user = auth.currentUser;
      if (!user) {
        setError('You must be logged in to add a bike stand');
        return;
      }

      // Neue Fahrradständer-Daten erstellen
      const bikeStandData = {
        position: {
          lat: position.lat,
          lng: position.lng
        },
        createdBy: user.uid,
        description: description.trim() === '' ? undefined : description,
        capacity: capacity === '' ? undefined : Number(capacity),
        isRoofed,
        isFree,
        isLighted,
        rating: rating === null ? undefined : rating
      };

      // Fahrradständer zur Datenbank hinzufügen
      await addBikeStand(bikeStandData);
      
      // Dialog schließen und Callback aufrufen
      onClose();
      onSave();
    } catch (error) {
      console.error('Error saving bike stand:', error);
      setError('Failed to save bike stand');
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
      <DialogTitle>Fahrradständer hinzufügen</DialogTitle>
      <DialogContent>
        {error && (
          <Typography color="error" variant="body2" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}

        <Grid container spacing={2} sx={{ mt: 1 }}>
          {/* Beschreibung */}
          <Grid item xs={12}>
            <TextField
              label="Beschreibung"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              rows={2}
              placeholder="z.B. 'Vor dem Bahnhof', 'Neben dem Eingang'"
            />
          </Grid>

          {/* Kapazität */}
          <Grid item xs={12}>
            <TextField
              label="Kapazität (Anzahl der Fahrräder)"
              type="number"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value === '' ? '' : Number(e.target.value))}
              fullWidth
              inputProps={{ min: 1 }}
            />
          </Grid>

          {/* Eigenschaften als Checkboxen */}
          <Grid item xs={12} sm={4}>
            <FormControlLabel
              control={
                <Checkbox 
                  checked={isRoofed}
                  onChange={(e) => setIsRoofed(e.target.checked)}
                />
              }
              label="Überdacht"
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <FormControlLabel
              control={
                <Checkbox 
                  checked={isFree}
                  onChange={(e) => setIsFree(e.target.checked)}
                />
              }
              label="Kostenlos"
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <FormControlLabel
              control={
                <Checkbox 
                  checked={isLighted}
                  onChange={(e) => setIsLighted(e.target.checked)}
                />
              }
              label="Beleuchtet"
            />
          </Grid>

          {/* Bewertung */}
          <Grid item xs={12}>
            <Typography component="legend">Qualität des Fahrradständers</Typography>
            <Rating
              name="bike-stand-rating"
              value={rating}
              onChange={(event, newValue) => {
                setRating(newValue);
              }}
              precision={0.5}
            />
          </Grid>
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

export default BikeStandDialog; 