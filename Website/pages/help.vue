<template>
  <div>
    <h1 class="title-text pt-12">Troubleshooting</h1>
    <ol
      class="col-xs-12 col-sm-11 col-md-9 col-lg-7 q-mx-auto text-left"
      style="line-height: 3rem; color: #aaa"
    >
      <li>
        Make sure you have latest version of extension installed,
        <code
          ><b>{{ version }}</b></code
        >
        right now
      </li>
      <li>
        Try removing extension and installing it again, then restarting the
        browser (all active windows, not just one tab).
      </li>
      <li>
        Make sure that this link opens:
        <a href="https://returnyoutubedislikeapi.com/votes?videoId=QOFEgexls14">
          https://returnyoutubedislikeapi.com/votes?videoId=QOFEgexls14
        </a>
        , you should see plain text: <br />
        <span style="color: #eee">
          {"id":"QOFEgexls14", "dateCreated":"2021-12-15T16:54:12.250813Z",
          "likes":2907, "dislikes":215, "rating":4.725641025641026,
          "viewCount":28222, "deleted":false}
        </span>
      </li>
      <li>
        If nothing of above helps - report your problem in
        <code>#bugs-and-problems</code> in our
        <v-btn
          class="mainAltButton"
          style="
            font-size: 0.5rem;
            height: 1.5rem;
            padding-left: 0.25rem !important;
          "
          :href="discordLink"
          target="_blank"
        >
          <v-icon style="margin-right: 0.5em">mdi-discord</v-icon>
          Discord
        </v-btn>
        <ol type="a">
          <li>
            Tell us your <b>Operating System</b>, <b>Browser Name</b> and
            <b>Browser Version</b>.
          </li>

          <li style="position: relative; width: 100%">
            Take screenshot of page with problem (i.e. youtube video page) with
            console open (press <code>F12</code>) - example screenshot below.
            <img
              width="100%"
              style="border-radius: 1rem; border: 2px solid #333"
              src="ui/troubleshooting.png"
              alt="example-screenshot"
            />
          </li>

          <li>
            Take screenshot of extensions page of your browser with extension
            installed. <br />
            To see extensions put this into adress bar:
            <br />
            <code>about:addons</code> for Firefox
            <br />
            <code>chrome://extensions</code> for Chrome, Edge, Brave, Opera,
            Vivaldi
          </li>
        </ol>
      </li>
    </ol>
  </div>
</template>

<script>
export default {
  transition(to, from) {
    if (!from) return "swoop-in";
    let routes = ["index", "install", "help", "faq", "donate", "links"];
    if (routes.indexOf(to.name) < 0) return "swoop-out";
    if (routes.indexOf(from.name) < 0) return "swoop-in";
    return routes.indexOf(to.name) > routes.indexOf(from.name)
      ? "swoop-left"
      : "swoop-right";
  },
  data: () => ({
    version: "2.0.0.3",
    discordLink: "https://discord.gg/mYnESY4Md5",
  }),
  mounted() {
    fetch(
      "https://raw.githubusercontent.com/Anarios/return-youtube-dislike/main/Extensions/combined/manifest-chrome.json"
    )
      .then((response) => response.json())
      .then((json) => {
        this.version = json.version;
      });
    // .catch(console.error);
  },
};
</script>
