const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

async function checkCyrillic(ctx, workbook) {
  const sheetNames = workbook.SheetNames;
  let result = [];

  // Функция для проверки наличия кириллических символов
  function containsCyrillic(text) {
    return /[а-яА-ЯЁё]/.test(text);
  }

  // Проверяем второй столбец на всех листах
  sheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const cell = row[1]; // Второй столбец

      if (cell && containsCyrillic(cell.toString())) {
        result.push(`Лист ${sheetName}, строка ${i + 1}, столбец B: ${cell}`);
      }
    }
  });

  // Проверяем четвертый столбец только на первом и третьем листе
  const sheetsToCheck = [sheetNames[0], sheetNames[2]]; // Первый и третий лист

  sheetsToCheck.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const cell = row[3]; // Четвертый столбец

      if (cell && containsCyrillic(cell.toString())) {
        result.push(`Лист ${sheetName}, строка ${i + 1}, столбец D: ${cell}`);
      }
    }
  });

  if (result.length === 0) {
    await ctx.reply('Кириллические символы не найдены.');
  } else {
    const resultMessage = result.join('\n');
    const filePath = path.join(__dirname, '..', 'Result.txt');
    fs.writeFileSync(filePath, resultMessage);

    await ctx.replyWithDocument({ source: filePath });

    fs.unlinkSync(filePath);
  }

}

module.exports = { checkCyrillic };