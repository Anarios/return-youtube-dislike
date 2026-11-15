<template>
  <v-app>
    <h1>{{ title }}</h1>
    <NuxtLink to="/" @click.prevent="clearError({ redirect: '/' })"> Home page </NuxtLink>
  </v-app>
</template>

<script setup>
import { clearError } from "#app";

const props = defineProps({
  error: {
    type: Object,
    default: null,
  },
});

const title = computed(() => (props.error?.statusCode === 404 ? "404 Not Found" : "An error occurred"));
useHead(() => ({ title: title.value }));
</script>

<style scoped>
h1 {
  font-size: 20px;
}
</style>
