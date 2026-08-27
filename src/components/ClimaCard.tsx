import { useEffect, useState } from 'react';
import {
  Sun, CloudSun, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudSnow,
  CloudLightning, MapPin, AlertTriangle, Umbrella,
} from 'lucide-react';
import { useCurrentProject } from '@/store/projectStore';
import { cn } from '@/lib/utils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  buscarPrevisao, descreverTempo, gravarCache, lerCache, riscoDeChuva, riscoDaHora,
  horasDoDia, dentroDoTurno, resumoDoTurno, ROTULO_RISCO, TURNO_PADRAO, VALIDADE_MS,
  type DiaPrevisao, type HoraPrevisao, type Previsao, type RiscoChuva,
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

const dataPorExtenso = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
};

const hhmm = (ms: number) =>
  new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const mm = (n: number) => `${n.toFixed(1).replace('.', ',')} mm`;

/** Barra de chuva da hora. 6 mm num intervalo de uma hora já enche a barra. */
const LARGURA_CHEIA_MM = 6;

const PREVISAO_VAZIA: Previsao = { dias: [], horas: [] };

/**
 * Detalhe hora a hora de um dia.
 *
 * Existe porque o card diário não decide programação: "9,4 mm" pode ser
 * madrugada inteira (não muda nada) ou duas horas em cima da concretagem.
 * Por isso o resumo do topo é do TURNO, não do dia.
 */
const DetalheDoDia = ({ dia, indice, horas, aoFechar }: {
  dia: DiaPrevisao | null;
  indice: number;
  horas: HoraPrevisao[];
  aoFechar: () => void;
}) => {
  const doDia = dia ? horasDoDia(horas, dia.data) : [];
  const turno = resumoDoTurno(doDia);

  return (
    <Dialog open={dia != null} onOpenChange={(aberto) => { if (!aberto) aoFechar(); }}>
      <DialogContent className="sm:max-w-[540px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="capitalize">
            {dia ? `${rotuloDoDia(dia.data, indice)} · ${dataPorExtenso(dia.data)}` : ''}
          </DialogTitle>
        </DialogHeader>

        {doDia.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            O detalhe hora a hora ainda não foi baixado para este local. Ele chega na
            próxima atualização da previsão — o card busca de hora em hora.
          </p>
        ) : (
          <>
            {/* O que interessa: a chuva dentro do horário de trabalho. */}
            <div className={cn(
              'rounded-lg border px-3 py-2 text-sm',
              turno.primeiraCritica
                ? 'border-destructive/40 bg-destructive/5'
                : turno.horasComChuva > 0
                  ? 'border-amber-500/40 bg-amber-500/5'
                  : 'border-border bg-muted/20',
            )}>
              <div className="flex items-start gap-2">
                <Umbrella className={cn(
                  'h-4 w-4 shrink-0 mt-0.5',
                  turno.primeiraCritica ? 'text-destructive'
                    : turno.horasComChuva > 0 ? 'text-amber-600 dark:text-amber-500'
                      : 'text-muted-foreground',
                )} />
                <p className="text-foreground">
                  Das {TURNO_PADRAO.inicio}h às {TURNO_PADRAO.fim}h:{' '}
                  <strong>{mm(turno.chuvaMm)}</strong>, chance máxima de {turno.maiorProb}%.{' '}
                  {turno.horasComChuva === 0
                    ? 'Nenhuma hora com chuva que atrapalhe.'
                    : `${turno.horasComChuva} hora${turno.horasComChuva > 1 ? 's' : ''} com chuva`}
                  {turno.primeiraCritica && (
                    <> — a primeira crítica às <strong>{turno.primeiraCritica}</strong>.</>
                  )}
                  {!turno.primeiraCritica && turno.horasComChuva > 0 && '.'}
                </p>
              </div>
            </div>

            <div className="overflow-y-auto -mx-1 px-1">
              <table className="w-full border-collapse">
                <tbody>
                  {doDia.map((h) => {
                    const risco = riscoDaHora(h);
                    const noTurno = dentroDoTurno(h);
                    const { texto, icone } = descreverTempo(h.codigo);
                    const Icone = ICONES[icone] ?? Cloud;
                    const largura = Math.min(100, (h.chuvaMm / LARGURA_CHEIA_MM) * 100);

                    return (
                      <tr
                        key={h.hora}
                        className={cn(
                          'border-b border-border/60 last:border-0',
                          // Fora do turno fica apagado: é chuva que não custa hora-homem.
                          !noTurno && 'opacity-45',
                          risco === 'alto' && noTurno && 'bg-destructive/5',
                        )}
                      >
                        <td className="py-1.5 pr-2 text-xs font-semibold tabular-nums text-foreground w-12">
                          {h.hora.slice(11, 16)}
                        </td>
                        <td className="py-1.5 pr-2 w-6">
                          <Icone className={cn('h-4 w-4', CORES_RISCO[risco])} />
                        </td>
                        <td className="py-1.5 pr-2 text-xs text-muted-foreground truncate max-w-[9rem]" title={texto}>
                          {texto}
                        </td>
                        <td className="py-1.5 pr-2 text-xs tabular-nums text-foreground w-10 text-right">
                          {h.temp}°
                        </td>
                        <td className="py-1.5 pr-2 w-24">
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full',
                                risco === 'alto' ? 'bg-destructive'
                                  : risco === 'medio' ? 'bg-amber-500' : 'bg-muted-foreground/40',
                              )}
                              style={{ width: `${largura}%` }}
                            />
                          </div>
                        </td>
                        <td className={cn('py-1.5 text-[11px] tabular-nums text-right whitespace-nowrap w-24', CORES_RISCO[risco])}>
                          {h.chuvaProb}% · {mm(h.chuvaMm)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-[10px] text-muted-foreground shrink-0">
              As horas fora do turno de {TURNO_PADRAO.inicio}h–{TURNO_PADRAO.fim}h aparecem
              esmaecidas. Uma hora conta como crítica com 4 mm, ou 70% de chance com 1 mm.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
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

  const [previsao, setPrevisao] = useState<Previsao>(PREVISAO_VAZIA);
  const [erro, setErro] = useState<string | null>(null);
  const [desatualizado, setDesatualizado] = useState(false);
  const [buscadoEm, setBuscadoEm] = useState<number | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [diaAberto, setDiaAberto] = useState<number | null>(null);

  useEffect(() => {
    if (lat == null || lon == null) return;
    let ativo = true;

    // Mostra o que estiver em cache antes de ir na rede: numa obra com sinal
    // ruim, previsão de uma hora atrás vale mais que um card em branco.
    const cache = lerCache(lat, lon);
    if (cache) {
      setPrevisao(cache.previsao);
      setDesatualizado(cache.velho);
      setBuscadoEm(cache.gravadoEm);
    }

    buscarPrevisao(lat, lon)
      .then((nova) => {
        if (!ativo || nova.dias.length === 0) return;
        gravarCache(lat, lon, nova);
        setPrevisao(nova);
        setDesatualizado(false);
        setBuscadoEm(Date.now());
        setErro(null);
      })
      .catch((e) => {
        if (!ativo) return;
        // Com cache na tela o erro não vira alarme — só a marca de desatualizado.
        if (cache) setDesatualizado(true);
        else setErro(e instanceof Error ? e.message : 'Não consegui buscar a previsão');
      });

    return () => { ativo = false; };
  }, [lat, lon, recarga]);

  // Atualização de hora em hora: é o passo da própria previsão, e o relatório
  // costuma ficar aberto o dia inteiro na tela da sala de reunião.
  useEffect(() => {
    if (lat == null || lon == null) return;

    const relogio = setInterval(() => setRecarga((n) => n + 1), VALIDADE_MS);

    // O navegador estrangula timers de aba em segundo plano, então o intervalo
    // sozinho não basta: ao voltar para a aba, busca de novo se o dado venceu.
    const aoVoltar = () => {
      if (document.visibilityState !== 'visible') return;
      const c = lerCache(lat, lon);
      if (!c || c.velho) setRecarga((n) => n + 1);
    };
    document.addEventListener('visibilitychange', aoVoltar);

    return () => {
      clearInterval(relogio);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [lat, lon]);

  if (lat == null || lon == null) return null;

  const dias = previsao.dias;
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
        Próximos dias · clique no dia para ver hora a hora
        {buscadoEm && !desatualizado && ` · atualizado às ${hhmm(buscadoEm)}`}
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
                // Botão, e não div: além de ser o elemento certo para algo
                // clicável, é o que impede o clique de recolher o card inteiro.
                <button
                  type="button"
                  key={dia.data}
                  onClick={() => setDiaAberto(i)}
                  title={`Ver ${rotuloDoDia(dia.data, i)} hora a hora`}
                  className={cn(
                    'rounded-lg border p-2 text-center transition-colors hover:border-primary/50 hover:bg-muted/50',
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
                </button>
              );
            })}
          </div>

          <p className="text-[10px] text-muted-foreground mt-3">
            {ROTULO_RISCO.alto} = 10 mm ou mais, ou 70% de chance com 3 mm. Atualiza sozinho
            a cada hora. Fonte: Open-Meteo.
          </p>
        </>
      )}

      <DetalheDoDia
        dia={diaAberto != null ? dias[diaAberto] ?? null : null}
        indice={diaAberto ?? 0}
        horas={previsao.horas}
        aoFechar={() => setDiaAberto(null)}
      />
    </div>
  );
};

export default ClimaCard;
