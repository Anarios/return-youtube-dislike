<template>
  <div>
    

    <h1 style="font-size: 3em; margin-bottom: 0em;">Frequently Asked Questions</h1>
    <p style="color: #999; margin-bottom: 3em;">Still have questions? Feel free to join our Discord!</p>

    <v-expansion-panels focusable>
      <v-expansion-panel v-for="(item, i) in items" :key="i" style="width: 50vw; min-width: 300px;">
        <v-expansion-panel-header v-text="item.question">Loading</v-expansion-panel-header>
        <v-expansion-panel-content v-html="item.answer" style="text-align: left; padding: 0.5em;">Loading</v-expansion-panel-content>
      </v-expansion-panel>
    </v-expansion-panels>


  </div>
</template>

<script>
  export default {
    data: () => ({
      items: [
        { 
          question: "Where does the extension get its data?",
          answer: "A combination of Google's API data and scraped data. We save all available data to our DB so it can be made available after Google removes dislike counts from their API."
        },
        { 
          question: "Why isn't the dislike count updating?",
          answer: "Right now video dislikes are cached and they arent updated very frequenly. Currently this is set to update once every 2–3 days.  This isn't ideal and we are working on improving how often we can update them"
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
