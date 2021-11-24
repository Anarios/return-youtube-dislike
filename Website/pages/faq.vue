<template>
  <div>
    
    <section style="position: relative;">
      

      <div class="center">
        <center>

          <h1 style="font-size: 3em; margin-bottom: 0em;">Frequently Asked Questions</h1>
          <p style="color: #999; margin-bottom: 3em;">Still have questions? Feel free to join our Discord!</p>

          <v-expansion-panels focusable>
            <v-expansion-panel v-for="(item, i) in items" :key="i" style="width: 50vw; min-width: 300px;">
              <v-expansion-panel-header v-text="item.question">Loading</v-expansion-panel-header>
              <v-expansion-panel-content v-html="item.answer" style="text-align: left; padding: 0.5em;">Loading</v-expansion-panel-content>
            </v-expansion-panel>
          </v-expansion-panels>

        </center>
      </div>


    </section>

  </div>
</template>

<script>
  export default {
    data: () => ({
      items: [
        { 
          question: "Why is it not in chrome store yet?",
          answer: "Chrome extension appoval process takes some time. As soon as it's available in the store - We'll update the site "
        },
        { 
          question: "Is it dangerous?/Is it a virus?",
          answer: "While there is some trust involved in installing an extension from 3-rd party source - you can see all permissions requested by the extension before installing it. This extension only asks for access to youtube.com page "
        },
        { 
          question: "I downvoted a video, and downvotes number didn't change",
          answer: "Currently we're using YouTube API to get dislikes count. It may take some time for data to be updated. YouTube might freeze dislike counts as well. We're working on a solution for this "
        },
      ],
    }),
  
  }
</script>