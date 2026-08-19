import React, { createContext, useContext, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import type { User } from '@/types/defesa-civil'

interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, pass: string) => Promise<void>
  register: (name: string, email: string, pass: string, passConfirm: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(pb.authStore.token)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  useEffect(() => {
    // Check initial auth
    if (pb.authStore.isValid && pb.authStore.record) {
      setUser({
        id: pb.authStore.record.id,
        email: pb.authStore.record.email,
        name: pb.authStore.record.name || 'Operador',
        avatar: pb.authStore.record.avatar,
      })
      setToken(pb.authStore.token)
    } else {
      setUser(null)
      setToken(null)
    }
    setIsLoading(false)

    // Listen to store changes
    const unsub = pb.authStore.onChange((newToken, model) => {
      setToken(newToken)
      if (model && pb.authStore.isValid) {
        setUser({
          id: model.id,
          email: model.email,
          name: model.name || 'Operador',
          avatar: model.avatar,
        })
      } else {
        setUser(null)
      }
    })

    return () => {
      unsub()
    }
  }, [])

  const login = async (email: string, pass: string) => {
    const authData = await pb.collection('users').authWithPassword(email, pass)
    setUser({
      id: authData.record.id,
      email: authData.record.email,
      name: authData.record.name || 'Operador',
      avatar: authData.record.avatar,
    })
    setToken(authData.token)
  }

  const register = async (name: string, email: string, pass: string, passConfirm: string) => {
    await pb.collection('users').create({
      name,
      email,
      password: pass,
      passwordConfirm: passConfirm,
    })
    await login(email, pass)
  }

  const logout = () => {
    pb.authStore.clear()
    setUser(null)
    setToken(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        register,
        logout,
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
