import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ContratoConsolidado from '@/components/ContratoConsolidado';
import type { Project } from '@/store/projectStore';

/**
 * A saída do detalhe do contrato.
 *
 * Entrar é um clique na obra dentro da carteira; antes disto, sair só existia
 * no cabeçalho da página, longe de quem tinha acabado de lançar um aditivo.
 */

const obra = (id: string, name: string, cliente: string) => ({
  id,
  name,
  info: { cliente, inicio: '2025-12-28', terminoPrev: '2026-05-17', valorContrato: 0 },
}) as unknown as Project;

const A = obra('a', 'Obra A', 'FRIGO');
const B = obra('b', 'Obra B', 'NTS');

const concluir = () => screen.queryAllByRole('button', { name: /concluir/i });

const montar = (props: Partial<Parameters<typeof ContratoConsolidado>[0]> = {}) =>
  render(
    <ContratoConsolidado
      obras={[A, B]}
      foco={null}
      podeEditar
      aoFocar={() => {}}
      aoConcluir={() => {}}
      {...props}
    />,
  );

describe('ContratoConsolidado', () => {
  it('na carteira não oferece concluir — não há lançamento aberto', () => {
    montar();
    expect(concluir()).toHaveLength(0);
  });

  it('com obra em foco, o detalhe abre com saída no topo e no rodapé', () => {
    montar({ foco: 'a' });
    expect(concluir()).toHaveLength(2);
    expect(screen.getByText('Obra A')).toBeInTheDocument();
  });

  it('concluir devolve o consolidado', () => {
    const aoConcluir = vi.fn();
    montar({ foco: 'a', aoConcluir });
    fireEvent.click(concluir()[0]);
    expect(aoConcluir).toHaveBeenCalledTimes(1);
  });

  it('obra única não oferece volta: não se entrou pela carteira', () => {
    montar({ obras: [A] });
    expect(concluir()).toHaveLength(0);
  });

  it('o lançamento de custo incorrido saiu do bloco', () => {
    montar({ foco: 'a' });
    expect(screen.queryByText(/custo incorrido/i)).toBeNull();
    expect(screen.queryByText(/adicionar mês/i)).toBeNull();
    // O que ficou continua lá.
    expect(screen.getAllByText(/aditivos/i).length).toBeGreaterThan(0);
  });
});
