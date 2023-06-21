const express = require('express');
const app = express();
const swaggerUi = require('swagger-ui-express');
const yamlJs = require('yamljs');
const swaggerDocument = yamlJs.load('./swagger.yaml');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require("bcrypt");

const accounts = [
    {id: 1, email: 'a', password: 'a'}
];
let sessions = [];

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
        // if (!result) return res.status(401).send('Invalid password');

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


app.listen(port, () => {
    console.log(`App running. Docs at http://localhost:${port}/docs`);
})