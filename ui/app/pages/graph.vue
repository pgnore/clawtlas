<template>
  <div class="h-[calc(100vh-3.5rem)] relative bg-zinc-950">
    <div id="graph" class="w-full h-full" />
    
    <!-- Controls -->
    <div class="absolute top-4 left-4 bg-zinc-900/95 border border-zinc-700 rounded-lg p-4 text-sm space-y-4">
      <div>
        <h3 class="font-semibold mb-3">🎛️ Controls</h3>
        <div class="space-y-2">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" v-model="showAgents" class="rounded" />
            <span class="text-indigo-400">🤖 Agents</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" v-model="showSocial" class="rounded" />
            <span class="text-amber-400">💬 Social</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" v-model="showCode" class="rounded" />
            <span class="text-emerald-400">💻 Code/Repos</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" v-model="showOther" class="rounded" />
            <span class="text-zinc-400">📦 Other</span>
          </label>
        </div>
      </div>
      
      <div class="border-t border-zinc-700 pt-3">
        <h4 class="text-xs text-zinc-500 uppercase mb-2">Zoom</h4>
        <div class="flex gap-2">
          <button @click="zoomIn" class="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-lg">+</button>
          <button @click="zoomOut" class="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-lg">−</button>
          <button @click="resetZoom" class="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-xs">Reset</button>
        </div>
      </div>
      
      <div class="border-t border-zinc-700 pt-3">
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" v-model="showLabels" class="rounded" />
          <span>Show all labels</span>
        </label>
      </div>
    </div>
    
    <!-- Info panel -->
    <div v-if="selectedNode" class="absolute top-4 right-4 bg-zinc-900/95 border border-zinc-700 rounded-lg p-4 max-w-xs">
      <button @click="selectedNode = null" class="absolute top-2 right-2 text-zinc-500 hover:text-white">✕</button>
      <h3 class="font-semibold text-lg pr-6">{{ selectedNode.name }}</h3>
      <p class="text-zinc-400 text-sm capitalize">{{ selectedNode.type }}</p>
      <p v-if="selectedNode.interactionCount" class="text-zinc-500 text-xs mt-1">
        {{ selectedNode.interactionCount }} interactions
      </p>
      <p v-if="selectedNode.lastSeen" class="text-zinc-500 text-xs">
        Last: {{ formatTime(selectedNode.lastSeen) }}
      </p>
      <NuxtLink 
        v-if="selectedNode.type === 'agent'" 
        :to="`/agents/${selectedNode.id}`"
        class="text-indigo-400 text-sm mt-3 block hover:underline"
      >
        View Profile →
      </NuxtLink>
    </div>
    
    <!-- Stats -->
    <div class="absolute bottom-4 left-4 bg-zinc-900/95 border border-zinc-700 rounded-lg px-4 py-2 text-xs text-zinc-400">
      {{ filteredNodes.length }} nodes · {{ filteredLinks.length }} connections
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'

const config = useRuntimeConfig()
const selectedNode = ref<any>(null)

// Filters
const showAgents = ref(true)
const showSocial = ref(true)
const showCode = ref(true)
const showOther = ref(true)
const showLabels = ref(false)

// Zoom functions (will be set after D3 init)
let zoomBehavior: any = null
let svg: any = null

const zoomIn = () => {
  if (svg && zoomBehavior) {
    svg.transition().call(zoomBehavior.scaleBy, 1.5)
  }
}

const zoomOut = () => {
  if (svg && zoomBehavior) {
    svg.transition().call(zoomBehavior.scaleBy, 0.67)
  }
}

const resetZoom = () => {
  if (svg && zoomBehavior) {
    svg.transition().call(zoomBehavior.transform, d3.zoomIdentity)
  }
}

const { data: graphData } = await useFetch(`${config.public.apiBase}/targets/map/data`)

// Type categorization
const getCategory = (type: string) => {
  if (type === 'agent') return 'agent'
  if (['social', 'platform', 'discussion', 'thread', 'tweet'].includes(type)) return 'social'
  if (['repo', 'code', 'feature', 'endpoint', 'api', 'file'].includes(type)) return 'code'
  return 'other'
}

const filteredNodes = computed(() => {
  if (!graphData.value?.nodes) return []
  return graphData.value.nodes.filter((n: any) => {
    const cat = getCategory(n.type)
    if (cat === 'agent' && !showAgents.value) return false
    if (cat === 'social' && !showSocial.value) return false
    if (cat === 'code' && !showCode.value) return false
    if (cat === 'other' && !showOther.value) return false
    return true
  })
})

const filteredNodeIds = computed(() => new Set(filteredNodes.value.map((n: any) => n.id)))

const filteredLinks = computed(() => {
  if (!graphData.value?.links) return []
  return graphData.value.links.filter((l: any) => 
    filteredNodeIds.value.has(l.source?.id || l.source) && 
    filteredNodeIds.value.has(l.target?.id || l.target)
  )
})

const formatTime = (ts: string) => {
  if (!ts) return ''
  const date = new Date(ts)
  return date.toLocaleDateString()
}

let d3: any

onMounted(async () => {
  d3 = await import('d3')
  initGraph()
})

// Re-init when filters change
watch([showAgents, showSocial, showCode, showOther, showLabels], () => {
  const container = document.getElementById('graph')
  if (container) {
    container.innerHTML = ''
    initGraph()
  }
})

function initGraph() {
  const container = document.getElementById('graph')
  if (!container || !graphData.value) return
  
  const width = container.clientWidth
  const height = container.clientHeight
  
  // Color scale by type
  const colorScale: Record<string, string> = {
    agent: '#6366f1',
    repo: '#10b981',
    code: '#3b82f6',
    social: '#f59e0b',
    platform: '#a855f7',
    feature: '#ec4899',
    concept: '#8b5cf6',
    endpoint: '#06b6d4',
    file: '#84cc16',
    default: '#71717a'
  }
  
  const getColor = (type: string) => colorScale[type] || colorScale.default
  
  // Process data
  const nodes = filteredNodes.value.map((n: any) => ({ ...n }))
  const nodeMap = new Map(nodes.map((n: any) => [n.id, n]))
  
  const links = filteredLinks.value.map((l: any) => ({
    source: l.source?.id || l.source,
    target: l.target?.id || l.target,
    weight: l.weight || 1
  })).filter((l: any) => nodeMap.has(l.source) && nodeMap.has(l.target))
  
  // Create SVG with zoom
  svg = d3.select('#graph')
    .append('svg')
    .attr('width', width)
    .attr('height', height)
  
  const g = svg.append('g')
  
  zoomBehavior = d3.zoom()
    .scaleExtent([0.1, 10])
    .on('zoom', (event: any) => {
      g.attr('transform', event.transform)
    })
  
  svg.call(zoomBehavior)
  
  // Create force simulation - tuned for better clustering
  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id((d: any) => d.id).distance(50).strength(0.8))
    .force('charge', d3.forceManyBody().strength(-80))
    .force('center', d3.forceCenter(width / 2, height / 2).strength(0.1))
    .force('x', d3.forceX(width / 2).strength(0.05))
    .force('y', d3.forceY(height / 2).strength(0.05))
    .force('collision', d3.forceCollide().radius(20))
  
  // Draw links
  const link = g.append('g')
    .attr('stroke', '#374151')
    .attr('stroke-opacity', 0.4)
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('stroke-width', (d: any) => Math.sqrt(d.weight || 1))
  
  // Draw nodes
  const node = g.append('g')
    .selectAll('circle')
    .data(nodes)
    .join('circle')
    .attr('r', (d: any) => d.type === 'agent' ? 14 : 8)
    .attr('fill', (d: any) => getColor(d.type))
    .attr('stroke', '#fff')
    .attr('stroke-width', (d: any) => d.type === 'agent' ? 2 : 1)
    .style('cursor', 'pointer')
    .call(drag(simulation) as any)
  
  // Labels
  const labels = g.append('g')
    .selectAll('text')
    .data(nodes.filter((n: any) => showLabels.value || n.type === 'agent'))
    .join('text')
    .text((d: any) => d.name?.slice(0, 20) || d.id.slice(0, 8))
    .attr('font-size', (d: any) => d.type === 'agent' ? 12 : 10)
    .attr('fill', '#fff')
    .attr('dx', (d: any) => d.type === 'agent' ? 18 : 12)
    .attr('dy', 4)
    .style('pointer-events', 'none')
    .style('text-shadow', '0 1px 3px rgba(0,0,0,0.8)')
  
  // Click handler
  node.on('click', (event: any, d: any) => {
    event.stopPropagation()
    selectedNode.value = d
  })
  
  svg.on('click', () => {
    selectedNode.value = null
  })
  
  // Hover effects
  node.on('mouseenter', function(this: any) {
    d3.select(this).attr('stroke-width', 3)
  }).on('mouseleave', function(this: any, event: any, d: any) {
    d3.select(this).attr('stroke-width', d.type === 'agent' ? 2 : 1)
  })
  
  // Tick
  simulation.on('tick', () => {
    link
      .attr('x1', (d: any) => d.source.x)
      .attr('y1', (d: any) => d.source.y)
      .attr('x2', (d: any) => d.target.x)
      .attr('y2', (d: any) => d.target.y)
    
    node
      .attr('cx', (d: any) => d.x)
      .attr('cy', (d: any) => d.y)
    
    labels
      .attr('x', (d: any) => d.x)
      .attr('y', (d: any) => d.y)
  })
  
  // Drag behavior
  function drag(sim: any) {
    return d3.drag()
      .on('start', (event: any) => {
        if (!event.active) sim.alphaTarget(0.3).restart()
        event.subject.fx = event.subject.x
        event.subject.fy = event.subject.y
      })
      .on('drag', (event: any) => {
        event.subject.fx = event.x
        event.subject.fy = event.y
      })
      .on('end', (event: any) => {
        if (!event.active) sim.alphaTarget(0)
        event.subject.fx = null
        event.subject.fy = null
      })
  }
}
</script>
