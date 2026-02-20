import cron from 'node-cron';

const MAIN_APP_URL = process.env.MAIN_APP_URL || 'http://localhost:3000';

// Функция для запуска парсинга
async function triggerParse() {
  console.log(`[${new Date().toISOString()}] Запуск парсинга...`);
  
  try {
    const response = await fetch(`${MAIN_APP_URL}/api/parse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ demo: false }),
    });

    const data = await response.json();
    
    if (data.success) {
      console.log(`[${new Date().toISOString()}] Парсинг успешно запущен: ${data.message}`);
    } else {
      console.error(`[${new Date().toISOString()}] Ошибка запуска парсинга: ${data.error}`);
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Ошибка запроса:`, error);
  }
}

// Расписание парсинга (MSK = UTC+3)
// 10:30 MSK = 07:30 UTC
// 17:30 MSK = 14:30 UTC
console.log('Планировщик парсинга запущен');
console.log('Расписание:');
console.log('  - 10:30 МСК (07:30 UTC)');
console.log('  - 17:30 МСК (14:30 UTC)');

// 10:30 МСК = 07:30 UTC
cron.schedule('30 7 * * *', () => {
  console.log('Запуск по расписанию: 10:30 МСК');
  triggerParse();
}, {
  timezone: 'UTC',
});

// 17:30 МСК = 14:30 UTC
cron.schedule('30 14 * * *', () => {
  console.log('Запуск по расписанию: 17:30 МСК');
  triggerParse();
}, {
  timezone: 'UTC',
});

// Для тестирования можно раскомментировать:
// Запуск каждую минуту
// cron.schedule('* * * * *', triggerParse);

// Держим процесс активным
process.on('SIGINT', () => {
  console.log('Планировщик остановлен');
  process.exit(0);
});
