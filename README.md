# UniRide 🚗

A ride-sharing platform for college students to find and coordinate shared rides to and from airports during breaks.

## Features

- **User Accounts**: Students can create accounts with their name, college, gender, and graduation year
- **College-Based Grouping**: Students are automatically grouped by their college
- **Plan Rides**: Create ride requests with:
  - Location (e.g., airport)
  - Direction (to/from)
  - Departure time
  - Time flexibility (strict ±1hr, moderate ±3hrs, flexible ±6hrs)
- **Find Rides**: Search for matching rides from students at your college
- **Smart Matching**: Automatically matches rides based on college, location, direction, and time windows

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
   - Copy `.env.example` to `.env`: `cp .env.example .env`
   - Edit `.env` and set your `ADMIN_PASSWORD` (this is the password for the admin dashboard)

3. Start the server:
```bash
npm start
```

4. Open your browser to `http://localhost:3000`

## Environment Variables

The following environment variables are required:

- `ADMIN_PASSWORD` - Password for accessing the admin dashboard at `/admin.html`

Create a `.env` file in the root directory with these variables. See `.env.example` for a template.

## Tech Stack

- **Backend**: Node.js, Express
- **Database**: SQLite (better-sqlite3)
- **Authentication**: Express sessions with bcrypt password hashing
- **Frontend**: Vanilla HTML/CSS/JavaScript

## Project Structure

- `server.js` - Express server with API routes
- `database.js` - Database setup and operations
- `index.html` - Landing page
- `register.html` - User registration
- `login.html` - User login
- `dashboard.html` - User dashboard
- `plan-ride.html` - Create a new ride
- `view-rides.html` - Browse available rides

## API Endpoints

- `POST /api/register` - Register new user
- `POST /api/login` - User login
- `POST /api/logout` - User logout
- `GET /api/user` - Get current user info
- `POST /api/rides` - Create a new ride
- `GET /api/rides/my-rides` - Get user's rides
- `GET /api/rides/matches` - Find matching rides
- `GET /api/rides/college` - Get all rides from user's college
- `GET /api/colleges` - Get list of colleges

