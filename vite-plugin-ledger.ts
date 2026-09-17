import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { handleLedgerRequest } from './server/http-api.mjs'

function middleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) {
  void handleLedgerRequest(req, res).then((handled) => {
    if (!handled) next()
  })
}

export function ledgerApiPlugin(): Plugin {
  return {
    name: 'ledger-api',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}
