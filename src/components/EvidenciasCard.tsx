import { useEffect, useRef, useState } from 'react';
import { Camera, Trash2, X, Loader2, ImageOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useCurrentProject, useProjectStore } from '@/store/projectStore';
import { useAuth } from '@/context/AuthContext';
import { useTvMode } from '@/hooks/use-tv-mode';
import { oprDataClient } from '@/integrations/supabase/oprDataClient';
import { cn } from '@/lib/utils';
import {
  BUCKET_EVIDENCIAS, caminhoDaEvidencia, formatarTamanho, reduzirImagem,
  type Evidencia,
} from '@/lib/evidencias';

/**
 * Evidências fotográficas da obra.
 *
 * As fotos ficam num bucket PRIVADO do Supabase e são exibidas por URL
 * assinada de validade curta — foto de dentro da planta do cliente não pode
 * ficar acessível a quem tiver o link.
 *
 * O projeto guarda só o caminho e a legenda: a imagem dentro do JSON estouraria
 * o espelho do projeto no localStorage já na primeira foto.
 */

const VALIDADE_URL_S = 60 * 60; // 1 hora — cobre a reunião e a geração do PDF

/**
 * Teto de fotos por obra.
 *
 * O relatório é de UMA página: passando disso as evidências viram um álbum e
 * empurram o resto do relatório para longe no PDF.
 */
const MAX_FOTOS = 10;

/**
 * O Storage responde "Bucket not found" quando a migration ainda não rodou.
 * Repassar essa frase crua deixa quem está na obra sem saber o que fazer.
 */
const explicarErro = (mensagem: string): string => {
  if (/bucket not found/i.test(mensagem)) {
    return 'O espaço de armazenamento ainda não foi criado no Supabase — peça para rodar a migration "evidencias_storage".';
  }
  if (/row-level security|not authorized|permission/i.test(mensagem)) {
    return 'Sem permissão para enviar fotos. Só administrador, gestor e planejador podem.';
  }
  if (/exceeded the maximum allowed size|payload too large/i.test(mensagem)) {
    return 'Foto grande demais mesmo depois de reduzida. Tente uma imagem menor.';
  }
  return mensagem;
};

const fmtQuando = (iso: string): string => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};

const EvidenciasCard = () => {
  const { id: projetoId, evidencias } = useCurrentProject();
  const addEvidencia = useProjectStore((s) => s.addEvidencia);
  const removeEvidencia = useProjectStore((s) => s.removeEvidencia);
  const setLegenda = useProjectStore((s) => s.setLegendaEvidencia);
  const { user, canEdit } = useAuth();
  const { tvMode } = useTvMode();

  const entradaRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [ampliada, setAmpliada] = useState<Evidencia | null>(null);

  const fotos = evidencias ?? [];

  // As URLs assinadas expiram, então são pedidas a cada abertura do relatório —
  // guardá-las no projeto deixaria links mortos no banco.
  useEffect(() => {
    if (fotos.length === 0) { setUrls({}); return; }
    let ativo = true;
    (async () => {
      const { data, error } = await oprDataClient.storage
        .from(BUCKET_EVIDENCIAS)
        .createSignedUrls(fotos.map((f) => f.caminho), VALIDADE_URL_S);
      if (!ativo || error || !data) return;
      const mapa: Record<string, string> = {};
      data.forEach((item) => {
        if (item.signedUrl && item.path) mapa[item.path] = item.signedUrl;
      });
      setUrls(mapa);
    })();
    return () => { ativo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fotos.map((f) => f.caminho).join('|')]);

  const enviar = async (arquivos: FileList | null) => {
    if (!arquivos || arquivos.length === 0) return;

    const espaco = MAX_FOTOS - fotos.length;
    if (espaco <= 0) {
      toast.error(`Limite de ${MAX_FOTOS} fotos por obra. Apague alguma para abrir espaço.`);
      if (entradaRef.current) entradaRef.current.value = '';
      return;
    }

    // Corta o excedente em vez de recusar tudo: quem selecionou 15 fotos de uma
    // vez prefere ver as 10 primeiras entrarem a ter de escolher de novo.
    const escolhidos = Array.from(arquivos);
    const aEnviar = escolhidos.slice(0, espaco);
    if (escolhidos.length > espaco) {
      toast.error(`Cabem mais ${espaco} foto(s) — as outras ${escolhidos.length - espaco} ficaram de fora.`);
    }

    setEnviando(true);
    let enviadas = 0;

    for (const arquivo of aEnviar) {
      if (!arquivo.type.startsWith('image/')) {
        toast.error(`${arquivo.name} não é uma imagem.`);
        continue;
      }
      try {
        const reduzida = await reduzirImagem(arquivo);
        const carimbo = Date.now();
        const caminho = caminhoDaEvidencia(projetoId, arquivo.name, carimbo);

        const { error } = await oprDataClient.storage
          .from(BUCKET_EVIDENCIAS)
          .upload(caminho, reduzida, { contentType: 'image/jpeg', upsert: false });

        if (error) {
          // A causa do Storage é específica o bastante para valer na tela — o
          // que não valia era a frase crua em inglês, que não diz o que fazer.
          toast.error(explicarErro(error.message));
          continue;
        }

        addEvidencia({
          id: `${carimbo}-${Math.random().toString(36).slice(2, 8)}`,
          caminho,
          legenda: '',
          data: new Date().toISOString(),
          autor: user?.email ?? undefined,
        });
        enviadas++;
      } catch (e) {
        toast.error(`${arquivo.name}: ${e instanceof Error ? e.message : 'falhou'}`);
      }
    }

    setEnviando(false);
    if (entradaRef.current) entradaRef.current.value = '';
    if (enviadas > 0) toast.success(`✓ ${enviadas} foto(s) enviada(s)`);
  };

  const apagar = async (foto: Evidencia) => {
    // Tira do projeto mesmo que o arquivo resista: registro apontando para
    // arquivo inexistente é pior que arquivo órfão no bucket.
    const { error } = await oprDataClient.storage.from(BUCKET_EVIDENCIAS).remove([foto.caminho]);
    removeEvidencia(foto.id);
    if (error) toast.error(`Registro removido, mas o arquivo ficou no servidor: ${error.message}`);
  };

  // Na TV o painel é olhado de longe; sem fotos e sem poder subir, o card não
  // tem o que mostrar e sai do relatório em vez de ocupar papel em branco.
  if (tvMode) return null;
  if (fotos.length === 0 && !canEdit) return null;

  return (
    <div className="bg-card rounded-xl p-4 sm:p-6 card-shadow border">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Evidências</h3>
          <p className="text-xs text-muted-foreground">
            Fotos da obra na semana{canEdit || fotos.length > 0 ? ` · ${fotos.length} de ${MAX_FOTOS}` : ''}
          </p>
        </div>
        {canEdit && (
          <div data-pdf-hide className="shrink-0">
            <input
              ref={entradaRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => enviar(e.target.files)}
            />
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => entradaRef.current?.click()}
              disabled={enviando || fotos.length >= MAX_FOTOS}
              title={fotos.length >= MAX_FOTOS ? `Limite de ${MAX_FOTOS} fotos por obra` : undefined}
            >
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              {enviando ? 'Enviando…' : fotos.length >= MAX_FOTOS ? 'Limite atingido' : 'Adicionar fotos'}
            </Button>
          </div>
        )}
      </div>

      {fotos.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">
          Nenhuma evidência registrada nesta obra.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {fotos.map((foto) => (
            <figure key={foto.id} className="rounded-lg border border-border overflow-hidden bg-muted/20">
              <button
                onClick={() => setAmpliada(foto)}
                className="block w-full aspect-[4/3] bg-muted/40"
                title="Ampliar"
              >
                {urls[foto.caminho] ? (
                  <img
                    src={urls[foto.caminho]}
                    alt={foto.legenda || 'Evidência da obra'}
                    className="w-full h-full object-cover"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <ImageOff className="h-5 w-5" />
                  </span>
                )}
              </button>
              <figcaption className="p-2">
                {canEdit ? (
                  <input
                    value={foto.legenda}
                    onChange={(e) => setLegenda(foto.id, e.target.value)}
                    placeholder="Legenda"
                    className="w-full bg-transparent outline-none text-[11px] text-foreground placeholder:text-muted-foreground/60 border-b border-transparent focus:border-primary transition-colors"
                  />
                ) : (
                  <p className="text-[11px] text-foreground">{foto.legenda || '—'}</p>
                )}
                <div className="flex items-center justify-between gap-2 mt-1">
                  <span className="text-[10px] text-muted-foreground truncate">
                    {fmtQuando(foto.data)}{foto.autor ? ` · ${foto.autor}` : ''}
                  </span>
                  {canEdit && (
                    <button
                      onClick={() => apagar(foto)}
                      data-pdf-hide
                      className="text-destructive/60 hover:text-destructive shrink-0"
                      title="Apagar foto"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {canEdit && (
        <p className="text-[10px] text-muted-foreground mt-3" data-pdf-hide>
          As fotos são reduzidas para 1600 px antes de subir — numa obra com sinal ruim,
          mandar a foto original do celular ({formatarTamanho(4_000_000)} em média) é minutos de espera
          sem ganho nenhum no papel.
        </p>
      )}

      {/* Ampliar */}
      {ampliada && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setAmpliada(null)}
          data-html2canvas-ignore
        >
          <div className="relative max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setAmpliada(null)}
              className="absolute -top-3 -right-3 h-8 w-8 rounded-full bg-card border border-border flex items-center justify-center text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
            {urls[ampliada.caminho] && (
              <img
                src={urls[ampliada.caminho]}
                alt={ampliada.legenda || 'Evidência da obra'}
                className={cn('w-full max-h-[80vh] object-contain rounded-lg bg-black')}
              />
            )}
            {ampliada.legenda && (
              <p className="text-sm text-white text-center mt-2">{ampliada.legenda}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EvidenciasCard;
