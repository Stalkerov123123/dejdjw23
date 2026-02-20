import * as cheerio from 'cheerio';

const BASE_URL = 'https://rating.vsuet.ru/web/Ved/Default.aspx';
const TIMEOUT_MS = 30000; // 30 секунд

// Учебные годы с 2023 по текущий
export function getAcademicYears(): string[] {
  const currentYear = new Date().getFullYear();
  const years: string[] = [];
  
  // Начинаем с 2023-2024
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

export interface FacultyInfo {
  name: string;
  code: string;
}

export interface GroupInfo {
  name: string;
  code: string;
  facultyCode: string;
}

// Проверка доступности сайта
export async function checkSiteAvailability(): Promise<{ available: boolean; message: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(BASE_URL, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      return { available: true, message: 'Сайт доступен' };
    }
    return { available: false, message: `HTTP ${response.status}` };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return { available: false, message: 'Таймаут подключения' };
      }
      return { available: false, message: error.message };
    }
    return { available: false, message: 'Неизвестная ошибка' };
  }
}

// Загрузка страницы с таймаутом и ретраями
async function fetchWithRetry(
  url: string, 
  options: RequestInit = {}, 
  retries = 3
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
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
      if (i === retries - 1) {
        clearTimeout(timeoutId);
        throw error;
      }
      // Ждём перед повторной попыткой
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  clearTimeout(timeoutId);
  throw new Error('Все попытки исчерпаны');
}

// Извлечение ViewState и EventValidation из ASP.NET формы
function extractAspNetFields(html: string): Record<string, string> {
  const $ = cheerio.load(html);
  const fields: Record<string, string> = {};

  // Стандартные ASP.NET скрытые поля
  $('input[type="hidden"]').each((_, el) => {
    const name = $(el).attr('name') || '';
    const value = $(el).attr('value') || '';
    if (name) {
      fields[name] = value;
    }
  });

  return fields;
}

// Парсинг выпадающего списка
function parseSelectOptions($: cheerio.CheerioAPI, selector: string): { value: string; text: string }[] {
  const options: { value: string; text: string }[] = [];
  
  $(selector).find('option').each((_, el) => {
    const value = $(el).attr('value') || '';
    const text = $(el).text().trim();
    if (value && text && value !== '' && value !== '0') {
      options.push({ value, text });
    }
  });

  return options;
}

// Парсинг списка факультетов с главной страницы
export async function parseFaculties(): Promise<FacultyInfo[]> {
  try {
    const html = await fetchWithRetry(BASE_URL);
    const $ = cheerio.load(html);
    const faculties: FacultyInfo[] = [];

    // Ищем все select на странице
    const selects = $('select');
    
    selects.each((_, select) => {
      const name = $(select).attr('name') || '';
      const id = $(select).attr('id') || '';
      
      // Ищем select который похож на список факультетов
      if (
        name.toLowerCase().includes('fac') ||
        id.toLowerCase().includes('fac') ||
        name.toLowerCase().includes('dept') ||
        id.toLowerCase().includes('dept') ||
        $(select).find('option').length > 3 // Больше 3 опций - вероятно факультеты
      ) {
        $(select).find('option').each((_, el) => {
          const value = $(el).attr('value') || '';
          const text = $(el).text().trim();
          if (value && text && value !== '' && value !== '0' && value !== '-1') {
            // Проверяем что это не "Выберите..." и похожие заглушки
            if (!text.toLowerCase().includes('выбер') && text.length > 2) {
              faculties.push({ code: value, name: text });
            }
          }
        });
      }
    });

    // Если не нашли через select, пробуем другой подход - ищем ссылки или список
    if (faculties.length === 0) {
      $('a, li, .faculty, .department').each((_, el) => {
        const text = $(el).text().trim();
        const href = $(el).attr('href') || '';
        if (text.length > 3 && text.length < 100) {
          // Проверяем что похоже на название факультета
          if (text.toLowerCase().includes('факультет') || 
              text.toLowerCase().includes('институт') ||
              text.toLowerCase().includes('отделение')) {
            faculties.push({ code: href || text, name: text });
          }
        }
      });
    }

    return faculties;
  } catch (error) {
    console.error('Error parsing faculties:', error);
    throw error;
  }
}

// Парсинг групп для факультета
export async function parseGroups(facultyCode: string): Promise<GroupInfo[]> {
  try {
    // Формируем URL с параметром факультета
    const url = `${BASE_URL}?faculty=${encodeURIComponent(facultyCode)}`;
    const html = await fetchWithRetry(url);
    const $ = cheerio.load(html);
    const groups: GroupInfo[] = [];

    // Ищем select с группами
    const selects = $('select');
    
    selects.each((_, select) => {
      const name = $(select).attr('name') || '';
      const id = $(select).attr('id') || '';
      
      if (
        name.toLowerCase().includes('group') ||
        id.toLowerCase().includes('group') ||
        name.toLowerCase().includes('grp') ||
        id.toLowerCase().includes('grp')
      ) {
        $(select).find('option').each((_, el) => {
          const value = $(el).attr('value') || '';
          const text = $(el).text().trim();
          if (value && text && value !== '' && value !== '0') {
            groups.push({ code: value, name: text, facultyCode });
          }
        });
      }
    });

    // Если не нашли, пробуем найти в таблице или списке
    if (groups.length === 0) {
      $('table tr td, li a, .group').each((_, el) => {
        const text = $(el).text().trim();
        // Группы обычно выглядят как "ИС-21", "ПИ-22" и т.д.
        if (/^[А-ЯA-Z]{2,4}-\d{2,4}/.test(text)) {
          groups.push({ code: text, name: text, facultyCode });
        }
      });
    }

    return groups;
  } catch (error) {
    console.error('Error parsing groups:', error);
    return [];
  }
}

// Парсинг ведомости по URL
export async function parseVedPage(
  facultyCode: string,
  groupCode: string,
  year: string,
  semester: number
): Promise<ParsedVed[]> {
  try {
    // Формируем URL для конкретной ведомости
    const params = new URLSearchParams();
    if (facultyCode) params.append('faculty', facultyCode);
    if (groupCode) params.append('group', groupCode);
    params.append('year', year);
    params.append('semester', String(semester));

    const url = `${BASE_URL}?${params.toString()}`;
    const html = await fetchWithRetry(url);
    
    return parseVedFromHtml(html, facultyCode, groupCode, year, semester);
  } catch (error) {
    console.error(`Error parsing ved ${facultyCode}/${groupCode}/${year}/${semester}:`, error);
    return [];
  }
}

// Парсинг HTML ведомости
function parseVedFromHtml(
  html: string,
  facultyCode: string,
  groupCode: string,
  year: string,
  semester: number
): ParsedVed[] {
  const $ = cheerio.load(html);
  const veds: ParsedVed[] = [];

  // Ищем все таблицы с данными студентов
  $('table').each((tableIndex, table) => {
    const $table = $(table);
    const rows = $table.find('tr');
    
    if (rows.length < 2) return;

    // Получаем заголовки
    const headerRow = rows.first();
    const headers: string[] = [];
    headerRow.find('th, td').each((_, cell) => {
      headers.push($(cell).text().trim().toLowerCase());
    });

    // Проверяем что это таблица с оценками
    const hasGradebook = headers.some(h => 
      h.includes('зачёт') || h.includes('зачет') || 
      h.includes('номер') || h.includes('№') ||
      h.includes('студен')
    );
    const hasPoints = headers.some(h => 
      h.includes('кт') || h.includes('балл') || h.includes('оценк')
    );

    if (!hasGradebook && !hasPoints) return;

    // Определяем индексы колонок
    const gradebookIdx = headers.findIndex(h => 
      h.includes('зачёт') || h.includes('зачет') || h.includes('№') || h.includes('номер')
    );
    const points1Idx = headers.findIndex(h => h.includes('кт1') || h.includes('кт-1') || h === 'кт1');
    const points2Idx = headers.findIndex(h => h.includes('кт2') || h.includes('кт-2') || h === 'кт2');
    const points3Idx = headers.findIndex(h => h.includes('кт3') || h.includes('кт-3') || h === 'кт3' || h.includes('итог'));
    const totalIdx = headers.findIndex(h => 
      h.includes('сумм') || h.includes('всего') || h === 'итого'
    );
    const gradeIdx = headers.findIndex(h => 
      h.includes('оценк') || h.includes('резул')
    );

    // Извлекаем информацию о предмете из заголовка страницы или перед таблицей
    let subject = '';
    let vedType = '';
    let faculty = facultyCode;
    let groupName = groupCode;

    // Ищем название предмета перед таблицей
    const prevElements = $table.prevAll('h1, h2, h3, h4, h5, h6, .title, .subject, .header, caption');
    if (prevElements.length > 0) {
      const titleText = $(prevElements.first()).text();
      
      // Парсим название предмета
      const subjectMatch = titleText.match(/(?:предмет|дисциплина)[:\s]*([^\n,]+)/i);
      if (subjectMatch) subject = subjectMatch[1].trim();
      
      // Парсим тип ведомости
      if (titleText.toLowerCase().includes('экзамен')) vedType = 'экзамен';
      else if (titleText.toLowerCase().includes('зачёт') || titleText.toLowerCase().includes('зачет')) vedType = 'зачёт';
      else if (titleText.toLowerCase().includes('курсов')) vedType = 'КП';
      else if (titleText.toLowerCase().includes('диф')) vedType = 'дифзачёт';
      
      // Парсим факультет и группу
      const facultyMatch = titleText.match(/(?:факультет|институт)[:\s]*([^\n,]+)/i);
      const groupMatch = titleText.match(/групп[аы][:\s]*([^\n,]+)/i);
      if (facultyMatch) faculty = facultyMatch[1].trim();
      if (groupMatch) groupName = groupMatch[1].trim();
    }

    // Ищем в заголовке страницы
    if (!subject) {
      const pageTitle = $('title').text();
      const h1 = $('h1').first().text();
      subject = pageTitle || h1 || `Предмет ${tableIndex + 1}`;
    }

    // Определяем тип ведомости если не нашли
    if (!vedType) {
      if (gradeIdx >= 0) {
        vedType = 'экзамен';
      } else {
        vedType = 'зачёт';
      }
    }

    // Проверяем закрыта ли ведомость
    const tableText = $table.text().toLowerCase();
    const isClosed = 
      tableText.includes('ведомость закрыта') || 
      tableText.includes('закрыта') ||
      !$table.find('input[type="text"]').length ||
      tableText.includes('итого');

    // Парсим строки студентов
    const students: ParsedStudent[] = [];

    rows.slice(1).each((_, row) => {
      const cells = $(row).find('td');
      if (cells.length === 0) return;

      const student: ParsedStudent = {
        gradebook: '',
        points1: null,
        points2: null,
        points3: null,
        points4: null,
        totalPoints: null,
        grade: null,
      };

      // Номер зачётки
      if (gradebookIdx >= 0 && gradebookIdx < cells.length) {
        student.gradebook = cells.eq(gradebookIdx).text().trim().replace(/\D/g, '');
      }
      // Если не нашли по индексу, пробуем первую колонку с числом
      if (!student.gradebook) {
        cells.each((idx, cell) => {
          const text = $(cell).text().trim();
          // Зачётка обычно 8-10 цифр
          if (/^\d{6,12}$/.test(text.replace(/\D/g, ''))) {
            student.gradebook = text.replace(/\D/g, '');
            return false;
          }
        });
      }

      // Баллы КТ
      if (points1Idx >= 0 && points1Idx < cells.length) {
        student.points1 = parseNumber(cells.eq(points1Idx).text());
      }
      if (points2Idx >= 0 && points2Idx < cells.length) {
        student.points2 = parseNumber(cells.eq(points2Idx).text());
      }
      if (points3Idx >= 0 && points3Idx < cells.length) {
        student.points3 = parseNumber(cells.eq(points3Idx).text());
      }
      if (totalIdx >= 0 && totalIdx < cells.length) {
        student.totalPoints = parseNumber(cells.eq(totalIdx).text());
      }
      if (gradeIdx >= 0 && gradeIdx < cells.length) {
        student.grade = cells.eq(gradeIdx).text().trim();
      }

      // Если не нашли баллы по именам колонок, пробуем по порядку
      if (student.points1 === null && student.points2 === null) {
        let pointIdx = 0;
        cells.each((idx, cell) => {
          if (idx === gradebookIdx) return; // Пропускаем зачётку
          const num = parseNumber($(cell).text());
          if (num !== null) {
            if (pointIdx === 0) student.points1 = num;
            else if (pointIdx === 1) student.points2 = num;
            else if (pointIdx === 2) student.points3 = num;
            else if (pointIdx === 3) student.totalPoints = num;
            pointIdx++;
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

      // Определяем оценку если нет
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

      // Добавляем только если есть номер зачётки
      if (student.gradebook && student.gradebook.length >= 4) {
        students.push(student);
      }
    });

    if (students.length > 0) {
      veds.push({
        faculty,
        groupName,
        course: Math.ceil(semester / 2),
        year,
        semester,
        subject: subject || `Предмет ${tableIndex + 1}`,
        vedType,
        isClosed,
        students,
      });
    }
  });

  return veds;
}

// Парсинг числа
function parseNumber(text: string): number | null {
  const cleaned = text.replace(/[^\d.-]/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

// Полный парсинг сайта
export async function fullParse(
  onProgress?: (message: string, current: number, total: number) => void
): Promise<{ veds: ParsedVed[]; errors: string[] }> {
  const veds: ParsedVed[] = [];
  const errors: string[] = [];

  try {
    // Проверяем доступность
    const availability = await checkSiteAvailability();
    if (!availability.available) {
      errors.push(`Сайт недоступен: ${availability.message}`);
      return { veds, errors };
    }

    // Получаем список факультетов
    onProgress?.('Получение списка факультетов...', 0, 100);
    const faculties = await parseFaculties();

    if (faculties.length === 0) {
      errors.push('Не удалось получить список факультетов');
      return { veds, errors };
    }

    // Учебные годы с 2023
    const years = getAcademicYears();
    const semesters = [1, 2];

    // Считаем общее количество шагов
    const totalSteps = faculties.length * years.length * semesters.length;
    let currentStep = 0;

    for (const faculty of faculties) {
      onProgress?.(
        `Парсинг факультета: ${faculty.name}`,
        currentStep,
        totalSteps
      );

      try {
        // Получаем группы для факультета
        const groups = await parseGroups(faculty.code);

        if (groups.length === 0) {
          // Если групп не нашли, пробуем парсить напрямую по факультету
          for (const year of years) {
            for (const semester of semesters) {
              try {
                const facultyVeds = await parseVedPage(
                  faculty.code,
                  '',
                  year,
                  semester
                );
                veds.push(...facultyVeds);
              } catch (error) {
                errors.push(`${faculty.name}/${year}/${semester}: ${error}`);
              }
              currentStep++;
            }
          }
        } else {
          // Парсим по группам
          for (const group of groups) {
            for (const year of years) {
              for (const semester of semesters) {
                try {
                  const groupVeds = await parseVedPage(
                    faculty.code,
                    group.code,
                    year,
                    semester
                  );
                  veds.push(...groupVeds);
                  
                  onProgress?.(
                    `${faculty.name} → ${group.name} → ${year}`,
                    currentStep,
                    totalSteps
                  );
                } catch (error) {
                  errors.push(`${faculty.name}/${group.name}/${year}/${semester}: ${error}`);
                }
                currentStep++;
              }
            }
          }
        }
      } catch (error) {
        errors.push(`Факультет ${faculty.name}: ${error}`);
      }
    }

    onProgress?.('Парсинг завершён', totalSteps, totalSteps);
  } catch (error) {
    errors.push(`Критическая ошибка: ${error}`);
  }

  return { veds, errors };
}

// Демо-данные
export function generateDemoData(): ParsedVed[] {
  const faculties = [
    'Информационные технологии', 
    'Экономический', 
    'Механический', 
    'Химический', 
    'Строительный',
    'Технологический'
  ];
  
  const groupTemplates = [
    { prefix: 'ИС', name: 'Информационные системы' },
    { prefix: 'ПИ', name: 'Прикладная информатика' },
    { prefix: 'БМ', name: 'Бизнес-информатика' },
    { prefix: 'ЭК', name: 'Экономика' },
    { prefix: 'МН', name: 'Менеджмент' },
    { prefix: 'ТМ', name: 'Технологические машины' },
  ];
  
  const subjects = [
    'Программирование',
    'Базы данных',
    'Алгоритмы и структуры данных',
    'Математический анализ',
    'Линейная алгебра',
    'Физика',
    'Английский язык',
    'История',
    'Философия',
    'Экономика',
    'Менеджмент',
    'Правоведение',
  ];

  const veds: ParsedVed[] = [];
  const years = getAcademicYears();

  faculties.forEach((faculty, facultyIdx) => {
    // 3-4 группы на факультет
    const groupCount = 3 + Math.floor(Math.random() * 2);
    
    for (let g = 0; g < groupCount; g++) {
      const template = groupTemplates[g % groupTemplates.length];
      const groupYear = 21 + g % 4; // 21, 22, 23, 24
      const groupName = `${template.prefix}-${groupYear}`;

      years.forEach((year) => {
        [1, 2].forEach((semester) => {
          // 3-6 предметов на семестр
          const subjectCount = 3 + Math.floor(Math.random() * 4);
          const semesterSubjects = subjects
            .sort(() => Math.random() - 0.5)
            .slice(0, subjectCount);

          semesterSubjects.forEach((subject) => {
            // Случайный тип ведомости
            const vedTypes = ['экзамен', 'зачёт', 'КП'];
            const vedType = vedTypes[Math.floor(Math.random() * vedTypes.length)];

            // Генерация студентов
            const students: ParsedStudent[] = [];
            const studentCount = 15 + Math.floor(Math.random() * 15);

            for (let i = 0; i < studentCount; i++) {
              const yearPrefix = year.split('-')[0];
              const gradebook = `${yearPrefix}${String(Math.floor(Math.random() * 9000) + 1000).padStart(4, '0')}`;
              
              const points1 = 5 + Math.floor(Math.random() * 26); // 5-30
              const points2 = 5 + Math.floor(Math.random() * 26); // 5-30
              const points3 = 10 + Math.floor(Math.random() * 36); // 10-45
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
              groupName: `${groupName}-${Math.ceil(semester / 2)}`,
              course: Math.ceil(semester / 2),
              year,
              semester,
              subject,
              vedType,
              isClosed: Math.random() > 0.15, // 85% закрыты
              students,
            });
          });
        });
      });
    }
  });

  return veds;
}
