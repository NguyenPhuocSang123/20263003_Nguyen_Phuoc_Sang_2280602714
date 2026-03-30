var express = require("express");
var router = express.Router();
var mongoose = require("mongoose");
var multer = require("multer");
var path = require("path");

let MessageModel = require("../schemas/messages");
let { checkLogin } = require("../utils/authHandler.js");

// Upload file nhắn tin (nếu có gửi kèm file)
let storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    let ext = path.extname(file.originalname);
    let fileName = Date.now() + "-" + Math.round(Math.random() * 1000000000) + ext;
    cb(null, fileName);
  },
});

let upload = multer({
  storage: storage,
  limits: 10 * 1024 * 1024, // 10MB
});

// GET /  - lấy tin nhắn cuối cùng của mỗi “đối tác” với user hiện tại
router.get("/", checkLogin, async function (req, res, next) {
  let currentId = req.userId;
  if (!mongoose.isValidObjectId(currentId)) {
    return res.status(400).send({ message: "userId không hợp lệ" });
  }

  let currentObjectId = new mongoose.Types.ObjectId(currentId);

  // otherUser: đối tác = (message.from == current ? message.to : message.from)
  let conversations = await MessageModel.aggregate([
    {
      $match: {
        $or: [{ from: currentObjectId }, { to: currentObjectId }],
      },
    },
    {
      $addFields: {
        otherUser: {
          $cond: [{ $eq: ["$from", currentObjectId] }, "$to", "$from"],
        },
      },
    },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: "$otherUser",
        message: { $first: "$$ROOT" },
      },
    },
    {
      $project: {
        _id: 0,
        userId: "$_id",
        message: 1,
      },
    },
    { $sort: { "message.createdAt": -1 } },
  ]);

  res.send(conversations);
});

// GET /:userID - lấy toàn bộ message giữa 2 user (2 chiều)
router.get("/:userID", checkLogin, async function (req, res, next) {
  let currentId = req.userId;
  let otherId = req.params.userID;

  if (!mongoose.isValidObjectId(currentId) || !mongoose.isValidObjectId(otherId)) {
    return res.status(400).send({ message: "userId không hợp lệ" });
  }

  let currentObjectId = new mongoose.Types.ObjectId(currentId);
  let otherObjectId = new mongoose.Types.ObjectId(otherId);

  let messages = await MessageModel.find({
    $or: [
      { from: currentObjectId, to: otherObjectId },
      { from: otherObjectId, to: currentObjectId },
    ],
  }).sort({ createdAt: 1 });

  res.send(messages);
});

// POST /  - gửi message (text hoặc file)
// Body:
// - to: userID
// - nếu gửi file: multipart/form-data field name = "file"
// - nếu gửi text: body.text (hoặc body.messageContent.text)
router.post("/", checkLogin, upload.single("file"), async function (req, res, next) {
  let currentId = req.userId;
  let toId = req.body.to;

  if (!mongoose.isValidObjectId(currentId) || !mongoose.isValidObjectId(toId)) {
    return res.status(400).send({ message: "to/userId không hợp lệ" });
  }

  let messageContent;
  if (req.file) {
    messageContent = {
      type: "file",
      text: req.file.path, // path dẫn đến file đã upload
    };
  } else {
    // Text message
    let text = req.body.text || (req.body.messageContent ? req.body.messageContent.text : null) || req.body.message;
    if (!text) {
      return res.status(400).send({ message: "text message không được rỗng" });
    }

    messageContent = {
      type: "text",
      text: text,
    };
  }

  let newMessage = await MessageModel.create({
    from: currentId,
    to: toId,
    messageContent: messageContent,
  });

  res.send(newMessage);
});

module.exports = router;

