export function localizePage(getMessage) {
  const localize = (text) => text.replace(/__MSG_(\w+)__/g, (_, key) => getMessage(key));
  const title = document.querySelector("title");
  if (title?.title) title.title = localize(title.title);
  document.title = localize(document.title);
  const body = document.body.innerHTML;
  const localizedBody = localize(body);
  if (localizedBody !== body) document.body.innerHTML = localizedBody;
  document.documentElement.toggleAttribute("data-localized", true);
}
