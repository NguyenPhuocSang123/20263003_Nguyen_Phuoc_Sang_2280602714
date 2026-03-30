const mongoose = require("mongoose");

// Tin nhắn giữa 2 user (chat 1-1)
const messageSchema = new mongoose.Schema(
  {
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },
    to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },
    messageContent: {
      type: {
        type: String,
        enum: ["file", "text"],
        required: true,
      },
      // Nếu messageContent.type === 'text' => lưu nội dung text
      // Nếu messageContent.type === 'file' => lưu path tới file đã upload
      text: {
        type: String,
        required: true,
      },
    },
  },
  {
    timestamps: true, // tạo createdAt/updatedAt phục vụ sắp xếp “tin nhắn cuối”
  }
);

messageSchema.index({ from: 1, to: 1, createdAt: -1 });

module.exports = mongoose.model("message", messageSchema);

