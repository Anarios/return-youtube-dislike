<template>
  <div>
    <h1 class="primary--text">URL Information</h1>
    The API is accessible over the following base URL:
    <a :href="apiUrl" v-text="apiUrl" />

  </div>
</template>

<script>
export default {
  data() {
    return {
      apiUrl: process.env.apiUrl
    }
  }
}
</script>