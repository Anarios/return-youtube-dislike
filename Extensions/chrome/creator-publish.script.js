function cLog(message, writer) {
    message = `[return youtube dislike]: ${message}`;
    if (writer) {
        writer(message);
    } else {
        console.log(message);
    }
}

// API credientials are fetched when making a request
let authorizationHeader;
let innertubeApiKey;

function overrideXHR(defaultOpen, defaultSetHeader) {

    // Override open() method to obtain innerTube key
    XMLHttpRequest.prototype.open = function (method, url) {
        if (!innertubeApiKey && url.includes("&key")) {
            innertubeApiKey = new URLSearchParams(new URL(url, window.location).search).get("key");
            cLog("Obtained innerTube api key: " + innertubeApiKey);
        }
        this.url = url;
        return defaultOpen.apply(this, arguments);
    }
    // Override setRequestHeader to obtain Authorization header
    XMLHttpRequest.prototype.setRequestHeader = function (header, value) {
        if (!authorizationHeader && header.toLowerCase() == "authorization" && this.url.includes("youtubei")) {
            authorizationHeader = value;
            cLog("Obtained authorization header: " + value);
        }
        return defaultSetHeader.apply(this, arguments);
    }
}
function isLoaded() {
    return document.querySelector("div.right-section.style-scope.ytcp-header") !== null;
}
let interval = setInterval(() => {
    if (isLoaded()) {
        addButton();
        clearInterval(interval);
    }
}, 16);
function addButton() {
    // In case the clearInterval breaks..
    if (document.querySelector(".returnyoutube-button")) {
        return
    }
    let button = document.createElement("div");
    button.classList.add("returnyoutube-button");
    button.innerText = "Share Dislike Count";
    let buttonContainer = document.querySelector("div.right-section.style-scope.ytcp-header");
    buttonContainer.insertBefore(button, document.querySelector("ytcp-button#create-icon.style-scope.ytcp-header"));
    button.addEventListener("click", fetchDislikes);
}
async function fetchDislikes() {
    if (!authorizationHeader) {
        alert("Authorization header could not be fetched.. try hard-reloading the page or open a github issue");
        return;
    }
    if (!innertubeApiKey) {
        alert("Innertube API key could not be fetched.. try hard-reloading the page or open a github issue");
        return;
    }
    let data = await (await fetch(`https://studio.youtube.com/youtubei/v1/creator/search_creator_entities?alt=json&key=${innertubeApiKey}`, {
        "headers": {
            "authorization": authorizationHeader,
            "content-type": "application/json"
        },
        "body": JSON.stringify({
            numVideos: 100000,
            query: '',
            videoMask: { videoId: true, metrics: { all: true } },
            context: { client: { clientName: 62, clientVersion: '1.20211206.02.00' } }
        }),
        "method": "POST"
    })).json();
    let videoDislikes = data.videos.map(video => {
        return {
            id: video.video.videoId,
            dislikes: video.video.metrics.dislikeCount
        }
    });
    let sure = confirm(`Successfully fetched dislikes of ${videoDislikes.length} videos. Do you want to publish them?`);
    if(!sure){
        return;
    }
    alert("Please add a youtube creator dislike endpoint before merging. Dislikes fetched: " + JSON.stringify(videoDislikes));
}
overrideXHR(XMLHttpRequest.prototype.open, XMLHttpRequest.prototype.setRequestHeader)