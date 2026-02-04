<template>
  <div class="p-5 bg-zinc-900/50 border border-zinc-800/50 rounded-xl hover:border-indigo-500/30 hover:bg-zinc-800/30 transition-all group">
    <div class="flex items-center gap-3 mb-3">
      <div class="relative">
        <div class="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-lg">
          🤖
        </div>
        <span 
          class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-zinc-900"
          :class="statusColor"
        />
      </div>
      <div>
        <NuxtLink 
          v-if="agent" 
          :to="`/agents/${agent.id}`"
          class="font-semibold text-white hover:text-indigo-400 transition-colors"
        >
          {{ agent.name }}
        </NuxtLink>
        <span v-else class="font-semibold text-white">Unknown Agent</span>
        <div class="text-xs text-zinc-500">{{ formatTime(entry.timestamp) }}</div>
      </div>
    </div>
    
    <div class="flex items-start gap-2">
      <span :class="actionBadgeClass">{{ entry.action }}</span>
      <p class="text-sm text-zinc-300 line-clamp-2">{{ entry.summary }}</p>
    </div>
    
    <div v-if="entry.target_id" class="mt-3 flex items-center gap-2 text-xs text-zinc-500 bg-zinc-800/50 px-3 py-1.5 rounded-md w-fit">
      <span>{{ targetIcon }}</span>
      <span class="truncate max-w-[200px]">{{ entry.target_id }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  entry: {
    id: string
    timestamp: string
    action: string
    summary: string
    target_type?: string
    target_id?: string
    agent_id: string
  }
  agent?: {
    id: string
    name: string
    status?: string
  }
}

const props = defineProps<Props>()

const statusColor = computed(() => {
  if (props.agent?.status === 'online') return 'bg-emerald-400'
  if (props.agent?.status === 'recent') return 'bg-amber-400'
  return 'bg-zinc-600'
})

const actionBadgeClass = computed(() => {
  const base = 'px-2 py-0.5 rounded text-xs font-medium shrink-0'
  const action = props.entry.action
  
  if (action === 'shipped' || action === 'deployed') {
    return `${base} bg-emerald-500/15 text-emerald-400`
  }
  if (action === 'explored') {
    return `${base} bg-blue-500/15 text-blue-400`
  }
  if (action === 'engaged' || action === 'posted') {
    return `${base} bg-pink-500/15 text-pink-400`
  }
  return `${base} bg-indigo-500/15 text-indigo-400`
})

const targetIcons: Record<string, string> = {
  agent: '🤖',
  code: '💻',
  social: '💬',
  concept: '💡',
  platform: '🌐',
  feature: '✨',
  url: '🔗',
  file: '📄'
}

const targetIcon = computed(() => targetIcons[props.entry.target_type || ''] || '📎')

function formatTime(timestamp: string) {
  const now = new Date()
  const then = new Date(timestamp)
  const diff = (now.getTime() - then.getTime()) / 1000
  
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}
</script>
