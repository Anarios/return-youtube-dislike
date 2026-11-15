<template>
  <!-- min-height overrides vertical centering from the parent default.vue layout -->
  <div class="width-constraint flex-wrapper docs-layout" style="min-height: calc(100vh - 10rem); position: relative">
    <!-- docs navigation  -->
    <v-list
      class="docs-navigation py-0 me-3"
      style="background: transparent; position: sticky; top: 6rem; align-self: flex-start"
    >
      <v-list-item
        v-for="(link, i) in links"
        :key="i"
        :to="link.to"
        class="mb-4"
        color="primary"
        style="overflow: hidden !important; border-radius: 0.75rem"
      >
        <v-list-item-title :class="isRtl ? 'text-left' : 'text-right'">
          {{ t(`$vuetify.api.${link.name}.title`) }}
        </v-list-item-title>
        <template #append>
          <v-icon :icon="link.icon" />
        </template>
      </v-list-item>
    </v-list>

    <!-- docs content -->
    <v-card
      class="docs-content glass pa-6"
      :class="isRtl ? 'text-right' : 'text-left'"
      style="height: max-content; max-width: 90vw !important; border-radius: 0.75rem"
    >
      <NuxtPage :transition="false" />
    </v-card>
  </div>
</template>

<script setup>
import { useLocale } from "vuetify";

const { t, isRtl } = useLocale();
const links = [
  { name: "rights", icon: "mdi-book-open-variant", to: "/docs/usage-rights" },
  { name: "url", icon: "mdi-web", to: "/docs/url" },
  { name: "endpoints", icon: "mdi-transit-connection-variant", to: "/docs/endpoints" },
  { name: "fetching", icon: "mdi-school", to: "/docs/fetching" },
];
</script>

<style>
.docs-navigation {
  --v-list-prepend-gap: 16px;
  flex: 0 0 auto;
  width: max-content;
  max-width: 40%;
}

.docs-navigation .v-list-item {
  min-height: 56px;
}

.docs-navigation .v-list-item-title {
  letter-spacing: normal;
  line-height: 1.2;
  white-space: normal;
  overflow-wrap: anywhere;
  text-overflow: clip;
}

.docs-navigation .v-list-item__append .v-icon {
  opacity: 1;
}

.docs-content {
  flex: 1 1 0;
  min-width: 0;
  overflow-wrap: anywhere;
}

@media (max-width: 768px) {
  .docs-layout {
    max-width: calc(100vw - 2rem);
  }

  .docs-navigation {
    max-width: 100%;
  }

  .docs-content {
    flex-basis: 100%;
  }
}

.docs-content .code,
.docs-content a {
  direction: ltr;
  text-align: left;
  unicode-bidi: isolate;
}
</style>
