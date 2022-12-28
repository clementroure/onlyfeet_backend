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
const { tempFilePath, name, video_id, video_url, video_desc, user_id, first_video } = payload;
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
       
      let params_output = {Bucket: `${process.env.DO_SPACES_NAME}`, Key: "videos/"+video_id+".mp4", Body: data, ContentType: 'video/mp4', ACL:'public-read'};
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

        if(first_video == "true"){
          const data = {
            id : video_id,
            user_id: user_id,
            video_url: video_url,
            desc: video_desc,
            thumbnail_url: "",
            likes: 0,
            score: 0,
            date: new Date(),
          };  
          await db.collection('videos').doc(video_id).set(data).catch(err => endProcess({ statusCode: 400, text: err }));
        }
        else{
          const data = {
            video_url: video_url,
            desc: video_desc,
            thumbnail_url: "",
            likes: 0,
            score: 0,
            date: new Date(),
          };  
          await db.collection('videos').doc(video_id).update(data).catch(err => endProcess({ statusCode: 400, text: err }));
        }

        endProcess({ statusCode: 200, text: "Success" });
      });
    });
  })
  .on("error", (err) => {
    endProcess({ statusCode: 500, text: err.message });
  }).save(`./temp/${name}`);
});