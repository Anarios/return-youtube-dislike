<template>
  <div class="d-flex flex-column justify-between" style="height: calc(100vh - 10rem)">
    <div class="home-column"></div>

    <div class="home-column">
      <svg id="thumbslogo" class="mb-4" width="150" height="150" viewBox="0 0 24 24" overflow="visible">
        <path
          d="M14.9 3H6c-.9 0-1.6.5-1.9 1.2l-3 7c-.1.3-.1.5-.1.7v2c0 1.1.9 2 2 2h6.3l-.9 4.5c-.1.5 0 1 .4 1.4l1.1 1.1 6.5-6.6c.4-.4.6-.9.6-1.4V5c-.1-1.1-1-2-2.1-2zm7.4 12.8h-2.9c-.4 0-.7-.3-.7-.7V3.9c0-.4.3-.7.7-.7h2.9c.4 0 .7.3.7.7V15c0 .4-.3.8-.7.8z"
        />
        <path id="plarrow" d="m8 12.5 5.1-2.9L8 6.7v5.8z" fill="#fff" stroke="none" />
      </svg>

      <h1 class="title-text">
        {{ t("$vuetify.home.title") }}
      </h1>
      <p class="mb-4" style="color: #999; margin-top: 0">
        {{ t("$vuetify.home.subtitle") }}
      </p>

      <v-btn
        :to="installLink"
        color="primary"
        class="px-6"
        style="font-size: 1.5em; padding: 1em; margin-bottom: 0.5em"
      >
        <v-icon size="36" class="mr-6">mdi-tray-arrow-down</v-icon>
        {{ t("$vuetify.install.name") }}
      </v-btn>

      <br />

      <v-btn class="mainAltButton" :href="githubLink" target="_blank">
        <v-icon style="margin-right: 0.5em">mdi-github</v-icon>
        {{ t("$vuetify.links.github") }}
      </v-btn>

      <v-btn class="mainAltButton" :href="discordLink" target="_blank">
        <v-icon :icon="discordIcon" style="margin-right: 0.5em" />
        {{ t("$vuetify.links.discord") }}
      </v-btn>
    </div>

    <v-spacer />
    <div id="support-ukraine" class="d-flex flex-column items-center py-2">
      <h3 class="mb-2">
        <v-img class="mx-auto" src="/ukraine-flag-xs.webp" width="42px" height="28px"></v-img>
        <a href="https://u24.gov.ua/">
          {{ t("$vuetify.home.ukraine") }}
        </a>
      </h3>
    </div>

    <div id="financiers" class="d-flex flex-column items-center py-8">
      <h3 class="mb-4">
        <v-icon class="mb-2">mdi-heart</v-icon>
        {{ t("$vuetify.home.sponsors") }}
      </h3>
      <v-row class="justify-center mx-auto">
        <p v-for="sponsor in sponsors" :key="sponsor.nameKey" class="sponsor">
          <a :style="sponsor.link ? { cursor: 'pointer' } : { cursor: 'default' }" :href="sponsor.link" rel="sponsored">
            {{ t(`$vuetify.${sponsor.nameKey}`) }}
          </a>
        </p>
      </v-row>
    </div>
  </div>
</template>

<script>
import { useLocale } from "vuetify";
import { discordIcon } from "../utils/icons";

export default {
  setup() {
    const { t } = useLocale();
    return { t, discordIcon };
  },
  data() {
    return {
      installLink: "/install",
      githubLink: "https://github.com/Anarios/return-youtube-dislike",
      discordLink: "https://discord.gg/mYnESY4Md5",
      sponsors: [
        {
          nameKey: "home.becomeSponsor",
          link: "https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008601",
        },
      ],
    };
  },
};
</script>

<style scoped>
.home-column {
  width: 100%;
  flex-basis: 0;
  flex-grow: 1;
  max-width: 100%;
  padding: 12px;
}

.sponsor {
  margin: 1rem;
  height: max-content;
}

@media (max-width: 767px) {
  .sponsor {
    margin: 0.5rem;
    height: max-content;
  }
}

#thumbslogo {
  opacity: 0;
  fill: transparent;
  stroke: #f44;
  transition-property: opacity, transform;
  transform: scale(0) rotate(180deg);
  animation:
    popin 1s 0.3s ease-in-out 1 forwards,
    tap 0.3s 1.7s ease-in-out 1 forwards;
}

#plarrow {
  opacity: 0;
  transform: translateX(-0.25rem);
  transition-property: opacity, transform;
  animation: slidin 0.5s 1.7s ease 1 forwards;
}

@keyframes slidin {
  0% {
    opacity: 0;
    transform: translateX(-0.25rem);
  }
  100% {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes popin {
  0% {
    transform: rotate(180deg) scale(0);
    opacity: 0;
  }
  100% {
    transform: rotate(0deg) scale(1);
    opacity: 1;
  }
}

@keyframes fadein {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

@keyframes tap {
  0% {
    fill: transparent;
    stroke: #f44;
    transform: scale(1);
  }
  25% {
    fill: #f44;
    stroke: none;
    transform: scale(0.85);
  }
  100% {
    fill: #f44;
    stroke: none;
    transform: scale(1);
  }
}

/* reduced-motion animations */
@media (prefers-reduced-motion) {
  #thumbslogo {
    opacity: 1;
    fill: #f44;
    stroke: none;
    transform: none;
    animation: none;
  }

  #thumbsripple {
    opacity: 0;
    transform: none;
    animation: none;
  }

  #plarrow {
    opacity: 0;
    transform: none;
    transition-property: opacity;
    animation: fadein 0.5s 0.5s ease 1 forwards;
  }
}
</style>
