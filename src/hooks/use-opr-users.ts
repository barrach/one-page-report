import { useEffect, useState } from 'react';
import { oprDataClient } from '@/integrations/supabase/oprDataClient';

export interface OprUser {
  /** Nome de exibição; cai no e-mail quando o perfil não tem nome. */
  nome: string;
  email: string;
}

let cache: OprUser[] | null = null;

/**
 * Usuários do One Page Report, para preencher campos de responsável.
 *
 * Lê a tabela `profiles` — e não a função `admin-users`, que exige privilégio de
 * administrador e portanto não serve para um usuário comum. Se a leitura falhar
 * (RLS, rede), devolve lista vazia: quem consome deve continuar aceitando texto
 * livre, para a falta de lista nunca travar o preenchimento.
 */
export const useOprUsers = (): { users: OprUser[]; loading: boolean } => {
  const [users, setUsers] = useState<OprUser[]>(cache ?? []);
  const [loading, setLoading] = useState(cache === null);

  useEffect(() => {
    if (cache !== null) return;
    let ativo = true;
    (async () => {
      try {
        const { data, error } = await oprDataClient
          .from('profiles')
          .select('display_name, email')
          .order('display_name');
        if (error) throw error;
        const lista: OprUser[] = (data ?? [])
          .map((p) => ({
            nome: String(p.display_name || p.email || '').trim(),
            email: String(p.email || '').trim(),
          }))
          .filter((u) => u.nome);
        cache = lista;
        if (ativo) setUsers(lista);
      } catch {
        cache = [];
        if (ativo) setUsers([]);
      } finally {
        if (ativo) setLoading(false);
      }
    })();
    return () => { ativo = false; };
  }, []);

  return { users, loading };
};
