import { NavLink, useLocation } from 'react-router-dom';
import { navForRole } from '@megawork/config/nav';
import { useMegaWorkAuth } from '@megawork/context/MegaWorkAuthContext';
import { cn } from '@/lib/utils';

export default function MegaWorkSidebar() {
  const { role } = useMegaWorkAuth();
  const location = useLocation();
  const items = navForRole(role);

  const isActive = (path: string) => {
    const full = `/megawork${path ? '/' + path : ''}`;
    if (path === '') return location.pathname === '/megawork' || location.pathname === '/megawork/';
    return location.pathname === full || location.pathname.startsWith(full + '/');
  };

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-card flex flex-col py-3 overflow-y-auto">
      <nav className="flex flex-col gap-0.5 px-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <NavLink
              key={item.key}
              to={`/megawork${item.path ? '/' + item.path : ''}`}
              end={item.path === ''}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                active
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
