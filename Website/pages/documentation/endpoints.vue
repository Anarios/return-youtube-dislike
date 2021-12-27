<template>
  <div>
    <h1 class="primary--text">Available Endpoints</h1>
    List of available endpoints is available here:<br>
    <a :href="endpointUrl" v-text="endpointUrl" target="_blank" />

  </div>
</template>

<script>
let apiUrl = process.env.apiUrl;
export default {
  data() {
    return {
      apiUrl: apiUrl,
      endpointUrl: apiUrl+'/swagger/index.html'
    }
  }
}
</script>