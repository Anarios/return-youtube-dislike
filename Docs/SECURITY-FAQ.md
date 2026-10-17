Read this in other languages: [русский](SECURITY-FAQru.md), [Nederlands](SECURITY_FAQnl.md), [Français](SECURITY-FAQfr.md), [Türkçe](SECURITY-FAQtr.md), [українська](SECURITY-FAQuk.md), [Polski](SECURITY-FAQpl.md), [Deutsch](SECURITY-FAQde.md), [العربية](SECURITY-FAQar.md), [Bahasa Indonesia](SECURITY-FAQid.md), [中文](SECURITY-FAQcn.md), [български](SECURITY-FAQbg.md), [Tiếng Việt](SECURITY-FAQvi.md)

# Security

### Are you tracking my viewing history?

The extension sends the current video ID and, when available, its visible like count to the Return YouTube Dislike API
because the server needs them to return and improve the dislike estimate. The request also exposes standard network
metadata such as the public IP address and request time. The extension does not send your YouTube account name,
comments, private YouTube data, or the contents of unrelated pages, and it does not keep a separate local watch-history
list.

### Can you uniquely identify me if I dislike?

The extension creates a persistent random ID for abuse-resistant vote submission. It is not derived from or linked to
your Google or YouTube account, but Mozilla classifies persistent identifiers as personal data. The ID lets the service
associate submitted votes with the same extension installation.

### What information do you have, exactly?

For dislike-count requests: the current video ID and, when available, the visible like count. For registration and vote
submission: the random extension user ID, video ID, selected vote, timestamp, and network address used for abuse
controls. Optional premium features use the account ID, name, email address, profile image, membership information, and
service session token returned by a Patreon or GitHub sign-in initiated by the user. For version 4.0.6 and its matching
backend release, Patreon access is determined from currently entitled tier IDs rather than financial information.

### How is my IP stored?

The API receives your network address with each request. Confirmed vote records retain the network address used for
abuse prevention and aggregate analytics. It is not sold or used for advertising.

### I heard some discussion over OAuth, and access to my YouTube account!

Premium analytics sign-in is optional and starts only after the user chooses Patreon or GitHub login in the extension.
The OAuth flow returns account details and a Return YouTube Dislike session token used to authenticate premium API
requests. In version 4.0.6 and its matching backend release, Patreon eligibility uses currently entitled tier IDs;
the service does not request or use membership amounts, charge dates or status, lifetime payments, or patron status.
Firefox asks for separate authentication-data consent before account traffic begins. Signing out removes
the stored account details and session from the extension. Revoking Firefox's authentication-data permission also clears the
account session and blocks further account traffic until you grant consent and sign in again. Browser sync may
synchronize the installation identifier, settings, and account session when enabled.

### How can I trust this dislike count?

We have implemented measures to prevent bot attacks and are gonna continue to work on improving the effectiveness of the bot prevention system: this will help us keep the dislike count as a good representative of the actual count. Of course it will never be 100% accurate so it's up to you to decide whether you trust the count or not.

### Why don't you share the backend code?

We will share it at some point - but there's really no real reason to share it right now. It gives a false sense of security - because in a zero-trust system, we could just as well disclose one version but deploy another. There are plenty of reasons to keep the code hidden, specifically, how we battle spam. Hiding/Obfuscating the spam handling code is a fairly standard practice.
