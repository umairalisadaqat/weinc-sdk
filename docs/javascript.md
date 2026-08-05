# JavaScript and TypeScript

```
npm install weinc
```

## Quick start

```ts
import { WeInc } from "weinc"

const client = new WeInc() // reads WEINC_API_KEY from the environment

const build = await client.builds.create({
  prompt: "a landing page for my coffee roastery",
})
console.log(build.url)

const projects = await client.projects.list()
```

## Configuration

| Setting | Environment variable | Default |
| --- | --- | --- |
| API key | `WEINC_API_KEY` | required |
| Base URL | `WEINC_BASE_URL` | `https://my.we.inc/api` |

Full product documentation lives at <https://we.inc>.
