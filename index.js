const express = require("express");
const cors = require("cors");
const { fork } = require("child_process");
const fileUpload = require("express-fileupload");
const admin = require("firebase-admin");

// Create a new express application instance
const PORT = 4000;
const app = express();

// Firebase Initialization //
var serviceAccount = require("./google.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `${process.env.FB_DATABASE_URL}`
});

// Verify if the HTTP Request has been created on my React.js app and is not fradulent
const appCheckVerification = async (req, res, next) => {
  const appCheckToken = req.header("X-Firebase-AppCheck");

  if (!appCheckToken) {
    res.status(401);
    return next("Unauthorized");
  }

  try {
    const appCheckClaims = await admin.appCheck().verifyToken(appCheckToken);
    return next();
  } catch (err) {
    res.status(401);
    return next("Unauthorized: " + err);
  }
};

// Middleware
app.use(cors());
app.use(express.json());
app.use(
  fileUpload({
    tempFileDir: "temp",
    useTempFiles: true,
  })
);
// CORS Policy
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', '*');
  res.header('Access-Control-Allow-Credentials', '*');
  next();
});
// Routes
app.post("/compress-video", (req, res) => {
  const video = req.files.video;

  // When file is uploaded it is stored in temp file
  // this is made possible by express-fileupload
  const tempFilePath = video.tempFilePath;

  if (video && tempFilePath) {
    // Create a new child process
    const child = fork("video.js");
    // Send message to child process
    child.send({ tempFilePath, name: video.name, video_id: req.body.video_id, video_url: req.body.video_url, video_desc: req.body.video_desc, user_id: req.body.user_id, first_video: req.body.first_video });
    // Listen for message from child process
    child.on("message", (message) => {
      const { statusCode, text } = message;
      res.status(statusCode).send(text);
    });
  } else {
    res.status(400).send("No file uploaded");
  }
});

app.post("/compress-video-chat", (req, res) => {
  const video = req.files.video;

  // When file is uploaded it is stored in temp file
  // this is made possible by express-fileupload
  const tempFilePath = video.tempFilePath;

  if (video && tempFilePath) {
    // Create a new child process
    const child = fork("video_chat.js");
    // Send message to child process
    child.send({ tempFilePath, new_convo: req.body.new_convo, conversations_id: req.body.conversations_id, conversations_user_0: req.body.conversations_user_0, conversations_user_1: req.body.conversations_user_1, conversations_last_msg: req.body.conversations_last_msg, messages_id: req.body.messages_id, messages_convo_id: req.body.messages_convo_id, messages_sender: req.body.messages_sender, messages_text: req.body.messages_text, messages_media_url: req.body.messages_media_url, messages_is_snap: req.body.messages_is_snap, messages_is_locked: req.body.messages_is_locked});
    // Listen for message from child process
    child.on("message", (message) => {
      const { statusCode, text } = message;
      res.status(statusCode).send(text);
    });
  } else {
    res.status(400).send("No file uploaded");
  }
});

// notifs with firebase
app.post("/notif", [appCheckVerification], (req, res) => { 

  const registrationToken = req.body.fcm_token;
  const message = {
    title: req.body.title,
    body: req.body.body
  };
  const payload = { 
          notification: {
              title: req.body.title,
              body: req.body.body,
              interlocutorId: req.body.interlocutorId,
              interlocutorUsername: req.body.interlocutorUsername,
              interlocutorPicture: req.body.interlocutorPicture,
              convoId: req.body.convoId,
              msgId: req.body.msgId,
              date: req.body.date,
              media: req.body.media,
              isVideo: req.body.isVideo,
              isAudio: req.body.isAudio,
              isLocked: req.body.isLocked,
              isSnap: req.body.isSnap,
              fcm_token: req.body.fcm_token,
              is_creator: req.body.is_creator,
          }
  };
  const options = {
    priority: "high",
    timeToLive: 60*60*24,
  }

  admin.messaging().sendToDevice(registrationToken, payload, options)
    .then(function(response) {
    console.log("Successfully sent message:", response);
    })
    .catch(function(error) {
    console.log("Error sending message:", error);
  });

  //response.status(201).json({received: "FCM ok"});
  res.status(200).send({result: message});
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server started on  http://localhost:${PORT}`)
});