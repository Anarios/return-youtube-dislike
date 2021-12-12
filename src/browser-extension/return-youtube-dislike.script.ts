export {};

declare global {
	interface Window {
		returnDislikeButtonlistenersSet?: boolean
	}
}

const browser = require("webextension-polyfill");
console.log(browser);

const LIKED_STATE = "LIKED_STATE";
const DISLIKED_STATE = "DISLIKED_STATE";
const NEUTRAL_STATE = "NEUTRAL_STATE";

(function (extensionId) {
	const storedData = {
		likes: 0,
		dislikes: 0,
		previousState: NEUTRAL_STATE,
	};

	function cLog(message, writer?) {
		message = `[return youtube dislike]: ${message}`;
		if (writer) {
			writer(message);
		} else {
			console.log(message);
		}
	}

	function getButtons() {
		//---   If Menu Element Is Displayed:   ---//
		if (document.getElementById("menu-container")?.offsetParent === null) {
			return document.querySelector(
				"ytd-menu-renderer.ytd-watch-metadata > div"
			) as HTMLMetaElement;
			//---   If Menu Element Isnt Displayed:   ---//
		} else {
			return document
				.getElementById("menu-container")
				?.querySelector("#top-level-buttons-computed") as HTMLMetaElement;
		}
	}

	function getLikeButton() {
		return getButtons().children[0];
	}

	function getDislikeButton() {
		return getButtons().children[1];
	}

	function isVideoLiked() {
		return getLikeButton().classList.contains("style-default-active");
	}

	function isVideoDisliked() {
		return getDislikeButton().classList.contains("style-default-active");
	}

	function isVideoNotLiked() {
		return getLikeButton().classList.contains("style-text");
	}

	function isVideoNotDisliked() {
		return getDislikeButton().classList.contains("style-text");
	}

	function checkForUserAvatarButton() {
		return !!document.querySelector("#avatar-btn");
	}

	function getState() {
		if (isVideoLiked()) {
			return { current: LIKED_STATE, previous: storedData.previousState };
		}
		if (isVideoDisliked()) {
			return { current: DISLIKED_STATE, previous: storedData.previousState };
		}
		return { current: NEUTRAL_STATE, previous: storedData.previousState };
	}

	//---   Sets The Likes And Dislikes Values   ---//
	function setLikes(likesCount) {
		(<HTMLMetaElement> getButtons().children[0].querySelector("#text")).innerText = likesCount;
	}
	function setDislikes(dislikesCount) {
		(<HTMLMetaElement> getButtons().children[1].querySelector("#text")).innerText = dislikesCount;
	}

	function setState() {
		let statsSet = false;
		browser.runtime.sendMessage({
			message: "fetch_from_youtube",
			videoId: getVideoId(window.location.href),
		}).then(function (response) {
			if (response != undefined) {
				cLog("response from youtube:");
				cLog(JSON.stringify(response));
				try {
					if ("likes" in response && "dislikes" in response) {
						const formattedDislike = numberFormat(response.dislikes);
						setDislikes(formattedDislike);
						storedData.dislikes = parseInt(response.dislikes);
						storedData.likes = parseInt(response.likes);
						createRateBar(response.likes, response.dislikes);
						statsSet = true;
					}
				} catch (e) {
					statsSet = false;
				}
			}
		});
			

		browser.runtime.sendMessage(
			{
				message: "set_state",
				videoId: getVideoId(window.location.href),
				state: getState().current,
			}).then(
			function (response) {
				cLog("response from api:");
				cLog(JSON.stringify(response));
				if (response != undefined && !("traceId" in response) && !statsSet) {
					const formattedDislike = numberFormat(response.dislikes);
					// setLikes(response.likes);
					setDislikes(formattedDislike);
					createRateBar(response.likes, response.dislikes);
				} else {
				}
			}
		);
	}

	function likeClicked() {
		if (checkForUserAvatarButton() == false) {
			if (storedData.previousState == DISLIKED_STATE) {
				storedData.dislikes--;
				storedData.likes++;
				createRateBar(storedData.likes, storedData.dislikes);
				setDislikes(numberFormat(storedData.dislikes));
				storedData.previousState = LIKED_STATE;
			} else if (storedData.previousState == NEUTRAL_STATE) {
				storedData.likes++;
				createRateBar(storedData.likes, storedData.dislikes);
				storedData.previousState = LIKED_STATE;
			} else if (storedData.previousState == LIKED_STATE) {
				storedData.likes--;
				createRateBar(storedData.likes, storedData.dislikes);
				storedData.previousState = NEUTRAL_STATE;
			}
		}
	}

	function dislikeClicked() {
		if (checkForUserAvatarButton() == false) {
			if (storedData.previousState == NEUTRAL_STATE) {
				storedData.dislikes++;
				setDislikes(numberFormat(storedData.dislikes));
				createRateBar(storedData.likes, storedData.dislikes);
				storedData.previousState = DISLIKED_STATE;
			} else if (storedData.previousState == DISLIKED_STATE) {
				storedData.dislikes--;
				setDislikes(numberFormat(storedData.dislikes));
				createRateBar(storedData.likes, storedData.dislikes);
				storedData.previousState = NEUTRAL_STATE;
			} else if (storedData.previousState == LIKED_STATE) {
				storedData.likes--;
				storedData.dislikes++;
				setDislikes(numberFormat(storedData.dislikes));
				createRateBar(storedData.likes, storedData.dislikes);
				storedData.previousState = DISLIKED_STATE;
			}
		}
	}

	function setInitialState() {
		setState();
		setTimeout(() => sendVideoIds(), 1500);
	}

	function getVideoId(url) {
		const urlObject = new URL(url);
		const pathname = urlObject.pathname;
		if (pathname.startsWith("/clip")) {
			return (<HTMLMetaElement> document.querySelector("meta[itemprop='videoId']")).content;
		} else {
			return urlObject.searchParams.get("v");
		}
	}

	function isVideoLoaded() {
		const videoId = getVideoId(window.location.href);
		return (
			document.querySelector(`ytd-watch-flexy[video-id='${videoId}']`) !== null
		);
	}

	function roundDown(num) {
		if (num < 1000) return num;
		const int = Math.floor(Math.log10(num) - 2);
		const decimal = int + (int % 3 ? 1 : 0);
		const value = Math.floor(num / 10 ** decimal);
		return value * 10 ** decimal;
	}

	function numberFormat(numberState) {
		const userLocales = new URL(
			Array.from(document.querySelectorAll("head > link[rel='search']"))
				?.find((n) => n?.getAttribute("href")?.includes("?locale="))
				?.getAttribute("href")
		)?.searchParams?.get("locale");

		const formatter = Intl.NumberFormat(document.documentElement.lang || userLocales || navigator.language, {
			notation: "compact",
		});

		return formatter.format(roundDown(numberState));
	}

	let jsInitChecktimer = null;

	function setEventListeners(evt?) {
		function checkForJS_Finish() {
			if (getButtons()?.offsetParent && isVideoLoaded()) {
				clearInterval(jsInitChecktimer);
				jsInitChecktimer = null;
				const buttons = getButtons();
				if (!window.returnDislikeButtonlistenersSet) {
					buttons.children[0].addEventListener("click", likeClicked);
					buttons.children[1].addEventListener("click", dislikeClicked);
					window.returnDislikeButtonlistenersSet = true;
				}
				setInitialState();
			}
		}

		if (window.location.href.indexOf("watch?") >= 0) {
			jsInitChecktimer = setInterval(checkForJS_Finish, 111);
		}
	}

	function createRateBar(likes, dislikes) {
		const rateBar = document.getElementById(
			"return-youtube-dislike-bar-container"
		);

		const widthPx = getButtons().children[0].clientWidth + getButtons().children[1].clientWidth + 8;

		const widthPercent = likes + dislikes > 0 ? (likes / (likes + dislikes)) * 100 : 50;

		if (!rateBar) {
			document.getElementById("menu-container").insertAdjacentHTML(
				"beforeend",
				`
          <div class="ryd-tooltip" style="width: ${widthPx}px">
          <div class="ryd-tooltip-bar-container">
             <div
                id="return-youtube-dislike-bar-container"
                style="width: 100%; height: 2px;"
                >
                <div
                   id="return-youtube-dislike-bar"
                   style="width: ${widthPercent}%; height: 100%"
                   ></div>
             </div>
          </div>
          <tp-yt-paper-tooltip position="top" id="ryd-dislike-tooltip" class="style-scope ytd-sentiment-bar-renderer" role="tooltip" tabindex="-1">
             <!--css-build:shady-->${likes.toLocaleString()}&nbsp;/&nbsp;${dislikes.toLocaleString()}
          </tp-yt-paper-tooltip>
          </div>
  `
			);
		} else {
			document.getElementById(
				"return-youtube-dislike-bar-container"
			).style.width = widthPx + "px";
			document.getElementById("return-youtube-dislike-bar").style.width =
        widthPercent + "%";

			document.querySelector(
				"#ryd-dislike-tooltip > #tooltip"
			).innerHTML = `${likes.toLocaleString()}&nbsp;/&nbsp;${dislikes.toLocaleString()}`;
		}
	}

	function sendVideoIds() {
		const ids = Array.from(
			document.getElementsByClassName(
				"yt-simple-endpoint ytd-compact-video-renderer"
			)
		)
			.concat(
				Array.from(
					document.getElementsByClassName("yt-simple-endpoint ytd-thumbnail")
				)
			)
			.filter((x: HTMLAnchorElement) => x.href && x.href.indexOf("/watch?v=") > 0)
			.map((x: HTMLAnchorElement) => getVideoId(x.href));
		browser.runtime.sendMessage(extensionId, {
			message: "send_links",
			videoIds: ids,
		});
	}

	setEventListeners();

	document.addEventListener("yt-navigate-finish", function (event) {
		if (jsInitChecktimer !== null) clearInterval(jsInitChecktimer);
		window.returnDislikeButtonlistenersSet = false;
		setEventListeners();
	});

	setTimeout(() => sendVideoIds(), 2500);
})(document?.currentScript?.getAttribute("extension-id"));