const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

async function checkPrice(ctx, workbook) {
  const sheetNames = workbook.SheetNames;
  let result = [];

  // Переменные для проверки
  const nameToIdMap = {};
  const idToNameMap = {};
  const longCells = [];
  const emptyRows = [];
  const seenRows = new Set();
  const duplicatesCol1 = new Set();

  sheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    if (data.length === 0) {
      result.push(`Лист "${sheetName}" пуст.`);
      return;
    }

    // Проверяем заголовки
    const headers = data[0];
    if (headers[0] !== 'code' || headers[1] !== 'name') {
      result.push(`Ошибка на листе "${sheetName}": первые два столбца должны называться "code" и "name".`);
      return;
    }

    const col1Seen = new Set(); // Для проверки дубликатов в первом столбце

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const id = row[0];
      const name = row[1];

      // Проверка на пустые строки
      if (!id || !name) {
        emptyRows.push(`Лист "${sheetName}", строка ${i + 1} пуста (code: "${id || ''}", name: "${name || ''}").`);
        continue;
      }

      // Проверка на длину содержимого
      if (id.length > 512) longCells.push(`Лист "${sheetName}", строка ${i + 1}, столбец "code" (длина: ${id.length}).`);
      if (name.length > 512) longCells.push(`Лист "${sheetName}", строка ${i + 1}, столбец "name" (длина: ${name.length}).`);

      // Проверка уникальности в комбинации столбцов
      const combinedKey = `${id}|${name}`;
      if (seenRows.has(combinedKey)) {
        result.push(`Услуга (code: "${id}", name: "${name}") уже существует.`);
      } else {
        seenRows.add(combinedKey);
      }

      // Проверка уникальности в первом столбце
      if (col1Seen.has(id)) {
        duplicatesCol1.add(`Услуга "code" (ID: "${id}") уже существует.`);
      } else {
        col1Seen.add(id);
      }

      // Проверка связей между "code" и "name"
      if (nameToIdMap[name] && nameToIdMap[name] !== id) {
        result.push(`Услуга "${name}" связана с несколькими ID: ${nameToIdMap[name]}, ${id}.`);
      } else {
        nameToIdMap[name] = id;
      }

      if (idToNameMap[id] && idToNameMap[id] !== name) {
        result.push(`Услуга с ID "${id}" связана с несколькими названиями: ${idToNameMap[id]}, ${name}.`);
      } else {
        idToNameMap[id] = name;
      }
    }
  });

  if (emptyRows.length > 0) {
    result.push('Пустые строки:\n' + emptyRows.join('\n'));
  }
  if (longCells.length > 0) {
    result.push('Слишком длинные строки:\n' + longCells.join('\n'));
  }
  if (duplicatesCol1.size > 0) {
    result.push('Дубликаты в столбце "code":\n' + Array.from(duplicatesCol1).join('\n'));
  }

  if (result.length === 0) {
    result.push('Ошибок не обнаружено.');
  }

  const filePath = path.join(__dirname, '..', 'CheckResults.txt');
  fs.writeFileSync(filePath, result.join('\n'));

  await ctx.replyWithDocument({ source: filePath });
  fs.unlinkSync(filePath);
}


module.exports = { checkPrice };