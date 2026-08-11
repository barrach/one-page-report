import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { useOprUsers } from '@/hooks/use-opr-users';
import { cn } from '@/lib/utils';

/**
 * Seletor de responsável com busca, alimentado pelos usuários do One Page Report.
 *
 * Aceita também um nome que não esteja na lista: responsável pode ser alguém de
 * fora do sistema (terceiro, cliente), e a falta da lista — ou de permissão para
 * lê-la — não pode travar o preenchimento.
 */
const ResponsavelSelect = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) => {
  const { users, loading } = useOprUsers();
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState('');

  const escolher = (nome: string) => {
    onChange(nome);
    setOpen(false);
    setBusca('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'w-full flex items-center justify-between gap-1 bg-transparent border-b border-border hover:border-primary/60 focus:border-primary outline-none text-sm font-medium pb-1 text-left transition-colors',
            value ? 'text-foreground' : 'text-muted-foreground/60 font-normal',
          )}
        >
          <span className="truncate">{value || 'selecionar'}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command shouldFilter>
          <CommandInput
            placeholder="Buscar usuário..."
            value={busca}
            onValueChange={setBusca}
          />
          <CommandList>
            <CommandEmpty>
              {busca.trim() ? (
                <button
                  type="button"
                  onClick={() => escolher(busca.trim())}
                  className="w-full text-left text-xs px-2 py-1.5 hover:bg-muted rounded"
                >
                  Usar “{busca.trim()}”
                </button>
              ) : loading ? (
                <span className="text-xs">Carregando usuários...</span>
              ) : (
                <span className="text-xs">Nenhum usuário cadastrado — digite um nome.</span>
              )}
            </CommandEmpty>
            <CommandGroup>
              {users.map((u) => (
                <CommandItem key={u.email || u.nome} value={`${u.nome} ${u.email}`} onSelect={() => escolher(u.nome)}>
                  <Check className={cn('mr-2 h-3.5 w-3.5', value === u.nome ? 'opacity-100' : 'opacity-0')} />
                  <span className="min-w-0">
                    <span className="block text-xs font-medium truncate">{u.nome}</span>
                    {u.email && u.email !== u.nome && (
                      <span className="block text-[10px] text-muted-foreground truncate">{u.email}</span>
                    )}
                  </span>
                </CommandItem>
              ))}
              {value && (
                <CommandItem value="__limpar" onSelect={() => escolher('')}>
                  <span className="text-xs text-muted-foreground">Limpar responsável</span>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default ResponsavelSelect;
