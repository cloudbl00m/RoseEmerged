# Publish RoseEmerged with GitHub Pages

The self-contained export contains published projects, shared skills, thumbnails, rain, flower growth and the contact animation. A paid backend is unnecessary.

## First deployment

1. Extract RoseEmerged-GitHub-Pages.zip into a new folder. It includes a clean source copy and the current published export. Keep your original Downloads/RoseEmerged folder for local administration and its private database.
2. Create a public GitHub repository, for example RoseEmerged. Upload the extracted source files, including .github/workflows/pages.yml and site-content/published.json. Use main as the branch.
3. In Settings > Pages, select GitHub Actions as the build and deployment source.
4. In Actions, run Deploy garden to GitHub Pages. The workflow also runs whenever main changes.
5. After deployment succeeds, Settings > Pages shows your URL, normally https://YOUR-USERNAME.github.io/RoseEmerged/.

No passwords, database, sessions or drafts are in the export. Team profiles export only shared skills. The public /admin/ page explains how to manage the garden locally.

## Later updates

1. Run npm start in your original Downloads/RoseEmerged folder and open the printed localhost URL with /admin appended.
2. Save your edits. Publish projects you want to display.
3. Run npm run export:pages in that folder.
4. Replace site-content/published.json in the GitHub repository with the updated file. Upload any changed application code and visual assets too. The workflow rebuilds automatically.

Local dashboard saves reach the public site after you export and push. Unpublishing requires another export and deployment. Previously published data may remain in Git history.

## Build locally

Node.js 22.13 or newer is required. For a repository named RoseEmerged, run these commands in PowerShell:

    npm run export:pages
    $env:PAGES_BASE_PATH='/RoseEmerged/'
    npm run build:pages

The static build is in pages-dist/. The workflow sets the correct base path automatically for repository sites, user sites and custom domains.

## Added files

- export-pages.mjs reads published projects and selected images from your private local database.
- site-content/published.json is the public snapshot to commit.
- build-pages.mjs creates the static site with repository-safe paths.
- .github/workflows/pages.yml deploys the generated site.
- public/content-url.js maps public requests to static JSON in the Pages build.

Admin sign-in, uploads and edits run locally. Online admin from other devices would need a separately hosted backend.
