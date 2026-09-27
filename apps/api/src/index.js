const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const app = express();

const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

app.use(morgan('dev'));
app.use(cors({ origin: 'http://localhost:3000' }));

app.use(express.json());

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