import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fullParse, generateDemoData, checkSiteAvailability, getAcademicYears } from '@/lib/parser';

// POST /api/parse - Запуск парсинга
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const useDemo = body.demo === true;

    // Создаём запись лога
    const parseLog = await db.parseLog.create({
      data: {
        status: 'in_progress',
        message: useDemo 
          ? 'Генерация демо-данных...' 
          : 'Проверка подключения к сайту rating.vsuet.ru...',
      },
    });

    // Запускаем парсинг асинхронно
    (async () => {
      try {
        let veds;
        let errors: string[] = [];

        if (useDemo) {
          // Демо-данные
          veds = generateDemoData();
        } else {
          // Проверяем доступность сайта
          const availability = await checkSiteAvailability();
          
          if (!availability.available) {
            await db.parseLog.update({
              where: { id: parseLog.id },
              data: {
                status: 'error',
                message: `Сайт rating.vsuet.ru недоступен: ${availability.message}. Используйте демо-данные.`,
                finishedAt: new Date(),
              },
            });
            return;
          }

          // Запускаем парсинг
          const result = await fullParse((message, current, total) => {
            // Можно добавить WebSocket для实时 обновления
            console.log(`[${current}/${total}] ${message}`);
          });
          
          veds = result.veds;
          errors = result.errors;
        }

        // Если данных нет
        if (!veds || veds.length === 0) {
          await db.parseLog.update({
            where: { id: parseLog.id },
            data: {
              status: 'error',
              message: errors.length > 0 
                ? errors[0] 
                : 'Не удалось получить данные с сайта. Попробуйте демо-режим.',
              finishedAt: new Date(),
            },
          });
          return;
        }

        let vedsCount = 0;
        let recordsCount = 0;

        // Очищаем старые данные (опционально)
        // await db.studentRecord.deleteMany({});
        // await db.ved.deleteMany({});

        // Сохраняем данные в БД
        for (const ved of veds) {
          try {
            // Ищем существующую ведомость
            const existingVed = await db.ved.findFirst({
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
            if (existingVed) {
              // Удаляем старые записи
              await db.studentRecord.deleteMany({
                where: { vedId: existingVed.id },
              });

              // Обновляем
              vedRecord = await db.ved.update({
                where: { id: existingVed.id },
                data: {
                  course: ved.course,
                  isClosed: ved.isClosed,
                  updatedAt: new Date(),
                },
              });
            } else {
              // Создаём новую
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

            // Создаём записи студентов батчами
            const batchSize = 100;
            for (let i = 0; i < ved.students.length; i += batchSize) {
              const batch = ved.students.slice(i, i + batchSize);
              await db.studentRecord.createMany({
                data: batch.map(student => ({
                  vedId: vedRecord.id,
                  gradebook: student.gradebook,
                  points1: student.points1,
                  points2: student.points2,
                  points3: student.points3,
                  points4: student.points4,
                  totalPoints: student.totalPoints,
                  grade: student.grade,
                })),
              });
            }
            recordsCount += ved.students.length;

          } catch (error) {
            console.error(`Error saving ved ${ved.subject}:`, error);
          }
        }

        // Обновляем лог
        await db.parseLog.update({
          where: { id: parseLog.id },
          data: {
            status: errors.length > 0 ? 'error' : 'success',
            message: errors.length > 0 
              ? `Завершено с ошибками: ${errors.slice(0, 3).join('; ')}` 
              : `Успешно загружено ${vedsCount} ведомостей за ${getAcademicYears().join(', ')} учебные годы`,
            vedsParsed: vedsCount,
            recordsParsed: recordsCount,
            finishedAt: new Date(),
          },
        });

      } catch (error) {
        console.error('Parse error:', error);
        await db.parseLog.update({
          where: { id: parseLog.id },
          data: {
            status: 'error',
            message: `Ошибка: ${error}`,
            finishedAt: new Date(),
          },
        });
      }
    })();

    return NextResponse.json({
      success: true,
      message: useDemo ? 'Генерация демо-данных запущена' : 'Парсинг запущен',
      logId: parseLog.id,
      years: getAcademicYears(),
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка запуска парсинга' },
      { status: 500 }
    );
  }
}

// GET /api/parse - Статус
export async function GET() {
  try {
    const lastLog = await db.parseLog.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    const availability = await checkSiteAvailability();
    const years = getAcademicYears();

    // Статистика
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
      years,
      stats: {
        totalVeds,
        totalRecords,
        facultiesCount: faculties.length,
      },
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка получения статуса' },
      { status: 500 }
    );
  }
}
