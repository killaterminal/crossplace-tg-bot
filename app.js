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
  .then(() => console.log('Подключено к MongoDB'))
  .catch(err => console.error('Ошибка при подключении к MongoDB:', err));

const { Clients, Security, Fences, Repair } = require('./models');
const shoppingCarts = {};
const repairService = {};

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
  const targetURL = `tg://user?id=${chatId}`;
  const messageId = query.message.message_id;

  const addToCart = (chatId, productId, cartType) => {
    if (!cartType[chatId]) {
      cartType[chatId] = [];
    }
    cartType[chatId].push(productId);
    bot.sendMessage(chatId, 'Товар додано до кошика.');
  };

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

            const response = `*ID:* \`${object._id}\`\n*Назва:* ${object.name}\n*Категорія:* ${object.category}\n`; // + *Опис:* ${object.description}
            const options = {
              reply_markup: {
                inline_keyboard: [
                  [{
                    text: `До кошику 🛒 ${priceInUAH.toFixed(0)} грн`,
                    callback_data: `security_object_${object._id}_add_to_cart`
                  }],
                  [{
                    text: 'Детальніше',
                    callback_data: `details_security_object_${object._id}_details`
                  }]
                ]
              }
            };
            await bot.sendPhoto(chatId, object.image, { caption: response, parse_mode: 'Markdown', reply_markup: options.reply_markup });
          } else {
            console.log('Не удалось получить курс доллара. Невозможно вывести цены в долларах.');
          }
        });
      } else {
        bot.sendMessage(chatId, 'На жаль, немає доступних об\'єктів безпеки. 😐');
      }
    } catch (error) {
      console.error('Помилка отримання об\'єктів безпеки:', error);
      bot.sendMessage(chatId, 'Виникла помилка при отриманні об\'єктів безпеки. Спробуйте пізніше 🙁');
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
            const response = `*ID:* \`${object._id}\`\n*Назва:* ${object.name}\n*Категорія:* ${object.category}\n*Опис:* ${object.description}`;
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
      bot.sendMessage(chatId, 'Виникла помилка при отриманні огорож. Спробуйте пізніше 😔');
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
            const response = `*ID:* ${object._id}\n*Назва:* ${object.name}\n*Категорія:* ${object.category}\n*Опис:* ${object.description}`;
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
    }
    catch {
      bot.sendMessage(chatId, 'Виникла помилка при отриманні послуг ремонту. Спробуйте пізніше 🙄');
    }
  }
  //вывод услуг по ремонту
  else if (data === 'catalog_repair') {
    const chatId = query.message.chat.id;
    try {
      const fencesObjects = await Repair.find();
      if (fencesObjects && fencesObjects.length > 0) {
        for (const object of fencesObjects) {
          const exchangeRate = await getExchangeRate();
          if (exchangeRate) {
            const priceInUAH = object.price * exchangeRate;
            const response = `*ID:* \`${object._id}\`\n*Назва:* ${object.name}\n*Опис:* ${object.description}\n`;

            let options = {
              reply_markup: {
                inline_keyboard: [
                  [{ text: `Хочу послугу 🛠️`, callback_data: `repair_object_${object._id}` }]
                ]
              }
            };

            if (object.image) {
              await bot.sendPhoto(chatId, object.image, { caption: response, parse_mode: 'Markdown', reply_markup: options.reply_markup });
            } else {
              await bot.sendMessage(chatId, response, { parse_mode: 'Markdown', reply_markup: options.reply_markup });
            }
          } else {
            console.log('Не удалось получить курс доллара. Невозможно вывести цены в долларах.');
          }
        }
      } else {
        bot.sendMessage(chatId, 'На жаль, немає доступних послуг по ремонту. 😐');
      }

    } catch (error) {
      console.error('Ошибка при получении услуг ремонта:', error);
      bot.sendMessage(chatId, 'Виникла помилка при полсуг. Спробуйте пізніше 😔');
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
  else if (data.startsWith('repair_object_')) {
    const productId = data.split('_')[2];
    if (!repairService[chatId]) {
      repairService[chatId] = [];
    }
    repairService[chatId].push(productId);
    bot.sendMessage(chatId, 'Товар додано до кошика.');
  }
  else if (data.startsWith('details_security_object_') && data.endsWith('_details')) {
    const objectId = data.split('_')[3];
    await bot.sendMessage(chatId, "Object id: " + objectId);
    try {
      const object = await Security.findById(objectId);
      if (object) {
        const response = `*Назва:* ${object.name}\n*Категорія:* ${object.category}\n*Опис:* ${object.description}`;
        await bot.sendMessage(chatId, response, {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Закрити', callback_data: 'close_alert' }]
            ]
          }
        });
      } else {
        await bot.sendMessage(chatId, 'Не вдалося знайти деталі цього товару. 😔');
      }
    } catch (error) {
      console.error('Помилка отримання деталей товару:', error);
      await bot.sendMessage(chatId, 'Виникла помилка при отриманні деталей товару. Спробуйте пізніше 😔');
    }
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

      const qrCodeImageBuffer = await QRCode.toBuffer(targetURL);

      const startX = pdfDoc.page.width - 150;
      const startY = 50;

      pdfDoc.image(qrCodeImageBuffer, startX, startY, { fit: [100, 100], align: 'right' });
      pdfDoc.fontSize(16);
      pdfDoc.text(`Замовлення №${chatId}\n\n`, 50, startY);
      pdfDoc.fontSize(12);

      let totalPrice = 0;

      const exchangeRate = await getExchangeRate();
      if (exchangeRate) {
        const startYTable = 150;
        const rowHeight = 20; // высота строки
        const columnWidths = [50, 300, 100]; // ширина каждого столбца

        pdfDoc.text('№', 70, startYTable);
        pdfDoc.text('Назва товару', 100, startYTable);
        pdfDoc.text('Ціна (грн)', 400, startYTable);

        pdfDoc.moveTo(45, startYTable + 15).lineTo(500, startYTable + 15).stroke();

        let currentY = startYTable + rowHeight;
        let productIndex = 1;

        for (const productId of shoppingCarts[chatId]) {
          const product = await getProductById(productId);
          if (product) {
            const priceInUAH = product.price * exchangeRate;
            totalPrice += priceInUAH;

            pdfDoc.rect(45, currentY - rowHeight, 455, rowHeight).stroke();

            pdfDoc.text(productIndex, 50, currentY, { width: columnWidths[0], align: 'center' });
            pdfDoc.text(product.name, 100, currentY, { width: columnWidths[1], height: rowHeight, align: 'left', continued: false });
            pdfDoc.text(priceInUAH.toFixed(0), 350, currentY, { width: columnWidths[2], align: 'right' });

            currentY += rowHeight;
            productIndex++;
          }
        }

        pdfDoc.moveTo(45, currentY).lineTo(500, currentY).stroke();

        const totalRowY = currentY;
        pdfDoc.rect(45, totalRowY - rowHeight, 455, rowHeight).stroke();

        // pdfDoc.text('Загальна сума:', 50, totalRowY, { width: columnWidths[0], align: 'center' });
        pdfDoc.text(`Загальна сума: ${totalPrice.toFixed(0)} грн`, 50, totalRowY + 2, { width: 500, align: 'left' });

        pdfDoc.moveTo(45, totalRowY + rowHeight).lineTo(500, totalRowY + rowHeight).stroke();

        const infoStartY = totalRowY + rowHeight + 20;

        const formattedDate = moment(new Date()).locale('ru').format('DD.MM.YYYY, HH:mm:ss');


        const existingClient = await Clients.findOne({ userId: chatId });
        if (existingClient) {
          const phone_number = existingClient.phoneNumber;
          pdfDoc.text(`Номер телефону замовника: ${phone_number}`, 50, infoStartY);
          pdfDoc.text(`Дата створення замовлення: ${formattedDate}`, 50, infoStartY + 15);
        } else {
          console.log("Клиент не найден");
          pdfDoc.text(`Клієнт незареєстрований`, 50, infoStartY);
        }
      } else {
        console.log('Не удалось получить курс доллара. Невозможно вывести цены в долларах.');
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

        const userLink = chatId ? `<a href="tg://user?id=${chatId}">${name}</a>` : name;

        const response = await axios.post(`https://api.telegram.org/bot${adminBotToken}/sendDocument`, {
          chat_id: adminChatId,
          document: fs.createReadStream(`order_${chatId}.pdf`),
          caption: `Заказ от пользователя ${targetURL}\n`,
          parse_mode: 'HTML',
        }, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        console.log('Сообщение отправлено администратору:', response.data);

        bot.sendMessage(chatId, 'Дякуємо за замовлення. З вами зв\'яжуться найближчим часом.');
      });
    } catch (error) {
      console.error('Помилка при оформленні заказу:', error);
      bot.sendMessage(chatId, 'Помилка при оформленні заказу.');
    }
  }
  else if (data.startsWith('show_more_orders:')) {
    const start = parseInt(data.split(':')[1]);

    try {
      const client = await Clients.findOne({ userId: chatId });

      if (client) {
        const orders = client.orders;
        const exchangeRate = await getExchangeRate();
        sendOrderChunk(chatId, orders, start, exchangeRate); // отправляем следующую часть
      } else {
        bot.sendMessage(chatId, 'Вибачте, ви не зареєстровані в нашій системі.');
      }
    } catch (error) {
      console.error('Помилка при отриманні замовлень:', error);
      bot.sendMessage(chatId, 'Виникла помилка при отриманні замовлень.');
    }
  }
  else if (data === 'close_alert') {
    await bot.deleteMessage(chatId, messageId);
  }
});

bot.onText(/^(Каталог 🔎)$/i, async (msg) => {
  const chatId = msg.chat.id;
  const options = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Безпека', callback_data: 'catalog_security' },
          { text: 'Огородження', callback_data: 'catalog_fences' },
          { text: 'Ремонт', callback_data: 'catalog_repair' }
        ]
      ]
    }
  };
  bot.sendMessage(chatId, 'Оберіть категорію каталогу:', options);
});

const waitingForMessage = new Map();
bot.onText(/^(Залишити повідомлення ✍️)$/i, async (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(chatId, 'Будь ласка, введіть своє повідомлення:');

  waitingForMessage.set(chatId, true);
});
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const messageText = msg.text;
  const userLink = `tg://user?id=${chatId}`

  if (waitingForMessage.get(chatId)) {
    try {
      const response = await axios.post(`https://api.telegram.org/bot${adminBotToken}/sendMessage`, {
        chat_id: adminChatId,
        text: `Сообщение от пользователя Telegram ${userLink}:\n${messageText}`,
        parse_mode: 'HTML'
      });

      console.log('Повідомлення відправлено адміністратору:', response.data);

      bot.sendMessage(chatId, 'Ваше повідомлення відправлено. Дякуємо за обережність!');

      waitingForMessage.delete(chatId);
    } catch (error) {
      console.error('Помилка при обробці повідомлення:', error);
      bot.sendMessage(chatId, 'Виникла помилка при обробці вашого повідомлення. Спробуйте ще раз пізніше.');
    }
  }
});

const CHUNK_SIZE = 5;
const MAX_MESSAGE_LENGTH = 4000;
bot.onText(/^(Мої замовлення 📋)$/i, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const client = await Clients.findOne({ userId: chatId });

    if (client) {
      const orders = client.orders;

      if (orders.length > 0) {
        let message = 'Ваші замовлення:\n';
        const exchangeRate = await getExchangeRate();
        sendOrderChunk(chatId, orders, 0, exchangeRate); // начинаем с 0

        orders.forEach((order, index) => {
          const formattedDate = moment(order.date).locale('ru').format('DD.MM.YYYY, HH:mm:ss');

          message += `${index + 1}. Назва: ${order.name}\nЦіна: ${order.price * exchangeRate} грн\nДата: ${formattedDate}\n\n`;
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

const sendOrderChunk = (chatId, orders, start, exchangeRate, messageId) => {
  let message = 'Ваші замовлення:\n';
  const end = Math.min(start + CHUNK_SIZE, orders.length);

  for (let i = start; i < end; i++) {
    const order = orders[i];
    const formattedDate = moment(order.date).locale('ru').format('DD.MM.YYYY, HH:mm:ss');
    message += `${i + 1}. Назва: ${order.name}\nЦіна: ${(order.price * exchangeRate).toFixed(2)} грн\nДата: ${formattedDate}\n\n`;

    if (message.length >= MAX_MESSAGE_LENGTH) {
      break;
    }
  }

  const options = {
    reply_markup: {
      inline_keyboard: []
    }
  };

  if (start > 0) {
    options.reply_markup.inline_keyboard.push([{
      text: 'Назад',
      callback_data: `show_previous_orders:${start}`
    }]);
  }

  if (end < orders.length) {
    options.reply_markup.inline_keyboard.push([{
      text: 'Показати ще',
      callback_data: `show_more_orders:${end}`
    }]);
  }

  if (messageId) {
    bot.deleteMessage(chatId, messageId).then(() => {
      bot.sendMessage(chatId, message, options);
    });
  } else {
    bot.sendMessage(chatId, message, options);
  }
};

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
//добавление нового заказа клиента в БД
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

    console.log('Новый клиент сохранён в БД:', newClient);

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
    console.error('Ошибка при сохрнанении нового клиента:', error);
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

    const roundTo = (num) => Math.round(num / 5) * 5;

    const roundedUsdRate = roundTo(usdRate.rate);

    return roundedUsdRate;
  } catch (error) {
    console.error('Ошибка при получении курса доллара:', error);
    return null;
  }
};