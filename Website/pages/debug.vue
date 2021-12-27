<template>
  <div>
    <!--   Top Section // "Sections" Card   -->
    <v-card max-width="600px" class="rounded-lg">
      <v-card-title style="padding-bottom: 0">Debug Information</v-card-title>
      <v-card-text style="text-align: left;">
        <!--   Gather Browser Information   -->
        <span><b>Browser Information:</b></span><br>
        <span>Browser: {{ device._parsed.name }}</span><br>
        <span>Browser Vendor: {{ device._parsed.vendor }}</span><br>
        <span>Version: {{ device._parsed.version }}</span><br>
        <span>Operating System: {{ device._parsed.os }}</span><br>
        <span>Operating System Version: {{ device._parsed.os_version }}</span><br>
        <span>Device Type: {{ device._parsed.category }}</span><br>
      </v-card-text>
      <v-card-actions>
          <v-spacer />
          <v-btn><v-icon small style="margin-right: 0.25em;">mdi-content-copy</v-icon>Copy</v-btn>
      </v-card-actions>
    </v-card>
  </div>
</template>

<script>
export default {
    data() {
        return {
            device: this.$ua,
        }
    }
}
</script>