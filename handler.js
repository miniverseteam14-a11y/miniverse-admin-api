const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic();
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_URL = "https://api.airtable.com/v0";

// Rate limit tracking: in-memory cache (resets on deployment)
const rateLimitCache = {};

function checkRateLimit(apiKey) {
  const now = Date.now();
  const hour = Math.floor(now / 3600000);

  if (!rateLimitCache[apiKey]) {
    rateLimitCache[apiKey] = { hour, count: 0 };
  }

  const cached = rateLimitCache[apiKey];
  if (cached.hour !== hour) {
    cached.hour = hour;
    cached.count = 0;
  }

  if (cached.count >= 100) {
    return { allowed: false, remaining: 0 };
  }

  cached.count++;
  return { allowed: true, remaining: 100 - cached.count };
}

async function parseUserInput(userType, message) {
  // Define role-specific prompts for Claude to parse natural language
  const prompts = {
    cherly: `You are parsing media spend input for Cherly. Parse this message into JSON:
    {"amount": <number>, "vendor": "<string>", "channel": "<string>", "po_number": "<string>"}
    Message: "${message}"
    Return only valid JSON.`,

    taylor: `You are parsing budget reallocation input for Taylor. Parse this message into JSON:
    {"from_category": "<string>", "to_category": "<string>", "amount": <number>}
    Message: "${message}"
    Return only valid JSON.`,

    tamar: `You are parsing approval/adjustment input for Tamar. Parse this message into JSON:
    {"action": "approve|adjust|reject", "percent": <number or null>, "details": "<string>"}
    Message: "${message}"
    Return only valid JSON.`,
  };

  try {
    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: prompts[userType],
        },
      ],
    });

    const parsed = JSON.parse(response.content[0].text);
    return parsed;
  } catch (error) {
    console.error("Claude parsing error:", error);
    throw new Error("Failed to parse input");
  }
}

async function updateAirtable(userType, parsedData) {
  // Map user types to Airtable tables
  const tableNames = {
    cherly: "Media Spend",
    taylor: "Budget Reallocations",
    tamar: "Approvals & Adjustments",
  };

  // Create record based on user type
  let recordData = {};
  if (userType === "cherly") {
    recordData = {
      Amount: parsedData.amount,
      Vendor: parsedData.vendor,
      Channel: parsedData.channel,
      PO_Number: parsedData.po_number,
      Timestamp: new Date().toISOString(),
      Status: "pending",
    };
  } else if (userType === "taylor") {
    recordData = {
      From_Category: parsedData.from_category,
      To_Category: parsedData.to_category,
      Amount: parsedData.amount,
      Timestamp: new Date().toISOString(),
      Status: "pending_approval",
    };
  } else if (userType === "tamar") {
    recordData = {
      Action: parsedData.action,
      Adjustment_Percent: parsedData.percent || 0,
      Details: parsedData.details,
      Timestamp: new Date().toISOString(),
      Status: parsedData.action === "approve" ? "approved" : "pending",
    };
  }

  try {
    const url = `${AIRTABLE_API_URL}/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableNames[userType])}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        records: [{ fields: recordData }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Airtable API error: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      success: true,
      recordId: result.records[0].id,
      data: recordData,
    };
  } catch (error) {
    console.error("Airtable error:", error);
    throw new Error("Failed to update Airtable");
  }
}

async function handleRequest(userType, message) {
  try {
    // Step 1: Parse natural language using Claude
    const parsed = await parseUserInput(userType, message);

    // Step 2: Update Airtable
    const result = await updateAirtable(userType, parsed);

    return {
      success: true,
      message: `${userType} input received and processed`,
      recordId: result.recordId,
      data: result.data,
    };
  } catch (error) {
    console.error(`Error handling ${userType} request:`, error);
    return {
      success: false,
      error: error.message,
    };
  }
}

module.exports = { checkRateLimit, handleRequest };
