<template>
  <div style="line-height: 3rem">
    <h1 class="primary--text">Basic Fetching Tutorial</h1>

    <span>Example to get votes of a given YouTube video ID:</span>
    <a href="https://youtube.com/watch?v=kxOuG8jMIgI" target="_blank">kxOuG8jMIgI</a>

    <h2>Example Request:</h2>
    <span>Request URL:</span>
    <a
      :href="apiUrl + '/votes?videoId=kxOuG8jMIgI'"
      target="_blank"
      v-text="apiUrl + '/votes?videoId=kxOuG8jMIgI'"
    />
    <br />
    <span>
      Request Method:
      <a
        href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/GET"
        target="_blank"
        >HTTP/GET</a
      >
    </span>
    <br />
    <span>Headers:</span>
    <br />
    <div class="code pa-4">
      Accept: text/html,application/xhtml+xml,application/xml;q=0.9<br />
      Pragma: no-cache<br />
      Cache-Control: no-cache<br />
      Connection: keep-alive
    </div>
    <span>Response:</span><br />
    <div class="code pa-4">
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
    <v-alert border="left" color="orange" text type="info">
      <span>An invalid YouTube ID will return status code 404 "Not Found".</span><br />
      <span>An incorrectly formatted YouTube ID will return 400 "Bad Request".</span>
    </v-alert>

    <a :href="endpointUrl" target="_blank" v-text="endpointUrl" />
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
