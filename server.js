const express = require('express');
const path = require('path');
const marketService = require('./backend/market_service'); // market_service.js-ийг импортлох

const app = express();
const port = process.env.PORT || 3000; // Портыг environment variable-аас эсвэл 3000-аар тохируулна

// marketService-ийг эхлүүлэх
marketService.start();

// API endpoint үүсгэх: /api/market-data
// Энэ нь marketService-ээс бэлдсэн зах зээлийн датаг буцаана
app.get('/api/market-data', (req, res) => {
    res.json(marketService.getMarketData());
});

// Статик файлуудыг (HTML, CSS, JS, зураг гэх мэт) үйлчлэх
// Энэ нь таны төслийн үндсэн хавтас дахь бүх файлуудыг шууд хандах боломжтой болгоно
app.use(express.static(path.join(__dirname)));

// HTML файлуудыг шууд хандах боломжийг олгох (жишээ нь /main_exchange.html)
app.get('/:page.html', (req, res) => {
    const pagePath = path.join(__dirname, `${req.params.page}.html`);
    res.sendFile(pagePath, (err) => {
        if (err) {
            console.error(`Error serving ${req.params.page}.html:`, err);
            res.status(404).send('Page not found');
        }
    });
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});