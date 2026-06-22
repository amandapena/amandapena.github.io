const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

const TWILIO_SID = defineSecret("TWILIO_SID");
const TWILIO_TOKEN = defineSecret("TWILIO_TOKEN");
const TWILIO_PHONE = defineSecret("TWILIO_PHONE");
const ANTHROPIC_KEY = defineSecret("ANTHROPIC_KEY");

function getTwilio() {
  return require("twilio")(TWILIO_SID.value(), TWILIO_TOKEN.value());
}

async function sendSms(to, body) {
  const client = getTwilio();
  const phone = to.replace(/[^\d+]/g, "");
  if (!phone || phone.length < 10) return null;
  const formatted = phone.startsWith("+") ? phone : "+1" + phone;
  return client.messages.create({
    body: body.substring(0, 1600),
    from: TWILIO_PHONE.value(),
    to: formatted,
  });
}

async function generateBriefing(familyData) {
  const Anthropic = require("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: ANTHROPIC_KEY.value() });
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const name = familyData.assistantName || "Toodles";
  const you = familyData.yourName || "you";
  const kids = familyData.kids || "";
  const location = familyData.location || "";
  const extra = familyData.extraContext || "";

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    system: `You are ${name}, a family planning assistant for ${you}. Today is ${today}. Family: ${you}, partner, kids: ${kids}. ${location ? "Location: " + location : ""} ${extra ? "Context: " + extra : ""}
Write a brief morning text message (under 300 words). Include:
- A warm greeting
- Quick weather note if location is known (guess based on season/location)
- Any reminders or tips for the day
- Keep it friendly and concise — this is an SMS text message`,
    messages: [{ role: "user", content: "Send me my morning briefing text!" }],
  });

  return msg.content[0]?.text || "Good morning! Have a great day!";
}

// Runs every day at 6am Eastern
exports.dailyBriefingSms = onSchedule(
  {
    schedule: "0 6 * * *",
    timeZone: "America/New_York",
    secrets: [TWILIO_SID, TWILIO_TOKEN, TWILIO_PHONE, ANTHROPIC_KEY],
  },
  async () => {
    const families = await db.collection("families").get();
    for (const doc of families.docs) {
      const data = doc.data();
      const config = data.config || {};
      if (!config.smsEnabled) continue;

      try {
        const briefing = await generateBriefing(config);
        const phones = [];
        if (config.yourPhone) phones.push({ name: config.yourName, phone: config.yourPhone });
        if (config.partnerPhone) phones.push({ name: config.partnerName, phone: config.partnerPhone });

        for (const { name, phone } of phones) {
          const greeting = name ? `Hey ${name}! ` : "";
          await sendSms(phone, `${greeting}${briefing}\n\n— ${config.assistantName || "Toodles"} 🐔`);
        }
      } catch (e) {
        console.error("Briefing SMS failed for family", doc.id, e);
      }
    }
  }
);

// HTTP endpoint for sending a text from the app
exports.sendText = onRequest(
  { cors: true, secrets: [TWILIO_SID, TWILIO_TOKEN, TWILIO_PHONE] },
  async (req, res) => {
    if (req.method !== "POST") return res.status(405).send("POST only");

    const { to, message, idToken } = req.body;
    if (!to || !message || !idToken) return res.status(400).json({ error: "Missing to, message, or idToken" });

    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      const snap = await db.collection("families")
        .where("memberIds", "array-contains", decoded.uid)
        .limit(1).get();
      if (snap.empty) return res.status(403).json({ error: "No family found" });

      const result = await sendSms(to, message);
      res.json({ success: true, sid: result.sid });
    } catch (e) {
      console.error("sendText error:", e);
      res.status(500).json({ error: e.message });
    }
  }
);
