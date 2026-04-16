<template>
  <div class="home">
    <!-- Navigation -->
    <nav class="home-nav">
      <div class="nav-inner">
        <router-link to="/" class="nav-logo">
          <span class="logo-mark"></span>
          <span class="logo-word">BHUMI</span>
        </router-link>
        <router-link to="/login" class="nav-cta">Admin</router-link>
      </div>
    </nav>

    <!-- Hero -->
    <section class="hero">
      <div class="hero-bg">
        <div class="hero-gradient-orb orb-1"></div>
        <div class="hero-gradient-orb orb-2"></div>
        <div class="hero-grain"></div>
      </div>
      
      <div class="hero-content">
        <p class="hero-eyebrow">Dharma &middot; Arte &middot; Tecnologia</p>
        <h1 class="hero-title">
          Bhumisparsha<br><em>School</em>
        </h1>
        <p class="hero-description">
          Arte, conhecimento e criatividade conectados &agrave; tecnologia moderna.
        </p>
        <div class="hero-actions">
          <a href="https://www.mercadolivre.com.br" target="_blank" class="hero-btn hero-btn-primary">
            Visitar Loja
          </a>
          <router-link to="/login" class="hero-btn hero-btn-ghost">
            Admin Login
          </router-link>
        </div>
      </div>

      <div class="hero-scroll">
        <span>Scroll</span>
        <div class="scroll-line"></div>
      </div>
    </section>

    <!-- Partners -->
    <section class="partners">
      <div class="partners-inner">
        <p class="partners-label">Lojas Parceiras</p>
        <div class="partners-grid">
          <a href="https://www.mercadolivre.com.br" target="_blank" class="partner-card">
            <span class="partner-name">Mercado Livre</span>
            <span class="partner-desc">Diversos produtos</span>
            <span class="partner-arrow">&nearr;</span>
          </a>
          <a href="https://umapenca.com/bhumisprint/" target="_blank" class="partner-card">
            <span class="partner-name">UmaPenca</span>
            <span class="partner-desc">Camisetas &amp; Canecas</span>
            <span class="partner-arrow">&nearr;</span>
          </a>
          <a href="https://uiclap.com" target="_blank" class="partner-card">
            <span class="partner-name">UICLAP</span>
            <span class="partner-desc">Livros</span>
            <span class="partner-arrow">&nearr;</span>
          </a>
        </div>
      </div>
    </section>

    <!-- About -->
    <section class="about">
      <div class="about-inner">
        <div class="about-content">
          <p class="about-eyebrow">Sobre</p>
          <h2 class="about-title">Dharma em forma de arte</h2>
          <p class="about-text">
            Somos uma escola de Dharma com foco em arte, tecnologia e conhecimento. 
            Nossos projetos incluem Cyber Manju, Techno Sutra, Prata Ativa e muito mais.
          </p>
          <router-link to="/sobre" class="about-link">
            Saiba mais <span class="link-arrow">&rarr;</span>
          </router-link>
        </div>
        <div class="about-visual">
          <div class="visual-frame">
            <div class="visual-symbol">☯</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="home-footer">
      <div class="footer-inner">
        <div class="footer-top">
          <span class="footer-logo">BHUMI</span>
          <p class="footer-tagline">Arte, Conhecimento e Criatividade</p>
        </div>
        <p class="footer-copy">&copy; 2026 Bhumisparsha School</p>
      </div>
    </footer>
  </div>
</template>

<script setup>
</script>

<style scoped>
.home {
  background: var(--bg-base);
  min-height: 100vh;
}

/* ===== NAVIGATION ===== */
.home-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  padding: 0 var(--space-6);
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: var(--border);
}

.nav-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
}

.nav-logo {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  text-decoration: none;
  color: var(--text-primary);
}

.logo-mark {
  width: 24px;
  height: 24px;
  border: 1.5px solid var(--gold);
  border-radius: 50%;
  display: block;
  position: relative;
}

.logo-mark::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 6px;
  height: 6px;
  background: var(--gold);
  border-radius: 50%;
}

.logo-word {
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.15em;
}

.nav-cta {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
  text-decoration: none;
  padding: var(--space-2) var(--space-4);
  border: var(--border);
  border-radius: var(--radius);
  transition: all var(--transition-base);
}

.nav-cta:hover {
  color: var(--gold);
  border-color: var(--gold-border);
  background: var(--gold-bg);
}

/* ===== HERO ===== */
.hero {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  position: relative;
  overflow: hidden;
  padding: var(--space-20) var(--space-6);
  text-align: center;
}

.hero-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.hero-gradient-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(100px);
  opacity: 0.15;
}

.orb-1 {
  width: 500px;
  height: 500px;
  top: 10%;
  left: 20%;
  background: radial-gradient(circle, var(--gold) 0%, transparent 70%);
  animation: breathe 8s ease-in-out infinite;
}

.orb-2 {
  width: 400px;
  height: 400px;
  bottom: 10%;
  right: 15%;
  background: radial-gradient(circle, var(--rose) 0%, transparent 70%);
  animation: breathe 10s ease-in-out infinite 2s;
}

.hero-grain {
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
  opacity: 0.4;
}

.hero-content {
  position: relative;
  z-index: 1;
  max-width: 700px;
  animation: fadeInUp 0.8s ease-out;
}

.hero-eyebrow {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--gold);
  margin-bottom: var(--space-8);
}

.hero-title {
  font-family: var(--font-display);
  font-size: clamp(48px, 8vw, 96px);
  font-weight: 400;
  line-height: 1.05;
  letter-spacing: -0.03em;
  color: var(--text-primary);
  margin-bottom: var(--space-8);
  font-variation-settings: "SOFT" 60, "WONK" 0;
}

.hero-title em {
  font-style: italic;
  color: var(--gold-light);
  font-variation-settings: "SOFT" 60, "WONK" 1;
}

.hero-description {
  font-size: clamp(16px, 2vw, 18px);
  font-weight: 300;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: var(--space-10);
  max-width: 480px;
  margin-left: auto;
  margin-right: auto;
}

.hero-actions {
  display: flex;
  gap: var(--space-4);
  justify-content: center;
  flex-wrap: wrap;
}

.hero-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-3) var(--space-8);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  text-decoration: none;
  border-radius: var(--radius);
  transition: all var(--transition-base);
}

.hero-btn-primary {
  background: var(--gold);
  color: var(--bg-base);
  border: 1px solid var(--gold);
}

.hero-btn-primary:hover {
  background: var(--gold-light);
  transform: translateY(-2px);
}

.hero-btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.hero-btn-ghost:hover {
  color: var(--text-primary);
  border-color: rgba(255, 255, 255, 0.15);
}

.hero-scroll {
  position: absolute;
  bottom: var(--space-8);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  color: var(--text-muted);
  font-size: 10px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.scroll-line {
  width: 1px;
  height: 32px;
  background: linear-gradient(to bottom, var(--gold-subtle), transparent);
  animation: pulse-soft 2s ease-in-out infinite;
}

/* ===== PARTNERS ===== */
.partners {
  padding: var(--space-16) var(--space-6);
  border-top: var(--border);
}

.partners-inner {
  max-width: 1000px;
  margin: 0 auto;
}

.partners-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--text-muted);
  text-align: center;
  margin-bottom: var(--space-8);
}

.partners-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--space-4);
}

.partner-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-6);
  background: var(--bg-surface);
  border: var(--border);
  border-radius: var(--radius-md);
  text-decoration: none;
  transition: all var(--transition-base);
  position: relative;
}

.partner-card:hover {
  border-color: var(--gold-border);
  background: var(--bg-elevated);
  transform: translateY(-2px);
}

.partner-name {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 500;
  color: var(--text-primary);
  font-variation-settings: "SOFT" 50, "WONK" 0;
}

.partner-desc {
  font-size: 13px;
  color: var(--text-tertiary);
  font-weight: 300;
}

.partner-arrow {
  position: absolute;
  top: var(--space-5);
  right: var(--space-5);
  font-size: 18px;
  color: var(--text-muted);
  transition: all var(--transition-base);
}

.partner-card:hover .partner-arrow {
  color: var(--gold);
  transform: translate(2px, -2px);
}

/* ===== ABOUT ===== */
.about {
  padding: var(--space-20) var(--space-6);
  border-top: var(--border);
}

.about-inner {
  max-width: 1000px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-16);
  align-items: center;
}

.about-eyebrow {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--gold);
  margin-bottom: var(--space-4);
}

.about-title {
  font-family: var(--font-display);
  font-size: clamp(28px, 4vw, 40px);
  font-weight: 500;
  line-height: 1.15;
  color: var(--text-primary);
  margin-bottom: var(--space-6);
  letter-spacing: -0.02em;
  font-variation-settings: "SOFT" 50, "WONK" 0;
}

.about-text {
  font-size: 15px;
  font-weight: 300;
  color: var(--text-secondary);
  line-height: 1.7;
  margin-bottom: var(--space-6);
}

.about-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 13px;
  font-weight: 600;
  color: var(--gold);
  text-decoration: none;
  letter-spacing: 0.04em;
  transition: all var(--transition-base);
}

.about-link:hover {
  gap: var(--space-3);
}

.link-arrow {
  transition: transform var(--transition-base);
}

.about-link:hover .link-arrow {
  transform: translateX(2px);
}

.about-visual {
  display: flex;
  justify-content: center;
  align-items: center;
}

.visual-frame {
  width: 200px;
  height: 200px;
  border: 1px solid var(--gold-border);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  animation: breathe 6s ease-in-out infinite;
}

.visual-frame::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: 50%;
  border: 1px solid rgba(201, 169, 110, 0.06);
}

.visual-symbol {
  font-size: 64px;
  color: var(--gold);
  opacity: 0.6;
}

/* ===== FOOTER ===== */
.home-footer {
  padding: var(--space-12) var(--space-6);
  border-top: var(--border);
}

.footer-inner {
  max-width: 1000px;
  margin: 0 auto;
  text-align: center;
}

.footer-logo {
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: var(--text-muted);
}

.footer-tagline {
  font-size: 13px;
  font-weight: 300;
  color: var(--text-tertiary);
  margin-top: var(--space-2);
  margin-bottom: var(--space-8);
}

.footer-copy {
  font-size: 11px;
  color: var(--text-muted);
  letter-spacing: 0.05em;
}

/* ===== RESPONSIVE ===== */
@media (max-width: 768px) {
  .about-inner {
    grid-template-columns: 1fr;
    gap: var(--space-10);
  }

  .about-visual {
    order: -1;
  }

  .visual-frame {
    width: 140px;
    height: 140px;
  }

  .visual-symbol {
    font-size: 48px;
  }

  .partners-grid {
    grid-template-columns: 1fr;
  }

  .hero-title {
    font-size: clamp(36px, 10vw, 56px);
  }

  .hero-actions {
    flex-direction: column;
    align-items: center;
  }

  .hero-btn {
    width: 100%;
    max-width: 280px;
  }
}

@media (max-width: 480px) {
  .home-nav {
    padding: 0 var(--space-4);
  }

  .hero {
    padding: var(--space-16) var(--space-4);
  }

  .partners, .about {
    padding: var(--space-12) var(--space-4);
  }
}
</style>
