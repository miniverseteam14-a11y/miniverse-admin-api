const rateLimitCache = {};
 
function checkRateLimit(apiKey) {
  const now = Date.now();
  const oneHourAgo = now - 3600000;
 
  if (!rateLimitCache[apiKey]) {
    rateLimitCache[apiKey] = [];
  }
 
  // Clean up old requests
  rateLimitCache[apiKey] = rateLimitCache[apiKey].filter(
    (timestamp) => timestamp > oneHourAgo
  );
 
  const allowed = rateLimitCache[apiKey].length < 100;
  if (allowed) {
    rateLimitCache[apiKey].push(now);
  }
 
  return {
    allowed,
    remaining: Math.max(0, 100 - rateLimitCache[apiKey].length),
  };
}
 
async function parseUserInput(userType, input) {
  try {
    // Parse input as JSON directly (no Claude API calls)
    const parsed = typeof input === "string" ? JSON.parse(input) : input;
    return parsed;
  } catch (error) {
    throw new Error(`Failed to parse input: ${error.message}`);
  }
}
 
async function updateAirtable(userType, parsedData) {
  const baseId = process.env.AIRTABLE_BASE_ID;
  const apiKey = process.env.AIRTABLE_API_KEY;
 
  if (!baseId || !apiKey) {
    throw new Error("Missing Airtable credentials");
  }
 
  // Determine table name based on user type
  let tableName = "Media Spend";
  if (userType === "taylor") tableName = "Daily Budget";
  if (userType === "tamar") tableName = "Approvals";
 
  // Prepare the record fields
  let fields = {};
 
  if (userType === "cherly") {
    // Cherly: Media spend tracking
    fields = {
      Amount: parsedData.amount,
      Vendor: parsedData.vendor,
      Channel: parsedData.channel,
      "PO Number": parsedData.po_number,
      Timestamp: new Date().toISOString(),
    };
  } else if (userType === "taylor") {
    // Taylor: Daily budget management
    fields = {
      Date: parsedData.date || new Date().toISOString().split("T")[0],
      "Budget Amount": parsedData.budget_amount,
      Status: parsedData.status || "Pending",
      Notes: parsedData.notes,
      Timestamp: new Date().toISOString(),
    };
  } else if (userType === "tamar") {
    // Tamar: Approvals/adjustments
    fields = {
      Action: parsedData.action,
      "Adjustment Percent": parsedData.percent,
      Details: parsedData.details,
      "Approved By": "Tamar",
      Timestamp: new Date().toISOString(),
    };
  }
 
  // Send to Airtable REST API
  const response = await fetch(
    `https://api.airtable.com/v0/${baseId}/${tableName}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
    }
  );
 
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Airtable error: ${response.status} - ${error}`);
  }
 
  const result = await response.json();
  return result;
}
 
async function handleRequest(userType, input) {
  try {
    // Step 1: Parse the input
    const parsedData = await parseUserInput(userType, input);
 
    // Step 2: Validate required fields based on user type
    if (userType === "cherly") {
      if (!parsedData.amount || !parsedData.vendor) {
        return {
          success: false,
          error: "Missing required fields: amount, vendor",
        };
      }
    } else if (userType === "taylor") {
      if (!parsedData.budget_amount) {
        return {
          success: false,
          error: "Missing required field: budget_amount",
        };
      }
    } else if (userType === "tamar") {
      if (!parsedData.action) {
        return {
          success: false,
          error: "Missing required field: action",
        };
      }
    }
 
    // Step 3: Update Airtable
    const result = await updateAirtable(userType, parsedData);
 
    return {
      success: true,
      message: `Record created successfully for ${userType}`,
      recordId: result.id,
      data: result.fields,
    };
  } catch (error) {
    console.error(`Error in handleRequest for ${userType}:`, error);
    return {
      success: false,
      error: error.message,
    };
  }
}
 
module.exports = { checkRateLimit, handleRequest };
 
