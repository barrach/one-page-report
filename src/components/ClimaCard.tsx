import { useEffect, useState } from 'react';
import {
  Sun, CloudSun, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudSnow,
  CloudLightning, MapPin, AlertTriangle,
} from 'lucide-react';
import { useCurrentProject } from '@/store/projectStore';
import { cn } from '@/lib/utils';
import {
  buscarPrevisao, descreverTempo, gravarCache, lerCache, riscoDeChuva, ROTULO_RISCO,
  type DiaPrevisao, type RiscoChuva,
} from '@/lib/clima';

const ICONES: Record<string, typeof Sun> = {
  sol: Sun,
  'sol-nuvem': CloudSun,
  nuvem: Cloud,
  nevoeiro: CloudFog,
  garoa: CloudDrizzle,
  chuva: CloudRain,
  neve: CloudSnow,
  tempestade: CloudLightning,
};

const CORES_RISCO: Record<RiscoChuva, string> = {
  baixo: 'text-muted-foreground',
  medio: 'text-amber-600 dark:text-amber-500',
  alto: 'text-destructive',
};

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const rotuloDoDia = (iso: string, indice: number): string => {
  if (indice === 0) return 'Hoje';
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return `${DIAS_SEMANA[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * Previsão dos próximos dias para o município da obra.
 *
 * O card só existe quando a cidade foi escolhida na aba Dados — sem lugar
 * definido não há o que mostrar, e um card vazio no relatório só ocupa papel.
 */
const ClimaCard = () => {
  const { info } = useCurrentProject();
  const lat = info?.climaLat;
  const lon = info?.climaLon;

  const [dias, setDias] = useState<DiaPrevisao[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [desatualizado, setDesatualizado] = useState(false);

  useEffect(() => {
    if (lat == null || lon == null) return;
    let ativo = true;

    // Mostra o que estiver em cache antes de ir na rede: numa obra com sinal
    // ruim, previsão de três horas atrás vale mais que um card em branco.
    const cache = lerCache(lat, lon);
    if (cache) { setDias(cache.dias); setDesatualizado(cache.velho); }

    buscarPrevisao(lat, lon)
      .then((novos) => {
        if (!ativo || novos.length === 0) return;
        gravarCache(lat, lon, novos);
        setDias(novos);
        setDesatualizado(false);
        setErro(null);
      })
      .catch((e) => {
        if (!ativo) return;
        // Com cache na tela o erro não vira alarme — só a marca de desatualizado.
        if (cache) setDesatualizado(true);
        else setErro(e instanceof Error ? e.message : 'Não consegui buscar a previsão');
      });

    return () => { ativo = false; };
  }, [lat, lon]);

  if (lat == null || lon == null) return null;

  const comRisco = dias.map((d) => ({ dia: d, risco: riscoDeChuva(d) }));
  const primeiroCritico = comRisco.find((d) => d.risco === 'alto');

  return (
    <div className="bg-card rounded-xl p-4 sm:p-6 card-shadow border">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Clima na Obra</h3>
        <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
          <MapPin className="h-3.5 w-3.5" />
          {info?.climaLocal || 'Local definido'}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Próximos dias · o que pode parar serviço a céu aberto
        {desatualizado && ' · previsão em cache, sem conexão'}
      </p>

      {erro && (
        <p className="text-xs text-destructive">{erro}</p>
      )}

      {!erro && dias.length === 0 && (
        <p className="text-xs text-muted-foreground">Buscando previsão…</p>
      )}

      {dias.length > 0 && (
        <>
          {primeiroCritico && (
            <div className="flex items-start gap-2 mb-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-foreground">
                <strong>{rotuloDoDia(primeiroCritico.dia.data, dias.indexOf(primeiroCritico.dia))}</strong>{' '}
                com {primeiroCritico.dia.chuvaMm} mm e {primeiroCritico.dia.chuvaProb}% de chance de chuva —
                risco de parada em serviços a céu aberto.
              </p>
            </div>
          )}

          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {comRisco.map(({ dia, risco }, i) => {
              const { texto, icone } = descreverTempo(dia.codigo);
              const Icone = ICONES[icone] ?? Cloud;
              return (
                <div
                  key={dia.data}
                  className={cn(
                    'rounded-lg border p-2 text-center',
                    risco === 'alto' ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-muted/20',
                  )}
                >
                  <div className="text-[11px] font-semibold text-foreground">{rotuloDoDia(dia.data, i)}</div>
                  <Icone className={cn('h-6 w-6 mx-auto my-1.5', CORES_RISCO[risco])} />
                  <div className="text-[10px] text-muted-foreground leading-tight" title={texto}>{texto}</div>
                  <div className="text-[11px] font-semibold text-foreground mt-1 tabular-nums">
                    {dia.tempMax}° <span className="font-normal text-muted-foreground">{dia.tempMin}°</span>
                  </div>
                  <div className={cn('text-[10px] tabular-nums mt-0.5', CORES_RISCO[risco])}>
                    {dia.chuvaProb}% · {dia.chuvaMm} mm
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[10px] text-muted-foreground mt-3">
            {ROTULO_RISCO.alto} = 10 mm ou mais, ou 70% de chance com 3 mm. Fonte: Open-Meteo.
          </p>
        </>
      )}
    </div>
  );
};

export default ClimaCard;
