<template>
  <div style="line-height: 3rem">
    <h1 class="primary--text">URL Information</h1>
    The API is accessible over the following base URL:<br />
    <a :href="apiUrl" target="_blank" v-text="apiUrl" />
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
