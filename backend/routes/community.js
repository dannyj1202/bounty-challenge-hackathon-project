import express from "express";

const router = express.Router();

let posts = [];
let idCounter = 1;

// Get all posts
router.get("/", (req, res) => {
  res.json(posts);
});

// Create a new question
router.post("/", (req, res) => {
  const { message } = req.body;

  posts.unshift({
    id: idCounter++,
    message,
    time: new Date().toLocaleString(),
    replies: []
  });

  res.status(201).json({ success: true });
});

// Add a reply to a specific question
router.post("/:id/reply", (req, res) => {
  const { message } = req.body;
  const post = posts.find(p => p.id === Number(req.params.id));

  if (!post) {
    return res.status(404).json({ error: "Post not found" });
  }

  post.replies.push({
    message,
    time: new Date().toLocaleString()
  });

  res.status(201).json({ success: true });
});

export default router;