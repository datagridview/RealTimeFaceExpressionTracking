let forwardTimes = [];
let withFaceLandmarks = false;
let withBoxes = true;

function onChangeWithFaceLandmarks(e) {
    withFaceLandmarks = $(e.target).prop('checked')
}

function onChangeHideBoundingBoxes(e) {
    withBoxes = !$(e.target).prop('checked')
}

function updateTimeStats(timeInMs) {
    forwardTimes = [timeInMs].concat(forwardTimes).slice(0, 30);
    const avgTimeInMs = forwardTimes.reduce((total, t) => total + t) / forwardTimes.length;
    $('#time').val(`${Math.round(avgTimeInMs)} ms`);
    $('#fps').val(`${faceapi.round(1000 / avgTimeInMs)}`);
}

async function onPlay(videoEl) {
    if (!videoEl.currentTime || videoEl.paused || videoEl.ended || !isFaceDetectionModelLoaded())
        return setTimeout(() => onPlay(videoEl));
    const options = getFaceDetectorOptions();
    const ts = Date.now();
    const drawBoxes = withBoxes;
    const drawLandmarks = withFaceLandmarks;
    let task = faceapi.detectAllFaces(videoEl, options).withFaceLandmarks().withFaceExpressions();
    // task = withFaceLandmarks ? task.withFaceLandmarks().withFaceExpressions() : task.withFaceExpressions();
    const results = await task;
    updateTimeStats(Date.now() - ts);
    const canvas = $('#overlay').get(0);
    const dims = faceapi.matchDimensions(canvas, videoEl, true);

    const resizedResults = faceapi.resizeResults(results, dims);
    if (drawBoxes) {
        faceapi.draw.drawDetections(canvas, resizedResults);
        faceapi.draw.drawFaceExpressions(canvas, resizedResults, minConfidence)
    }
    if (drawLandmarks) {
        faceapi.draw.drawFaceLandmarks(canvas, resizedResults);
        faceapi.draw.drawFaceExpressions(canvas, resizedResults, minConfidence);
    }
    setTimeout(() => onPlay(videoEl));
}

async function run() {
    await changeFaceDetector(SSD_MOBILENETV1);
    await faceapi.loadFaceLandmarkModel('models');
    await faceapi.loadFaceExpressionModel('models');
    changeInputSize(224);
    // try to access users webcam and stream the images
    // to the video element
    const stream = await navigator.mediaDevices.getUserMedia({video: {}});
    const videoEl = $('#inputVideo').get(0);
    videoEl.srcObject = stream;
}

$('#btnSend').on('click', function sendMessage() {
    let username = localStorage.getItem("username");
    let password = localStorage.getItem("password");
    let host = "http://104.224.196.44:4700";
    axios.get(host, {
        params: {
            username: username,
            password: password,
            text: $('#userwords').val()
        }
    })
        .then(function (response) {

            if (response.data !== "login_false" && response.data !== "You are Hacker because your user info has invalid character! Welcome to www.CSIEC.com") {
                $('#csiec').attr('value', response.data);
                let audioUrl = "http://audio.dict.cc/speak.audio.php?type=mp3&lang=en&text=" + response.data;
                $('#audio').attr('src', audioUrl);
                let audio = $('#audio');
                audio.play();
            } else {
                $('#csiec').attr('value', 'error');
            }
        })

        .catch(function (error) {
            console.log(error.data);
        });

});

function init() {
    $('#user').attr('value', localStorage.getItem("username"));
    $('#csiec').attr('value', localStorage.getItem("welcome"));
    let audioUrl = "http://audio.dict.cc/speak.audio.php?type=mp3&lang=en&text=" + localStorage.getItem("welcome");
    $('#audio').attr('src', audioUrl);
    let audio = $('#audio');
    audio.play();
}

$(document).ready(function () {
    initFaceDetectionControls();
    run();
    init();
});