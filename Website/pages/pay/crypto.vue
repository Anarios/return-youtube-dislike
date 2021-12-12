<template>
  <v-container>
    <v-row dense>
      <v-col v-for="card in cards" :key="card.title" :lg="4" :sm="12">
        <v-card height="100%">
          <v-card-title>
            {{ card.title }}
          </v-card-title>
          <v-card-text style="height: 80px">
            {{ card.address }}
          </v-card-text>
          <v-img :src="card.img" :contain="true" height="400px" position="top">
          </v-img>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
export default {
  transition(to) {
    return to.name == "crypto" ? "swoop-in" : "swoop-out";
  },
  data: () => ({
    cards: [
      {
        title: "Bitcoin",
        address: "bitcoin:bc1q90v030fu4z2hzz3x6a4zcwxuzauxkt8gjv8pws",
        img: "/qrs/bitcoin.jpg",
      },
      {
        title: "Monero",
        address:
          "monero:431SM1vExRbdiq5jArCMkhey1g8kYhLYkbgkXYU4kgL6UrXNRzcXtz3HJDayph6Dcb3ErTg8ZAVqJGtS1Ya7Rr9URJ24Tbe",
        img: "/qrs/monero.jpg",
      },
      {
        title: "Ethereum",
        address: "ethereum:0x981A99cDE3f4E1Ad49Ad84FB62Eca3606007eBEc",
        img: "/qrs/ethereum.jpg",
      },
    ],
  }),
};
</script>

<style></style>
