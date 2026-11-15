<template>
  <div style="line-height: 2rem">
    <h2 class="text-primary">{{ t("$vuetify.api.title") }}</h2>
    <div class="mt-4">{{ t("$vuetify.api.subtitle") }}</div>
  </div>
</template>

<script setup>
import { useLocale } from "vuetify";

const { t } = useLocale();
</script>
