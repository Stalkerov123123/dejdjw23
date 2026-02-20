'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Users,
  ChevronRight,
  FileText,
  BookOpen,
  Calendar,
  Filter,
  TrendingUp,
  Clock,
  CheckCircle,
  Lock,
} from 'lucide-react';
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

interface VedData {
  id: string;
  subject: string;
  vedType: string;
  year: string;
  semester: number;
  isClosed: boolean;
  course?: number;
  updatedAt?: string;
}

interface GroupStats {
  totalVeds: number;
  closedVeds: number;
  subjects: string[];
  years: string[];
}

function GroupPageContent() {
  const params = useParams();
  const groupName = decodeURIComponent(params.name as string);
  
  const [veds, setVeds] = useState<VedData[]>([]);
  const [stats, setStats] = useState<GroupStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [semesterFilter, setSemesterFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, [groupName, yearFilter, semesterFilter, typeFilter]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const searchParams = new URLSearchParams({ group: groupName, limit: '100' });
      if (yearFilter && yearFilter !== 'all') searchParams.append('year', yearFilter);
      if (semesterFilter && semesterFilter !== 'all') searchParams.append('semester', semesterFilter);
      if (typeFilter && typeFilter !== 'all') searchParams.append('vedType', typeFilter);
      
      const res = await fetch(`/api/search?${searchParams.toString()}`);
      const data = await res.json();
      
      if (data.success) {
        setVeds(data.results);
        
        // Вычисляем статистику
        setStats({
          totalVeds: data.results.length,
          closedVeds: data.results.filter((v: VedData) => v.isClosed).length,
          subjects: [...new Set(data.results.map((v: VedData) => v.subject))],
          years: [...new Set(data.results.map((v: VedData) => v.year))],
        });
      }
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const years = ['2024-2025', '2023-2024', '2022-2023', '2021-2022'];
  const vedTypes = ['экзамен', 'зачёт', 'КП', 'курсовая', 'дифзачёт'];

  // Группируем по предметам
  const groupedBySubject = veds.reduce((acc, ved) => {
    if (!acc[ved.subject]) {
      acc[ved.subject] = [];
    }
    acc[ved.subject].push(ved);
    return acc;
  }, {} as Record<string, VedData[]>);

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <Layout>
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <Breadcrumbs
            items={[
              { label: groupName },
            ]}
          />
          <h1 className="text-2xl font-bold mt-2 flex items-center gap-2">
            <Users className="h-6 w-6" />
            {groupName}
          </h1>
          <p className="text-muted-foreground mt-1">
            Группа • {stats?.subjects.length || 0} предметов • {veds.length} ведомостей
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Статистика */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{stats.totalVeds}</p>
                    <p className="text-xs text-muted-foreground">Ведомостей</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{stats.closedVeds}</p>
                    <p className="text-xs text-muted-foreground">Закрыто</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{stats.subjects.length}</p>
                    <p className="text-xs text-muted-foreground">Предметов</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{stats.years.length}</p>
                    <p className="text-xs text-muted-foreground">Уч. годов</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Фильтры */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="h-5 w-5" />
              Фильтры
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="min-w-[150px]">
                <Select value={yearFilter} onValueChange={setYearFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Учебный год" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все годы</SelectItem>
                    {years.map((y) => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[150px]">
                <Select value={semesterFilter} onValueChange={setSemesterFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Семестр" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все семестры</SelectItem>
                    <SelectItem value="1">1 семестр</SelectItem>
                    <SelectItem value="2">2 семестр</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[150px]">
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Тип ведомости" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все типы</SelectItem>
                    {vedTypes.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ведомости по предметам */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Ведомости
            </CardTitle>
            <CardDescription>
              Нажмите для просмотра деталей
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : Object.keys(groupedBySubject).length > 0 ? (
              <div className="space-y-6">
                {Object.entries(groupedBySubject).map(([subject, subjectVeds]) => (
                  <div key={subject}>
                    <h3 className="font-medium text-lg mb-3 flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                      {subject}
                      <Badge variant="outline" className="ml-2">{subjectVeds.length}</Badge>
                    </h3>
                    <div className="space-y-2">
                      {subjectVeds.map((ved) => (
                        <Link
                          key={ved.id}
                          href={`/ved/${ved.id}`}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent transition-colors group"
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{ved.vedType}</Badge>
                                <span className="text-sm text-muted-foreground">
                                  {ved.year} • {ved.semester} семестр
                                </span>
                                {ved.isClosed && (
                                  <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                    <Lock className="h-3 w-3" />
                                    Закрыта
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Нет ведомостей для этой группы</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </Layout>
  );
}

export default function GroupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Загрузка...</div>}>
      <GroupPageContent />
    </Suspense>
  );
}
