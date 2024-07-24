const { Telegraf, Markup } = require('telegraf');
const LocalSession = require('telegraf-session-local');
const xlsx = require('xlsx');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);

// Подключаем локальную сессию
bot.use(new LocalSession({ database: 'session_db.json' }).middleware());

bot.start((ctx) => {
  ctx.reply('Выберите действие:', Markup.inlineKeyboard([
    [Markup.button.callback('Проверка ID и названия', 'check_id_name')],
    [Markup.button.callback('Проверка кириллических символов', 'check_cyrillic')]
  ]));
});

bot.action('check_id_name', (ctx) => {
  ctx.reply('Пожалуйста, загрузите xlsx файл для проверки ID и названия.');
  ctx.session.waitingForFile = 'check_id_name';
});

bot.action('check_cyrillic', (ctx) => {
  ctx.reply('Пожалуйста, загрузите xlsx файл для проверки кириллических символов.');
  ctx.session.waitingForFile = 'check_cyrillic';
});

bot.action('back_to_menu', (ctx) => {
  ctx.reply('Выберите действие:', Markup.inlineKeyboard([
    [Markup.button.callback('Проверка ID и названия', 'check_id_name')],
    [Markup.button.callback('Проверка кириллических символов', 'check_cyrillic')]
  ]));
});

bot.on('document', async (ctx) => {
  if (ctx.session.waitingForFile) {
    const fileId = ctx.message.document.file_id;
    const fileLink = await bot.telegram.getFileLink(fileId);

    try {
      // Скачиваем файл
      const response = await axios.get(fileLink, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data, 'binary');
      const workbook = xlsx.read(buffer, { type: 'buffer' });

      let result = [];

      if (ctx.session.waitingForFile === 'check_id_name') {
        // Логика проверки ID и названия
        const sheetNames = workbook.SheetNames;

        sheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

          let nameIdMap = {};

          for (let i = 1; i < data.length; i++) {
            const id = data[i][0];
            const name = data[i][2];

            if (!nameIdMap[name]) {
              nameIdMap[name] = new Set();
            }
            nameIdMap[name].add(id);
          }

          for (const [name, ids] of Object.entries(nameIdMap)) {
            if (ids.size > 1) {
              result.push(`Несоответствие на листе ${sheetName}: Название "${name}" имеет следующие ID: ${Array.from(ids).join(', ')}`);
            }
          }
        });

        const resultMessage = result.length === 0 ?
          'Все строки с одинаковыми названиями имеют одинаковые ID.' :
          result.join('\n');

        const filePath = path.join(__dirname, 'result.txt');
        fs.writeFileSync(filePath, resultMessage);

        await ctx.replyWithDocument({ source: filePath });
        fs.unlinkSync(filePath);
      } else if (ctx.session.waitingForFile === 'check_cyrillic') {
        // Логика проверки кириллических символов

        const sheetName = workbook.SheetNames[0]; // Проверяем только первый лист
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

        function containsCyrillic(text) {
          return /[а-яА-ЯЁё]/.test(text);
        }

        for (let i = 1; i < data.length; i++) { // Начинаем с 1, чтобы пропустить заголовок
          const row = data[i];
          const cell = row[3]; // Четвёртый столбец (индекс 3)
          if (cell && containsCyrillic(cell.toString())) {
            result.push(`Лист ${sheetName}, строка ${i + 1}: ${cell}`);
          }
        }

        const resultMessage = result.length === 0 ?
          'Кириллические символы не найдены в 4-ом столбце.' :
          result.join('\n');

        await ctx.reply(resultMessage);
      }

      // Ставим состояние ожидания файла обратно для возможности загрузки нового файла
      ctx.session.waitingForFile = false;

      // Отправляем кнопку для возврата в меню
      ctx.reply('Что вы хотите сделать дальше?', Markup.inlineKeyboard([
        Markup.button.callback('Вернуться в меню', 'back_to_menu')
      ]));
    } catch (error) {
      console.error('Ошибка при обработке файла:', error);
      ctx.reply('Произошла ошибка при обработке файла. Пожалуйста, попробуйте снова.');
    }
  } else {
    ctx.reply('Пожалуйста, выберите действие сначала.');
  }
});

bot.launch();