#!/bin/sh
mkdir -p ./public
printf '<!DOCTYPE html><h1>Hello, world!</h1>' > ./public/index.html
{
    # sha256sum yarn.lock
    # pushd packages/hdwallet-keepkey-nodewebusb
    # yarn add --dev webusb@^2.2.0
    # sha256sum yarn.lock
    # cat package.json
    # popd
    # yarn install
    sha256sum yarn.lock
    cat yarn.lock
} 2>&1 1>./public/build.log
exit 0
