<template>
  <div>
    <!--   Top Section // "Sections" Card   -->
    <v-card max-width="600px" class="rounded-lg">
      <v-card-title style="padding-bottom: 0">Debug Information</v-card-title>
      <v-card-text style="text-align: left">
        <!--   Gather Browser Information   -->
        <span><b>Browser Information:</b></span
        ><br />
        <span>Browser: {{ device._parsed.name }}</span
        ><br />
        <span>Browser Vendor: {{ device._parsed.vendor }}</span
        ><br />
        <span>Version: {{ device._parsed.version }}</span
        ><br />
        <span>Operating System: {{ device._parsed.os }}</span
        ><br />
        <span>Operating System Version: {{ device._parsed.os_version }}</span
        ><br />
        <span>Device Type: {{ device._parsed.category }}</span
        ><br /><br />
        <!--   Gather Extension Information   -->
        <span><b>Installed Extension Information:</b></span
        ><br />
        <span
          >Extension Version:
          <span id="extension-version">Waiting For Extension...</span></span
        ><br />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn @click="copy()">
          <v-icon small style="margin-right: 0.25em">mdi-content-copy</v-icon
          >Copy
        </v-btn>
      </v-card-actions>
    </v-card>
  </div>
</template>

<script>
export default {
  transition(to) {
    return to.name == "debug" ? "swoop-in" : "swoop-out";
  },
  data() {
    return {
      device: this.$ua,
    };
  },

  methods: {
    copy() {
      const toCopy = `\`\`\`
Browser Information:
Browser: ${this.device._parsed.name}
Browser Vendor: ${this.device._parsed.vendor}
Version: ${this.device._parsed.version}
Operating System: ${this.device._parsed.os}
Operating System Version: ${this.device._parsed.os_version}
Device Type: ${this.device._parsed.category}

Installed Extension Information:
Extension Version: ${document.getElementById("extension-version").innerHTML}
\`\`\``;

      navigator.clipboard.writeText(toCopy);
    },
  },
};
</script>
