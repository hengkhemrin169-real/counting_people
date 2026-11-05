
// ==================================
// AI PEOPLE COUNTER
// ==================================

let model = null;
let modelPromise = null;

let video = null;
let stream = null;

let running = false;
let detecting = false;
let animationId = null;


// ==================================
// LOAD AI MODEL
// ==================================

async function loadModel() {

    if (model) {
        return model;
    }

    if (!modelPromise) {

        modelPromise = (async () => {

            if (
                typeof tf === "undefined" ||
                typeof cocoSsd === "undefined"
            ) {
                throw new Error(
                    "AI libraries not loaded. Check internet connection."
                );
            }

            await tf.ready();

            const loadedModel = await cocoSsd.load({
                base: "lite_mobilenet_v2"
            });

            model = loadedModel;

            return model;

        })();

    }

    try {

        return await modelPromise;

    } catch (error) {

        modelPromise = null;
        throw error;

    }
}


// ==================================
// DRAW PEOPLE DETECTION
// ==================================

function drawPeople(ctx, predictions, threshold = 0.55) {

    let people = 0;

    predictions.forEach(person => {

        if (
            person.class !== "person" ||
            person.score < threshold
        ) {
            return;
        }

        people++;

        const [x, y, w, h] = person.bbox;

        // Green detection box

        ctx.strokeStyle = "#00ff00";
        ctx.lineWidth = 3;

        ctx.strokeRect(x, y, w, h);

        // Detection label

        const label =
            "Person " +
            Math.round(person.score * 100) +
            "%";

        ctx.font = "bold 15px Arial";

        const labelWidth =
            ctx.measureText(label).width + 12;

        const labelY = Math.max(0, y - 26);

        ctx.fillStyle = "#16a34a";

        ctx.fillRect(
            x,
            labelY,
            labelWidth,
            25
        );

        ctx.fillStyle = "white";

        ctx.fillText(
            label,
            x + 6,
            labelY + 18
        );

    });

    return people;
}


// ==================================
// START CAMERA
// ==================================

async function startCamera() {

    if (running) return;

    const status =
        document.getElementById("status");

    const startBtn =
        document.getElementById("startBtn");

    try {

        startBtn.disabled = true;

        status.textContent =
            "Connecting to camera...";

        if (!navigator.mediaDevices?.getUserMedia) {

            throw new Error(
                "Please use localhost or HTTPS to access camera."
            );

        }

        // Request camera permission

        stream = await navigator.mediaDevices.getUserMedia({

            video: {
                facingMode: "environment",
                width: { ideal: 640 },
                height: { ideal: 480 }
            },

            audio: false

        });

        video = document.createElement("video");

        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;

        await video.play();

        const canvas =
            document.getElementById("canvas");

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        running = true;

        status.textContent =
            "Camera connected. Loading AI model...";

        await loadModel();

        if (!running) return;

        status.textContent =
            "AI Ready - Detecting People Live";

        detectPeople();

    } catch (error) {

        console.error(error);

        status.textContent =
            "Error: " + error.message;

        stopCamera();

    } finally {

        startBtn.disabled = false;

    }

}


// ==================================
// LIVE CAMERA DETECTION
// ==================================

async function detectPeople() {

    if (!running || detecting) return;

    detecting = true;

    try {

        const canvas =
            document.getElementById("canvas");

        const ctx = canvas.getContext("2d");

        const predictions =
            await model.detect(video);

        if (!running) return;

        // Draw camera video

        ctx.drawImage(
            video,
            0,
            0,
            canvas.width,
            canvas.height
        );

        // Count people

        const people = drawPeople(
            ctx,
            predictions
        );

        document.getElementById("total").textContent =
            people;

    } catch (error) {

        console.error(
            "Camera detection error:",
            error
        );

    } finally {

        detecting = false;

    }

    if (running) {

        animationId =
            requestAnimationFrame(detectPeople);

    }

}


// ==================================
// STOP CAMERA
// ==================================

function stopCamera() {

    running = false;

    if (animationId !== null) {

        cancelAnimationFrame(animationId);

        animationId = null;

    }

    if (stream) {

        stream.getTracks().forEach(track => {
            track.stop();
        });

        stream = null;

    }

    if (video) {

        video.pause();
        video.srcObject = null;
        video = null;

    }

    detecting = false;

    const canvas =
        document.getElementById("canvas");

    const ctx = canvas.getContext("2d");

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    document.getElementById("total").textContent =
        "0";

    document.getElementById("status").textContent =
        "Camera stopped";

}


// ==================================
// UPLOAD IMAGE AND COUNT PEOPLE
// ==================================

async function countImagePeople() {

    const file =
        document.getElementById("imageUpload").files[0];

    const status =
        document.getElementById("imageStatus");

    const result =
        document.getElementById("imageCount");

    const button =
        document.getElementById("countBtn");

    const canvas =
        document.getElementById("imageCanvas");

    const ctx = canvas.getContext("2d");

    // Check image

    if (!file) {

        alert("Please select an image first!");

        return;

    }

    if (!file.type.startsWith("image/")) {

        alert("Please select a valid image!");

        return;

    }

    let imageURL = null;

    try {

        button.disabled = true;

        status.textContent =
            "Loading image...";

        result.textContent = "0";

        // Read uploaded image

        const image = new Image();

        imageURL = URL.createObjectURL(file);

        image.src = imageURL;

        await new Promise((resolve, reject) => {

            image.onload = resolve;

            image.onerror = () => {
                reject(
                    new Error("Cannot open this image.")
                );
            };

        });

        // Resize image for AI processing

        const scale = Math.min(
            1,
            1200 / image.naturalWidth,
            1200 / image.naturalHeight
        );

        canvas.width = Math.round(
            image.naturalWidth * scale
        );

        canvas.height = Math.round(
            image.naturalHeight * scale
        );

        // Draw original image

        ctx.drawImage(
            image,
            0,
            0,
            canvas.width,
            canvas.height
        );

        status.textContent =
            "Loading AI model...";

        // Load AI model

        await loadModel();

        status.textContent =
            "AI detecting people...";

        // Detect people

        const predictions =
            await model.detect(canvas);

        // Draw green boxes

        const people = drawPeople(
            ctx,
            predictions
        );

        // Show total count

        result.textContent = people;

        status.textContent =
            "Detection completed successfully!";

    } catch (error) {

        console.error(error);

        status.textContent =
            "Error: " + error.message;

    } finally {

        if (imageURL) {
            URL.revokeObjectURL(imageURL);
        }

        button.disabled = false;

    }

}
