# Frequently Asked Questions
## Before asking a question on GitHub or Discord, please refer to this.

### **1. Where does this extension get the data?**
A Combination of Google APIs and scraped data.

We save all available data to our DB for it to be available after Google shuts down dislike counts in their API.

### **2. Video dislike count doesn't update**
Right now video dislikes are cached, and aren't updated very frequenly. Once every 2-3 days, not more often.

Yeah, it's not ideal, but it is what it is. Working on improving how often we can update them.

### **3. How does this work?**
The extension collects the video id of the video you are watching, fetches the dislike (and other fields like views, likes etc) using our API, if this is the first time the video was fetched by our API, it will use the YouTube API to get the data, then stores the data in a database for caching (cached for around 2-3 days) and archiving purposes and returns it to you. The extension then displays the dislikes to you.

### **4. What will happen after the YouTube API stops returning the dislike count?**
The backend will switch to using a combination of archived dislike stats, estimates extrapolated from extension user data and estimates based on view/like ratios for videos whose dislikes weren't archived and for outdated dislike archives.

## I have security / privacy concerns
See [this page](SECURITY-FAQ.md) for more info.
