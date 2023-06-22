const express = require('express');
const app = express();
const swaggerUi = require('swagger-ui-express');
const yamlJs = require('yamljs');
const swaggerDocument = yamlJs.load('./swagger.yaml');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require("bcrypt");
const fs = require('fs');

const accounts = [];
let sessions = [];
let expenses = []; // Define the expenses variable
let incomes = []; // Define the incomes variable

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

app.post('/accounts', (req, res) => {

    // Validations
    if (!req.body.email) return res.status(400).send('Email is required');
    if (!req.body.password) return res.status(400).send('Password is required');

    // Validate that the email is unique
    const existingAccount = accounts.find(a => a.email === req.body.email);
    if (existingAccount) return res.status(409).send('This email already exists in the system');


    // Hash password
    const hash = bcrypt.hashSync(req.body.password, 10);

    // Find max id, taking into account that the array might be empty
    const maxId = accounts.length > 0 ? Math.max(...accounts.map(a => a.id)) + 1 : 1;

    // Create account
    let account = {
        id: maxId,
        email: req.body.email,
        password: hash
    }

    // Save account
    accounts.push(account);

    // Remove password from response without mutating the original object
    account = {...account};
    delete account.password;

    // Return account
    res.status(201).send(account);

});

app.post('/sessions', async (req, res) => {

    // Validations
    if (!req.body.email) return res.status(400).send('Email is required');
    if (!req.body.password) return res.status(400).send('Password is required');

    // Find account
    const account = accounts.find(a => a.email === req.body.email);
    console.log(account)

    // Validate account
    if (!account) return res.status(404).send('Account not found');

    // Validate password using bcrypt with promises
    bcrypt.compare(req.body.password, account.password).then(function (result) {

    });

    // Check password hash
    bcrypt.compare(req.body.password, account.password, (err, result) => {

        // Validate password
        if (!result) return res.status(401).send('Invalid password');

        // Create session
        const session = {
            id: uuidv4(),
            accountId: account.id
        }

        // Save session
        sessions.push(session);

        // Return session
        res.status(201).send(session);

    });
})

function authorizeRequest(req, res, next) {

    // Validate authorization header exists
    if (!req.headers.authorization) return res.status(401).send('Authorization header is required');

    // Validate authorization header format
    const parts = req.headers.authorization.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).send('Authorization header format is Bearer {token}');

    // Get session token
    const token = parts[1];

    // Find session
    const session = sessions.find(s => s.id === token);
    if (!session) return res.status(401).send('Invalid token');

    // Find account
    const account = accounts.find(a => a.id === session.accountId);
    if (!account) return res.status(401).send('Invalid token');

    // Set account on request
    req.account = account;

    // Set session on request
    req.session = session;

    // Call next middleware
    next();
}

app.delete('/sessions', authorizeRequest, (req, res) => {

    // Remove session using filter
    sessions = sessions.filter(s => s.id !== req.session.id);

    // Return 204 No Content
    res.status(204).send();

})

// Function to read expenses from file
function readExpensesFromFile() {
    try {
        const fileData = fs.readFileSync('expenses.json', 'utf8');
        return JSON.parse(fileData);
    } catch (error) {
        console.error('Failed to read expenses:', error);
        return [];
    }
}

// Function to read incomes from file
function readIncomesFromFile() {
    try {
        const fileData = fs.readFileSync('incomes.json', 'utf8');
        return JSON.parse(fileData);
    } catch (error) {
        console.error('Failed to read incomes:', error);
        return [];
    }
}

// Function to save expenses to file
function saveExpensesToFile() {
    try {
        fs.writeFileSync('expenses.json', JSON.stringify(expenses));
    } catch (error) {
        console.error('Failed to save expenses:', error);
    }
}

// Function to save incomes to file
function saveIncomesToFile() {
    try {
        fs.writeFileSync('incomes.json', JSON.stringify(incomes));
    } catch (error) {
        console.error('Failed to save incomes:', error);
    }
}

// Load expenses from file initially
expenses = readExpensesFromFile();
// Load incomes from file initially
incomes = readIncomesFromFile();

app.post('/expenses', (req, res) => {
    const { name, amount } = req.body;

    if (!name || !amount) {
        return res.status(400).send('Name and amount are required');
    }

    const expense = {
        id: uuidv4(), // Generate a unique ID
        name,
        amount
    };

    expenses.push(expense);

    // Save the updated expenses to the file
    saveExpensesToFile();

    res.status(201).json(expense);
});

// Route to handle income creation
app.post('/incomes', (req, res) => {
    const { name, amount } = req.body;

    if (!name || !amount) {
        return res.status(400).send('Name and amount are required');
    }

    const income = {
        id: uuidv4(), // Generate a unique ID
        name,
        amount
    };

    incomes.push(income);

    // Save the updated incomes to the file
    saveIncomesToFile();

    res.status(201).json(income);
});

// Route to handle updating an expense
app.put('/expenses/:id', (req, res) => {
    const { id } = req.params;
    const { name, amount } = req.body;

    if (!name || !amount) {
        return res.status(400).send('Name and amount are required');
    }

    // Find the expense object in the array by ID
    const expense = expenses.find((expense) => expense.id === id);

    if (!expense) {
        return res.status(404).send('Expense not found');
    }

    // Update the expense properties
    expense.name = name;
    expense.amount = amount;

    // Save the updated expenses to the file
    saveExpensesToFile();

    res.json(expense);
});

// Route to handle updating an income
app.put('/incomes/:id', (req, res) => {
    const { id } = req.params;
    const { name, amount } = req.body;

    if (!name || !amount) {
        return res.status(400).send('Name and amount are required');
    }

    // Find the income object in the array by ID
    const income = incomes.find((income) => income.id === id);

    if (!income) {
        return res.status(404).send('Income not found');
    }

    // Update the income properties
    income.name = name;
    income.amount = amount;

    // Save the updated income to the file
    saveIncomesToFile();

    res.json(income);
});

app.delete('/expenses/:id', (req, res) => {
    const { id } = req.params;

    // Find the index of the expense in the array by ID
    const index = expenses.findIndex((expense) => expense.id === id);

    if (index === -1) {
        return res.status(404).send('Expense not found');
    }

    // Remove the expense from the array
    expenses.splice(index, 1);

    // Save the updated expenses to the file
    saveExpensesToFile();

    res.status(204).send();
});

app.delete('/incomes/:id', (req, res) => {
    const { id } = req.params;

    // Find the index of the income in the array by ID
    const index = incomes.findIndex((income) => income.id === id);

    if (index === -1) {
        return res.status(404).send('Income not found');
    }

    // Remove the income from the array
    incomes.splice(index, 1);

    // Save the updated incomes to the file
    saveIncomesToFile();

    res.status(204).send();
});

app.get('/expenses', (req, res) => {
    res.json(expenses);
});

app.get('/incomes', (req, res) => {
    res.json(incomes);
});

app.listen(port, () => {
    console.log(`App running. Docs at http://localhost:${port}`);
})