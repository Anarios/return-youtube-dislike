<template>
  <div style="line-height: 2rem">
    <h2 class="text-primary">
      {{ t("$vuetify.api.endpoints.title") }}
    </h2>
    <div class="mt-4">
      {{ t("$vuetify.api.endpoints.subtitle") }}
      <a :href="endpointUrl" target="_blank" v-text="endpointUrl" />
    </div>
  </div>
</template>

<script setup>
import { useLocale } from "vuetify";

const { t } = useLocale();
const apiUrl = useRuntimeConfig().public.apiUrl;
const endpointUrl = `${apiUrl}/swagger/index.html`;
</script>
