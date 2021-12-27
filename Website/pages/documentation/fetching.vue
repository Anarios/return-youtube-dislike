<template>
  <div>
    <h1 class="primary--text">Basic Fetching Tutorial</h1>

    <span>Example to get votes of a given YouTube video ID:</span>
    <a href="https://youtube.com/watch?v=kxOuG8jMIgI" target="_blank">kxOuG8jMIgI</a><br /><br />

    <h2>Example Request:</h2>
    <span><b>Request URL:</b></span>
    <a :href="apiUrl + '/votes?videoId=kxOuG8jMIgI'" target="_blank"
      v-text="apiUrl + '/votes?videoId=kxOuG8jMIgI'" /><br />
    <span><b>Request Method:</b>
      <a href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/GET" target="_blank">HTTP/GET</a></span><br />
    <span><b>Headers:</b></span><br />
    <code class="code">
      Accept: text/html,application/xhtml+xml,application/xml;q=0.9<br />
      Pragma: no-cache<br />
      Cache-Control: no-cache<br />
      Connection: keep-alive </code><br />
    <span><b>Response:</b></span><br />
    <div class="code">
      <code style="background-color: rgba(0, 0, 0, 0)">
        {<br />
        "id": "kxOuG8jMIgI",<br />
        "dateCreated": "2021-12-20T12:25:54.418014Z",<br />
        "likes": 27326,<br />
        "dislikes": 498153,<br />
        "rating": 1.212014408444885,<br />
        "viewCount": 3149885,<br />
        "deleted": false<br />
        }
      </code>
    </div>
    <br /><br />
    <v-alert border="left" color="orange" text type="info">
      <span>An invalid YouTube ID will return status code 404 "Not Found".</span><br />
      <span>An incorrectly formatted YouTube ID will return 400 "Bad
        Request".</span>
    </v-alert>

    <a :href="endpointUrl" target="_blank" v-text="endpointUrl" />
  </div>
</template>

<style scoped>
  .code {
    width: 100%;
    background: #353535;
    border-radius: 3px;
  }

</style>

<script>
  export default {
    data() {
      return {
        apiUrl: process.env.apiUrl,
      };
    },
  };

</script>
