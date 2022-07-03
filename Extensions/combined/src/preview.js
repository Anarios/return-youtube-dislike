import { getVideoId } from "./utils";
import { getApiData } from "./state";

let videos = [];

let cache = {};
let cacheDuration = 60 * 10; // 10 minutes


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
  for (let video of currentVideos) {  // Iterate through all videos
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
      return;
    }

    // Calculate like-dislike ratio
    let likes = data["likes"];
    let dislikes = data["dislikes"];
    let ratio = Math.round(likes / (likes + dislikes) * 100);

    // Set color depending on ratio
    let color = (ratio >= 90 ? "#2ab92a" : ratio >= 70 ? "#ffca00" : "#d73131");

    // Add percentage to video
    video.querySelector("#metadata-line").innerHTML += `<span id="ratio-display" style="color: ${color};">${ratio}%</span>`;

    // Add video to list of videos already shown
    videos.push(video);
  }
}

async function getData(videoId) {
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

  // Check if video is in cache
  if (videoId in cache) {
    console.log('USING CACHE!!! for ' + videoId);
    return cache[videoId];
  }

  // If not, fetch data from API
  let apiResponse = await getApiData(videoId);

  // Check if request was successful
  if (!apiResponse.likes) {
    return;
  }

  cache[videoId] = apiResponse;
  cache[videoId]["fetchTime"] = now;
  
  return cache[videoId];
}

function resetVideoList() {
  videos = [];
}

export { showRatioPreviews, resetVideoList };
