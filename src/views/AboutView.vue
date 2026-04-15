<template>
  <div class="about-page container">
    <h1 class="page-title">Sobre Nós</h1>

    <section class="about-section">
      <h2 class="section-subtitle">Bhumisparsha School</h2>
      <p class="about-text">
        A Bhumisparsha School é uma escola de Dharma que combina arte, tecnologia e conhecimento. 
        Acreditamos que a educação deve ser acessível, criativa e transformadora.
      </p>
    </section>

    <section class="projects-section">
      <h2 class="section-subtitle">Nossos Projetos</h2>
      
      <div class="projects-grid">
        <div class="project-card card">
          <h3>🧘 Cyber Manju</h3>
          <p>Série audiovisual que combina ensinamentos budistas com estética cyberpunk. 
             Uma jornada filosófica em formato digital.</p>
        </div>

        <div class="project-card card">
          <h3>📱 Techno Sutra</h3>
          <p>Projeto de Realidade Aumentada que traz os sutras budistas para a era digital. 
             Interativo, acessível e moderno.</p>
        </div>

        <div class="project-card card">
          <h3>💿 BhumiStudio Records</h3>
          <p>Gravadora independente com produções de música budista e mindfulness. 
             Álbuns, singles e experiências sonoras únicas.</p>
        </div>

        <div class="project-card card">
          <h3>📖 Prata Ativa</h3>
          <p>Livro que explora conceitos de sabedoria e prática budista de forma acessível 
             e contemporânea.</p>
        </div>

        <div class="project-card card">
          <h3>🌱 7k Project</h3>
          <p>Projeto ambiental focado em reflorestamento e sustentabilidade. 
             Plantamos árvores e educamos sobre meio ambiente.</p>
        </div>

        <div class="project-card card">
          <h3>🌍 Guardiões da Terra</h3>
          <p>Iniciativa que mobiliza jovens para ações de preservação ambiental 
             e consciência ecológica.</p>
        </div>
      </div>
    </section>

    <section class="contact-section">
      <h2 class="section-subtitle">Contato</h2>
      <div class="contact-info">
        <p><strong>Email:</strong> contato@bhumisparshaschool.org</p>
        <p><strong>Site:</strong> www.bhumisparshaschool.org</p>
        <div class="social-links">
          <a href="https://www.instagram.com/bhumisparshaschool/" target="_blank">Instagram</a>
          <a href="https://www.youtube.com/@bhumistudio.bhumisparshaschool" target="_blank">YouTube</a>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
</script>

<style scoped>
.about-page {
  padding: 3rem 1rem;
  min-height: 60vh;
}

.page-title {
  font-size: 2.5rem;
  text-align: center;
  margin-bottom: 3rem;
}

.about-section {
  max-width: 800px;
  margin: 0 auto 4rem;
  text-align: center;
}

.section-subtitle {
  font-size: 1.5rem;
  color: var(--accent-green);
  margin-bottom: 1.5rem;
}

.about-text {
  color: var(--text-secondary);
  font-size: 1.1rem;
  line-height: 1.8;
}

.projects-section {
  margin-bottom: 4rem;
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-top: 2rem;
}

.project-card {
  padding: 2rem;
}

.project-card h3 {
  font-size: 1.25rem;
  margin-bottom: 1rem;
  color: var(--text-primary);
}

.project-card p {
  color: var(--text-secondary);
  line-height: 1.6;
}

.contact-section {
  max-width: 600px;
  margin: 0 auto;
  text-align: center;
}

.contact-info {
  color: var(--text-secondary);
}

.contact-info p {
  margin-bottom: 0.75rem;
}

.social-links {
  display: flex;
  justify-content: center;
  gap: 1.5rem;
  margin-top: 1.5rem;
}

.social-links a {
  color: var(--accent-purple-light);
  font-weight: 600;
}

.social-links a:hover {
  color: var(--accent-green);
}
</style>
