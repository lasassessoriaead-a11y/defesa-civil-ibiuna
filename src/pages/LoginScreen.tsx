import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShieldAlert,
  Lock,
  Mail,
  User,
  ArrowRight,
  CloudRain,
  AlertTriangle,
  Flame,
  ShieldCheck,
  CheckCircle2,
  Radio,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/services/defesa-civil'

export const LoginScreen: React.FC = () => {
  const { login, register } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [isRegisterMode, setIsRegisterMode] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)

  // Form states
  const [name, setName] = useState('')
  const [email, setEmail] = useState('luka2510@hotmail.com')
  const [password, setPassword] = useState('Skip@Pass')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setIsLoading(true)

    try {
      if (isRegisterMode) {
        if (!name.trim()) {
          throw new Error('Por favor, informe seu nome completo.')
        }
        if (password !== confirmPassword) {
          throw new Error('As senhas não coincidem.')
        }
        if (password.length < 8) {
          throw new Error('A senha deve ter no mínimo 8 caracteres.')
        }
        await register(name, email, password, confirmPassword)
        toast({
          title: 'Cadastro realizado com sucesso!',
          description: 'Bem-vindo ao Sistema de Defesa Civil.',
        })
      } else {
        await login(email, password)
        toast({
          title: 'Autenticado com sucesso',
          description: 'Acessando Painel de Monitoramento...',
        })
      }
      navigate('/painel')
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Falha na autenticação. Verifique suas credenciais.')
      setErrorMessage(msg)
      toast({
        variant: 'destructive',
        title: 'Erro de Autenticação',
        description: msg,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#f1f5f9]">
      {/* Left Hero Panel (Gradient navy + motifs) */}
      <div className="lg:w-1/2 bg-gradient-to-br from-[#0b1329] via-[#0f2557] to-[#1e3a8a] text-white p-8 sm:p-12 lg:p-16 flex flex-col justify-between relative overflow-hidden">
        {/* Background Decorative Ambient Shapes */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Top Branding Header */}
        <div className="relative z-10 flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-xl ring-4 ring-blue-400/20">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-white leading-none">
              DEFESA CIVIL MUNICIPAL
            </h1>
            <span className="text-xs font-semibold text-cyan-300 tracking-wide uppercase">
              Centro de Gestão de Riscos Climáticos
            </span>
          </div>
        </div>

        {/* Center Content / Value Proposition */}
        <div className="relative z-10 my-10 lg:my-0 space-y-6 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs font-medium backdrop-blur-md">
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            Operação Especial El Niño 2026
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight tracking-tight">
            Prontidão e resposta rápida para eventos climáticos extremos.
          </h2>

          <p className="text-sm sm:text-base text-blue-100/90 leading-relaxed font-normal">
            Plataforma unificada para monitoramento em tempo real de enchentes, deslizamentos de
            encostas, estiagens severas, coordenação tática de abrigos, equipes de resgate e alertas
            à população.
          </p>

          {/* Quick bullet highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs text-blue-100">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Mapas com polígonos de risco</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Controle de lotação de abrigos</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Redação de alertas com IA</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Assistente operacional 24/7</span>
            </div>
          </div>
        </div>

        {/* Bottom Footer Info */}
        <div className="relative z-10 pt-6 border-t border-blue-400/20 flex flex-wrap items-center justify-between gap-4 text-xs text-blue-200/80">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>Sistema Seguro de Operações Governamentais</span>
          </div>
          <span className="font-mono text-[11px] text-cyan-300">Emergência 199</span>
        </div>
      </div>

      {/* Right Login / Register Form Panel */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 sm:p-12 lg:p-16">
        <div className="w-full max-w-md bg-white p-8 sm:p-10 rounded-2xl shadow-xl border border-slate-200/80">
          <div className="mb-6 text-left">
            <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
              {isRegisterMode ? 'Criar nova conta de operador' : 'Acesso ao Sistema Operacional'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {isRegisterMode
                ? 'Preencha seus dados para solicitar credenciais da Defesa Civil.'
                : 'Insira suas credenciais municipais para entrar no cockpit.'}
            </p>
          </div>

          {errorMessage && (
            <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegisterMode && (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-semibold text-slate-700">
                  Nome Completo
                </Label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="name"
                    type="text"
                    required
                    placeholder="Ex: Carlos Eduardo Mendes"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-9 text-sm h-10 rounded-lg"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
                E-mail Institucional
              </Label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="operador@defesacivil.gov.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 text-sm h-10 rounded-lg"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold text-slate-700">
                Senha de Acesso
              </Label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 text-sm h-10 rounded-lg"
                />
              </div>
            </div>

            {isRegisterMode && (
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-xs font-semibold text-slate-700">
                  Confirmar Senha
                </Label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-9 text-sm h-10 rounded-lg"
                  />
                </div>
              </div>
            )}

            {!isRegisterMode && (
              <div className="flex items-center justify-between text-xs pt-1">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(c) => setRememberMe(!!c)}
                  />
                  <Label htmlFor="remember" className="text-slate-600 font-normal cursor-pointer">
                    Lembrar credenciais
                  </Label>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    toast({
                      title: 'Recuperação de Senha',
                      description: 'Contate o administrador de TI da Defesa Civil pelo ramal 1990.',
                    })
                  }}
                  className="text-blue-600 hover:text-blue-800 font-medium hover:underline"
                >
                  Esqueceu a senha?
                </button>
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-gradient-to-r from-blue-700 to-indigo-800 hover:from-blue-800 hover:to-indigo-900 text-white font-semibold rounded-lg shadow-md shadow-blue-700/20 mt-2 transition-all"
            >
              {isLoading ? (
                <span>Processando...</span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  {isRegisterMode ? 'Concluir Cadastro' : 'Entrar no Cockpit'}
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>

          {/* Seed hint helper box */}
          {!isRegisterMode && (
            <div className="mt-5 p-3 rounded-lg bg-blue-50/70 border border-blue-200/70 text-[11px] text-blue-900 leading-relaxed">
              <span className="font-bold">Usuário padrão configurado:</span>
              <div className="font-mono text-[10px] mt-0.5 text-blue-800">
                luka2510@hotmail.com / Skip@Pass
              </div>
            </div>
          )}

          {/* Toggle between Login and Register */}
          <div className="mt-6 pt-5 border-t border-slate-200 text-center text-xs text-slate-600">
            {isRegisterMode ? (
              <span>
                Já possui credencial de operador?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegisterMode(false)
                    setErrorMessage(null)
                  }}
                  className="font-bold text-blue-600 hover:underline"
                >
                  Fazer Login
                </button>
              </span>
            ) : (
              <span>
                Não tem acesso?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegisterMode(true)
                    setErrorMessage(null)
                  }}
                  className="font-bold text-blue-600 hover:underline"
                >
                  Cadastre-se como Operador
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
