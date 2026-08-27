import { useState } from 'react';
import { Search, MapPin, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useCurrentProject, useProjectStore } from '@/store/projectStore';
import SecaoRecolhivel from '@/components/SecaoRecolhivel';
import { buscarLocais, type LocalClima } from '@/lib/clima';

/**
 * Onde a obra fica, para o card de clima do relatório.
 *
 * Não é um campo de URL: o navegador não consegue ler um site de clima qualquer
 * (o CORS bloqueia), então um endereço colado aqui falharia em silêncio. O que
 * se informa é o MUNICÍPIO, e a previsão vem da Open-Meteo — gratuita e sem
 * cadastro.
 */
const ClimaConfig = () => {
  const { info } = useCurrentProject();
  const setInfo = useProjectStore((s) => s.setInfo);

  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState<LocalClima[] | null>(null);
  const [buscando, setBuscando] = useState(false);

  const buscar = async () => {
    if (termo.trim().length < 2) {
      toast.error('Escreva ao menos duas letras do nome da cidade.');
      return;
    }
    setBuscando(true);
    try {
      const achados = await buscarLocais(termo);
      setResultados(achados);
      if (achados.length === 0) toast.error('Nenhuma cidade encontrada com esse nome.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não consegui buscar a cidade.');
    } finally {
      setBuscando(false);
    }
  };

  const escolher = (local: LocalClima) => {
    setInfo({
      climaLocal: local.detalhe ? `${local.nome} — ${local.detalhe}` : local.nome,
      climaLat: local.latitude,
      climaLon: local.longitude,
    });
    setResultados(null);
    setTermo('');
    toast.success(`✓ Clima da obra em ${local.nome}`);
  };

  const limpar = () => {
    setInfo({ climaLocal: undefined, climaLat: undefined, climaLon: undefined });
    toast.success('Local do clima removido — o card sai do relatório.');
  };

  const definido = info?.climaLat != null && info?.climaLon != null;

  return (
    <SecaoRecolhivel
      id="clima"
      titulo="Clima da Obra"
      descricao="Informe o município da obra. A previsão dos próximos dias aparece num card do relatório, marcando os dias com risco de parar serviço a céu aberto."
      padrao={false}
    >
      {definido && (
        <div className="flex items-center justify-between gap-3 mb-4 rounded-lg border border-border bg-muted/20 px-3 py-2">
          <span className="text-sm text-foreground flex items-center gap-1.5 min-w-0">
            <MapPin className="h-4 w-4 text-success shrink-0" />
            <span className="truncate">{info?.climaLocal}</span>
          </span>
          <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs shrink-0" onClick={limpar}>
            <X className="h-3.5 w-3.5" /> Remover
          </Button>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <Input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); buscar(); } }}
          placeholder="Cidade da obra — ex.: Betim, Camaçari, Pecém"
          className="h-9 flex-1 min-w-[220px]"
        />
        <Button size="sm" className="gap-1.5 h-9" onClick={buscar} disabled={buscando}>
          <Search className="h-4 w-4" /> {buscando ? 'Buscando…' : 'Buscar'}
        </Button>
      </div>

      {resultados && resultados.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-xs text-muted-foreground">Escolha a cidade certa:</p>
          {resultados.map((l, i) => (
            <button
              key={`${l.nome}-${i}`}
              onClick={() => escolher(l)}
              className="w-full flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 hover:border-primary/40 transition-colors px-3 py-2 text-left"
            >
              <span className="min-w-0">
                <span className="text-sm font-medium text-foreground">{l.nome}</span>
                {l.detalhe && <span className="text-xs text-muted-foreground"> — {l.detalhe}</span>}
              </span>
              <Check className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}
    </SecaoRecolhivel>
  );
};

export default ClimaConfig;
