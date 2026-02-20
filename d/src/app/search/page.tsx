'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  Filter,
  ChevronRight,
  FileText,
  Users,
  Calendar,
  BookOpen,
  GraduationCap,
  X,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Layout } from '@/components/layout/Layout';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';

interface SearchResult {
  id: string;
  gradebook?: string;
  points1?: number | null;
  points2?: number | null;
  points3?: number | null;
  totalPoints?: number | null;
  grade?: string | null;
  ved?: {
    id: string;
    faculty: string;
    groupName: string;
    subject: string;
    vedType: string;
    year: string;
    semester: number;
    isClosed: boolean;
  };
  // Для ведомостей
  faculty?: string;
  groupName?: string;
  course?: number;
  year?: string;
  semester?: number;
  subject?: string;
  vedType?: string;
  isClosed?: boolean;
  updatedAt?: string;
}

interface SearchResponse {
  success: boolean;
  results: SearchResult[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

function SearchPageContent() {
  const searchParams = useSearchParams();
  const [gradebook, setGradebook] = useState(searchParams.get('gradebook') || '');
  const [faculty, setFaculty] = useState(searchParams.get('faculty') || '');
  const [group, setGroup] = useState(searchParams.get('group') || '');
  const [year, setYear] = useState<string | undefined>(searchParams.get('year') || undefined);
  const [semester, setSemester] = useState<string | undefined>(searchParams.get('semester') || undefined);
  const [subject, setSubject] = useState(searchParams.get('subject') || '');
  const [vedType, setVedType] = useState<string | undefined>(searchParams.get('vedType') || undefined);
  
  const [results, setResults] = useState<SearchResult[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const years = ['2024-2025', '2023-2024', '2022-2023', '2021-2022'];
  const vedTypes = ['экзамен', 'зачёт', 'КП', 'курсовая', 'дифзачёт'];

  useEffect(() => {
    const gradebookParam = searchParams.get('gradebook');
    if (gradebookParam) {
      handleSearch();
    }
  }, [searchParams]);

  const handleSearch = async (page: number = 1) => {
    setIsLoading(true);
    setSearched(true);

    try {
      const params = new URLSearchParams();
      if (gradebook) params.append('gradebook', gradebook);
      if (faculty) params.append('faculty', faculty);
      if (group) params.append('group', group);
      if (year) params.append('year', year);
      if (semester) params.append('semester', semester);
      if (subject) params.append('subject', subject);
      if (vedType) params.append('vedType', vedType);
      params.append('page', page.toString());

      const res = await fetch(`/api/search?${params.toString()}`);
      const data: SearchResponse = await res.json();

      if (data.success) {
        setResults(data.results);
        setPagination(data.pagination);
      } else {
        setResults([]);
        setPagination({ page: 1, limit: 20, total: 0, pages: 0 });
      }
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearFilters = () => {
    setGradebook('');
    setFaculty('');
    setGroup('');
    setYear(undefined);
    setSemester(undefined);
    setSubject('');
    setVedType(undefined);
    setResults([]);
    setSearched(false);
  };

  const hasFilters = gradebook || faculty || group || year || semester || subject || vedType;

  const getGradeColor = (grade: string | null | undefined) => {
    if (!grade) return '';
    switch (grade) {
      case '5': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case '4': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case '3': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case '2': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'зачёт': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'незачёт': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default: return '';
    }
  };

  return (
    <Layout>
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <Breadcrumbs items={[{ label: 'Поиск' }]} />
          <h1 className="text-2xl font-bold mt-2 flex items-center gap-2">
            <Search className="h-6 w-6" />
            Расширенный поиск
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Фильтры */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Параметры поиска
              </CardTitle>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Сбросить
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Зачётная книжка</label>
                <Input
                  placeholder="Номер зачётки"
                  value={gradebook}
                  onChange={(e) => setGradebook(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Факультет</label>
                <Input
                  placeholder="Название факультета"
                  value={faculty}
                  onChange={(e) => setFaculty(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Группа</label>
                <Input
                  placeholder="Название группы"
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Предмет</label>
                <Input
                  placeholder="Название предмета"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Учебный год</label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите год" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Семестр</label>
                <Select value={semester} onValueChange={setSemester}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите семестр" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 семестр</SelectItem>
                    <SelectItem value="2">2 семестр</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Тип ведомости</label>
                <Select value={vedType} onValueChange={setVedType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите тип" />
                  </SelectTrigger>
                  <SelectContent>
                    {vedTypes.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={() => handleSearch(1)} className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin">⏳</span>
                      Поиск...
                    </span>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Найти
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Результаты */}
        {searched && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  Результаты поиска
                  {pagination.total > 0 && (
                    <span className="text-muted-foreground font-normal ml-2">
                      ({pagination.total} записей)
                    </span>
                  )}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : results.length > 0 ? (
                <>
                  <div className="space-y-3">
                    {results.map((result) => (
                      <div key={result.id}>
                        {result.gradebook ? (
                          // Результат поиска по зачётке
                          <Link
                            href={`/ved/${result.ved?.id}`}
                            className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent transition-colors group"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <GraduationCap className="h-4 w-4 text-muted-foreground" />
                                <span className="font-mono font-medium">{result.gradebook}</span>
                                {result.grade && (
                                  <Badge className={getGradeColor(result.grade)}>
                                    {result.grade}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {result.ved?.subject} • {result.ved?.groupName} • {result.ved?.faculty}
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-4">
                                <span>КТ1: {result.points1 ?? '—'}</span>
                                <span>КТ2: {result.points2 ?? '—'}</span>
                                <span>КТ3: {result.points3 ?? '—'}</span>
                                <span className="font-medium">Итого: {result.totalPoints ?? '—'}</span>
                              </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                          </Link>
                        ) : (
                          // Результат поиска по ведомости
                          <Link
                            href={`/ved/${result.id}`}
                            className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent transition-colors group"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{result.subject}</span>
                                <Badge variant="outline">{result.vedType}</Badge>
                                {result.isClosed && (
                                  <Badge variant="secondary" className="text-xs">Закрыта</Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {result.groupName} • {result.faculty} • {result.year} • {result.semester} семестр
                              </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Пагинация */}
                  {pagination.pages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-6">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pagination.page === 1}
                        onClick={() => handleSearch(pagination.page - 1)}
                      >
                        Назад
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Страница {pagination.page} из {pagination.pages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pagination.page === pagination.pages}
                        onClick={() => handleSearch(pagination.page + 1)}
                      >
                        Вперёд
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-lg font-medium">Ничего не найдено</p>
                  <p className="text-sm mt-1">Попробуйте изменить параметры поиска</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </Layout>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Загрузка...</div>}>
      <SearchPageContent />
    </Suspense>
  );
}
