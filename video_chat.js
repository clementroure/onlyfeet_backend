require('dotenv').config();
const fs = require("fs");
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const admin = require("firebase-admin");
const AWS = require('aws-sdk');

// Firebase Initialization //
var serviceAccount = require("./google.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `${process.env.FB_DATABASE_URL}`
});
const db = admin.firestore();

// S3 Storage Initialization //
const spacesEndpoint = new AWS.Endpoint(`${process.env.DO_SPACES_ENDPOINT}`);
const s3 = new AWS.S3({
  endpoint: spacesEndpoint,
  accessKeyId: `${process.env.DO_SPACES_KEY}`,
  secretAccessKey: `${process.env.DO_SPACES_SECRET}`,
});

//
process.on("message", (payload) => {
const { tempFilePath, name, new_convo, conversations_id, conversations_user_0, conversations_user_1, conversations_last_msg, messages_id, messages_convo_id, messages_sender, messages_text, messages_media_url, messages_is_snap, messages_is_locked} = payload;
const endProcess = (endPayload) => {
  const { statusCode, text } = endPayload;
  // Remove temp file
  fs.unlink(tempFilePath, (err) => {
    if (err) {
      process.send({ statusCode: 500, text: err.message });
    }
  });
  // Format response so it fits the api response
  process.send({ statusCode, text });
  // End process
  process.exit();
};
// Process video and send back the result
ffmpeg(tempFilePath)
  .toFormat('mp4')
  .setDuration(10)
  .fps(30)
  .audioChannels(1)
  .size('1080x?')
  .addOptions(["-crf 28"]) 
  .on("end", () => { 

    fs.readFile((`./temp/${name}`), function (err, data) {
       
      let params_output = {Bucket: `${process.env.DO_SPACES_NAME}`, Key: "messages/videos/"+ messages_id, Body: data, ContentType: 'video/mp4', ACL:'public-read'};
      s3.upload(params_output)
      .on('httpUploadProgress', function(evt) { 
        console.log(evt); 
      })
      .send(async function(err, data) { 

        console.log(data) 

        fs.unlink(`./temp/${name}`, function (err) {
          if (err) throw err;
          console.log("File deleted");
        });

        if(new_convo == "false"){
          const data_conversations = {
            last_msg: conversations_last_msg,
            last_msg_date: new Date(),
          };  
          const data_messages = {
            id: messages_id,
            convo_id: messages_convo_id,
            sender: messages_sender,
            text: messages_text,
            media_url: messages_media_url,
            isAudio: false,
            isVideo: false,
            isSnap: messages_is_snap,
            isLocked: messages_is_locked,
            date: new Date(),
          }; 
          await db.collection('conversations').doc(conversations_id).update(data_conversations).catch(err => endProcess({ statusCode: 400, text: err }));
          await db.collection('messages').doc(messages_id).set(data_messages).catch(err => endProcess({ statusCode: 400, text: err }));
        }
        else{
          const data_conversations = {
            id : conversations_id,
            user_0: conversations_user_0,
            user_1: conversations_user_1,
            last_msg: conversations_last_msg,
            blocked_status: 0,
            last_msg_date: new Date(),
          };  
          const data_messages = {
            video_url: video_url,
            desc: video_desc,
            thumbnail_url: "",
            likes: 0,
            score: 0,
            date: new Date(),
          }; 
          await db.collection('conversations').doc(conversations_id).update(data_conversations).catch(err => endProcess({ statusCode: 400, text: err }));
          await db.collection('messages').doc(messages_id).update(data_messages).catch(err => endProcess({ statusCode: 400, text: err }));
        }

        endProcess({ statusCode: 200, text: "Success" });
      });
    });
  })
  .on("error", (err) => {
    endProcess({ statusCode: 500, text: err.message });
  }).save(`./temp/${name}`);
});