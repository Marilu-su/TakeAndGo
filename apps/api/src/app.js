const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();

const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

app.use(morgan('dev'));
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'take-and-go-api',
        timestamp: new Date()
    });
});

app.use((req, res) => {
    res.status(404).json({
        error: 'Ruta no encontrada'
    });
});

app.use((err, req, res, next) => {
    console.error(err);

    res.status(500).json({
        error: 'Error interno del servidor'
    });
});

module.exports = app;