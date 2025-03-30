import { collection, addDoc, getDocs, query, where, deleteDoc, doc, updateDoc, FieldValue, getDoc, serverTimestamp, GeoPoint } from 'firebase/firestore';
import { db } from './index';
import { User } from 'firebase/auth';
import L from 'leaflet';

// Interface für einen Fahrradständer
export interface BikeStand {
  id: string;
  position: {
    lat: number;
    lng: number;
  };
  createdAt: Date;
  createdBy: string;
  description?: string;
  capacity?: number;
  isRoofed: boolean;
  isFree: boolean;
  isLighted: boolean;
  rating?: number;
  verifications?: number; // Anzahl der Bestätigungen durch andere Benutzer
  isVerified?: boolean;   // Wurde der Fahrradständer von anderen Benutzern verifiziert?
  isAdminCreated?: boolean; // Wurde der Fahrradständer vom Admin erstellt?
  isApproved?: boolean;   // Wurde der Fahrradständer von einem Admin genehmigt?
}

/**
 * Speichert einen neuen Fahrradständer in Firebase
 */
export const saveBikeStand = async (
  position: L.LatLng,
  user: User,
  capacity?: number,
  description?: string,
  isRoofed: boolean = false,
  isFree: boolean = true,
  isLighted: boolean = false,
  rating?: number | null,
  isAdmin: boolean = false
): Promise<string> => {
  try {
    // Erstelle ein neues Dokument in der bikeStands-Sammlung
    const docRef = await addDoc(collection(db, 'bikeStands'), {
      position: {
        lat: position.lat,
        lng: position.lng
      },
      createdAt: serverTimestamp(),
      createdBy: user.uid,
      capacity,
      description,
      isRoofed,
      isFree,
      isLighted,
      rating: rating === null ? undefined : rating, // Konvertiere null zu undefined
      isAdminCreated: isAdmin, // Markiere, ob es vom Admin erstellt wurde
      isApproved: isAdmin      // Wenn vom Admin erstellt, ist es automatisch genehmigt
    });
    
    console.log('Fahrradständer erfolgreich gespeichert mit ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Fehler beim Speichern des Fahrradständers:', error);
    throw error;
  }
};

/**
 * Ruft alle genehmigten Fahrradständer ab
 */
export const getAllBikeStands = async (): Promise<BikeStand[]> => {
  try {
    // Fahrradständer abrufen, die entweder explizit genehmigt wurden oder vom Admin erstellt
    const q = query(
      collection(db, 'bikeStands')
    );
    
    const querySnapshot = await getDocs(q);
    const bikeStands: BikeStand[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      
      // Wir betrachten einen Fahrradständer als genehmigt, wenn:
      // 1. isApproved explizit auf true gesetzt ist, oder
      // 2. isAdminCreated auf true gesetzt ist, oder
      // 3. isApproved und isAdminCreated nicht definiert sind (Abwärtskompatibilität für ältere Einträge)
      const isApproved = data.isApproved === true || data.isAdminCreated === true || 
                         (data.isApproved === undefined && data.isAdminCreated === undefined);
      
      // Nur genehmigte Fahrradständer zur Liste hinzufügen
      if (isApproved) {
        bikeStands.push({
          id: doc.id,
          position: {
            lat: data.position.lat,
            lng: data.position.lng
          },
          createdAt: data.createdAt?.toDate() || new Date(),
          createdBy: data.createdBy,
          description: data.description,
          capacity: data.capacity,
          isRoofed: data.isRoofed || false,
          isFree: data.isFree !== false, // Default ist true, wenn nicht angegeben
          isLighted: data.isLighted || false,
          rating: data.rating,
          isAdminCreated: data.isAdminCreated || false,
          isApproved: true // Explizit auf true setzen, da der Eintrag genehmigt ist
        });
      }
    });
    
    return bikeStands;
  } catch (error) {
    console.error('Fehler beim Abrufen der Fahrradständer:', error);
    throw error;
  }
};

/**
 * Ruft die Fahrradständer eines bestimmten Benutzers ab
 */
export const getUserBikeStands = async (userId: string): Promise<BikeStand[]> => {
  try {
    const q = query(collection(db, 'bikeStands'), where('createdBy', '==', userId));
    const querySnapshot = await getDocs(q);
    const bikeStands: BikeStand[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      bikeStands.push({
        id: doc.id,
        position: {
          lat: data.position.lat,
          lng: data.position.lng
        },
        createdAt: data.createdAt?.toDate() || new Date(),
        createdBy: data.createdBy,
        description: data.description,
        capacity: data.capacity,
        isRoofed: data.isRoofed || false,
        isFree: data.isFree !== false,
        isLighted: data.isLighted || false,
        rating: data.rating
      });
    });
    
    return bikeStands;
  } catch (error) {
    console.error('Fehler beim Abrufen der Benutzerfährradständer:', error);
    throw error;
  }
};

/**
 * Löscht einen Fahrradständer
 */
export const deleteBikeStand = async (bikeStandId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'bikeStands', bikeStandId));
    console.log('Fahrradständer erfolgreich gelöscht.');
  } catch (error) {
    console.error('Fehler beim Löschen des Fahrradständers:', error);
    throw error;
  }
};

/**
 * Aktualisiert einen Fahrradständer
 */
export const updateBikeStand = async (
  bikeStandId: string,
  updates: {
    capacity?: number;
    description?: string;
    isRoofed?: boolean;
    isFree?: boolean;
    isLighted?: boolean;
    rating?: number | null;
  }
): Promise<void> => {
  try {
    // Konvertiere null zu undefined für das Rating
    const updatedData = {
      ...updates,
      rating: updates.rating === null ? undefined : updates.rating
    };
    
    await updateDoc(doc(db, 'bikeStands', bikeStandId), updatedData);
    console.log('Fahrradständer erfolgreich aktualisiert.');
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Fahrradständers:', error);
    throw error;
  }
};

/**
 * Bestätigt die Existenz eines Fahrradständers durch einen Benutzer
 */
export const verifyBikeStand = async (bikeStandId: string): Promise<void> => {
  try {
    const bikeStandRef = doc(db, 'bikeStands', bikeStandId);
    const bikeStandSnapshot = await getDoc(bikeStandRef);
    
    if (bikeStandSnapshot.exists()) {
      const bikeStandData = bikeStandSnapshot.data() as BikeStand;
      const newVerifications = (bikeStandData.verifications || 0) + 1;
      
      await updateDoc(bikeStandRef, {
        verifications: newVerifications,
        isVerified: newVerifications >= 3 // Setze als verifiziert, wenn mindestens 3 Bestätigungen vorhanden sind
      });
      
      console.log(`Fahrradständer ${bikeStandId} wurde bestätigt. Gesamtbestätigungen: ${newVerifications}`);
    } else {
      throw new Error(`Fahrradständer mit ID ${bikeStandId} existiert nicht`);
    }
  } catch (error) {
    console.error('Fehler beim Bestätigen des Fahrradständers:', error);
    throw error;
  }
};

// Holt alle Fahrradständer in einem bestimmten Bereich
export const getBikeStandsInBounds = async (bounds: L.LatLngBounds): Promise<BikeStand[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, 'bikeStands'));
    const bikeStands: BikeStand[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const position = {
        lat: data.position.lat,
        lng: data.position.lng
      };
      
      // Prüfe, ob der Fahrradständer innerhalb der angegebenen Grenzen liegt
      if (bounds.contains(new L.LatLng(position.lat, position.lng))) {
        bikeStands.push({
          id: doc.id,
          position: position,
          createdAt: data.createdAt?.toDate() || new Date(),
          createdBy: data.createdBy,
          description: data.description,
          capacity: data.capacity,
          isRoofed: data.isRoofed || false,
          isFree: data.isFree !== false,
          isLighted: data.isLighted || false,
          rating: data.rating
        });
      }
    });
    
    return bikeStands;
  } catch (error) {
    console.error('Fehler beim Abrufen der Fahrradständer in den Grenzen:', error);
    throw error;
  }
};

/**
 * Ruft alle Fahrradständer ab (inklusive nicht genehmigter für Admin-Zwecke)
 */
export const getAllAdminBikeStands = async (): Promise<BikeStand[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, 'bikeStands'));
    const bikeStands: BikeStand[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      bikeStands.push({
        id: doc.id,
        position: {
          lat: data.position.lat,
          lng: data.position.lng
        },
        createdAt: data.createdAt?.toDate() || new Date(),
        createdBy: data.createdBy,
        description: data.description,
        capacity: data.capacity,
        isRoofed: data.isRoofed || false,
        isFree: data.isFree !== false,
        isLighted: data.isLighted || false,
        rating: data.rating,
        isAdminCreated: data.isAdminCreated || false,
        isApproved: data.isApproved || false
      });
    });
    
    return bikeStands;
  } catch (error) {
    console.error('Fehler beim Abrufen aller Fahrradständer für Admin:', error);
    throw error;
  }
};

/**
 * Holt alle nicht freigegebenen Fahrradständer für den Admin zur Überprüfung
 */
export const getUnapprovedBikeStands = async (): Promise<BikeStand[]> => {
  try {
    // Wir suchen nach Fahrradständern, die noch nicht freigegeben sind
    const q = query(
      collection(db, 'bikeStands'), 
      where('isApproved', '==', false)
    );
    
    const querySnapshot = await getDocs(q);
    
    // Wir filtern in der Client-Anwendung statt in Firestore
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        position: {
          lat: data.position.lat,
          lng: data.position.lng
        },
        createdAt: data.createdAt?.toDate() || new Date(),
        createdBy: data.createdBy,
        description: data.description,
        capacity: data.capacity,
        isRoofed: data.isRoofed || false,
        isFree: data.isFree !== false,
        isLighted: data.isLighted || false,
        rating: data.rating,
        isAdminCreated: data.isAdminCreated || false,
        isApproved: data.isApproved || false
      };
    });
  } catch (error) {
    console.error('Fehler beim Abrufen nicht genehmigter Fahrradständer:', error);
    throw error;
  }
};

/**
 * Genehmigt oder lehnt einen Fahrradständer ab
 */
export const approveBikeStand = async (bikeStandId: string, approved: boolean): Promise<void> => {
  try {
    const bikeStandRef = doc(db, 'bikeStands', bikeStandId);
    await updateDoc(bikeStandRef, {
      isApproved: approved
    });
    console.log(`Fahrradständer ${approved ? 'genehmigt' : 'abgelehnt'}`);
  } catch (error) {
    console.error('Fehler beim Genehmigen/Ablehnen des Fahrradständers:', error);
    throw error;
  }
}; 