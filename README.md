# Bicycle Route Mapping Application

An interactive web application for mapping, rating, and navigating bicycle routes with community features.

## Features

- Interactive map for marking bicycle routes
- Route rating and commenting system
- Points of interest marking (bicycle stands, e-bike stations, viewpoints)
- Navigation with customizable preferences
- User authentication via Google
- Community review system
- CO2 savings calculator

## Tech Stack

- Frontend: React with TypeScript
- Backend: Flask (Python)
- Database: PostgreSQL with PostGIS
- Maps: Leaflet.js
- Authentication: Firebase

## Setup Instructions

### Backend Setup
1. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

### Frontend Setup
1. Install Node.js dependencies:
   ```bash
   cd frontend
   npm install
   ```

2. Create a `.env` file with your configuration:
   ```
   REACT_APP_FIREBASE_API_KEY=your_api_key
   REACT_APP_FIREBASE_AUTH_DOMAIN=your_auth_domain
   ```

3. Start the development server:
   ```bash
   npm start
   ```

## Development

- Backend runs on http://localhost:5000
- Frontend runs on http://localhost:3000

## Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a pull request 