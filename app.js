const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const mongoose = require('mongoose');
const QRCode = require('qrcode');
const moment = require('moment');
const axios = require('axios');

const { token, adminBotToken, adminChatId } = require('./config');
const { fontPath, databaseURL } = require('./config');

const bot = new TelegramBot(token, { polling: true });

mongoose.connect(databaseURL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Підключено до MongoDB'))
  .catch(err => console.error('Помилка підключення до MongoDB:', err));

const { Clients, Security, Fences, Repair } = require('./models');

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const { first_name: firstName } = msg.from;
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
  bot.sendMessage(chatId, `Привіт, ${firstName} 👋🏼! Натисни кнопку "Зареєструватися", щоб почати процес реєстрації. 🖇`, opts);
});

//обработчик команд
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const name = query.message.chat.first_name;
  //команда регистрации
  if (data === 'register') {
    bot.sendMessage(chatId, 'Будь-ласка, відправ свій номер, щоб завершити реєстрацію. ✌🏼', {
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
  //команда вывода товаров безопасноти
  else if (data === 'catalog_security') {
    const chatId = query.message.chat.id;
    try {
      const securityObjects = await Security.find();
      if (securityObjects && securityObjects.length > 0) {
        securityObjects.forEach(async (object) => {
          const exchangeRate = await getExchangeRate();
          if (exchangeRate) {
            const priceInUAH = object.price * exchangeRate;

            const response = `*ID:* \`${object._id}\`\n*Назва:* ${object.name}\n*Категорія:* ${object.category}\n*Опис:* ${object.description}`;
            const options = {
              reply_markup: {
                inline_keyboard: [
                  [{ text: `До кошику 🛒 ${priceInUAH.toFixed(0)} грн`, callback_data: `security_object_${object._id}` }]
                ]
              }
            };
            bot.sendPhoto(chatId, object.image, { caption: response, parse_mode: 'Markdown', reply_markup: options.reply_markup });
          } else {
            console.log('Не удалось получить курс доллара. Невозможно вывести цены в долларах.');
          }
        });
      } else {
        bot.sendMessage(chatId, 'На жаль, немає доступних об\'єктів безпеки. 😐');
      }
    } catch (error) {
      console.error('Помилка отримання об\'єктів безпеки:', error);
      bot.sendMessage(chatId, 'Виникла помилка при отриманні об\'єктів безпеки 🙁 Спробуйте пізніше');
    }
  }
  //команда вывода товаров ограждения
  else if (data === 'catalog_fences') {
    const chatId = query.message.chat.id;
    try {
      const fencesObjects = await Fences.find();
      if (fencesObjects && fencesObjects.length > 0) {
        fencesObjects.forEach(async object => {
          const exchangeRate = await getExchangeRate();
          if (exchangeRate) {
            const priceInUAH = object.price * exchangeRate;
            const response = `*ID:* ${object._id}\n*Назва:* ${object.name}\n*Категорія:* ${object.category}\n*Крок:* ${object.step}\n*Опис:* ${object.description}`;
            const options = {
              reply_markup: {
                inline_keyboard: [
                  [{ text: `До кошику 🛒 ${priceInUAH.toFixed(0)} грн`, callback_data: `fences_object_${object._id}` }]
                ]
              }
            };
            await bot.sendPhoto(chatId, object.image, { caption: response, parse_mode: 'Markdown', reply_markup: options.reply_markup });
          } else {
            console.log('Не удалось получить курс доллара. Невозможно вывести цены в долларах.');
          }
        });
      } else {
        bot.sendMessage(chatId, 'На жаль, немає доступних огорож. 😐');
      }

    } catch (error) {
      console.error('Помилка отримання огорож:', error);
      bot.sendMessage(chatId, 'Виникла помилка при отриманні огорож 😔 Спробуйте пізніше');
    }
  }
  else if (data === 'catalog_fences') {
    const chatId = query.message.chat.id;
    try {
      const fencesObjects = await Fences.find();
      if (fencesObjects && fencesObjects.length > 0) {
        fencesObjects.forEach(async object => {
          const exchangeRate = await getExchangeRate();
          if (exchangeRate) {
            const priceInUAH = object.price * exchangeRate;
            const response = `*ID:* ${object._id}\n*Назва:* ${object.name}\n*Категорія:* ${object.category}\n*Крок:* ${object.step}\n*Опис:* ${object.description}`;
            const options = {
              reply_markup: {
                inline_keyboard: [
                  [{ text: `До кошику 🛒 ${priceInUAH.toFixed(0)} грн`, callback_data: `fences_object_${object._id}` }]
                ]
              }
            };
            await bot.sendPhoto(chatId, object.image, { caption: response, parse_mode: 'Markdown', reply_markup: options.reply_markup });
          } else {
            console.log('Не удалось получить курс доллара. Невозможно вывести цены в долларах.');
          }
        });
      } else {
        bot.sendMessage(chatId, 'На жаль, немає доступних огорож.');
      }
    }
    catch {
      bot.sendMessage(chatId, 'Виникла помилка при отриманні послуг ремонту 🙄 Спробуйте пізніше.');
    }
  }
  //добавление товаров безопасноти в корзину
  else if (data.startsWith('security_object_')) {
    const productId = data.split('_')[2];
    if (!shoppingCarts[chatId]) {
      shoppingCarts[chatId] = [];
    }
    shoppingCarts[chatId].push(productId);
    bot.sendMessage(chatId, 'Товар додано до кошика.');
  }
  //добавление товаров ограждения в корзину
  else if (data.startsWith('fences_object_')) {
    const productId = data.split('_')[2];
    if (!shoppingCarts[chatId]) {
      shoppingCarts[chatId] = [];
    }
    shoppingCarts[chatId].push(productId);
    bot.sendMessage(chatId, 'Товар додано до кошика.');
  }
  //формирование заказа
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
          const exchangeRate = await getExchangeRate();
          if (exchangeRate) {
            const priceInUAH = product.price * exchangeRate;
            message += `Назва: ${product.name}\nЦіна: ${priceInUAH.toFixed(0)} грн\n\n`;
          }
        } else {
          console.log('Не удалось получить курс доллара. Невозможно вывести цены в долларах.');
        }
      } catch (error) {
        console.error('Помилка при отриманні інформації про товар:', error);
      }
    }

    bot.sendMessage(chatId, message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Змінити заказ', callback_data: 'change_order' }],
          [{ text: 'Оформити заказ', callback_data: 'accept_order' }]
        ]
      }
    });
  }
  //изменение заказа (очиска корзины)
  else if (data === 'change_order') {
    shoppingCarts[chatId] = [];
    bot.sendMessage(chatId, 'Кошик очищений.');
  }
  //формирование ПДФ файла и отправка админ боту
  else if (data === 'accept_order') {
    try {
      const pdfDoc = new PDFDocument({ margin: 50, font: fontPath });
      const writeStream = fs.createWriteStream(`order_${chatId}.pdf`);
      pdfDoc.pipe(writeStream);

      const targetURL = `tg://user?id=${chatId}`;
      const qrCodeImageBuffer = await QRCode.toBuffer(targetURL);

      const startX = pdfDoc.page.width - 150;
      const startY = 50;

      pdfDoc.image(qrCodeImageBuffer, startX, startY, { fit: [100, 100], align: 'right' });
      pdfDoc.text(`Замовлення №${chatId}\n\n`, 50, startY);

      let totalPrice = 0;

      const exchangeRate = await getExchangeRate();
      if (exchangeRate) {
        for (const productId of shoppingCarts[chatId]) {
          const product = await getProductById(productId);
          if (product) {
            const priceInUAH = product.price * exchangeRate;
            totalPrice += priceInUAH
            pdfDoc.text(`Назва товару: ${product.name}\nЦіна: ${priceInUAH.toFixed(0)} грн\n\n`);
          }
        }
      } else {
        console.log('Не удалось получить курс доллара. Невозможно вывести цены в долларах.');
      }

      pdfDoc.text(`Загальна сума замовлення: ${totalPrice.toFixed(0)} грн\n\n`);

      const formattedDate = moment(new Date()).locale('ru').format('DD.MM.YYYY, HH:mm:ss');

      const existingClient = await Clients.findOne({ userId: chatId });
      if (existingClient) {
        const phone_number = existingClient.phoneNumber;
        pdfDoc.text(`Номер телефону замовника: ${phone_number}`);
        pdfDoc.text(`Дата створення замовлення: ${formattedDate}`)
      } else {
        console.log("Клиент не найден");
        pdfDoc.text(`Клієнт незареєстрований`);
      }

      pdfDoc.end();

      writeStream.on('finish', async () => {
        for (const productId of shoppingCarts[chatId]) {
          addToDatabase(productId, chatId, chatId);
        }
        shoppingCarts[chatId] = [];
        bot.sendDocument(chatId, `order_${chatId}.pdf`, {
          caption: 'Замовлення оформлено. Ваше замовлення у прикріпленому PDF-файлі.'
        });

        const userLink = `<a href="tg://user?id=${chatId}">${name}</a>`;

        const response = await axios.post(`https://api.telegram.org/bot${adminBotToken}/sendDocument`, {
          chat_id: adminChatId,
          document: fs.createReadStream(`order_${chatId}.pdf`),
          caption: `Заказ от пользователя ${userLink}\n`,
          parse_mode: 'HTML',
        }, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        console.log('Сообщение отправлено администратору:', response.data);

        bot.sendMessage(chatId, 'Дякуємо за замовлення. З вами зв\'яжуться найближчим часом.')
      });
    } catch (error) {
      console.error('Помилка при оформленні заказу:', error);
      bot.sendMessage(chatId, 'Помилка при оформленні заказу.');
    }
  }
});

bot.onText(/^(Каталог 🔎)$/i, async (msg) => {
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
  const messageText = msg.text;

  try {
    const response = await axios.post(`https://api.telegram.org/bot${adminBotToken}/sendMessage`, {
      chat_id: adminChatId,
      text: `Сообщение от пользователя ${chatId}:\n${messageText}`,
    });

    console.log('Сообщение отправлено администратору:', response.data);

    bot.sendMessage(chatId, 'Ваше повідомлення отримано. Дякуємо за обережність!');
  } catch (error) {
    console.error('Помилка при обробці повідомлення:', error);
    bot.sendMessage(chatId, 'Виникла помилка при обробці вашого повідомлення. Спробуйте ще раз пізніше.');
  }
});

bot.onText(/^(Мої замовлення 📋)$/i, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const client = await Clients.findOne({ userId: chatId });

    if (client) {
      const orders = client.orders;

      if (orders.length > 0) {
        let message = 'Ваші замовлення:\n';
        orders.forEach((order, index) => {
          const formattedDate = moment(order.date).locale('ru').format('DD.MM.YYYY, HH:mm:ss');

          message += `${index + 1}. Назва: ${order.name}\nЦіна: ${order.price} грн\nДата: ${formattedDate}\n\n`;
        });

        bot.sendMessage(chatId, message);
      } else {
        bot.sendMessage(chatId, 'У вас ще немає замовлень.');
      }
    } else {
      bot.sendMessage(chatId, 'Вибачте, ви не зареєстровані в нашій системі.');
    }
  } catch (error) {
    console.error('Помилка при отриманні замовлень:', error);
    bot.sendMessage(chatId, 'Виникла помилка при отриманні замовлень.');
  }
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
        const exchangeRate = await getExchangeRate();
        if (exchangeRate) {
          const priceInUAH = product.price * exchangeRate;
          cartContent += `Назва: ${product.name}\nЦіна: ${priceInUAH.toFixed(0)} грн\n\n`;
        }
        else {
          console.log('Не удалось получить курс доллара. Невозможно вывести цены в долларах.');
        }
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
//получить товары
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
//добавление нового клиента в БД и проверка на уже существующего клиента
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
        date: new Date()
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
//отправка номера (как контакт) для дальнейшней работы с клиентом 
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
              { text: 'Каталог 🔎', callback_data: 'catalog' },
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
            { text: 'Каталог 🔎', callback_data: 'catalog' },
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
//курс доллара
const getExchangeRate = async () => {
  try {
    const response = await axios.get('https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json');
    const usdRate = response.data.find(currency => currency.cc === 'USD');
    return usdRate.rate;
  } catch (error) {
    console.error('Ошибка при получении курса доллара:', error);
    return null;
  }
};