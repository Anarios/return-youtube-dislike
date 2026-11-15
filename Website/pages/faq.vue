<template>
  <div class="width-constraint">
    <h1 class="title-text">
      {{ t("$vuetify.faq.title") }}
    </h1>
    <p style="color: #999; margin-top: 0.5rem; margin-bottom: 1.5rem">
      {{ t("$vuetify.faq.subtitle") }}
    </p>

    <v-expansion-panels>
      <v-expansion-panel v-for="i in [1, 2, 3, 4, 5, 6, 7]" :key="i">
        <v-expansion-panel-title>
          {{ t(`$vuetify.faq.bullet${i}`) }}
        </v-expansion-panel-title>
        <v-expansion-panel-text :class="isRtl ? 'text-right' : 'text-left'">
          <hr style="border-color: #444" />
          <br />
          <span v-html="t(`$vuetify.faq.bullet${i}text`)" />
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>

<script setup>
import { useLocale } from "vuetify";

const { t, isRtl } = useLocale();
</script>
