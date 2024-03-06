const TelegramBot = require('node-telegram-bot-api');

const token = '6256350860:AAG4zBfGIcP1mNEimo4hyTZ9Yoiz6ndm-Ok';

const bot = new TelegramBot(token, { polling: true });


bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userName = msg.from.first_name;

    bot.sendMessage(chatId, `Привет 👋\n${userName}`;
});