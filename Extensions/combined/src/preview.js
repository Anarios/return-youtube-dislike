import { getVideoId } from "./utils";
import { getApiData } from "./state";

let videos = [];

async function showRatioPreviews() {
  // Select all videos
  let currentVideos = [].slice.call(document.getElementsByTagName("ytd-rich-grid-media"));
  // Video recommendations while watching a video
  currentVideos = currentVideos.concat([].slice.call(document.getElementsByTagName("ytd-compact-video-renderer")));
  // Search results
  currentVideos = currentVideos.concat([].slice.call(document.getElementsByTagName("ytd-video-renderer")));
  // Get videos that are not already show the ratio
  currentVideos = currentVideos.filter(element => !videos.includes(element));
  for (let video of currentVideos) {  // Iterate through all videos
    // Check if video already has ratio preview
    if (video.querySelector("#ratio-display")) {
      video.querySelector("#ratio-display").remove();
    }

    // Get video data
    let videoLink = video.querySelector("a").href;
    let videoId = getVideoId(videoLink);
    let apiResponse = await getApiData(videoId);

    // Calculate like-dislike ratio
    let likes = apiResponse['likes'];
    let dislikes = apiResponse['dislikes'];
    let ratio = Math.round(likes / (likes + dislikes) * 100);
    if (likes === undefined || dislikes === undefined) {
      return;
    }

    // Set color depending on ratio
    let color = (ratio > 90 ? '#2ab92a' : ratio > 50 ? '#ffca00' : '#d73131');

    // Add percentage to video
    video.querySelector("#metadata-line").innerHTML += `<span id='ratio-display' style="color: ${color};">${ratio}%</span>`;

    // Add video to list of videos already shown
    videos.push(video);
  }
}

function resetVideoList() {
  videos = [];
}

export { showRatioPreviews, resetVideoList };
