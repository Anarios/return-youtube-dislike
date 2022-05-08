<template>
  <!-- min-height overrides vertical centering from the parent default.vue layout -->
  <div
    class="width-constraint flex-wrapper"
    style="min-height: calc(100vh - 10rem); position: relative"
  >
    <!-- docs navigation  -->
    <v-list
      class="py-0 mr-3"
      style="
        background: transparent;
        position: sticky;
        top: 6rem;
        align-self: flex-start;
      "
    >
      <v-list-item
        v-for="(link, i) in links"
        :key="i"
        :to="link.to"
        router
        class="mb-4"
        color="primary"
        style="overflow: hidden !important; border-radius: 0.75rem"
      >
        <v-list-item-title style="text-align: right">
          <v-list-item-title
            v-text="$vuetify.lang.t(`$vuetify.api.${link.name}.title`)"
          />
        </v-list-item-title>
        <v-list-item-icon>
          <v-icon v-text="link.icon" />
        </v-list-item-icon>
      </v-list-item>
    </v-list>

    <!-- docs content -->
    <v-card
      class="text-left glass pa-6"
      style="
        flex-grow: 2;
        height: max-content;
        max-width: 90vw !important;
        border-radius: 0.75rem;
      "
    >
      <NuxtChild />
    </v-card>
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
  data() {
    return {
      //---   Links To Generate Above    ---//
      links: [
        {
          name: "rights",
          icon: "mdi-book-open-variant",
          to: "/docs/usage-rights",
        },
        {
          name: "url",
          icon: "mdi-web",
          to: "/docs/url",
        },
        {
          name: "endpoints",
          icon: "mdi-transit-connection-variant",
          to: "/docs/endpoints",
        },
        {
          name: "fetching",
          icon: "mdi-school",
          to: "/docs/fetching",
        },
      ],
    };
  },
};
</script>
