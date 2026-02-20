import * as cheerio from 'cheerio';
import { db } from './db';

const BASE_URL = 'https://rating.vsuet.ru/web/Ved/Default.aspx';
const TIMEOUT_MS = 30000;

// Учебные годы
export function getAcademicYears(count: number = 3): string[] {
  const currentYear = new Date().getFullYear();
  const years: string[] = [];
  for (let i = 0; i < count; i++) {
    const year = currentYear - i;
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

export interface ParseProgress {
  step: string;
  current: number;
  total: number;
  status: 'loading' | 'parsing' | 'saving' | 'done' | 'error';
}

// Глобальный callback для прогресса
let progressCallback: ((p: ParseProgress) => void) | null = null;

export function setProgressCallback(cb: (p: ParseProgress) => void) {
  progressCallback = cb;
}

function reportProgress(p: ParseProgress) {
  console.log(`[Parser] ${p.step} (${p.current}/${p.total})`);
  progressCallback?.(p);
}

// Загрузка страницы с таймаутом
async function fetchPage(url: string, options: RequestInit = {}): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
        ...options.headers,
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

// Проверка доступности сайта
export async function checkSiteAvailability(): Promise<{ available: boolean; message: string }> {
  try {
    const html = await fetchPage(BASE_URL);
    return { 
      available: html.length > 100, 
      message: html.length > 100 ? 'Сайт доступен' : 'Пустой ответ' 
    };
  } catch (error) {
    return { 
      available: false, 
      message: error instanceof Error ? error.message : 'Ошибка подключения' 
    };
  }
}

// Извлечение ViewState из ASP.NET страницы
function extractAspNetFields(html: string): Record<string, string> {
  const $ = cheerio.load(html);
  const fields: Record<string, string> = {};

  // ViewState
  const viewState = $('input[name="__VIEWSTATE"]').val();
  if (viewState) fields['__VIEWSTATE'] = viewState;

  // EventValidation
  const eventValidation = $('input[name="__EVENTVALIDATION"]').val();
  if (eventValidation) fields['__EVENTVALIDATION'] = eventValidation;

  // ViewStateGenerator
  const viewStateGenerator = $('input[name="__VIEWSTATEGENERATOR"]').val();
  if (viewStateGenerator) fields['__VIEWSTATEGENERATOR'] = viewStateGenerator;

  return fields;
}

// Парсинг HTML ведомости
function parseVedHtml(
  html: string,
  faculty: string,
  groupName: string,
  year: string,
  semester: number
): ParsedVed[] {
  const $ = cheerio.load(html);
  const veds: ParsedVed[] = [];

  // Ищем заголовок ведомости
  let subject = '';
  let vedType = 'экзамен';

  const pageTitle = $('title').text() || '';
  const h1 = $('h1').first().text() || '';
  const h2 = $('h2').first().text() || '';
  const headerText = h1 || h2 || pageTitle;

  // Извлекаем предмет
  if (headerText) {
    const subjectMatch = headerText.match(/(?:предмет|дисциплина)[:\s]*([^\n,]+)/i);
    if (subjectMatch) {
      subject = subjectMatch[1].trim();
    }
    if (!subject) {
      subject = headerText.replace(/ведомость|по\s*предмету|дисциплин[аы]/gi, '').trim();
    }
  }

  // Тип ведомости
  const lowerText = (headerText + ' ' + $('body').text().substring(0, 1000)).toLowerCase();
  if (lowerText.includes('зачёт') || lowerText.includes('зачет')) {
    vedType = 'зачёт';
  } else if (lowerText.includes('курсов')) {
    vedType = 'КП';
  } else if (lowerText.includes('диф')) {
    vedType = 'дифзачёт';
  }

  // Ищем таблицы
  $('table').each((_, table) => {
    const $table = $(table);
    const rows = $table.find('tr');

    if (rows.length < 2) return;

    // Заголовки
    const headerRow = rows.first();
    const headers: string[] = [];
    headerRow.find('th, td').each((_, cell) => {
      headers.push($(cell).text().trim().toLowerCase());
    });

    // Проверяем наличие данных
    const tableText = $table.text();
    const hasGradebook = /\d{6,}/.test(tableText);
    const hasPoints = /кт/i.test(tableText) || /балл/i.test(tableText);

    if (!hasGradebook && !hasPoints) return;

    // Индексы колонок
    const colMap: Record<string, number> = {};
    headers.forEach((h, i) => {
      if (h.includes('зачётк') || h.includes('зачетк') || h.includes('номер') || h === '№') {
        colMap.gradebook = i;
      } else if (h.includes('кт1') || h === 'кт1' || h === 'кт-1') {
        colMap.points1 = i;
      } else if (h.includes('кт2') || h === 'кт2' || h === 'кт-2') {
        colMap.points2 = i;
      } else if (h.includes('кт3') || h === 'кт3' || h === 'кт-3') {
        colMap.points3 = i;
      } else if (h.includes('итог') || h.includes('сумм') || h.includes('всего')) {
        colMap.total = i;
      } else if (h.includes('оценк')) {
        colMap.grade = i;
      }
    });

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

      // Извлекаем данные
      cells.each((idx, cell) => {
        const text = $(cell).text().trim();
        const num = parseInt(text.replace(/[^\d-]/g, '')) || null;

        if (idx === colMap.gradebook) {
          student.gradebook = text.replace(/\D/g, '');
        } else if (idx === colMap.points1) {
          student.points1 = num;
        } else if (idx === colMap.points2) {
          student.points2 = num;
        } else if (idx === colMap.points3) {
          student.points3 = num;
        } else if (idx === colMap.total) {
          student.totalPoints = num;
        } else if (idx === colMap.grade) {
          student.grade = text;
        }
      });

      // Если зачётка не найдена, ищем
      if (!student.gradebook) {
        cells.each((_, cell) => {
          const text = $(cell).text().trim().replace(/\D/g, '');
          if (text.length >= 6 && text.length <= 12 && !student.gradebook) {
            student.gradebook = text;
          }
        });
      }

      // Вычисляем итог
      if (student.totalPoints === null) {
        const p1 = student.points1 || 0;
        const p2 = student.points2 || 0;
        const p3 = student.points3 || 0;
        if (p1 || p2 || p3) {
          student.totalPoints = p1 + p2 + p3;
        }
      }

      // Оценка
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
      // Предмет из таблицы
      let tableSubject = subject;
      const caption = $table.find('caption').text().trim();
      const prev = $table.prevAll('h1, h2, h3, h4').first().text().trim();
      if (caption) tableSubject = caption;
      else if (prev) tableSubject = prev;

      veds.push({
        faculty,
        groupName,
        course: Math.ceil(semester / 2),
        year,
        semester,
        subject: tableSubject || 'Предмет',
        vedType,
        isClosed: true,
        students,
      });
    }
  });

  return veds;
}

// Автоматическая загрузка ведомостей с сайта
export async function autoLoadVeds(
  facultyName: string = 'УИТС',
  yearsCount: number = 2
): Promise<{ veds: ParsedVed[]; errors: string[] }> {
  const veds: ParsedVed[] = [];
  const errors: string[] = [];
  const years = getAcademicYears(yearsCount);

  reportProgress({ step: 'Загрузка главной страницы...', current: 0, total: 100, status: 'loading' });

  try {
    // Загружаем главную страницу
    const mainHtml = await fetchPage(BASE_URL);
    const $ = cheerio.load(mainHtml);

    // Извлекаем ASP.NET поля
    const aspNetFields = extractAspNetFields(mainHtml);

    // Ищем код факультета
    let facultyCode = '';
    $('select option').each((_, el) => {
      const text = $(el).text().trim().toLowerCase();
      const value = $(el).attr('value') || '';
      if (text.includes('уиц') || text.includes('уис') || text.includes('uits') || text.includes('информаци')) {
        facultyCode = value;
      }
    });

    if (!facultyCode) {
      // Пробуем по названию
      const facultySelect = $('select[name*="Faculty"], select[id*="Faculty"], select').first();
      facultySelect.find('option').each((_, el) => {
        const text = $(el).text().trim();
        const value = $(el).attr('value') || '';
        if (text.toLowerCase().includes('уиц') || text.toLowerCase().includes('информаци')) {
          facultyCode = value;
        }
      });
    }

    reportProgress({ step: `Факультет найден: ${facultyCode || 'по умолчанию'}`, current: 10, total: 100, status: 'loading' });

    // Ищем группы
    const groups: { code: string; name: string }[] = [];
    $('select option').each((_, el) => {
      const text = $(el).text().trim();
      const value = $(el).attr('value') || '';
      // Группы выглядят как ИС-21, ПИ-22 и т.д.
      if (/^[А-ЯA-Z]{2,4}-\d{2,4}/.test(text) && value) {
        groups.push({ code: value, name: text });
      }
    });

    // Если группы не найдены, генерируем типичные
    if (groups.length === 0) {
      const prefixes = ['ИС', 'ПИ', 'БИ', 'ММ'];
      for (let i = 21; i <= 24; i++) {
        prefixes.forEach(p => groups.push({ code: `${p}-${i}`, name: `${p}-${i}` }));
      }
    }

    reportProgress({ step: `Найдено групп: ${groups.length}`, current: 20, total: 100, status: 'loading' });

    // Загружаем ведомости для каждой группы, года, семестра
    const total = groups.length * years.length * 2;
    let current = 0;

    for (const year of years) {
      for (const semester of [1, 2]) {
        for (const group of groups) {
          current++;
          
          try {
            // Формируем URL
            const params = new URLSearchParams();
            if (facultyCode) params.append('faculty', facultyCode);
            params.append('group', group.code);
            params.append('year', year);
            params.append('semester', String(semester));

            const url = `${BASE_URL}?${params.toString()}`;

            reportProgress({ 
              step: `${group.name} → ${year} → ${semester} сем.`, 
              current: 20 + Math.round((current / total) * 70),
              total: 100,
              status: 'parsing'
            });

            const html = await fetchPage(url);
            const parsedVeds = parseVedHtml(html, facultyName, group.name, year, semester);

            if (parsedVeds.length > 0) {
              veds.push(...parsedVeds);
            }
          } catch (error) {
            errors.push(`${group.name}/${year}/${semester}: ${error}`);
          }
        }
      }
    }

    reportProgress({ step: `Загружено ${veds.length} ведомостей`, current: 100, total: 100, status: 'done' });

  } catch (error) {
    errors.push(`Ошибка загрузки: ${error}`);
    reportProgress({ step: String(error), current: 0, total: 100, status: 'error' });
  }

  return { veds, errors };
}

// Сохранение в БД
export async function saveVedsToDb(veds: ParsedVed[]): Promise<{ saved: number; records: number }> {
  let saved = 0;
  let records = 0;

  for (const ved of veds) {
    try {
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
        await db.studentRecord.deleteMany({ where: { vedId: existing.id } });
        vedRecord = await db.ved.update({
          where: { id: existing.id },
          data: { course: ved.course, isClosed: ved.isClosed, updatedAt: new Date() },
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

      saved++;

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
        records += ved.students.length;
      }
    } catch (e) {
      console.error('Save error:', e);
    }
  }

  return { saved, records };
}

// Очистка данных
export async function clearAllData(): Promise<void> {
  await db.studentRecord.deleteMany({});
  await db.ved.deleteMany({});
}

// Демо-данные
export function generateDemoData(
  years: string[] = getAcademicYears(2),
  faculty: string = 'УИТС'
): ParsedVed[] {
  const groupPrefixes = ['ИС', 'ПИ', 'БИ', 'ММ'];
  const subjects = [
    'Программирование', 'Базы данных', 'Алгоритмы', 'Математика',
    'Физика', 'Английский язык', 'Экономика', 'Менеджмент',
  ];

  const veds: ParsedVed[] = [];

  for (const prefix of groupPrefixes) {
    for (let num = 21; num <= 24; num++) {
      const groupName = `${prefix}-${num}`;

      for (const year of years) {
        for (const semester of [1, 2]) {
          const subjectCount = 2 + Math.floor(Math.random() * 3);

          for (let s = 0; s < subjectCount; s++) {
            const subject = subjects[Math.floor(Math.random() * subjects.length)];
            const vedType = Math.random() > 0.5 ? 'экзамен' : 'зачёт';

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

              students.push({ gradebook, points1, points2, points3, points4: null, totalPoints, grade });
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

  return veds;
}
