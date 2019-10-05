let forwardTimes = [];
let withFaceLandmarks = false;
let withBoxes = true;
let faceMatcher = null;
let username = sessionStorage.getItem("username");
let password = sessionStorage.getItem("password");
let absentCount = 0;

function onChangeWithFaceLandmarks(e) {
    withFaceLandmarks = $(e.target).prop('checked')
}

function onChangeHideBoundingBoxes(e) {
    withBoxes = !$(e.target).prop('checked')
}

// update the fps label
function updateTimeStats(timeInMs) {
    forwardTimes = [timeInMs].concat(forwardTimes).slice(0, 30);
    const avgTimeInMs = forwardTimes.reduce((total, t) => total + t) / forwardTimes.length;
    $('#time').val(`${Math.round(avgTimeInMs)} ms`);
    $('#fps').val(`${faceapi.round(1000 / avgTimeInMs)}`);
}

// return the feature of the username
function getFeatures(username, password) {
    let result = axios.get("http://162.105.142.90:8080/api/persons/?name="+username,
        {
        auth: {
            username: username,
            password: password
        }
        })

            .then(function (response) {
            return response.data.results[0].features;
        })
        .catch(function (e) {
            console.log(e);
        });
    return result;
}

// cycle function of video capture
async function onPlay(videoEl) {
    if (!videoEl.currentTime || videoEl.paused || videoEl.ended || !isFaceDetectionModelLoaded())
        return setTimeout(() => onPlay(videoEl));
    const options = getFaceDetectorOptions();
    const ts = Date.now();
    const drawBoxes = withBoxes;
    const drawLandmarks = withFaceLandmarks;
    // operations to detect the facelandmarks, faceExpressions, faceDescriptors
    let results = await faceapi.detectAllFaces(videoEl, options)
        .withFaceLandmarks()
        .withFaceExpressions()
        .withFaceDescriptors();
    updateTimeStats(Date.now() - ts);
    const canvas = $('#overlay').get(0);
    const dims = faceapi.matchDimensions(canvas, videoEl, true);

    // serialize the recognition results
    const resizedResults = faceapi.resizeResults(results, dims);

    // get the features of the reference user stored in the SessionStorage
    // pasre the data into Float32Array
    // unite the username and the features referred before
    let labeldFeatures = sessionStorage.getItem("features");
    let labeldlist = labeldFeatures.split('[')[1].split(']')[0];
    let labeldFeaturestmp = labeldlist.split(',');
    labeldFeatures = new Float32Array(labeldFeaturestmp);
    const labeledDescriptors = [
        new faceapi.LabeledFaceDescriptors(
            username,
            [labeldFeatures]
        ),
    ];

    // create a object to store the username
    // TODO: simplify the names
    let faceObject = {};
    faceObject.names = [];
    if(results.length){
        // realize the faceMatcher to match the face captured in the camera with the labeledFeatures
        faceMatcher = new faceapi.FaceMatcher(labeledDescriptors);
        resizedResults.forEach(({detection, descriptor, expressions}) => {
            const expression = Object.keys(expressions).sort(function(a,b){return expressions[b]-expressions[a]})[0];

            // TODO: not fully realized
            // send the expression to the server
            // console.log(expression);
            // sendEmotions(expression);

            // get the label: username or unknown, pick one in the bi-set
            const label = faceMatcher.findBestMatch(descriptor).toString();
            // console.log(label);
            faceObject.names.push((label !== "unknown")? label.split(' ')[0]:label);
            const options = {label};
            const drawBox = new faceapi.draw.DrawBox(detection.box, options);
            drawBox.draw(canvas);
        });
    }

    // note the user that he is absent in the camera in 50 frames
    if (-1 === faceObject.names.indexOf(username) ) {
        absentCount ++;
        if(absentCount === 50){
            console.log(faceObject.names.indexOf(username));
            let audioUrl = "http://audio.dict.cc/speak.audio.php?type=mp3&lang=en&text=where are you?";
            $('#audio').attr('src', audioUrl);
            let audio = $('#audio');
            absentCount = 0;
        }
    }

    // draw the boxes
    if (drawBoxes) {
        // faceapi.draw.drawDetections(canvas, resizedResults);
        faceapi.draw.drawFaceExpressions(canvas, resizedResults, minConfidence);
    }
    if (drawLandmarks) {
        faceapi.draw.drawFaceLandmarks(canvas, resizedResults);
        faceapi.draw.drawFaceExpressions(canvas, resizedResults, minConfidence);
    }
    setTimeout(() => onPlay(videoEl));
}


// the async function the initalize the Model
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
    let username = sessionStorage.getItem("username");
    let password = sessionStorage.getItem("password");
    let f = await getFeatures(username, password);
    sessionStorage.setItem('features',f);
}

// the moment you click the send button
// you will send message to the csiec bot server
// and get the returned messages from server
// showed on the div above the live2D model
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
                text = response.data;
                showMessage(text, 15000);
                let audioUrl = "http://audio.dict.cc/speak.audio.php?type=mp3&lang=en&text=" + response.data;
                $('#audio').attr('src', audioUrl);
                let audio = $('#audio');
            } else {
                $('#csiec').attr('value', 'error');
            }
        })
        .catch(function (error) {
            console.log(error.data);
        });
});

function init() {
    showMessage("I'm csiec!",2000);
    $('#user').html(sessionStorage.getItem("username"));
    $('#csiec').attr('value', sessionStorage.getItem("welcome"));
    let audioUrl = "http://audio.dict.cc/speak.audio.php?type=mp3&lang=en&text=" + sessionStorage.getItem("welcome");
    showMessage(sessionStorage.getItem("welcome"), 15000);
    $('#audio').attr('src', audioUrl);
    let audio = $('#audio');
}

// easily understand
function sendEmotions(emotions) {
    let username = sessionStorage.getItem("username");
    let password = sessionStorage.getItem("password");
    let host = "http://104.224.196.44:4700";
    axios.get(host, {
        params: {
            username: username,
            password: password,
            text: emotions
        }
    })
        .then(function (response) {
            if (response.data !== "login_false" && response.data !== "You are Hacker because your user info has invalid character! Welcome to www.CSIEC.com") {
                console.log("Emotion transport Sucess!");
            }
        })
        .catch(function (error) {
            console.log(error.data);
        });
}

$(document).ready(function () {
    initFaceDetectionControls();
    run();
    init();
});