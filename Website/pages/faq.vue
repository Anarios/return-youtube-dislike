<template>
  <div style="width: 90vw" class="mx-auto">
    <h1 class="title-text">Frequently Asked Questions</h1>
    <p style="color: #999; margin-top: 0.5rem; margin-bottom: 1.5rem">
      Still have questions? Feel free to join our Discord!
    </p>

    <v-expansion-panels class="col-xs-12 col-sm-11 col-md-9 col-lg-8">
      <v-expansion-panel v-for="(item, i) in items" :key="i">
        <v-expansion-panel-header>
          {{ item.question }}
        </v-expansion-panel-header>
        <v-expansion-panel-content class="text-left">
          <hr style="border-color: #444" />
          <br />
          <span v-html="item.answer" />
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
          "A combination of archived data from before the official YouTube dislike API shut down, and extrapolated extension user behavior.",
      },
      {
        question: "Why isn't the dislike count updating?",
        answer:
          "Right now video dislikes are cached and they aren't updated very frequently. It varies depending on a video's popularity but can take anywhere between a few hours and a few days to update.",
      },
      {
        question: "Why is the dislike count on my videos inaccurate?",
        answer:
          "Extrapolated data tends to get better with the increase in diversity and the quantity of voters. \nTo ensure and increase the accuracy of the extrapolated vote data for your videos, you can encourage your viewers to use this extension (or any app that submits votes to returnyoutubedislikeapi.com) ",
      },
      {
        question: "How does this work?",
        answer:
          "The extension collects the video ID of the video you are watching, fetches the dislike (and other fields like views, likes etc) using our API. The extension then displays the dislike count and ratio on the page. If you like or dislike a video, that is recorded and sent to the database so an accurate dislike count can be extrapolated.",
      },
      {
        question: "Can I share my dislike count with you?",

        answer:
          "Coming soon. We are looking into using Oauth or a different read only API with a limited scope so creators can share their dislike counts verifiability. ",
      },
      {
        question:
          "What data do you collect and how is it treated?",
        answer:
          "The extension only collects data that is strictly necessary for it to function properly, such as IP address or ID of the video you're watching. None of your data will ever be sold to 3rd parties. If you would like to know more about how we handle security and privacy check out our <a href='https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/SECURITY-FAQ.md'>security FAQ</a>.",
      },
      {
        question: "How does the API/Backend work?",
        answer: "The backend is using archived data from when the youtube api was still returning the dislike count, extension users like/discount count and extrapolation. In the near future we will be allowing content creators to submit their dislike count easily and safely and we will be adding ArchiveTeam's archived data (4.56 billion videos) into our current database. <a href='https://www.youtube.com/watch?v=GSmmtv-0yYQ'>You can also view a video on the topic.</a>",
      },
      {
        question: "Why does the dislike count show 'DISLIKES DISABLED'?",
        answer: "At the time of writing we aren't showing dislikes for videos that disabled their likes and dislikes count. The extension displays 'DISLIKES DISABLED' for these videos. We will be showing dislikes on all videos soon, this is just a temporary workaround so people don't think the extension is broken (which isn't working well). Sometimes a recently uploaded video might show 'DISLIKES DISABLED' even if the creator hasn't disabled it, this is due to how we are detecting if dislikes are disabled, it should go away in a few hours or by liking or disliking the video and refreshing the page (hopefully).",
      },
    ],
  }),
};
</script>
