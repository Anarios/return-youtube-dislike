<template>
  <div class="debug-shell">
    <v-stepper v-model="progress" class="debug-stepper mt-12" border :mobile-breakpoint="960">
      <v-stepper-header>
        <v-stepper-item color="primary" :value="1" :complete="steps.one" title="Setup" />
        <v-divider />
        <v-stepper-item color="primary" :value="2" :complete="steps.two" title="Extension Status" />
        <v-divider />
        <v-stepper-item color="primary" :value="3" :complete="steps.three" title="Server Connection" />
        <v-divider />
        <v-stepper-item color="primary" :value="4" :complete="steps.four" title="Browser Support" />
        <v-divider />
        <v-stepper-item color="primary" :value="5" :complete="steps.five" title="Report" />
      </v-stepper-header>

      <v-stepper-window :model-value="progress">
        <v-stepper-window-item :value="1">
          <h1>Getting Ready...</h1>
          <v-progress-circular indeterminate size="50" width="5" color="primary" />
        </v-stepper-window-item>

        <v-stepper-window-item :value="2">
          <h1>Ensuring the Extension is Running...</h1>
          <v-progress-circular indeterminate size="50" width="5" color="primary" />
        </v-stepper-window-item>

        <v-stepper-window-item :value="3">
          <h1>Testing Server Connection...</h1>
          <v-progress-circular indeterminate size="50" width="5" color="primary" />
        </v-stepper-window-item>

        <v-stepper-window-item :value="4">
          <h1>Checking Browser Information...</h1>
          <v-progress-circular indeterminate size="50" width="5" color="primary" />
        </v-stepper-window-item>

        <v-stepper-window-item :value="5" style="text-align: left">
          <div class="reportHeader">
            <h1>Browser</h1>
            <v-divider style="transform: translateY(1.5em)" />
          </div>
          <v-alert density="compact" variant="outlined" :type="notices.browser.type" :icon="false">{{
            notices.browser.text
          }}</v-alert>
          <span><b>BROWSER-</b> {{ userInformation.browser.name }}</span
          ><br />
          <span><b>VENDOR-</b> {{ userInformation.browser.vendor }} </span><br />
          <span><b>VERSION-</b> {{ userInformation.browser.version }}</span
          ><br />

          <div class="reportHeader">
            <h1>System</h1>
            <v-divider style="transform: translateY(1.5em)" />
          </div>
          <v-alert density="compact" variant="outlined" :type="notices.system.type" :icon="false">{{
            notices.system.text
          }}</v-alert>
          <span><b>OS-</b> {{ userInformation.system.os }}</span
          ><br />
          <span><b>VERSION-</b> {{ userInformation.system.version }} </span><br />
          <span><b>TYPE-</b> {{ userInformation.system.type }}</span
          ><br />

          <div class="reportHeader">
            <h1>Extension</h1>
            <v-divider style="transform: translateY(1.5em)" />
          </div>
          <v-alert density="compact" variant="outlined" :type="notices.extension.type" :icon="false">{{
            notices.extension.text
          }}</v-alert>
          <span
            ><b>LATEST EXTENSION VERSION-</b>
            {{ userInformation.extension.latestExtensionVersion || "Failed to lookup data" }}</span
          ><br />
          <span
            ><b>SERVER CONNECTION-</b>
            {{ userInformation.extension.serverConnection ? "Working" : "Failed to connect" }}</span
          ><br />
        </v-stepper-window-item>
      </v-stepper-window>
    </v-stepper>
  </div>
</template>

<script setup>
const userAgent = useUserAgent();
const stepTime = 2500;
const supportedBrowsers = ["Firefox", "Chrome", "Brave", "Edge", "Opera"];
const progress = ref(1);
const steps = reactive({ one: false, two: false, three: false, four: false, five: false });
const extension = reactive({ serverConnection: null, latestExtensionVersion: null });
const userInformation = computed(() => ({
  browser: {
    name: userAgent.value.name,
    vendor: userAgent.value.vendor,
    version: userAgent.value.version,
  },
  system: {
    os: userAgent.value.os,
    version: userAgent.value.os_version,
    type: userAgent.value.category,
  },
  extension,
}));
const notices = reactive({
  system: { text: null, type: undefined },
  browser: { text: null, type: undefined },
  extension: { text: null, type: undefined },
});
const timers = [];
let controller;
let connectionCheck;

onMounted(() => {
  controller = new AbortController();

  timers.push(
    setTimeout(() => {
      $fetch(
        "https://raw.githubusercontent.com/Anarios/return-youtube-dislike/main/Extensions/combined/manifest-chrome.json",
        { responseType: "json", signal: controller.signal, timeout: 10000 },
      )
        .then((result) => {
          extension.latestExtensionVersion = result.version;
        })
        .catch(() => {
          extension.latestExtensionVersion = null;
        });
      progress.value++;
      steps.one = true;
    }, stepTime),
  );

  timers.push(
    setTimeout(() => {
      progress.value++;
      steps.two = true;
    }, stepTime * 2),
  );

  timers.push(
    setTimeout(() => {
      connectionCheck = $fetch("https://returnyoutubedislikeapi.com/votes?videoId=QOFEgexls14", {
        signal: controller.signal,
        timeout: 10000,
      })
        .then(() => {
          extension.serverConnection = true;
        })
        .catch(() => {
          extension.serverConnection = false;
        });
      progress.value++;
      steps.three = true;
    }, stepTime * 3),
  );

  timers.push(
    setTimeout(async () => {
      await connectionCheck;
      if (controller.signal.aborted) return;
      progress.value++;
      steps.four = true;

      notices.extension.text =
        "We are unable to automatically check that your extension is up to date. Please check that the number below matches your extension version.";
      notices.extension.type = "warning";
      if (extension.serverConnection !== true) {
        notices.extension.text = "Failed to connect to the server!";
        notices.extension.type = "error";
      }

      notices.system.text = `${userInformation.value.system.os} is supported!`;
      notices.system.type = "success";
      if (userInformation.value.system.type !== "pc") {
        notices.system.text = `"${userInformation.value.system.type}" may not be a supported device type!`;
        notices.system.type = "warning";
      }

      notices.browser.text = `${userInformation.value.browser.name} ${userInformation.value.browser.version} is supported!`;
      notices.browser.type = "success";
      if (!supportedBrowsers.includes(userInformation.value.browser.name)) {
        notices.browser.text = `${userInformation.value.browser.name} is not a supported browser! You may continue to use the extension, but we don't provide official support.`;
        notices.browser.type = "warning";
      }
    }, stepTime * 4),
  );
});

onBeforeUnmount(() => {
  timers.forEach(clearTimeout);
  controller?.abort();
});
</script>

<style scoped>
.debug-shell {
  width: 100%;
  min-width: 0;
}

.debug-stepper {
  position: relative;
  width: 800px;
  max-width: 100%;
  margin-inline: auto;
  background: #303030;
}

:deep(.v-stepper-window) {
  margin: 24px 24px 16px;
}

:deep(.v-stepper-item--complete) {
  opacity: 1;
}

:deep(.v-stepper-item__avatar .v-icon) {
  font-size: 18px;
}

:deep(.v-alert) {
  margin-bottom: 16px;
  padding: 8px;
  font-size: 16px;
  line-height: 24px;
}

@media (max-width: 959px) {
  :deep(.v-stepper-item) {
    flex: 0 1 72px;
    justify-content: center;
    min-width: 24px;
    padding: 24px 0;
  }

  :deep(.v-stepper-header .v-divider) {
    flex: 1 1 auto;
    width: auto;
    min-width: 0;
  }

  :deep(.v-stepper-item__content) {
    display: none;
  }

  :deep(.v-stepper-item__avatar) {
    margin-inline-end: 0;
  }
}

.reportHeader {
  display: flex;
  margin-top: 1em;
}
</style>
