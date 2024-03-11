const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

const token = '6256350860:AAG4zBfGIcP1mNEimo4hyTZ9Yoiz6ndm-Ok';

const bot = new TelegramBot(token, { polling: true });

mongoose.connect('mongodb+srv://admin:123zxc34@cluster0.hoxv5bc.mongodb.net/crossplace', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Підключено до MongoDB'))
  .catch(err => console.error('Помилка підключення до MongoDB:', err));

const clientSchema = new mongoose.Schema({
  userId: Number,
  username: String,
  phoneNumber: String,
  firstName: String,
  lastName: String,
  orders: [String]
});

const Clients = mongoose.model('clients', clientSchema);

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

  const newClient = new Clients({
    userId: userId,
    username: username,
    phoneNumber: phoneNumber,
    firstName: firstName,
    lastName: lastName,
    orders: []
  });

  newClient.save((err, client) => {
    if (err) {
      console.error(err);
      return;
    }
    console.log('Новий клієнт збережений в базі даних:', client);
  });

  console.log(`UserId: ${userId}\nUsername: ${username}\nName: ${firstName}\nLast name: ${lastName}\nPhone number: ${phoneNumber}`);
  bot.sendMessage(chatId, 'Дякуємо, що приєдналися до нас.');
});