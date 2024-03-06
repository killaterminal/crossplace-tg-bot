const TelegramBot = require('node-telegram-bot-api');

const token = '6256350860:AAG4zBfGIcP1mNEimo4hyTZ9Yoiz6ndm-Ok';

const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Пошёл нахуй) Я классный хуй. Как я могу тебя уложить под шконку, пидор?');
});

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Я получил твою блядскую СМСку: ' + msg.text);
});
