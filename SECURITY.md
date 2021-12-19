# Security

### Are you tracking my viewing history?

No. The extension's code is public and you can see it for yourself. The only information being sent is the video ID. There are no additional headers being sent. Over the communication layer, your public IP will be exposed to the server, as well as the time when the request was made. However, none of these are uniquely identifying you in any way. Assuming a zero-trust environment, the best we could get is a dynamic IP. Which, today is yours, tomorrow is your neighbor's. If you're really worried about your IP being traced, you probably already use a VPN.

### Can you uniquely identify me if I dislike?

No. When you dislike a video, we create a unique (but random and non-identifiable) ID for you. This is done to prevent botting. But again, it cannot uniquely identify you.

### What information do you have, exactly?

Just the video ID. Not your comments, not your username, not who you've shared the video with, not any additional metadata. Nothing. Just the video ID. 

### How is my IP stored?

The backend keeps IP addresses in volatile memory (RAM) only. These addresses aren't stored on a hard drive, and therefore aren't logged. This is done to prevent database vandalism. 

### I heard some discussion over OAuth, and access to my YouTube account!

This feature is optional, and very much opt-in. If you are a YouTube creator, and would like to share your dislike stats with us, you can. The way OAuth was structured, is it's actually very secure. You can revoke access to your account at any time, and can give very specific permissions to us. We will not ask for any permissions that aren't required. We'll only ask for permissions to view your video stats. 

### How can I trust this dislike count?

Short answer is: you can't. We've implemented anti-botting measures, but at the end of the day, it's up to you to decide whether you trust our count or not. 

### Why don't you share the backend code? 

We may share it at some point - but there's really no real reason to share it. It gives a false sense of security - because in a zero-trust system, we could just as well disclose one version but deploy another. There are plenty of reasons to keep the code hidden, specifically, how we battle spam. Hiding/Obfuscating the spam handling code is a fairly standard practice.

