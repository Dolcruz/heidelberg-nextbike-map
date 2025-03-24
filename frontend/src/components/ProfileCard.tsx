import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Avatar,
  Typography,
  Box,
  Divider,
  Chip,
  Grid,
  LinearProgress,
  Dialog,
  Button,
  IconButton,
  Tab,
  Tabs,
  CircularProgress
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DirectionsBikeIcon from '@mui/icons-material/DirectionsBike';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import LocalFloristIcon from '@mui/icons-material/LocalFlorist';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import { User } from 'firebase/auth';
import { getUserStats, UserStats } from '../firebase/userStats';
import PublicIcon from '@mui/icons-material/Public';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import FilterDramaIcon from '@mui/icons-material/FilterDrama';
import ForestIcon from '@mui/icons-material/Forest';
import StarIcon from '@mui/icons-material/Star';

// Definition für erweiterte Benutzerstatistiken mit UI-spezifischen Daten
interface ExtendedUserStats extends UserStats {
  caloriesBurned: number;
  xp: number;
  level: number;
  xpToNextLevel: number;
  achievements: string[];
}

// Achievements-Definitionen
interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  unlocked: boolean;
  progress?: number;
  maxProgress?: number;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`profile-tabpanel-${index}`}
      aria-labelledby={`profile-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

interface ProfileCardProps {
  open: boolean;
  onClose: () => void;
  user: User | null;
}

const ProfileCard: React.FC<ProfileCardProps> = ({ open, onClose, user }) => {
  const [tabValue, setTabValue] = useState(0);
  const [stats, setStats] = useState<ExtendedUserStats | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && open) {
      fetchUserStats();
    }
  }, [user, open]);

  // Funktion zum Abrufen der Benutzerstatistiken
  const fetchUserStats = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const userStats = await getUserStats(user);
      
      if (!userStats) {
        // Standardwerte setzen, wenn keine Statistiken gefunden wurden
        const defaultStats: ExtendedUserStats = {
          userId: user.uid,
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
          level: 1,
          xpToNextLevel: 100
        };
        setStats(defaultStats);
        // Auch mit Standardwerten die Achievements aktualisieren
        updateAchievements(defaultStats);
      } else {
        // Berechne einige Werte, falls sie nicht in den Daten enthalten sind
        const caloriesBurned = userStats.caloriesBurned || userStats.totalDistance * 40;
        const xp = userStats.xp || userStats.totalDistance * 10;
        const level = userStats.level || Math.floor(Math.sqrt(userStats.totalDistance / 5)) + 1;
        
        // XP bis zum nächsten Level (quadratische Progression)
        const nextLevel = level + 1;
        const xpForNextLevel = Math.pow(nextLevel - 1, 2) * 5 * 10;
        
        const extendedStats: ExtendedUserStats = {
          ...userStats,
          caloriesBurned,
          xp,
          level,
          xpToNextLevel: xpForNextLevel,
          achievements: userStats.achievements || []
        };
        
        setStats(extendedStats);
        // Achievements mit den erweiterten Statistiken aktualisieren
        updateAchievements(extendedStats);
      }
    } catch (error) {
      console.error("Fehler beim Abrufen der Benutzerstatistiken:", error);
      // Auch bei Fehler Standardwerte setzen und Achievements anzeigen
      const defaultStats: ExtendedUserStats = {
        userId: user.uid,
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
        level: 1,
        xpToNextLevel: 100
      };
      setStats(defaultStats);
      updateAchievements(defaultStats);
    } finally {
      setLoading(false);
    }
  };

  // Achievements basierend auf den Statistiken aktualisieren
  const updateAchievements = (currentStats?: ExtendedUserStats) => {
    // Verwende entweder die übergebenen Statistiken oder die aktuellen Statistiken
    const statsToUse = currentStats || stats;
    
    // Wenn keine Statistiken verfügbar sind, zeige leere Achievements an
    if (!statsToUse) {
      setAchievements([]);
      return;
    }

    // Funktion zur Formatierung der Zahlenwerte mit einer Nachkommastelle
    const formatNumber = (num: number): number => {
      // Auf eine Nachkommastelle runden
      return Math.round(num * 10) / 10;
    };

    const newAchievements: Achievement[] = [
      {
        id: 'first_route',
        title: 'Erste Schritte',
        description: 'Erste Fahrradroute abgeschlossen',
        icon: <DirectionsBikeIcon color="primary" />,
        unlocked: statsToUse.totalRoutes > 0,
        progress: formatNumber(Math.min(statsToUse.totalRoutes, 1)),
        maxProgress: 1
      },
      {
        id: 'distance_10',
        title: 'Kleiner Ausflug',
        description: '10 Kilometer gefahren',
        icon: <DirectionsBikeIcon color="primary" />,
        unlocked: statsToUse.totalDistance >= 10,
        progress: formatNumber(Math.min(statsToUse.totalDistance, 10)),
        maxProgress: 10
      },
      {
        id: 'distance_100',
        title: 'Tagestourer',
        description: '100 Kilometer gefahren',
        icon: <DirectionsBikeIcon color="secondary" />,
        unlocked: statsToUse.totalDistance >= 100,
        progress: formatNumber(Math.min(statsToUse.totalDistance, 100)),
        maxProgress: 100
      },
      {
        id: 'distance_500',
        title: 'Langstreckenfahrer',
        description: '500 Kilometer gefahren',
        icon: <TrendingUpIcon />,
        unlocked: statsToUse.totalDistance >= 500,
        progress: formatNumber(Math.min(statsToUse.totalDistance, 500)),
        maxProgress: 500
      },
      {
        id: 'around_world',
        title: 'Around the World',
        description: 'Äquatorumfang von 40.075 km gefahren',
        icon: <PublicIcon />,
        unlocked: statsToUse.totalDistance >= 40075,
        progress: formatNumber(Math.min(statsToUse.totalDistance, 40075)),
        maxProgress: 40075
      },
      {
        id: 'co2_saved_10',
        title: 'Klimaschützer',
        description: '10 kg CO₂ eingespart',
        icon: <FilterDramaIcon />,
        unlocked: statsToUse.co2Saved >= 10,
        progress: formatNumber(Math.min(statsToUse.co2Saved, 10)),
        maxProgress: 10
      },
      {
        id: 'co2_saved_100',
        title: 'Umweltheld',
        description: '100 kg CO₂ eingespart',
        icon: <LocalFireDepartmentIcon />,
        unlocked: statsToUse.co2Saved >= 100,
        progress: formatNumber(Math.min(statsToUse.co2Saved, 100)),
        maxProgress: 100
      },
      {
        id: 'co2_saved_500',
        title: 'Naturschützer',
        description: '500 kg CO₂ eingespart',
        icon: <ForestIcon />,
        unlocked: statsToUse.co2Saved >= 500,
        progress: formatNumber(Math.min(statsToUse.co2Saved, 500)),
        maxProgress: 500
      },
      {
        id: 'routes_10',
        title: 'Routensammler',
        description: '10 Fahrradrouten abgeschlossen',
        icon: <StarIcon />,
        unlocked: statsToUse.totalRoutes >= 10,
        progress: formatNumber(Math.min(statsToUse.totalRoutes, 10)),
        maxProgress: 10
      }
    ];

    setAchievements(newAchievements);
  };

  // Berechnet den Fortschritt in Prozent für die XP-Anzeige
  const calculateXpProgress = () => {
    if (!stats) return 0;
    
    const currentLevelXp = Math.pow(stats.level - 1, 2) * 5 * 10;
    const xpInCurrentLevel = stats.xp - currentLevelXp;
    const xpNeededForNextLevel = stats.xpToNextLevel - currentLevelXp;
    
    return (xpInCurrentLevel / xpNeededForNextLevel) * 100;
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  if (!user) {
    return null;
  }

  // Berechne einige Statistiken
  const completedAchievements = achievements.filter(achievement => achievement.unlocked).length;
  const totalAchievements = achievements.length;
  
  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2, overflow: 'visible' }
      }}
    >
      <Box 
        sx={{ 
          position: 'relative',
          bgcolor: 'background.paper',
          borderRadius: 2,
          boxShadow: 3
        }}
      >
        {/* Header mit Benutzerinfo */}
        <Box
          sx={{
            bgcolor: 'primary.main',
            color: 'white',
            p: 2,
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
            position: 'relative'
          }}
        >
          <IconButton
            onClick={onClose}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: 'white'
            }}
          >
            <CloseIcon />
          </IconButton>
          
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Avatar
              src={user.photoURL || undefined}
              alt={user.displayName || 'Benutzer'}
              sx={{ width: 64, height: 64, mr: 2, border: '2px solid white' }}
            />
            <Box>
              <Typography variant="h5" component="div" fontWeight="bold">
                {user.displayName || user.email?.split('@')[0]}
              </Typography>
              <Typography variant="body2">
                {user.email}
              </Typography>
            </Box>
          </Box>
          
          {/* Level und XP-Fortschritt */}
          {stats && (
            <Box sx={{ mt: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Typography variant="body2">
                  Level {stats.level}
                </Typography>
                <Typography variant="body2">
                  {Math.floor(calculateXpProgress())}% zum Level {stats.level + 1}
                </Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={calculateXpProgress()} 
                sx={{ 
                  height: 10, 
                  borderRadius: 5,
                  backgroundColor: 'rgba(255,255,255,0.3)',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: '#4CAF50'
                  }
                }} 
              />
            </Box>
          )}
        </Box>

        <Tabs value={tabValue} onChange={handleTabChange} centered>
          <Tab label="Statistiken" />
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography>Achievements</Typography>
                {stats && (
                  <Chip 
                    label={`${completedAchievements}/${totalAchievements}`} 
                    size="small" 
                    color="primary" 
                    sx={{ ml: 1 }} 
                  />
                )}
              </Box>
            } 
          />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          {stats ? (
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={4}>
                <Box sx={{ textAlign: 'center', p: 1 }}>
                  <Typography variant="h5" color="primary" fontWeight="bold">
                    {stats.totalDistance.toFixed(1)} km
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Zurückgelegte Strecke
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box sx={{ textAlign: 'center', p: 1 }}>
                  <Typography variant="h5" color="primary" fontWeight="bold">
                    {stats.totalRoutes}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Abgeschlossene Fahrten
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box sx={{ textAlign: 'center', p: 1 }}>
                  <Typography variant="h5" color="primary" fontWeight="bold">
                    {stats.streakDays}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Tage in Folge aktiv
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CircularProgress />
              <Typography variant="body1" sx={{ mt: 2 }}>Lade Statistiken...</Typography>
            </Box>
          )}
        </TabPanel>
        
        <TabPanel value={tabValue} index={1}>
          {stats ? (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <EmojiEventsIcon sx={{ mr: 1 }} />
                Achievements ({completedAchievements}/{totalAchievements})
              </Typography>
              
              <Grid container spacing={2}>
                {achievements.map((achievement) => (
                  <Grid item xs={12} sm={6} md={4} key={achievement.id}>
                    <Card 
                      sx={{ 
                        bgcolor: achievement.unlocked ? 'rgba(76, 175, 80, 0.1)' : 'transparent',
                        opacity: achievement.unlocked ? 1 : 0.7,
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          boxShadow: 3,
                          transform: 'translateY(-3px)'
                        }
                      }}
                    >
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <Avatar 
                            sx={{ 
                              bgcolor: achievement.unlocked ? 'primary.main' : 'action.disabledBackground',
                              mr: 1
                            }}
                          >
                            {achievement.icon}
                          </Avatar>
                          <Typography variant="subtitle1" sx={{ fontWeight: achievement.unlocked ? 'bold' : 'normal' }}>
                            {achievement.title}
                          </Typography>
                        </Box>
                        
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {achievement.description}
                        </Typography>
                        
                        {achievement.progress !== undefined && achievement.maxProgress !== undefined && (
                          <Box sx={{ mt: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                              <Typography variant="caption">
                                {achievement.progress}/{achievement.maxProgress}
                              </Typography>
                              <Typography variant="caption" color={achievement.unlocked ? 'success.main' : 'text.secondary'}>
                                {Math.floor((achievement.progress / achievement.maxProgress) * 100)}%
                              </Typography>
                            </Box>
                            <LinearProgress 
                              variant="determinate" 
                              value={(achievement.progress / achievement.maxProgress) * 100} 
                              color={achievement.unlocked ? "success" : "primary"}
                              sx={{ height: 8, borderRadius: 1 }}
                            />
                          </Box>
                        )}
                        
                        {achievement.unlocked && (
                          <Chip 
                            label="Freigeschaltet" 
                            size="small" 
                            color="success" 
                            sx={{ mt: 1 }} 
                          />
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CircularProgress />
              <Typography variant="body1" sx={{ mt: 2 }}>Lade Achievements...</Typography>
            </Box>
          )}
        </TabPanel>
        
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 2 }}>
          <Button variant="outlined" onClick={onClose}>
            Schließen
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
};

export default ProfileCard; 