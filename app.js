const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');

const token = '6256350860:AAG4zBfGIcP1mNEimo4hyTZ9Yoiz6ndm-Ok';

const app = express();
const port = 3020;

mongoose.connect('mongodb+srv://admin:123zxc34@cluster0.hoxv5bc.mongodb.net/crossplace', { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Підключено до MongoDB'))
    .catch(err => console.error('Помилка підключення до MongoDB:', err));

const securitySchema = new mongoose.Schema({
    name: String,
    category: String,
    price: Number,
    description: String,
    image: String
});
const Security = mongoose.model('security', securitySchema);


app.use(bodyParser.json());
app.use(cors());

app.get('/securityItems', async (req, res) => {
    try {
        const securityItems = await Security.find({});
        res.json(securityItems);
    } catch (error) {
        console.error('Помилка при отриманні даних з бази даних:', error);
        res.status(500).send('Помилка сервера');
    }
});

app.listen(port, () => {
    console.log(`Сервер запущено на порті ${port}`);
});
