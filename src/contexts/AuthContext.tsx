import React, { createContext, useContext, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import type { User, UserRole, Municipality } from '@/types/defesa-civil'

interface AuthContextType {
  user: User | null
  municipality: Municipality | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, pass: string) => Promise<void>
  register: (name: string, email: string, pass: string, passConfirm: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [municipality, setMunicipality] = useState<Municipality | null>(null)
  const [token, setToken] = useState<string | null>(pb.authStore.token)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const fetchMunicipality = async (munId?: string) => {
    if (!munId) {
      setMunicipality(null)
      return
    }
    try {
      const mun = await pb.collection('municipalities').getOne<Municipality>(munId)
      setMunicipality(mun)
    } catch {
      // Ignora erro se não encontrar
    }
  }

  const syncUserState = async () => {
    if (pb.authStore.isValid && pb.authStore.record) {
      const rec = pb.authStore.record
      const u: User = {
        id: rec.id,
        email: rec.email,
        name: rec.name || 'Operador',
        avatar: rec.avatar,
        role: (rec.role as UserRole) || 'agente',
        municipality: rec.municipality || undefined,
      }
      setUser(u)
      setToken(pb.authStore.token)
      if (u.municipality) {
        await fetchMunicipality(u.municipality)
      }
    } else {
      setUser(null)
      setMunicipality(null)
      setToken(null)
    }
  }

  useEffect(() => {
    syncUserState().finally(() => setIsLoading(false))

    const unsub = pb.authStore.onChange((newToken, model) => {
      setToken(newToken)
      if (model && pb.authStore.isValid) {
        const u: User = {
          id: model.id,
          email: model.email,
          name: model.name || 'Operador',
          avatar: model.avatar,
          role: (model.role as UserRole) || 'agente',
          municipality: model.municipality || undefined,
        }
        setUser(u)
        if (u.municipality) {
          fetchMunicipality(u.municipality)
        }
      } else {
        setUser(null)
        setMunicipality(null)
      }
    })

    return () => {
      unsub()
    }
  }, [])

  const login = async (email: string, pass: string) => {
    const authData = await pb.collection('users').authWithPassword(email, pass)
    const u: User = {
      id: authData.record.id,
      email: authData.record.email,
      name: authData.record.name || 'Operador',
      avatar: authData.record.avatar,
      role: (authData.record.role as UserRole) || 'agente',
      municipality: authData.record.municipality || undefined,
    }
    setUser(u)
    setToken(authData.token)
    if (u.municipality) {
      await fetchMunicipality(u.municipality)
    }
  }

  const register = async (name: string, email: string, pass: string, passConfirm: string) => {
    // Buscar id do município inicial caso o usuário não tenha selecionado
    let defaultMunId = ''
    try {
      const m = await pb.collection('municipalities').getFirstListItem('')
      defaultMunId = m.id
    } catch {
      /* intentionally ignored */
    }

    await pb.collection('users').create({
      name,
      email,
      password: pass,
      passwordConfirm: passConfirm,
      role: 'agente',
      municipality: defaultMunId,
    })
    await login(email, pass)
  }

  const logout = () => {
    pb.authStore.clear()
    setUser(null)
    setMunicipality(null)
    setToken(null)
  }

  const refreshUser = async () => {
    if (pb.authStore.isValid && pb.authStore.record) {
      const rec = await pb.collection('users').getOne(pb.authStore.record.id)
      const u: User = {
        id: rec.id,
        email: rec.email,
        name: rec.name || 'Operador',
        avatar: rec.avatar,
        role: (rec.role as UserRole) || 'agente',
        municipality: rec.municipality || undefined,
      }
      setUser(u)
      if (u.municipality) {
        await fetchMunicipality(u.municipality)
      }
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        municipality,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
