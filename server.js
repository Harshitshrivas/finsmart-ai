const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const bcrypt = require('bcrypt');

const app = express();

// CORS configuration
app.use(cors({
    origin: true, // Allow all origins temporarily
    credentials: true
}));

// Session configuration
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

app.use(bodyParser.json());
app.use(express.static('public'));
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // set to true in production with HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Database setup
const db = new sqlite3.Database('finsmart.db', (err) => {
    if (err) {
        console.error('Error opening database', err);
    } else {
        console.log('Connected to database');
        createTables();
    }
});

function createTables() {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        date DATE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        category TEXT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        period TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);
}

// Helper functions
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function generateMonthlySpending() {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    return {
        labels: months,
        data: months.map(() => Math.floor(Math.random() * 2000) + 1000)
    };
}

function generateCategorySpending() {
    return {
        labels: ['Housing', 'Food', 'Transportation', 'Utilities', 'Entertainment', 'Others'],
        data: [35, 20, 15, 10, 10, 10]
    };
}

function generateYearComparison() {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    return {
        labels: months,
        currentYear: months.map(() => Math.floor(Math.random() * 1000) + 2000),
        previousYear: months.map(() => Math.floor(Math.random() * 1000) + 2000)
    };
}

// Authentication middleware
function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

// Authentication Routes
// Update the registration endpoint
app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        db.run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
            [name, email, hashedPassword],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ error: 'Email already registered' });
                    }
                    return res.status(500).json({ error: 'Server error' });
                }
                
                // Set session immediately after registration
                req.session.userId = this.lastID;
                res.json({ message: 'Registration successful' });
            });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Server error' });
        }
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        try {
            const match = await bcrypt.compare(password, user.password);
            if (!match) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            req.session.userId = user.id;
            res.json({ message: 'Login successful' });
        } catch (err) {
            res.status(500).json({ error: 'Server error' });
        }
    });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Could not log out' });
        }
        res.json({ message: 'Logged out successfully' });
    });
});

app.get('/api/check-auth', (req, res) => {
    if (req.session.userId) {
        res.json({ authenticated: true });
    } else {
        res.json({ authenticated: false });
    }
});

// Transaction Routes
app.post('/api/transactions', requireAuth, (req, res) => {
    const { amount, category, description, date } = req.body;
    const userId = req.session.userId;

    db.run(
        'INSERT INTO transactions (user_id, amount, category, description, date) VALUES (?, ?, ?, ?, ?)',
        [userId, amount, category, description, date],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to create transaction' });
            }
            res.json({ id: this.lastID, message: 'Transaction created successfully' });
        }
    );
});

app.get('/api/transactions', requireAuth, (req, res) => {
    const userId = req.session.userId;

    db.all('SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC', [userId], (err, transactions) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to fetch transactions' });
        }
        res.json(transactions);
    });
});

// Budget Routes
app.post('/api/budgets', requireAuth, (req, res) => {
    const { category, amount, period } = req.body;
    const userId = req.session.userId;

    db.run(
        'INSERT INTO budgets (user_id, category, amount, period) VALUES (?, ?, ?, ?)',
        [userId, category, amount, period],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to create budget' });
            }
            res.json({ id: this.lastID, message: 'Budget created successfully' });
        }
    );
});

app.get('/api/budgets', requireAuth, (req, res) => {
    const userId = req.session.userId;

    db.all('SELECT * FROM budgets WHERE user_id = ?', [userId], (err, budgets) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to fetch budgets' });
        }
        res.json(budgets);
    });
});

// Analytics Routes
app.get('/api/analytics/spending', requireAuth, (req, res) => {
    const userId = req.session.userId;
    
    db.all(`
        SELECT 
            category,
            SUM(amount) as total,
            strftime('%m', date) as month
        FROM transactions 
        WHERE user_id = ? 
        GROUP BY category, month
        ORDER BY month DESC, total DESC
    `, [userId], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to fetch analytics' });
        }
        res.json(results);
    });
});

// Demo Routes
app.get('/api/demo/dashboard', requireAuth, (req, res) => {
    res.json({
        healthScore: Math.floor(Math.random() * 20) + 70,
        monthlySpending: generateMonthlySpending(),
        recommendations: [
            { text: 'Reduce dining out', impact: 120 },
            { text: 'Increase 401k contribution', impact: 200 },
            { text: 'Refinance auto loan', impact: 45 }
        ],
        budgetCategories: {
            Housing: { current: 1700, limit: 2000 },
            Food: { current: 540, limit: 750 },
            Transportation: { current: 225, limit: 500 }
        },
        savingsGoals: [
            { name: 'Emergency Fund', current: 3500, target: 5000 },
            { name: 'Vacation Fund', current: 1200, target: 2500 }
        ]
    });
});

app.get('/api/demo/analysis', requireAuth, (req, res) => {
    res.json({
        categorySpending: generateCategorySpending(),
        yearComparison: generateYearComparison(),
        savingsTrajectory: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            projected: [500, 1000, 1500, 2000, 2500, 3000],
            actual: [500, 1200, 1800, 2500, 3200, 4000]
        },
        insights: [
            'Your dining expenses increased 15% compared to last month',
            'You\'re on track to reach your emergency fund goal 2 months early',
            'Utility costs are 20% below average for your area',
            'Consider refinancing your mortgage to save $200/month'
        ]
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});