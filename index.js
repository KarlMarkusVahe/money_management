const express = require('express');
const app = express();
const swaggerUi = require('swagger-ui-express');
const yamlJs = require('yamljs');
const swaggerDocument = yamlJs.load('./swagger.yaml');

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

app.listen(port, () => {
    console.log(`App running. Docs at http://localhost:${port}/docs`);
})
