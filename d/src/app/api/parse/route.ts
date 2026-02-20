import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkSiteAvailability, generateDemoData, getAcademicYears, simpleParse } from '@/lib/parser';

// POST /api/parse - Запуск парсинга
export async function POST(request: NextRequest) {
  console.log('[API] POST /api/parse - запуск');
  
  try {
    const body = await request.json().catch(() => ({}));
    const useDemo = body.demo === true;

    console.log(`[API] Режим: ${useDemo ? 'демо' : 'реальный парсинг'}`);

    // Создаём лог
    const parseLog = await db.parseLog.create({
      data: {
        status: 'in_progress',
        message: useDemo ? 'Генерация демо-данных...' : 'Проверка сайта...',
        vedsParsed: 0,
        recordsParsed: 0,
      },
    });

    console.log(`[API] Создан лог: ${parseLog.id}`);

    // Запускаем асинхронно
    parseAsync(parseLog.id, useDemo);

    return NextResponse.json({
      success: true,
      message: useDemo ? 'Генерация демо-данных запущена' : 'Парсинг запущен',
      logId: parseLog.id,
    });
  } catch (error) {
    console.error('[API] Ошибка:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

// Асинхронная обработка
async function parseAsync(logId: string, useDemo: boolean) {
  console.log(`[ParseAsync] Начало, logId=${logId}, demo=${useDemo}`);
  
  try {
    let veds;
    let errors: string[] = [];

    if (useDemo) {
      // Демо-данные
      console.log('[ParseAsync] Генерация демо-данных...');
      veds = generateDemoData();
      console.log(`[ParseAsync] Сгенерировано ${veds.length} ведомостей`);
    } else {
      // Проверяем сайт
      console.log('[ParseAsync] Проверка доступности сайта...');
      const availability = await checkSiteAvailability();
      console.log(`[ParseAsync] Сайт: ${availability.available ? 'доступен' : 'недоступен'} - ${availability.message}`);

      if (!availability.available) {
        await updateLog(logId, 'error', `Сайт недоступен: ${availability.message}`);
        return;
      }

      // Пробуем распарсить
      console.log('[ParseAsync] Попытка парсинга...');
      const result = await simpleParse();
      veds = result.veds;
      errors = result.errors;
      
      console.log(`[ParseAsync] Результат: ${veds.length} ведомостей, ${errors.length} ошибок`);
    }

    // Проверяем что есть данные
    if (!veds || veds.length === 0) {
      const msg = errors.length > 0 ? errors[0] : 'Нет данных';
      console.log(`[ParseAsync] Нет данных: ${msg}`);
      await updateLog(logId, 'error', msg);
      return;
    }

    // Сохраняем в БД
    console.log('[ParseAsync] Сохранение в БД...');
    
    let vedsCount = 0;
    let recordsCount = 0;

    for (const ved of veds) {
      try {
        // Проверяем существующую ведомость
        const existing = await db.ved.findFirst({
          where: {
            faculty: ved.faculty,
            groupName: ved.groupName,
            subject: ved.subject,
            year: ved.year,
            semester: ved.semester,
            vedType: ved.vedType,
          },
        });

        let vedRecord;
        if (existing) {
          // Удаляем старые записи
          await db.studentRecord.deleteMany({
            where: { vedId: existing.id },
          });

          vedRecord = await db.ved.update({
            where: { id: existing.id },
            data: {
              course: ved.course,
              isClosed: ved.isClosed,
              updatedAt: new Date(),
            },
          });
        } else {
          vedRecord = await db.ved.create({
            data: {
              faculty: ved.faculty,
              groupName: ved.groupName,
              course: ved.course,
              year: ved.year,
              semester: ved.semester,
              subject: ved.subject,
              vedType: ved.vedType,
              isClosed: ved.isClosed,
            },
          });
        }

        vedsCount++;

        // Сохраняем студентов
        if (ved.students.length > 0) {
          await db.studentRecord.createMany({
            data: ved.students.map(s => ({
              vedId: vedRecord.id,
              gradebook: s.gradebook,
              points1: s.points1,
              points2: s.points2,
              points3: s.points3,
              points4: s.points4,
              totalPoints: s.totalPoints,
              grade: s.grade,
            })),
          });
          recordsCount += ved.students.length;
        }

        // Логируем каждые 100 ведомостей
        if (vedsCount % 100 === 0) {
          console.log(`[ParseAsync] Сохранено ${vedsCount}/${veds.length} ведомостей...`);
        }
      } catch (e) {
        console.error(`[ParseAsync] Ошибка сохранения ведомости:`, e);
      }
    }

    console.log(`[ParseAsync] Итого: ${vedsCount} ведомостей, ${recordsCount} записей`);

    // Обновляем лог
    await updateLog(logId, 'success', 
      `Успешно: ${vedsCount} ведомостей, ${recordsCount} записей`,
      vedsCount, recordsCount
    );

    console.log('[ParseAsync] Завершено успешно');
  } catch (error) {
    console.error('[ParseAsync] Критическая ошибка:', error);
    await updateLog(logId, 'error', String(error));
  }
}

// Обновление лога
async function updateLog(
  id: string, 
  status: string, 
  message: string,
  vedsParsed?: number,
  recordsParsed?: number
) {
  try {
    await db.parseLog.update({
      where: { id },
      data: {
        status,
        message,
        vedsParsed: vedsParsed ?? 0,
        recordsParsed: recordsParsed ?? 0,
        finishedAt: new Date(),
      },
    });
  } catch (e) {
    console.error('[API] Ошибка обновления лога:', e);
  }
}

// GET /api/parse - Статус
export async function GET() {
  try {
    const lastLog = await db.parseLog.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    const availability = await checkSiteAvailability();

    // Считаем статистику
    const totalVeds = await db.ved.count();
    const totalRecords = await db.studentRecord.count();
    const faculties = await db.ved.groupBy({
      by: ['faculty'],
      _count: { id: true },
    });

    return NextResponse.json({
      success: true,
      log: lastLog,
      siteAvailable: availability.available,
      siteMessage: availability.message,
      years: getAcademicYears(),
      stats: {
        totalVeds,
        totalRecords,
        facultiesCount: faculties.length,
      },
    });
  } catch (error) {
    console.error('[API] GET error:', error);
    return NextResponse.json({
      success: true,
      log: null,
      siteAvailable: false,
      siteMessage: 'Ошибка проверки',
      years: getAcademicYears(),
      stats: { totalVeds: 0, totalRecords: 0, facultiesCount: 0 },
    });
  }
}
