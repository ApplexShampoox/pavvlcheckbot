const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

async function checkIdName(ctx, workbook) {
  const sheetNames = workbook.SheetNames;
  let result = [];

  // Объекты для проверки уникальности
  let nameToIdMap = {};
  let idToNameMap = {};

  sheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    for (let i = 1; i < data.length; i++) {
      const id = data[i][0];
      const name = data[i][2];

      // Пропускаем пустые строки или строки с пробелами
      if (!id || !name || typeof id !== 'string' || typeof name !== 'string' || id.trim() === '' || name.trim() === '') {
        continue;
      }

      // Заполняем карты для проверки уникальности
      if (nameToIdMap[name]) {
        if (nameToIdMap[name] !== id) {
          result.push(`Несоответствие на листе ${sheetName}: Название "${name}" связано с несколькими ID: ${nameToIdMap[name]}, ${id}`);
        }
      } else {
        nameToIdMap[name] = id;
      }

      if (idToNameMap[id]) {
        if (idToNameMap[id] !== name) {
          result.push(`Несоответствие на листе ${sheetName}: ID "${id}" связано с несколькими названиями: ${idToNameMap[id]}, ${name}`);
        }
      } else {
        idToNameMap[id] = name;
      }
    }
  });

  const resultMessage = result.length === 0 ?
    'У каждого шаблона свой уникальный ИД.' :
    result.join('\n');

  const filePath = path.join(__dirname, '..', 'Result.txt');
  fs.writeFileSync(filePath, resultMessage);

  await ctx.replyWithDocument({ source: filePath });
  fs.unlinkSync(filePath);
}

module.exports = { checkIdName };