const express = require('express');
const app = express();
const swaggerUi = require('swagger-ui-express');
const yamlJs = require('yamljs');
const swaggerDocument = yamlJs.load('./swagger.yaml');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require("bcrypt");
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'qwerty',
    database: process.env.DB_NAME || 'main',
});

require('dotenv').config();

const port = process.env.PORT || 3000;

// Serve static files
app.use(express.static('public'));

// Use the Swagger UI
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Middleware to parse JSON
app.use(express.json());

// General error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    const status = err.statusCode || 500;
    res.status(status).send(err.message);
})

// Route to create a new account
app.post('/accounts', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).send('Email and password are required');
    }

    try {
        const hash = await bcrypt.hash(password, 10);
        const [result] = await pool.query('INSERT INTO accounts (email, password) VALUES (?, ?)', [email, hash]);
        const account = {
            id: result.insertId,
            email,
        };
        res.status(201).json(account);
    } catch (error) {
        console.error('Error creating account:', error);
        res.status(500).send('Error creating account');
    }
});

// Route to create a session (login)
app.post('/sessions', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).send('Email and password are required');
    }

    try {
        const [rows] = await pool.query('SELECT * FROM accounts WHERE email = ?', [email]);

        if (rows.length === 0) {
            return res.status(404).send('Account not found');
        }

        const account = rows[0];

        const passwordMatch = await bcrypt.compare(password, account.password);

        if (!passwordMatch) {
            return res.status(401).send('Invalid password');
        }

        const sessionId = uuidv4();

        // Store the session in the sessions table
        await pool.query('INSERT INTO sessions (id, accountId) VALUES (?, ?)', [sessionId, account.id]);

        const session = {
            id: sessionId,
            accountId: account.id,
        };

        res.status(201).json(session);
    } catch (error) {
        console.error('Error creating session:', error);
        res.status(500).send('Error creating session');
    }
});

// Route to delete a session (logout)
app.delete('/sessions', authorizeRequest, async (req, res) => {
    try {
        // Delete the session from the sessions table
        await pool.query('DELETE FROM sessions WHERE id = ?', [req.session.id]);

        // Return 204 No Content
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting session:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Middleware to authorize requests
async function authorizeRequest(req, res, next) {
    // Validate authorization header exists
    if (!req.headers.authorization) {
        return res.status(401).send('Authorization header is required');
    }

    // Validate authorization header format
    const parts = req.headers.authorization.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return res.status(401).send('Authorization header format is Bearer {token}');
    }

    // Get session token
    const token = parts[1];

    try {
        // Check the session in the sessions table
        const [rows] = await pool.query('SELECT * FROM sessions WHERE id = ?', [token]);

        if (rows.length === 0) {
            return res.status(401).send('Invalid token');
        }

        const session = rows[0];

        // Find the associated account
        const [accountRows] = await pool.query('SELECT * FROM accounts WHERE id = ?', [session.accountId]);

        if (accountRows.length === 0) {
            return res.status(401).send('Invalid token');
        }

        const account = accountRows[0];

        // Attach the account and session to the request
        req.account = account;
        req.session = session;

        // Continue with the next middleware
        next();
    } catch (error) {
        console.error('Error authorizing request:', error);
        res.status(500).send('Internal Server Error');
    }
}

app.post('/expenses', authorizeRequest, async (req, res) => {
    const { name, amount } = req.body;
    const userId = req.account.id; // Get the user's ID from the authenticated session

    if (!name) {
        return res.status(400).json({ error: 'Name is required' });
    }

    if (amount === undefined || amount < 0) {
        return res.status(400).json({ error: 'Amount must be a non-negative number' });
    }

    try {
        const [result] = await pool.query('INSERT INTO expenses (name, amount, userId) VALUES (?, ?, ?)', [name, amount, userId]);
        const expense = {
            id: result.insertId,
            name,
            amount,
            userId, // Store the user's ID with the expense
        };
        res.status(201).json(expense);
    } catch (error) {
        console.error('Error creating expense:', error);
        res.status(500).json({ error: 'Error creating expense' });
    }
});

// Route to handle income creation
app.post('/incomes', authorizeRequest, async (req, res) => {
    const { name, amount } = req.body;
    const userId = req.account.id; // Get the user's ID from the authenticated session

    if (!name) {
        return res.status(400).json({ error: 'Name is required' });
    }

    if (amount === undefined || amount < 0) {
        return res.status(400).json({ error: 'Amount must be a non-negative number' });
    }

    try {
        const [result] = await pool.query('INSERT INTO incomes (name, amount, userId) VALUES (?, ?, ?)', [name, amount, userId]);
        const income = {
            id: result.insertId,
            name,
            amount,
            userId, // Store the user's ID with the income
        };
        res.status(201).json(income);
    } catch (error) {
        console.error('Error creating income:', error);
        res.status(500).json({ error: 'Failed to create the income. Please try again later.' });
    }
});


// Route to handle updating an expense
app.put('/expenses/:id', authorizeRequest, async (req, res) => {
    const { id } = req.params;
    const { name, amount } = req.body;

    if (!name || amount === undefined || amount < 0) {
        return res.status(400).json({ error: 'Name is required, and amount must be a non-negative number' });
    }

    try {
        const [result] = await pool.query('UPDATE expenses SET name = ?, amount = ? WHERE id = ?', [name, amount, id]);

        if (result.affectedRows === 0) {
            return res.status(404).send('Expense not found');
        }

        const updatedExpense = {
            id: id,
            name: name,
            amount: amount,
        };

        res.json(updatedExpense);
    } catch (error) {
        console.error('Error updating expense:', error);
        res.status(500).send('Error updating expense');
    }
});

// Route to handle updating an income
app.put('/incomes/:id', authorizeRequest, async (req, res) => {
    const { id } = req.params;
    const { name, amount } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Name is required' });
    }

    if (amount === undefined || amount < 0) {
        return res.status(400).json({ error: 'Amount must be a non-negative number' });
    }

    try {
        const [result] = await pool.query('UPDATE incomes SET name = ?, amount = ? WHERE id = ?', [name, amount, id]);

        if (result.affectedRows === 0) {
            return res.status(404).send('Income not found');
        }

        const updatedIncome = {
            id: id,
            name: name,
            amount: amount,
        };

        res.json(updatedIncome);
    } catch (error) {
        console.error('Error updating expense:', error);
        res.status(500).send('Error updating expense');
    }
});

app.delete('/expenses/:id', authorizeRequest, async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await pool.query('DELETE FROM expenses WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).send('Expense not found');
        }

        res.status(204).send();
    } catch (error) {
        console.error('Error deleting expense:', error);
        res.status(500).send('Error deleting expense');
    }
});

app.delete('/incomes/:id', authorizeRequest, async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await pool.query('DELETE FROM incomes WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).send('Income not found');
        }

        res.status(204).send();
    } catch (error) {
        console.error('Error deleting income:', error);
        res.status(500).send('Error deleting income');
    }
});
// Route to retrieve expenses for the authenticated user
app.get('/expenses', authorizeRequest, async (req, res) => {
    const userId = req.account.id; // Get the user's ID from the authenticated session

    try {
        const [rows] = await pool.query('SELECT * FROM expenses WHERE userId = ?', [userId]);
        res.json(rows);
    } catch (error) {
        console.error('Error retrieving expenses:', error);
        res.status(500).json({ error: 'Error retrieving expenses' });
    }
});


app.get('/incomes', authorizeRequest, async (req, res) => {
    const userId = req.account.id; // Get the user's ID from the authenticated session

    try {
        const [rows] = await pool.query('SELECT * FROM incomes WHERE userId = ?', [userId]);
        res.json(rows);
    } catch (error) {
        console.error('Error retrieving incomes:', error);
        res.status(500).send('Error retrieving incomes');
    }
});

// Route to create a new support ticket
app.post('/support_tickets', authorizeRequest, async (req, res) => {
    const { subject, description } = req.body;
    const userId = req.account.id;

    if (!subject || !description) {
        return res.status(400).json({ error: 'Subject and description are required' });
    }

    try {
        const [result] = await pool.query('INSERT INTO support_tickets (user_id, subject, description) VALUES (?, ?, ?)', [userId, subject, description]);
        const ticket = {
            id: result.insertId,
            user_id: userId,
            subject,
            description,
            status: 'Open',
            created_at: new Date(),
        };
        res.status(201).json(ticket);
    } catch (error) {
        console.error('Error creating support ticket:', error);
        res.status(500).json({ error: 'Error creating support ticket' });
    }
});

// Route to retrieve support tickets for the authenticated user
app.get('/support_tickets', authorizeRequest, async (req, res) => {
    const userId = req.account.id; // Get the user's ID from the authenticated session

    try {
        // Fetch support tickets associated with the user
        const [rows] = await pool.query('SELECT * FROM support_tickets WHERE user_id = ?', [userId]);
        res.json(rows);
    } catch (error) {
        console.error('Error retrieving support tickets:', error);
        res.status(500).json({ error: 'Error retrieving support tickets' });
    }
});

app.listen(port, () => {
    console.log(`App running. Docs at http://localhost:${port}`);
})