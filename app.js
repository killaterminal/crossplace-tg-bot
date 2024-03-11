const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const mongoose = require('mongoose');

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
  const chatId = query.message.chat.id;
  const data = query.data;

  switch (data) {
    case 'register':
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
      break;
    case 'catalog':
      bot.sendMessage(chatId, 'Каталог');
      break;
    case 'leave_message':
      bot.sendMessage(chatId, 'Залишити повідомлення');
      break;
    case 'my_orders':
      bot.sendMessage(chatId, 'Мої замовлення');
      break;
    case 'cart':
      bot.sendMessage(chatId, 'Кошик');
      break;
    default:
      bot.sendMessage(chatId, 'Невідома команда');
      break;
  }
});

bot.on('contact', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username;
  const phoneNumber = msg.contact.phone_number;
  const firstName = msg.contact.first_name;
  const lastName = msg.contact.last_name;

  try {
    const existingClient = await Clients.findOne({ userId: userId });

    if (existingClient) {
      bot.deleteMessage(chatId, msg.message_id);
      bot.sendMessage(chatId, 'Ви вже зареєстровані в нашій системі.', {
        reply_markup: {
          keyboard: [
            [
              { text: 'Каталог', callback_data: 'catalog' },
              { text: 'Залишити повідомлення', callback_data: 'leave_message' }
            ],
            [
              { text: 'Мої замовлення', callback_data: 'my_orders' },
              { text: 'Кошик', callback_data: 'cart' }
            ]
          ],
          resize_keyboard: true
        }
      });
      return;
    }

    const newClientData = {
      userId: userId,
      username: username || 'не указано',
      phoneNumber: phoneNumber || 'не указано',
      firstName: firstName || 'не указано',
      lastName: lastName || 'не указано',
      orders: []
    };

    const newClient = new Clients(newClientData);

    await newClient.save();

    console.log('Новий клієнт збережений в базі даних:', newClient);

    bot.sendMessage(chatId, 'Дякуємо, що приєдналися до нас.', {
      reply_markup: {
        keyboard: [
          [
            { text: 'Каталог', callback_data: 'catalog' },
            { text: 'Залишити повідомлення', callback_data: 'leave_message' }
          ],
          [
            { text: 'Мої замовлення', callback_data: 'my_orders' },
            { text: 'Кошик', callback_data: 'cart' }
          ]
        ],
        resize_keyboard: true
      }
    });
  } catch (error) {
    console.error('Помилка при збереженні нового клієнта:', error);
    bot.sendMessage(chatId, 'Виникла помилка при реєстрації. Спробуйте ще раз пізніше.', {
      reply_markup: {
        remove_keyboard: true
      }
    });
  }
});