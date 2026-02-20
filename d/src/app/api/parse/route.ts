import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { 
  autoLoadVeds, 
  saveVedsToDb, 
  clearAllData, 
  generateDemoData, 
  getAcademicYears,
  checkSiteAvailability,
  setProgressCallback,
  ParseProgress
} from '@/lib/parser';

// Глобальное состояние прогресса
let currentProgress: ParseProgress | null = null;

// POST /api/parse
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { 
      action, 
      faculty = 'УИТС', 
      yearsCount = 2,
      demo 
    } = body;

    // Устанавливаем callback для прогресса
    setProgressCallback((p) => {
      currentProgress = p;
    });

    // Очистка
    if (action === 'clear') {
      await clearAllData();
      return NextResponse.json({ success: true, message: 'Данные очищены' });
    }

    // Демо-режим
    if (demo) {
      currentProgress = { step: 'Генерация данных...', current: 50, total: 100, status: 'parsing' };
      
      const years = getAcademicYears(yearsCount);
      const veds = generateDemoData(years, faculty);
      const { saved, records } = await saveVedsToDb(veds);
      
      currentProgress = { step: 'Готово', current: 100, total: 100, status: 'done' };
      
      return NextResponse.json({
        success: true,
        message: `Сгенерировано: ${saved} ведомостей, ${records} записей`,
        saved,
        records,
      });
    }

    // Автозагрузка с сайта
    if (action === 'load' || action === 'auto') {
      // Проверяем доступность
      const availability = await checkSiteAvailability();
      
      if (!availability.available) {
        // Если сайт недоступен - используем демо
        currentProgress = { step: 'Сайт недоступен, генерация демо...', current: 50, total: 100, status: 'parsing' };
        
        const years = getAcademicYears(yearsCount);
        const veds = generateDemoData(years, faculty);
        const { saved, records } = await saveVedsToDb(veds);
        
        currentProgress = { step: 'Готово (демо)', current: 100, total: 100, status: 'done' };
        
        return NextResponse.json({
          success: true,
          message: `Сайт недоступен. Сгенерировано демо: ${saved} ведомостей, ${records} записей`,
          saved,
          records,
          usedDemo: true,
        });
      }

      // Загружаем с сайта
      currentProgress = { step: 'Подключение к сайту...', current: 0, total: 100, status: 'loading' };
      
      const { veds, errors } = await autoLoadVeds(faculty, yearsCount);
      
      if (veds.length === 0) {
        // Если ничего не загрузилось - демо
        const years = getAcademicYears(yearsCount);
        const demoVeds = generateDemoData(years, faculty);
        const { saved, records } = await saveVedsToDb(demoVeds);
        
        return NextResponse.json({
          success: true,
          message: `Нет данных с сайта. Демо: ${saved} ведомостей, ${records} записей`,
          saved,
          records,
          usedDemo: true,
          errors: errors.slice(0, 5),
        });
      }

      const { saved, records } = await saveVedsToDb(veds);
      
      currentProgress = { step: 'Готово', current: 100, total: 100, status: 'done' };
      
      return NextResponse.json({
        success: true,
        message: `Загружено с сайта: ${saved} ведомостей, ${records} записей`,
        saved,
        records,
        errors: errors.slice(0, 5),
      });
    }

    return NextResponse.json({ success: false, error: 'Неизвестное действие' });

  } catch (error) {
    console.error('[API] Error:', error);
    currentProgress = { step: String(error), current: 0, total: 100, status: 'error' };
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

// GET /api/parse - Статус и прогресс
export async function GET() {
  try {
    const totalVeds = await db.ved.count();
    const totalRecords = await db.studentRecord.count();
    const faculties = await db.ved.groupBy({
      by: ['faculty'],
      _count: { id: true },
    });
    const years = await db.ved.groupBy({
      by: ['year'],
      _count: { id: true },
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalVeds,
        totalRecords,
        faculties: faculties.map(f => ({ name: f.faculty, count: f._count.id })),
        years: years.map(y => ({ year: y.year, count: y._count.id })),
      },
      availableYears: getAcademicYears(3),
      progress: currentProgress,
    });
  } catch (error) {
    return NextResponse.json({
      success: true,
      stats: { totalVeds: 0, totalRecords: 0, faculties: [], years: [] },
      availableYears: getAcademicYears(3),
      progress: currentProgress,
    });
  }
}

// DELETE /api/parse - Очистка
export async function DELETE() {
  try {
    await clearAllData();
    currentProgress = null;
    return NextResponse.json({ success: true, message: 'Все данные удалены' });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
