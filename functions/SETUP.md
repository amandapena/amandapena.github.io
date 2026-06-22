# Toodles Server Setup (SMS Texting)

This sets up a Firebase Cloud Functions backend so Toodles can text you and your partner.

## What you get
- **Daily briefing SMS at 6am** to both you and your partner
- **Send texts from the app** via the "Share with partner" thread

## Prerequisites
- Node.js 20+ installed
- Firebase CLI: `npm install -g firebase-tools`
- A Twilio account (free trial works): https://www.twilio.com/try-twilio

## Setup Steps

### 1. Upgrade Firebase to Blaze (pay-as-you-go)
Go to https://console.firebase.google.com/project/oh-toodles/usage/details
Click "Modify plan" → select Blaze. You'll only pay for what you use (pennies/month for this).

### 2. Install dependencies
```bash
cd functions
npm install
```

### 3. Log in to Firebase
```bash
firebase login
firebase use oh-toodles
```

### 4. Set your secrets
Get your Twilio credentials from https://console.twilio.com
Get a Twilio phone number from https://console.twilio.com/us1/develop/phone-numbers

```bash
firebase functions:secrets:set TWILIO_SID
# paste your Account SID

firebase functions:secrets:set TWILIO_TOKEN
# paste your Auth Token

firebase functions:secrets:set TWILIO_PHONE
# paste your Twilio phone number like +16175551234

firebase functions:secrets:set ANTHROPIC_KEY
# paste your Claude API key
```

### 5. Deploy
```bash
firebase deploy --only functions
```

### 6. Enable in the app
Open Toodles → Settings:
- Add your phone number in "Your phone"
- Add your partner's phone in "Partner's phone"
- Check "Send daily briefing via text at 6am"
- Save

That's it! You'll both get a text from Toodles every morning at 6am.

## Costs
- **Twilio**: ~$1/month for the phone number + $0.0079 per text
- **Firebase Functions**: Free tier covers ~2M invocations/month
- **Claude API**: ~$0.01 per briefing (using Haiku)
- **Total**: ~$2-3/month
