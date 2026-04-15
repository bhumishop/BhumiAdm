<template>
  <div class="videos-page container">
    <h1 class="page-title">Vídeos</h1>
    <p class="page-subtitle">Assista nossos conteúdos no YouTube</p>

    <div class="videos-grid">
      <div v-for="video in videos" :key="video.id" class="video-card card">
        <div class="video-wrapper">
          <iframe 
            :src="`https://www.youtube.com/embed/${video.youtubeId}`"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          ></iframe>
        </div>
        <div class="video-info">
          <h3>{{ video.title }}</h3>
          <p>{{ video.description }}</p>
        </div>
      </div>
    </div>

    <div v-if="videos.length === 0" class="no-videos">
      <p>Nenhum vídeo disponível ainda.</p>
    </div>

    <section class="youtube-channel">
      <h2>Nosso Canal</h2>
      <p>Inscreva-se no canal da Bhumisparsha School</p>
      <a href="https://www.youtube.com/@bhumistudio.bhumisparshaschool/playlists" target="_blank" class="btn-primary">
        📺 Ver no YouTube
      </a>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const videos = ref([
  {
    id: 1,
    youtubeId: 'LY9WmfL1J0U',
    title: 'CYBER MANJU | Ep 01 [2026]',
    description: 'Primeiro episódio da série Cyber Manju - Sudana No Sekai'
  },
  {
    id: 2,
    youtubeId: 'x0TEu_4X5vM',
    title: 'Budismo daora?',
    description: 'Ensinamentos de Dzongsar Khyentse Rinpoche'
  },
  {
    id: 3,
    youtubeId: 'Yi1dUT9-j0s',
    title: 'A Brincadeira Milagrosa de Manjushri - Parte 1',
    description: 'Legendado PT-BR'
  },
  {
    id: 4,
    youtubeId: '5Bi4eOgZZ2o',
    title: 'Manjushri 001',
    description: 'Legendado PT-BR'
  }
])
</script>

<style scoped>
.videos-page {
  padding: 3rem 1rem;
  min-height: 80vh;
}

.page-title {
  font-size: 2.5rem;
  text-align: center;
  margin-bottom: 0.5rem;
}

.page-subtitle {
  text-align: center;
  color: var(--text-secondary);
  margin-bottom: 3rem;
}

.videos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 2rem;
  margin-bottom: 4rem;
}

.video-card {
  overflow: hidden;
}

.video-wrapper {
  position: relative;
  padding-bottom: 56.25%;
  height: 0;
  overflow: hidden;
}

.video-wrapper iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.video-info {
  padding: 1.5rem;
}

.video-info h3 {
  font-size: 1.1rem;
  margin-bottom: 0.5rem;
}

.video-info p {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.no-videos {
  text-align: center;
  padding: 4rem;
  color: var(--text-secondary);
}

.youtube-channel {
  text-align: center;
  padding: 3rem;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 12px;
}

.youtube-channel h2 {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
  color: var(--accent-green);
}

.youtube-channel p {
  color: var(--text-secondary);
  margin-bottom: 1.5rem;
}

@media (max-width: 768px) {
  .videos-grid {
    grid-template-columns: 1fr;
  }
}
</style>
