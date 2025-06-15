# overview

This a minomuncher server that implements rate limiting to proxy requests to parse and download replays.
It must be used in conjunction with an official Tetr.io bot account, the rate limit being used to conform to a osk-mandated request limit.

set the TETRIO_USERNAME TETRIO_PASSWORD env variables

use the MINOMUNCHER_PORT env var (default 3000)

# setup

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run .
```
