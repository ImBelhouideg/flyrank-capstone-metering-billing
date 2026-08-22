require("dotenv").config();
const express = require("express");

const generateRouter = require("./src/routes/generate");
const usageRouter = require("./src/routes/usage");

const app = express();
app.use(express.json());

app.use(generateRouter);
app.use(usageRouter);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Basic error handler as a last resort net.
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
