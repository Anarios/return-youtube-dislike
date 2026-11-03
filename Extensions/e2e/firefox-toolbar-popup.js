const FIND_POPUP_SCRIPT =
  'const browser=[...document.querySelectorAll("browser.webextension-popup-browser")].find(b=>b.currentURI?.spec.startsWith(arguments[0]+"/popup.html")&&b.closest("panel")?.state==="open");if(!browser)return null;window.__rydToolbarPopupBrowser=browser;return {url:browser.currentURI.spec,type:browser.getAttribute("webextension-view-type"),panel:browser.closest("panel").id,browsingContext:browser.browsingContext.id};';
const RUN_IN_POPUP_SCRIPT =
  'const done=arguments[arguments.length-1];const browser=window.__rydToolbarPopupBrowser;if(!browser?.browsingContext?.currentWindowGlobal){done({error:"Toolbar popup document unavailable"});return;}const actor=browser.browsingContext.currentWindowGlobal.getActor("MarionetteCommands");actor.executeScript(arguments[0],arguments[1],{async:arguments[2],timeout:10000,sandboxName:null,newSandbox:false}).then(value=>done({value}),error=>done({error:String(error)}));';
const CLICK_IN_POPUP_SCRIPT =
  'const done=arguments[arguments.length-1];const browser=window.__rydToolbarPopupBrowser;const actor=browser.browsingContext.currentWindowGlobal.getActor("MarionetteCommands");(async()=>{const element=await actor.findElement("css selector",arguments[0],{timeout:10000});await actor.clickElement(element,{toJSON:()=>({"moz:accessibilityChecks":false,"moz:webdriverClick":true})});return true;})().then(value=>done({value}),error=>done({error:String(error)}));';
const ADD_TOOLBAR_BUTTON_SCRIPT =
  'const {ExtensionParent}=ChromeUtils.importESModule("resource://gre/modules/ExtensionParent.sys.mjs");const ui=window.CustomizableUI||ChromeUtils.importESModule("moz-src:///browser/components/customizableui/CustomizableUI.sys.mjs").CustomizableUI;const action=ExtensionParent.apiManager.global.browserActionFor(WebExtensionPolicy.getByID(arguments[0]).extension);ui.addWidgetToArea(action.widget.id,ui.AREA_NAVBAR);return action.widget.id;';

function createToolbarPopup(chrome, base) {
  return {
    find: () => chrome(FIND_POPUP_SCRIPT, [base]),
    run: (script, args = [], async = false) => chrome(RUN_IN_POPUP_SCRIPT, [script, args, async], true),
    click: (selector) => chrome(CLICK_IN_POPUP_SCRIPT, [selector], true),
  };
}

function addToolbarButton(chrome, addonId) {
  return chrome(ADD_TOOLBAR_BUTTON_SCRIPT, [addonId]);
}

module.exports = { addToolbarButton, createToolbarPopup };
