<template>
  <div>
    <v-stepper :value="progress" class="mt-12" outlined max-width="800px">
      <v-stepper-header>
        <v-stepper-step step="1" :complete="steps.one">Setup</v-stepper-step>
        <v-divider />
        <v-stepper-step step="2" :complete="steps.two"
          >Extension Status</v-stepper-step
        >
        <v-divider />
        <v-stepper-step step="3" :complete="steps.three"
          >Server Connection</v-stepper-step
        >
        <v-divider />
        <v-stepper-step step="4" :complete="steps.four"
          >Browser Support</v-stepper-step
        >
        <v-divider />
        <v-stepper-step step="5" :complete="steps.five">Report</v-stepper-step>
      </v-stepper-header>

      <v-stepper-content step="1">
        <h1>Getting Ready...</h1>
        <v-progress-circular
          indeterminate
          size="50"
          width="5"
          color="primary"
        />
      </v-stepper-content>

      <v-stepper-content step="2">
        <h1>Ensuring the Extension is Running...</h1>
        <v-progress-circular
          indeterminate
          size="50"
          width="5"
          color="primary"
        />
      </v-stepper-content>

      <v-stepper-content step="3">
        <h1>Testing Server Connection...</h1>
        <v-progress-circular
          indeterminate
          size="50"
          width="5"
          color="primary"
        />
      </v-stepper-content>

      <v-stepper-content step="4">
        <h1>Checking Browser Information...</h1>
        <v-progress-circular
          indeterminate
          size="50"
          width="5"
          color="primary"
        />
      </v-stepper-content>

      <v-stepper-content step="5" style="text-align: left">
        <div class="reportHeader">
          <h1>Browser</h1>
          <v-divider style="transform: translateY(1.5em)" />
        </div>
        <v-alert
          dense
          outlined
          :type="notices.browser.type"
          v-text="notices.browser.text"
        />
        <span><b>BROWSER-</b> {{ userInformation.browser.name }}</span
        ><br />
        <span><b>VENDOR-</b> {{ userInformation.browser.vendor }} </span><br />
        <span><b>VERSION-</b> {{ userInformation.browser.version }}</span
        ><br />

        <div class="reportHeader">
          <h1>System</h1>
          <v-divider style="transform: translateY(1.5em)" />
        </div>
        <v-alert
          dense
          outlined
          :type="notices.system.type"
          v-text="notices.system.text"
        />
        <span><b>OS-</b> {{ userInformation.system.os }}</span
        ><br />
        <span><b>VERSION-</b> {{ userInformation.system.version }} </span><br />
        <span><b>TYPE-</b> {{ userInformation.system.type }}</span
        ><br />

        <div class="reportHeader">
          <h1>Extension</h1>
          <v-divider style="transform: translateY(1.5em)" />
        </div>
        <v-alert
          dense
          outlined
          :type="notices.extension.type"
          v-text="notices.extension.text"
        />
        <span
          ><b>LATEST EXTENSION VERSION-</b>
          {{
            userInformation.extension.latestExtensionVersion ||
            "Failed to lookup data"
          }}</span
        ><br />
        <span
          ><b>SERVER CONNECTION-</b>
          {{
            userInformation.extension.serverConnection
              ? "Working"
              : "Failed to connect"
          }}</span
        ><br />
      </v-stepper-content>
    </v-stepper>
  </div>
</template>

<script>
export default {
  data() {
    return {
      stepTime: 2500,
      supportedBrowsers: ["Firefox", "Chrome", "Brave", "Edge", "Opera"],

      progress: 1,
      steps: {
        one: false,
        two: false,
        three: false,
        four: false,
        five: false,
      },

      userInformation: {
        browser: {
          name: this.$ua._parsed.name,
          vendor: this.$ua._parsed.vendor,
          version: this.$ua._parsed.version,
        },
        system: {
          os: this.$ua._parsed.os,
          version: this.$ua._parsed.os_version,
          type: this.$ua._parsed.category,
        },
        extension: {
          serverConnection: null,
          latestExtensionVersion: null,
        },
      },

      notices: {
        system: {
          text: null,
          type: null,
        },
        browser: {
          text: null,
          type: null,
        },
        extension: {
          text: null,
          type: null,
        },
      },
    };
  },

  mounted() {
    //---   Init Stuff   ---//
    setTimeout(() => {
      this.$axios
        .$get(
          "https://raw.githubusercontent.com/Anarios/return-youtube-dislike/main/Extensions/combined/manifest-chrome.json",
        )
        .then((res) => {
          this.userInformation.extension.latestExtensionVersion = res.version;
        });

      this.progress++;
      this.steps.one = true;
    }, this.stepTime);

    //---   Check If Extension Is Running   ---//
    setTimeout(() => {
      this.progress++;
      this.steps.two = true;
    }, this.stepTime * 2);

    //---   Check Server Connection ---//
    setTimeout(() => {
      this.$axios
        .$get("https://returnyoutubedislikeapi.com/votes?videoId=QOFEgexls14")
        .then(() => {
          this.userInformation.extension.serverConnection = true;
        })
        .catch(() => {
          this.userInformation.extension.serverConnection = false;
        });

      this.progress++;
      this.steps.three = true;
    }, this.stepTime * 3);

    setTimeout(() => {
      this.progress++;
      this.steps.four = true;
      //this.steps.five = true;

      //---   Parse Extension Data   ---//
      this.notices.extension.text = `We are unable to automatically check that your extension is up to date. Please check that the number below matches your extension version.`;
      this.notices.extension.type = "warning";

      if (this.userInformation.extension.serverConnection != true) {
        this.notices.extension.text = `Failed to connect to the server!`;
        this.notices.extension.type = "error";
      }

      //---   Parse System Compatibility   ---//
      this.notices.system.text = `${this.userInformation.system.os} is supported!`;
      this.notices.system.type = "success";

      if (this.userInformation.system.type != "pc") {
        this.notices.system.text = `"${this.userInformation.system.type}" may not be a supported device type!`;
        this.notices.system.type = "warning";
      }

      //---   Parse Browser Compatibility   ---//
      this.notices.browser.text = `${this.userInformation.browser.name} ${this.userInformation.browser.version} is supported!`;
      this.notices.browser.type = "success";

      if (!this.supportedBrowsers.includes(this.userInformation.browser.name)) {
        this.notices.browser.text = `${this.userInformation.browser.name} is not a supported browser! You may continue to use the extension, but we don't provide official support.`;
        this.notices.browser.type = "warning";
      }
    }, this.stepTime * 4);
  },
};
</script>

<style scoped>
.reportHeader {
  display: flex;
  margin-top: 1em;
}
</style>
