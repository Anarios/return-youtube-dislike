// /* popup-script.js */
// document.querySelector('#login')
// .addEventListener('click', function () {
//   chrome.runtime.sendMessage({ message: 'get_auth_token' });
// });

// document.querySelector('#log_off')
// .addEventListener('click', function () {
//   chrome.runtime.sendMessage({ message: 'log_off' });
// });
browser.storage.local.get(["dont_run_on_private_unlisted"], result => {
  document.getElementById("checkbox1").checked = result.dont_run_on_private_unlisted;
})

document.getElementById("checkbox1").addEventListener("change", () =>{
  browser.storage.local.set({"dont_run_on_private_unlisted": document.getElementById("checkbox1").checked})
})