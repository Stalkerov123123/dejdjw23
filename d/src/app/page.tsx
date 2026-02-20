'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  Download, 
  Trash2, 
  GraduationCap, 
  ChevronRight, 
  CheckCircle,
  AlertCircle,
  Loader2,
  Building2,
  Users,
  FileText,
  Calendar,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Layout } from '@/components/layout/Layout';
import { toast } from 'sonner';

interface Stats {
  totalVeds: number;
  totalRecords: number;
  faculties: { name: string; count: number }[];
  years: { year: string; count: number }[];
}

interface Progress {
  step: string;
  current: number;
  total: number;
  status: 'loading' | 'parsing' | 'saving' | 'done' | 'error';
}

export default function HomePage() {
  const router = useRouter();
  
  const [gradebook, setGradebook] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadData();
    // Опрашиваем прогресс каждые 500мс при загрузке
    const interval = setInterval(() => {
      if (isProcessing) {
        loadData();
      }
    }, 500);
    return () => clearInterval(interval);
  }, [isProcessing]);

  const loadData = async () => {
    try {
      const res = await fetch('/api/parse');
      const data = await res.json();
      
      if (data.success) {
        setStats(data.stats);
        setAvailableYears(data.availableYears || []);
        setProgress(data.progress);
        
        // Если прогресс завершён - прекращаем опрос
        if (data.progress?.status === 'done' || data.progress?.status === 'error') {
          setIsProcessing(false);
        }
      }
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradebook.trim()) {
      toast.error('Введите номер зачётки');
      return;
    }
    router.push(`/search?gradebook=${encodeURIComponent(gradebook.trim())}`);
  };

  // Автозагрузка ведомостей
  const handleAutoLoad = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'load',
          faculty: 'УИТС',
          yearsCount: 2
        }),
      });

      const data = await res.json();
      
      if (data.success) {
        toast.success(data.message);
        loadData();
      } else {
        toast.error(data.error || 'Ошибка');
        setIsProcessing(false);
      }
    } catch (error) {
      toast.error('Ошибка загрузки');
      setIsProcessing(false);
    }
  };

  // Демо-данные
  const handleDemo = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          demo: true,
          faculty: 'УИТС',
          yearsCount: 2
        }),
      });

      const data = await res.json();
      
      if (data.success) {
        toast.success(data.message);
        loadData();
      } else {
        toast.error(data.error);
        setIsProcessing(false);
      }
    } catch (error) {
      toast.error('Ошибка');
      setIsProcessing(false);
    }
  };

  // Очистка
  const handleClear = async () => {
    if (!confirm('Удалить все данные?')) return;
    
    setIsProcessing(true);
    try {
      const res = await fetch('/api/parse', { method: 'DELETE' });
      const data = await res.json();
      
      if (data.success) {
        toast.success(data.message);
        setStats(null);
        setProgress(null);
      }
    } catch (error) {
      toast.error('Ошибка');
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusIcon = () => {
    if (!progress) return null;
    
    switch (progress.status) {
      case 'done':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
    }
  };

  return (
    <Layout>
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <GraduationCap className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Студенческий рейтинг ВГУИТ</h1>
              <p className="text-sm text-muted-foreground">
                Факультет УИТС • Годы: {availableYears.slice(0, 2).join(', ')}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Статистика */}
        {stats && stats.totalVeds > 0 && (
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
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{stats.totalRecords.toLocaleString('ru-RU')}</p>
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
                    <p className="text-2xl font-bold">{stats.faculties.length}</p>
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
                    <p className="text-2xl font-bold">{stats.years.length}</p>
                    <p className="text-xs text-muted-foreground">Уч. годов</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Поиск */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Поиск по зачётке
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                type="text"
                placeholder="Номер зачётной книжки"
                value={gradebook}
                onChange={(e) => setGradebook(e.target.value)}
                className="flex-1"
              />
              <Button type="submit">
                <Search className="h-4 w-4 mr-2" />
                Найти
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Загрузка данных */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Загрузка ведомостей
            </CardTitle>
            <CardDescription>
              Автоматическая загрузка с сайта rating.vsuet.ru
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Кнопки */}
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleAutoLoad}
                disabled={isProcessing}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Wifi className="h-4 w-4 mr-2" />
                )}
                Загрузить с сайта
              </Button>

              <Button
                variant="outline"
                onClick={handleDemo}
                disabled={isProcessing}
                className="border-green-300 text-green-700 hover:bg-green-50"
              >
                <FileText className="h-4 w-4 mr-2" />
                Демо-данные
              </Button>

              {stats && stats.totalVeds > 0 && (
                <Button
                  variant="destructive"
                  onClick={handleClear}
                  disabled={isProcessing}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Очистить
                </Button>
              )}
            </div>

            {/* Прогресс */}
            {progress && isProcessing && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {getStatusIcon()}
                  <span className="text-sm">{progress.step}</span>
                </div>
                <Progress value={progress.current} className="h-2" />
              </div>
            )}

            {/* Информация */}
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Building2 className="h-4 w-4" />
                Факультет: УИТС
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Годы: {availableYears.slice(0, 2).join(', ')}
              </span>
              <span className="flex items-center gap-1">
                <RefreshCw className="h-4 w-4" />
                Семестры: 1, 2
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Факультеты */}
        {stats && stats.faculties.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Факультеты
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {stats.faculties.map((faculty) => (
                  <Link
                    key={faculty.name}
                    href={`/faculty/${encodeURIComponent(faculty.name)}`}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <Building2 className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                      <span className="font-medium">{faculty.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{faculty.count}</Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Нет данных */}
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        ) : (!stats || stats.totalVeds === 0) && (
          <Card>
            <CardContent className="py-12 text-center">
              <WifiOff className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium">Нет данных</p>
              <p className="text-muted-foreground mt-1 mb-4">
                Нажмите &quot;Загрузить с сайта&quot; для автоматической загрузки
              </p>
              <Button onClick={handleAutoLoad} className="bg-blue-600 hover:bg-blue-700">
                <Download className="h-4 w-4 mr-2" />
                Загрузить ведомости
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </Layout>
  );
}
