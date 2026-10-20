import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { Layout } from '@/components/defesa-civil/Layout'
import { LoginScreen } from '@/pages/LoginScreen'
import { Dashboard } from '@/pages/Dashboard'
import { OccurrencesPage } from '@/pages/OccurrencesPage'
import { SheltersPage } from '@/pages/SheltersPage'
import { TeamsPage } from '@/pages/TeamsPage'
import { SuppliesPage } from '@/pages/SuppliesPage'
import { AlertsPage } from '@/pages/AlertsPage'
import { WhatsAppPage } from '@/pages/WhatsAppPage'
import { AffectedAreasPage } from '@/pages/AffectedAreasPage'
import { AssistantPage } from '@/pages/AssistantPage'
import { RequestersPage } from '@/pages/RequestersPage'
import { AuditLogPage } from '@/pages/AuditLogPage'
import { UsersManagementPage } from '@/pages/UsersManagementPage'
import { AgentProfilesPage } from '@/pages/AgentProfilesPage'
import { OfficialDocumentsPage } from '@/pages/OfficialDocumentsPage'
import { TreeAuthorizationsPage } from '@/pages/TreeAuthorizationsPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { RiskImportPage } from '@/pages/RiskImportPage'
import { StrategicInfrastructuresPage } from '@/pages/StrategicInfrastructuresPage'
import { BridgeConferencePage } from '@/pages/BridgeConferencePage'
import { RiskSectorsPage } from '@/pages/RiskSectorsPage'
import { InteragencyDemandsPage } from '@/pages/InteragencyDemandsPage'
import { SecretariasWorkspacePage } from '@/pages/SecretariasWorkspacePage'
import { UrbanDevelopmentPage } from '@/pages/UrbanDevelopmentPage'
import { FamiliesSurveyPage } from '@/pages/FamiliesSurveyPage'
import { ContingencyPlansPage } from '@/pages/ContingencyPlansPage'
import NotFound from '@/pages/NotFound'
import { Toaster } from '@/components/ui/toaster'

// Protected Route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a] text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold tracking-wide text-blue-200 uppercase">
            Autenticando na Defesa Civil...
          </p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

// Unauthenticated Route wrapper (redirects to /painel if already logged in)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return null
  }

  if (isAuthenticated) {
    return <Navigate to="/painel" replace />
  }

  return <>{children}</>
}

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Login Route */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginScreen />
              </PublicRoute>
            }
          />

          {/* Root redirect to Painel */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Navigate to="/painel" replace />
              </ProtectedRoute>
            }
          />

          {/* Protected Routes inside Global Layout */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/painel" element={<Dashboard />} />
            <Route path="/ocorrencias" element={<OccurrencesPage />} />
            <Route path="/setores-risco" element={<RiskSectorsPage />} />
            <Route path="/infraestruturas" element={<StrategicInfrastructuresPage />} />
            <Route path="/pontes-conferencia" element={<BridgeConferencePage />} />
            <Route path="/secretarias-atuacao" element={<SecretariasWorkspacePage />} />
            <Route path="/desenvolvimento-urbano" element={<UrbanDevelopmentPage />} />
            <Route path="/levantamento-familias" element={<FamiliesSurveyPage />} />
            <Route path="/planos-contingencia" element={<ContingencyPlansPage />} />
            <Route path="/demandas-secretarias" element={<InteragencyDemandsPage />} />
            <Route path="/importacao-dados" element={<RiskImportPage />} />
            <Route path="/importacao-risco" element={<RiskImportPage />} />
            <Route path="/abrigos" element={<SheltersPage />} />
            <Route path="/equipes" element={<TeamsPage />} />
            <Route path="/suprimentos" element={<SuppliesPage />} />
            <Route path="/alertas" element={<AlertsPage />} />
            <Route path="/whatsapp" element={<WhatsAppPage />} />
            <Route path="/areas-afetadas" element={<AffectedAreasPage />} />
            <Route path="/assistente" element={<AssistantPage />} />
            <Route path="/oficios" element={<OfficialDocumentsPage />} />
            <Route path="/autorizacoes" element={<TreeAuthorizationsPage />} />
            <Route path="/relatorios" element={<ReportsPage />} />
            <Route path="/requerentes" element={<RequestersPage />} />
            <Route path="/auditoria" element={<AuditLogPage />} />
            <Route path="/usuarios" element={<UsersManagementPage />} />
            <Route path="/agentes-epi" element={<AgentProfilesPage />} />
          </Route>

          {/* 404 Fallback */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Toaster />
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
