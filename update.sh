#!/bin/bash

pm2 delete nxsysupdate
git pull
yarn
yarn run build
pm2 start ./nxsysupdate.config.js
pm2 save