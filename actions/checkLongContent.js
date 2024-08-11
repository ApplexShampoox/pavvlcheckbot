const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

async function checkLongContent(ctx, workbook) {
  let result = [];

  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];

    for (let cell in sheet) {
      if (cell[0] === '!') continue; // Пропускаем служебные данные

      const cellValue = sheet[cell].v;
      if (typeof cellValue === 'string' && cellValue.length > 4096) {
        result.push(`Лист: ${sheetName}, Ячейка: ${cell}, Содержимое: ${cellValue}`);
      }
    }
  });

  // Если есть ячейки с длинным содержимым, записываем результат в файл и отправляем его
  if (result.length > 0) {
    const resultMessage = result.join('\n');
    const filePath = path.join(__dirname, '..', 'Result.txt');
    fs.writeFileSync(filePath, resultMessage);

    await ctx.replyWithDocument({ source: filePath });
    fs.unlinkSync(filePath);
  } else {
    // Если нет ячеек с длинным содержимым, отправляем сообщение напрямую
    await ctx.reply('Нет ячеек с содержимым длиной более 4096 символов.');
  }
}

module.exports = { checkLongContent };