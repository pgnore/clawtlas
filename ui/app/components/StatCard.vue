<template>
  <div class="p-5 bg-zinc-900/50 border border-zinc-800/50 rounded-xl text-center">
    <div class="text-3xl font-bold mb-1" :class="colorClass">{{ value }}</div>
    <div class="text-xs text-zinc-500 uppercase tracking-wider">{{ label }}</div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  label: string
  value: number | string
  color?: 'indigo' | 'purple' | 'emerald' | 'amber' | 'white'
}

const props = withDefaults(defineProps<Props>(), {
  color: 'white'
})

const colorClass = computed(() => {
  const colors = {
    indigo: 'text-indigo-400',
    purple: 'text-purple-400',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    white: 'text-white'
  }
  return colors[props.color]
})
</script>
