'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  ChevronRight,
  Users,
  FileText,
  Calendar,
  BookOpen,
  Filter,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Layout } from '@/components/layout/Layout';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';

interface GroupData {
  name: string;
  faculty: string;
  vedsCount: number;
}

interface GroupStats {
  groupName: string;
  vedsCount: number;
  subjects: number;
  avgPoints: number;
  latestUpdate: string;
}

interface VedData {
  id: string;
  subject: string;
  vedType: string;
  year: string;
  semester: number;
  isClosed: boolean;
  groupName: string;
}

function FacultyPageContent() {
  const params = useParams();
  const facultyName = decodeURIComponent(params.name as string);
  
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [veds, setVeds] = useState<VedData[]>([]);
  const [stats, setStats] = useState<{ totalVeds: number; totalRecords: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [semesterFilter, setSemesterFilter] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, [facultyName, yearFilter, semesterFilter]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Загружаем группы факультета
      const groupsRes = await fetch(`/api/groups?faculty=${encodeURIComponent(facultyName)}`);
      const groupsData = await groupsRes.json();
      
      if (groupsData.success) {
        setGroups(groupsData.groups);
      }

      // Загружаем ведомости факультета
      const searchParams = new URLSearchParams({ faculty: facultyName });
      if (yearFilter && yearFilter !== 'all') searchParams.append('year', yearFilter);
      if (semesterFilter && semesterFilter !== 'all') searchParams.append('semester', semesterFilter);
      
      const vedsRes = await fetch(`/api/search?${searchParams.toString()}`);
      const vedsData = await vedsRes.json();
      
      if (vedsData.success) {
        setVeds(vedsData.results);
      }
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Группируем ведомости по группам
  const groupStats: GroupStats[] = [];
  const groupedVeds = veds.reduce((acc, ved) => {
    if (!acc[ved.groupName]) {
      acc[ved.groupName] = [];
    }
    acc[ved.groupName].push(ved);
    return acc;
  }, {} as Record<string, VedData[]>);

  Object.entries(groupedVeds).forEach(([groupName, groupVeds]) => {
    groupStats.push({
      groupName,
      vedsCount: groupVeds.length,
      subjects: new Set(groupVeds.map(v => v.subject)).size,
      avgPoints: 0, // TODO: вычислить
      latestUpdate: '', // TODO: вычислить
    });
  });

  const years = ['2024-2025', '2023-2024', '2022-2023', '2021-2022'];

  return (
    <Layout>
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <Breadcrumbs
            items={[
              { label: facultyName },
            ]}
          />
          <h1 className="text-2xl font-bold mt-2 flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            {facultyName}
          </h1>
          <p className="text-muted-foreground mt-1">
            Факультет • {groups.length} групп • {veds.length} ведомостей
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
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
            </div>
          </CardContent>
        </Card>

        {/* Группы */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Группы факультета
            </CardTitle>
            <CardDescription>
              Выберите группу для просмотра ведомостей
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : groupStats.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupStats.map((group) => (
                  <Link
                    key={group.groupName}
                    href={`/group/${encodeURIComponent(group.groupName)}`}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent hover:border-primary/50 transition-all group"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{group.groupName}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {group.vedsCount} вед.
                        </span>
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          {group.subjects} предм.
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Нет данных о группах</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </Layout>
  );
}

export default function FacultyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Загрузка...</div>}>
      <FacultyPageContent />
    </Suspense>
  );
}
