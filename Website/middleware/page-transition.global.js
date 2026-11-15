import { defineNuxtRouteMiddleware } from "#app";
import { routeTransitionName } from "../utils/page-transition";

export default defineNuxtRouteMiddleware((to, from) => {
  const entering = routeTransitionName(to, to, from);
  const leaving = routeTransitionName(from, to, from);
  to.meta.pageTransition = entering ? { name: entering, mode: "out-in" } : false;
  from.meta.pageTransition = leaving ? { name: leaving, mode: "out-in" } : false;
});
