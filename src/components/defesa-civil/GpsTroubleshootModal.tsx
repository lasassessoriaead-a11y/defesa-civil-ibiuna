import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Compass,
  Smartphone,
  Lock,
  ExternalLink,
  MapPin,
  HelpCircle,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react'
import type { GeolocationErrorKind } from '@/services/geocoding'

interface GpsTroubleshootModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRetry?: () => void
  onUseMapAlternative?: () => void
  errorKind?: GeolocationErrorKind
  isIframe?: boolean
}

export const GpsTroubleshootModal: React.FC<GpsTroubleshootModalProps> = ({
  open,
  onOpenChange,
  onRetry,
  onUseMapAlternative,
  errorKind = 'PERMISSION_DENIED',
  isIframe = false,
}) => {
  const isPreviewOrIframe = isIframe

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[95vw] p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1.5 text-left">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                Como Ativar a Localização / GPS
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Guia rápido de desbloqueio para agentes em campo (Android e iPhone)
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Alerta de contexto se for Preview / Iframe */}
        {isPreviewOrIframe && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-blue-800">
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              <span>Ambiente Preview Skip detectado</span>
            </div>
            <p className="text-[11px] leading-relaxed text-blue-700">
              O preview de desenvolvimento roda dentro de um quadro de segurança que pode barrar o
              GPS do celular. No ambiente de produção direta (fora do preview), o GPS opera com
              acesso completo do navegador.
            </p>
          </div>
        )}

        {/* Detalhe do erro detectado */}
        <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-lg text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-amber-900">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>
              {errorKind === 'PERMISSION_DENIED'
                ? 'Permissão de GPS bloqueada no navegador'
                : errorKind === 'TIMEOUT'
                  ? 'Tempo limite esgotado buscando satélites'
                  : errorKind === 'POSITION_UNAVAILABLE'
                    ? 'Localização desativada no aparelho'
                    : 'Ajuste de GPS necessário'}
            </span>
          </div>
          <p className="text-[11px] text-amber-800 leading-relaxed">
            {errorKind === 'PERMISSION_DENIED'
              ? 'O navegador precisa da sua autorização para ler o chip de GPS do smartphone.'
              : errorKind === 'TIMEOUT'
                ? 'O GPS demorou a fixar satélites. Em áreas fechadas ou cobertas, vá para um local aberto ou aponte o ponto no mapa interativo.'
                : 'Verifique se a "Localização" está ligada na barra de notificações do seu celular.'}
          </p>
        </div>

        {/* Abas com tutoriais passo a passo por sistema */}
        <Tabs defaultValue="chrome" className="w-full pt-1">
          <TabsList className="grid grid-cols-3 h-8 p-0.5 bg-slate-100 text-xs">
            <TabsTrigger value="chrome" className="text-[11px] px-1 py-1">
              Chrome (Android)
            </TabsTrigger>
            <TabsTrigger value="android-system" className="text-[11px] px-1 py-1">
              Ajustes Android
            </TabsTrigger>
            <TabsTrigger value="iphone" className="text-[11px] px-1 py-1">
              Safari / iPhone
            </TabsTrigger>
          </TabsList>

          {/* ABA 1: Chrome Android */}
          <TabsContent value="chrome" className="space-y-2.5 pt-2 text-xs">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-slate-800 font-semibold text-xs">
                <Lock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>Desbloqueio rápido na barra de endereço:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-700 pl-1">
                <li>
                  Toque no ícone de <strong>ajustes / cadeado / ⓘ</strong> no canto esquerdo da
                  barra onde fica a URL do site.
                </li>
                <li>
                  Toque em <strong>"Permissões"</strong> ou <strong>"Configurações do site"</strong>
                  .
                </li>
                <li>
                  Localize o item <strong>"Localização"</strong> e altere para{' '}
                  <strong className="text-emerald-700">"Permitir"</strong>.
                </li>
                <li>
                  Recarregue a página ou toque em <strong>"Tentar GPS Novamente"</strong> abaixo.
                </li>
              </ol>
            </div>
          </TabsContent>

          {/* ABA 2: Ajustes do Sistema Android */}
          <TabsContent value="android-system" className="space-y-2.5 pt-2 text-xs">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-slate-800 font-semibold text-xs">
                <Smartphone className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>Permissão do Sistema Operacional Android:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-700 pl-1">
                <li>
                  Deslize a barra de notificações do topo da tela e confirme se o ícone{' '}
                  <strong>"Localização"</strong> está <strong>ativo (azul)</strong>.
                </li>
                <li>
                  Abra as <strong>Configurações</strong> do celular → <strong>Aplicativos</strong>.
                </li>
                <li>
                  Procure pelo <strong>Chrome</strong> (ou pelo navegador que estiver usando).
                </li>
                <li>
                  Toque em <strong>Permissões</strong> → <strong>Localização</strong> → Escolha{' '}
                  <strong className="text-emerald-700">"Permitir durante o uso do app"</strong> e
                  marque <strong>"Usar localização precisa"</strong>.
                </li>
              </ol>
            </div>
          </TabsContent>

          {/* ABA 3: Safari / iPhone iOS */}
          <TabsContent value="iphone" className="space-y-2.5 pt-2 text-xs">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-slate-800 font-semibold text-xs">
                <HelpCircle className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>No iPhone / Safari ou Chrome iOS:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-700 pl-1">
                <li>
                  Abra os <strong>Ajustes do iPhone</strong> →{' '}
                  <strong>Privacidade e Segurança</strong> →{' '}
                  <strong>Serviços de Localização</strong> (deve estar Ativado).
                </li>
                <li>
                  Role até <strong>Safari</strong> ou <strong>Chrome</strong>.
                </li>
                <li>
                  Selecione <strong>"Durante o Uso do App"</strong> e ative a chave{' '}
                  <strong className="text-emerald-700">"Localização Precisa"</strong>.
                </li>
              </ol>
            </div>
          </TabsContent>
        </Tabs>

        {/* Dica de campo: Não travar a ocorrência */}
        <div className="p-2.5 bg-slate-100 rounded text-[11px] text-slate-600 flex items-start gap-2">
          <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
          <span>
            <strong>Dica para agilidade em campo:</strong> Se estiver em local sem sinal de
            satélite, você pode clicar direto no mapa interativo ou buscar pelo CEP da via sem
            interromper o registro da ocorrência.
          </span>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
          {onUseMapAlternative && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenChange(false)
                onUseMapAlternative()
              }}
              className="text-xs w-full sm:w-auto"
            >
              <MapPin className="w-3.5 h-3.5 mr-1 text-blue-600" />
              Marcar no Mapa em vez disso
            </Button>
          )}

          {onRetry && (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onOpenChange(false)
                onRetry()
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs w-full sm:w-auto"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Tentar GPS Novamente
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
