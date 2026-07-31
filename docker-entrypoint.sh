#!/bin/sh
set -e

npm run prisma:deploy
npm run start
