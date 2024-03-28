const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
    userId: Number,
    username: String,
    phoneNumber: String,
    firstName: String,
    lastName: String,
    orders: [{
        name: String,
        price: Number,
        date: { type: Date, default: Date.now }
    }]
});

const securitySchema = new mongoose.Schema({
    name: String,
    category: String,
    price: Number,
    description: String,
    image: String
});

const fencesSchema = new mongoose.Schema({
    name: String,
    category: String,
    price: Number,
    description: String,
    image: String,
    step: Number
});

const repairSchema = new mongoose.Schema({
    name: String,
    description: String,
    image: String
});

const Clients = mongoose.model('clients', clientSchema);
const Security = mongoose.model('security', securitySchema);
const Fences = mongoose.model('fences', fencesSchema);
const Repair = mongoose.model('repair', repairSchema);

module.exports = { Clients, Security, Fences, Repair };
