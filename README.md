# Reddit / Pixiv Download Extension
Small Firefox extension to download images and videos from Reddit (old.reddit.com) and Pixiv using AI to generate code and assist with debugging

Intended use for downloading images, galleries, gifs, videos, and images within comments.

## Setup
### FFMPEG Setup:
Download ffmpeg 0.12.1 into the vendor/ffmpeg folder _(you will need to add this)_

Run _(npm)_
 - npm install @ffmpeg/ffmpeg@0.12.1
 - npm install @ffmpeg/core@0.12.1

Add the following files in the ffmpeg folder
 -  814.ffmpeg
 -  814.ffmpeg.js.map
 -  ffmpeg
 -  ffmpeg.js.map
 -  ffmpeg-core
 -  ffmpeg-core.wasm

## TODO
 - Fix bug with comments increase number of buttons with comment depth
 - Review imgur downloading and comment functions to ensure they are match standards with other functions
