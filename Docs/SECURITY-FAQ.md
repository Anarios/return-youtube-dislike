Read this in other languages: [русский](SECURITY-FAQru.md), [Nederlands](SECURITY_FAQnl.md), [Français](SECURITY-FAQfr.md), [Türkçe](SECURITY-FAQtr.md), [українська](SECURITY-FAQuk.md), [Polski](SECURITY-FAQpl.md), [Deutsch](SECURITY-FAQde.md)

# Security

### Are you tracking my viewing history?

No. The extension's code is public and you can see it for yourself. The only information being sent is the video ID, which is required to fetch the dislike count for the videos. There are no additional headers being sent. Over the communication layer, your public IP will be exposed to the server, as well as the time when the request was made. However, none of these are uniquely identifying you in any way. Assuming a zero-trust environment, the best we could get is a dynamic IP. Which, today is yours, tomorrow is your neighbor's. If you're really worried about your IP being traced, you probably already use a VPN.

### Can you uniquely identify me if I dislike?

Yes. When you dislike a video, we create a randomly generated unique ID for you that is not tied to your Google account. This is done to prevent botting. But there is no way to tie this random Id to you or your personal YouTube account.

### What information do you have, exactly?

Just the video ID. Not your comments, not your username, not who you've shared the video with, not any additional metadata. Nothing. Just the video ID.

### How is my IP stored?

The backend keeps unhashed IP addresses in volatile memory (RAM) only. These addresses aren't stored on a hard drive, and therefore aren't logged. We hash the IP addresses, and that's stored instead. This is done to prevent database vandalism.

### I heard some discussion over OAuth, and access to my YouTube account!

This feature will be optional, and very much opt-in. If you are a YouTube creator, and would like to share your dislike stats with us, you can. The way [OAuth](https://en.wikipedia.org/wiki/OAuth#:~:text=but%20without%20giving%20them%20the%20passwords.) was structured, it's actually very secure. You can revoke access to your account at any time, and can give very specific permissions to us. We will not ask for any permissions that aren't required. We'll only ask for permissions to view your video stats.

### How can I trust this dislike count?

We have implemented measures to prevent bot attacks and are gonna continue to work on improving the effectiveness of the bot prevention system: this will help us keep the dislike count as a good representative of the actual count. Of course it will never be 100% accurate so it's up to you to decide whether you trust the count or not.

### Why don't you share the backend code?

We will share it at some point - but there's really no real reason to share it right now. It gives a false sense of security - because in a zero-trust system, we could just as well disclose one version but deploy another. There are plenty of reasons to keep the code hidden, specifically, how we battle spam. Hiding/Obfuscating the spam handling code is a fairly standard practice.
