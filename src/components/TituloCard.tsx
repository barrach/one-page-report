import { useProjectStore } from '@/store/projectStore';

/**
 * O nome de um card do relatório, renomeável pelo administrador.
 *
 * "Pontos de Atenção" e "Visão de 5 Semanas" são os nomes que este app
 * escolheu; cada empresa chama do seu jeito, e um relatório com vocabulário de
 * fora obriga quem lê a traduzir antes de entender.
 *
 * É um COMPONENTE, e não um hook nem uma função: vários cards têm `return null`
 * antes do título (papel sem acesso, modo TV, sem dado), e um hook chamado
 * depois de retorno condicional quebra as regras de hooks; uma função pura
 * precisaria do projeto em mãos, e metade dos títulos vive em subcomponentes
 * que não o recebem. Como componente, ele assina o store sozinho, onde estiver.
 *
 * O nome é do RELATÓRIO, não do projeto: renomeado uma vez vale em todas as
 * obras, senão o mesmo card teria nome diferente conforme o contrato aberto.
 */
const TituloCard = ({ id, padrao }: { id: string; padrao: string }) => {
  const titulo = useProjectStore(
    (s) => s.projects.find((p) => p.titulosRelatorio)?.titulosRelatorio?.[id]?.trim(),
  );
  return <>{titulo || padrao}</>;
};

export default TituloCard;
