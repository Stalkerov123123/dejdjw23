'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  RefreshCw, 
  GraduationCap, 
  ChevronRight, 
  Clock,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Building2,
  Users,
  FileText,
  Wifi,
  WifiOff,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Layout } from '@/components/layout/Layout';
import { toast } from 'sonner';

interface Faculty {
  name: string;
  vedsCount: number;
}

interface ParseLog {
  id: string;
  status: string;
  message: string | null;
  vedsParsed: number;
  recordsParsed: number;
  startedAt: string;
  finishedAt: string | null;
}

interface ParseStatus {
  success: boolean;
  log: ParseLog | null;
  siteAvailable: boolean;
  siteMessage: string;
  years: string[];
  stats: {
    totalVeds: number;
    totalRecords: number;
    facultiesCount: number;
  };
}

export default function HomePage() {
  const router = useRouter();
  const [gradebook, setGradebook] = useState('');
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [parseStatus, setParseStatus] = useState<ParseStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isParsing, setIsParsing] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [facultiesRes, parseRes] = await Promise.all([
        fetch('/api/faculties'),
        fetch('/api/parse'),
      ]);

      const facultiesData = await facultiesRes.json();
      const parseData = await parseRes.json();

      if (facultiesData.success) {
        setFaculties(facultiesData.faculties);
      }

      setParseStatus(parseData);
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradebook.trim()) {
      setSearchError('Введите номер зачётной книжки');
      return;
    }
    router.push(`/search?gradebook=${encodeURIComponent(gradebook.trim())}`);
  };

  const handleParse = async (useDemo: boolean = false) => {
    setIsParsing(true);
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demo: useDemo }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        pollParseStatus();
      } else {
        toast.error(data.error || 'Ошибка запуска');
        setIsParsing(false);
      }
    } catch (error) {
      console.error('Parse error:', error);
      toast.error('Ошибка запуска');
      setIsParsing(false);
    }
  };

  const pollParseStatus = async () => {
    const poll = async () => {
      try {
        const res = await fetch('/api/parse');
        const data = await res.json();
        
        if (data.success) {
          setParseStatus(data);
          
          if (data.log?.status === 'in_progress') {
            setTimeout(poll, 2000);
          } else {
            setIsParsing(false);
            loadData();
          }
        }
      } catch (error) {
        console.error('Poll error:', error);
        setIsParsing(false);
      }
    };

    poll();
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'in_progress':
        return <Loader2 className="h-5 w-5 text-amber-500 animate-spin" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const parseLog = parseStatus?.log;

  return (
    <Layout>
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <GraduationCap className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Студенческий рейтинг ВГУИТ</h1>
              <p className="text-sm text-muted-foreground">
                Поиск успеваемости по номеру зачётной книжки
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Предупреждение о недоступности */}
        {parseStatus && !parseStatus.siteAvailable && (
          <Alert className="mb-8 border-amber-200 bg-amber-50 dark:bg-amber-950/20">
            <WifiOff className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800 dark:text-amber-400">
              Сайт rating.vsuet.ru недоступен
            </AlertTitle>
            <AlertDescription className="text-amber-700 dark:text-amber-300">
              {parseStatus.siteMessage}. Нажмите &quot;Демо-данные&quot; для тестирования.
            </AlertDescription>
          </Alert>
        )}

        {/* Поиск */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Поиск по зачётной книжке
            </CardTitle>
            <CardDescription>
              Введите номер зачётной книжки для просмотра результатов
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                type="text"
                placeholder="Например: 20241234"
                value={gradebook}
                onChange={(e) => {
                  setGradebook(e.target.value);
                  setSearchError(null);
                }}
                className="flex-1"
              />
              <Button type="submit">
                <Search className="h-4 w-4 mr-2" />
                Найти
              </Button>
            </form>
            {searchError && (
              <p className="text-sm text-destructive mt-2">{searchError}</p>
            )}
          </CardContent>
        </Card>

        {/* Статистика */}
        {parseStatus?.stats && parseStatus.stats.totalVeds > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{parseStatus.stats.totalVeds}</p>
                    <p className="text-xs text-muted-foreground">Ведомостей</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{parseStatus.stats.totalRecords.toLocaleString('ru-RU')}</p>
                    <p className="text-xs text-muted-foreground">Записей</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{parseStatus.stats.facultiesCount}</p>
                    <p className="text-xs text-muted-foreground">Факультетов</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{parseStatus.years?.length || 0}</p>
                    <p className="text-xs text-muted-foreground">Уч. годов</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Обновление данных */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  Обновление данных
                  {parseStatus?.siteAvailable && (
                    <Badge variant="outline" className="ml-2 text-green-600 border-green-300">
                      <Wifi className="h-3 w-3 mr-1" />
                      Сайт доступен
                    </Badge>
                  )}
                </CardTitle>
                {parseStatus?.years && (
                  <CardDescription className="mt-1">
                    Учебные годы: {parseStatus.years.join(', ')}
                  </CardDescription>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleParse(true)}
                  disabled={isParsing}
                  className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:hover:bg-green-900"
                >
                  {isParsing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Демо-данные
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleParse(false)}
                  disabled={isParsing || !parseStatus?.siteAvailable}
                  title={!parseStatus?.siteAvailable ? 'Сайт недоступен' : 'Загрузить с сайта'}
                >
                  {isParsing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  С сайта
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : parseLog ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  {getStatusIcon(parseLog.status)}
                  <div>
                    <p className="font-medium">
                      {parseLog.status === 'in_progress' 
                        ? 'Загрузка данных...' 
                        : parseLog.status === 'success' 
                          ? 'Данные успешно загружены' 
                          : 'Ошибка при загрузке'}
                    </p>
                    {parseLog.message && (
                      <p className="text-sm text-muted-foreground">{parseLog.message}</p>
                    )}
                  </div>
                </div>
                {parseLog.vedsParsed > 0 && (
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <FileText className="h-4 w-4" />
                      Ведомостей: {parseLog.vedsParsed}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      Записей: {parseLog.recordsParsed.toLocaleString('ru-RU')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {formatDate(parseLog.finishedAt || parseLog.startedAt)}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="font-medium">Данные не загружены</p>
                  <p className="text-sm text-muted-foreground">
                    Нажмите &quot;Демо-данные&quot; или &quot;С сайта&quot; для загрузки
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Факультеты */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Факультеты
            </CardTitle>
            <CardDescription>
              Выберите факультет для просмотра групп и ведомостей
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : faculties.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {faculties.map((faculty) => (
                  <Link
                    key={faculty.name}
                    href={`/faculty/${encodeURIComponent(faculty.name)}`}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent hover:border-primary/50 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <Building2 className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      <span className="font-medium">{faculty.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{faculty.vedsCount}</Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">Нет данных о факультетах</p>
                <p className="text-sm mt-1">Нажмите &quot;Демо-данные&quot; для тестирования</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </Layout>
  );
}
