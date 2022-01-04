<template>
  <div>
    <!--   Top Section // "Sections" Card   -->
    <v-card max-width="600px" class="rounded-lg">
      <v-card-title style="padding-bottom: 0">Sections</v-card-title>
      <v-list>
        <!--   Dynamically Generate Links From Below   -->
        <v-list-item v-for="(item, i) in links" :key="i" router :to="item.to">
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
      class="rounded-lg"
      style="margin: 1em; padding: 0.75em; text-align: left"
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
