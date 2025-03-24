import React, { useEffect, useState } from 'react';
import { Rating, Box, Typography, Tooltip, Badge } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import { rateRoute, getUserRating } from '../firebase/routes';
import { User } from 'firebase/auth';

interface RouteRatingProps {
  routeId: string;
  averageRating?: number | null;
  ratingCount?: number;
  showCount?: boolean;
  size?: 'small' | 'medium' | 'large';
  readOnly?: boolean;
  user: User | null;
  onRatingChange?: () => void;
}

const RouteRating: React.FC<RouteRatingProps> = ({
  routeId,
  averageRating,
  ratingCount = 0,
  showCount = true,
  size = 'medium',
  readOnly = false,
  user,
  onRatingChange
}) => {
  const [userRating, setUserRating] = useState<number | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [loading, setLoading] = useState(false);

  // Benutzer-Bewertung abrufen, wenn sich der Benutzer ändert
  useEffect(() => {
    const fetchUserRating = async () => {
      if (!user || !routeId) return;
      
      try {
        const rating = await getUserRating(routeId, user.uid);
        setUserRating(rating);
      } catch (error) {
        console.error('Error fetching user rating:', error);
      }
    };

    fetchUserRating();
  }, [user, routeId]);

  const handleRatingChange = async (event: React.SyntheticEvent, newValue: number | null) => {
    if (!user || !routeId || newValue === null) return;
    
    setLoading(true);
    try {
      await rateRoute(routeId, user.uid, newValue);
      setUserRating(newValue);
      
      // Callback für die übergeordnete Komponente, falls benötigt
      if (onRatingChange) {
        onRatingChange();
      }
    } catch (error) {
      console.error('Error submitting rating:', error);
    } finally {
      setLoading(false);
    }
  };

  // Wenn die Komponente nur gelesen werden kann oder kein Benutzer vorhanden ist
  if (readOnly || !user) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Rating
          value={averageRating || 0}
          precision={0.5}
          readOnly
          size={size}
        />
        {showCount && ratingCount > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            ({ratingCount})
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        position: 'relative' 
      }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <Tooltip 
        title={userRating ? "Deine Bewertung ändern" : "Route bewerten"} 
        placement="top"
        open={isHovering}
      >
        <Badge
          color="primary"
          variant="dot"
          invisible={userRating === null}
          sx={{ '& .MuiBadge-badge': { right: -3, top: 13 } }}
        >
          <Rating
            name={`rating-${routeId}`}
            value={userRating || 0}
            precision={1}
            onChange={handleRatingChange}
            size={size}
            disabled={loading}
          />
        </Badge>
      </Tooltip>
      
      {showCount && (ratingCount > 0 || averageRating) && (
        <Box sx={{ ml: 1, display: 'flex', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {averageRating?.toFixed(1) || '0'} 
          </Typography>
          <StarIcon sx={{ fontSize: 14, ml: 0.5, color: 'text.secondary' }} />
          <Typography variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
            ({ratingCount})
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default RouteRating; 