import { doc, getDoc, setDoc, updateDoc, increment, Timestamp, FieldValue } from 'firebase/firestore';
import { db } from './index';
import { User } from 'firebase/auth';

// Interface für Benutzerstatistiken mit Erweiterungen für Achievements, XP usw.
export interface UserStats {
  userId: string;
  totalDistance: number;      // Gesamtstrecke in Kilometern
  totalRoutes: number;        // Anzahl der abgeschlossenen Routen
  totalAborted: number;       // Anzahl der abgebrochenen Routen
  co2Saved: number;           // Eingesparte CO2-Emissionen in kg
  treesEquivalent: number;    // Äquivalent in Bäumen
  lastUpdated: Date | Timestamp;          // Letztes Update der Statistiken
  streakDays: number;         // Anzahl der Tage in Folge mit Fahrradfahrten
  lastRideDate?: Date | Timestamp;        // Datum der letzten Fahrt
  caloriesBurned?: number;
  achievements?: string[]; // Liste der erreichten Achievements
  xp?: number;             // Erfahrungspunkte des Benutzers
  level?: number;          // Level des Benutzers
}

// Interface für Firestore-Daten mit Timestamp
interface FirestoreUserStats extends Omit<UserStats, 'lastUpdated' | 'lastRideDate'> {
  lastUpdated: Timestamp;
  lastRideDate?: Timestamp;
}

// CO2-Einsparung pro Kilometer im Vergleich zum Auto (in kg)
// Durchschnittlicher PKW: ~150g CO2 pro km
const CO2_SAVINGS_PER_KM = 0.15;

// Ein Baum bindet durchschnittlich ~20kg CO2 pro Jahr
const CO2_PER_TREE_PER_YEAR = 20;

// Initialisiert oder holt die Benutzerstatistiken
export const getUserStats = async (user: User | string): Promise<UserStats | null> => {
  try {
    const userId = typeof user === 'string' ? user : user.uid;
    const statsRef = doc(db, 'userStats', userId);
    const statsDoc = await getDoc(statsRef);
    
    if (statsDoc.exists()) {
      const data = statsDoc.data() as UserStats;
      
      // Anwendungslogik für CO2-Einsparung (wenn nicht bereits gespeichert)
      if (!data.co2Saved && data.totalDistance) {
        data.co2Saved = data.totalDistance * 0.15; // 150g CO2 pro km gespart (im Vergleich zum Auto)
      }
      
      // Kalorien berechnen, wenn noch nicht gespeichert
      if (!data.caloriesBurned && data.totalDistance) {
        data.caloriesBurned = data.totalDistance * 40; // ca. 40 Kalorien pro km beim Radfahren
      }
      
      // XP berechnen, wenn noch nicht gespeichert
      if (!data.xp && data.totalDistance) {
        data.xp = data.totalDistance * 10; // 10 XP pro km
      }
      
      // Level berechnen, wenn noch nicht gespeichert
      if (!data.level && data.totalDistance) {
        data.level = Math.floor(Math.sqrt(data.totalDistance / 5)) + 1; // Einfache Level-Formel
      }
      
      // Achievements überprüfen
      if (!data.achievements) {
        data.achievements = [];
      }
      
      // Achievements berechnen basierend auf Statistiken
      const newAchievements = calculateAchievements(data);
      
      // Wenn neue Achievements gefunden wurden, aktualisiere den Firestore-Eintrag
      if (newAchievements.length > 0) {
        // Erstelle ein neues Array anstatt Set zu verwenden
        const uniqueAchievements: string[] = [];
        const allAchievements = [...data.achievements, ...newAchievements];
        allAchievements.forEach(a => {
          if (!uniqueAchievements.includes(a)) {
            uniqueAchievements.push(a);
          }
        });
        
        await updateDoc(statsRef, { 
          achievements: uniqueAchievements,
          // Aktualisiere auch die anderen berechneten Werte
          co2Saved: data.co2Saved,
          caloriesBurned: data.caloriesBurned,
          xp: data.xp,
          level: data.level
        });
        
        data.achievements = uniqueAchievements;
      }
      
      return data;
    }
    
    // Wenn keine Statistiken gefunden wurden, erstelle einen neuen Eintrag mit Standardwerten
    const defaultStats: UserStats = {
      userId,
      totalDistance: 0,
      totalRoutes: 0,
      totalAborted: 0,
      co2Saved: 0,
      treesEquivalent: 0,
      lastUpdated: new Date(),
      streakDays: 0,
      caloriesBurned: 0,
      achievements: [],
      xp: 0,
      level: 1
    };
    
    await setDoc(statsRef, defaultStats);
    return defaultStats;
  } catch (error) {
    console.error('Error getting user stats:', error);
    return null;
  }
};

// Funktion zur Berechnung der Achievements basierend auf den Benutzerstatistiken
const calculateAchievements = (stats: UserStats): string[] => {
  const newAchievements: string[] = [];
  
  // Erste Fahrt
  if (stats.totalRoutes > 0 && !stats.achievements?.includes('first_ride')) {
    newAchievements.push('first_ride');
  }
  
  // Distanz-Achievements
  if (stats.totalDistance >= 10 && !stats.achievements?.includes('distance_10')) {
    newAchievements.push('distance_10');
  }
  
  if (stats.totalDistance >= 50 && !stats.achievements?.includes('distance_50')) {
    newAchievements.push('distance_50');
  }
  
  if (stats.totalDistance >= 100 && !stats.achievements?.includes('distance_100')) {
    newAchievements.push('distance_100');
  }
  
  // CO2-Einsparungen
  if (stats.co2Saved >= 5 && !stats.achievements?.includes('eco_warrior')) {
    newAchievements.push('eco_warrior');
  }
  
  // Kalorien verbrannt
  if (stats.caloriesBurned && stats.caloriesBurned >= 2000 && !stats.achievements?.includes('calorie_burner')) {
    newAchievements.push('calorie_burner');
  }
  
  // Streak-Achievements
  if (stats.streakDays >= 3 && !stats.achievements?.includes('streak_3')) {
    newAchievements.push('streak_3');
  }
  
  if (stats.streakDays >= 7 && !stats.achievements?.includes('streak_7')) {
    newAchievements.push('streak_7');
  }
  
  return newAchievements;
};

// Aktualisiert die Benutzerstatistiken nach Abschluss einer Route
export const updateUserStatsAfterCompletion = async (
  routeId: string, 
  userId: string, 
  distance: number
): Promise<void> => {
  try {
    // Hole vorhandene Benutzerstatistiken
    const currentStats = await getUserStats(userId);
    
    // Stelle sicher, dass die Statistiken existieren
    if (!currentStats) {
      throw new Error('Benutzerstatistiken konnten nicht geladen werden');
    }
    
    // Aktualisiere die CO2-Einsparung (150g CO2 pro km verglichen mit Autofahren)
    const co2Saved = distance * 0.15;
    const treesEquivalent = co2Saved / 21; // Ein Baum bindet ca. 21kg CO2 pro Jahr
    
    // Berechne Streak
    let streakDays = currentStats.streakDays;
    const now = new Date();
    const lastRideDate = currentStats.lastRideDate 
      ? (currentStats.lastRideDate instanceof Date 
        ? currentStats.lastRideDate 
        : (currentStats.lastRideDate as Timestamp).toDate())
      : null;
    
    // Prüfe, ob die letzte Fahrt gestern oder früher heute war
    if (lastRideDate) {
      const lastRideDay = new Date(lastRideDate);
      lastRideDay.setHours(0, 0, 0, 0);
      
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (lastRideDay.getTime() === yesterday.getTime()) {
        // Letzte Fahrt war gestern, Streak erhöhen
        streakDays += 1;
      } else if (lastRideDay.getTime() === today.getTime()) {
        // Letzte Fahrt war heute, Streak bleibt unverändert
      } else {
        // Letzte Fahrt war früher als gestern, Streak zurücksetzen
        streakDays = 1;
      }
    } else {
      // Erste Fahrt überhaupt
      streakDays = 1;
    }
    
    // Statistiken aktualisieren
    const statsRef = doc(db, 'userStats', userId);
    const statsDoc = await getDoc(statsRef);
    
    // Berechne die Kalorien, die durch das Radfahren verbrannt wurden (ca. 40 kcal pro km)
    const caloriesBurned = distance * 40;
    
    // Berechne XP (10 XP pro km)
    const xp = distance * 10;
    
    // Berechne neues Level basierend auf der Gesamtstrecke
    const totalDistance = currentStats.totalDistance + distance;
    const level = Math.floor(Math.sqrt(totalDistance / 5)) + 1;
    
    if (statsDoc.exists()) {
      // Update bestehender Eintrag
      await updateDoc(statsRef, {
        totalDistance: increment(distance),
        totalRoutes: increment(1),
        co2Saved: increment(co2Saved),
        treesEquivalent: increment(treesEquivalent),
        lastUpdated: now,
        streakDays: streakDays,
        lastRideDate: now,
        caloriesBurned: increment(caloriesBurned),
        xp: increment(xp),
        level: level
      });
    } else {
      // Falls noch kein Eintrag existiert (sollte nicht vorkommen)
      await setDoc(statsRef, {
        userId,
        totalDistance: distance,
        totalRoutes: 1,
        totalAborted: 0,
        co2Saved: co2Saved,
        treesEquivalent: treesEquivalent,
        lastUpdated: now,
        streakDays: 1,
        lastRideDate: now,
        caloriesBurned: caloriesBurned,
        achievements: ['first_ride'], // Erstes Achievement für die erste Fahrt
        xp: xp,
        level: level
      });
    }
  } catch (error) {
    console.error('Error updating user stats:', error);
    throw error;
  }
};

// Berechnet interessante Fakten basierend auf den CO2-Einsparungen
export const calculateEnvironmentalFacts = (co2Saved: number): { [key: string]: string } => {
  return {
    carKm: `${(co2Saved / CO2_SAVINGS_PER_KM).toFixed(1)} km Autofahrt eingespart`,
    trees: `Entspricht der jährlichen CO2-Bindung von ${(co2Saved / CO2_PER_TREE_PER_YEAR).toFixed(1)} Bäumen`,
    flights: `Entspricht etwa ${(co2Saved / 200).toFixed(2)} Flügen von Berlin nach München`,
    smartphone: `Entspricht der Herstellung von etwa ${(co2Saved / 60).toFixed(0)} Smartphones`,
    coffee: `Entspricht dem CO2-Fußabdruck von etwa ${(co2Saved / 0.5).toFixed(0)} Tassen Kaffee`
  };
}; 