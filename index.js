// create Agora client
var client = AgoraRTC.createClient({
    mode: "rtc",
    codec: "vp8"
});

var localTracks = {
    videoTrack: null,
    audioTrack: null
};

var localTrackState = {
    videoTrackEnabled: true,
    audioTrackEnabled: true
}

var remoteUsers = {};
// Agora client options
var options = {
    appid: null,
    channel: null,
    uid: null,
    token: null
};

$("#join-form").submit(async function (e) {
    e.preventDefault();
    $("#join").attr("disabled", true);
    try {
        options.appid = $("#appid").val();
        options.channel = $("#channel").val();
        await join();
    } catch (error) {
        console.error(error);
    } finally {
        $("#leave").attr("disabled", false);
    }
});

$("#leave").click(function (e) {
    leave();
});

$("#mic-btn").click(function (e) {
    if (localTrackState.audioTrackEnabled) {
        muteAudio();
    } else {
        unmuteAudio();
    }
});

$("#video-btn").click(function (e) {
    if (localTrackState.videoTrackEnabled) {
        muteVideo();
    } else {
        unmuteVideo();
    }
})

async function join() {
    $("#mic-btn").prop("disabled", false);
    $("#video-btn").prop("disabled", false);
    // add event listener to play remote tracks when remote users join, publish and leave.
    client.on("user-published", handleUserPublished);
    client.on("user-joined", handleUserJoined);
    client.on("user-left", handleUserLeft);

    // join a channel and create local tracks, we can use Promise.all to run them concurrently
    [options.uid, localTracks.audioTrack, localTracks.videoTrack] = await Promise.all([
        // join the channel
        client.join(options.appid, options.channel, options.token || null),
        // create local tracks, using microphone and camera
        AgoraRTC.createMicrophoneAudioTrack(),
        AgoraRTC.createCameraVideoTrack()
    ]);
    showMuteButton();
    // play local video track
    localTracks.videoTrack.play("local-player");
    $("#local-player-name").text(`localVideo(${options.uid})`);
    // publish local tracks to channel
    await client.publish(Object.values(localTracks));
    console.log("publish success");
}

async function leave() {
    for (trackName in localTracks) {
        var track = localTracks[trackName];
        if (track) {
            track.stop();
            track.close();
            $('#mic-btn').prop('disabled', true);
            $('#video-btn').prop('disabled', true);
            localTracks[trackName] = undefined;
        }
    }

    // remove remote users and player views
    remoteUsers = {};
    $("#remote-playerlist").html("");
    // leave the channel
    await client.leave();
    $("#local-player-name").text("");
    $("#join").attr("disabled", false);
    $("#leave").attr("disabled", true);
    hideMuteButton();
    console.log("client leaves channel success");
}

async function subscribe(user, mediaType) {
    const uid = user.uid;
    // subscribe to a remote user
    await client.subscribe(user, mediaType);
    console.log("subscribe success");

    // if the video wrapper element is not exist, create it.
    if (mediaType === 'video') {
        if ($(`#player-wrapper-${uid}`).length === 0) {
            const player = $(`
        <div id="player-wrapper-${uid}" class="col col-xl-6">
          <p class="player-name">remoteUser(${uid})</p>
          <div id="player-${uid}" class="player"></div>
        </div>
      `);
            $("#remote-playerlist").append(player);
        }
        // play the remote video.
        user.videoTrack.play(`player-${uid}`);
    }
    if (mediaType === 'audio') {
        user.audioTrack.play();
    }
}

// Handle user join
function handleUserJoined(user) {
    const id = user.uid;
    remoteUsers[id] = user;
}

// Handle user leave
function handleUserLeft(user) {
    const id = user.uid;
    delete remoteUsers[id];
    $(`#player-wrapper-${id}`).remove();
}

// Handle user published
function handleUserPublished(user, mediaType) {
    subscribe(user, mediaType);
}

// Hide mute button
function hideMuteButton() {
    $("#video-btn").css("display", "none");
    $("#mic-btn").css("display", "none");
}

// Display mute button
function showMuteButton() {
    $("#video-btn").css("display", "inline-block");
    $("#mic-btn").css("display", "inline-block");
}

// Mute audio function
async function muteAudio() {
    if (!localTracks.audioTrack) return;
    await localTracks.audioTrack.setEnabled(false);
    localTrackState.audioTrackEnabled = false;
    $("#mic-btn").text("Unmute Audio");
    $("#local-player").css({
        "box-shadow": "none"
    });
}

// Mute video function
async function muteVideo() {
    if (!localTracks.videoTrack) return;
    await localTracks.videoTrack.setEnabled(false);
    localTrackState.videoTrackEnabled = false;
    $("#video-btn").text("Unmute Video");
}

// Unmute audio function
async function unmuteAudio() {
    if (!localTracks.audioTrack) return;
    await localTracks.audioTrack.setEnabled(true);
    localTrackState.audioTrackEnabled = true;
    $("#mic-btn").text("Mute Audio");
}

// Unmute video function
async function unmuteVideo() {
    if (!localTracks.videoTrack) return;
    await localTracks.videoTrack.setEnabled(true);
    localTrackState.videoTrackEnabled = true;
    $("#video-btn").text("Mute Video");
}

// Find active speakers
client.enableAudioVolumeIndicator();
client.on("volume-indicator", volumes => {
    volumes.forEach((volume) => {
        console.log(`UID ${volume.uid} Level ${volume.level}`);
        if (options.uid == volume.uid && volume.level > 5) {
            $("#local-player").css({
                "box-shadow": "0 2px 4px 0 #0C9DFD, 0 2px 5px 0 #0C9DFD"
            });
        } else if (options.uid == volume.uid && volume.level < 5) {
            $("#local-player").css({
                "box-shadow": "none"
            });
        }
        if (options.uid != volume.uid && volume.level > 5) {
            $("#player-" + volume.uid).css({
                "box-shadow": "0 2px 4px 0 #0C9DFD, 0 2px 5px 0 #0C9DFD"
            });
        } else if (options.uid != volume.uid && volume.level < 5) {
            $("#player-" + volume.uid).css({
                "box-shadow": "none"
            });
        }
    });
})