<template>
  <div class="width-constraint">
    <h1 class="title-text pt-12">Troubleshooting</h1>
    <ol style="line-height: 3rem; color: #aaa" class="text-left">
      <li>
        Make sure you have latest version of extension installed,
        <code style="color: #eee">
          <b>{{ version }}</b></code
        >
        right now
      </li>
      <li>
        Try removing extension and installing it again, then restarting the
        browser (all active windows, not just one tab).
      </li>
      <li>
        Make sure that this link opens:
        <a
          class="px-2 py-1"
          style="background: #222; border-radius: 0.25rem"
          href="https://returnyoutubedislikeapi.com/votes?videoId=QOFEgexls14"
        >
          https://returnyoutubedislikeapi.com/votes?videoId=QOFEgexls14
        </a>
        , <br />
        you should see plain text: <br />
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
            color: #aaa;
            padding-left: 0.25rem !important;
            padding-right: 0.5rem !important;
          "
          :href="discordLink"
          target="_blank"
        >
          <v-icon size="1rem" style="margin-right: 0.5em">mdi-discord</v-icon>
          Discord
        </v-btn>
        <ol type="a">
          <li>
            Tell us your <b>Operating System</b>, <b>Browser Name</b> and
            <b>Browser Version</b>.
            <v-btn
              class="mainAltButton"
              style="
                height: 1.5rem;
                font-size: 0.75rem;
                text-transform: none !important;
                padding-left: 0.5rem !important;
                padding-right: 0.25rem !important;
              "
              target="_blank"
              @click="copyToClipboard(platform)"
            >
              <v-icon size=".75rem" color="primary" style="margin-right: 0.5em"
                >mdi-content-copy</v-icon
              >
              <span style="color: #f44"> Detected: </span>
              &nbsp;
              {{ platform }}
            </v-btn>
          </li>

          <li style="position: relative; width: 100%">
            Take screenshot of page with problem (i.e. youtube video page) with
            console open (press <code>F12</code>) - example screenshot below.
            <img
              loading="eager"
              width="100%"
              style="border-radius: 1rem; border: 2px solid #333"
              src="ui/troubleshooting.png"
              alt="example-screenshot"
            />
          </li>

          <li>
            Take screenshot of extensions page of your browser with extension
            installed. <br />
            To see extensions put this into address bar:
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
    let routes = ["index", "install", "docs", "help", "faq", "donate", "links"];
    if (routes.indexOf(to.name) < 0) return "swoop-out";
    if (routes.indexOf(from.name) < 0) return "swoop-in";
    return routes.indexOf(to.name) > routes.indexOf(from.name)
      ? "swoop-left"
      : "swoop-right";
  },
  data() {
    return {
      platform:
        this.$ua._parsed.os +
        " " +
        this.$ua._parsed.os_version +
        ", " +
        this.$ua._parsed.name +
        " " +
        this.$ua._parsed.version,
      version: "loading",
      discordLink: "https://discord.gg/mYnESY4Md5",
    };
  },
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
  methods: {
    copyToClipboard(text) {
      navigator.clipboard.writeText("```" + text + "```");
    },
  },
};
</script>
