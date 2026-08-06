let ffmpeg = null;
let ffmpegLoaded = false;

// -----------------------------
// Load ffmpeg once
// -----------------------------
async function loadFFmpeg() {
    if (ffmpegLoaded) return;

    console.log('Loading FFmpeg...');

    const ffmpegLib =
        globalThis.FFmpeg ||
        globalThis.FFmpegWASM;

    if (!ffmpegLib) {
        throw new Error('FFmpeg library not loaded');
    }

    ffmpeg = ffmpegLib.FFmpeg ? new ffmpegLib.FFmpeg() : new ffmpegLib();

    const coreURL = browser.runtime.getURL('vendor/ffmpeg/ffmpeg-core.js');
    const wasmURL = browser.runtime.getURL('vendor/ffmpeg/ffmpeg-core.wasm');

    // Verify files are reachable
    try {
        const coreResp = await fetch(coreURL);

        console.log('core.js status:', coreResp.status);

        const wasmResp = await fetch(wasmURL);

        console.log('wasm status:', wasmResp.status);
    } catch (err) {
        console.error('Failed fetching ffmpeg files', err);
        throw err;
    }

    try {
        const workerURL = browser.runtime.getURL('vendor/ffmpeg/ffmpeg-core.js');

        await ffmpeg.load({
            coreURL,
            wasmURL,
            workerURL
        });

        console.log('FFmpeg loaded successfully');

        ffmpegLoaded = true;

    } catch (err) {
        console.error('ffmpeg.load() failed:', err);
        throw err;
    }
}

// -----------------------------
// Download helper
// -----------------------------
async function fetchFile(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(
            `Failed to fetch ${url}`
        );
    }

    return new Uint8Array(
        await response.arrayBuffer()
    );
}

// -----------------------------
// Merge Reddit video + audio
// -----------------------------
async function mergeAndDownload(
    videoUrl,
    audioCandidates
) {
    await loadFFmpeg();

    console.log('Fetching video...');

    let audioData = null;
    let selectedAudio = null;

    for (const candidate of audioCandidates) {
        try {
            console.log('Trying audio:', candidate);

            audioData = await fetchFile(candidate);

            selectedAudio = candidate;

            console.log('Audio success:', candidate);

            break;
        } catch (err) {
            console.warn('Audio failed:', candidate);
        }
    }

    if (!audioData) {
        console.log('No working audio stream found');

        const downloadId =
            await browser.downloads.download({
                url: videoUrl,
                filename:`reddit_video_${Date.now()}.mp4`,
                saveAs: false
            });
    }
    else {
        const videoData = await fetchFile(videoUrl);

        console.log('Writing files...');

        await ffmpeg.writeFile('video.mp4', videoData);
        await ffmpeg.writeFile('audio.mp4', audioData);

        console.log('Merging...');

        await ffmpeg.exec([
            '-i', 'video.mp4',
            '-i', 'audio.mp4',

            '-map', '0:v:0',
            '-map', '1:a:0',

            '-c:v', 'copy',
            '-c:a', 'copy',

            'output.mp4'
        ]);

        console.log('Reading merged file...');

        const merged = await ffmpeg.readFile('output.mp4');

        console.log('Merged bytes:', merged.length);

        const blob = new Blob(
            [merged.buffer],
            { type: 'video/mp4' }
        );

        const objectUrl = URL.createObjectURL(blob);

        const downloadId =
            await browser.downloads.download({
                url: objectUrl,
                filename:`reddit_video_${Date.now()}.mp4`,
                saveAs: false
            });

        console.log('Download started:', downloadId);

        // Give Firefox time to consume blob URL
        setTimeout(() => {
            URL.revokeObjectURL(objectUrl);
        }, 30000);

        console.log('Cleaning up...');

        await ffmpeg.deleteFile('video.mp4');
        await ffmpeg.deleteFile('audio.mp4');
        await ffmpeg.deleteFile('output.mp4');
    }

    console.log('Done');
}

// -----------------------------
// Redgif Downloader
// -----------------------------
async function downloadRedgifs(pageUrl) {
    try {
        console.log('Fetching Redgifs:', pageUrl);

        // Parse gif id
        const match = pageUrl.match(/\/watch\/([^/?#]+)/i);

        if (!match) {
            throw new Error('Could not parse Redgifs id');
        }

        const gifId = match[1];

        console.log('Gif id:', gifId);

        // ----------------------------------
        // Get guest token
        // ----------------------------------
        const authResponse =
            await fetch(
                'https://api.redgifs.com/v2/auth/temporary',
                {
                    method: 'GET'
                }
            );

        if (!authResponse.ok) {
            throw new Error(`Token request failed: HTTP ${authResponse.status}`);
        }

        const authData = await authResponse.json();

        const token = authData?.token;

        if (!token) {
            throw new Error('No Redgifs token returned');
        }

        console.log('Got temporary token');

        // ----------------------------------
        // Fetch gif metadata
        // ----------------------------------
        const response =
            await fetch(
                `https://api.redgifs.com/v2/gifs/${gifId}`,
                {
                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            );

        if (!response.ok) {
            throw new Error(`Gif request failed: HTTP ${response.status}`);
        }

        const data = await response.json();

        const urls = data?.gif?.urls;

        const videoUrl = urls?.hd || urls?.sd;

        if (!videoUrl) {
            throw new Error('No downloadable video URL found');
        }

        console.log('Downloading:', videoUrl);

        await browser.downloads.download({
            url: videoUrl,
            filename: `${gifId}.mp4`
        });

    } catch (err) {
        console.error('Redgifs failed:', err);
    }
}

// -----------------------------
// Imgur Album Downloader
// -----------------------------
async function downloadImgurAlbum(albumUrl) {
    let tab = null;

    console.log('Downloading Imgur Album');

    try {
        console.log('Opening Imgur album:', albumUrl);

        const match = albumUrl.match(/imgur\.com\/(?:a|gallery)\/([^/?#]+)/i);
        if (!match) throw new Error('Could not parse Imgur album ID');

        tab = await browser.tabs.create({ url: albumUrl, active: false });

        console.log('Created Tab');

        // Wait for page to finish loading
        await new Promise((resolve) => {
            const listener = (tabId, changeInfo) => {
                if (tabId === tab.id && changeInfo.status === 'complete') {
                    browser.tabs.onUpdated.removeListener(listener);
                    resolve();
                }
            };
            browser.tabs.onUpdated.addListener(listener);
        });

        // Small grace period for JS to finish setting up the store
        await new Promise(r => setTimeout(r, 1500));

        const injected = function() {
            return new Promise(function(resolve) {
                var seen = {};
                var urls = [];
                var maxAttempts = 60;
                var attempts = 0;

                function collect() {
                    Array.from(document.querySelectorAll('img.image-placeholder')).forEach(function(img) {
                        var src = (img.currentSrc || img.src || '').split('?')[0];
                        if (src && src.indexOf('i.imgur.com') !== -1 && !seen[src]) {
                            seen[src] = true;
                            urls.push(src);
                        }
                    });
                }

                function step() {
                    // Check if we've hit the end sentinel
                    var sentinel = document.querySelector('h2.BottomRecirc-label');
                    if (sentinel) {
                        collect();
                        resolve({ source: 'scroll', urls: urls });
                        return;
                    }

                    // Bail out after max attempts
                    if (attempts >= maxAttempts) {
                        collect();
                        resolve({ source: 'scroll_timeout', urls: urls });
                        return;
                    }

                    collect();
                    window.scrollBy(0, 800);
                    attempts++;
                    setTimeout(step, 300);
                }

                // Scroll back to top first, then start
                window.scrollTo(0, 0);
                setTimeout(step, 500);
            });
        }.toString();

        const results = await browser.tabs.executeScript(tab.id, {
            code: '(' + injected + ')()'
        });

        const result = results?.[0];
        console.log('Imgur extraction:', result?.source, 'found:', result?.urls?.length);

        const downloadUrls = result?.urls || [];

        if (!downloadUrls.length) throw new Error('No images found');

        console.log('Downloading ' + downloadUrls.length + ' images');

        for (var i = 0; i < downloadUrls.length; i++) {
            var url = downloadUrls[i];
            var filename = url.split('/').pop().split('?')[0];
            await browser.downloads.download({ url: url, filename: filename });
        }

    } catch (err) {
        console.error('Imgur album failed:', err.message, err.stack);  // ADD .message and .stack
    } finally {
        if (tab && tab.id) {
            try { await browser.tabs.remove(tab.id); } catch (e) {}
        }
    }
}
// -----------------------------
// Message listener
// -----------------------------
browser.runtime.onMessage.addListener(
    (message) => {
        console.log('MESSAGE RECEIVED', message);

        return handleMessage(message);
    }
);

async function handleMessage(message) {
    // Regular Download
    if (message.action === 'download') {
        const url = message.url;

        const filename =
            url
                .split('/')
                .pop()
                .split('?')[0];

        return browser.downloads.download({
            url,
            filename
        });
    }

    // Reddit Video Merge
    if (message.action === 'downloadVideoWithAudio') {
        try {
            await mergeAndDownload(
                message.videoUrl,
                message.audioCandidates
            );
        } catch (err) {
            console.error('Merge failed:', err);        
        }
    }

    // Red Gif Download
    if (message.action === 'downloadRedgifs') {
        downloadRedgifs(message.pageUrl);
    }

    // Imgur Ablum Downloader
    if (message.action === 'downloadImgurAlbum') {
        downloadImgurAlbum(message.albumUrl);
    }
}
