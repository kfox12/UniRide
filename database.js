const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const db = new Database(path.join(__dirname, 'uni-ride.db'));

// Initialize database tables
function initDatabase() {
    // Users table
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT NOT NULL,
            college TEXT NOT NULL,
            gender TEXT,
            graduation_year INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Rides table
    db.exec(`
        CREATE TABLE IF NOT EXISTS rides (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            location TEXT NOT NULL,
            direction TEXT NOT NULL,
            departure_time DATETIME NOT NULL,
            flexibility TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // Popular colleges list (can be expanded)
    const colleges = [
        'Harvard University',
        'MIT',
        'Stanford University',
        'Yale University',
        'Princeton University',
        'Columbia University',
        'University of Pennsylvania',
        'Cornell University',
        'Dartmouth College',
        'Brown University',
        'University of California, Berkeley',
        'University of California, Los Angeles',
        'University of Michigan',
        'University of Virginia',
        'University of North Carolina',
        'Duke University',
        'New York University',
        'Boston University',
        'Northeastern University',
        'Other'
    ];

    console.log('Database initialized successfully');
    return { colleges };
}

// User operations
const userDb = {
    create: (email, password, name, college, gender, graduationYear) => {
        const hashedPassword = bcrypt.hashSync(password, 10);
        const stmt = db.prepare(`
            INSERT INTO users (email, password, name, college, gender, graduation_year)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        return stmt.run(email, hashedPassword, name, college, gender, graduationYear);
    },
    
    findByEmail: (email) => {
        const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
        return stmt.get(email);
    },
    
    findById: (id) => {
        const stmt = db.prepare('SELECT id, email, name, college, gender, graduation_year FROM users WHERE id = ?');
        return stmt.get(id);
    },
    
    verifyPassword: (password, hash) => {
        return bcrypt.compareSync(password, hash);
    },
    
    findAll: () => {
        const stmt = db.prepare('SELECT id, email, name, college, gender, graduation_year, created_at FROM users ORDER BY created_at DESC');
        return stmt.all();
    },
    
    update: (id, name, college, gender, graduationYear) => {
        const stmt = db.prepare(`
            UPDATE users 
            SET name = ?, college = ?, gender = ?, graduation_year = ?
            WHERE id = ?
        `);
        return stmt.run(name, college, gender, graduationYear, id);
    }
};

// Ride operations
const rideDb = {
    create: (userId, location, direction, departureTime, flexibility) => {
        const stmt = db.prepare(`
            INSERT INTO rides (user_id, location, direction, departure_time, flexibility)
            VALUES (?, ?, ?, ?, ?)
        `);
        return stmt.run(userId, location, direction, departureTime, flexibility);
    },
    
    findByUser: (userId) => {
        const stmt = db.prepare(`
            SELECT r.*, u.name, u.college, u.gender, u.graduation_year
            FROM rides r
            JOIN users u ON r.user_id = u.id
            WHERE r.user_id = ? AND r.status = 'active'
            ORDER BY r.departure_time ASC
        `);
        return stmt.all(userId);
    },
    
    findMatches: (userId, college, location, direction, departureTime, flexibility) => {
        // Get user's college
        const user = userDb.findById(userId);
        if (!user) return [];
        
        // Calculate time window based on flexibility
        const timeWindow = flexibility === 'strict' ? 1 : flexibility === 'moderate' ? 3 : 6; // hours
        const minTime = new Date(new Date(departureTime).getTime() - timeWindow * 60 * 60 * 1000);
        const maxTime = new Date(new Date(departureTime).getTime() + timeWindow * 60 * 60 * 1000);
        
        const stmt = db.prepare(`
            SELECT r.*, u.name, u.college, u.gender, u.graduation_year
            FROM rides r
            JOIN users u ON r.user_id = u.id
            WHERE r.user_id != ? 
            AND u.college = ?
            AND r.location = ?
            AND r.direction = ?
            AND r.departure_time BETWEEN ? AND ?
            AND r.status = 'active'
            ORDER BY r.departure_time ASC
        `);
        return stmt.all(userId, college, location, direction, minTime.toISOString(), maxTime.toISOString());
    },
    
    findAllByCollege: (college) => {
        const stmt = db.prepare(`
            SELECT r.*, u.name, u.college, u.gender, u.graduation_year
            FROM rides r
            JOIN users u ON r.user_id = u.id
            WHERE u.college = ? AND r.status = 'active'
            ORDER BY r.departure_time ASC
        `);
        return stmt.all(college);
    },
    
    findById: (id) => {
        const stmt = db.prepare(`
            SELECT r.*, u.name, u.college, u.gender, u.graduation_year
            FROM rides r
            JOIN users u ON r.user_id = u.id
            WHERE r.id = ?
        `);
        return stmt.get(id);
    },
    
    updateStatus: (id, status) => {
        const stmt = db.prepare('UPDATE rides SET status = ? WHERE id = ?');
        return stmt.run(status, id);
    },
    
    update: (id, location, direction, departureTime, flexibility) => {
        const stmt = db.prepare(`
            UPDATE rides 
            SET location = ?, direction = ?, departure_time = ?, flexibility = ?
            WHERE id = ?
        `);
        return stmt.run(location, direction, departureTime, flexibility, id);
    },
    
    delete: (id) => {
        const stmt = db.prepare('DELETE FROM rides WHERE id = ?');
        return stmt.run(id);
    },
    
    findAll: () => {
        const stmt = db.prepare(`
            SELECT r.*, u.name, u.college, u.gender, u.graduation_year, u.email
            FROM rides r
            JOIN users u ON r.user_id = u.id
            ORDER BY r.created_at DESC
        `);
        return stmt.all();
    }
};

// Initialize on load
const { colleges } = initDatabase();

module.exports = { db, userDb, rideDb, colleges };

