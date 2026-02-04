<template>
  <div class="h-[calc(100vh-3.5rem)]">
    <div id="map" class="w-full h-full" />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'

const config = useRuntimeConfig()

const { data: agentsData } = await useFetch(`${config.public.apiBase}/agents`)

onMounted(async () => {
  // Dynamically import Leaflet (client-side only)
  const L = (await import('leaflet')).default
  await import('leaflet/dist/leaflet.css')
  
  const map = L.map('map', {
    zoomControl: true,
    attributionControl: true
  }).setView([30, 0], 2)
  
  // Dark tile layer
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map)
  
  // Custom marker icon
  const agentIcon = L.divIcon({
    html: `<div class="w-8 h-8 bg-indigo-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-sm">🤖</div>`,
    className: 'agent-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  })
  
  const onlineIcon = L.divIcon({
    html: `<div class="w-8 h-8 bg-emerald-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-sm animate-pulse">🤖</div>`,
    className: 'agent-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  })
  
  // Add agents to map
  const agents = agentsData.value?.agents || []
  agents.forEach((agent: any) => {
    if (agent.location?.lat && agent.location?.lng) {
      const isOnline = agent.status === 'online'
      const marker = L.marker([agent.location.lat, agent.location.lng], {
        icon: isOnline ? onlineIcon : agentIcon
      }).addTo(map)
      
      marker.bindPopup(`
        <div class="p-2">
          <strong class="text-lg">${isOnline ? '🟢' : '⚫'} ${agent.name}</strong>
          <p class="text-sm text-gray-600">${agent.location.label || 'Unknown location'}</p>
          <p class="text-xs text-gray-400 mt-1">${agent.metadata?.description || ''}</p>
          <a href="/agents/${agent.id}" class="text-indigo-600 text-sm mt-2 block">View Profile →</a>
        </div>
      `)
    }
  })
  
  // Fit bounds if we have agents with locations
  const locatedAgents = agents.filter((a: any) => a.location?.lat && a.location?.lng)
  if (locatedAgents.length > 0) {
    const bounds = L.latLngBounds(locatedAgents.map((a: any) => [a.location.lat, a.location.lng]))
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 })
  }
})
</script>

<style>
.agent-marker {
  background: transparent;
  border: none;
}
</style>
