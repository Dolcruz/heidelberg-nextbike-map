import { collection, addDoc, getDocs, query, where, deleteDoc, doc, updateDoc, getDoc, increment, setDoc } from 'firebase/firestore';
import { db } from './index';
import { User } from 'firebase/auth';
import L from 'leaflet';
import { updateUserStatsAfterCompletion } from './userStats';

// Typdefinition für eine Fahrradroute
export interface BikeRoute {
  id?: string;
  name: string;
  description?: string;
  points: {
    lat: number;
    lng: number;
  }[];
  userId: string;
  createdAt: Date;
  timestamp?: number;
  approved?: boolean;
  status?: 'planned' | 'completed' | 'aborted';
  distance?: number;
  elevation?: {
    ascent: number;
    descent: number;
  };
  type?: 'bikePath' | 'navigation';
  roadQuality?: number; // 1-5 (Sehr gut - Sehr schlecht)
  traffic?: number; // 1-5 (Sehr gering - Sehr hoch)
  scenery?: number; // 1-5 (verschiedene Landschaftstypen)
  tags?: string[]; // Tags zur Kategorisierung
  rating?: number | null;  // Durchschnittliche Bewertung (1-5 Sterne)
  ratings?: {
    [userId: string]: number;  // Bewertungen pro Benutzer
  };
  ratingCount?: number;    // Anzahl der Bewertungen
  slope?: string | null;   // Steigung (z.B. "leicht", "mittel", "steil")
  imageUrls?: string[] | null; // URLs zu hochgeladenen Bildern
  isAdminRoute?: boolean;  // Marker für Adminrouten (für alle sichtbar)
  isApproved?: boolean;    // Marker für freigegebene Routen
  completedAt?: Date;      // Datum, wann die Route abgeschlossen wurde
  isPublic?: boolean;      // Ob die Route öffentlich ist
}

// Speichert eine neue Route in Firestore
export const saveRoute = async (
  route: L.LatLng[],
  user: User,
  name?: string,
  description?: string,
  rating?: number,
  slope?: string,
  imageUrls?: string[],
): Promise<string> => {
  try {
    // Konvertiere L.LatLng Array in einfaches Format für Firestore
    const points = route.map(point => ({
      lat: point.lat,
      lng: point.lng
    }));

    // Prüfe, ob es sich um den Admin-Account handelt
    const isAdminRoute = user.email === "pfistererfalk@gmail.com";

    // Erstelle ein Objekt ohne undefined-Werte für Firestore
    const routeData: any = {
      userId: user.uid,
      points,
      createdAt: new Date(),
      name: name || `Fahrradweg ${new Date().toLocaleDateString()}`,
      isAdminRoute: isAdminRoute,
      isApproved: isAdminRoute, // Admin-Routen sind automatisch freigegeben und für alle Nutzer sichtbar
    };

    // Nur hinzufügen, wenn nicht undefined (null ist ok für Firestore)
    if (description !== undefined) routeData.description = description;
    else routeData.description = null;
    
    if (rating !== undefined) routeData.rating = rating;
    if (slope !== undefined) routeData.slope = slope;
    if (imageUrls !== undefined && imageUrls.length > 0) routeData.imageUrls = imageUrls;

    console.log('Saving route data:', routeData);
    const docRef = await addDoc(collection(db, 'routes'), routeData);
    return docRef.id;
  } catch (error) {
    console.error('Error saving route:', error);
    throw error;
  }
};

// Aktualisiert eine bestehende Route
export const updateRoute = async (
  routeId: string,
  updates: Partial<BikeRoute>
): Promise<void> => {
  try {
    const routeRef = doc(db, 'routes', routeId);
    // Entferne undefined-Werte
    const validUpdates: any = {};
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) validUpdates[key] = value;
    });
    
    await updateDoc(routeRef, validUpdates);
  } catch (error) {
    console.error('Error updating route:', error);
    throw error;
  }
};

// Holt alle Routen eines Benutzers
export const getUserRoutes = async (userId: string): Promise<BikeRoute[]> => {
  try {
    const q = query(collection(db, 'routes'), where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data() as BikeRoute,
      createdAt: doc.data().createdAt.toDate()
    }));
  } catch (error) {
    console.error('Error fetching user routes:', error);
    throw error;
  }
};

// Holt alle freigegebenen Routen (Admin-Routen oder freigegebene Benutzer-Routen)
export const getAllApprovedRoutes = async (): Promise<BikeRoute[]> => {
  try {
    const q = query(collection(db, 'routes'), where('isApproved', '==', true));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data() as BikeRoute,
      createdAt: doc.data().createdAt.toDate()
    }));
  } catch (error) {
    console.error('Error fetching approved routes:', error);
    throw error;
  }
};

// Löscht eine Route
export const deleteRoute = async (routeId: string, userId?: string, isAdmin?: boolean): Promise<void> => {
  try {
    // Überprüfen, ob die Route existiert
    const routeRef = doc(db, 'routes', routeId);
    const routeDoc = await getDoc(routeRef);
    
    if (!routeDoc.exists()) {
      throw new Error('Route nicht gefunden');
    }
    
    // Wenn der Benutzer ein Admin ist, kann er jede Route löschen
    // Wenn nicht, kann er nur seine eigenen Routen löschen
    if (userId && !isAdmin) {
      const routeData = routeDoc.data();
      if (routeData.userId !== userId) {
        throw new Error('Keine Berechtigung zum Löschen dieser Route');
      }
    }
    
    // Route löschen
    await deleteDoc(routeRef);
    console.log('Route erfolgreich gelöscht');
  } catch (error) {
    console.error('Error deleting route:', error);
    throw error;
  }
};

// Markiert eine Route als abgeschlossen
export const markRouteAsCompleted = async (routeId: string, user: User): Promise<void> => {
  try {
    // Zuerst die Routeninformationen abrufen, um die Entfernung zu bekommen
    const routeDoc = await getDoc(doc(db, 'routes', routeId));
    if (!routeDoc.exists()) {
      throw new Error('Route nicht gefunden');
    }
    
    const routeData = routeDoc.data() as BikeRoute;
    const distance = routeData.distance || calculateRouteDistance(routeData.points);
    
    // Routenstatus aktualisieren
    await updateDoc(doc(db, 'routes', routeId), {
      status: 'completed',
      completedAt: new Date()
    });
    
    // Aktualisiere die Benutzerstatistiken
    await updateUserStatsAfterCompletion(routeId, user.uid, distance);
    
  } catch (error) {
    console.error('Error marking route as completed:', error);
    throw error;
  }
};

// Markiert eine Route als abgebrochen
export const markRouteAsAborted = async (routeId: string, user: User): Promise<void> => {
  try {
    // Routenstatus aktualisieren
    await updateDoc(doc(db, 'routes', routeId), {
      status: 'aborted'
    });
    
    // Aktualisiere die Abbruch-Zählung in den Benutzerstatistiken
    // Hier wird keine Distanz übergeben, da die Route nicht abgeschlossen wurde
    const statsRef = doc(db, 'userStats', user.uid);
    const statsDoc = await getDoc(statsRef);
    
    if (statsDoc.exists()) {
      await updateDoc(statsRef, {
        totalAborted: increment(1),
        lastUpdated: new Date()
      });
    } else {
      // Falls noch keine Statistiken existieren, erstelle einen neuen Eintrag
      await setDoc(statsRef, {
        userId: user.uid,
        totalDistance: 0,
        totalRoutes: 0,
        totalAborted: 1,
        co2Saved: 0,
        treesEquivalent: 0,
        lastUpdated: new Date(),
        streakDays: 0
      });
    }
    
  } catch (error) {
    console.error('Error marking route as aborted:', error);
    throw error;
  }
};

// Hilfsfunktion zur Berechnung der Routenlänge
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

// Funktion zum Speichern einer Navigationsroute
export const saveNavigationRoute = async (
  userId: string,
  points: Array<{lat: number; lng: number}>,
  name: string = "Navigationsroute",
  description: string = "",
): Promise<string> => {
  // Firestore-Referenz erstellen
  const routesCollection = collection(db, 'routes');
  
  // Errechne die Distanz basierend auf den Punkten
  const distance = calculateRouteDistance(points);
  
  // Neue Route-Daten erstellen mit Typ 'navigation'
  const newRoute: BikeRoute = {
    userId,
    name,
    description,
    points,
    createdAt: new Date(),
    status: 'planned', // Standardstatus für neue Navigationsrouten
    type: 'navigation', // Expliziter Typ für Navigationsrouten
    distance: distance, // Die berechnete Distanz der Route
    isPublic: false, // Navigationsrouten sind standardmäßig nicht öffentlich
  };
  
  try {
    // Route in Firestore speichern
    const docRef = await addDoc(routesCollection, newRoute);
    console.log("Navigationsroute erfolgreich gespeichert mit ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Fehler beim Speichern der Navigationsroute:", error);
    throw error;
  }
};

// Hilfsfunktion zum Berechnen der Entfernung einer Route
const calculateRouteDistance = (points: Array<{lat: number; lng: number}>): number => {
  let distance = 0;
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
    distance += R * c;
  }
  return distance;
};

// Funktion zum Aktualisieren eines Fahrradwegs
export const updateBikePath = async (
  bikePathId: string, 
  data: { 
    name?: string, 
    description?: string, 
    roadQuality?: number, 
    traffic?: number, 
    scenery?: number,
    tags?: string[]
  }
): Promise<boolean> => {
  try {
    // Überprüfen, ob nur die erlaubten Felder aktualisiert werden
    const allowedFields = ['name', 'description', 'roadQuality', 'traffic', 'scenery', 'tags'];
    const updateData: {[key: string]: any} = {};
    
    Object.keys(data).forEach(key => {
      if (allowedFields.includes(key) && data[key as keyof typeof data] !== undefined) {
        updateData[key] = data[key as keyof typeof data];
      }
    });

    // Wenn keine zu aktualisierenden Felder vorhanden sind, frühzeitig zurückkehren
    if (Object.keys(updateData).length === 0) {
      return false;
    }

    // Fahrradweg aktualisieren
    await updateDoc(doc(db, 'bikePaths', bikePathId), updateData);
    return true;
  } catch (error) {
    console.error('Error updating bike path:', error);
    return false;
  }
};

// Holt alle nicht freigegebenen Routen für den Admin zur Überprüfung
export const getUnapprovedRoutes = async (): Promise<BikeRoute[]> => {
  try {
    // Wir suchen nach Routen, die nicht vom Admin erstellt wurden und noch nicht freigegeben sind
    const q = query(
      collection(db, 'routes'), 
      where('isAdminRoute', '==', false),
      where('isApproved', '==', false)
    );
    
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data() as BikeRoute,
      createdAt: doc.data().createdAt.toDate()
    }));
  } catch (error) {
    console.error('Error fetching unapproved routes:', error);
    throw error;
  }
};

// Genehmigt oder lehnt eine Route ab
export const approveRoute = async (routeId: string, approved: boolean): Promise<void> => {
  try {
    const routeRef = doc(db, 'routes', routeId);
    await updateDoc(routeRef, {
      isApproved: approved
    });
  } catch (error) {
    console.error('Error approving/rejecting route:', error);
    throw error;
  }
};

// Bewertungsfunktion für öffentliche Fahrradwege
export const rateRoute = async (
  routeId: string,
  userId: string,
  rating: number
): Promise<void> => {
  try {
    // Zuerst Informationen zur aktuellen Route abrufen
    const routeRef = doc(db, 'routes', routeId);
    const routeDoc = await getDoc(routeRef);
    
    if (!routeDoc.exists()) {
      throw new Error('Route nicht gefunden');
    }
    
    const routeData = routeDoc.data() as BikeRoute;
    
    // Bestehende Bewertungen abrufen oder neues Objekt erstellen
    const ratings = routeData.ratings || {};
    
    // Die alte Bewertung des Benutzers abrufen (falls vorhanden)
    const oldRating = ratings[userId] || 0;
    
    // Die neue Bewertung des Benutzers setzen
    ratings[userId] = rating;
    
    // Gesamtanzahl der Bewertungen berechnen
    const ratingCount = Object.keys(ratings).length;
    
    // Durchschnittliche Bewertung berechnen
    const totalRating = Object.values(ratings).reduce((sum, r) => sum + r, 0);
    const averageRating = totalRating / ratingCount;
    
    // Route aktualisieren
    await updateDoc(routeRef, {
      ratings,
      rating: averageRating,
      ratingCount
    });
    
    console.log(`Bewertung aktualisiert: ${rating} Sterne für Route ${routeId}`);
  } catch (error) {
    console.error('Error rating route:', error);
    throw error;
  }
};

// Funktion zum Abrufen der Bewertung eines Benutzers für eine Route
export const getUserRating = async (
  routeId: string,
  userId: string
): Promise<number | null> => {
  try {
    const routeRef = doc(db, 'routes', routeId);
    const routeDoc = await getDoc(routeRef);
    
    if (!routeDoc.exists()) {
      return null;
    }
    
    const routeData = routeDoc.data() as BikeRoute;
    
    if (!routeData.ratings) {
      return null;
    }
    
    return routeData.ratings[userId] || null;
  } catch (error) {
    console.error('Error getting user rating:', error);
    return null;
  }
};

// Prüft, ob ein Benutzer Admin-Rechte hat
export const isUserAdmin = (user: User | null): boolean => {
  return user?.email === "pfistererfalk@gmail.com";
}; 