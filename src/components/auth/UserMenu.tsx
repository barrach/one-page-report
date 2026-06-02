import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { LogOut, Settings } from 'lucide-react';
import { ROLE_AVATAR_BG } from '@/types/auth';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function UserMenu() {
  const { email, role, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  if (!email) return null;
  const initial = email.charAt(0).toUpperCase();
  const avatarBg = role ? ROLE_AVATAR_BG[role] : 'bg-gray-500';

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 outline-none group" title={email}>
          <span className="hidden sm:block text-[11px] text-muted-foreground group-hover:text-foreground transition-colors max-w-[180px] truncate">
            {email}
          </span>
          <span className={`h-6 w-6 rounded-full ${avatarBg} flex items-center justify-center text-white font-bold text-[11px] shrink-0`}>
            {initial}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground truncate" title={email}>
            {email}{role ? ` · ${role}` : ''}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {isAdmin && (
            <DropdownMenuItem onClick={() => navigate('/admin')} className="cursor-pointer">
              <Settings className="h-4 w-4 mr-2" /> Configurações
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() => signOut()}
            className="cursor-pointer text-destructive focus:text-destructive"
          >
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
