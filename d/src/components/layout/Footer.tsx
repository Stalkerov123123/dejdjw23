'use client';

import Link from 'next/link';
import { GraduationCap, RefreshCw, Search, Github } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t bg-card mt-auto">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <GraduationCap className="h-5 w-5" />
            <span className="text-sm">Студенческий рейтинг ВГУИТ</span>
          </div>
          
          <div className="flex items-center gap-4">
            <Link 
              href="/search" 
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Search className="h-4 w-4" />
              <span>Поиск</span>
            </Link>
          </div>
          
          <div className="text-xs text-muted-foreground">
            Данные обновляются автоматически в 10:30 и 17:30 МСК
          </div>
        </div>
      </div>
    </footer>
  );
}
