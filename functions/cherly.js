const { checkRateLimit, handleRequest } = require("./handler");

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Step 1: Extract and validate Bearer token
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (token !== process.env.CHERLY_API_KEY) {
      return res.status(401).json({ error: "Invalid or missing API key" });
    }

    // Step 2: Check rate limit
    const rateLimit = checkRateLimit(token);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: "Rate limit exceeded (100 requests/hour)",
        retryAfter: 3600,
      });
    }

    // Step 3: Parse request body
const input = req.body.message || JSON.stringify(req.body);
    // Step 4: Handle the request
   const result = await handleRequest("cherly", input);

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: result.message,
        recordId: result.recordId,
        data: result.data,
        rateLimit: rateLimit.remaining,
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.error,
        rateLimit: rateLimit.remaining,
      });
    }
  } catch (error) {
    console.error("Cherly API error:", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
};
