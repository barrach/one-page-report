import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NavMobile from '@/components/NavMobile';

/**
 * A navegação do celular.
 *
 * A barra lateral é `hidden sm:flex` e o menu do relatório só tinha ações —
 * exportar, apresentar, tema. O consolidado não aparecia em lugar nenhum no
 * telefone: era preciso digitar a URL.
 */

const auth = {
  user: { email: 'pedro@megasteam.com' },
  isAdmin: false,
  canEdit: false,
  signOut: vi.fn(),
};
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }));

const montar = () => render(<MemoryRouter><NavMobile /></MemoryRouter>);
const link = (nome: RegExp) => screen.queryByRole('link', { name: nome });

describe('NavMobile', () => {
  beforeEach(() => { auth.isAdmin = false; auth.canEdit = false; });

  it('leva ao consolidado — o destino que faltava no celular', () => {
    montar();
    expect(link(/consolidado/i)).toHaveAttribute('href', '/consolidado');
  });

  it('e ao relatório, para haver caminho de volta', () => {
    montar();
    expect(link(/relatório/i)).toHaveAttribute('href', '/');
  });

  it('respeita a permissão: sem lançar não há Dados, sem administrar não há Admin', () => {
    montar();
    expect(link(/dados/i)).toBeNull();
    expect(link(/admin/i)).toBeNull();
  });

  it('planejador vê Dados; administrador vê Admin', () => {
    auth.canEdit = true;
    auth.isAdmin = true;
    montar();
    expect(link(/dados/i)).toBeInTheDocument();
    expect(link(/admin/i)).toBeInTheDocument();
  });
});
