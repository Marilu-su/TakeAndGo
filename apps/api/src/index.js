const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Habilitar CORS para el frontend (puerto 3000)
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

// Configurar Morgan para el logging base de peticiones HTTP
app.use(morgan('dev'));

// Endpoint de Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        service: 'take-and-go-api',
        timestamp: new Date() 
    });
});

app.listen(PORT, () => {
    console.log(`Backend de Take&Go corriendo en http://localhost:${PORT}`);
});