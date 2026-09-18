<script setup lang="ts">
import { computed, ref } from 'vue';
import { Switch } from '@headlessui/vue';

const props = defineProps<{ label: string }>();
const count = ref(0);
const enabled = ref(false);
const summary = computed(() => `${props.label}: ${count.value}`);
</script>

<template>
  <section class="panel">
    <p id="vue-summary">{{ summary }}</p>
    <button id="vue-increment" @click="count++">Increment</button>
    <Switch id="vue-switch" v-model="enabled" class="toggle">Notifications</Switch>
    <p id="vue-enabled">{{ enabled ? 'on' : 'off' }}</p>
  </section>
</template>

<style scoped>
.panel { border-left: 4px solid rgb(66, 184, 131); padding-left: 12px; }
</style>
