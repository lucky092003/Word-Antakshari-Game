const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const cors = require("cors");
const fs = require("fs");

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

// MongoDB Connection
mongoose.connect("mongodb://localhost:27017/word_antakshari", {});
const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));

db.once("open", async () => {
  console.log("Connected to MongoDB");
});

// Word Schema and Model
const wordSchema = new mongoose.Schema({
  word: String,
  length: Number
});
const Word = mongoose.model("Word", wordSchema);

// Player Schema and Model
const playerSchema = new mongoose.Schema({
  name: String,
  score: Number,
  streak: Number
});
const Player = mongoose.model("Player", playerSchema);

// random starting word that exists in the dictionary
const getRandomWord = async () => {
  const count = await Word.countDocuments();
  const random = Math.floor(Math.random() * count);
  const word = await Word.findOne().skip(random);
  return word.word;
};

// random next word for the computer
const getNextWord = async (lastLetter) => {
  const words = await Word.find({ word: new RegExp(`^${lastLetter}`, 'i') });
  if (words.length > 0) {
    const randomIndex = Math.floor(Math.random() * words.length);
    return words[randomIndex].word;
  }
  return null;
};

let currentWord = "";

// Start Game 
app.get("/start", async (req, res) => {
  currentWord = await getRandomWord();
  res.json({ word: currentWord });
});

// Validate Player Input and Generate Next Word
app.post("/play", async (req, res) => {
  const { playerName, word } = req.body;
  if (!word || word[0].toLowerCase() !== currentWord.slice(-1)) {
    return res.json({ valid: false, message: "Invalid word! Must start with " + currentWord.slice(-1) });
  }
  
  const exists = await Word.findOne({ word: word.toLowerCase() });
  if (!exists) {
    return res.json({ valid: false, message: "Word not found in dictionary!" });
  }
  
  // Update Player Score
  let player = await Player.findOne({ name: playerName });
  if (!player) {
    player = new Player({ name: playerName, score: 0, streak: 0 });
  }
  
  player.streak += 1;
  player.score += word.length + (player.streak * 2) + 1; // Bonus for streak & extra point
  await player.save();
  
  // Get next word for the computer
  const nextWord = await getNextWord(word.slice(-1));
  if (!nextWord) {
    return res.json({ valid: true, message: "You won! No more words left!", score: player.score });
  }
  
  currentWord = nextWord;
  res.json({ valid: true, nextWord: currentWord, score: player.score });
});

// Leaderboard
app.get("/leaderboard", async (req, res) => {
  const leaderboard = await Player.find().sort({ score: -1 }).limit(10);
  res.json(leaderboard);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
