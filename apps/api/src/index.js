const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Habilitar CORS para que el frontend (puerto 3000) pueda consultar
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

// Endpoint de Health Check que espera el frontend
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