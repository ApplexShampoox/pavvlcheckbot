const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

async function checkPrice(ctx, workbook) {
  const sheetNames = workbook.SheetNames;
  let result = [];

  // Для «один и тот же name — разные ID»
  // name => { codes: Set, rows: Set }
  const nameToCodes = new Map();

  // Для «один и тот же code — разные name»
  // code => { names: Set, rows: Set }
  const codeToNames = new Map();

  // Другие проверки
  const emptyRows = []; // Пустые code / name
  const longCells = []; // Слишком длинные code / name

  sheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    if (data.length === 0) {
      // Лист пустой — можно пропустить или записать warning
      return;
    }

    // Проверяем заголовки
    const headers = data[0];
    if (headers[0] !== 'code' || headers[1] !== 'name') {
      result.push('Ошибка заголовков: первые два столбца должны называться "code" и "name".');
      return;
    }

    // Обработка строк (начиная со 2-й)
    for (let i = 1; i < data.length; i++) {
      const rowNumber = i + 1; // человекочитаемый номер (без учёта листа)
      const row = data[i] || [];
      const code = row[0];
      const name = row[1];

      // Проверка на пустые
      if (!code || !name) {
        emptyRows.push(`Строка ${rowNumber} имеет пустой code или name.`);
        continue;
      }

      // Проверка длины
      if (code.length > 512) {
        longCells.push(`Строка ${rowNumber}, столбец "code" (длина: ${code.length}).`);
      }
      if (name.length > 512) {
        longCells.push(`Строка ${rowNumber}, столбец "name" (длина: ${name.length}).`);
      }

      // --- Сохраняем «name => (codes, rows)» ---
      if (!nameToCodes.has(name)) {
        nameToCodes.set(name, { codes: new Set(), rows: new Set() });
      }
      nameToCodes.get(name).codes.add(code);
      nameToCodes.get(name).rows.add(rowNumber);

      // --- Сохраняем «code => (names, rows)» ---
      if (!codeToNames.has(code)) {
        codeToNames.set(code, { names: new Set(), rows: new Set() });
      }
      codeToNames.get(code).names.add(name);
      codeToNames.get(code).rows.add(rowNumber);
    }
  });

  // 1) Проверка: один и тот же name с разными code
  for (const [name, info] of nameToCodes) {
    if (info.codes.size > 1) {
      // Собираем в одну строку
      const codesStr = Array.from(info.codes).join(', ');
      const rowsStr = Array.from(info.rows).join(', ');
      result.push(`Услуга "${name}" встречается больше одного раза (ID ${codesStr}) (${rowsStr})`);
    }
  }

  // 2) Проверка: один и тот же code с разными name
  for (const [code, info] of codeToNames) {
    if (info.names.size > 1) {
      const namesStr = Array.from(info.names).join(', ');
      const rowsStr = Array.from(info.rows).join(', ');
      result.push(`Код "${code}" встречается больше одного раза (NAME ${namesStr}) (${rowsStr})`);
    }
  }

  // Добавляем про пустые строки
  if (emptyRows.length > 0) {
    result.push('Пустые строки:\n' + emptyRows.join('\n'));
  }
  // И про слишком длинные
  if (longCells.length > 0) {
    result.push('Слишком длинные строки:\n' + longCells.join('\n'));
  }

  // Если ошибок нет
  if (result.length === 0) {
    result.push('Ошибок не обнаружено.');
  }

  // Запись в файл и отправка
  const filePath = path.join(__dirname, '..', 'Ошибки валидации.txt');
  fs.writeFileSync(filePath, result.join('\n'));
  await ctx.replyWithDocument({ source: filePath });
  fs.unlinkSync(filePath);
}

module.exports = { checkPrice };