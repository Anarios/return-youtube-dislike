<template>
  <div>
    <iframe
      src="https://yoomoney.ru/quickpay/shop-widget?writer=seller&amp;targets=For%20returnyoutubedislike.com&amp;targets-hint=&amp;default-sum=&amp;button-text=13&amp;hint=&amp;successURL=&amp;quickpay=shop&amp;account=410015901550027&amp;"
      allowtransparency="true"
      scrolling="no"
      width="423"
      height="222"
      frameborder="0"
    />
  </div>
</template>

<script>
export default {
  transition(to) {
    return to.name == "yoomoney" ? "swoop-in" : "swoop-out";
  },
};
</script>
