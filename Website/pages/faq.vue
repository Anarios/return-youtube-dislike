<template>
  <div>

    <h1 class="title-text" >Frequently Asked Questions</h1>
    <p style="color: #999; margin-top: .5rem; margin-bottom: 1.5rem;">Still have questions? Feel free to join our Discord!</p>

    <v-expansion-panels class="col-xs-12 col-sm-11 col-md-9 col-lg-7">
      <v-expansion-panel v-for="(item, i) in items" :key="i" >
        <v-expansion-panel-header>
          {{ item.question }}
        </v-expansion-panel-header>
        <v-expansion-panel-content class="text-left">
          <hr style="border-color: #444;">
          <br>
          {{ item.answer }}
        </v-expansion-panel-content>
      </v-expansion-panel>
    </v-expansion-panels>

  </div>
</template>

<script>
  export default {
    transition(to, from) {
      if (!from) return 'swoop-in'
      let routes = ['index', 'install', 'faq', 'donate', 'links']
      if (routes.indexOf(to.name) < 0) return 'swoop-out'
      if (routes.indexOf(from.name) < 0) return 'swoop-in'
      return routes.indexOf(to.name) > routes.indexOf(from.name) ? 'swoop-left' : 'swoop-right'
    },
    data: () => ({
      items: [
        { 
          question: "Where does the extension get its data?",
          answer: "A combination of Google's API data and scraped data. We save all available data to our DB so it can be made available after Google removes dislike counts from their API."
        },
        { 
          question: "Why isn't the dislike count updating?",
          answer: "Right now video dislikes are cached and they aren't updated very frequently. Currently this is set to update once every 2–3 days.  This isn't ideal and we are working on improving how often we can update them."
        },
        { 
          question: "How does this work?",
          answer: "The extension collects the video ID of the video you are watching, fetches the dislike (and other fields like views, likes etc) using our API, if this is the first time the video was fetched by our API, it will use the YouTube API to get the data, then store it in the database for caching (cached for around 2-3 days) and archiving purposes, and returns it to you. The extension then displays the dislike count and ratio on the page."
        },
        { 
          question: "What will happen after the YouTube API stops returning the dislike count?",
          answer: "The backend will switch to using a combination of archived dislike stats, estimates extrapolated from extension user data, and estimates based on view/like ratios for videos whose dislikes weren't archived as well as outdated dislike count archives."
        },
      ],
    }),
  
  }
</script>
