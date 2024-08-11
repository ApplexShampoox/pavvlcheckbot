const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const xlsx = require('xlsx');
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const session = require('./session');
bot.use(session.middleware());

// Сюда подключать новые функции (импорт из папки actions)
const { checkIdName } = require('./actions/checkIdName');
const { checkCyrillic } = require('./actions/checkCyrillic');
const { checkLongContent } = require('./actions/checkLongContent');
const { checkDouble } = require('./actions/checkDouble')

//При старте бота добавляем кнопку для вызова каждой функции в формате [Markup.button.callback('Надпись на кнопке','Название импортированной выше функции')]
bot.start((ctx) => {
  ctx.reply('Выберите действие:', Markup.inlineKeyboard([
    [Markup.button.callback('Проверка идентичности ID и названия шаблонов', 'checkIdName')],
    [Markup.button.callback('Проверка наличия кириллических символов', 'checkCyrillic')],
    [Markup.button.callback('Проверка на наличие строк > 4096 символов', 'checkLongContent')],
    [Markup.button.callback('Проверка на наличие дублей услуг', 'checkDouble')]
  ]));
});

//Блок добавления действий бота после нажатия кнопки (сообщение предлагающее пользователю загрузить файл и присвоение ИД этому файлу для определения, для какой функции он был загружен)
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

//Добавление кнопки возврата в меню выбора функции (также при добавлении новой функции сюда нужно добавить кнопку по примеру выше)
bot.action('backToMenu', (ctx) => {
  ctx.reply('Выберите действие:', Markup.inlineKeyboard([
    [Markup.button.callback('Проверка ID и названия', 'checkIdName')],
    [Markup.button.callback('Проверка кириллических символов', 'checkCyrillic')],
    [Markup.button.callback('Проверка на строку > 4096', 'checkLongContent')],
    [Markup.button.callback('Проверка на наличие дублей услуг', 'checkDouble')]
  ]));
  ctx.session.waitingForFile = false; // Сброс состояния ожидания файла при возврате в меню
});

bot.on('document', async (ctx) => {
  if (ctx.session.waitingForFile) {
    const fileId = ctx.message.document.file_id;
    const fileLink = await bot.telegram.getFileLink(fileId);

    try {
      const response = await axios.get(fileLink, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data, 'binary');
      const workbook = xlsx.read(buffer, { type: 'buffer' });

      //Определение системой какую функцию вызывать на основе ИД загруженного пользователем файла
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
        // Добавляйте новые функции здесь
        default:
          ctx.reply('Неизвестное действие. Пожалуйста, попробуйте снова.');
          break;
      }
      // Сообщение после обработки файла
      ctx.reply('Загрузите следующий xlsx файл или вернитесь в меню.', Markup.inlineKeyboard([
        Markup.button.callback('Вернуться в меню', 'backToMenu')
      ]));

      // Установка состояния ожидания файла для текущей функции
      ctx.session.waitingForFile = {
        'checkIdName': 'checkIdName',
        'checkCyrillic': 'checkCyrillic',
        'checkLongContent': 'checkLongContent',
        'checkDouble': 'checkDouble'
      }[ctx.session.waitingForFile];

    } catch (error) {
      console.error('Ошибка при обработке файла:', error);
      ctx.reply('Произошла ошибка при обработке файла. Пожалуйста, попробуйте снова.');
    }
  } else {
    ctx.reply('Пожалуйста, выберите действие сначала.');
  }
});

bot.launch();