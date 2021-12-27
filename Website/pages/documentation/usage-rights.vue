<template>
  <div>
    <h1 class="primary--text">Usage Rights</h1>
    <p>
      Third party use of this open API is allowed with the following
      restrictions:
    </p>
    <ul>
      <li>
        <b>Attribution:</b> This project should be clearly attributed with
        either a link to this repo or a link to returnyoutubedislike.com.
      </li>
      <li>
        <b>Rate Limiting:</b> There are per client rate limits in place of 100
        per minute and 10'000 per day. This will return a 429 status code
        indicating that your application should back off.
      </li>
    </ul>
  </div>
</template>

<style scoped>
  li {
    margin-top: 0.5em;
  }

  b {
    font-weight: 900 !important;
  }

</style>
