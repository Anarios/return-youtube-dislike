<template>
  <div style="line-height: 2rem">
    <h2 class="primary--text">
      {{ $vuetify.lang.t("$vuetify.api.url.title") }}
    </h2>
    <div class="mt-4">
      {{ $vuetify.lang.t("$vuetify.api.url.subtitle") }}
      <a :href="apiUrl" target="_blank" v-text="apiUrl" />
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      apiUrl: process.env.apiUrl,
    };
  },
};
</script>
