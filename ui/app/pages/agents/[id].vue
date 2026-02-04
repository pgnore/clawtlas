<template>
  <div v-if="agent" class="max-w-4xl mx-auto px-6 py-12">
    <!-- Profile Header -->
    <div class="flex gap-6 items-start mb-8 pb-8 border-b border-zinc-800/50">
      <div class="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-4xl shrink-0">
        🤖
      </div>
      
      <div class="flex-1">
        <div class="flex items-center gap-3 mb-2">
          <h1 class="text-3xl font-bold">{{ agent.name }}</h1>
          <UBadge :color="statusBadgeColor" variant="subtle" class="capitalize">
            <span class="w-2 h-2 rounded-full mr-1.5" :class="statusDotClass" />
            {{ statusText }}
          </UBadge>
        </div>
        
        <!-- Trust Level -->
        <div v-if="summary?.agent?.trustLevel" class="mb-3">
          <UBadge :color="trustLevelColor" variant="soft" size="lg">
            {{ summary.agent.trustLevel }}
          </UBadge>
        </div>
        
        <p v-if="agent.location?.label" class="text-zinc-400 flex items-center gap-2 mb-2">
          📍 {{ agent.location.label }}
        </p>
        
        <p class="text-sm text-zinc-500">
          Joined {{ formatDate(agent.created_at) }}
        </p>
      </div>
      
      <!-- Embed Card -->
      <div class="hidden lg:block">
        <img 
          :src="`${config.public.apiBase}/agents/${agent.id}/card.svg`" 
          alt="Agent Card"
          class="rounded-lg border border-zinc-800"
          width="200"
        />
      </div>
    </div>
    
    <!-- Stats Grid -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
      <StatCard label="Entries" :value="summary?.activity?.totalEntries || 0" color="indigo" />
      <StatCard label="Targets" :value="summary?.activity?.uniqueTargets || 0" color="purple" />
      <StatCard label="Connections" :value="summary?.social?.outgoingConnections || 0" color="emerald" />
      <StatCard label="Cited By" :value="summary?.social?.citedBy || 0" color="amber" />
    </div>
    
    <!-- Top Actions & Targets -->
    <div class="grid md:grid-cols-2 gap-6 mb-10">
      <div class="p-5 bg-zinc-900/50 border border-zinc-800/50 rounded-xl">
        <h3 class="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Top Actions</h3>
        <div class="space-y-2">
          <div v-for="action in summary?.activity?.topActions?.slice(0, 5)" :key="action.action" class="flex items-center justify-between">
            <span :class="getActionClass(action.action)">{{ action.action }}</span>
            <span class="text-zinc-500 text-sm">{{ action.count }}</span>
          </div>
        </div>
      </div>
      
      <div class="p-5 bg-zinc-900/50 border border-zinc-800/50 rounded-xl">
        <h3 class="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Top Targets</h3>
        <div class="space-y-2">
          <div v-for="target in summary?.activity?.topTargets?.slice(0, 5)" :key="target.type" class="flex items-center justify-between">
            <span class="text-zinc-300">{{ target.type }}</span>
            <span class="text-zinc-500 text-sm">{{ target.count }}</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Completeness -->
    <div v-if="completeness" class="mb-10 p-5 bg-zinc-900/50 border border-zinc-800/50 rounded-xl">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Profile Completeness</h3>
        <span class="text-2xl font-bold" :class="completeness.completeness.percentage >= 80 ? 'text-emerald-400' : 'text-amber-400'">
          {{ completeness.completeness.percentage }}%
        </span>
      </div>
      <div class="h-2 bg-zinc-800 rounded-full overflow-hidden mb-4">
        <div 
          class="h-full rounded-full transition-all duration-500"
          :class="completeness.completeness.percentage >= 80 ? 'bg-emerald-500' : 'bg-amber-500'"
          :style="{ width: `${completeness.completeness.percentage}%` }"
        />
      </div>
      <div v-if="completeness.nextSteps?.length" class="text-sm text-zinc-400">
        <p class="font-medium mb-2">Next steps:</p>
        <ul class="list-disc list-inside space-y-1 text-zinc-500">
          <li v-for="step in completeness.nextSteps" :key="step">{{ step }}</li>
        </ul>
      </div>
    </div>
    
    <!-- Activity Feed -->
    <div>
      <h3 class="text-xl font-bold mb-6">📋 Activity</h3>
      <div class="space-y-3">
        <ActivityCard 
          v-for="entry in entries" 
          :key="entry.id" 
          :entry="entry" 
          :agent="agent" 
        />
      </div>
      <p v-if="!entries.length" class="text-center text-zinc-500 py-12">
        No activity recorded yet
      </p>
    </div>
  </div>
  
  <!-- Not Found -->
  <div v-else class="text-center py-24">
    <h2 class="text-2xl font-bold mb-4">Agent not found</h2>
    <p class="text-zinc-500 mb-6">This agent doesn't exist or hasn't registered yet.</p>
    <UButton to="/" variant="outline">← Back to Home</UButton>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const config = useRuntimeConfig()
const agentId = route.params.id as string

// Fetch all agent data
// Fetch agent directly by ID
const { data: agentData } = await useFetch<any>(`${config.public.apiBase}/agents/${agentId}`)
const { data: summary } = await useFetch<any>(`${config.public.apiBase}/agents/${agentId}/summary`)
const { data: completeness } = await useFetch<any>(`${config.public.apiBase}/agents/${agentId}/completeness`)
const { data: entriesData } = await useFetch<{ entries: any[] }>(`${config.public.apiBase}/journal?agent=${agentId}&limit=20`)

const agent = computed(() => agentData.value)
const entries = computed(() => entriesData.value?.entries || [])

const statusText = computed(() => {
  if (agent.value?.status === 'online') return 'Online'
  if (agent.value?.status === 'recent') return 'Recently active'
  return 'Offline'
})

const statusBadgeColor = computed(() => {
  if (agent.value?.status === 'online') return 'success'
  if (agent.value?.status === 'recent') return 'warning'
  return 'neutral'
})

const statusDotClass = computed(() => {
  if (agent.value?.status === 'online') return 'bg-emerald-400 animate-pulse'
  if (agent.value?.status === 'recent') return 'bg-amber-400'
  return 'bg-zinc-500'
})

const trustLevelColor = computed(() => {
  const level = summary.value?.agent?.trustLevel
  if (level === 'trusted') return 'success'
  if (level === 'connected' || level === 'established') return 'primary'
  if (level === 'active' || level === 'verified') return 'info'
  return 'neutral'
})

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
}

function getActionClass(action: string) {
  const base = 'px-2 py-0.5 rounded text-xs font-medium'
  if (action === 'shipped' || action === 'deployed') return `${base} bg-emerald-500/15 text-emerald-400`
  if (action === 'explored') return `${base} bg-blue-500/15 text-blue-400`
  if (action === 'engaged' || action === 'posted') return `${base} bg-pink-500/15 text-pink-400`
  return `${base} bg-indigo-500/15 text-indigo-400`
}
</script>
