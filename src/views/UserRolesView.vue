<template>
  <div class="user-roles-view container">
    <div class="page-header">
      <h1>👥 Gestão de Usuários</h1>
      <div class="header-actions">
        <button @click="showAddModal = true" class="btn-primary">
          + Novo Usuário
        </button>
        <button @click="refreshUsers" class="btn-secondary">
          🔄 Atualizar
        </button>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total de Usuários</div>
        <div class="stat-value">{{ adminStats.totalUsers }}</div>
      </div>
      <div class="stat-card admin">
        <div class="stat-label">Administradores</div>
        <div class="stat-value">{{ adminStats.admins }}</div>
      </div>
      <div class="stat-card moderator">
        <div class="stat-label">Moderadores</div>
        <div class="stat-value">{{ adminStats.moderators }}</div>
      </div>
      <div class="stat-card support">
        <div class="stat-label">Suporte</div>
        <div class="stat-value">{{ adminStats.support }}</div>
      </div>
    </div>

    <div class="users-table">
      <table>
        <thead>
          <tr>
            <th>Usuário</th>
            <th>Email</th>
            <th>Papel</th>
            <th>Criado em</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id">
            <td>
              <div class="user-info">
                <div class="user-avatar">{{ getInitials(user.profiles?.name || user.user_id) }}</div>
                <div class="user-name">{{ user.profiles?.name || 'Usuário' }}</div>
              </div>
            </td>
            <td>{{ user.profiles?.email || '-' }}</td>
            <td>
              <span :class="['role-badge', getRoleColor(user.role)]">
                {{ getRoleLabel(user.role) }}
              </span>
            </td>
            <td>{{ formatDate(user.created_at) }}</td>
            <td>
              <div class="action-buttons">
                <button @click="editUser(user)" class="btn-icon">✏️</button>
                <button @click="deleteUserConfirm(user.id)" class="btn-icon">🗑️</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="users.length === 0" class="no-users">
      <p>Nenhum usuário encontrado.</p>
    </div>

    <div v-if="showAddModal" class="modal-overlay" @click.self="closeModal">
      <div class="user-modal">
        <h2>{{ editingUser ? 'Editar Usuário' : 'Novo Usuário' }}</h2>
        
        <form @submit.prevent="saveUser">
          <div class="form-group" v-if="!editingUser">
            <label>ID do Usuário (UUID)</label>
            <input v-model="userForm.user_id" required placeholder="UUID do usuário">
          </div>

          <div class="form-group">
            <label>Papel</label>
            <select v-model="userForm.role" required>
              <option v-for="role in availableRoles" :key="role" :value="role">
                {{ getRoleLabel(role) }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label>Observações</label>
            <textarea v-model="userForm.notes" rows="3"></textarea>
          </div>

          <div class="modal-actions">
            <button type="button" @click="closeModal" class="btn-secondary">
              Cancelar
            </button>
            <button type="submit" class="btn-primary">
              {{ editingUser ? 'Salvar' : 'Adicionar' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="loading" class="loading-overlay">
      <div class="spinner"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUserRolesStore } from '../stores/userRoles'

const userRolesStore = useUserRolesStore()

const showAddModal = ref(false)
const editingUser = ref(null)

const users = computed(() => userRolesStore.users)
const loading = computed(() => userRolesStore.loading)
const adminStats = computed(() => userRolesStore.adminStats)
const availableRoles = computed(() => userRolesStore.availableRoles)

const userForm = ref({
  user_id: '',
  role: '',
  notes: ''
})

function formatDate(dateString) {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('pt-BR')
}

function getInitials(name) {
  if (!name) return 'U'
  return name
    .split(' ')
    .map(word => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function getRoleLabel(role) {
  return userRolesStore.getRoleLabel(role)
}

function getRoleColor(role) {
  return userRolesStore.getRoleColor(role)
}

async function refreshUsers() {
  await userRolesStore.fetchUsers()
}

function editUser(user) {
  editingUser.value = user
  userForm.value = {
    user_id: user.user_id,
    role: user.role,
    notes: user.notes || ''
  }
  showAddModal.value = true
}

function deleteUserConfirm(id) {
  if (confirm('Tem certeza que deseja excluir este papel de usuário?')) {
    userRolesStore.deleteUserRole(id)
  }
}

function closeModal() {
  showAddModal.value = false
  editingUser.value = null
  userForm.value = {
    user_id: '',
    role: '',
    notes: ''
  }
}

async function saveUser() {
  try {
    if (editingUser.value) {
      await userRolesStore.updateUserRole(editingUser.value.id, userForm.value)
    } else {
      await userRolesStore.addUserRole(userForm.value)
    }
    closeModal()
    await refreshUsers()
  } catch (err) {
    alert('Erro ao salvar usuário: ' + err.message)
  }
}

onMounted(async () => {
  await refreshUsers()
})
</script>

<style scoped>
.user-roles-view {
  padding: 2rem 1rem;
  min-height: 80vh;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.page-header h1 {
  font-size: 2rem;
  color: var(--text-primary);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 1.5rem;
  text-align: center;
}

.stat-card.admin {
  border-color: #dc3545;
  background: rgba(220, 53, 69, 0.1);
}

.stat-card.moderator {
  border-color: #ffc107;
  background: rgba(255, 193, 7, 0.1);
}

.stat-card.support {
  border-color: #17a2b8;
  background: rgba(23, 162, 184, 0.1);
}

.stat-label {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
}

.users-table {
  overflow-x: auto;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead {
  background: var(--bg-secondary);
}

th {
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.85rem;
  letter-spacing: 1px;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
}

td {
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.user-avatar {
  width: 40px;
  height: 40px;
  background: var(--accent-purple);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: #00FF41;
  font-size: 0.85rem;
}

.user-name {
  font-weight: 600;
}

.role-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 600;
}

.role-badge.error {
  background: rgba(220, 53, 69, 0.2);
  color: #dc3545;
}

.role-badge.warning {
  background: rgba(255, 193, 7, 0.2);
  color: #ffc107;
}

.role-badge.info {
  background: rgba(23, 162, 184, 0.2);
  color: #17a2b8;
}

.role-badge.neutral {
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
}

.no-users {
  text-align: center;
  padding: 3rem;
  color: var(--text-secondary);
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.user-modal {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 2rem;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.user-modal h2 {
  margin-bottom: 1.5rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 0.75rem;
  border-radius: 4px;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
}

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 3px solid var(--border-color);
  border-top-color: var(--accent-purple);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
