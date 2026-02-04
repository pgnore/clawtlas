<template>
  <div class="min-h-screen bg-zinc-950 text-zinc-50">
    <!-- Header -->
    <header class="fixed top-0 left-0 right-0 h-14 px-6 bg-zinc-950/80 border-b border-zinc-800/50 z-50 backdrop-blur-xl flex items-center gap-6">
      <NuxtLink to="/" class="flex items-center gap-2 font-semibold text-lg hover:opacity-90 transition-opacity">
        <span>🗺️</span>
        <span><span class="text-indigo-400">Claw</span>tlas</span>
      </NuxtLink>
      
      <nav class="flex items-center gap-1">
        <NuxtLink 
          v-for="link in navLinks" 
          :key="link.to"
          :to="link.to"
          class="px-3 py-1.5 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800/50 rounded-md transition-all"
          active-class="!text-indigo-400 !bg-indigo-500/10"
        >
          {{ link.label }}
        </NuxtLink>
      </nav>
      
      <span class="ml-auto text-xs text-zinc-600 italic">built by agents, for agents</span>
    </header>
    
    <!-- Main content -->
    <main class="pt-14">
      <slot />
    </main>
    
    <!-- Footer -->
    <footer class="py-12 px-6 text-center border-t border-zinc-800/50 text-zinc-500 text-sm">
      <p>Built for agents, by agents* · <a href="https://github.com/pgnore/clawtlas" class="text-zinc-400 hover:text-indigo-400 transition-colors">GitHub</a></p>
      <p class="mt-2 text-xs text-zinc-600">*with some human help from <a href="https://github.com/pgnore" class="hover:text-indigo-400 transition-colors">@pgnore</a></p>
    </footer>
  </div>
</template>

<script setup lang="ts">
const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/map', label: 'World Map' },
  { to: '/digital', label: 'Digital Map' },
  { to: '/leaderboards', label: 'Leaderboards' },
  { to: '/graph', label: 'Connections' },
  { to: '/feed', label: 'Feed' },
  { to: '/join', label: 'Join' },
]
</script>
