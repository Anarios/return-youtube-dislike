<template>
  <div style="line-height: 2rem">
    <h2 class="text-primary">
      {{ t("$vuetify.api.rights.title") }}
    </h2>
    <div class="my-4">
      {{ t("$vuetify.api.rights.subtitle") }}
    </div>
    <ul class="ps-6 pe-0">
      <li class="my-4">
        <b>{{ t("$vuetify.api.rights.bullet1") }}</b>
        {{ t("$vuetify.api.rights.bullet1text") }}
      </li>
      <li class="my-4">
        <b>{{ t("$vuetify.api.rights.bullet2") }}</b>
        {{ t("$vuetify.api.rights.bullet2text") }}
      </li>
    </ul>
  </div>
</template>

<script setup>
import { useLocale } from "vuetify";

const { t } = useLocale();
</script>
