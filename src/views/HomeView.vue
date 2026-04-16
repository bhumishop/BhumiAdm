<template>
  <div class="home">
    <section class="hero">
      <div class="hero-content">
        <h1 class="hero-title">
          BHUMI <span class="accent">SHOP</span>
        </h1>
        <p class="hero-subtitle">Arte, Conhecimento e Criatividade</p>
        <div class="hero-cta">
          <router-link to="/login" class="btn-primary">
            Admin Login
          </router-link>
        </div>
      </div>
      <div class="hero-decoration">
        <div class="glitch-box"></div>
      </div>
    </section>

    <section class="categories-preview container">
      <h2 class="section-title">Administração</h2>
      <div class="categories-grid">
        <router-link 
          to="/login"
          class="category-card"
        >
          <span class="category-icon">🔐</span>
          <span class="category-name">Login Admin</span>
        </router-link>
      </div>
    </section>

    <section class="about-preview container">
      <div class="about-content">
        <h2 class="section-title">Sobre a Bhumisparsha School</h2>
        <p>
          Somos uma escola de Dharma com foco em arte, tecnologia e conhecimento. 
          Nossos projetos incluem Cyber Manju, Techno Sutra, Prata Ativa e muito mais.
        </p>
        <router-link to="/sobre" class="btn-secondary">
        Saiba Mais
        </router-link>
      </div>
    </section>

    <section class="projects-banner">
      <div class="projects-banner-content">
        <h2>Nossas Lojas Parceiras</h2>
        <p>Também vendemos nas plataformas:</p>
        <div class="external-stores">
          <a href="https://www.mercadolivre.com.br" target="_blank" class="store-btn">
            🛒 Mercado Livre<br><span>Diversos produtos</span>
          </a>
          <a href="https://umapenca.com/bhumisprint/" target="_blank" class="store-btn">
            🛍️ UmaPenca<br><span>Camisetas & Canecas</span>
          </a>
          <a href="https://uiclap.com" target="_blank" class="store-btn">
            📚 UICLAP<br><span>Livros</span>
          </a>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

// Static categories for the home page - no API required
const categories = ref([
  { id: 'camisetas', name: 'Camisetas', icon: '👕' },
  { id: 'acessorios', name: 'Acessórios', icon: '🎀' },
  { id: 'artes', name: 'Artes', icon: '🎨' },
  { id: 'livros', name: 'Livros', icon: '📚' },
  { id: 'canecas', name: 'Canecas', icon: '☕' },
])

function getCategoryInitial(categoryId) {
  if (!categoryId) return 'P'
  const cat = categories.value.find(c => c.id === categoryId)
  return cat ? cat.name.charAt(0).toUpperCase() : categoryId.toString().charAt(0).toUpperCase()
}

onMounted(() => {
  // No API calls needed - static content only
})
</script>
</script>

<style scoped>
.hero {
  min-height: 80vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  background: 
    linear-gradient(180deg, 
      rgba(10, 10, 10, 0.9) 0%, 
      rgba(26, 26, 46, 0.8) 50%, 
      rgba(10, 10, 10, 0.95) 100%
    );
}

.hero::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: 
    radial-gradient(ellipse at 20% 30%, rgba(123, 44, 191, 0.25) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 70%, rgba(0, 255, 65, 0.15) 0%, transparent 40%),
    radial-gradient(ellipse at 50% 50%, rgba(123, 44, 191, 0.1) 0%, transparent 60%);
  pointer-events: none;
}

.hero::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 200px;
  background: linear-gradient(to top, var(--bg-primary), transparent);
  pointer-events: none;
}

.hero-decoration {
  position: absolute;
  top: 50%;
  left: 20%;
  transform: translate(-50%, -50%);
  z-index: 1;
}

.glitch-box {
  width: 300px;
  height: 300px;
  border: 2px solid var(--accent-purple);
  opacity: 0.15;
  animation: pulse-glow 3s ease-in-out infinite;
  border-radius: 50%;
  filter: blur(1px);
}

.hero-content {
  text-align: center;
  z-index: 2;
  position: relative;
}

.hero-content::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, rgba(0, 255, 65, 0.1) 0%, transparent 70%);
  pointer-events: none;
  animation: pulse-glow 4s ease-in-out infinite;
}

.hero-title {
  font-size: 5rem;
  font-family: var(--font-display);
  margin-bottom: 1rem;
  letter-spacing: 0.2em;
  color: #00FF41;
  text-shadow: 0 0 10px rgba(0, 255, 65, 0.5), 0 0 20px rgba(0, 255, 65, 0.3);
}

.hero-title .accent {
  color: var(--accent-green);
  text-shadow: var(--shadow-glow);
}

.hero-subtitle {
  font-size: 1.5rem;
  color: #00FF41;
  margin-bottom: 2rem;
  font-family: var(--font-body);
  text-shadow: 0 0 5px rgba(0, 255, 65, 0.3);
}

.hero-cta {
  margin-top: 2rem;
}

.glitch-box {
  width: 400px;
  height: 400px;
  border: 2px solid var(--accent-purple);
  opacity: 0.1;
  animation: pulse-glow 3s ease-in-out infinite;
}

.categories-preview {
  padding: 4rem 1rem;
  position: relative;
}

.categories-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1.5rem;
  margin-top: 2rem;
}

.category-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 2rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.3s ease;
}

.category-card:hover {
  border-color: var(--accent-green);
  transform: translateY(-5px);
  box-shadow: var(--shadow-glow);
}

.category-icon {
  font-size: 2.5rem;
}

.category-name {
  color: #00FF41;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  text-shadow: 0 0 5px rgba(0, 255, 65, 0.3);
}

.section-title {
  font-size: 2rem;
  text-align: center;
  margin-bottom: 2rem;
  color: var(--accent-green);
}

.about-preview {
  padding: 4rem 1rem;
  text-align: center;
}

.about-content {
  max-width: 600px;
  margin: 0 auto;
}

.about-content p {
  color: #00FF41;
  margin-bottom: 2rem;
  font-size: 1.1rem;
  text-shadow: 0 0 5px rgba(0, 255, 65, 0.2);
}

.projects-banner {
  padding: 4rem 1rem;
  text-align: center;
}

.projects-banner-content h2 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  color: var(--accent-green);
  text-shadow: var(--shadow-glow);
}

.projects-banner-content p {
  font-size: 1.25rem;
  color: #00FF41;
  margin-bottom: 2rem;
  text-shadow: 0 0 5px rgba(0, 255, 65, 0.3);
}

.external-stores {
  display: flex;
  justify-content: center;
  gap: 2rem;
  flex-wrap: wrap;
}

.store-btn {
  background: var(--bg-card);
  border: 2px solid var(--accent-purple);
  padding: 1.5rem 2rem;
  border-radius: 12px;
  text-align: center;
  font-size: 1.1rem;
  font-weight: 600;
  transition: all 0.3s ease;
  display: inline-block;
}

.store-btn span {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-weight: 400;
}

.store-btn:hover {
  border-color: var(--accent-green);
  box-shadow: var(--shadow-glow);
  transform: translateY(-5px);
}

@keyframes pulse-glow {
  0%, 100% { opacity: 0.1; transform: scale(1); }
  50% { opacity: 0.2; transform: scale(1.05); }
}

@media (max-width: 768px) {
  .hero-title {
    font-size: 2.5rem;
  }
  
  .categories-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
