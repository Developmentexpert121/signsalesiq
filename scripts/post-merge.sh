#!/bin/bash
set -e
npm install
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run db:push
