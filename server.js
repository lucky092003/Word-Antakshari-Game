const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

// MongoDB Connection
mongoose.connect("mongodb://localhost:27017/word_antakshari", {});
const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));

const wordSchema = new mongoose.Schema({
  word: String,
  length: Number
});
const Word = mongoose.model("Word", wordSchema);

const WORDS_URL = "https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt";

// Function to fetch & store words 
const checkAndImportWords = async () => {
  const count = await Word.countDocuments();
  if (count === 0) {
    console.log("No words found in DB, fetching from URL...");
    try {
      const response = await axios.get(WORDS_URL);
      const words = response.data.split("\n").map(word => word.trim()).filter(word => word.length > 1);

      console.log(`Total words fetched: ${words.length}`);
      const wordDocs = words.map(word => ({ word, length: word.length }));

      await Word.insertMany(wordDocs);
      console.log("Words successfully stored in MongoDB!");
    } catch (error) {
      console.error("Error fetching/storing words:", error);
    }
  } else {
    console.log(`Words already exist in DB (${count} words), skipping fetch.`);
  }
};

// Run check on server start
db.once("open", async () => {
  console.log("Connected to MongoDB");
  await checkAndImportWords(); 
});

// Random word fetcher
const getRandomWord = async () => {
  const count = await Word.countDocuments();
  const random = Math.floor(Math.random() * count);
  const word = await Word.findOne().skip(random);
  return word ? word.word : null;
};

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
  
  let player = await Player.findOne({ name: playerName });
  if (!player) {
    player = new Player({ name: playerName, score: 0, streak: 0 });
  }
  
  player.streak += 1;
  player.score += word.length + (player.streak * 2) + 1;
  await player.save();
  
  const nextWord = await getNextWord(word.slice(-1));
  if (!nextWord) {
    return res.json({ valid: true, message: "You won! No more words left!", score: player.score });
  }
  
  currentWord = nextWord;
  res.json({ valid: true, nextWord: currentWord, score: player.score });
});

// Leaderboard
const playerSchema = new mongoose.Schema({
  name: String,
  score: Number,
  streak: Number
});
const Player = mongoose.model("Player", playerSchema);

app.get("/leaderboard", async (req, res) => {
  const leaderboard = await Player.find().sort({ score: -1 }).limit(10);
  res.json(leaderboard);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
