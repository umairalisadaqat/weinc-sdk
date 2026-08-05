# WeInc SDK

Official SDK for [WeInc](https://we.inc), the AI website builder.

You describe the site you want and WeInc builds a real, production website:
React, TypeScript and Tailwind under the hood, with hosting, visual editing and
custom domain support included. Agencies can run the whole thing under their own
brand.

The SDK lets you do the same thing from your own code: start builds, list
projects, and fetch the generated source.

## Install

Python:

```
pip install weinc
```

JavaScript / TypeScript:

```
npm install weinc
```

## Get an API key

Create one in your account settings at [my.we.inc](https://my.we.inc), then set
it in your environment:

```
export WEINC_API_KEY=your_key_here
```

## Also available

- Command line: `brew tap umairalisadaqat/weinc && brew trust umairalisadaqat/weinc && brew install weinc`
- Docker: `docker run --rm umairalisadaqat/weinc-cli build "your idea"`
- MCP server, for AI assistants: [weinc-mcp](https://github.com/umairalisadaqat/weinc-mcp)

## Links

- Website: <https://we.inc>
- App: <https://my.we.inc>
- Source: <https://github.com/umairalisadaqat/weinc-sdk>
