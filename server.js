require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const { userDb, rideDb, colleges } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Session configuration
app.use(session({
    secret: 'uni-ride-secret-key-change-in-production',
    resave: true, // Changed to true to ensure session is saved
    saveUninitialized: true, // Changed to true to save session even if not modified
    cookie: { 
        secure: false, 
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true,
        sameSite: 'lax'
    }
}));

// Admin password from environment variable
// Set ADMIN_PASSWORD in your .env file
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
    console.error('ERROR: ADMIN_PASSWORD environment variable is not set!');
    console.error('Please create a .env file with ADMIN_PASSWORD=your_password');
    process.exit(1);
}

// Middleware to check if user is authenticated
function requireAuth(req, res, next) {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login.html');
    }
}

// Middleware to check if admin is authenticated
function requireAdmin(req, res, next) {
    console.log('Admin check - isAdmin:', req.session.isAdmin, 'role:', req.session.role, 'sessionID:', req.sessionID, 'hasSession:', !!req.session);
    // Allow access if either admin session or regular user with admin role
    if (req.session && (req.session.isAdmin === true || req.session.role === 'admin')) {
        console.log('Admin access granted');
        next();
    } else {
        console.log('Admin access denied - isAdmin:', req.session?.isAdmin, 'role:', req.session?.role, 'session exists:', !!req.session);
        res.status(403).json({ error: 'Admin access required' });
    }
}

// API Routes

// Get colleges list
app.get('/api/colleges', (req, res) => {
    res.json({ colleges });
});

// Register new user
app.post('/api/register', (req, res) => {
    const { email, password, name, college, gender, graduationYear } = req.body;
    
    if (!email || !password || !name || !college) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check if user already exists
    const existingUser = userDb.findByEmail(email);
    if (existingUser) {
        return res.status(400).json({ error: 'Email already registered' });
    }
    
    try {
        userDb.create(email, password, name, college, gender, graduationYear);
        res.json({ success: true, message: 'Registration successful' });
    } catch (error) {
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    
    const user = userDb.findByEmail(email);
    if (!user || !userDb.verifyPassword(password, user.password)) {
        return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Set role: admin if email is kfox24@nd.edu, otherwise user
    const role = email === 'kfox24@nd.edu' ? 'admin' : 'user';
    
    req.session.userId = user.id;
    req.session.userEmail = user.email;
    req.session.role = role;
    res.json({ success: true, user: { id: user.id, name: user.name, college: user.college, role: role } });
});

// Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Get current user
app.get('/api/user', requireAuth, (req, res) => {
    const user = userDb.findById(req.session.userId);
    if (user) {
        // Include role from session
        const userWithRole = { ...user, role: req.session.role || 'user' };
        res.json({ user: userWithRole });
    } else {
        res.status(404).json({ error: 'User not found' });
    }
});

// Get current user role (for admin page to check if user can switch views)
app.get('/api/user/role', (req, res) => {
    if (req.session && req.session.userId && req.session.role === 'admin') {
        res.json({ role: 'admin', canSwitch: true });
    } else {
        res.json({ role: req.session?.role || null, canSwitch: false });
    }
});

// Update user profile
app.put('/api/user', requireAuth, (req, res) => {
    const { name, college, gender, graduationYear } = req.body;
    
    if (!name || !college) {
        return res.status(400).json({ error: 'Name and college are required' });
    }
    
    try {
        userDb.update(req.session.userId, name, college, gender || null, graduationYear || null);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Create a ride
app.post('/api/rides', requireAuth, (req, res) => {
    const { location, direction, departureTime, flexibility } = req.body;
    
    if (!location || !direction || !departureTime || !flexibility) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    try {
        const result = rideDb.create(req.session.userId, location, direction, departureTime, flexibility);
        res.json({ success: true, rideId: result.lastInsertRowid });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create ride' });
    }
});

// Get user's rides
app.get('/api/rides/my-rides', requireAuth, (req, res) => {
    const rides = rideDb.findByUser(req.session.userId);
    res.json({ rides });
});

// Get matching rides
app.get('/api/rides/matches', requireAuth, (req, res) => {
    const { location, direction, startDate, endDate } = req.query;
    
    if (!location || !direction || !startDate || !endDate) {
        return res.status(400).json({ error: 'Missing required search parameters' });
    }
    
    const user = userDb.findById(req.session.userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    // Validate date range
    if (new Date(startDate) > new Date(endDate)) {
        return res.status(400).json({ error: 'Start date must be before or equal to end date' });
    }
    
    const matches = rideDb.findMatchesByDate(
        req.session.userId,
        user.college,
        location,
        direction,
        startDate,
        endDate
    );
    res.json({ matches });
});

// Get all rides for user's college
app.get('/api/rides/college', requireAuth, (req, res) => {
    const user = userDb.findById(req.session.userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    const rides = rideDb.findAllByCollege(user.college);
    res.json({ rides });
});

// Get single ride
app.get('/api/rides/:id', requireAuth, (req, res) => {
    const ride = rideDb.findById(req.params.id);
    if (ride) {
        res.json({ ride });
    } else {
        res.status(404).json({ error: 'Ride not found' });
    }
});

// Update ride status (e.g., cancel)
app.put('/api/rides/:id/status', requireAuth, (req, res) => {
    const { status } = req.body;
    const ride = rideDb.findById(req.params.id);
    
    if (!ride) {
        return res.status(404).json({ error: 'Ride not found' });
    }
    
    if (ride.user_id !== req.session.userId) {
        return res.status(403).json({ error: 'Not authorized' });
    }
    
    rideDb.updateStatus(req.params.id, status);
    res.json({ success: true });
});

// Update ride
app.put('/api/rides/:id', requireAuth, (req, res) => {
    const { location, direction, departureTime, flexibility } = req.body;
    const ride = rideDb.findById(req.params.id);
    
    if (!ride) {
        return res.status(404).json({ error: 'Ride not found' });
    }
    
    if (ride.user_id !== req.session.userId) {
        return res.status(403).json({ error: 'Not authorized' });
    }
    
    if (!location || !direction || !departureTime || !flexibility) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    try {
        rideDb.update(req.params.id, location, direction, departureTime, flexibility);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update ride' });
    }
});

// Delete ride
app.delete('/api/rides/:id', requireAuth, (req, res) => {
    const ride = rideDb.findById(req.params.id);
    
    if (!ride) {
        return res.status(404).json({ error: 'Ride not found' });
    }
    
    if (ride.user_id !== req.session.userId) {
        return res.status(403).json({ error: 'Not authorized' });
    }
    
    try {
        rideDb.delete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete ride' });
    }
});

// Admin login
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    
    if (password === ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({ error: 'Failed to save session' });
            }
            console.log('Admin session created - isAdmin:', req.session.isAdmin, 'sessionID:', req.sessionID);
            res.json({ success: true, sessionId: req.sessionID });
        });
    } else {
        res.status(401).json({ error: 'Invalid admin password' });
    }
});

// Admin logout
app.post('/api/admin/logout', (req, res) => {
    req.session.isAdmin = false;
    req.session.destroy((err) => {
        if (err) {
            console.error('Session destroy error:', err);
            return res.status(500).json({ error: 'Failed to logout' });
        }
        res.json({ success: true });
    });
});

// Admin endpoints - Get all users (protected)
app.get('/api/admin/users', requireAdmin, (req, res) => {
    try {
        const users = userDb.findAll();
        console.log(`Admin: Retrieved ${users.length} users`);
        console.log('Users data:', users);
        res.json({ users: users || [] });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users', details: error.message });
    }
});

// Admin endpoints - Get all rides (protected)
app.get('/api/admin/rides', requireAdmin, (req, res) => {
    try {
        const rides = rideDb.findAll();
        console.log(`Admin: Retrieved ${rides.length} rides`);
        console.log('Rides data:', rides);
        res.json({ rides: rides || [] });
    } catch (error) {
        console.error('Error fetching rides:', error);
        res.status(500).json({ error: 'Failed to fetch rides', details: error.message });
    }
});

// Frontend Routes

// Home page - redirect to dashboard if logged in, otherwise to login
app.get('/', (req, res) => {
    if (req.session.userId) {
        res.redirect('/dashboard.html');
    } else {
        res.sendFile(path.join(__dirname, 'index.html'));
    }
});

// Protected routes
app.get('/dashboard.html', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/plan-ride.html', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'plan-ride.html'));
});

app.get('/view-rides.html', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'view-rides.html'));
});

app.get('/profile.html', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'profile.html'));
});

// Admin page - check if admin is logged in
app.get('/admin.html', (req, res) => {
    console.log('Admin page route - isAdmin:', req.session?.isAdmin, 'role:', req.session?.role, 'sessionID:', req.sessionID);
    
    // Allow force logout via query parameter
    if (req.query.logout === 'true') {
        req.session.isAdmin = false;
        req.session.destroy((err) => {
            if (err) console.error('Session destroy error:', err);
            console.log('Admin session destroyed');
            res.sendFile(path.join(__dirname, 'admin-login.html'));
        });
        return;
    }
    
    // Allow access if either:
    // 1. Admin session is active (isAdmin === true), OR
    // 2. Regular user session with role === 'admin'
    if (req.session && (req.session.isAdmin === true || req.session.role === 'admin')) {
        console.log('Serving admin.html - user is authenticated');
        res.sendFile(path.join(__dirname, 'admin.html'));
    } else {
        console.log('Serving admin-login.html - user not authenticated');
        res.sendFile(path.join(__dirname, 'admin-login.html'));
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Open your browser and navigate to http://localhost:${PORT} to view the website`);
});
