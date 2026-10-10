const { createHash, createHmac, randomBytes } = require("node:crypto");

function send(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

module.exports = async function issueTrial(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed." });

  const allowedOrigin = (process.env.SITE_ORIGIN || "").replace(/\/$/, "");
  const origin = (req.headers.origin || "").replace(/\/$/, "");
  if (!allowedOrigin || origin !== allowedOrigin) {
    return send(res, 403, { error: "Open the official KafkaMulti trial page to continue." });
  }

  const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || "";
  const rateLimitSalt = process.env.TRIAL_RATE_LIMIT_SALT || "";
  if (!supabaseUrl || !supabaseSecretKey || !rateLimitSalt) {
    return send(res, 500, { error: "Trial service is not configured yet." });
  }

  // Vercel supplies the client address. Only its hash is sent to Supabase.
  const forwarded = req.headers["x-vercel-forwarded-for"] || req.headers["x-forwarded-for"] || "";
  const clientAddress = String(forwarded).split(",")[0].trim();
  if (!clientAddress) return send(res, 400, { error: "Could not identify the request. Try again." });
  const ipHash = createHmac("sha256", rateLimitSalt).update(clientAddress).digest("hex");

  try {
    const slotResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/claim_trial_slot`, {
      method: "POST",
      headers: {
        apikey: supabaseSecretKey,
        Authorization: `Bearer ${supabaseSecretKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ p_ip_hash: ipHash })
    });
    if (!slotResponse.ok) {
      console.error("Supabase trial rate-limit error:", slotResponse.status, (await slotResponse.text()).slice(0, 300));
      return send(res, 502, { error: "Trial service could not check eligibility. Please try again later." });
    }
    if ((await slotResponse.json()) !== true) {
      return send(res, 429, { error: "A trial was already created from this network recently. Contact support if you need help." });
    }

    const licenseKey = `KFM-${randomBytes(32).toString("hex").toUpperCase()}`;
    const keyHash = createHash("sha256").update(licenseKey, "utf8").digest("hex");
    const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const dbResponse = await fetch(`${supabaseUrl}/rest/v1/licenses`, {
      method: "POST",
      headers: {
        apikey: supabaseSecretKey,
        Authorization: `Bearer ${supabaseSecretKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        key_hash: keyHash,
        status: "active",
        plan: "pro",
        expires_at: expiresAt,
        device_limit: 1
      })
    });
    if (!dbResponse.ok) {
      console.error("Supabase license insert failed:", dbResponse.status, (await dbResponse.text()).slice(0, 300));
      return send(res, 502, { error: "Could not save the trial. Please try again later." });
    }
    return send(res, 201, { license_key: licenseKey, plan: "pro", trial_days: 2, expires_at: expiresAt, device_limit: 1 });
  } catch (error) {
    console.error("Trial issue request failed:", error && error.message ? error.message : "unknown error");
    return send(res, 502, { error: "Could not reach the license service. Try again later." });
  }
};
