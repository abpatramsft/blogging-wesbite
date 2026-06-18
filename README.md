# blogging-wesbite

A small, locally deployable blogging website with a Node.js/Express backend and a
vanilla JavaScript frontend. Blog posts are stored as Markdown files (with YAML-ish
frontmatter) under `content/posts/`, so they stay inspectable on disk and
committable to the repo.

## Features

- **Public blog** (`/`) — lists published posts and renders individual articles.
- **Writing studio** (`/studio.html`) — create, edit, live-preview, publish/unpublish,
  and delete posts.
- **REST API** over the post store.
- **Markdown on disk** — every post is a `content/posts/<slug>.md` file.

## Requirements

- Node.js 18+ (uses ES modules)

## Getting started

```bash
npm install
npm start
```

Then open:

- Public blog: <http://127.0.0.1:3000/>
- Writing studio: <http://127.0.0.1:3000/studio.html>

For auto-reload during development:

```bash
npm run dev
```

### Configuration

| Variable | Default     | Description                |
| -------- | ----------- | -------------------------- |
| `PORT`   | `3000`      | Port the server listens on |
| `HOST`   | `127.0.0.1` | Host the server binds to   |

## Project structure

```
src/
  server.js     Express app: REST API + static frontend + Markdown rendering
  store.js      PostStore — reads/writes Markdown posts under content/posts/
public/
  index.html    Public blog (hash-routed list + article views)
  studio.html   Writing studio
  css/style.css Styles
  js/blog.js    Public blog logic
  js/studio.js  Studio logic
content/posts/  Markdown post files (the data)
```

## API

Base path: `/api`

| Method   | Path                     | Description                                  |
| -------- | ------------------------ | -------------------------------------------- |
| `GET`    | `/posts`                 | List posts. `?status=published` to filter.   |
| `POST`   | `/posts`                 | Create a post (or update when `slug` given). |
| `GET`    | `/posts/:slug`           | Get one post (includes rendered `html`).     |
| `PUT`    | `/posts/:slug`           | Update a post.                               |
| `DELETE` | `/posts/:slug`           | Delete a post.                               |
| `POST`   | `/posts/:slug/publish`   | Publish a draft.                             |
| `POST`   | `/posts/:slug/unpublish` | Move a published post back to draft.         |
| `POST`   | `/render`                | Render Markdown `{ content }` to `{ html }`. |

### Post shape

```json
{
  "slug": "welcome-to-my-blog",
  "title": "Welcome to my blog",
  "status": "published",
  "excerpt": "…",
  "tags": ["welcome", "getting-started"],
  "content": "# Markdown body…",
  "createdAt": "2026-06-18T10:14:08.615Z",
  "updatedAt": "2026-06-18T10:14:08.615Z",
  "publishedAt": "2026-06-18T10:14:08.615Z"
}
```

## Notes

The original Blog Studio Copilot canvas extension under
`.github/extensions/blog-studio/` is left in place; this standalone app reuses the
same on-disk Markdown storage model so existing posts work unchanged.