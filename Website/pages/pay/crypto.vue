<template>
  <v-container class="crypto-container">
    <v-row class="crypto-grid" dense>
      <v-col v-for="card in cards" :key="card.title" class="crypto-column" cols="12" :lg="4">
        <v-card height="100%">
          <v-card-title>
            {{ card.title }}
          </v-card-title>
          <v-card-text style="min-height: 80px">
            {{ card.address }}
          </v-card-text>
          <v-img :src="card.img" height="400px" position="top"> </v-img>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
export default {
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

<style scoped>
.crypto-container {
  width: 100%;
  max-width: 100%;
  padding: 12px;
}

.crypto-grid {
  margin: -4px;
  gap: 0;
}

.crypto-column {
  flex: 0 0 100%;
  max-width: 100%;
  padding: 4px;
}

:deep(.v-card) {
  background: #1e1e1e;
}

:deep(.v-card-title) {
  display: flex;
  align-items: center;
  padding: 16px;
  font-size: 20px;
  font-weight: 500;
  line-height: 32px;
  letter-spacing: 0.0125em;
}

:deep(.v-card-text) {
  padding: 0 16px 16px;
  font-size: 14px;
  line-height: 22px;
  letter-spacing: 0.0071428571em;
  color: rgba(255, 255, 255, 0.7);
  overflow-wrap: anywhere;
}

@media (min-width: 960px) {
  .crypto-container {
    max-width: 900px;
  }
}

@media (min-width: 1264px) {
  .crypto-container {
    max-width: 1185px;
  }

  .crypto-column {
    flex-basis: 33.3333333333%;
    max-width: 33.3333333333%;
  }
}

@media (min-width: 1904px) {
  .crypto-container {
    max-width: 1785px;
  }
}
</style>
