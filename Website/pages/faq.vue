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
          question: "Where does extension get data?",
          answer: "Combination of GoogleAPI data and scraped data. We save all available data to our DB for it to be available after google shuts down dislike counts in their API."
        },
        { 
          question: "Video dislike count doesn't update",
          answer: "Right now video dislikes are cached, and arent updated very frequenly. Once in 2-3 days, not more often Yeah, it's not ideal, but it is what it is. Working on improving how often we can update  them"
        },
        { 
          question: "How does this work?",
          answer: "The extension collects the video id of the video you are watching, fetches the dislike (and other fields like views, likes etc) using our API, if this is the first time the video was fetched by our API, it will use the YouTube API to get the data, then stores the data in a database for caching (cached for around 2-3 days) and archiving purposes and returns it to you. The extension then displays the dislikes to you."
        },
        { 
          question: "What will happen after the YouTube API stops returning the dislike count?",
          answer: "The backend will switch to using a combination of archived dislike stats, estimates extrapolated from extension user data and estimates based on view/like ratios for videos whose dislikes weren't archived and for outdated dislike archives."
        },
      ],
    }),
  
  }
</script>