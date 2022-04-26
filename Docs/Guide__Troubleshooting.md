Troubleshooting Guide

**Index**

- [Extension](#extension)
  - [Basic checks](#basic-checks)
  - [Check API status](#check-api-status)
  - [Install certificates](#install-certificates)
  - [Check for logs in the console](#check-for-logs-in-the-console)
    - [In Chromium Based browsers](#in-chromium-based-browsers)
    - [In Firefox Based Browsers](#in-firefox-based-browsers)
  - [Check for conflicting extensions](#check-for-conflicting-extensions)
  - [Known conflicts](#known-conflicts)
- [iOS app](#ios-app)
- [YouTube Vanced app](#youtube-vanced--app)
- [Contact in Discord Server](#contact-in-discord-server)
- [Useful Links](#useful-links)

<br>

## Extension

(for Windows & Macs)

### Basic checks

1. Make sure you have the latest version of the extension installed. ([Click Here to check](https://chrome.google.com/webstore/detail/return-youtube-dislike/gebbhagfogifgggkldgodflihgfeippi#:~:text=Report%20abuse-,Version,-2.0.0.3))
2. Close all the tabs & restart your browser
3. Reinstall the extension.
4. [Check API status]
5. [Check service worker] (only for chromium based browsers)
6. [If you are on Windows 7 read this](#install-certificates)

<br>

### Check API status

If the basic checks didn't resolve anything

[See if you get any response from this link (click here)](https://returnyoutubedislikeapi.com/votes?videoId=QOFEgexls14)

- If you **don't see something like** this, then the **API is down** and **everything is fine on your side**.
  `{"id":"QOFEgexls14","dateCreated":"2021-12-28T02:53:20.995329Z","likes":2968,"dislikes":204,"rating":4.725047080979285,"viewCount":29157,"deleted":false}`
- If you see some responses but not in the above format (with likes and dislikes) then probably you are being rate-limited. It is done to prevent bot attacks and database vandalization. It depends on IP (its hash - which is never stored in non-volatile storage) for its countermeasures. If many people are accessing the server from the same IP (as in the case of public/institutional Wi-Fi) then it's possible that the IP is being rate-limited. If that's the case, there's no way for us to differentiate you from a bot/attacker.

**If you see "Certificate error" and [if you are on Windows 7 (or earlier) read this](#install-certificates)**

<br><br>

### Install certificates

**Applies for Windows 7 (and earlier) only**

and only for  [Chromium Based Browsers][1]

- [Chromium-based browsers][1] don't have their own certificate manager.
- They use Windows' certificates manager.
- Microsoft has officially dropped the support for Windows 7

You will have to install the latest certificates for that.

You can follow this guide:

[Fix error NET::ERR CERT DATE INVALID - Your connection is not private - Windows 7 - 2021](https://youtu.be/JYZLxP2Z8G4)

If you don't want to install the certificate from Google Drive

- Here is the official link to the certificate [**x1.i.lencr.org**](http://x1.i.lencr.org/).
- **You will have to close all the tabs** before downloading this certificate.

**The thumbprint of real certificate is `cabd2a79a1076a31f21d253635cb039d4329a5e8`**

**To make sure that you have installed the correct certificate, you should consider checking if the thumbprints match.** To do this you can follow this guide: [How to check a certificate's thumbprint](https://knowledge.digicert.com/solution/SO9840.html)

<br>

### Check for logs in the console

#### [In Chromium Based browsers][1]

1. In Developer tools, go to [`console` panel](https://developer.chrome.com/docs/devtools/open/#console).
   - For Windows press `Ctrl` + `Shift` + `J` all at once
   - For Mac press `Cmd` + `Option` + `J` all at once
2. Find `filter` box in the newly appeared window.
3. Type `Return`.
4. Check the [Check API Status](#check-api-status) and see if you get similar responses.
5. If you see any errors in red [please contact us][4] and report them in our [discord server][3]

<!-- If ever needed
   - For Android refer to this article: [Remote debug Android devices](https://developer.chrome.com/docs/devtools/remote-debugging/) -->

<br>

#### [In Firefox Based Browsers][2]

1. Open Browser Console
   - For standard keyboard layout press `Ctrl` + `Shift` + `K` all at once
   - For Mac keyboard layout press `Cmd` + `Option` + `K` all at once
   - For Android refer to this article: [Remotely debugging Firefox <36 for Android](https://developer.mozilla.org/en-US/docs/Tools/Remote_Debugging/Firefox_for_Android)
2. Find `Filter Output` box in the newly appeared window.
3. Type `Return`.
4. If you see any errors in red [please contact us][4] and report them in our [discord server][3]

<br>

### Check for conflicting extensions

Some privacy and/or security-focused extensions such as ad- or script-blockers, as well as YouTube customization plugins might prevent the extension from working correctly.  
Try to disable all other extensions and test whether the extension works.  
If it does, find the extension(s) preventing RYD from working correctly and re-configure them in a way that'd stop them from interfering.

<br>

### Known conflicts

>### scriptSafe
>
> **Solution:** Trust `returnyoutubedislikeapi.com` manually
>
> ![trust returnyoutubedislikeapi.com manually](https://cdn.discordapp.com/attachments/821116437720334397/929814357708247060/unknown.png)

<br>

> ### uMatrix
>
> **Solution:** Allow XHR for `returnyoutubedislikeapi.com` manually
>
> ![Allow XHR for `returnyoutubedislikeapi.com` manually](https://media.discordapp.net/attachments/821116437720334397/929813724238336141/unknown.png)

<br>

<br>

## iOS app

Coming soon. Please have patience.

<br>

<br>

## YouTube Vanced app

Coming soon. Please have patience.

<br>

<br>

## Contact in Discord Server

**Only if nothing mentioned above helped and you still have a problem.**

[Discord server link: https://discord.gg/mYnESY4Md5][3]

0. Join the discord server if you haven't already
1. Go to the #Bugs-and-problems channel
2. There, thoroughly describe:
   - your problem
   - what you have tried and what didn't work
   - results of the troubleshooting steps

<!-- {
  "update_frequency" : "low"
} -->

<br>

<br>

## Useful Links

[List of Chromium Based Browsers][1]

[List of Firefox Based Browsers][2]

[Return-YouTube-Dislike Discord Server][3]

<!-- links -->

[1]: https://en.wikipedia.org/wiki/Chromium_(web_browser)#Browsers_based_on_Chromium

[2]: https://en.wikipedia.org/wiki/Category:Web_browsers_based_on_Firefox

[3]: https://discord.gg/mYnESY4Md5

[4]: #contact-in-discord-server
