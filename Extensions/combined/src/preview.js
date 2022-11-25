import { getVideoId } from "./utils";
import { getApiData, extConfig } from "./state";

let videos = [];
let listeneningForHover = [];

let cache = {};
let cacheDuration = 60 * 10; // 10 minutes

let currentUrl; // Current URL to detect URL change


async function showRatioPreviews() {
  // Select all videos
  let currentVideos = [].slice.call(document.getElementsByTagName("ytd-rich-grid-media"));
  // Video recommendations while watching a video
  currentVideos = currentVideos.concat([].slice.call(document.getElementsByTagName("ytd-compact-video-renderer")));
  // Search results
  currentVideos = currentVideos.concat([].slice.call(document.getElementsByTagName("ytd-video-renderer")));
  // Channel overview videos
  currentVideos = currentVideos.concat([].slice.call(document.getElementsByTagName("ytd-grid-video-renderer")));
  // Get videos that are not already show the ratio
  currentVideos = currentVideos.filter(element => !videos.includes(element));

  // Show ratio preview for each video if state is set to "always"
  if (extConfig.ratioPreview === "always") {
    for (let video of currentVideos) {  // Iterate through all videos
      showRatioPreview(video);
    }
  }
  // Add hover listener for each video if state is set to "hover"
  if (extConfig.ratioPreview === "hover") {
    for (let video of currentVideos) {  // Iterate through all videos
      if (!listeneningForHover.includes(video)) { // Check if video already has hover listener
        video.addEventListener("mouseenter", () => showRatioPreview(video));
        video.addEventListener("mouseleave", () => removeRatioPreview(video));
        listeneningForHover.push(video);
      }
    }
  }
}

async function showRatioPreview(video) {
  // Check if video already has expired ratio preview
  if (video.querySelector("#ratio-display")) {
    video.querySelector("#ratio-display").remove();
  }

  // Get video data
  let videoLink = video.querySelector("a").href;
  let videoId = getVideoId(videoLink);
  let data = await getData(videoId);

  // Check if data was fetched
  if (!data) {
    return false;
  }

  // Calculate like-dislike ratio
  let likes = data["likes"]; // Need to take data from ryd-API to prevent additional request to official YouTube API
  let dislikes = data["dislikes"];

  // Calculate ratio
  let ratio;
  if (isNaN(likes) || isNaN(dislikes)) {
    return 0;
  } else {
    ratio = Math.round(likes / (likes + dislikes) * 100) || 0;
  }

  // Set color depending on ratio
  let color = (ratio >= 90 ? "#2ab92a" : ratio >= 70 ? "#ffca00" : "#d73131");

  // Add percentage to video
  video.querySelector("#metadata-line").innerHTML += `<span id="ratio-display" class="inline-metadata-item style-scope ytd-video-meta-block"><span style="color: ${color};"><i>${ratio}%</i></span></span>`;

  // Add video to list of videos already shown
  videos.push(video);
}

function removeRatioPreview(video) {
  function remove() {
    if (video.querySelector("#ratio-display")) {
      video.querySelector("#ratio-display").remove();
      return true;
    }
    return false;
  }
  // Try to remove ratio preview continously for 3 seconds (in case ratio preview is not yet shown)
  if (remove()) {
    return;
  } else {
    let tries = 0;
    let interval = setInterval(() => {
      if (remove() || tries > 30) {
        clearInterval(interval);
      }
      tries++;
      if (tries >= 30) {
        clearInterval(interval);
      }
    }, 10);
  }
}

function isNewUrl() {
  // Returns if URL has changed
  let newUrl = window.location.href !== currentUrl;
  currentUrl = window.location.href;
  return newUrl;
}

function cacheCleanup() {
  // Remove expired cache entries
  const now = new Date().getTime();
  let removed = 0;
  for (let key in cache) {
    if (now - cache[key]["fetchTime"] > cacheDuration) {
      delete cache[key];
      removed++;
    } else {
      break;
    }
  }
}

async function getData(videoId) {
  const now = new Date().getTime();

  if (isNewUrl()) {
    cacheCleanup();
  }

  // Check if video is in cache
  if (videoId in cache) {
    return cache[videoId];
  }

  // If not, fetch data from API
  let apiResponse = await getApiData(videoId);

  // Check if request was successful
  if (!apiResponse.likes) {
    return false;
  }

  cache[videoId] = apiResponse;
  cache[videoId]["fetchTime"] = now;
  
  return cache[videoId];
}

function resetVideoList() {
  videos = [];
}

export { showRatioPreviews, resetVideoList };
