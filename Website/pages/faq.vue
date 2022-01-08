<template>
  <div>
    <h1 class="title-text">Frequently Asked Questions</h1>
    <p style="color: #999; margin-top: 0.5rem; margin-bottom: 1.5rem">
      Still have questions? Feel free to join our Discord!
    </p>

    <v-expansion-panels class="col-xs-12 col-sm-11 col-md-9 col-lg-7">
      <v-expansion-panel v-for="(item, i) in items" :key="i">
        <v-expansion-panel-header>
          {{ item.question }}
        </v-expansion-panel-header>
        <v-expansion-panel-content class="text-left">
          <hr style="border-color: #444" />
          <br />
          {{ item.answer }}
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
  data: () => ({
    items: [
      {
        question: "Where does the extension get its data?",
        answer:
          "A combination of archived data from before the offical YouTube dislike API shut down, and extrapolated extension user behavior.",
      },
      {
        question: "Why isn't the dislike count updating?",
        answer:
          "Right now video dislikes are cached and they aren't updated very frequently. It varies depending on a video's popularity but can take anywhere between a few hours and a few days to update.",
      },
      {
        question: "How does this work?",
        answer:
          "The extension collects the video ID of the video you are watching, fetches the dislike (and other fields like views, likes etc) using our API. The extension then displays the dislike count and ratio on the page. If you like or dislike a video, that is recorded and sent to the database so an accurate dislike count can be extrapolated.",
      },
      {

        question:"Can I share my dislike count with you?",

        answer:
          "Coming soon. We are looking into using Oauth or a different read only API with a limited scope so creators can share their dislike counts verifiability. ",
      },
    ],
  }),
};
</script>
