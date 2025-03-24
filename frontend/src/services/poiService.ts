import { db } from '../firebase/index';
import { collection, addDoc, getDocs, serverTimestamp, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';

// Basis-Schnittstelle für alle POI-Typen
export interface BasePOI {
  id: string;
  position: {
    lat: number;
    lng: number;
  };
  createdAt: Date;
  createdBy: string;
  description?: string;
  name?: string;
  rating?: number;
}

// Nextbike-Station
export interface NextbikeStation extends BasePOI {
  bikeCapacity?: number;
  isActive?: boolean;
  provider?: string; // "nextbike", "velo", etc.
}

// Reparatur-Station
export interface RepairStation extends BasePOI {
  hasAirPump?: boolean;
  hasTools?: boolean;
  isPublic?: boolean;
  openingHours?: string;
}

// E-Bike-Ladestation
export interface ChargingStation extends BasePOI {
  plugType?: string; // Typ des Ladesteckers
  chargeSpeed?: string; // "slow", "medium", "fast"
  isPublic?: boolean;
  price?: string; // "free", "paid", "subscription"
  openingHours?: string;
}

// Allgemeiner POI
export interface POI extends BasePOI {
  category?: string; // z.B. "bike_shop", "cafe", "viewpoint"
  website?: string;
  phoneNumber?: string;
  openingHours?: string;
}

// Collection-Namen für Firebase
const POI_COLLECTION = 'pois';
const NEXTBIKE_COLLECTION = 'nextbikeStations';
const REPAIR_COLLECTION = 'repairStations';
const CHARGING_COLLECTION = 'chargingStations';

// Generische Funktion zum Hinzufügen eines POI
async function addPOI<T extends Omit<BasePOI, 'id' | 'createdAt'>>(
  poi: T, 
  collectionName: string
): Promise<string> {
  try {
    // Vorbereiten der Daten, indem undefined in null umgewandelt wird
    const poiData = Object.entries(poi).reduce((acc, [key, value]) => {
      acc[key] = value === undefined ? null : value;
      return acc;
    }, {} as Record<string, any>);

    // Hinzufügen von createdAt
    poiData.createdAt = serverTimestamp();

    // Dokument zur Collection hinzufügen
    const docRef = await addDoc(collection(db, collectionName), poiData);
    console.log(`${collectionName} added with ID: `, docRef.id);
    return docRef.id;
  } catch (error) {
    console.error(`Error adding ${collectionName}:`, error);
    throw error;
  }
}

// Generische Funktion zum Abrufen aller POIs eines bestimmten Typs
async function getAllPOIs<T extends BasePOI>(collectionName: string): Promise<T[]> {
  try {
    const querySnapshot = await getDocs(collection(db, collectionName));
    const pois: T[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const poi = {
        id: doc.id,
        position: {
          lat: data.position.lat,
          lng: data.position.lng
        },
        createdBy: data.createdBy,
        createdAt: data.createdAt?.toDate() || new Date(),
        ...Object.entries(data)
          .filter(([key]) => !['id', 'position', 'createdBy', 'createdAt'].includes(key))
          .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {})
      } as T;

      pois.push(poi);
    });

    return pois;
  } catch (error) {
    console.error(`Error getting ${collectionName}:`, error);
    throw error;
  }
}

// Generische Funktion zum Löschen eines POI
async function deletePOI(id: string, collectionName: string): Promise<void> {
  try {
    await deleteDoc(doc(db, collectionName, id));
    console.log(`${collectionName} deleted with ID: ${id}`);
  } catch (error) {
    console.error(`Error deleting ${collectionName}:`, error);
    throw error;
  }
}

// Generische Funktion zum Aktualisieren eines POI
async function updatePOI<T extends Partial<BasePOI>>(
  id: string, 
  poi: T, 
  collectionName: string
): Promise<void> {
  try {
    // Vorbereiten der Daten, indem undefined in null umgewandelt wird
    const poiData = Object.entries(poi).reduce((acc, [key, value]) => {
      acc[key] = value === undefined ? null : value;
      return acc;
    }, {} as Record<string, any>);

    await updateDoc(doc(db, collectionName, id), poiData);
    console.log(`${collectionName} updated with ID: ${id}`);
  } catch (error) {
    console.error(`Error updating ${collectionName}:`, error);
    throw error;
  }
}

// Generische Funktion zum Abrufen eines einzelnen POI
async function getPOIById<T extends BasePOI>(
  id: string, 
  collectionName: string
): Promise<T | null> {
  try {
    const docRef = doc(db, collectionName, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      console.log(`No ${collectionName} found with ID: ${id}`);
      return null;
    }

    const data = docSnap.data();
    return {
      id: docSnap.id,
      position: {
        lat: data.position.lat,
        lng: data.position.lng
      },
      createdBy: data.createdBy,
      createdAt: data.createdAt?.toDate() || new Date(),
      ...Object.entries(data)
        .filter(([key]) => !['id', 'position', 'createdBy', 'createdAt'].includes(key))
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {})
    } as T;
  } catch (error) {
    console.error(`Error getting ${collectionName}:`, error);
    throw error;
  }
}

// Spezifische Funktionen für Nextbike-Stationen
export const addNextbikeStation = (
  nextbike: Omit<NextbikeStation, 'id' | 'createdAt'>
): Promise<string> => addPOI(nextbike, NEXTBIKE_COLLECTION);

export const getAllNextbikeStations = (): Promise<NextbikeStation[]> => 
  getAllPOIs<NextbikeStation>(NEXTBIKE_COLLECTION);

export const getNextbikeStationById = (id: string): Promise<NextbikeStation | null> => 
  getPOIById<NextbikeStation>(id, NEXTBIKE_COLLECTION);

export const updateNextbikeStation = (
  id: string, 
  nextbike: Partial<NextbikeStation>
): Promise<void> => updatePOI(id, nextbike, NEXTBIKE_COLLECTION);

export const deleteNextbikeStation = (id: string): Promise<void> => 
  deletePOI(id, NEXTBIKE_COLLECTION);

// Spezifische Funktionen für Reparatur-Stationen
export const addRepairStation = (
  repairStation: Omit<RepairStation, 'id' | 'createdAt'>
): Promise<string> => addPOI(repairStation, REPAIR_COLLECTION);

export const getAllRepairStations = (): Promise<RepairStation[]> => 
  getAllPOIs<RepairStation>(REPAIR_COLLECTION);

export const getRepairStationById = (id: string): Promise<RepairStation | null> => 
  getPOIById<RepairStation>(id, REPAIR_COLLECTION);

export const updateRepairStation = (
  id: string, 
  repairStation: Partial<RepairStation>
): Promise<void> => updatePOI(id, repairStation, REPAIR_COLLECTION);

export const deleteRepairStation = (id: string): Promise<void> => 
  deletePOI(id, REPAIR_COLLECTION);

// Spezifische Funktionen für E-Bike-Ladestationen
export const addChargingStation = (
  chargingStation: Omit<ChargingStation, 'id' | 'createdAt'>
): Promise<string> => addPOI(chargingStation, CHARGING_COLLECTION);

export const getAllChargingStations = (): Promise<ChargingStation[]> => 
  getAllPOIs<ChargingStation>(CHARGING_COLLECTION);

export const getChargingStationById = (id: string): Promise<ChargingStation | null> => 
  getPOIById<ChargingStation>(id, CHARGING_COLLECTION);

export const updateChargingStation = (
  id: string, 
  chargingStation: Partial<ChargingStation>
): Promise<void> => updatePOI(id, chargingStation, CHARGING_COLLECTION);

export const deleteChargingStation = (id: string): Promise<void> => 
  deletePOI(id, CHARGING_COLLECTION);

// Spezifische Funktionen für allgemeine POIs
export const addPoi = (
  poi: Omit<POI, 'id' | 'createdAt'>
): Promise<string> => addPOI(poi, POI_COLLECTION);

export const getAllPois = (): Promise<POI[]> => 
  getAllPOIs<POI>(POI_COLLECTION);

export const getPoiById = (id: string): Promise<POI | null> => 
  getPOIById<POI>(id, POI_COLLECTION);

export const updatePoi = (
  id: string, 
  poi: Partial<POI>
): Promise<void> => updatePOI(id, poi, POI_COLLECTION);

export const deletePoi = (id: string): Promise<void> => 
  deletePOI(id, POI_COLLECTION); 