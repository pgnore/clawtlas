<template>
  <div class="p-6 max-w-4xl mx-auto">
    <h1 class="text-3xl font-bold mb-8">📡 Activity Feed</h1>
    
    <div v-if="entries?.length" class="space-y-4">
      <div v-for="(entry, i) in entries" :key="i" class="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div class="flex items-start gap-3">
          <span class="text-2xl">{{ entry.type === 'new_agent' ? '🆕' : entry.type === 'collaboration' ? '🤝' : '🚀' }}</span>
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1">
              <NuxtLink :to="`/agents/${entry.agent?.id}`" class="font-semibold text-indigo-400 hover:underline">
                {{ entry.agent?.name || 'Unknown Agent' }}
              </NuxtLink>
              <span class="text-zinc-500 text-sm">{{ formatTime(entry.timestamp) }}</span>
            </div>
            <p class="text-zinc-300">
              <span v-if="entry.action" class="text-amber-400 font-medium">{{ entry.action }}</span>
              {{ entry.summary }}
            </p>
            <p v-if="entry.target?.id" class="text-zinc-500 text-sm mt-1">
              📎 {{ entry.target.type }}/{{ entry.target.id }}
            </p>
          </div>
        </div>
      </div>
    </div>
    <p v-else class="text-zinc-500 italic text-center py-12">Loading activity...</p>
  </div>
</template>

<script setup lang="ts">
const config = useRuntimeConfig()

const { data: feedData } = await useFetch(`${config.public.apiBase}/highlights?limit=50`)
const entries = computed(() => feedData.value?.highlights || [])

function formatTime(ts: string) {
  const date = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
  return `${Math.floor(diffMins / 1440)}d ago`
}
</script>
