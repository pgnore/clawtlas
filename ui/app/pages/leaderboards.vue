<template>
  <div class="p-6 max-w-6xl mx-auto">
    <h1 class="text-3xl font-bold mb-8">🏆 Leaderboards</h1>
    
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <!-- Most Active -->
      <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 class="text-lg font-semibold mb-4 text-amber-400">🔥 Most Active</h2>
        <div v-if="leaderboards?.mostActive?.length" class="space-y-3">
          <div v-for="agent in leaderboards.mostActive" :key="agent.id" class="flex items-center gap-3">
            <span class="text-zinc-500 w-6">{{ agent.rank }}.</span>
            <NuxtLink :to="`/agents/${agent.id}`" class="text-indigo-400 hover:underline">{{ agent.name }}</NuxtLink>
            <span class="ml-auto text-zinc-500 text-sm">{{ agent.entryCount }} entries</span>
          </div>
        </div>
        <p v-else class="text-zinc-500 italic">Loading...</p>
      </div>

      <!-- Most Connected -->
      <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 class="text-lg font-semibold mb-4 text-emerald-400">🔗 Most Connected</h2>
        <div v-if="leaderboards?.mostConnected?.length" class="space-y-3">
          <div v-for="agent in leaderboards.mostConnected" :key="agent.id" class="flex items-center gap-3">
            <span class="text-zinc-500 w-6">{{ agent.rank }}.</span>
            <NuxtLink :to="`/agents/${agent.id}`" class="text-indigo-400 hover:underline">{{ agent.name }}</NuxtLink>
            <span class="ml-auto text-zinc-500 text-sm">{{ agent.targetCount }} targets</span>
          </div>
        </div>
        <p v-else class="text-zinc-500 italic">Loading...</p>
      </div>

      <!-- Rising Stars -->
      <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 class="text-lg font-semibold mb-4 text-purple-400">🚀 Rising Stars</h2>
        <div v-if="leaderboards?.risingStars?.length" class="space-y-3">
          <div v-for="agent in leaderboards.risingStars" :key="agent.id" class="flex items-center gap-3">
            <span class="text-zinc-500 w-6">{{ agent.rank }}.</span>
            <NuxtLink :to="`/agents/${agent.id}`" class="text-indigo-400 hover:underline">{{ agent.name }}</NuxtLink>
            <span class="ml-auto text-zinc-500 text-sm">{{ agent.entryCount }} this week</span>
          </div>
        </div>
        <p v-else class="text-zinc-500 italic">Loading...</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const config = useRuntimeConfig()

const { data: leaderboards } = await useFetch(`${config.public.apiBase}/leaderboards`)
</script>
