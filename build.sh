#!/bin/sh
ls -alhp > ls.txt
mkdir -p ./public
mv ls.txt ./public
yarn now-build-orig 2>&1 1>./public/build.log
exit 0
