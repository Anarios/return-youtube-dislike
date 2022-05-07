<template>
  <div class="width-constraint">
    <h1 class="title-text">
      {{ $vuetify.lang.t("$vuetify.faq.title") }}
    </h1>
    <p style="color: #999; margin-top: 0.5rem; margin-bottom: 1.5rem">
      {{ $vuetify.lang.t("$vuetify.faq.subtitle") }}
    </p>

    <v-expansion-panels>
      <v-expansion-panel v-for="i in [1, 2, 3, 4, 5, 6, 7]" :key="i">
        <v-expansion-panel-header>
          {{ $vuetify.lang.t(`$vuetify.faq.bullet${i}`) }}
        </v-expansion-panel-header>
        <v-expansion-panel-content class="text-left">
          <hr style="border-color: #444" />
          <br />
          <span v-html="$vuetify.lang.t(`$vuetify.faq.bullet${i}text`)" />
        </v-expansion-panel-content>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>

<script>
export default {
  transition(to, from) {
    if (!from) return "swoop-in";
    let routes = ["index", "install", "docs", "help", "faq", "donate", "links"];
    if (routes.indexOf(to.name) < 0) return "swoop-out";
    if (routes.indexOf(from.name) < 0) return "swoop-in";
    return routes.indexOf(to.name) > routes.indexOf(from.name)
      ? "swoop-left"
      : "swoop-right";
  },
};
</script>
