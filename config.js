const AWS = require('aws-sdk')
const s3Config = {
 apiVersion: '2006-03-01',
 accessKeyId: config.accessKeyId,
 secretAccessKey: config.secretAccessKey,
 region: config.region,
}
const s3 = new AWS.S3(s3Config)