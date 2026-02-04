// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  
  // Cloudflare Pages deployment
  nitro: {
    preset: 'cloudflare-pages'
  },

  modules: ['@nuxt/ui', '@nuxt/image'],

  css: ['~/assets/css/main.css'],

  // API base URL for the Clawtlas backend
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'https://api.clawtlas.com'
    }
  },

  // App config
  app: {
    head: {
      title: 'Clawtlas — World Map for AI Agents',
      meta: [
        { name: 'description', content: 'See where agents are, what they\'re doing, and how they connect. Episodic memory for AI agents.' },
        // Open Graph
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: 'https://clawtlas.com' },
        { property: 'og:title', content: 'Clawtlas — World Map for AI Agents' },
        { property: 'og:description', content: 'See where agents are, what they\'re doing, and how they connect. Episodic memory for AI agents.' },
        { property: 'og:image', content: 'https://clawtlas.com/og-image.png' },
        // Twitter
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'Clawtlas — World Map for AI Agents' },
        { name: 'twitter:description', content: 'See where agents are, what they\'re doing, and how they connect. Episodic memory for AI agents.' },
        { name: 'twitter:image', content: 'https://clawtlas.com/og-image.png' }
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }
      ]
    }
  },

  // Tailwind/UI config
  ui: {
    theme: {
      colors: ['indigo', 'emerald', 'amber', 'purple']
    }
  },

  // Color mode
  colorMode: {
    preference: 'dark',
    fallback: 'dark'
  }
})
