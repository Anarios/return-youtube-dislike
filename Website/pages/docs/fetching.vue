<template>
  <div style="line-height: 2rem">
    <h2 class="primary--text">
      {{ $vuetify.lang.t("$vuetify.api.fetching.title") }}
    </h2>

    <div class="ma-2">
      {{ $vuetify.lang.t("$vuetify.api.fetching.subtitle") }}

      <a href="https://youtube.com/watch?v=kxOuG8jMIgI" target="_blank">
        kxOuG8jMIgI
      </a>
    </div>

    <h3 class="mt-6">{{ $vuetify.lang.t("$vuetify.api.fetching.title2") }}</h3>
    <div class="ma-2">
      {{ $vuetify.lang.t("$vuetify.api.fetching.url") }}
      <a
        :href="apiUrl + '/votes?videoId=kxOuG8jMIgI'"
        target="_blank"
        v-text="apiUrl + '/votes?videoId=kxOuG8jMIgI'"
      />
      <br />
      {{ $vuetify.lang.t("$vuetify.api.fetching.method") }}
      <a
        href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/GET"
        target="_blank"
      >
        HTTP/GET
      </a>
    </div>
    <div class="mt-4 ml-2">
      {{ $vuetify.lang.t("$vuetify.api.fetching.headers") }}
    </div>
    <div class="code px-4 py-2">
      Accept: text/html,application/xhtml+xml,application/xml;q=0.9<br />
      Pragma: no-cache<br />
      Cache-Control: no-cache<br />
      Connection: keep-alive
    </div>
    <div class="mt-4 ml-2">
      {{ $vuetify.lang.t("$vuetify.api.fetching.response") }}
    </div>
    <div class="code px-4 py-2">
      {
      <br />
      &nbsp;"id": "kxOuG8jMIgI",<br />
      &nbsp;"dateCreated": "2021-12-20T12:25:54.418014Z",<br />
      &nbsp;"likes": 27326,<br />
      &nbsp;"dislikes": 498153,<br />
      &nbsp;"rating": 1.212014408444885,<br />
      &nbsp;"viewCount": 3149885,<br />
      &nbsp;"deleted": false<br />
      }
    </div>
    <br />
    <v-alert border="left" color="orange" text type="info" class="mb-0">
      <span>{{ $vuetify.lang.t("$vuetify.api.fetching.error1") }}</span>
      <br />
      <span>{{ $vuetify.lang.t("$vuetify.api.fetching.error2") }}</span>
    </v-alert>
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

<style scoped>
.code {
  color: #aaa;
  background: #353535;
  border-radius: 0.5rem;
  font-family: monospace;
  line-height: 2rem;
}
</style>
