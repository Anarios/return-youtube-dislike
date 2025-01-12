以其他语言阅读: [русский](FAQru.md), [Français](FAQfr.md), [Nederlands](FAQnl.md), [Türkçe](FAQtr.md), [українська](FAQuk.md), [Polski](FAQpl.md), [Deutsch](FAQde.md), [Português do Brasil](FAQpt_BRmd)


# 常见问题

## 在 GitHub 或 Discord 上提问之前，请先参阅此内容.

<br>

### **1. 此扩展程序从哪里获取数据?**

Google API 和抓取数据的组合。

我们将所有可用数据保存到我们的数据库中，以便 Google 关闭其 API 中的不喜欢计数后仍可用。

<br>

### **2. 视频不喜欢计数未更新**

目前，视频的点赞信息会被缓存，更新频率不高。每 2-3 天更新一次，不会更频繁。

这并不理想，但这就是现状。我们正在努力提高更新频率。

<br>

### **3. 这是如何运作的?**

该扩展程序会收集您正在观看的视频的视频 ID，使用我们的 API 获取不喜欢的内容（以及其他字段，如观看次数、喜欢次数等），如果这是我们的 API 首次获取该视频，它将使用 YouTube API 获取数据，然后将数据存储在数据库中以供缓存（缓存约 2-3 天）和存档，并将其返回给您。然后，该扩展程序会向您显示不喜欢的内容。

<br>

### **4. YouTube API 停止返回不喜欢计数后会发生什么?**

后端将切换到使用已存档的不喜欢统计数据、从扩展用户数据推断出的估计值以及基于未存档的不喜欢的视频和过时的不喜欢存档的观看/喜欢比率的估计值的组合。

<br>

### **5. 如何计算不喜欢数?**

RYD 使用用户的投票来推断不喜欢的数量。

- 如果视频是在 API 关闭后上传的:

  $$ \textup{RYD Dislike Count} = \left( \frac{\textup{RYD Users Dislike Count}}{\textup{RYD Users Like Count}} \right) \times \textup{Public Like Count} $$

- 如果 RYD 数据库以某种方式拥有实际的喜欢和不喜欢计数（由上传者提供或来自存档），则不喜欢计数将根据用户的投票和存档值计算。存档值随着时间的推移对最终计数的影响会越来越小。

<br>

---

这是视频形式

[![IReturn YouTube 不喜欢解释](https://yt-embed.herokuapp.com/embed?v=GSmmtv-0yYQ)](https://www.youtube.com/watch?v=GSmmtv-0yYQ)

---

<br>

## I have security / privacy concerns

有关详细信息，请参阅[此页面](SECURITY-FAQ.md)。