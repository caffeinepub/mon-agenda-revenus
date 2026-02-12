import { useState } from 'react';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Calendar, LogOut, User, LayoutDashboard, Plus, Calculator, FileBarChart, Users } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import AppointmentDialog from './AppointmentDialog';

interface HeaderProps {
  userName?: string;
}

export default function Header({ userName }: HeaderProps) {
  const { clear, identity } = useInternetIdentity();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const routerState = useRouterState();
  const isAuthenticated = !!identity;
  const currentPath = routerState.location.pathname;
  const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false);

  const handleLogout = async () => {
    await clear();
    queryClient.clear();
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
              <Calendar className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Mon Agenda Revenus</h1>
              <p className="text-xs text-muted-foreground">Gestion de rendez-vous</p>
            </div>
          </div>

          {isAuthenticated && (
            <div className="flex items-center gap-2">
              <nav className="hidden md:flex items-center gap-2">
                <Button
                  variant={currentPath === '/' ? 'default' : 'ghost'}
                  size="sm"
                  className="gap-2"
                  onClick={() => navigate({ to: '/' })}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Tableau de bord
                </Button>
                <Button
                  variant={currentPath === '/compta-mois' ? 'default' : 'ghost'}
                  size="sm"
                  className="gap-2"
                  onClick={() => navigate({ to: '/compta-mois' })}
                >
                  <Calculator className="h-4 w-4" />
                  Compta Mois
                </Button>
                <Button
                  variant={currentPath === '/rapport-pdf' ? 'default' : 'ghost'}
                  size="sm"
                  className="gap-2"
                  onClick={() => navigate({ to: '/rapport-pdf' })}
                >
                  <FileBarChart className="h-4 w-4" />
                  Rapport PDF
                </Button>
                <Button
                  variant={currentPath === '/client-database' ? 'default' : 'ghost'}
                  size="sm"
                  className="gap-2"
                  onClick={() => navigate({ to: '/client-database' })}
                >
                  <Users className="h-4 w-4" />
                  Base Client
                </Button>
              </nav>

              <Button
                variant="default"
                size="sm"
                className="gap-2"
                onClick={() => setIsNewAppointmentOpen(true)}
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Nouveau Rendez-vous</span>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <User className="h-4 w-4" />
                    <span className="hidden sm:inline">{userName || 'Mon compte'}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Mon compte</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div className="md:hidden">
                    <DropdownMenuItem onClick={() => navigate({ to: '/' })}>
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      Tableau de bord
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate({ to: '/compta-mois' })}>
                      <Calculator className="mr-2 h-4 w-4" />
                      Compta Mois
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate({ to: '/rapport-pdf' })}>
                      <FileBarChart className="mr-2 h-4 w-4" />
                      Rapport PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate({ to: '/client-database' })}>
                      <Users className="mr-2 h-4 w-4" />
                      Base Client
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </div>
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Déconnexion
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </header>

      <AppointmentDialog
        open={isNewAppointmentOpen}
        onOpenChange={setIsNewAppointmentOpen}
      />
    </>
  );
}
