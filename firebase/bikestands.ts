/**
 * Holt alle nicht freigegebenen Fahrradständer für den Admin zur Überprüfung
 */
export const getUnapprovedBikeStands = async (): Promise<BikeStand[]> => {
  try {
    // Alle Fahrradständer abrufen und clientseitig filtern
    const querySnapshot = await getDocs(collection(db, 'bikeStands'));
    
    const bikeStands: BikeStand[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      
      // Ein Fahrradständer gilt als "nicht genehmigt", wenn:
      // - isApproved explizit auf false gesetzt ist, oder
      // - isApproved nicht definiert und nicht vom Admin erstellt ist
      const isNotApproved = data.isApproved === false || 
                           (data.isApproved === undefined && data.isAdminCreated !== true);
      
      if (isNotApproved) {
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
      }
    });
    
    return bikeStands;
  } catch (error) {
    console.error('Fehler beim Abrufen nicht genehmigter Fahrradständer:', error);
    throw error;
  }
}; 