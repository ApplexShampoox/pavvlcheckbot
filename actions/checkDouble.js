const XLSX = require('xlsx-js-style');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// Функция для подсветки строк с дублями
async function checkDouble(ctx, workbook, originalFileName) {
  const sheetNames = workbook.SheetNames;

  if (sheetNames.length === 0) {
    await ctx.reply('Файл не содержит листов.');
    return;
  }

  let hasDuplicates = false;

  // Создаем новый workbook, который будет копией оригинального
  const newWorkbook = XLSX.utils.book_new();

  // Стиль для подсветки фона
  const highlightStyle = {
    fill: { fgColor: { rgb: 'FFFF00' } } // Желтый цвет
  };

  // Обрабатываем каждый лист в исходном workbook
  sheetNames.forEach((sheetName, sheetIndex) => {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (sheetIndex === 0) {
      // Только на первом листе проводим поиск и подсветку дублей
      // Игнорирование строк с пустыми значениями в столбцах A, G и I
      const filteredDataWithIndices = data.map((row, index) => [index, row])
        .filter(([index, row]) => {
          const id = row[0]; // Столбец A (индекс 0)
          const valueG = row[6]; // Столбец G (индекс 6)
          const valueI = row[8]; // Столбец I (индекс 8)
          return id && valueG && valueI; // Убедитесь, что ID, значение в G и значение в I не пустые
        });

      const idGroups = {};

      // Сбор информации по одинаковым значениям в столбцах G и I для каждого ИД
      filteredDataWithIndices.forEach(([index, row]) => {
        const id = row[0]; // Столбец A (индекс 0)
        const valueG = row[6]; // Столбец G (индекс 6)
        const valueI = row[8]; // Столбец I (индекс 8)

        if (!idGroups[id]) {
          idGroups[id] = {};
        }
        const key = `${valueG}|${valueI}`; // Создаем ключ для проверки дублей по столбцам G и I
        if (!idGroups[id][key]) {
          idGroups[id][key] = [];
        }
        idGroups[id][key].push(index); // Добавляем индекс, чтобы соответствовать номеру строки в Excel
      });

      // Создаем новый лист для текущего листа из исходного файла
      const newSheet = XLSX.utils.aoa_to_sheet(data);

      // Подсвечиваем строки с дублирующимися значениями
      for (const [id, values] of Object.entries(idGroups)) {
        for (const [key, rows] of Object.entries(values)) {
          if (rows.length > 1) {
            hasDuplicates = true; // Отмечаем, что дубли найдены
            rows.forEach(rowIndex => {
              // Подсвечиваем всю строку
              for (let col = 0; col < data[0].length; col++) {
                const cellAddress = `${String.fromCharCode(65 + col)}${rowIndex + 1}`;
                if (!newSheet[cellAddress]) {
                  // Создаем ячейку, если её нет
                  newSheet[cellAddress] = { v: '', s: highlightStyle };
                } else {
                  // Применяем стиль к существующей ячейке
                  newSheet[cellAddress].s = highlightStyle;
                }
              }
            });
          }
        }
      }

      // Добавляем обработанный лист в новый workbook
      XLSX.utils.book_append_sheet(newWorkbook, newSheet, sheetName);
    } else {
      // Добавляем другие листы без изменений
      XLSX.utils.book_append_sheet(newWorkbook, sheet, sheetName);
    }
  });

  if (hasDuplicates) {
    // Определяем имя файла из оригинального пути

    const tempFilePath = path.join(__dirname, `Дубли.xlsx`);
    const zipFilePath = path.join(__dirname, 'Result.zip');

    // Сохранение нового workbook в временный файл
    XLSX.writeFile(newWorkbook, tempFilePath);

    // Создание архива
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.pipe(output);
    archive.file(tempFilePath, { name: `Дубли.xlsx` });
    await archive.finalize();

    // Отправка архива
    await ctx.replyWithDocument({ source: zipFilePath });

    // Удаление временных файлов
    fs.unlinkSync(tempFilePath);
    fs.unlinkSync(zipFilePath);
  } else {
    await ctx.reply('Дублирующиеся значения не найдены в файле.');
  }
}

module.exports = { checkDouble };