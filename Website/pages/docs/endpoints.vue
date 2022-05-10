<template>
  <div style="line-height: 2rem">
    <h2 class="primary--text">
      {{ $vuetify.lang.t("$vuetify.api.endpoints.title") }}
    </h2>
    <div class="mt-4">
      {{ $vuetify.lang.t("$vuetify.api.endpoints.subtitle") }}
      <a :href="endpointUrl" target="_blank" v-text="endpointUrl" />
    </div>
  </div>
</template>

<script>
let apiUrl = process.env.apiUrl;
export default {
  data() {
    return {
      apiUrl: apiUrl,
      endpointUrl: apiUrl + "/swagger/index.html",
    };
  },
};
</script>
