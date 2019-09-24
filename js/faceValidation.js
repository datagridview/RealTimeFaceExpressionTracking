let username = $('#username').val();
let forwardTimes = [];
let withFaceLandmarks = false;
let withBoxes = true;
let faceMatcher = null;

function getFeatures(username) {
    let result = axios.get("http://162.105.142.90:8080/api/persons/?name="+username)
        .then(function (response) {
            console.log(response.data.results);
            if(response.data.results.length === 1)
                return response.data.results[0].features;
            else if(response.data.count === 0){
                return "0";
            }

        })
        .catch(function (e) {
            console.log(e);
        });
    return result;
}


$('#btn-login').click(async function (event) {
    event.preventDefault();
    $('#spinner').css('display', 'inline');
    $('#login').css('display', 'none');
    $('#validate').css('display', 'inline');
    let input = $('.validate-input .input100');
    for (var i = 0; i < input.length; i++) {
        if (validate(input[i]) === false) {
            showValidate(input[i]);
        }
    }
    $('.validate-form .input100').each(function () {
        $(this).focus(function () {
            hideValidate(this);
        });
    });

    function validate(input) {
        if ($(input).attr('type') === 'email' || $(input).attr('name') === 'email') {
            if ($(input).val().trim().match(/^([a-zA-Z0-9_\-\.]+)@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.)|(([a-zA-Z0-9\-]+\.)+))([a-zA-Z]{1,5}|[0-9]{1,3})(\]?)$/) == null) {
                return false;
            }
        } else {
            if ($(input).val().trim() === '') {
                return false;
            }
        }
    }

    function showValidate(input) {
        var thisAlert = $(input).parent();

        $(thisAlert).addClass('alert-validate');
    }

    function hideValidate(input) {
        var thisAlert = $(input).parent();

        $(thisAlert).removeClass('alert-validate');
    }

    let username = $("#username").val();
    let password = $("#password").val();
    let host = "http://104.224.196.44:4700";
    axios.get(host, {
        params: {
            type: "login",
            username: username,
            password: password
        }
    })
        .then(function (response) {

            if (response.data !== "login_false" && response.data !== "You are Hacker because your user info has invalid character! Welcome to www.CSIEC.com") {
                // window.location.href = "track.html";
                sessionStorage.setItem("username", username);
                sessionStorage.setItem("password", password);
                sessionStorage.setItem("welcome", response.data);
                $('#spinner').css('display', 'none');
                $('#done').css('display', 'inline');
                $('#Modal2').modal('show');
                getPerson(username);
            } else {
                showValidate(input[2])
            }
        })
        .catch(function (error) {
            console.log(error.data);
        });

});

$('#validate').click(function (e) {
    e.preventDefault();
    $('#Modal2').modal('toggle');
    $('#Modal1').modal('show');
    initFaceDetectionControls();
    run();
});

$('#add-reference').click(function (e) {
    e.preventDefault();
    window.open('facerec.html');
});

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
    let task = faceapi.detectAllFaces(videoEl, options).withFaceLandmarks().withFaceExpressions().withFaceDescriptors();
    // task = withFaceLandmarks ? task.withFaceLandmarks().withFaceExpressions() : task.withFaceExpressions();
    const results = await task;

    updateTimeStats(Date.now() - ts);
    const canvas = $('#overlay').get(0);
    canvas.innerHeight = videoEl.videoHeight;
    console.log(videoEl.videoHeight);
    canvas.innerWidth = videoEl.videoWidth;
    const dims = faceapi.matchDimensions(canvas, videoEl, true);

    const resizedResults = faceapi.resizeResults(results, dims);


    let username = sessionStorage.getItem("username");
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

    if(results.length){
        faceMatcher = new faceapi.FaceMatcher(labeledDescriptors);
        let faceObject = {};
        faceObject.names = [];
        resizedResults.forEach(({detection, descriptor, expressions}) => {
            const expression = Object.keys(expressions).sort(function(a,b){return expressions[b]-expressions[a]})[0];
            // console.log(expression);
            const label = faceMatcher.findBestMatch(descriptor).toString();
            // console.log(label);
            faceObject.names.push((label !== "unknown")? label.split(' ')[0]:label);
            const options = {label};
            const drawBox = new faceapi.draw.DrawBox(detection.box, options);
            drawBox.draw(canvas);
        });
        if (-1 !== faceObject.names.indexOf(username)) {
            console.log(faceObject.names.indexOf(username));
            faceapi.draw.drawFaceExpressions(canvas, resizedResults, minConfidence);
            window.location.href = "track.html";
        }
    }
    setTimeout(() => onPlay(videoEl));
}

async function getPerson(username) {
    let f = await getFeatures(username);
    console.log(f);
    if(f === '0'){
        $('#validate').css('display','none');
    }
}

async function run() {
    await changeFaceDetector(SSD_MOBILENETV1);
    await faceapi.loadFaceLandmarkModel('models');
    await faceapi.loadFaceExpressionModel('models');
    await faceapi.loadFaceRecognitionModel('models');
    $('#ModalSpinner').css('display', 'none');
    changeInputSize(224);
    // try to access users webcam and stream the images
    // to the video element
    const stream = await navigator.mediaDevices.getUserMedia({video: {width: 400, height: 225 }});
    const videoEl = $('#inputVideo').get(0);
    videoEl.srcObject = stream;
    let username = sessionStorage.getItem('username');
    let f = await getFeatures(username);
    sessionStorage.setItem('features',f);
}
