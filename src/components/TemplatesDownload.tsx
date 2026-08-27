import { FileSpreadsheet, Download } from 'lucide-react';
import SecaoRecolhivel from '@/components/SecaoRecolhivel';

/**
 * Modelos oficiais de importação, servidos de /public/templates.
 *
 * São os mesmos arquivos que os parsers esperam — quem baixar daqui, preencher e
 * subir na importação passa pela detecção sem ajuste nenhum.
 *
 * O cronograma saiu daqui: a Curva S agora vem do MS Project (Trabalho ou Custo
 * acumulado), lançada direto na seção da Curva S, e o único modelo de planilha
 * que continua valendo é o da Programação Semanal.
 */
const TEMPLATES = [
  {
    nome: 'Programação Semanal',
    arquivo: '/templates/template-programacao-semanal.xlsx',
    descricao: 'Atividades da semana em pares Prev./Real, com aderência e causas',
  },
];

const TemplatesDownload = () => (
  <SecaoRecolhivel
    id="modelos-importacao"
    titulo="Modelos de Importação"
    descricao="Baixe o modelo, preencha e suba em “Importar Semana”. Não altere os títulos das colunas nem os nomes das abas — é por eles que a importação reconhece o arquivo."
  >
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {TEMPLATES.map((t) => (
        <a
          key={t.arquivo}
          href={t.arquivo}
          download
          className="group flex items-start gap-3 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 hover:border-primary/40 transition-colors p-3"
        >
          <FileSpreadsheet className="h-5 w-5 text-success shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              {t.nome}
              <Download className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{t.descricao}</p>
          </div>
        </a>
      ))}
    </div>
  </SecaoRecolhivel>
);

export default TemplatesDownload;
