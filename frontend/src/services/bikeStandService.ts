import { db } from '../firebase/index';
import { collection, addDoc, getDocs, serverTimestamp, GeoPoint, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { BikeStand } from '../components/Map';

const BIKE_STANDS_COLLECTION = 'bikeStands';

/**
 * Fügt einen neuen Fahrradständer zur Datenbank hinzu
 * @param bikeStand Das neue Fahrradständer-Objekt
 * @returns Die ID des neu erstellten Fahrradständers
 */
export const addBikeStand = async (bikeStand: Omit<BikeStand, 'id' | 'createdAt'>): Promise<string> => {
  try {
    // Bereite Daten für Firestore vor - wandle undefined in null um
    const bikeStandData = {
      position: bikeStand.position,
      createdBy: bikeStand.createdBy,
      isRoofed: bikeStand.isRoofed || false,
      isFree: bikeStand.isFree !== false, // Default ist true
      isLighted: bikeStand.isLighted || false,
      // Für optionale Felder: undefined in null umwandeln
      description: bikeStand.description || null,
      capacity: bikeStand.capacity || null,
      rating: bikeStand.rating || null,
      createdAt: serverTimestamp(),
    };
    
    // Erstelle ein neues Dokument mit den vorbereiteten Daten
    const docRef = await addDoc(collection(db, BIKE_STANDS_COLLECTION), bikeStandData);
    
    console.log('Bike stand added with ID: ', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error adding bike stand: ', error);
    throw error;
  }
};

/**
 * Ruft alle Fahrradständer aus der Datenbank ab
 * @returns Eine Liste aller Fahrradständer
 */
export const getAllBikeStands = async (): Promise<BikeStand[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, BIKE_STANDS_COLLECTION));
    const bikeStands: BikeStand[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      bikeStands.push({
        id: doc.id,
        position: {
          lat: data.position.lat,
          lng: data.position.lng
        },
        createdBy: data.createdBy,
        createdAt: data.createdAt?.toDate() || new Date(),
        description: data.description,
        capacity: data.capacity,
        isRoofed: data.isRoofed,
        isFree: data.isFree,
        isLighted: data.isLighted,
        rating: data.rating
      });
    });
    
    return bikeStands;
  } catch (error) {
    console.error('Error getting bike stands: ', error);
    throw error;
  }
};

/**
 * Aktualisiert einen bestehenden Fahrradständer
 * @param id Die ID des zu aktualisierenden Fahrradständers
 * @param bikeStand Die zu aktualisierenden Daten
 */
export const updateBikeStand = async (id: string, bikeStand: Partial<BikeStand>): Promise<void> => {
  try {
    const bikeStandRef = doc(db, BIKE_STANDS_COLLECTION, id);
    await updateDoc(bikeStandRef, bikeStand);
    console.log('Bike stand updated successfully');
  } catch (error) {
    console.error('Error updating bike stand: ', error);
    throw error;
  }
};

/**
 * Löscht einen Fahrradständer aus der Datenbank
 * @param id Die ID des zu löschenden Fahrradständers
 */
export const deleteBikeStand = async (id: string): Promise<void> => {
  try {
    const bikeStandRef = doc(db, BIKE_STANDS_COLLECTION, id);
    await deleteDoc(bikeStandRef);
    console.log('Bike stand deleted successfully');
  } catch (error) {
    console.error('Error deleting bike stand: ', error);
    throw error;
  }
};

/**
 * Ruft einen bestimmten Fahrradständer anhand seiner ID ab
 * @param id Die ID des gesuchten Fahrradständers
 * @returns Das Fahrradständer-Objekt oder null, wenn es nicht gefunden wurde
 */
export const getBikeStandById = async (id: string): Promise<BikeStand | null> => {
  try {
    const bikeStandRef = doc(db, BIKE_STANDS_COLLECTION, id);
    const bikeStandDoc = await getDoc(bikeStandRef);
    
    if (!bikeStandDoc.exists()) {
      console.log('No bike stand found with ID: ', id);
      return null;
    }
    
    const data = bikeStandDoc.data();
    return {
      id: bikeStandDoc.id,
      position: {
        lat: data.position.lat,
        lng: data.position.lng
      },
      createdBy: data.createdBy,
      createdAt: data.createdAt?.toDate() || new Date(),
      description: data.description,
      capacity: data.capacity,
      isRoofed: data.isRoofed,
      isFree: data.isFree,
      isLighted: data.isLighted,
      rating: data.rating
    };
  } catch (error) {
    console.error('Error getting bike stand: ', error);
    throw error;
  }
}; 