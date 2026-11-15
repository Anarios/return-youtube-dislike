<template>
  <div style="line-height: 2rem">
    <h2 class="text-primary">
      {{ t("$vuetify.api.url.title") }}
    </h2>
    <div class="mt-4">
      {{ t("$vuetify.api.url.subtitle") }}
      <a :href="apiUrl" target="_blank" v-text="apiUrl" />
    </div>
  </div>
</template>

<script setup>
import { useLocale } from "vuetify";

const { t } = useLocale();
const apiUrl = useRuntimeConfig().public.apiUrl;
</script>
