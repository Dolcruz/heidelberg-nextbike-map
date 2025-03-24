import { NextbikeStation } from './poiService';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import L from 'leaflet';

// Heidelberg: 362, München: 14
// API URL für alle Stationen, um dann nach Heidelberg zu filtern
const NEXTBIKE_API_URL = 'https://api.nextbike.net/maps/nextbike-live.json';

// Heidelberg Zentrum-Koordinaten
const HEIDELBERG_CENTER = {
  lat: 49.4093582,
  lng: 8.694724
};

// Radius um Heidelberg in km, in dem Stationen gefiltert werden sollen
const HEIDELBERG_RADIUS_KM = 15;

/**
 * Berechnet die Entfernung zwischen zwei Koordinaten mit der Haversine-Formel
 * @param lat1 Breitengrad des ersten Punkts
 * @param lon1 Längengrad des ersten Punkts
 * @param lat2 Breitengrad des zweiten Punkts
 * @param lon2 Längengrad des zweiten Punkts
 * @returns Entfernung in Kilometern
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Erdradius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Fetcht Nextbike-Stationen aus der API und filtert nach dem aktuell sichtbaren Kartenbereich
 * @param bounds Optional: Die aktuellen Kartengrenzen, um nur Stationen im sichtbaren Bereich zu laden
 * @returns Ein Array von NextbikeStation-Objekten
 */
export const fetchNextbikeStations = async (bounds?: L.LatLngBounds): Promise<NextbikeStation[]> => {
  try {
    console.log('Fetching Nextbike stations from API...');
    const response = await fetch(NEXTBIKE_API_URL);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Extrahiere alle Stationen aus der Antwort
    let allStations: any[] = [];
    
    // Sammle alle Städte für Debug-Zwecke
    const cities: {uid: number, name: string}[] = [];
    
    // Finde die Stadt Heidelberg und speichere alle Städtenamen für Debug-Zwecke
    let heidelbergCity = null;
    if (data.countries && Array.isArray(data.countries)) {
      data.countries.forEach((country: any) => {
        if (country.cities && Array.isArray(country.cities)) {
          country.cities.forEach((city: any) => {
            cities.push({uid: city.uid, name: city.name});
            
            // Heidelberg gefunden?
            if (city.name && city.name.toLowerCase().includes('heidelberg')) {
              console.log('Found city by name:', city.name, 'with ID:', city.uid);
              heidelbergCity = city;
            }
            
            // Sammle alle Stationen in einer Liste
            if (city.places && Array.isArray(city.places)) {
              allStations = [...allStations, ...city.places];
            }
          });
        }
      });
    }
    
    console.log(`Cities found: ${cities.length} sample:`, cities.slice(0, 5));
    
    // Filtere Stationen nach Entfernung zu Heidelberg
    const heidelbergStations = allStations.filter((station: any) => {
      // Verwende die bounds, wenn angegeben
      if (bounds) {
        return bounds.contains([station.lat, station.lng]);
      }
      
      // Sonst filtere nach Entfernung zu Heidelberg
      const distance = calculateDistance(
        HEIDELBERG_CENTER.lat, 
        HEIDELBERG_CENTER.lng, 
        station.lat, 
        station.lng
      );
      return distance <= HEIDELBERG_RADIUS_KM;
    });
    
    console.log(`Total Nextbike stations: ${allStations.length}, Heidelberg area stations: ${heidelbergStations.length}`);
    
    // Konvertiere die API-Stationen in NextbikeStation-Objekte
    const nextbikeStations = heidelbergStations.map((station: any) => {
      return {
        id: `nextbike-${station.uid || station.number || Math.random().toString(36).substr(2, 9)}`,
        position: {
          lat: station.lat,
          lng: station.lng
        },
        name: station.name || 'Nextbike Station',
        description: station.name || '',
        provider: 'nextbike',
        bikeCapacity: station.bikes || station.bike_racks || 0,
        isActive: station.bikes > 0,
        createdAt: new Date(),
        createdBy: 'nextbike-api',
        rating: undefined
      } as NextbikeStation;
    });
    
    console.log(`Processed ${nextbikeStations.length} Nextbike stations for map display`);
    return nextbikeStations;
  } catch (error) {
    console.error('Error fetching Nextbike stations:', error);
    return [];
  }
};

/**
 * Aktualisiert die Nextbike-Stationen in Firestore
 * Holt aktuelle Daten von der API und speichert sie in der Datenbank
 */
export const updateNextbikeStationsInFirestore = async (): Promise<void> => {
  try {
    const stations = await fetchNextbikeStations();
    
    // Speichere jede Station in Firestore
    for (const station of stations) {
      await setDoc(doc(db, 'nextbike_stations', station.id), {
        ...station,
        createdAt: new Date(), // Aktualisiere den Zeitstempel
        updatedAt: new Date()
      });
    }
    
    console.log(`Successfully updated ${stations.length} Nextbike stations in Firestore`);
  } catch (error) {
    console.error('Error updating Nextbike stations in Firestore:', error);
  }
}; 