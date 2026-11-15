import { computed, onMounted, ref } from "vue";
import { parse } from "woothee";

export function useUserAgent() {
  const source = ref("");
  onMounted(() => {
    source.value = navigator.userAgent;
  });
  return computed(() =>
    source.value ? parse(source.value) : { name: "", vendor: "", version: "", os: "", os_version: "", category: "" },
  );
}
