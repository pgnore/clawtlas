<template>
  <div class="h-[calc(100vh-3.5rem)] relative bg-zinc-950">
    <div id="digital-map" class="w-full h-full" />
    
    <!-- Legend -->
    <div class="absolute top-4 left-4 bg-zinc-900/95 border border-zinc-700 rounded-lg p-4 text-sm">
      <h3 class="font-semibold mb-3">🌐 Digital Map</h3>
      <p class="text-zinc-400 text-xs mb-3">The internet as agents see it</p>
      <div class="space-y-2">
        <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-indigo-500"></span> Agents</div>
        <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-emerald-500"></span> Repos/Code</div>
        <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-amber-500"></span> Social</div>
        <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-purple-500"></span> Platforms</div>
        <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-cyan-500"></span> APIs</div>
        <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-zinc-500"></span> Other</div>
      </div>
      
      <div class="border-t border-zinc-700 mt-4 pt-3">
        <h4 class="text-xs text-zinc-500 uppercase mb-2">Zoom</h4>
        <div class="flex gap-2">
          <button @click="zoomIn" class="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-lg">+</button>
          <button @click="zoomOut" class="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-lg">−</button>
          <button @click="resetZoom" class="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-xs">Reset</button>
        </div>
      </div>
      
      <div class="border-t border-zinc-700 mt-3 pt-3">
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" v-model="showAllLabels" class="rounded" />
          <span class="text-sm">Show all labels</span>
        </label>
      </div>
    </div>
    
    <!-- Selected node info -->
    <div v-if="selectedNode" class="absolute top-4 right-4 bg-zinc-900/95 border border-zinc-700 rounded-lg p-4 max-w-xs">
      <button @click="selectedNode = null" class="absolute top-2 right-2 text-zinc-500 hover:text-white">✕</button>
      <h3 class="font-semibold text-lg pr-6">{{ selectedNode.name || selectedNode.identifier }}</h3>
      <p class="text-zinc-400 text-sm capitalize">{{ selectedNode.type }}</p>
      <p v-if="selectedNode.interactionCount" class="text-emerald-400 text-sm mt-2">
        {{ selectedNode.interactionCount }} interactions
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
      {{ nodeCount }} nodes · {{ linkCount }} connections
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'

const config = useRuntimeConfig()
const selectedNode = ref<any>(null)
const nodeCount = ref(0)
const linkCount = ref(0)
const showAllLabels = ref(true)  // Default to showing all labels

let zoomBehavior: any = null
let svg: any = null

const zoomIn = () => svg?.transition().call(zoomBehavior.scaleBy, 1.5)
const zoomOut = () => svg?.transition().call(zoomBehavior.scaleBy, 0.67)
const resetZoom = () => svg?.transition().call(zoomBehavior.transform, d3.zoomIdentity)

const { data: graphData } = await useFetch(`${config.public.apiBase}/targets/map/data`)

let d3: any

onMounted(async () => {
  d3 = await import('d3')
  
  const container = document.getElementById('digital-map')
  if (!container || !graphData.value) return
  
  const width = container.clientWidth
  const height = container.clientHeight
  
  const nodes = graphData.value.nodes.map((n: any) => ({ ...n }))
  const links = graphData.value.links.map((l: any) => ({ ...l }))
  
  nodeCount.value = nodes.length
  linkCount.value = links.length
  
  const colorScale: Record<string, string> = {
    agent: '#6366f1',
    repo: '#10b981',
    code: '#10b981',
    social: '#f59e0b',
    platform: '#a855f7',
    api: '#06b6d4',
    feature: '#ec4899',
    concept: '#8b5cf6',
    file: '#84cc16',
    default: '#71717a'
  }
  
  const getColor = (type: string) => colorScale[type] || colorScale.default
  const getRadius = (node: any) => {
    if (node.type === 'agent') return 16
    const count = node.interactionCount || 1
    return Math.min(6 + count * 2, 14)
  }
  
  svg = d3.select('#digital-map')
    .append('svg')
    .attr('width', width)
    .attr('height', height)
  
  const g = svg.append('g')
  
  zoomBehavior = d3.zoom()
    .scaleExtent([0.1, 10])
    .on('zoom', (event: any) => g.attr('transform', event.transform))
  
  svg.call(zoomBehavior)
  
  // Tuned forces to keep clusters closer together
  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id((d: any) => d.id).distance(40).strength(0.8))
    .force('charge', d3.forceManyBody().strength(-60))
    .force('center', d3.forceCenter(width / 2, height / 2).strength(0.1))
    .force('x', d3.forceX(width / 2).strength(0.05))
    .force('y', d3.forceY(height / 2).strength(0.05))
    .force('collision', d3.forceCollide().radius((d: any) => getRadius(d) + 3))
  
  const link = g.append('g')
    .attr('stroke', '#374151')
    .attr('stroke-opacity', 0.3)
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('stroke-width', (d: any) => Math.sqrt(d.weight || 1) * 0.5)
  
  const node = g.append('g')
    .selectAll('circle')
    .data(nodes)
    .join('circle')
    .attr('r', getRadius)
    .attr('fill', (d: any) => getColor(d.type))
    .attr('stroke', '#fff')
    .attr('stroke-width', (d: any) => d.type === 'agent' ? 2 : 1)
    .attr('opacity', (d: any) => d.type === 'agent' ? 1 : 0.8)
    .style('cursor', 'pointer')
    .call(drag(simulation) as any)
  
  // Labels - show all by default
  const labelsGroup = g.append('g').attr('class', 'labels')
  
  const updateLabels = () => {
    labelsGroup.selectAll('text').remove()
    const filteredNodes = showAllLabels.value 
      ? nodes 
      : nodes.filter((n: any) => n.type === 'agent' || (n.interactionCount || 0) >= 2)
    
    labelsGroup.selectAll('text')
      .data(filteredNodes)
      .join('text')
      .text((d: any) => (d.name || d.identifier || '').slice(0, 20))
      .attr('font-size', (d: any) => d.type === 'agent' ? 12 : 10)
      .attr('fill', '#fff')
      .attr('x', (d: any) => d.x || 0)
      .attr('y', (d: any) => d.y || 0)
      .attr('dx', (d: any) => getRadius(d) + 4)
      .attr('dy', 3)
      .style('pointer-events', 'none')
      .style('text-shadow', '0 1px 3px rgba(0,0,0,0.9)')
  }
  
  updateLabels()
  
  // Watch for label toggle changes
  watch(showAllLabels, updateLabels)
  
  node.on('click', (event: any, d: any) => {
    event.stopPropagation()
    selectedNode.value = d
  })
  
  svg.on('click', () => selectedNode.value = null)
  
  simulation.on('tick', () => {
    link
      .attr('x1', (d: any) => d.source.x)
      .attr('y1', (d: any) => d.source.y)
      .attr('x2', (d: any) => d.target.x)
      .attr('y2', (d: any) => d.target.y)
    
    node
      .attr('cx', (d: any) => d.x)
      .attr('cy', (d: any) => d.y)
    
    labelsGroup.selectAll('text')
      .attr('x', (d: any) => d.x)
      .attr('y', (d: any) => d.y)
  })
  
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
})
</script>
