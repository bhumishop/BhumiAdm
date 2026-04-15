import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { edgeApi } from '../api/edgeApi'

type UserRole = 'admin' | 'moderator' | 'support'

interface UserRoleRecord {
  id: string
  user_id: string
  role: UserRole
  created_by: string | null
  notes: string
  created_at: string
  updated_at: string
  profiles?: {
    id: string
    name: string
    email: string
    created_at: string
  }
}

export const useUserRolesStore = defineStore('userRoles', () => {
  const users = ref<UserRoleRecord[]>([])
  const roles = ref<Record<string, unknown>[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const availableRoles: UserRole[] = ['admin', 'moderator', 'support']

  const roleLabels: Record<UserRole, string> = {
    admin: 'Administrador',
    moderator: 'Moderador',
    support: 'Suporte'
  }

  const adminStats = computed(() => {
    return {
      totalUsers: users.value.length,
      admins: users.value.filter(u => u.role === 'admin').length,
      moderators: users.value.filter(u => u.role === 'moderator').length,
      support: users.value.filter(u => u.role === 'support').length
    }
  })

  async function fetchUsers() {
    loading.value = true
    error.value = null

    try {
      const result = await edgeApi.userRoles.list()
      users.value = (result.data as unknown as UserRoleRecord[]) || []
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao carregar usuários'
      console.error('fetchUsers error:', err)
      users.value = []
    } finally {
      loading.value = false
    }
  }

  async function addUserRole(userRole: {
    user_id: string
    role: UserRole
    created_by?: string | null
    notes?: string
  }) {
    error.value = null

    try {
      const result = await edgeApi.userRoles.create(userRole)
      await fetchUsers()
      return result.data
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao adicionar papel de usuário'
      console.error('addUserRole error:', err)
      throw err
    }
  }

  async function updateUserRole(id: string, updates: Partial<UserRoleRecord>) {
    error.value = null

    try {
      const result = await edgeApi.userRoles.update(id, updates)
      await fetchUsers()
      return result.data
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao atualizar papel de usuário'
      console.error('updateUserRole error:', err)
      throw err
    }
  }

  async function deleteUserRole(id: string) {
    error.value = null

    try {
      await edgeApi.userRoles.delete(id)
      users.value = users.value.filter(u => u.id !== id)
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao excluir papel de usuário'
      console.error('deleteUserRole error:', err)
      throw err
    }
  }

  async function checkUserRole(userId: string): Promise<{ role: string; isAdmin: boolean }> {
    error.value = null

    try {
      const result = await edgeApi.userRoles.checkRole(userId)
      const data = result.data as { role: UserRole } | undefined
      return {
        role: data?.role || 'user',
        isAdmin: ['admin', 'moderator'].includes(data?.role || '')
      }
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erro ao verificar papel de usuário'
      console.error('checkUserRole error:', err)
      return { role: 'user', isAdmin: false }
    }
  }

  function getRoleLabel(role: UserRole | string): string {
    return roleLabels[role as UserRole] || role
  }

  function getRoleColor(role: UserRole | string): string {
    const colors: Record<string, string> = {
      admin: 'error',
      moderator: 'warning',
      support: 'info'
    }
    return colors[role] || 'neutral'
  }

  return {
    users,
    roles,
    loading,
    error,
    availableRoles,
    adminStats,
    fetchUsers,
    addUserRole,
    updateUserRole,
    deleteUserRole,
    checkUserRole,
    getRoleLabel,
    getRoleColor
  }
})
