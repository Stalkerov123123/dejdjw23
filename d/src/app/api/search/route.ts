import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/search - Поиск по всем параметрам
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const gradebook = searchParams.get('gradebook');
    const faculty = searchParams.get('faculty');
    const group = searchParams.get('group');
    const course = searchParams.get('course');
    const year = searchParams.get('year');
    const semester = searchParams.get('semester');
    const subject = searchParams.get('subject');
    const vedType = searchParams.get('vedType');
    const isClosed = searchParams.get('isClosed');

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Если указана зачётка, ищем по ней
    if (gradebook && gradebook.trim()) {
      const records = await db.studentRecord.findMany({
        where: {
          gradebook: {
            contains: gradebook.trim(),
          },
        },
        include: {
          ved: true,
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      });

      const total = await db.studentRecord.count({
        where: {
          gradebook: {
            contains: gradebook.trim(),
          },
        },
      });

      return NextResponse.json({
        success: true,
        results: records.map((r) => ({
          id: r.id,
          gradebook: r.gradebook,
          points1: r.points1,
          points2: r.points2,
          points3: r.points3,
          points4: r.points4,
          totalPoints: r.totalPoints,
          grade: r.grade,
          ved: {
            id: r.ved.id,
            faculty: r.ved.faculty,
            groupName: r.ved.groupName,
            subject: r.ved.subject,
            vedType: r.ved.vedType,
            year: r.ved.year,
            semester: r.ved.semester,
            isClosed: r.ved.isClosed,
          },
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    }

    // Иначе ищем по ведомостям
    const where: Record<string, unknown> = {};

    if (faculty) where.faculty = { contains: faculty };
    if (group) where.groupName = { contains: group };
    if (course) where.course = parseInt(course);
    if (year) where.year = year;
    if (semester) where.semester = parseInt(semester);
    if (subject) where.subject = { contains: subject };
    if (vedType) where.vedType = vedType;
    if (isClosed !== null) where.isClosed = isClosed === 'true';

    const veds = await db.ved.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        updatedAt: 'desc',
      },
    });

    const total = await db.ved.count({ where });

    return NextResponse.json({
      success: true,
      results: veds.map((v) => ({
        id: v.id,
        faculty: v.faculty,
        groupName: v.groupName,
        course: v.course,
        year: v.year,
        semester: v.semester,
        subject: v.subject,
        vedType: v.vedType,
        isClosed: v.isClosed,
        updatedAt: v.updatedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка поиска' },
      { status: 500 }
    );
  }
}
