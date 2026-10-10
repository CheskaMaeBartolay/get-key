# KafkaMulti trial website

This separate Vercel website is opened by the app Get key button. Visitors can create one Pro trial key per network every 30 days. Each trial lasts 2 days and allows one device. The site generates a random key on the server, stores only its SHA-256 hash in Supabase, and shows the raw key once so the visitor can copy it into the app.

## Set up Supabase

1. Open `supabase-trial-rate-limit.sql` from this folder, copy its contents, and run it in Supabase Dashboard > SQL Editor > New query.
2. Rotate the Supabase secret API key that was previously pasted into chat. Never put the replacement in this folder, an APK, or chat.

## Deploy this folder to Vercel

This folder is directly on your Desktop and outside the Git workspace. In PowerShell, run:

```powershell
cd "$env:USERPROFILE\Desktop\key get"
npx vercel
```

Follow the prompts to create or link a Vercel project. For production deployment, run `npx vercel --prod` from this folder. Vercel serves `index.html` and the function in `api/issue.js`.

In Vercel Project Settings > Environment Variables, add these values, then redeploy:

- `SUPABASE_URL` = `https://szzdgorliywvogtmludf.supabase.co`
- `SUPABASE_SECRET_KEY` = the newly rotated Supabase secret key
- `TRIAL_RATE_LIMIT_SALT` = a new private random string
- `SITE_ORIGIN` = the exact public Vercel URL, e.g. `https://your-project.vercel.app` (no trailing slash)

Generate the salt locally in PowerShell and paste it directly into Vercel; do not send it in chat:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

## Connect the Android app

After deployment, set the public Vercel URL as `LICENSE_PORTAL_URL` in `KafkaMulti/secrets.properties`, then rebuild the Android app. Send me only the public URL if you want me to configure and rebuild it. Do not send secrets.

## Notes

- The browser never receives the Supabase secret key or the trial-rate-limit salt.
- Supabase stores the license key hash and a salted hash of the request IP, not either raw value.
- The 30-day limit is a basic per-network abuse control. People sharing one network also share the limit, and VPNs can evade IP-based controls.
