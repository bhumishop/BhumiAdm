<template>
  <div class="config-page container">
    <h1 class="page-title">Configurações</h1>

    <div class="config-sections">
      <section class="config-section">
        <h2>Informações da Loja</h2>
        <form @submit.prevent="saveConfig">
          <div class="form-group">
            <label>Nome da Loja</label>
            <input v-model="config.storeName" type="text" placeholder="BHUMI SHOP">
          </div>

          <div class="form-group">
            <label>Descrição</label>
            <textarea v-model="config.storeDescription" rows="3" placeholder="Arte, Conhecimento e Criatividade"></textarea>
          </div>

          <div class="form-group">
            <label>Email de Contato</label>
            <input v-model="config.contactEmail" type="email" placeholder="contato@bhumi.com.br">
          </div>

          <div class="form-group">
            <label>Telefone/WhatsApp</label>
            <input v-model="config.whatsapp" type="text" placeholder="+55 (11) 99999-9999">
          </div>

          <div class="form-group">
            <label>Instagram</label>
            <input v-model="config.instagram" type="text" placeholder="@bhumi">
          </div>
        </form>
      </section>

      <section class="config-section">
        <h2>Links Externos</h2>
        <form @submit.prevent="saveConfig">
          <div class="form-group">
            <label>Link Mercado Livre</label>
            <input v-model="config.mercadoLivre" type="url" placeholder="https://www.mercadolivre.com.br/...">
          </div>

          <div class="form-group">
            <label>Link UmaPenca</label>
            <input v-model="config.umapenca" type="url" placeholder="https://umapenca.com/...">
          </div>

          <div class="form-group">
            <label>Link UICLAP</label>
            <input v-model="config.uiclap" type="url" placeholder="https://uiclap.com/...">
          </div>
        </form>
      </section>

      <section class="config-section">
        <h2>Configurações de Envio</h2>
        <form @submit.prevent="saveConfig">
          <div class="form-group">
            <label>Frete Grátis a partir de (R$)</label>
            <input v-model.number="config.freeShippingAbove" type="number" step="0.01" placeholder="199.00">
          </div>

          <div class="form-group">
            <label>Valor do Frete Padrão (R$)</label>
            <input v-model.number="config.defaultShipping" type="number" step="0.01" placeholder="15.00">
          </div>

          <div class="form-group">
            <label>Prazo de Produção (dias)</label>
            <input v-model.number="config.productionDays" type="number" placeholder="5">
          </div>
        </form>
      </section>

      <section class="config-section">
        <h2>Políticas da Loja</h2>
        <form @submit.prevent="saveConfig">
          <div class="form-group">
            <label>Política de Troca</label>
            <textarea v-model="config.returnPolicy" rows="3" placeholder="Descrição da política de troca..."></textarea>
          </div>

          <div class="form-group">
            <label>Informações de Envio</label>
            <textarea v-model="config.shippingInfo" rows="3" placeholder="Informações sobre envio..."></textarea>
          </div>
        </form>
      </section>

      <section class="config-section">
        <h2>Banner Principal</h2>
        <form @submit.prevent="saveConfig">
          <div class="form-group">
            <label>Título do Banner</label>
            <input v-model="config.bannerTitle" type="text" placeholder="BHUMI SHOP">
          </div>

          <div class="form-group">
            <label>Subtítulo</label>
            <input v-model="config.bannerSubtitle" type="text" placeholder="Arte, Conhecimento e Criatividade">
          </div>

          <div class="form-group">
            <label>Imagem do Banner (URL)</label>
            <input v-model="config.bannerImage" type="url" placeholder="https://...">
          </div>
        </form>
      </section>

      <div class="config-actions">
        <button @click="resetConfig" class="btn-secondary">Restaurar Padrões</button>
        <button @click="saveConfig" class="btn-primary">Salvar Configurações</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const CONFIG_STORAGE_KEY = 'bhumi-shop-config'

const defaultConfig = {
  storeName: 'BHUMI SHOP',
  storeDescription: 'Arte, Conhecimento e Criatividade',
  contactEmail: '',
  whatsapp: '',
  instagram: '@bhumi',
  mercadoLivre: '',
  umapenca: '',
  uiclap: '',
  freeShippingAbove: 199,
  defaultShipping: 15,
  productionDays: 5,
  returnPolicy: '',
  shippingInfo: '',
  bannerTitle: 'BHUMI SHOP',
  bannerSubtitle: 'Arte, Conhecimento e Criatividade',
  bannerImage: ''
}

const config = ref({ ...defaultConfig })

onMounted(() => {
  loadConfig()
})

function loadConfig() {
  try {
    const saved = localStorage.getItem(CONFIG_STORAGE_KEY)
    if (saved) {
      config.value = { ...defaultConfig, ...JSON.parse(saved) }
    }
  } catch (e) {
    console.error('Erro ao carregar configurações:', e)
  }
}

function saveConfig() {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config.value))
    alert('Configurações salvas com sucesso!')
  } catch (e) {
    console.error('Erro ao salvar configurações:', e)
    alert('Erro ao salvar configurações')
  }
}

function resetConfig() {
  if (confirm('Tem certeza que deseja restaurar as configurações padrões?')) {
    config.value = { ...defaultConfig }
    localStorage.removeItem(CONFIG_STORAGE_KEY)
  }
}
</script>

<style scoped>
.config-page {
  padding: 3rem 1rem;
  max-width: 800px;
}

.page-title {
  font-size: 2.5rem;
  text-align: center;
  margin-bottom: 3rem;
}

.config-sections {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.config-section {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 2rem;
}

.config-section h2 {
  font-size: 1.25rem;
  margin-bottom: 1.5rem;
  color: var(--gold-light);
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.form-group input,
.form-group textarea {
  width: 100%;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 0.75rem;
  border-radius: 4px;
  font-size: 1rem;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--gold);
}

.config-actions {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 1rem;
}

.btn-primary,
.btn-secondary {
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-primary {
  background: var(--gold);
  color: var(--bg-base);
  border: none;
}

.btn-primary:hover {
  background: var(--gold-light);
}

.btn-secondary {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover {
  border-color: var(--gold);
  color: var(--text-primary);
}

@media (max-width: 600px) {
  .config-actions {
    flex-direction: column;
  }
}
</style>
