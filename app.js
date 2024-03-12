const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const mongoose = require('mongoose');
const QRCode = require('qrcode');
const url = require('url');

const token = '6256350860:AAG4zBfGIcP1mNEimo4hyTZ9Yoiz6ndm-Ok';
const bot = new TelegramBot(token, { polling: true });
const fontPath = './fonts/font_for_pdf.ttf';

mongoose.connect('mongodb+srv://admin:123zxc34@cluster0.hoxv5bc.mongodb.net/crossplace', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Підключено до MongoDB'))
  .catch(err => console.error('Помилка підключення до MongoDB:', err));

const clientSchema = new mongoose.Schema({
  userId: Number,
  username: String,
  phoneNumber: String,
  firstName: String,
  lastName: String,
  orders: [{
    name: String,
    price: Number,
  }]
});
const Clients = mongoose.model('clients', clientSchema);

const securitySchema = new mongoose.Schema({
  name: String,
  category: String,
  price: Number,
  description: String,
  image: String
});
const Security = mongoose.model('security', securitySchema);

const fencesSchema = new mongoose.Schema({
  name: String,
  category: String,
  price: Number,
  description: String,
  image: String,
  step: Number
});
const Fences = mongoose.model('fences', fencesSchema);
const shoppingCarts = {};

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const name = msg.from.first_name;
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
  bot.sendMessage(chatId, `Привіт, ${name}👋! Натисни кнопку "Зареєструватися", щоб почати процес реєстрації.`, opts);
});


bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data === 'register') {
    bot.sendMessage(chatId, 'Будь-ласка, відправ свій номер, щоб завершити реєстрацію.', {
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
  else if (data === 'catalog_security') {
    const chatId = query.message.chat.id;
    try {
      const securityObjects = await Security.find();
      if (securityObjects && securityObjects.length > 0) {
        securityObjects.forEach((object) => {
          const response = `*ID:* ${object._id}\n*Назва:* ${object.name}\n*Категорія:* ${object.category}\n*Ціна:* ${object.price} грн\n*Опис:* ${object.description}`;
          const options = {
            reply_markup: {
              inline_keyboard: [
                [{ text: `До кошику 🛒\n${object.name}`, callback_data: `security_object_${object._id}` }]
              ]
            }
          };
          bot.sendPhoto(chatId, object.image, { caption: response, parse_mode: 'Markdown', reply_markup: options.reply_markup });
        });
      } else {
        bot.sendMessage(chatId, 'На жаль, немає доступних об\'єктів безпеки.');
      }
    } catch (error) {
      console.error('Помилка отримання об\'єктів безпеки:', error);
      bot.sendMessage(chatId, 'Виникла помилка при отриманні об\'єктів безпеки.');
    }



  }
  else if (data === 'catalog_fences') {
    const chatId = query.message.chat.id;
    try {
      const fencesObjects = await Fences.find();
      if (fencesObjects && fencesObjects.length > 0) {
        fencesObjects.forEach(async object => {
          const response = `*Назва:* ${object.name}\n*Категорія:* ${object.category}\n*Ціна:* ${object.price} грн\n*Крок:* ${object.step}\n*Опис:* ${object.description}`;
          const options = {
            reply_markup: {
              inline_keyboard: [
                [{ text: `До кошику 🛒\n${object.name}`, callback_data: `security_object_${object._id}` }]
              ]
            }
          };
          await bot.sendPhoto(chatId, object.image, { caption: response, parse_mode: 'Markdown', reply_markup: options.reply_markup });
        });
      } else {
        bot.sendMessage(chatId, 'На жаль, немає доступних огорож.');
      }
    } catch (error) {
      console.error('Помилка отримання огорож:', error);
      bot.sendMessage(chatId, 'Виникла помилка при отриманні огорож.');
    }
  }


  else if (data.startsWith('security_object_')) {
    const productId = data.split('_')[2];
    if (!shoppingCarts[chatId]) {
      shoppingCarts[chatId] = [];
    }
    shoppingCarts[chatId].push(productId);
    bot.sendMessage(chatId, 'Товар додано до кошика.');
  }

  else if (data === 'order') {
    if (!shoppingCarts[chatId] || shoppingCarts[chatId].length === 0) {
      bot.sendMessage(chatId, 'Ваш кошик порожній.');
      return;
    }

    let message = 'Ваш кошик:\n';
    for (const productId of shoppingCarts[chatId]) {
      let product;
      try {
        product = await Security.findById(productId);
        if (!product) {
          product = await Fences.findById(productId);
        }
        if (product) {
          message += `Назва: ${product.name}\nЦіна: ${product.price} грн\n\n`;
        }
      } catch (error) {
        console.error('Помилка при отриманні інформації про товар:', error);
      }
    }
    message += 'Виберіть дію:\n1. Змінити заказ\n2. Оформити заказ';

    bot.sendMessage(chatId, message);

    bot.onText(/^(1|2)$/, async (msg, match) => {
      const choice = parseInt(match[1]);

      if (choice === 1) {
        shoppingCarts[chatId] = [];
        bot.sendMessage(chatId, 'Кошик очищений.');
      } else if (choice === 2) {
        try {
          const pdfDoc = new PDFDocument({ margin: 50, font: fontPath });
          const writeStream = fs.createWriteStream(`order_${chatId}.pdf`);
          pdfDoc.pipe(writeStream);

          pdfDoc.text('Ваше замовлення\n');

          for (const productId of shoppingCarts[chatId]) {
            const product = await getProductById(productId);
            if (product) {
              pdfDoc.text(`Назва товару: ${product.name}\nЦіна: ${product.price} грн\n\n`);
            }
          }
          const targetURL = 'https://cross-place.netlify.app/';
          const qrCodeImageBuffer = await QRCode.toBuffer(targetURL);
          pdfDoc.image(qrCodeImageBuffer, { fit: [100, 100], align: 'right' });

          pdfDoc.end();

          writeStream.on('finish', () => {
            for (const productId of shoppingCarts[chatId]) {
              addToDatabase(productId, chatId, chatId);
            }
            shoppingCarts[chatId] = [];
            bot.sendDocument(chatId, `order_${chatId}.pdf`, {
              caption: 'Замовлення оформлено. Ваше замовлення у прикріпленому PDF-файлі.'
            });
          });
        } catch (error) {
          console.error('Помилка при оформленні заказу:', error);
          bot.sendMessage(chatId, 'Помилка при оформленні заказу.');
        }
      }
    });
  }
});

async function getProductById(productId) {
  try {
    let product = await Security.findById(productId);
    if (!product) {
      product = await Fences.findById(productId);
    }
    return product;
  } catch (error) {
    console.error('Ошибка при получении информации о товаре:', error);
    throw error;
  }
}

async function addToDatabase(productId, chatId) {
  try {
    let product = await Security.findById(productId);
    if (!product) {
      product = await Fences.findById(productId);
    }
    if (product) {
      const order = {
        name: product.name,
        price: product.price,
      };

      console.log('Найден продукт:', product);

      const client = await Clients.findOne({ userId: chatId });
      console.log('Найден клиент:', client);

      client.orders.push(order);
      console.log('Заказ добавлен в массив заказов клиента:', client);

      await client.save();
      console.log('Клиент успешно сохранен:', client);
    }
  } catch (error) {
    console.error('Помилка при додаванні товару до бази даних:', error);
    throw error;
  }
}

bot.onText(/^(Каталог)$/i, async (msg) => {
  const chatId = msg.chat.id;
  const options = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Безпека', callback_data: 'catalog_security' },
          { text: 'Огородження', callback_data: 'catalog_fences' }
        ]
      ]
    }
  };
  bot.sendMessage(chatId, 'Оберіть категорію каталогу:', options);
});
bot.onText(/^(Залишити повідомлення ✍️)$/i, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Вибачте, функція "Повідомлення" ще не реалізована.');
});
bot.onText(/^(Мої замовлення 📋)$/i, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Вибачте, функція "Замовлення" ще не реалізована.');
});
bot.onText(/^(Кошик 🛒)$/i, async (msg) => {
  const chatId = msg.chat.id;
  if (!shoppingCarts[chatId] || shoppingCarts[chatId].length === 0) {
    bot.sendMessage(chatId, 'Ваш кошик порожній.');
    return;
  }

  let cartContent = '';
  for (const productId of shoppingCarts[chatId]) {
    let product;
    try {
      product = await Security.findById(productId);
      if (!product) {
        product = await Fences.findById(productId);
      }
      if (product) {
        cartContent += `Назва: ${product.name}\nЦіна: ${product.price} грн\n\n`;
      }
    } catch (error) {
      console.error('Помилка при отриманні інформації про товар:', error);
    }
  }

  try {
    bot.sendMessage(chatId, cartContent);
    bot.sendMessage(chatId, 'Натисніть кнопку, щоб підтвердити замовлення:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Підтвердити замовлення', callback_data: 'order' }]
        ]
      }
    });
  } catch (error) {
    console.error('Помилка при відправці повідомлення:', error);
    bot.sendMessage(chatId, 'Виникла помилка. Спробуйте ще раз пізніше.');
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
              { text: 'Залишити повідомлення ✍️', callback_data: 'leave_message' }
            ],
            [
              { text: 'Мої замовлення 📋', callback_data: 'my_orders' },
              { text: 'Кошик 🛒', callback_data: 'cart' }
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
            { text: 'Залишити повідомлення ✍️', callback_data: 'leave_message' }
          ],
          [
            { text: 'Мої замовлення 📋', callback_data: 'my_orders' },
            { text: 'Кошик 🛒', callback_data: 'cart' }
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