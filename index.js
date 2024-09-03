const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const xlsx = require('xlsx');
const fs = require('fs'); // Для работы с файлами
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const session = require('./session');
bot.use(session.middleware());

// Middleware для логирования активности
bot.use((ctx, next) => {
  const userInfo = `User: ${ctx.from.id} - ${ctx.from.username || 'unknown'} (${ctx.from.first_name || ''} ${ctx.from.last_name || ''})`;
  const actionInfo = `Action: ${ctx.updateType} - ${ctx.message?.text || ctx.callbackQuery?.data || ''}`;
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} - ${userInfo} - ${actionInfo}\n`;

  // Сохранение в файл
  fs.appendFile('bot_activity.log', logEntry, (err) => {
    if (err) console.error('Ошибка записи лога:', err);
  });

  return next(); // Передача управления следующему middleware
});

// Сюда подключать новые функции (импорт из папки actions)
const { checkIdName } = require('./actions/checkIdName');
const { checkCyrillic } = require('./actions/checkCyrillic');
const { checkLongContent } = require('./actions/checkLongContent');
const { checkDouble } = require('./actions/checkDouble');

// При старте бота добавляем кнопку для вызова каждой функции
bot.start((ctx) => {
  ctx.reply('Выберите действие:', Markup.inlineKeyboard([
    [Markup.button.callback('Проверка идентичности ID и названия шаблонов', 'checkIdName')],
    [Markup.button.callback('Проверка наличия кириллических символов', 'checkCyrillic')],
    [Markup.button.callback('Проверка на наличие строк > 4096 символов', 'checkLongContent')],
    [Markup.button.callback('Проверка на наличие дублей услуг', 'checkDouble')]
  ]));
});

// Блок добавления действий бота после нажатия кнопки
bot.action('checkIdName', (ctx) => {
  ctx.reply('Загрузите xlsx файл для проверки уникальности ID и названия.');
  ctx.session.waitingForFile = 'checkIdName';
});

bot.action('checkCyrillic', (ctx) => {
  ctx.reply('Загрузите xlsx файл для проверки наличия кириллических символов.');
  ctx.session.waitingForFile = 'checkCyrillic';
});

bot.action('checkLongContent', (ctx) => {
  ctx.reply('Загрузите xlsx файл для поиска ячеек, в которых больше 4096 символов');
  ctx.session.waitingForFile = 'checkLongContent';
});

bot.action('checkDouble', (ctx) => {
  ctx.reply('Загрузите xlsx файл для поиска дублирующихся услуг');
  ctx.session.waitingForFile = 'checkDouble';
});

// Кнопка возврата в меню выбора функции
bot.action('backToMenu', (ctx) => {
  ctx.reply('Выберите действие:', Markup.inlineKeyboard([
    [Markup.button.callback('Проверка ID и названия', 'checkIdName')],
    [Markup.button.callback('Проверка кириллических символов', 'checkCyrillic')],
    [Markup.button.callback('Проверка на строку > 4096', 'checkLongContent')],
    [Markup.button.callback('Проверка на наличие дублей услуг', 'checkDouble')]
  ]));
  ctx.session.waitingForFile = false; // Сброс состояния ожидания файла при возврате в меню
});

// Обработка загрузки файла
bot.on('document', async (ctx) => {
  if (ctx.session.waitingForFile) {
    const fileId = ctx.message.document.file_id;
    const fileLink = await bot.telegram.getFileLink(fileId);

    try {
      const response = await axios.get(fileLink, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data, 'binary');
      const workbook = xlsx.read(buffer, { type: 'buffer' });

      // Определение системы, какую функцию вызывать на основе ID загруженного пользователем файла
      switch (ctx.session.waitingForFile) {
        case 'checkIdName':
          await checkIdName(ctx, workbook);
          break;
        case 'checkCyrillic':
          await checkCyrillic(ctx, workbook);
          break;
        case 'checkLongContent':
          await checkLongContent(ctx, workbook);
          break;
        case 'checkDouble':
          await checkDouble(ctx, workbook);
          break;
        default:
          ctx.reply('Неизвестное действие. Пожалуйста, попробуйте снова.');
          break;
      }

      // Логирование успешной обработки файла
      fs.appendFile('bot_activity.log', `${new Date().toISOString()} - ${ctx.from.id} - Обработка файла успешно завершена для действия: ${ctx.session.waitingForFile}\n`, (err) => {
        if (err) console.error('Ошибка записи лога:', err);
      });

      // Сообщение после обработки файла
      ctx.reply('Загрузите следующий xlsx файл или вернитесь в меню.', Markup.inlineKeyboard([
        Markup.button.callback('Вернуться в меню', 'backToMenu')
      ]));

      // Сброс состояния ожидания файла
      ctx.session.waitingForFile = false;

    } catch (error) {
      console.error('Ошибка при обработке файла:', error);

      // Логирование ошибки
      fs.appendFile('bot_activity.log', `${new Date().toISOString()} - ${ctx.from.id} - Ошибка при обработке файла: ${error.message}\n`, (err) => {
        if (err) console.error('Ошибка записи лога:', err);
      });

      ctx.reply('Произошла ошибка при обработке файла. Пожалуйста, попробуйте снова.');
    }
  } else {
    ctx.reply('Пожалуйста, выберите действие сначала.');
  }
});

// Запуск бота
bot.launch();