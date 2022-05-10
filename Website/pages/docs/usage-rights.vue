<template>
  <div style="line-height: 2rem">
    <h2 class="primary--text">
      {{ $vuetify.lang.t("$vuetify.api.rights.title") }}
    </h2>
    <div class="my-4">
      {{ $vuetify.lang.t("$vuetify.api.rights.subtitle") }}
    </div>
    <ul>
      <li class="my-4">
        <b>{{ $vuetify.lang.t("$vuetify.api.rights.bullet1") }}</b>
        {{ $vuetify.lang.t("$vuetify.api.rights.bullet1text") }}
      </li>
      <li class="my-4">
        <b>{{ $vuetify.lang.t("$vuetify.api.rights.bullet2") }}</b>
        {{ $vuetify.lang.t("$vuetify.api.rights.bullet2text") }}
      </li>
    </ul>
  </div>
</template>
