import * as cheerio from 'cheerio';

const BASE_URL = 'https://rating.vsuet.ru/web/Ved/Default.aspx';
const TIMEOUT_MS = 20000;

// Учебные годы: 2023-2024, 2024-2025, 2025-2026 и т.д.
export function getAcademicYears(): string[] {
  const currentYear = new Date().getFullYear();
  const years: string[] = [];
  for (let year = 2023; year <= currentYear; year++) {
    years.push(`${year}-${year + 1}`);
  }
  return years;
}

export interface ParsedVed {
  faculty: string;
  groupName: string;
  course: number;
  year: string;
  semester: number;
  subject: string;
  vedType: string;
  isClosed: boolean;
  students: ParsedStudent[];
}

export interface ParsedStudent {
  gradebook: string;
  points1: number | null;
  points2: number | null;
  points3: number | null;
  points4: number | null;
  totalPoints: number | null;
  grade: string | null;
}

// Проверка доступности сайта
export async function checkSiteAvailability(): Promise<{ available: boolean; message: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(BASE_URL, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      // Проверим что это не пустая страница
      const text = await response.text();
      if (text.length < 100) {
        return { available: false, message: 'Сайт вернул пустую страницу' };
      }
      return { available: true, message: 'Сайт доступен' };
    }
    return { available: false, message: `HTTP ${response.status}` };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return { available: false, message: 'Таймаут (10 сек)' };
      }
      return { available: false, message: error.message };
    }
    return { available: false, message: 'Неизвестная ошибка' };
  }
}

// Загрузка страницы с таймаутом
async function fetchPage(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'ru-RU,ru',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Парсинг одной страницы ведомости
export async function parseSinglePage(
  url: string
): Promise<{ veds: ParsedVed[]; error?: string }> {
  try {
    const html = await fetchPage(url);
    const $ = cheerio.load(html);
    const veds: ParsedVed[] = [];

    // Ищем таблицы с данными
    $('table').each((_, table) => {
      const $table = $(table);
      const rows = $table.find('tr');
      
      if (rows.length < 2) return;

      // Собираем заголовки
      const headers: string[] = [];
      rows.first().find('th, td').each((_, cell) => {
        headers.push($(cell).text().trim().toLowerCase());
      });

      // Проверяем что это таблица с оценками
      const text = $table.text().toLowerCase();
      const hasStudents = text.includes('зачёт') || text.includes('зачет') || 
                          text.includes('номер') || headers.some(h => 
                            h.includes('кт') || h.includes('балл') || h.includes('оценк'));

      if (!hasStudents) return;

      // Определяем колонки
      const columns = {
        gradebook: -1,
        points1: -1,
        points2: -1,
        points3: -1,
        total: -1,
        grade: -1,
      };

      headers.forEach((h, i) => {
        if (h.includes('зачётк') || h.includes('зачетк') || h.includes('номер') || h === '№') {
          columns.gradebook = i;
        } else if (h.includes('кт1') || h === 'кт1' || h.includes('кт-1')) {
          columns.points1 = i;
        } else if (h.includes('кт2') || h === 'кт2' || h.includes('кт-2')) {
          columns.points2 = i;
        } else if (h.includes('кт3') || h === 'кт3' || h.includes('кт-3')) {
          columns.points3 = i;
        } else if (h.includes('итог') || h.includes('сумм') || h.includes('всего')) {
          columns.total = i;
        } else if (h.includes('оценк')) {
          columns.grade = i;
        }
      });

      // Извлекаем информацию о предмете
      let subject = 'Предмет';
      let vedType = 'экзамен';
      let faculty = '';
      let groupName = '';

      // Ищем заголовок перед таблицей
      const prevText = $table.prevAll('h1, h2, h3, .title, caption').first().text();
      if (prevText) {
        const subjectMatch = prevText.match(/(?:предмет|дисциплина)[:\s]*([^\n,]+)/i);
        if (subjectMatch) subject = subjectMatch[1].trim();
        
        if (prevText.toLowerCase().includes('зачёт') || prevText.toLowerCase().includes('зачет')) {
          vedType = 'зачёт';
        } else if (prevText.toLowerCase().includes('курсов')) {
          vedType = 'КП';
        }
      }

      // Парсим студентов
      const students: ParsedStudent[] = [];

      rows.slice(1).each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length < 2) return;

        const student: ParsedStudent = {
          gradebook: '',
          points1: null,
          points2: null,
          points3: null,
          points4: null,
          totalPoints: null,
          grade: null,
        };

        // Извлекаем данные по колонкам
        cells.each((idx, cell) => {
          const text = $(cell).text().trim();
          
          if (idx === columns.gradebook) {
            student.gradebook = text.replace(/\D/g, '');
          } else if (idx === columns.points1) {
            student.points1 = parseInt(text) || null;
          } else if (idx === columns.points2) {
            student.points2 = parseInt(text) || null;
          } else if (idx === columns.points3) {
            student.points3 = parseInt(text) || null;
          } else if (idx === columns.total) {
            student.totalPoints = parseInt(text) || null;
          } else if (idx === columns.grade) {
            student.grade = text;
          }
        });

        // Если не нашли зачётку по колонке, ищем первое число похожее на неё
        if (!student.gradebook) {
          cells.each((_, cell) => {
            const text = $(cell).text().trim().replace(/\D/g, '');
            if (text.length >= 6 && text.length <= 12 && !student.gradebook) {
              student.gradebook = text;
            }
          });
        }

        // Вычисляем итог если нет
        if (student.totalPoints === null) {
          const p1 = student.points1 || 0;
          const p2 = student.points2 || 0;
          const p3 = student.points3 || 0;
          if (p1 || p2 || p3) {
            student.totalPoints = p1 + p2 + p3;
          }
        }

        // Определяем оценку
        if (!student.grade && student.totalPoints !== null) {
          if (vedType === 'зачёт') {
            student.grade = student.totalPoints >= 60 ? 'зачёт' : 'незачёт';
          } else {
            if (student.totalPoints >= 85) student.grade = '5';
            else if (student.totalPoints >= 70) student.grade = '4';
            else if (student.totalPoints >= 55) student.grade = '3';
            else student.grade = '2';
          }
        }

        if (student.gradebook && student.gradebook.length >= 4) {
          students.push(student);
        }
      });

      if (students.length > 0) {
        // Пытаемся извлечь год и семестр из URL или страницы
        const yearMatch = url.match(/year=(\d{4}-\d{4})/);
        const semesterMatch = url.match(/semester=(\d)/);

        veds.push({
          faculty: faculty || 'Факультет',
          groupName: groupName || 'Группа',
          course: 1,
          year: yearMatch ? yearMatch[1] : `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
          semester: semesterMatch ? parseInt(semesterMatch[1]) : 1,
          subject,
          vedType,
          isClosed: true,
          students,
        });
      }
    });

    return { veds };
  } catch (error) {
    return { 
      veds: [], 
      error: error instanceof Error ? error.message : 'Неизвестная ошибка' 
    };
  }
}

// Простой парсинг - пробуем одну страницу
export async function simpleParse(): Promise<{ veds: ParsedVed[]; errors: string[] }> {
  const veds: ParsedVed[] = [];
  const errors: string[] = [];

  try {
    // Пробуем загрузить главную страницу
    const result = await parseSinglePage(BASE_URL);
    
    if (result.error) {
      errors.push(result.error);
    } else {
      veds.push(...result.veds);
    }
  } catch (error) {
    errors.push(`Ошибка: ${error}`);
  }

  return { veds, errors };
}

// Надёжная генерация демо-данных
export function generateDemoData(): ParsedVed[] {
  console.log('[Parser] Генерация демо-данных...');
  
  const faculties = [
    'Информационные технологии',
    'Экономический',
    'Механический',
    'Химическая технология',
    'Строительный',
    'Технологический',
  ];

  const groupPrefixes = ['ИС', 'ПИ', 'БИ', 'ЭК', 'МН', 'ТМ', 'ХТ', 'СТ'];
  const subjects = [
    'Программирование',
    'Базы данных',
    'Алгоритмы',
    'Математика',
    'Физика',
    'Химия',
    'Английский язык',
    'История',
    'Экономика',
    'Менеджмент',
  ];

  const veds: ParsedVed[] = [];
  const years = getAcademicYears();
  
  console.log(`[Parser] Годы: ${years.join(', ')}`);

  for (const faculty of faculties) {
    // 2-4 группы на факультет
    const groupCount = 2 + Math.floor(Math.random() * 3);
    
    for (let g = 0; g < groupCount; g++) {
      const prefix = groupPrefixes[g % groupPrefixes.length];
      const groupNum = 21 + g;
      const groupName = `${prefix}-${groupNum}`;

      for (const year of years) {
        for (const semester of [1, 2]) {
          // 2-4 предмета на семестр
          const subjectCount = 2 + Math.floor(Math.random() * 3);
          
          for (let s = 0; s < subjectCount; s++) {
            const subject = subjects[Math.floor(Math.random() * subjects.length)];
            const vedType = Math.random() > 0.5 ? 'экзамен' : 'зачёт';

            // Генерация студентов
            const students: ParsedStudent[] = [];
            const studentCount = 15 + Math.floor(Math.random() * 10);

            for (let i = 0; i < studentCount; i++) {
              const yearPrefix = year.split('-')[0];
              const gradebook = `${yearPrefix}${String(1000 + Math.floor(Math.random() * 9000))}`;
              
              const points1 = Math.floor(Math.random() * 30) + 1;
              const points2 = Math.floor(Math.random() * 30) + 1;
              const points3 = Math.floor(Math.random() * 40) + 1;
              const totalPoints = points1 + points2 + points3;

              let grade: string;
              if (vedType === 'зачёт') {
                grade = totalPoints >= 60 ? 'зачёт' : 'незачёт';
              } else {
                if (totalPoints >= 85) grade = '5';
                else if (totalPoints >= 70) grade = '4';
                else if (totalPoints >= 55) grade = '3';
                else grade = '2';
              }

              students.push({
                gradebook,
                points1,
                points2,
                points3,
                points4: null,
                totalPoints,
                grade,
              });
            }

            veds.push({
              faculty,
              groupName: `${groupName}-${semester}`,
              course: semester,
              year,
              semester,
              subject,
              vedType,
              isClosed: true,
              students,
            });
          }
        }
      }
    }
  }

  console.log(`[Parser] Сгенерировано ${veds.length} ведомостей`);
  
  return veds;
}
