# RoseEmerged

Akai and Hoor’s software portfolio. Each published project has a planter, an illustrated completion percentage and an optional project link. Three projects fit on a plot. The same rose renderer powers the garden and the editor preview.

## Open the sample garden

Install Node.js 22.13 or newer. From this directory run:

```sh
npm run demo
```

Open http://127.0.0.1:4317. Bubbles, Voice Ledger and Modesty Filter are clearly marked illustrative records, with no invented project URLs. Development uses its own persistent database. The read-only `/demo` route shows the original samples even on a clean installation.

## Start the real portfolio locally

1. Stop any demo server on the same port. In this directory run the following commands in an interactive terminal. Each account command prompts for a hidden password of 12–256 characters.
   
   ```sh
   node account.mjs mohammad.akai21@gmail.com
   node account.mjs hoorhkk@gmail.com
   npm start
   ```
2. Open http://127.0.0.1:4317/admin. Sign in using mohammad.akai21@gmail.com or hoorhkk@gmail.com using the corresponding password.
3. Choose **New project**. Enter the title, project type, description and completion percentage. Thumbnail and project URLs are optional. Inspect the rose preview, select the publish checkbox when ready and save.
4. Open http://127.0.0.1:4317 to see the project. Unpublished records are visible only in the authenticated dashboard. Adding the fourth published project enables **Next plot**.
5. The list arrows change project order. Unchecking publication and saving removes the project from the public garden. Deletion requires confirmation.

The two administrators share the same SQLite database. `data/garden.sqlite` contains real projects, password hashes and sessions. Back up this directory privately using a SQLite-aware backup or with the server stopped. To reset a password, rerun that account command. Existing sessions for that user expire immediately. For dashboard practice on the development database, append `--demo` to both account commands and start with `npm run demo`.

## Deployment

**Sites.** The built Worker uses a private R2 binding named `BUCKET`. The worker checks the identity supplied by Sites on every admin data request. Configure the server-side runtime settings `AKAI_EMAIL` and `HOOR_EMAIL` to the exact email addresses of your respective ChatGPT accounts. Open the site's `/admin` route and select **Sign in with ChatGPT**. The garden starts empty, while `/demo` always shows the labeled sample collection. The Site must allow the intended visitors at the platform level. A newly created Site is owner-private until its audience is changed. The bucket must remain private. Version-checked writes detect overlapping saves.

**Node host.** Use a Node host with a persistent disk if self-hosting. Mount the data directory, set `ROSE_DATA_DIR` to its absolute path for both account setup and serving, run both account commands on that host, and start the server with `npm start`. `HOST` defaults to loopback and `PORT` defaults to 4317. Put the service behind an HTTPS reverse proxy that preserves the Host header and set `ROSE_HTTPS=1` for secure cookies and origin checks. The Node server ignores forwarded identity headers.

## Check and build

```sh
npm test
npm run build
```

The service tests start a real HTTP server with disposable credentials and a temporary database. They cover both accounts, unauthorized reads and writes, invalid URLs and percentages, draft privacy, publication, reordering, deletion and logout. The build packages the public assets and API into the Sites Worker under `dist/`. No frontend dependency installation is required.

## Standalone deployment

The Node server supports email and password sign-in independently of ChatGPT. The only permitted emails are mohammad.akai21@gmail.com and hoorhkk@gmail.com, defined server-side in admins.mjs. Run the account setup commands above on your destination host to set your own app passwords. Existing Akai and Hoor password records continue to work with their corresponding email logins. Email/password sign-in does not use your Gmail password.

Deploy this source directory to a Node host with a persistent disk. Set HOST=0.0.0.0, PORT as required by the host, ROSE_DATA_DIR to the persistent disk path and ROSE_HTTPS=1 behind HTTPS. Run npm start. Open https://your-domain/admin and enter your configured email and app password. Hosted Sites preview continues to use its platform sign-in.
