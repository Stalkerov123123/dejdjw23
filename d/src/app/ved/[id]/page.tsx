'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  FileText,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Users,
  TrendingUp,
  Lock,
  Calendar,
  BookOpen,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Layout } from '@/components/layout/Layout';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';

interface StudentRecord {
  id: string;
  gradebook: string;
  points1: number | null;
  points2: number | null;
  points3: number | null;
  points4: number | null;
  totalPoints: number | null;
  grade: string | null;
}

interface VedData {
  id: string;
  faculty: string;
  groupName: string;
  course: number;
  year: string;
  semester: number;
  subject: string;
  vedType: string;
  isClosed: boolean;
  updatedAt: string;
  studentRecords: StudentRecord[];
}

interface Stats {
  total: number;
  avgTotal: number;
  minTotal: number;
  maxTotal: number;
  grades: Record<string, number>;
}

type SortField = 'gradebook' | 'points1' | 'points2' | 'points3' | 'totalPoints' | 'grade';
type SortOrder = 'asc' | 'desc';

function VedPageContent() {
  const params = useParams();
  const vedId = params.id as string;
  
  const [ved, setVed] = useState<VedData | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [sortField, setSortField] = useState<SortField>('gradebook');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [sortedRecords, setSortedRecords] = useState<StudentRecord[]>([]);

  useEffect(() => {
    loadData();
  }, [vedId]);

  useEffect(() => {
    if (ved) {
      sortRecords(ved.studentRecords, sortField, sortOrder);
    }
  }, [ved, sortField, sortOrder]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/ved/${vedId}`);
      const data = await res.json();
      
      if (data.success) {
        setVed(data.ved);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sortRecords = (records: StudentRecord[], field: SortField, order: SortOrder) => {
    const sorted = [...records].sort((a, b) => {
      let aVal: string | number | null = a[field];
      let bVal: string | number | null = b[field];

      // Обработка null значений
      if (aVal === null) aVal = order === 'asc' ? Infinity : -Infinity;
      if (bVal === null) bVal = order === 'asc' ? Infinity : -Infinity;

      // Сортировка оценок специально
      if (field === 'grade') {
        const gradeOrder: Record<string, number> = {
          '5': 5, '4': 4, '3': 3, '2': 2,
          'зачёт': 1, 'незачёт': 0,
        };
        aVal = gradeOrder[String(aVal)] ?? -1;
        bVal = gradeOrder[String(bVal)] ?? -1;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return order === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return order === 'asc' 
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
    
    setSortedRecords(sorted);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 opacity-50" />;
    return sortOrder === 'asc' 
      ? <ArrowUp className="h-4 w-4" />
      : <ArrowDown className="h-4 w-4" />;
  };

  const getGradeColor = (grade: string | null) => {
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

  const exportCSV = () => {
    if (!ved) return;

    const headers = ['Зачётка', 'КТ1', 'КТ2', 'КТ3', 'КТ4', 'Итого', 'Оценка'];
    const rows = sortedRecords.map(r => [
      r.gradebook,
      r.points1 ?? '',
      r.points2 ?? '',
      r.points3 ?? '',
      r.points4 ?? '',
      r.totalPoints ?? '',
      r.grade ?? '',
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.join(';')),
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${ved.groupName}_${ved.subject}_${ved.year}_sem${ved.semester}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Layout>
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <Breadcrumbs
            items={[
              { label: ved?.faculty || '', href: ved ? `/faculty/${encodeURIComponent(ved.faculty)}` : undefined },
              { label: ved?.groupName || '', href: ved ? `/group/${encodeURIComponent(ved.groupName)}` : undefined },
              { label: ved?.subject || '' },
            ]}
          />
          {isLoading ? (
            <Skeleton className="h-8 w-64 mt-2" />
          ) : (
            <div className="mt-2">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <FileText className="h-6 w-6" />
                {ved?.subject}
              </h1>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-muted-foreground">
                <span className="flex items-center gap-1">
                  <BookOpen className="h-4 w-4" />
                  {ved?.groupName}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {ved?.year} • {ved?.semester} семестр
                </span>
                <span>•</span>
                <Badge variant="outline">{ved?.vedType}</Badge>
                {ved?.isClosed && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    Закрыта
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Статистика */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{stats.total}</p>
                    <p className="text-xs text-muted-foreground">Студентов</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{stats.avgTotal}</p>
                    <p className="text-xs text-muted-foreground">Средний балл</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div>
                  <p className="text-2xl font-bold text-green-600">{stats.maxTotal}</p>
                  <p className="text-xs text-muted-foreground">Максимум</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div>
                  <p className="text-2xl font-bold text-red-600">{stats.minTotal}</p>
                  <p className="text-xs text-muted-foreground">Минимум</p>
                </div>
              </CardContent>
            </Card>
            <Card className="col-span-2">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  {Object.entries(stats.grades).filter(([_, count]) => count > 0).map(([grade, count]) => (
                    <TooltipProvider key={grade}>
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge className={`${getGradeColor(grade)} font-mono`}>
                            {grade}: {count}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          {Math.round((count / stats.total) * 100)}% от общего числа
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Таблица */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Результаты
                </CardTitle>
                <CardDescription>
                  Нажмите на заголовок для сортировки
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={exportCSV} disabled={!ved}>
                <Download className="h-4 w-4 mr-2" />
                Экспорт CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(10)].map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : sortedRecords.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('gradebook')}
                      >
                        <div className="flex items-center gap-1">
                          Зачётка
                          <SortIcon field="gradebook" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50 text-center"
                        onClick={() => handleSort('points1')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          КТ1
                          <SortIcon field="points1" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50 text-center"
                        onClick={() => handleSort('points2')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          КТ2
                          <SortIcon field="points2" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50 text-center"
                        onClick={() => handleSort('points3')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          КТ3
                          <SortIcon field="points3" />
                        </div>
                      </TableHead>
                      <TableHead className="text-center">КТ4</TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50 text-center font-medium"
                        onClick={() => handleSort('totalPoints')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          Итого
                          <SortIcon field="totalPoints" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50 text-center font-medium"
                        onClick={() => handleSort('grade')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          Оценка
                          <SortIcon field="grade" />
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedRecords.map((record) => (
                      <TableRow key={record.id} className="hover:bg-muted/50">
                        <TableCell className="font-mono">{record.gradebook}</TableCell>
                        <TableCell className="text-center">{record.points1 ?? '—'}</TableCell>
                        <TableCell className="text-center">{record.points2 ?? '—'}</TableCell>
                        <TableCell className="text-center">{record.points3 ?? '—'}</TableCell>
                        <TableCell className="text-center">{record.points4 ?? '—'}</TableCell>
                        <TableCell className="text-center font-medium">{record.totalPoints ?? '—'}</TableCell>
                        <TableCell className="text-center">
                          {record.grade && (
                            <Badge className={getGradeColor(record.grade)}>
                              {record.grade}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Нет данных</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </Layout>
  );
}

export default function VedPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Загрузка...</div>}>
      <VedPageContent />
    </Suspense>
  );
}
