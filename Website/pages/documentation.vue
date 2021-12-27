<template>
  <div>

    <!--   Top Section // "Sections" Card   -->
    <v-card max-width="600px" class="rounded-lg">
      <v-card-title style="padding-bottom: 0;">Sections</v-card-title>
      <v-list>
        <!--   Dynamically Generate Links From Below   -->
        <v-list-item v-for="(item, i) in links" :key="i" router :to=item.to>
          <v-list-item-icon>
            <v-icon v-text="item.icon" />
          </v-list-item-icon>
          <v-list-item-title style="text-align: left;">
            <v-list-item-title v-text="item.text" />
          </v-list-item-title>
        </v-list-item>
      </v-list>
    </v-card>

    <!--   Child Pages // Card   -->
    <v-card max-width="600px" class="rounded-lg" style="margin: 1em; padding: 0.75em; text-align: left;">
      <NuxtChild />
    </v-card>


  </div>
</template>

<script>
  export default {
    data() {
      return {
        //---   Links To Generate Above    ---//
        links: [{
            text: 'API Usage Rights',
            icon: 'mdi-book-open-variant',
            to: 'documentation/usage-rights'
          },
          {
            text: 'API URL Information',
            icon: 'mdi-web',
            to: 'documentation/url'
          },
          {
            text: 'Available Endpoints',
            icon: 'mdi-transit-connection-variant',
            to: 'documentation/endpoints'
          },
          {
            text: 'Basic Fetching Tutorial',
            icon: 'mdi-school',
            to: 'documentation/fetching'
          },
        ]
      }
    }
  }

</script>
