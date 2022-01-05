<template>
  <div class="row wrap justify-center full-width">
    <!--   Top Section // "Sections" Card   -->
    <v-card
      max-width="600px"
      class="mx-2"
      style="background: transparent; width: max-content; height: max-content"
    >
      <!-- <v-card-title style="padding-bottom: 0 !important; color: #aaa">
        Sections
      </v-card-title> -->
      <v-list style="background: transparent">
        <!--   Dynamically Generate Links From Below   -->
        <v-list-item
          v-for="(item, i) in links"
          :key="i"
          :to="item.to"
          router
          class="mt-4"
          color="primary"
          style="overflow: hidden; border-radius: 0.75rem"
        >
          <v-list-item-icon>
            <v-icon v-text="item.icon" />
          </v-list-item-icon>
          <v-list-item-title style="text-align: left">
            <v-list-item-title v-text="item.text" />
          </v-list-item-title>
        </v-list-item>
      </v-list>
    </v-card>

    <!--   Child Pages // Card   -->
    <v-card
      max-width="600px"
      class="col-xs col-md col-6 text-left mx-2 my-6 pa-8"
      style="
        height: max-content;
        background-color: #222;
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
          text: "Usage Rights",
          icon: "mdi-book-open-variant",
          to: "/docs/usage-rights",
        },
        {
          text: "URL Information",
          icon: "mdi-web",
          to: "/docs/url",
        },
        {
          text: "Available Endpoints",
          icon: "mdi-transit-connection-variant",
          to: "/docs/endpoints",
        },
        {
          text: "Basic Fetching Tutorial",
          icon: "mdi-school",
          to: "/docs/fetching",
        },
      ],
    };
  },
};
</script>
