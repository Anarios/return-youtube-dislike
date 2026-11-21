<template>
  <div class="width-constraint help-content">
    <h1 class="title-text pt-12">
      {{ t("$vuetify.help.title") }}
    </h1>
    <ol class="ps-6 pe-0" :class="isRtl ? 'text-right' : 'text-left'" style="line-height: 3rem; color: #aaa">
      <li>
        {{ t("$vuetify.help.bullet1") }}
        <code dir="ltr" style="color: #eee">
          <b>{{ version }}</b>
        </code>
        {{ t("$vuetify.help.bullet11") }}
      </li>
      <li>
        {{ t("$vuetify.help.bullet2") }}
      </li>
      <li>
        {{ t("$vuetify.help.bullet3") }}
        <a
          dir="ltr"
          class="px-2 py-1"
          style="background: #222; border-radius: 0.25rem"
          href="https://returnyoutubedislikeapi.com/votes?videoId=QOFEgexls14"
        >
          https://returnyoutubedislikeapi.com/votes?videoId=QOFEgexls14
        </a>
        , <br />
        {{ t("$vuetify.help.bullet31") }}
        <br />
        <span dir="ltr" style="color: #eee">
          {"id":"QOFEgexls14", "dateCreated":"2021-12-15T16:54:12.250813Z", "likes":2907, "dislikes":215,
          "rating":4.725641025641026, "viewCount":28222, "deleted":false}
        </span>
      </li>
      <li>
        {{ t("$vuetify.help.bullet4") }}
        <code dir="ltr">#bugs-and-problems</code>
        {{ t("$vuetify.help.bullet41") }}
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
          <v-icon :icon="discordIcon" size="1rem" style="margin-right: 0.5em" />
          {{ t("$vuetify.links.discord") }}
        </v-btn>
        <ol class="ps-6 pe-0" type="a">
          <li>
            {{ t("$vuetify.help.bullet4a") }}
            <v-btn
              class="mainAltButton"
              style="
                height: auto;
                min-height: 1.5rem;
                padding-top: 0.25rem;
                padding-bottom: 0.25rem;
                font-size: 0.75rem;
                text-transform: none !important;
                padding-left: 0.5rem !important;
                padding-right: 0.25rem !important;
              "
              target="_blank"
              @click="copyToClipboard(platform)"
            >
              <v-icon size=".75rem" color="primary" style="margin-right: 0.5em">mdi-content-copy</v-icon>
              <span style="color: #f44; white-space: nowrap"> {{ t("$vuetify.help.detected") }} </span>
              &nbsp;
              <span dir="ltr">{{ platform }}</span>
            </v-btn>
          </li>

          <li style="position: relative; width: 100%">
            {{ t("$vuetify.help.bullet4b") }}
            <code dir="ltr">F12</code>
            {{ t("$vuetify.help.bullet4b1") }}

            <img
              loading="eager"
              width="100%"
              style="border-radius: 1rem; border: 2px solid #333"
              src="/ui/troubleshooting.webp"
              :alt="t('$vuetify.help.altExampleScreenshot')"
            />
          </li>

          <li>
            {{ t("$vuetify.help.bullet4c") }}
            <br />
            {{ t("$vuetify.help.bullet4c1") }}
            <br />
            <code dir="ltr">about:addons</code>
            {{ t("$vuetify.help.firefox") }}
            <br />
            <code dir="ltr">chrome://extensions</code>
            {{ t("$vuetify.help.chrome") }}
          </li>
        </ol>
      </li>
    </ol>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useLocale } from "vuetify";
import { version as extensionVersion } from "../../package.json";
import { discordIcon } from "../utils/icons";

const { t, isRtl } = useLocale();
const userAgent = useUserAgent();
const platform = computed(
  () => `${userAgent.value.os} ${userAgent.value.os_version}, ${userAgent.value.name} ${userAgent.value.version}`,
);
const version = ref(extensionVersion.replace("-", "."));
const discordLink = "https://discord.gg/mYnESY4Md5";

onMounted(async () => {
  try {
    const response = await fetch("https://raw.githubusercontent.com/Anarios/return-youtube-dislike/main/package.json");
    if (response.ok) {
      const current = await response.json();
      if (typeof current.version === "string" && current.version) version.value = current.version.replace("-", ".");
    }
  } catch {
    // Keep the extension version from the website build if the lookup fails.
  }
});

function copyToClipboard(text) {
  navigator.clipboard.writeText("```" + text + "```");
}
</script>

<style scoped>
.help-content ol[type="a"] {
  list-style-type: lower-alpha;
}

.help-content {
  max-width: 100%;
  overflow-wrap: anywhere;
}

.help-content .v-btn {
  max-width: 100%;
}

.help-content .v-btn :deep(.v-btn__content) {
  white-space: normal;
}
</style>
