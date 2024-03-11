const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

const token = '6256350860:AAG4zBfGIcP1mNEimo4hyTZ9Yoiz6ndm-Ok';

const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const opts = {
    reply_markup: {
      inline_keyboard: [[
        {
          text: 'Зареєструватися',
          callback_data: 'register'
        }
      ]]
    }
  };
  bot.sendMessage(chatId, 'Привіт! Натисни кнопку "Зареєструватися", щоб почати процес реєстрації.', opts);
});

bot.on('callback_query', (query) => {
  if (query.data === 'register') {
    const chatId = query.message.chat.id;
    bot.sendMessage(chatId, 'Будь-ласка, відправ свій контакт, щоб завершити реєстрацію.', {
      reply_markup: {
        keyboard: [
          [{
            text: 'Відправити номер телефону',
            request_contact: true
          }]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
  }
});

bot.on('contact', (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.contact.username;
  const phoneNumber = msg.contact.phone_number;
  const firstName = msg.contact.first_name;
  const lastName = msg.contact.last_name;

  console.log(`UserId: ${userId}\nUsername: ${username}\nName: ${firstName}\nLast name: ${lastName}\nPhone number: ${phoneNumber}`);
  bot.sendMessage(chatId, 'Дякуємо, що приєдналися до нас.');
});