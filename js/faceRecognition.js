let forwardTimes = [];
let withFaceLandmarks = false;
let withBoxes = true;
let faceMatcher = null;
let username = sessionStorage.getItem("username");
let password = sessionStorage.getItem("password");

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

function getFeatures() {
    let result = axios.get("http://162.105.142.90:8080/api/persons/?name="+username)
        .then(function (response) {
            return response.data.results[0].features;
        })
        .catch(function (e) {
            console.log(e);
        });
    return result;
}

async function onPlay(videoEl) {
    if (!videoEl.currentTime || videoEl.paused || videoEl.ended || !isFaceDetectionModelLoaded())
        return setTimeout(() => onPlay(videoEl));
    const options = getFaceDetectorOptions();
    const ts = Date.now();
    const drawBoxes = withBoxes;
    const drawLandmarks = withFaceLandmarks;
    let task = faceapi.detectAllFaces(videoEl, options).withFaceLandmarks().withFaceExpressions().withFaceDescriptors();
    // task = withFaceLandmarks ? task.withFaceLandmarks().withFaceExpressions() : task.withFaceExpressions();
    const results = await task;

    updateTimeStats(Date.now() - ts);
    const canvas = $('#overlay').get(0);
    const dims = faceapi.matchDimensions(canvas, videoEl, true);

    const resizedResults = faceapi.resizeResults(results, dims);
    // const labels = faceMatcher.labeledDescriptors
    //     .map(ld => ld.label);
    let labeldFeatures = sessionStorage.getItem("features");
    let labeldlist = labeldFeatures.split('[')[1].split(']')[0];
    let labeldFeaturestmp = labeldlist.split(',');
    // labeldFeatures.forEach(function(letter){
    //     return parseFloat(letter);
    // });
    labeldFeatures = new Float32Array(labeldFeaturestmp);
    const labeledDescriptors = [
        new faceapi.LabeledFaceDescriptors(
            username,
            [labeldFeatures]
        ),
    ];

    if(results.length){
        faceMatcher = new faceapi.FaceMatcher(labeledDescriptors);
        let faceObject = {};
        resizedResults.forEach(({detection, descriptor, expressions}) => {
            const expression = Object.keys(expressions).sort(function(a,b){return expressions[b]-expressions[a]})[0];
            // console.log(expression);
            const label = faceMatcher.findBestMatch(descriptor).toString();
            // console.log(label);
            faceObject.names = [];
            faceObject.names.append(label);
            const options = {label};
            const drawBox = new faceapi.draw.DrawBox(detection.box, options);
            drawBox.draw(canvas);
        });
        if(faceObject.names.indexOf(username) === -1){
            // TODO: add the voice in the box;
        }

    }


    if (drawBoxes) {
        // faceapi.draw.drawDetections(canvas, resizedResults);
        faceapi.draw.drawFaceExpressions(canvas, resizedResults, minConfidence);
    }
    if (drawLandmarks) {
        faceapi.draw.drawFaceLandmarks(canvas, resizedResults);
        faceapi.draw.drawFaceExpressions(canvas, resizedResults, minConfidence);
    }

    // resizedResults.forEach(({detection, descriptor}) => {
    //     const label = faceMatcher.findBestMatch(descriptor).toString();
    //     const options = {label};
    //     const drawBox = new faceapi.draw.DrawBox(detection.box, options);
    //     drawBox.draw(canvas);
    // });

    setTimeout(() => onPlay(videoEl));
}

async function run() {
    await changeFaceDetector(SSD_MOBILENETV1);
    await faceapi.loadFaceLandmarkModel('models');
    await faceapi.loadFaceExpressionModel('models');
    await faceapi.loadFaceRecognitionModel('models');
    changeInputSize(224);
    // try to access users webcam and stream the images
    // to the video element
    const stream = await navigator.mediaDevices.getUserMedia({video: {}});
    const videoEl = $('#inputVideo').get(0);
    videoEl.srcObject = stream;
    let f = await getFeatures();
    sessionStorage.setItem('features',f);
}

$('#btnSend').on('click', function sendMessage() {

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
    $('#user').attr('value', sessionStorage.getItem("username"));
    $('#csiec').attr('value', sessionStorage.getItem("welcome"));
    let audioUrl = "http://audio.dict.cc/speak.audio.php?type=mp3&lang=en&text=" + sessionStorage.getItem("welcome");
    $('#audio').attr('src', audioUrl);
    let audio = $('#audio');
    audio.play();
}

$(document).ready(function () {
    initFaceDetectionControls();
    run();
    init();
});